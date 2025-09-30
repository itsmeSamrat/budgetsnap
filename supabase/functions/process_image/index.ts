// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2';
import { categorizeTransaction } from '../_shared/categorizer.ts';
import { parseReceiptText } from '../_shared/receipt-parser.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProcessImageRequest {
  imagePath: string;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // Check required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ocrProvider = Deno.env.get('OCR_PROVIDER') || 'google';
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check OCR provider configuration
    if (ocrProvider === 'google' && !Deno.env.get('GOOGLE_VISION_API_KEY')) {
      console.error('Missing GOOGLE_VISION_API_KEY for Google Vision OCR');
      return new Response(
        JSON.stringify({ error: 'OCR service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (ocrProvider === 'ocrspace' && !Deno.env.get('OCRSPACE_API_KEY')) {
      console.error('Missing OCRSPACE_API_KEY for OCR.Space');
      return new Response(
        JSON.stringify({ error: 'OCR service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no valid OCR provider is configured, return error
    if (ocrProvider !== 'google' && ocrProvider !== 'ocrspace') {
      console.error('Invalid OCR provider:', ocrProvider);
      return new Response(
        JSON.stringify({ error: 'Invalid OCR provider configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      console.error('Missing Authorization header');
      return new Response('Missing Authorization header', { status: 401, headers: corsHeaders });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // Verify JWT token
    const jwt = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response('Invalid authorization token', { status: 401, headers: corsHeaders });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return new Response('Invalid request body', { status: 400, headers: corsHeaders });
    }

    const { imagePath }: ProcessImageRequest = requestBody;
    
    if (!imagePath) {
      console.error('Missing imagePath in request');
      return new Response('Missing imagePath', { status: 400, headers: corsHeaders });
    }

    // Verify the image path belongs to the authenticated user
    if (!imagePath.startsWith(`${user.id}/`)) {
      console.error('Unauthorized image access attempt:', imagePath, 'by user:', user.id);
      return new Response('Unauthorized access to image', { status: 403, headers: corsHeaders });
    }

    // Perform OCR
    let ocrText;
    try {
      ocrText = await performOCR(supabaseClient, imagePath);
    } catch (error) {
      console.error('OCR processing failed:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to process image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!ocrText) {
      console.error('No text extracted from image');
      return new Response('Failed to extract text from image', { status: 500, headers: corsHeaders });
    }

    // Parse the OCR text
    let structuredData;
    try {
      console.log('Raw OCR text to parse:', JSON.stringify(ocrText));
      
      // Call Gemini structure extraction
      const structureResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/structure_with_gemini`, {
        method: 'POST',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ocrText })
      });

      if (!structureResponse.ok) {
        console.error('Gemini structure extraction failed, falling back to legacy parser');
        // Fallback to legacy parsing
        const legacyParsed = parseReceiptText(ocrText);
        const legacyCategory = categorizeTransaction(legacyParsed.description, legacyParsed.type);
        structuredData = {
          date: legacyParsed.date,
          type: legacyParsed.type,
          category: legacyCategory,
          description: legacyParsed.description,
          amount: legacyParsed.amount,
          notes: null
        };
      } else {
        const structureResult = await structureResponse.json();
        if (structureResult.ok && structureResult.record) {
          const record = structureResult.record;
          structuredData = {
            date: record.date || new Date().toISOString().split('T')[0],
            type: record.type === 'in' ? 'credit' : 'debit',
            category: record.category,
            description: record.sub_category || 'Transaction',
            amount: record.amount,
            notes: record.note
          };
        } else {
          throw new Error('Gemini structure extraction returned invalid result');
        }
      }
      
      console.log('Structured transaction data:', JSON.stringify(structuredData));
    } catch (error) {
      console.error('Failed to structure receipt data:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to structure receipt data', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert transaction into database
    const { data: transaction, error: dbError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        date: structuredData.date,
        description: structuredData.description,
        amount: structuredData.amount,
        type: structuredData.type,
        category: structuredData.category,
        notes: structuredData.notes,
        image_path: imagePath,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to save transaction', details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ transaction, debug: { ocrText, structuredData } }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Unexpected error in process_image function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function performOCR(supabaseClient: any, imagePath: string): Promise<string> {
  const ocrProvider = Deno.env.get('OCR_PROVIDER') || 'google';

  console.log('Using OCR provider:', ocrProvider);

  if (ocrProvider === 'google') {
    return await performGoogleVisionOCR(supabaseClient, imagePath);
  } else {
    return await performOCRSpaceOCR(supabaseClient, imagePath);
  }
}

async function performGoogleVisionOCR(supabaseClient: any, imagePath: string): Promise<string> {
  const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!apiKey) {
    throw new Error('Google Vision API key not configured');
  }

  console.log('Downloading image from Supabase Storage...');

  // Download the image file directly from Supabase Storage
  const { data: fileData, error: downloadError } = await supabaseClient
    .storage
    .from('receipts')
    .download(imagePath);

  if (downloadError || !fileData) {
    console.error('Failed to download image:', downloadError);
    throw new Error('Failed to download image from storage');
  }

  // Convert file to base64
  const arrayBuffer = await fileData.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Convert to base64 using btoa with proper encoding
  const base64 = btoa(String.fromCharCode(...uint8Array));
  
  // Basic sanity check
  if (!base64 || !/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    throw new Error('Invalid base64 content generated from image');
  }

  console.log(`Image converted to base64, length: ${base64.length}`);

  // Build Vision API request
  const visionRequest = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  };

  console.log('Calling Google Vision API...');

  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(visionRequest),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      // Try to parse error details
      try {
        const errorJson = JSON.parse(responseText);
        const errorMessage = errorJson?.error?.message ?? 
                           errorJson?.responses?.[0]?.error?.message ?? 
                           JSON.stringify(errorJson);
        console.error('Google Vision API error details:', errorMessage);
        throw new Error(`Vision API ${response.status}: ${errorMessage}`);
      } catch (parseError) {
        console.error('Google Vision API error (raw):', responseText);
        throw new Error(`Vision API ${response.status}: ${responseText}`);
      }
    }

    const result = JSON.parse(responseText);
    console.log('Google Vision API response received successfully');

    // Check for API-level errors in the response
    if (result.responses?.[0]?.error) {
      console.error('Google Vision API returned error:', result.responses[0].error);
      throw new Error(`Google Vision API error: ${result.responses[0].error.message}`);
    }
    
    // Try DOCUMENT_TEXT_DETECTION first (more accurate for receipts)
    const fullTextAnnotation = result.responses?.[0]?.fullTextAnnotation?.text;
    if (fullTextAnnotation) {
      console.log('Successfully extracted text from image using DOCUMENT_TEXT_DETECTION');
      return fullTextAnnotation;
    }
    
    // Fallback to TEXT_DETECTION
    const textAnnotation = result.responses?.[0]?.textAnnotations?.[0]?.description;
    if (textAnnotation) {
      console.log('Successfully extracted text from image using TEXT_DETECTION fallback');
      return textAnnotation;
    }

    console.log('No text detected in image by Google Vision');
    throw new Error('No text detected in image');

  } catch (error) {
    console.error('Google Vision API request failed:', error);
    throw error;
  }
}

async function performOCRSpaceOCR(supabaseClient: any, imagePath: string): Promise<string> {
  const apiKey = Deno.env.get('OCRSPACE_API_KEY');
  if (!apiKey) {
    throw new Error('OCR.Space API key not configured');
  }

  console.log('Getting signed URL for OCR.Space...');

  // Get signed URL for the image (OCR.Space needs a public URL)
  const { data: signedUrlData, error: urlError } = await supabaseClient
    .storage
    .from('receipts')
    .createSignedUrl(imagePath, 300); // 5 minutes

  if (urlError || !signedUrlData) {
    console.error('Failed to get signed URL:', urlError);
    throw new Error('Failed to get image URL for OCR processing');
  }

  console.log('Using OCR.Space for text extraction...');

  const formData = new FormData();
  formData.append('url', signedUrlData.signedUrl);
  formData.append('apikey', apiKey);
  formData.append('language', 'eng');

  let response;
  try {
    response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OCR.Space API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('OCR.Space API request failed:', error);
    throw new Error('Failed to call OCR.Space API');
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error('Failed to parse OCR.Space API response:', error);
    throw new Error('Invalid response from OCR.Space API');
  }

  if (result.IsErroredOnProcessing) {
    console.error('OCR.Space processing error:', result.ErrorMessage);
    throw new Error(`OCR.Space error: ${result.ErrorMessage}`);
  }

  if (result.ParsedResults?.[0]?.ParsedText) {
    console.log('Successfully extracted text from image');
    return result.ParsedResults[0].ParsedText;
  }

  console.log('No text detected in image by OCR.Space');
  throw new Error('No text detected in image');
}