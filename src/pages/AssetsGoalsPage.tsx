import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Target, TrendingUp, Plus, Pencil, Trash2, Save, X, PieChart, StickyNote } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Goal {
  id: string;
  year: number;
  month: number;
  target_amount: number;
  actual_amount: number | null;
  notes: string | null;
  yearly_target?: number | null;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  amount: number;
  description: string | null;
}

interface GoalNote {
  id: string;
  year: number;
  content: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ASSET_TYPES = [
  { value: 'stocks', label: 'Stocks (TFSA)', color: '#ef4444' },
  { value: 'crypto', label: 'Crypto', color: '#6366f1' },
  { value: 'savings', label: 'Savings', color: '#10b981' },
  { value: 'investment', label: 'Investment', color: '#f59e0b' },
  { value: 'real_estate', label: 'Real Estate', color: '#8b5cf6' },
  { value: 'other', label: 'Other', color: '#6b7280' }
];

export function AssetsGoalsPage() {
  const { user } = useAuth();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [goalNotes, setGoalNotes] = useState<GoalNote | null>(null);
  const [assetNotes, setAssetNotes] = useState<GoalNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [editingGoalNotes, setEditingGoalNotes] = useState(false);
  const [editingAssetNotes, setEditingAssetNotes] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [yearlyTarget, setYearlyTarget] = useState<number>(12000);
  const [editingYearlyTarget, setEditingYearlyTarget] = useState(false);
  const [yearlyTargetInput, setYearlyTargetInput] = useState<string>('12000');
  const [yearlyTargetError, setYearlyTargetError] = useState('');
  const [newAsset, setNewAsset] = useState({ name: '', type: 'other', amount: 0, description: '' });
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, currentYear]);

  const loadData = async () => {
    try {
      const { data: goalsData } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user!.id)
        .eq('year', currentYear)
        .order('month');

      const { data: assetsData } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      const { data: goalNotesData } = await supabase
        .from('goal_notes')
        .select('*')
        .eq('user_id', user!.id)
        .eq('year', currentYear);

      const { data: assetNotesData } = await supabase
        .from('goal_notes')
        .select('*')
        .eq('user_id', user!.id)
        .eq('year', -currentYear);

      setGoals(goalsData || []);
      setAssets(assetsData || []);
      setGoalNotes(goalNotesData && goalNotesData.length > 0 ? goalNotesData[0] : null);
      setAssetNotes(assetNotesData && assetNotesData.length > 0 ? assetNotesData[0] : null);

      if (goalsData && goalsData.length > 0 && goalsData[0].yearly_target) {
        setYearlyTarget(goalsData[0].yearly_target);
        setYearlyTargetInput(goalsData[0].yearly_target.toString());
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeGoalsForYear = async () => {
    const monthlyGoals = [];
    for (let month = 1; month <= 12; month++) {
      monthlyGoals.push({
        user_id: user!.id,
        year: currentYear,
        month,
        target_amount: 0,
        actual_amount: 0,
        yearly_target: yearlyTarget || null
      });
    }

    try {
      const { error } = await supabase
        .from('goals')
        .upsert(monthlyGoals, { onConflict: 'user_id,year,month' });

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error initializing goals:', error);
    }
  };

  const handleYearlyTargetChange = (value: string) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setYearlyTargetInput(value);
      setYearlyTargetError('');
    }
  };

  const handleYearlyTargetSave = async () => {
    if (yearlyTargetInput === '') {
      setYearlyTargetError('Yearly target is required');
      return;
    }

    const parsedValue = parseFloat(yearlyTargetInput);
    if (isNaN(parsedValue) || parsedValue < 0) {
      setYearlyTargetError('Please enter a valid positive number');
      return;
    }

    try {
      const { error } = await supabase
        .from('goals')
        .update({ yearly_target: parsedValue, updated_at: new Date().toISOString() })
        .eq('user_id', user!.id)
        .eq('year', currentYear);

      if (error) throw error;
      setYearlyTarget(parsedValue);
      setEditingYearlyTarget(false);
      setYearlyTargetError('');
      loadData();
    } catch (error) {
      console.error('Error updating yearly target:', error);
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<Goal>) => {
    try {
      const { error } = await supabase
        .from('goals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', goalId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  const addAsset = async (closeForm = true) => {
    try {
      const { error } = await supabase
        .from('assets')
        .insert({
          user_id: user!.id,
          name: newAsset.name,
          type: newAsset.type,
          amount: newAsset.amount,
          description: newAsset.description || null
        });

      if (error) throw error;

      if (closeForm) {
        setNewAsset({ name: '', type: 'other', amount: 0, description: '' });
        setShowAddAsset(false);
      } else {
        setNewAsset({ name: '', type: 'other', amount: 0, description: '' });
      }

      loadData();
    } catch (error) {
      console.error('Error adding asset:', error);
    }
  };

  const updateAsset = async (assetId: string, updates: Partial<Asset>) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', assetId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating asset:', error);
    }
  };

  const deleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  const saveGoalNotes = async (content: string) => {
    try {
      const { error } = await supabase
        .from('goal_notes')
        .upsert({
          user_id: user!.id,
          year: currentYear,
          content,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,year' });

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error saving goal notes:', error);
    }
  };

  const saveAssetNotes = async (content: string) => {
    try {
      const { error } = await supabase
        .from('goal_notes')
        .upsert({
          user_id: user!.id,
          year: -currentYear,
          content,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,year' });

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error saving asset notes:', error);
    }
  };

  const getCumulativeTarget = (month: number) => {
    if (!yearlyTarget) return 0;
    return (yearlyTarget / 12) * month;
  };

  const getCumulativeActual = (month: number) => {
    return goals
      .filter(goal => goal.month <= month)
      .reduce((sum, goal) => sum + (goal.actual_amount || 0), 0);
  };

  const getProgressPercentage = (cumulativeActual: number, cumulativeTarget: number) => {
    if (cumulativeTarget === 0) return 0;
    return (cumulativeActual / cumulativeTarget) * 100;
  };

  const getProgressColor = (percentage: number, isNegative: boolean) => {
    if (isNegative) return 'bg-red-500';
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProgressWidth = (percentage: number) => {
    if (percentage < 0) return Math.min(Math.abs(percentage), 100);
    return Math.min(percentage, 100);
  };

  const assetChartData = {
    labels: assets.map(asset => {
      const type = ASSET_TYPES.find(t => t.value === asset.type);
      return type?.label || asset.type;
    }),
    datasets: [
      {
        data: assets.map(asset => asset.amount),
        backgroundColor: assets.map(asset => {
          const type = ASSET_TYPES.find(t => t.value === asset.type);
          return type?.color || '#6b7280';
        }),
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: $${value.toFixed(2)} (${percentage}%)`;
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 h-96 bg-gray-200 rounded-2xl"></div>
            <div className="lg:col-span-5 h-96 bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Assets & Goals</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Track your financial goals and manage your assets</p>
      </div>

      <div className="mb-6 flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Year:</label>
        <select
          value={currentYear}
          onChange={(e) => setCurrentYear(parseInt(e.target.value))}
          className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        <div className="lg:col-span-7 bg-white dark:bg-gray-800 shadow-sm rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center">
              <Target className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Goals</h2>
            </div>
            {goals.length === 0 && (
              <button
                onClick={initializeGoalsForYear}
                className="inline-flex items-center rounded-xl px-3.5 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Initialize {currentYear}
              </button>
            )}
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Yearly Target</h3>
                {!editingYearlyTarget && (
                  <button
                    onClick={() => {
                      setEditingYearlyTarget(true);
                      setYearlyTargetInput(yearlyTarget.toString());
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              {editingYearlyTarget ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={yearlyTargetInput}
                      onChange={(e) => handleYearlyTargetChange(e.target.value)}
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter yearly target"
                    />
                    <button
                      onClick={handleYearlyTargetSave}
                      className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingYearlyTarget(false);
                        setYearlyTargetError('');
                      }}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {yearlyTargetError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{yearlyTargetError}</p>
                  )}
                </div>
              ) : (
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  ${yearlyTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>

            {goals.length === 0 ? (
              <div className="text-center py-8">
                <Target className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No goals set</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Initialize goals for {currentYear} to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {goals.map((goal) => {
                  const cumulativeTarget = getCumulativeTarget(goal.month);
                  const cumulativeActual = getCumulativeActual(goal.month);
                  const progressPercentage = getProgressPercentage(cumulativeActual, cumulativeTarget);
                  const isNegative = cumulativeActual < 0;
                  const progressWidth = getProgressWidth(progressPercentage);

                  return (
                    <div key={goal.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors border border-gray-200 dark:border-gray-700">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white w-20">
                            {MONTHS[goal.month - 1].slice(0, 3)}
                          </span>
                          <div className="flex items-center space-x-1">
                            {editingGoal === goal.id ? (
                              <>
                                <button
                                  onClick={() => {
                                    updateGoal(goal.id, editForm);
                                    setEditingGoal(null);
                                    setEditForm({});
                                  }}
                                  className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingGoal(null);
                                    setEditForm({});
                                  }}
                                  className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingGoal(goal.id);
                                  setEditForm({
                                    actual_amount: goal.actual_amount || 0,
                                    target_amount: goal.target_amount
                                  });
                                }}
                                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Actual</span>
                            {editingGoal === goal.id ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editForm.actual_amount || 0}
                                onChange={(e) => setEditForm(prev => ({ ...prev, actual_amount: parseFloat(e.target.value) || 0 }))}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent text-center"
                              />
                            ) : (
                              <span className="font-semibold text-gray-900 dark:text-white">
                                ${(goal.actual_amount || 0).toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              ${cumulativeActual.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Target</span>
                            <span className="font-semibold text-gray-600 dark:text-gray-300">
                              ${cumulativeTarget.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="relative overflow-hidden">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(progressPercentage, isNegative)}`}
                              style={{ width: `${progressWidth}%` }}
                              title={`${progressPercentage.toFixed(1)}% of cumulative target reached`}
                            ></div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-medium text-white mix-blend-difference">
                              {progressPercentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-gray-800 shadow-sm rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Assets</h2>
            </div>
            <button
              onClick={() => setShowAddAsset(true)}
              className="inline-flex items-center rounded-xl px-3.5 py-2 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Asset
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {assets.length === 0 ? (
              <div className="text-center py-8">
                <PieChart className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No assets</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add your first asset to get started</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="w-64 h-64">
                    <Pie data={assetChartData} options={chartOptions} />
                  </div>
                </div>

                <div className="space-y-2">
                  {assets.map((asset) => (
                    <div key={asset.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          {editingAsset === asset.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editForm.name || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Asset name"
                              />
                              <div className="flex space-x-2">
                                <select
                                  value={editForm.type || asset.type}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  {ASSET_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.amount || 0}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                  className="w-32 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="Amount"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900 dark:text-white truncate" title={asset.name}>{asset.name}</span>
                                <span className="font-semibold text-gray-900 dark:text-white ml-2">${asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {ASSET_TYPES.find(t => t.value === asset.type)?.label || asset.type}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="ml-3 flex space-x-1">
                          {editingAsset === asset.id ? (
                            <>
                              <button
                                onClick={() => {
                                  updateAsset(asset.id, editForm);
                                  setEditingAsset(null);
                                  setEditForm({});
                                }}
                                className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingAsset(null);
                                  setEditForm({});
                                }}
                                className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingAsset(asset.id);
                                  setEditForm({
                                    name: asset.name,
                                    type: asset.type,
                                    amount: asset.amount,
                                    description: asset.description
                                  });
                                }}
                                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteAsset(asset.id)}
                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center">
              <StickyNote className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Goal Notes {currentYear}</h2>
            </div>
            <button
              onClick={() => setEditingGoalNotes(!editingGoalNotes)}
              className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {editingGoalNotes ? (
              <div className="space-y-4">
                <textarea
                  value={editForm.goalNotes || goalNotes?.content || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, goalNotes: e.target.value }))}
                  rows={6}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Add your goal notes for this year..."
                />
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      saveGoalNotes(editForm.goalNotes || '');
                      setEditingGoalNotes(false);
                      setEditForm({});
                    }}
                    className="inline-flex items-center rounded-xl px-3.5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors shadow-sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Notes
                  </button>
                  <button
                    onClick={() => {
                      setEditingGoalNotes(false);
                      setEditForm({});
                    }}
                    className="inline-flex items-center rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-[150px]">
                {goalNotes?.content ? (
                  <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{goalNotes.content}</div>
                ) : (
                  <div className="text-center py-8">
                    <StickyNote className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-600" />
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No goal notes yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center">
              <StickyNote className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Asset Notes {currentYear}</h2>
            </div>
            <button
              onClick={() => setEditingAssetNotes(!editingAssetNotes)}
              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {editingAssetNotes ? (
              <div className="space-y-4">
                <textarea
                  value={editForm.assetNotes || assetNotes?.content || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, assetNotes: e.target.value }))}
                  rows={6}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Add your asset notes for this year..."
                />
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      saveAssetNotes(editForm.assetNotes || '');
                      setEditingAssetNotes(false);
                      setEditForm({});
                    }}
                    className="inline-flex items-center rounded-xl px-3.5 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors shadow-sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Notes
                  </button>
                  <button
                    onClick={() => {
                      setEditingAssetNotes(false);
                      setEditForm({});
                    }}
                    className="inline-flex items-center rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-[150px]">
                {assetNotes?.content ? (
                  <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{assetNotes.content}</div>
                ) : (
                  <div className="text-center py-8">
                    <StickyNote className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-600" />
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No asset notes yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddAsset && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-5 border w-96 shadow-xl rounded-2xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div className="mt-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Asset</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={newAsset.name}
                    onChange={(e) => setNewAsset(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Asset name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select
                    value={newAsset.type}
                    onChange={(e) => setNewAsset(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {ASSET_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAsset.amount}
                    onChange={(e) => setNewAsset(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                  <textarea
                    value={newAsset.description}
                    onChange={(e) => setNewAsset(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Additional details..."
                  />
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => addAsset(true)}
                  disabled={!newAsset.name || newAsset.amount <= 0}
                  className="flex-1 inline-flex justify-center items-center rounded-xl px-3.5 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Asset
                </button>
                <button
                  onClick={() => addAsset(false)}
                  disabled={!newAsset.name || newAsset.amount <= 0}
                  className="flex-1 inline-flex justify-center items-center rounded-xl px-3.5 py-2.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-green-300 dark:border-green-800"
                >
                  Add Another
                </button>
              </div>
              <button
                onClick={() => {
                  setShowAddAsset(false);
                  setNewAsset({ name: '', type: 'other', amount: 0, description: '' });
                }}
                className="w-full mt-3 inline-flex justify-center items-center rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
