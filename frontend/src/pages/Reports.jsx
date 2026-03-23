import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, BarChart2, Download } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'this_year', label: 'This Year' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
];

const CATEGORY_COLORS = {
  food: '#10B981', transport: '#3B82F6', housing: '#8B5CF6',
  entertainment: '#F59E0B', healthcare: '#EF4444', shopping: '#EC4899',
  utilities: '#06B6D4', education: '#14B8A6', salary: '#10B981',
  freelance: '#4FC3C3', investment: '#8B5CF6', gift: '#F59E0B', other: '#6B7280'
};

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-3 text-xs">
      <p className="text-[#A3A3A3] mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold tabular-nums">
          {p.name}: {fmt(p.value)} SEK
        </p>
      ))}
    </div>
  );
};

export default function Reports() {
  const { t } = useLanguage();
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/reports/summary`, { params: { period } });
      setData(res.data);
    } catch {}
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const periodLabel = PERIODS.find(p => p.value === period)?.label || '';

  return (
    <div className="space-y-5" data-testid="reports-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('nav.reports')}
        </h1>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex rounded-sm border border-[#2A2A2A] overflow-hidden">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-semibold transition-all ${period === p.value ? 'bg-[#4FC3C3] text-[#0A0A0A]' : 'bg-[#1A1A1A] text-[#A3A3A3] hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-[#4FC3C3]" />
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <BarChart2 size={36} className="text-[#2A2A2A]" />
          <p className="text-[#6B6B6B] text-sm">No data available</p>
        </div>
      ) : (
        <>
          {/* P&L Summary */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Profit & Loss — {periodLabel}</h2>
              <span className="text-xs text-[#6B6B6B]">{data.transaction_count} transactions</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0A0A0A] rounded-sm p-4 border border-[#2A2A2A]">
                <p className="text-xs font-bold uppercase tracking-widest text-[#10B981] mb-2">Total Revenue</p>
                <p className="text-white font-black tabular-nums text-2xl">{fmt(data.total_income)}</p>
                <p className="text-[#6B6B6B] text-xs mt-1">SEK</p>
              </div>
              <div className="bg-[#0A0A0A] rounded-sm p-4 border border-[#2A2A2A]">
                <p className="text-xs font-bold uppercase tracking-widest text-[#F59E0B] mb-2">Total Expenses</p>
                <p className="text-white font-black tabular-nums text-2xl">{fmt(data.total_expenses)}</p>
                <p className="text-[#6B6B6B] text-xs mt-1">SEK</p>
              </div>
              <div className={`bg-[#0A0A0A] rounded-sm p-4 border ${data.net >= 0 ? 'border-[#10B981]/30' : 'border-[#EF4444]/30'}`}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${data.net >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>Net Result</p>
                <p className={`font-black tabular-nums text-2xl ${data.net >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  {data.net >= 0 ? '+' : ''}{fmt(data.net)}
                </p>
                <p className="text-[#6B6B6B] text-xs mt-1">SEK</p>
              </div>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
            <h3 className="text-sm font-bold text-white mb-4">12-Month Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4FC3C3" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4FC3C3" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="income" name="Income" stroke="#4FC3C3" fill="url(#rIncome)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#F59E0B" fill="url(#rExpense)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Table */}
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2A2A2A]">
                <h3 className="text-sm font-bold text-white">Category Breakdown</h3>
              </div>
              <div className="overflow-auto max-h-72">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2A2A2A]">
                      {['Category','Income','Expenses','Count'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_category.map(cat => (
                      <tr key={cat.category} className="border-b border-[#2A2A2A] hover:bg-[#4FC3C3]/5">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat.category] || '#6B7280' }} />
                            <span className="text-white text-sm capitalize">{cat.category}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[#10B981] text-sm tabular-nums">{fmt(cat.income)}</td>
                        <td className="px-4 py-2.5 text-[#F59E0B] text-sm tabular-nums">{fmt(cat.expense)}</td>
                        <td className="px-4 py-2.5 text-[#6B6B6B] text-sm">{cat.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bar chart */}
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
              <h3 className="text-sm font-bold text-white mb-4">Expenses by Category</h3>
              {data.by_category.some(c => c.expense > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.by_category.filter(c => c.expense > 0)} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="category" tick={{ fill: '#A3A3A3', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '2px', fontSize: 11 }}
                      formatter={(v) => [`${fmt(v)} SEK`, 'Expense']} />
                    <Bar dataKey="expense" radius={[0,2,2,0]}>
                      {data.by_category.filter(c => c.expense > 0).map((entry, i) => (
                        <rect key={i} fill={CATEGORY_COLORS[entry.category] || '#6B7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <p className="text-[#6B6B6B] text-sm">No expense data for this period</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
