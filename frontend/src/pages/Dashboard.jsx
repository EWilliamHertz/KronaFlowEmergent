import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, DollarSign, Plus, ArrowRight, X, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { API } from '../config/api';

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

export default function Dashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    axios.get(`${API}/dashboard/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => setStats(res.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const getAiInsights = async () => {
    setAiLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await axios.post(`${API}/ai/insights`, 
        { context: aiQuestion || null },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setAiInsights(res.data.insights);
    } catch {
      toast.error('AI insights unavailable. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-sm" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="skeleton h-64 lg:col-span-2 rounded-sm" />
          <div className="skeleton h-64 rounded-sm" />
        </div>
      </div>
    );
  }

  const statCards = [
    { label: t('dashboard.totalBalance'), value: `${fmt(stats?.total_balance)} SEK`, icon: Wallet, color: '#4FC3C3', bg: 'rgba(79,195,195,0.1)' },
    { label: t('dashboard.monthlyIncome'), value: `${fmt(stats?.monthly_income)} SEK`, icon: TrendingUp, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    { label: t('dashboard.monthlyExpenses'), value: `${fmt(stats?.monthly_expenses)} SEK`, icon: TrendingDown, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    { label: t('dashboard.netWorth'), value: `${fmt(stats?.net_worth)} SEK`, icon: DollarSign, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  ];

  // Detect any categories that are 90% or more spent
  const overBudgetCategories = stats?.budget_overview?.filter(b => {
    const pct = b.allocated > 0 ? (b.spent / b.allocated) * 100 : 0;
    return pct >= 90;
  }) || [];

  return (
    <div className="space-y-5 relative" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
            {t('dashboard.title')}
          </h1>
          <p className="text-[#6B6B6B] text-xs mt-0.5">
            {new Date().toLocaleDateString('en-SE', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowAI(true)}
          data-testid="ai-insights-btn"
          className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#4FC3C3]/10 border border-[#4FC3C3]/30 text-[#4FC3C3] text-xs font-bold hover:bg-[#4FC3C3]/20 transition-all duration-200"
        >
          <span>✦</span>
          {t('dashboard.aiInsights')}
        </button>
      </div>

      {/* SMART BUDGET ALERTS BANNER */}
      {overBudgetCategories.length > 0 && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-sm p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="text-[#EF4444] shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="text-[#EF4444] font-bold text-sm">Budget Attention Needed</h4>
            <p className="text-[#A3A3A3] text-xs mt-1 leading-relaxed">
              You are approaching or exceeding your limits for: 
              <span className="text-white font-semibold ml-1 capitalize">
                {overBudgetCategories.map(b => b.category).join(', ')}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="stat-cards">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4 hover:border-[#4FC3C3]/30 transition-all duration-200 hover:-translate-y-[1px]">
            <div className="w-8 h-8 rounded-sm flex items-center justify-center mb-3" style={{ background: bg }}>
              <Icon size={15} style={{ color }} />
            </div>
            <p className="text-[#A3A3A3] text-xs font-medium mb-1">{label}</p>
            <p className="text-white font-bold tabular-nums text-lg tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5" data-testid="income-chart">
          <h3 className="text-sm font-bold text-white mb-4">{t('dashboard.incomeVsExpenses')}</h3>
          {stats?.trend?.some(t => t.income > 0 || t.expenses > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4FC3C3" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4FC3C3" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="income" name="Income" stroke="#4FC3C3" fill="url(#gIncome)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#F59E0B" fill="url(#gExpense)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center gap-2">
              <p className="text-[#6B6B6B] text-sm">No transaction data yet</p>
              <button onClick={() => navigate('/transactions')} className="text-[#4FC3C3] text-xs hover:underline">Add transactions</button>
            </div>
          )}
        </div>

        {/* NEW: 6-Month Future Forecast */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Zap size={100} className="text-[#8B5CF6]" /></div>
          <div className="flex justify-between items-center mb-4 relative z-10">
            <h3 className="text-sm font-bold text-white">6-Month Balance Forecast</h3>
            <span className="text-[10px] uppercase font-bold text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-0.5 rounded-sm">AI Projection</span>
          </div>
          {stats?.forecast?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.forecast} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#6B6B6B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', color: '#fff', fontSize: '12px' }} formatter={(value) => [`${fmt(value)} SEK`, 'Est. Balance']} />
                <Line type="monotone" dataKey="projected_balance" stroke="#8B5CF6" strokeWidth={3} strokeDasharray="5 5" dot={{ fill: '#8B5CF6', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-[200px] flex items-center justify-center text-[#6B6B6B] text-sm relative z-10">Need more data to predict</div>}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Budget Overview (Moved Down) */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5" data-testid="budget-overview">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">{t('dashboard.budgetOverview')}</h3>
            <button onClick={() => navigate('/budgets')} className="text-[#4FC3C3] text-xs hover:underline flex items-center gap-1">
              All <ArrowRight size={11} />
            </button>
          </div>
          {stats?.budget_overview?.length > 0 ? (
            <div className="space-y-3.5">
              {stats.budget_overview.slice(0, 5).map(b => {
                const safePercent = b.allocated > 0 ? Math.round((b.spent / b.allocated) * 100) : 0;
                
                return (
                <div key={b.category}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-[#A3A3A3] capitalize">{b.category}</span>
                    <span className="text-xs font-semibold tabular-nums" style={{
                      color: safePercent >= 90 ? '#EF4444' : safePercent >= 70 ? '#F59E0B' : '#10B981'
                    }}>{safePercent}%</span>
                  </div>
                  <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: `${Math.min(100, safePercent)}%`,
                      background: safePercent >= 90 ? '#EF4444' : safePercent >= 70 ? '#F59E0B' : '#4FC3C3'
                    }} />
                  </div>
                  <p className="text-[#6B6B6B] text-xs mt-1 tabular-nums">{fmt(b.spent)} / {fmt(b.allocated)} SEK</p>
                </div>
              )})}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <p className="text-[#6B6B6B] text-xs">No budgets for this month</p>
              <button onClick={() => navigate('/budgets')} className="text-[#4FC3C3] text-xs hover:underline">Create budget</button>
            </div>
          )}
        </div>
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5" data-testid="recent-transactions">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">{t('dashboard.recentTransactions')}</h3>
            <button onClick={() => navigate('/transactions')} className="text-[#4FC3C3] text-xs hover:underline flex items-center gap-1">
              View all <ArrowRight size={11} />
            </button>
          </div>
          {stats?.recent_transactions?.length > 0 ? (
            <div className="space-y-1">
              {stats.recent_transactions.map(txn => (
                <div key={txn.id} className="flex items-center justify-between py-2 border-b border-[#2A2A2A] last:border-0 hover:bg-[#4FC3C3]/5 px-2 -mx-2 rounded-sm transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold" style={{
                      background: `${CATEGORY_COLORS[txn.category] || '#6B7280'}20`,
                      color: CATEGORY_COLORS[txn.category] || '#6B7280'
                    }}>
                      {(txn.category?.[0] || 'O').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium truncate max-w-[160px]">{txn.description}</p>
                      <p className="text-[#6B6B6B] text-xs">{txn.date} · <span className="capitalize">{txn.category}</span></p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${txn.type === 'income' ? 'text-[#10B981]' : 'text-white'}`}>
                    {txn.type === 'income' ? '+' : '-'}{fmt(txn.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 gap-2">
              <p className="text-[#6B6B6B] text-sm">No transactions yet</p>
              <button onClick={() => navigate('/transactions')} className="text-[#4FC3C3] text-xs hover:underline">Add first transaction</button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5" data-testid="quick-actions">
          <h3 className="text-sm font-bold text-white mb-4">{t('dashboard.quickActions')}</h3>
          <div className="space-y-2">
            {[
              { label: 'Add Transaction', path: '/transactions', color: '#4FC3C3' },
              { label: 'Create Budget', path: '/budgets', color: '#10B981' },
              { label: 'Add Investment', path: '/investments', color: '#8B5CF6' },
              { label: 'Track Debt', path: '/debts', color: '#F59E0B' },
            ].map(({ label, path, color }) => (
              <button key={path} onClick={() => navigate(path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm border border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#4FC3C3]/30 hover:bg-[#2A2A2A] transition-all duration-150 text-left"
              >
                <div className="w-6 h-6 rounded-sm flex items-center justify-center" style={{ background: `${color}20` }}>
                  <Plus size={12} style={{ color }} />
                </div>
                <span className="text-[#A3A3A3] text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GLOBAL QUICK ADD FAB */}
      <button 
        onClick={() => navigate('/transactions')} 
        title="Quick Add Transaction"
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#4FC3C3] text-[#0A0A0A] rounded-full shadow-[0_0_20px_rgba(79,195,195,0.3)] flex items-center justify-center hover:scale-105 hover:bg-[#3AA8A8] transition-all duration-200 z-40"
      >
        <Plus size={24} strokeWidth={3} />
      </button>

      {/* AI Insights Modal */}
      {showAI && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm w-full max-w-lg" data-testid="ai-modal">
            <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
              <div className="flex items-center gap-2">
                <span className="text-[#4FC3C3]">✦</span>
                <h2 className="text-white font-bold text-sm">{t('dashboard.aiInsights')}</h2>
              </div>
              <button onClick={() => { setShowAI(false); setAiInsights(''); setAiQuestion(''); }} className="text-[#6B6B6B] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  value={aiQuestion}
                  onChange={e => setAiQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && getAiInsights()}
                  placeholder="Ask about your finances (optional)..."
                  data-testid="ai-question-input"
                  className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
                <button onClick={getAiInsights} disabled={aiLoading} data-testid="get-insights-btn"
                  className="px-3 py-2 bg-[#4FC3C3] text-[#0A0A0A] text-xs font-bold rounded-sm hover:bg-[#3AA8A8] transition-all disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {aiLoading ? <Loader2 size={12} className="animate-spin" /> : '✦'}
                  Analyze
                </button>
              </div>
              {aiInsights ? (
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4 text-xs text-[#A3A3A3] leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto" data-testid="ai-insights-text">
                  {aiInsights}
                </div>
              ) : !aiLoading ? (
                <p className="text-center text-[#6B6B6B] text-xs py-4">
                  Click "Analyze" to get AI-powered insights on your financial data.
                </p>
              ) : (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 size={16} className="animate-spin text-[#4FC3C3]" />
                  <span className="text-[#A3A3A3] text-xs">Analyzing your finances...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}