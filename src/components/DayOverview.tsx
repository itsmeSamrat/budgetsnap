import React from 'react';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDisplayDate, formatMoney } from '../utils/dateUtils';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  category: string;
  notes?: string | null;
}

interface DayOverviewProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  transactions: Transaction[];
  onAddTransaction: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
}

export function DayOverview({
  isOpen,
  onClose,
  date,
  transactions,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction
}: DayOverviewProps) {
  if (!isOpen) return null;

  const income = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const net = income - expenses;

  const displayDate = formatDisplayDate(date);
  const [dayOfWeek, ...rest] = displayDate.split(',');
  const fullDate = `${dayOfWeek},${rest.join(',')}`;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-xl z-50 transform transition-transform sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{fullDate}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="px-6 py-4 border-b border-gray-200">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                <div className="text-xs font-medium text-green-800 mb-1">Income</div>
                <div className="text-lg font-bold text-green-600">
                  +${income.toFixed(2)}
                </div>
              </div>

              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                <div className="text-xs font-medium text-red-800 mb-1">Expenses</div>
                <div className="text-lg font-bold text-red-600">
                  -${expenses.toFixed(2)}
                </div>
              </div>

              <div className={`p-3 rounded-lg border-2 text-center ${
                net > 0
                  ? 'bg-green-50 border-green-400'
                  : net < 0
                  ? 'bg-red-50 border-red-400'
                  : 'bg-gray-50 border-gray-400'
              }`}>
                <div className={`text-xs font-medium mb-1 ${
                  net > 0 ? 'text-green-800' : net < 0 ? 'text-red-800' : 'text-gray-800'
                }`}>
                  Net
                </div>
                <div className={`text-lg font-bold ${
                  net > 0 ? 'text-green-600' : net < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {net > 0 ? '+' : ''}{net < 0 ? '-' : ''}${Math.abs(net).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Transactions ({transactions.length})
            </h3>

            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No transactions for this day</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map(transaction => (
                  <div
                    key={transaction.id}
                    className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {transaction.category}
                          </span>
                          {transaction.description !== transaction.category && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span className="text-sm text-gray-600">
                                {transaction.description}
                              </span>
                            </>
                          )}
                        </div>
                        <div className={`text-base font-bold ${
                          transaction.type === 'debit' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatMoney(transaction.amount, transaction.type === 'credit' ? 'income' : 'expense')}
                        </div>
                        {transaction.notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            {transaction.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-3">
                        <button
                          onClick={() => onEditTransaction(transaction)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(transaction.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={onAddTransaction}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Transaction
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
