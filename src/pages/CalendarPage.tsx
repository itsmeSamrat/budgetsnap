import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TransactionDrawer } from '../components/TransactionDrawer';
import { DayOverview } from '../components/DayOverview';
import { getMonthGrid, getMonthName, getTodayString, formatMoney, getStartOfMonth, getEndOfMonth } from '../utils/dateUtils';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  category: string;
  notes?: string | null;
}

export function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dayOverviewOpen, setDayOverviewOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showTotals, setShowTotals] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; transactionId: string | null }>({
    show: false,
    transactionId: null
  });

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user, currentDate]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const startDate = getStartOfMonth(year, month);
      const endDate = getEndOfMonth(year, month);

      const prevMonthStart = getStartOfMonth(year, month - 1);
      const nextMonthEnd = getEndOfMonth(year, month + 1);

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', prevMonthStart)
        .lte('date', nextMonthEnd)
        .order('date', { ascending: true });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionsForDate = (dateStr: string) => {
    return transactions.filter(t => t.date === dateStr);
  };

  const getDayTotal = (dateStr: string) => {
    const dayTransactions = getTransactionsForDate(dateStr);
    return dayTransactions.reduce((sum, t) => {
      return t.type === 'credit' ? sum + t.amount : sum - t.amount;
    }, 0);
  };

  const getMonthTotals = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = getStartOfMonth(year, month);
    const endDate = getEndOfMonth(year, month);

    const monthTransactions = transactions.filter(t => t.date >= startDate && t.date <= endDate);

    const income = monthTransactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = monthTransactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    const net = income - expenses;

    return { income, expenses, net };
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setDayOverviewOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setEditingTransaction(null);
  };

  const handleDayOverviewClose = () => {
    setDayOverviewOpen(false);
  };

  const handleAddFromDayOverview = () => {
    setDayOverviewOpen(false);
    setDrawerOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setDayOverviewOpen(false);
    setDrawerOpen(true);
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

      await fetchTransactions();
      setDeleteConfirm({ show: false, transactionId: null });
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, transactionId: null });
  };

  const handleTransactionSaved = () => {
    fetchTransactions();
  };

  const monthGrid = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
  const monthYear = getMonthName(currentDate);
  const todayStr = getTodayString();
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const totals = getMonthTotals();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Budget Calendar</h1>

        <div className="flex items-center gap-3">
          <button
            onClick={goToToday}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-base font-semibold text-gray-900 min-w-[180px] text-center px-2">
              {monthYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200">
            {weekDays.map(day => (
              <div
                key={day}
                className="px-2 py-3 text-xs font-bold text-gray-600 text-center border-r border-gray-200 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr">
            {monthGrid.map(({ date, dateStr, isCurrentMonth }, index) => {
              const dayTransactions = getTransactionsForDate(dateStr);
              const isToday = dateStr === todayStr;
              const dayTotal = getDayTotal(dateStr);

              return (
                <div
                  key={index}
                  className={`min-h-[140px] border-r border-b border-gray-200 last:border-r-0 ${
                    index >= monthGrid.length - 7 ? 'border-b-0' : ''
                  } ${
                    !isCurrentMonth ? 'bg-gray-50' : 'bg-white hover:bg-blue-50'
                  } transition-colors cursor-pointer relative group`}
                  onClick={() => handleDayClick(dateStr)}
                >
                  <div className="p-2 h-full flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={`text-xs font-semibold ${
                          isToday
                            ? 'bg-blue-600 text-white px-2 py-1 rounded-full'
                            : isCurrentMonth
                            ? 'text-gray-700'
                            : 'text-gray-400'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDayClick(dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-100 rounded"
                      >
                        <Plus className="h-3 w-3 text-blue-600" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 max-h-[90px] scrollbar-thin">
                      {dayTransactions.map(transaction => (
                        <div
                          key={transaction.id}
                          className="text-xs leading-tight break-words"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col">
                            <span className="text-gray-700 font-medium truncate" title={transaction.description}>
                              {transaction.category}
                              {transaction.description !== transaction.category && (
                                <span className="text-gray-500"> | {transaction.description}</span>
                              )}
                            </span>
                            <span
                              className={`font-semibold ${
                                transaction.type === 'debit'
                                  ? 'text-red-600'
                                  : 'text-green-600'
                              }`}
                            >
                              {formatMoney(transaction.amount, transaction.type === 'credit' ? 'income' : 'expense')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {dayTransactions.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-gray-200">
                        <span
                          className={`text-xs font-bold ${
                            dayTotal > 0 ? 'text-green-600' : dayTotal < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}
                        >
                          {dayTotal > 0 ? '+' : ''}{dayTotal < 0 ? '-' : ''}${Math.abs(dayTotal).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`hidden lg:block w-80 ${showTotals ? '' : 'lg:hidden'}`}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Month Summary</h2>

            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="text-sm font-medium text-green-800 mb-1">Income</div>
                <div className="text-2xl font-bold text-green-600">
                  +${totals.income.toFixed(2)}
                </div>
              </div>

              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                <div className="text-sm font-medium text-red-800 mb-1">Expenses</div>
                <div className="text-2xl font-bold text-red-600">
                  -${totals.expenses.toFixed(2)}
                </div>
              </div>

              <div className={`p-4 rounded-xl border-2 ${
                totals.net > 0
                  ? 'bg-green-50 border-green-400'
                  : totals.net < 0
                  ? 'bg-red-50 border-red-400'
                  : 'bg-gray-50 border-gray-400'
              }`}>
                <div className={`text-sm font-medium mb-1 ${
                  totals.net > 0 ? 'text-green-800' : totals.net < 0 ? 'text-red-800' : 'text-gray-800'
                }`}>
                  Net
                </div>
                <div className={`text-2xl font-bold ${
                  totals.net > 0 ? 'text-green-600' : totals.net < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {totals.net > 0 ? '+' : ''}{totals.net < 0 ? '-' : ''}${Math.abs(totals.net).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Transactions:</span>
                  <span className="font-medium text-gray-700">
                    {transactions.filter(t => {
                      const year = currentDate.getFullYear();
                      const month = currentDate.getMonth();
                      const start = getStartOfMonth(year, month);
                      const end = getEndOfMonth(year, month);
                      return t.date >= start && t.date <= end;
                    }).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden mt-4 bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <button
          onClick={() => setShowTotals(!showTotals)}
          className="w-full text-left font-semibold text-gray-900 mb-3"
        >
          Month Summary {showTotals ? '▲' : '▼'}
        </button>

        {showTotals && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
              <div className="text-xs font-medium text-green-800 mb-1">Income</div>
              <div className="text-lg font-bold text-green-600">
                +${totals.income.toFixed(2)}
              </div>
            </div>

            <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
              <div className="text-xs font-medium text-red-800 mb-1">Expenses</div>
              <div className="text-lg font-bold text-red-600">
                -${totals.expenses.toFixed(2)}
              </div>
            </div>

            <div className={`p-3 rounded-lg border-2 text-center ${
              totals.net > 0
                ? 'bg-green-50 border-green-400'
                : totals.net < 0
                ? 'bg-red-50 border-red-400'
                : 'bg-gray-50 border-gray-400'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                totals.net > 0 ? 'text-green-800' : totals.net < 0 ? 'text-red-800' : 'text-gray-800'
              }`}>
                Net
              </div>
              <div className={`text-lg font-bold ${
                totals.net > 0 ? 'text-green-600' : totals.net < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {totals.net > 0 ? '+' : ''}{totals.net < 0 ? '-' : ''}${Math.abs(totals.net).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      <DayOverview
        isOpen={dayOverviewOpen}
        onClose={handleDayOverviewClose}
        date={selectedDate}
        transactions={getTransactionsForDate(selectedDate)}
        onAddTransaction={handleAddFromDayOverview}
        onEditTransaction={handleEditTransaction}
        onDeleteTransaction={handleDeleteClick}
      />

      <TransactionDrawer
        isOpen={drawerOpen}
        onClose={handleDrawerClose}
        onSave={handleTransactionSaved}
        initialDate={selectedDate}
        transaction={editingTransaction}
      />

      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
    </div>
  );
}
