import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, BarChart3, TrendingUp, PieChart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { extractNestedArray } from '../utils/apiHelpers';
import { toast } from 'sonner';
import { API } from '../config/api';

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const CAT_COLORS = {
  food: '#FF6B6B', transport: '#4ECDC4', housing: '#45B7D1', entertainment: '#FFA07A',
  healthcare: '#98D8C8', shopping: '#F7DC6F', utilities: '#BB8FCE', education: '#85C1E2', other: '#D7DBDB'
};

const PERIODS = [
  { value: 'this_month', label: 'Month' },
  { value: 'this_year', label: 'Year' },
  { value: 'all', label: 'All Time' }
];

const TYPES = ['expense', 'income', 'both'];

export default function Reports() {
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('this_month');
  const [typeFilter, setTypeFilter] = useState('expense'); // New state for type toggle

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await axios.get(`${API}/reports/summary`, { 
        params: { period: dateRange }, // Now sends 'this_month', 'this_year', or 'all'
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setAnalytics(res.data || {});
    } catch (err) { 
      toast.error('Failed to load reports'); 
      setAnalytics({});
    } finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const data = analytics || {};
  const byCategory = extractNestedArray(data, 'by_category');
  const byMonth = extractNestedArray(data, 'trend'); 
  const topExpenses = [];
  
  const totalIncome = data.total_income || 0;
  const totalExpenses = data.total_expenses || 0;
  const netSavings = totalIncome - totalExpenses;

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('reports.title') || "Reports"}
        </h1>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* Type Filter (Income/Expense/Both) */}
          <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-1">
            {TYPES.map(type => (
              <button key={type} onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold capitalize transition-all ${
                  typeFilter === type
                    ? 'bg-[#4FC3C3] text-[#0A0A0A]'
                    : 'text-[#A3A3A3] hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-1">
            {PERIODS.map(range => (
              <button key={range.value} onClick={() => setDateRange(range.value)}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold capitalize transition-all ${
                  dateRange === range.value
                    ? 'bg-[#4FC3C3] text-[#0A0A0A]'
                    : 'text-[#A3A3A3] hover:text-white'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#6B6B6B] text-xs font-semibold uppercase">Total Income</p>
            <TrendingUp size={16} className="text-[#10B981]" />
          </div>
          {loading ? (
            <div className="skeleton h-8 rounded" />
          ) : (
            <p className="text-white font-black text-2xl tabular-nums">{fmt(totalIncome)} <span className="text-sm text-[#A3A3A3] font-normal">SEK</span></p>
          )}
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#6B6B6B] text-xs font-semibold uppercase">Total Expenses</p>
            <BarChart3 size={16} className="text-[#EF4444]" />
          </div>
          {loading ? (
            <div className="skeleton h-8 rounded" />
          ) : (
            <p className="text-white font-black text-2xl tabular-nums">{fmt(totalExpenses)} <span className="text-sm text-[#A3A3A3] font-normal">SEK</span></p>
          )}
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#6B6B6B] text-xs font-semibold uppercase">Net Savings</p>
            <PieChart size={16} className="text-[#4FC3C3]" />
          </div>
          {loading ? (
            <div className="skeleton h-8 rounded" />
          ) : (
            <p className={`font-black text-2xl tabular-nums ${netSavings >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {netSavings >= 0 ? '+' : ''}{fmt(netSavings)} <span className="text-sm text-[#A3A3A3] font-normal">SEK</span>
            </p>
          )}
        </div>
      </div>

      {/* Charts Section */}
      {loading ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-8 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-[#4FC3C3]" size={16} />
          <span className="text-[#6B6B6B] text-sm">Loading analytics...</span>
        </div>
      ) : (
        <>
          {/* Expenses / Income by Category */}
          {byCategory.length > 0 && (
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-6">
              <h2 className="text-lg font-black text-white mb-5 tracking-tight capitalize">
                {typeFilter === 'both' ? 'Transactions' : typeFilter} by Category
              </h2>
              <div className="space-y-3" data-testid="category-breakdown">
                {byCategory
                  // Filter out categories that have 0 for the selected type
                  .filter(cat => {
                    if (typeFilter === 'expense') return cat.expense > 0;
                    if (typeFilter === 'income') return cat.income > 0;
                    return cat.expense > 0 || cat.income > 0;
                  })
                  // Sort them highest to lowest based on the selected type
                  .sort((a, b) => {
                    const valA = typeFilter === 'income' ? a.income : a.expense;
                    const valB = typeFilter === 'income' ? b.income : b.expense;
                    return valB - valA;
                  })
                  .map((cat, idx) => {
                    const color = CAT_COLORS[cat.category] || '#D7DBDB';
                    
                    // Dynamically select the safe amount and the total to divide by
                    let safeAmount = 0;
                    let totalForPct = 1;
                    
                    if (typeFilter === 'expense') {
                      safeAmount = cat.expense || 0;
                      totalForPct = totalExpenses;
                    } else if (typeFilter === 'income') {
                      safeAmount = cat.income || 0;
                      totalForPct = totalIncome;
                    } else {
                      // If "both", combine them
                      safeAmount = (cat.expense || 0) + (cat.income || 0);
                      totalForPct = totalExpenses + totalIncome;
                    }
                    
                    const pct = totalForPct > 0 ? (safeAmount / totalForPct) * 100 : 0;

                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white capitalize font-semibold">{cat.category}</span>
                          <span className="text-sm text-[#A3A3A3] font-bold tabular-nums">
                            {fmt(safeAmount)} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Monthly Trend */}
          {byMonth.length > 0 && (
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-6">
              <h2 className="text-lg font-black text-white mb-5 tracking-tight">Monthly Trend</h2>
              <div className="flex items-end justify-between gap-2 h-48" data-testid="monthly-trend">
                {byMonth.map((month, idx) => {
                  const maxValue = Math.max(...byMonth.map(m => Math.max(m.income || 0, m.expenses || 0)));
                  const incomeHeight = maxValue > 0 ? ((month.income || 0) / maxValue) * 100 : 0;
                  const expenseHeight = maxValue > 0 ? ((month.expenses || 0) / maxValue) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex items-end justify-center gap-1 h-40">
                        {month.income > 0 && (
                          <div className="flex-1 bg-[#10B981]/60 rounded-t-sm transition-all hover:bg-[#10B981] group" 
                            style={{ height: `${incomeHeight}%` }} title={`Income: ${fmt(month.income)}`}>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[#10B981] text-xs font-bold absolute -mt-5">
                              {fmt(month.income)}
                            </div>
                          </div>
                        )}
                        {month.expenses > 0 && (
                          <div className="flex-1 bg-[#EF4444]/60 rounded-t-sm transition-all hover:bg-[#EF4444] group" 
                            style={{ height: `${expenseHeight}%` }} title={`Expenses: ${fmt(month.expenses)}`}>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[#EF4444] text-xs font-bold absolute -mt-5">
                              {fmt(month.expenses)}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-[#6B6B6B] font-semibold">{month.month.substr(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-4 justify-center text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[#10B981] rounded-sm" />
                  <span className="text-[#A3A3A3]">Income</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[#EF4444] rounded-sm" />
                  <span className="text-[#A3A3A3]">Expenses</span>
                </div>
              </div>
            </div>
          )}

          {/* Top Expenses (Currently empty, retained for future backend support) */}
          {topExpenses.length > 0 && (
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-6">
              <h2 className="text-lg font-black text-white mb-4 tracking-tight">Top Transactions</h2>
              <div className="space-y-2" data-testid="top-expenses">
                {topExpenses.slice(0, 10).map((exp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-[#0A0A0A] rounded-sm hover:bg-[#4FC3C3]/5 transition-colors">
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold">{exp.description}</p>
                      <p className="text-[#6B6B6B] text-xs">{exp.date ? new Date(exp.date).toLocaleDateString('sv-SE') : 'N/A'}</p>
                    </div>
                    <p className="text-white font-bold tabular-nums">
                      {exp.type === 'income' ? '+' : '-'}{fmt(exp.amount)} SEK
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !byCategory.length && !byMonth.length && !topExpenses.length && (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-12 flex flex-col items-center gap-3 text-center">
          <BarChart3 size={48} className="text-[#2A2A2A]" />
          <p className="text-[#6B6B6B]">{t('reports.noData')}</p>
          <p className="text-[#6B6B6B] text-xs">Start adding transactions to see analytics</p>
        </div>
      )}
    </div>
  );
}