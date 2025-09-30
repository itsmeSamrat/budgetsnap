import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Camera, AlertCircle, CheckCircle, FileText, Copy, RefreshCw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UploadState {
  file: File | null;
  uploading: boolean;
  processing: boolean;
  error: string;
  success: string;
}

// Persistent OCR state that survives navigation
interface PersistentOcrState {
  ocrText: string;
  showOcrText: boolean;
  isProcessingComplete: boolean;
}

const OCR_STORAGE_KEY = 'budgetsnap_ocr_text';

export function UploadPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<UploadState>({
    file: null,
    uploading: false,
    processing: false,
    error: '',
    success: '',
  });
  
  const [ocrState, setOcrState] = useState<PersistentOcrState>({
    ocrText: '',
    showOcrText: false,
    isProcessingComplete: false,
  });

  const [countdown, setCountdown] = useState<number | null>(null);

  // Load OCR text from localStorage on component mount
  useEffect(() => {
    const savedOcrState = localStorage.getItem(OCR_STORAGE_KEY);
    if (savedOcrState) {
      try {
        const parsed = JSON.parse(savedOcrState);
        setOcrState(parsed);
      } catch (error) {
        console.error('Failed to parse saved OCR state:', error);
        localStorage.removeItem(OCR_STORAGE_KEY);
      }
    }
  }, []);

  // Save OCR text to localStorage whenever it changes
  useEffect(() => {
    if (ocrState.ocrText || ocrState.showOcrText) {
      localStorage.setItem(OCR_STORAGE_KEY, JSON.stringify(ocrState));
    }
  }, [ocrState]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setState(prev => ({ 
          ...prev, 
          file, 
          error: '', 
          success: ''
        }));
        // Clear OCR text and localStorage when new file is selected
        setOcrState({
          ocrText: '',
          showOcrText: false,
          isProcessingComplete: false,
        });
        localStorage.removeItem(OCR_STORAGE_KEY);
      } else {
        setState(prev => ({ ...prev, error: 'Please select an image file.' }));
      }
    }
  };

  const handleUpload = async () => {
    if (!state.file || !user || loading) return;

    setState(prev => ({ ...prev, uploading: true, error: '', success: '' }));

    try {
      // Ensure we have a fresh session before uploading
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Check if we're using mock client
      if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'your-supabase-url-here') {
        throw new Error('Please configure Supabase environment variables to upload receipts. For now, you can use the "Add Demo Transactions" button to test the app.');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}_${state.file.name}`;
      const filePath = `${session.user.id}/${filename}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, state.file);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Storage bucket "receipts" not found. Please create the bucket in your Supabase dashboard under Storage.');
        }
        throw uploadError;
      }

      setState(prev => ({ ...prev, uploading: false, processing: true }));

      // Process the image using Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process_image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imagePath: filePath }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        let errorMessage = 'Processing failed';
        try {
          // Clone the response to avoid "body stream already read" error
          const responseClone = response.clone();
          const errorData = await responseClone.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          // If response is not JSON, use the response text
          try {
            const errorText = await response.text();
            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        throw new Error('Invalid response from processing service');
      }
      
      setState(prev => ({ 
        ...prev, 
        processing: false,
        success: 'Receipt processed successfully!',
      }));
      
      // Set OCR text in persistent state
      setOcrState({
        ocrText: result.debug?.ocrText || result.text || '',
        showOcrText: true,
        isProcessingComplete: true,
      });

      // Clear the file after successful processing but keep OCR text
      setState(prev => ({ ...prev, file: null }));

      // Start countdown and navigate after 5 seconds
      setCountdown(5);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            navigate(`/transactions?highlight=${result.transaction.id}`);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      // Cleanup function in case component unmounts
      setTimeout(() => {
        clearInterval(countdownInterval);
      }, 5000);

    } catch (error: any) {
       // Handle timeout specifically
       if (error.name === 'TimeoutError') {
         error.message = 'Processing timed out. Please try again with a clearer image.';
       }
       
      setState(prev => ({
        ...prev,
        uploading: false,
        processing: false,
        error: error.message || 'Upload failed. Please try again.'
      }));
    }
  };

  const handleCopyOcrText = async () => {
    if (ocrState.ocrText) {
      try {
        await navigator.clipboard.writeText(ocrState.ocrText);
        setState(prev => ({ ...prev, success: 'OCR text copied to clipboard!' }));
        setTimeout(() => setState(prev => ({ ...prev, success: '' })), 2000);
      } catch (error) {
        setState(prev => ({ ...prev, error: 'Failed to copy text to clipboard' }));
      }
    }
  };

  const handleRefreshOcr = async () => {
    if (!user) return;

    // If no file is currently selected, we can't refresh OCR
    if (!state.file) {
      setState(prev => ({ ...prev, error: 'Please select a new image file to refresh OCR.' }));
      return;
    }

    setState(prev => ({ ...prev, processing: true, error: '', success: '' }));
    try {
      // Ensure we have a fresh session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Check if we're using mock client
      if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'your-supabase-url-here') {
        throw new Error('Please configure Supabase environment variables to refresh OCR.');
      }

      // Generate unique filename for re-upload
      const timestamp = Date.now();
      const filename = `${timestamp}_${state.file.name}`;
      const filePath = `${session.user.id}/${filename}`;

      // Upload file again
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, state.file);

      if (uploadError) throw uploadError;

      // Process with OCR only (don't save transaction)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process_image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imagePath: filePath, ocrOnly: true }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      setState(prev => ({ 
        ...prev, 
        processing: false,
        success: 'OCR refreshed successfully!',
      }));
      
      // Update OCR text in persistent state
      setOcrState({
        ocrText: result.debug?.ocrText || result.text || '',
        showOcrText: true,
        isProcessingComplete: false,
      });
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        processing: false, 
        error: error.message || 'Failed to refresh OCR. Please try again.'
      }));
    }
  };

  const handleClearOcrResults = () => {
    setOcrState({
      ocrText: '',
      showOcrText: false,
      isProcessingComplete: false,
    });
    localStorage.removeItem(OCR_STORAGE_KEY);
    setState(prev => ({ ...prev, success: '' }));
  };
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload Receipt</h1>
        <p className="mt-2 text-gray-600">Take a photo or upload an image of your receipt to automatically extract transaction details</p>
      </div>

      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="p-8">
          {/* File Upload Area */}
          <div className="mb-8">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {state.file ? (
                  <>
                    <FileText className="w-10 h-10 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Selected:</span> {state.file.name}
                    </p>
                    <p className="text-xs text-gray-500">Click to choose a different file</p>
                  </>
                ) : (
                  <>
                    <Camera className="w-10 h-10 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, JPEG up to 10MB</p>
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={state.uploading || state.processing}
              />
            </label>
          </div>

          {/* Error Message */}
          {state.error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              {state.error}
            </div>
          )}

          {/* Success Message */}
          {state.success && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              <div className="flex-1">
                {state.success}
                {countdown !== null && (
                  <div className="mt-2 text-sm">
                    Redirecting to transactions in <span className="font-semibold text-green-800">{countdown}</span> second{countdown !== 1 ? 's' : ''}...
                    <div className="mt-1 w-full bg-green-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OCR Text Display */}
          {ocrState.ocrText && ocrState.showOcrText && (
            <div className="mb-6 bg-gray-50 border border-gray-200 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">
                  Extracted Text {ocrState.isProcessingComplete ? '(Processing Complete)' : ''}
                </h4>
                <div className="flex space-x-2">
                  <button
                    onClick={handleCopyOcrText}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    aria-label="Copy OCR text"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </button>
                  <button
                    onClick={handleRefreshOcr}
                    disabled={state.processing}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Refresh OCR"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${state.processing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>
              {ocrState.ocrText ? (
                <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border overflow-auto max-h-80 font-mono">
                  {ocrState.ocrText}
                </pre>
              ) : (
                <p className="text-sm text-gray-500 bg-white p-3 rounded border">
                  No text detected in this image.
                </p>
              )}
            </div>
          )}

          {/* Upload Button */}
          <div className="flex flex-col space-y-4">
            <button
              onClick={handleUpload}
              disabled={!state.file || state.uploading || state.processing || loading || !user}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {state.uploading && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              )}
              {state.processing && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              )}
              <Upload className="h-5 w-5 mr-2" />
              {state.uploading ? 'Uploading...' : state.processing ? 'Processing OCR...' : 'Upload & Process Receipt'}
            </button>

            {/* Clear OCR Text Button - show when OCR text is visible */}
            {ocrState.ocrText && ocrState.showOcrText && (
              <button
                onClick={handleClearOcrResults}
                disabled={countdown !== null}
                className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <X className="h-5 w-5 mr-2" />
                Clear Results & Upload New Receipt
              </button>
            )}
          </div>

          {/* Processing Status */}
          {(state.uploading || state.processing) && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {state.uploading && 'Uploading your receipt...'}
                {state.processing && 'Processing with OCR and extracting transaction details...'}
              </p>
              <p className="text-xs text-gray-500 mt-1">This may take 5-10 seconds</p>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Tips for best results:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Ensure the receipt is well-lit and in focus</li>
              <li>• Include the full receipt with date, merchant, and total amount</li>
              <li>• Avoid shadows or glare on the receipt</li>
              <li>• Supported formats: JPG, PNG, JPEG</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}