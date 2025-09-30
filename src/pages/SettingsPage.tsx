import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, User, DollarSign, Trash2, AlertTriangle } from 'lucide-react';

interface Profile {
  display_name: string | null;
  currency: string;
}

export function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>({
    display_name: '',
    currency: 'USD'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile exists yet - use defaults
          setProfile({
            display_name: user?.email?.split('@')[0] || '',
            currency: 'USD'
          });
          return;
        }
        throw error;
      }

      if (data) {
        setProfile({
          display_name: data.display_name || '',
          currency: data.currency || 'USD'
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Set defaults even on error to prevent UI issues
      setProfile({
        display_name: user?.email?.split('@')[0] || '',
        currency: 'USD'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user!.id,
          display_name: profile.display_name || null,
          currency: profile.currency,
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete ALL your transaction data? This action cannot be undone.'
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      'This will permanently delete all your transactions and receipts. Type "DELETE" in the next prompt to confirm.'
    );

    if (!doubleConfirm) return;

    const finalConfirm = window.prompt(
      'Type "DELETE" to permanently delete all your data:'
    );

    if (finalConfirm !== 'DELETE') {
      alert('Deletion cancelled.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Check if we're using mock client
      if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'your-supabase-url-here') {
        throw new Error('Please configure Supabase environment variables to delete data.');
      }

      // Get current session to ensure we're authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Delete all transactions
      const { error: transactionError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user!.id);

      if (transactionError) throw transactionError;

      // Delete all receipts from storage
      try {
        const { data: files, error: listError } = await supabase
          .storage
          .from('receipts')
          .list(user!.id);

        if (listError) {
          console.warn('Could not list storage files:', listError);
        } else if (files && files.length > 0) {
          const filePaths = files.map(file => `${user!.id}/${file.name}`);
          const { error: deleteFilesError } = await supabase
            .storage
            .from('receipts')
            .remove(filePaths);

          if (deleteFilesError) {
            console.warn('Could not delete some storage files:', deleteFilesError);
          }
        }
      } catch (storageError) {
        console.warn('Storage cleanup failed:', storageError);
        // Don't fail the entire operation if storage cleanup fails
      }

      setMessage({ type: 'success', text: 'All data deleted successfully.' });
    } catch (error: any) {
      console.error('Delete all data error:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Settings */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          </div>
          
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="flex items-center">
                <User className="h-5 w-5 text-gray-400 mr-2" />
                <input
                  type="email"
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={profile.display_name || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Your display name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                Default Currency
              </label>
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
                <select
                  id="currency"
                  value={profile.currency}
                  onChange={(e) => setProfile(prev => ({ ...prev, currency: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="USD">USD ($)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="NPR">NPR (₨)</option>
                </select>
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message.text}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          </div>
          
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 mb-2">Delete All Data</h3>
                  <p className="text-sm text-red-700 mb-4">
                    This will permanently delete all your transactions, receipts, and associated data. 
                    This action cannot be undone.
                  </p>
                  <button
                    onClick={handleDeleteAllData}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}