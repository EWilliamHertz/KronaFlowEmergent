import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Search, Pencil, Trash2, Loader2, BarChart2, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { API } from '../config/api';

const CATEGORY_COLORS = {
  food: '#10B981', transport: '#3B82F6', housing: '#8B5CF6',
  entertainment: '#F59E0B', healthcare: '#EF4444', shopping: '#EC4899',
  utilities: '#06B6D4', education: '#14B8A6', salary: '#10B981',
  freelance: '#4FC3C3', investment: '#8B5CF6', gift: '#F59E0B', other: '#6B7280'
};

const EXPENSE_CATS = ['food','transport','housing','entertainment','healthcare','shopping','utilities','education','other'];
const INCOME_CATS = ['salary','freelance','investment','gift','other'];

const RECURRENCE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const STAT_PERIODS = [
  { value: '', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
];

const now = new Date();
const PERIOD_PARAMS = {
  '': {},
  'this_month': { month: now.getMonth() + 1, year: now.getFullYear() },
  'last_month': { month: now.getMonth() === 0 ? 12 : now.getMonth(), year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear() },
  'this_year': { year: now.getFullYear() },
};

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const today = () => new Date().toISOString().split('T')[0];

const EMPTY = { type: 'expense', amount: '', category: 'food', description: '', date: today(), party: '', currency: 'SEK', recurring: false, recurrence: 'monthly' };

export default function Transactions() {
  const { t } = useLanguage();
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: 'all', search: '', category: '' });
  const [view, setView] = useState('list');
  const [stats, setStats] = useState(null);
  const [statPeriod, setStatPeriod] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.type !== 'all') params.type = filter.type;
      if (filter.category) params.category = filter.category;
      if (filter.search) params.search = filter.search;
      
      console.log('📡 Fetching transactions from:', `${API}/transactions`, { params });
      const res = await axios.get(`${API}/transactions`, { params });
      
      // Handle different response formats
      let data = res.data;
      console.log('📦 Raw response:', data);
      
      // If the response is an object with a 'data' or 'transactions' key, extract it
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (Array.isArray(data.transactions)) {
          data = data.transactions;
        } else if (Array.isArray(data.data)) {
          data = data.data;
        } else {
          console.warn('⚠️ Unexpected response format:', data);
          data = [];
        }
      }
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('❌ Response is not an array:', data);
        data = [];
      }
      
      setTxns(data);
    } catch (err) {
      console.error('❌ Failed to load transactions:', err);
      toast.error(`Failed to load transactions: ${err.message}`);
      setTxns([]);
    }
    finally { setLoading(false); }
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const params = PERIOD_PARAMS[statPeriod] || {};
      const res = await axios.get(`${API}/transactions/stats`, { params });
      setStats(res.data);
    } catch (err) {
      console.error('❌ Failed to load stats:', err);
      toast.error('Failed to load statistics');
    }
  }, [statPeriod]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);
  useEffect(() => { if (view === 'stats') fetchStats(); }, [view, fetchStats]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (txn) => {
    setEditing(txn);
    setForm({
      type: txn.type, amount: txn.amount, category: txn.category,
      description: txn.description, date: txn.date, party: txn.party || '',
      currency: txn.currency || 'SEK',
      recurring: txn.recurring || false, recurrence: txn.recurrence || 'monthly'
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        recurring: form.recurring,
        recurrence: form.recurring ? form.recurrence : null,
      };
      if (editing) {
        await axios.put(`${API}/transactions/${editing.id}`, payload);
        toast.success('Transaction updated');
      } else {
        await axios.post(`${API}/transactions`, payload);
        toast.success('Transaction added');
      }
      setModalOpen(false);
      fetchTxns();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await axios.delete(`${API}/transactions/${id}`);
      toast.success('Deleted');
      fetchTxns();
    } catch { toast.error('Failed to delete'); }
  };

  const cats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  return (
    <div className="space-y-5" data-testid="transactions-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('transactions.title')}
        </h1>
        <button onClick={openAdd} data-testid="add-transaction-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
        >
          <Plus size={15} />
          {t('transactions.addTransaction')}
        </button>
      </div>

      {/* View Toggle + Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-sm border border-[#2A2A2A] overflow-hidden">
          {['list','stats'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 text-xs font-semibold transition-all ${view === v ? 'bg-[#4FC3C3] text-[#0A0A0A]' : 'bg-[#1A1A1A] text-[#A3A3A3] hover:text-white'}`}
            >
              {v === 'list' ? 'Transactions' : t('transactions.statistics')}
            </button>
          ))}
        </div>

        {view === 'list' && (
          <>
            <div className="flex rounded-sm border border-[#2A2A2A] overflow-hidden">
              {['all','income','expense'].map(tp => (
                <button key={tp} onClick={() => setFilter(f => ({ ...f, type: tp }))}
                  className={`px-3 py-1.5 text-xs font-semibold capitalize transition-all ${filter.type === tp ? 'bg-[#4FC3C3]/20 text-[#4FC3C3]' : 'bg-[#1A1A1A] text-[#A3A3A3] hover:text-white'}`}
                >
                  {t(`transactions.${tp}`) || tp}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]" />
              <input value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                placeholder={t('common.search')} data-testid="search-input"
                className="w-full pl-8 pr-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
          </>
        )}

        {view === 'stats' && (
          <div className="flex rounded-sm border border-[#2A2A2A] overflow-hidden">
            {STAT_PERIODS.map(p => (
              <button key={p.value} onClick={() => setStatPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-semibold transition-all ${statPeriod === p.value ? 'bg-[#4FC3C3]/20 text-[#4FC3C3]' : 'bg-[#1A1A1A] text-[#A3A3A3] hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Transactions Table */}
      {view === 'list' && (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm overflow-hidden">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-[#4FC3C3]" />
            </div>
          ) : txns.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3">
              <BarChart2 size={32} className="text-[#2A2A2A]" />
              <p className="text-[#6B6B6B] text-sm">{t('transactions.noTransactions')}</p>
              <button onClick={openAdd} className="text-[#4FC3C3] text-xs font-semibold hover:underline">{t('transactions.addTransaction')}</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="transactions-table">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    {['Date','Description','Category','Party','Amount',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txns.map(txn => (
                    <tr key={txn.id} className="border-b border-[#2A2A2A] hover:bg-[#4FC3C3]/5 transition-colors">
                      <td className="px-4 py-3 text-xs text-[#A3A3A3] tabular-nums whitespace-nowrap">{txn.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium truncate max-w-[140px]">{txn.description}</span>
                          {txn.recurring && (
                            <span title={txn.recurrence} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-[#4FC3C3]/10 text-[#4FC3C3] text-xs">
                              <RefreshCw size={9} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-sm text-xs font-medium capitalize"
                          style={{ background: `${CATEGORY_COLORS[txn.category] || '#6B7280'}20`, color: CATEGORY_COLORS[txn.category] || '#6B7280' }}>
                          {txn.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#A3A3A3]">{txn.party || '—'}</td>
                      <td className={`px-4 py-3 text-sm font-bold tabular-nums whitespace-nowrap ${txn.type === 'income' ? 'text-[#10B981]' : 'text-white'}`}>
                        {txn.type === 'income' ? '+' : '-'}{fmt(txn.amount)} {txn.currency}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(txn)} className="text-[#6B6B6B] hover:text-[#4FC3C3] transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => handleDelete(txn.id)} className="text-[#6B6B6B] hover:text-[#EF4444] transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stats View */}
      {view === 'stats' && (
        <div className="space-y-4">
          {!stats ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-[#4FC3C3]" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Income', val: `${fmt(stats.total_income)} SEK`, color: '#10B981' },
                  { label: 'Total Expenses', val: `${fmt(stats.total_expenses)} SEK`, color: '#F59E0B' },
                  { label: 'Net', val: `${fmt(stats.net)} SEK`, color: stats.net >= 0 ? '#10B981' : '#EF4444' },
                  { label: 'Transactions', val: stats.transaction_count, color: '#4FC3C3' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
                    <p className="text-[#6B6B6B] text-xs mb-1">{label}</p>
                    <p className="font-bold tabular-nums text-lg" style={{ color }}>{val}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
                  <h3 className="text-sm font-bold text-white mb-4">Spending by Category</h3>
                  {stats.by_category.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.by_category} margin={{ left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                        <XAxis dataKey="category" tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '2px', fontSize: 11 }} />
                        <Bar dataKey="expense" name="Expense" fill="#F59E0B" radius={[2,2,0,0]} />
                        <Bar dataKey="income" name="Income" fill="#4FC3C3" radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-[#6B6B6B] text-sm text-center py-12">No data for this period</p>}
                </div>
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
                  <h3 className="text-sm font-bold text-white mb-4">Expense Distribution</h3>
                  {stats.by_category.some(c => c.expense > 0) ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={stats.by_category.filter(c => c.expense > 0)} dataKey="expense" nameKey="category" cx="50%" cy="50%" outerRadius={80}>
                          {stats.by_category.filter(c => c.expense > 0).map((entry, i) => (
                            <Cell key={i} fill={CATEGORY_COLORS[entry.category] || '#6B7280'} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '2px', fontSize: 11 }} />
                        <Legend formatter={(v) => <span style={{ color: '#A3A3A3', fontSize: 11 }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-[#6B6B6B] text-sm text-center py-12">No expense data</p>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md" data-testid="transaction-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {editing ? t('transactions.editTransaction') : t('transactions.addTransaction')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {/* Type Toggle */}
            <div className="flex rounded-sm border border-[#2A2A2A] overflow-hidden">
              {['expense','income'].map(tp => (
                <button key={tp} type="button" onClick={() => setForm(f => ({ ...f, type: tp, category: tp === 'income' ? 'salary' : 'food' }))}
                  className={`flex-1 py-2 text-xs font-bold capitalize transition-all ${form.type === tp ? 'bg-[#4FC3C3] text-[#0A0A0A]' : 'bg-transparent text-[#A3A3A3] hover:text-white'}`}
                >
                  {t(`transactions.${tp}`)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Amount</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0" required min="0" step="0.01" data-testid="amount-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required data-testid="date-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] [color-scheme:dark]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                data-testid="category-select"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              >
                {cats.map(c => <option key={c} value={c} className="bg-[#1A1A1A]">{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What was this for?" required data-testid="description-input"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Party (optional)</label>
              <input type="text" value={form.party} onChange={e => setForm(f => ({ ...f, party: e.target.value }))}
                placeholder="Store, person, etc."
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>

            {/* Recurring Toggle */}
            <div className="border border-[#2A2A2A] rounded-sm p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="text-[#4FC3C3]" />
                  <span className="text-sm font-semibold text-white">Recurring Transaction</span>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
                  data-testid="recurring-toggle"
                  className={`relative w-10 h-5 rounded-full transition-all duration-200 ${form.recurring ? 'bg-[#4FC3C3]' : 'bg-[#2A2A2A]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${form.recurring ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              {form.recurring && (
                <div>
                  <label className="text-xs text-[#6B6B6B] mb-1 block">Repeat</label>
                  <div className="flex gap-2 flex-wrap">
                    {RECURRENCE_OPTIONS.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setForm(f => ({ ...f, recurrence: opt.value }))}
                        className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-all ${
                          form.recurrence === opt.value
                            ? 'bg-[#4FC3C3] text-[#0A0A0A]'
                            : 'bg-[#0A0A0A] border border-[#2A2A2A] text-[#A3A3A3] hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving} data-testid="save-transaction-btn"
                className="flex-1 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
