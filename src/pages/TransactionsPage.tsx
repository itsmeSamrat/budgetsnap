import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Filter, Download, Pencil, Trash2, Save, X, Calendar, Tag, DollarSign, Image as ImageIcon, ArrowUpRight, ArrowDownRight, Plus } from 'lucide-react';
import { formatDisplayDate, getTodayString } from '../utils/dateUtils';
import { TransactionDrawer } from '../components/TransactionDrawer';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  category: string;
  image_path: string | null;
  created_at: string;
  notes: string | null;
}

interface Filters {
  startDate: string;
  endDate: string;
  category: string;
  type: string;
}

const CATEGORIES = [
  'All', 'Dining', 'Groceries', 'Transport', 'Utilities', 
  'Rent', 'Income', 'Shopping', 'Healthcare', 'Entertainment', 'Uncategorized'
];

export function TransactionsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [filters, setFilters] = useState<Filters>({
    startDate: '',
    endDate: '',
    category: 'All',
    type: 'All'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; show: boolean }>({ url: '', show: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; transactionId: string | null }>({
    show: false,
    transactionId: null
  });
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);

  const highlightId = searchParams.get('highlight');

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user, filters]);

  useEffect(() => {
    // Auto-scroll to highlighted transaction
    if (highlightId) {
      setTimeout(() => {
        const element = document.getElementById(`transaction-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-blue-300');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-300');
          }, 3000);
        }
      }, 500);
    }
  }, [highlightId, transactions]);

  const loadTransactions = async () => {
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user!.id)
        .order('date', { ascending: false });

      if (filters.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters.category !== 'All') {
        query = query.eq('category', filters.category);
      }
      if (filters.type !== 'All') {
        query = query.eq('type', filters.type);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditForm({
      description: transaction.description,
      date: transaction.date,
      category: transaction.category,
      amount: transaction.amount,
      type: transaction.type,
      notes: transaction.notes,
    });
  };

  const handleSave = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          ...editForm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, ...editForm } : t)
      );
      setEditingId(null);
      setEditForm({});
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDeleteClick = (transactionId: string) => {
    setDeleteConfirm({ show: true, transactionId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.transactionId) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', deleteConfirm.transactionId);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => t.id !== deleteConfirm.transactionId));
      setDeleteConfirm({ show: false, transactionId: null });
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, transactionId: null });
  };

  const handleAddTransaction = () => {
    setAddDrawerOpen(true);
  };

  const handleAddDrawerClose = () => {
    setAddDrawerOpen(false);
  };

  const handleTransactionSaved = () => {
    loadTransactions();
  };

  const handleImagePreview = async (imagePath: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signed_image_url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imagePath })
      });

      const result = await response.json();
      if (result.signedUrl) {
        setImagePreview({ url: result.signedUrl, show: true });
      }
    } catch (error) {
      console.error('Error getting image preview:', error);
    }
  };

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Sub-Category', 'Amount', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...transactions.map(t => [
        t.date,
        t.type,
        t.category,
        `"${t.description}"`,
        t.amount,
        `"${t.notes || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
            <p className="mt-2 text-gray-600">Manage and view your transaction history</p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <button
              onClick={handleAddTransaction}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="All">All</option>
                <option value="debit">Out</option>
                <option value="credit">In</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions</h3>
            <p className="mt-1 text-sm text-gray-500">
              {Object.values(filters).some(f => f && f !== 'All') 
                ? 'Try adjusting your filters.'
                : 'Upload your first receipt to get started.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub-Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr 
                    key={transaction.id} 
                    id={`transaction-${transaction.id}`}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Date */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === transaction.id ? (
                        <input
                          type="date"
                          value={editForm.date || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {formatDisplayDate(transaction.date)}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === transaction.id ? (
                        <select
                          value={editForm.type || transaction.type}
                          onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as 'debit' | 'credit' }))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="credit">In</option>
                          <option value="debit">Out</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.type === 'credit' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.type === 'credit' ? 'In' : 'Out'}
                        </span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === transaction.id ? (
                        <select
                          value={editForm.category || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {CATEGORIES.filter(cat => cat !== 'All').map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center">
                          <Tag className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{transaction.category}</span>
                        </div>
                      )}
                    </td>

                    {/* Sub-Category (formerly Description) */}
                    <td className="px-6 py-4">
                      {editingId === transaction.id ? (
                        <input
                          type="text"
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{transaction.description}</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === transaction.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.amount || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      ) : (
                        <div className="flex items-center">
                          {transaction.type === 'credit' ? (
                            <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
                          )}
                          <span className={`text-sm font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type === 'credit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Receipt */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {transaction.image_path ? (
                        <button
                          onClick={() => handleImagePreview(transaction.image_path!)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="View receipt"
                        >
                          <ImageIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingId === transaction.id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSave(transaction.id)}
                            className="text-green-600 hover:text-green-800 transition-colors"
                            title="Save changes"
                            aria-label="Save changes"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="text-gray-600 hover:text-gray-800 transition-colors"
                            title="Cancel editing"
                            aria-label="Cancel editing"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Edit transaction"
                            aria-label="Edit transaction"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(transaction.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Delete transaction"
                            aria-label="Delete transaction"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-6 py-4">
                      {editingId === transaction.id ? (
                        <textarea
                          value={editForm.notes || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Add notes..."
                          rows={2}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">
                          {transaction.notes || '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4">Delete transaction</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  This action cannot be undone.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={handleDeleteCancel}
                    className="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {imagePreview.show && (
        <div className="fixed inset-0 bg-black bg-opacity-90 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative max-w-full max-h-full p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">Receipt Preview</h3>
              <button
                onClick={() => setImagePreview({ url: '', show: false })}
                className="text-white hover:text-gray-300 ml-4"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="text-center">
              <img
                src={imagePreview.url}
                alt="Receipt"
                className="max-w-full max-h-[90vh] mx-auto rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      <TransactionDrawer
        isOpen={addDrawerOpen}
        onClose={handleAddDrawerClose}
        onSave={handleTransactionSaved}
        initialDate={getTodayString()}
        transaction={null}
      />
    </div>
  );
}