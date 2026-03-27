import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2, PieChart } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { extractArray } from '../utils/apiHelpers';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CATEGORIES = ['food','transport','housing','entertainment','healthcare','shopping','utilities','education','other'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const CAT_ICONS = {
  food: '🍽', transport: '🚗', housing: '🏠', entertainment: '🎬',
  healthcare: '💊', shopping: '🛍', utilities: '⚡', education: '📚', other: '📦'
};

export default function Budgets() {
  const { t } = useLanguage();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ category: 'food', allocated_amount: '', currency: 'SEK' });
  const [saving, setSaving] = useState(false);

  const fetchBudgets = useCallback(async () => {
  setLoading(true);
  try {
    const token = localStorage.getItem('session_token'); // Get token
    const res = await axios.get(`${API}/budgets`, { 
      params: { month, year },
      headers: { 'Authorization': `Bearer ${token}` } // Add header
    });
    setBudgets(extractArray(res.data, 'budgets'));
  } catch (err) { 
    toast.error('Failed to load budgets'); 
  } finally { setLoading(false); }
}, [month, year]);
  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const openAdd = () => {
    setEditing(null);
    setForm({ category: 'food', allocated_amount: '', currency: 'SEK' });
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({ category: b.category, allocated_amount: b.allocated_amount, currency: b.currency || 'SEK' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, allocated_amount: parseFloat(form.allocated_amount), month, year };
      if (editing) {
        await axios.put(`${API}/budgets/${editing.id}`, payload);
        toast.success('Budget updated');
      } else {
        await axios.post(`${API}/budgets`, payload);
        toast.success('Budget created');
      }
      setModalOpen(false);
      fetchBudgets();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await axios.delete(`${API}/budgets/${id}`);
      toast.success('Budget deleted');
      fetchBudgets();
    } catch { toast.error('Failed to delete'); }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const safeArray = Array.isArray(budgets) ? budgets : [];
  const totalAllocated = safeArray.reduce((s, b) => s + (b.allocated_amount || 0), 0);
  const totalSpent = safeArray.reduce((s, b) => s + (b.spent || 0), 0);

  return (
    <div className="space-y-5" data-testid="budgets-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('budgets.title')}
        </h1>
        <div className="flex items-center gap-3">
          {/* Month selector */}
          <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm px-3 py-1.5">
            <button onClick={prevMonth} className="text-[#A3A3A3] hover:text-white transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-white text-sm font-semibold tabular-nums w-24 text-center">
              {MONTHS[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="text-[#A3A3A3] hover:text-white transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
          <button onClick={openAdd} data-testid="create-budget-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
          >
            <Plus size={15} />
            {t('budgets.createBudget')}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {safeArray.length > 0 && (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#A3A3A3] font-medium">Monthly Budget Utilization</span>
            <span className="text-xs font-bold tabular-nums text-white">
              {fmt(totalSpent)} / {fmt(totalAllocated)} SEK ({totalAllocated > 0 ? Math.round(totalSpent/totalAllocated*100) : 0}%)
            </span>
          </div>
          <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#4FC3C3] transition-all duration-500"
              style={{ width: `${totalAllocated > 0 ? Math.min(100, totalSpent/totalAllocated*100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* Budget Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-36 rounded-sm" />)}
        </div>
      ) : safeArray.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-12 flex flex-col items-center gap-3">
          <PieChart size={36} className="text-[#2A2A2A]" />
          <p className="text-[#6B6B6B] text-sm">{t('budgets.noBudgets')}</p>
          <button onClick={openAdd} className="text-[#4FC3C3] text-xs font-semibold hover:underline">{t('budgets.createBudget')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="budget-cards">
          {safeArray.map(b => {
            const pct = b.percentage || 0;
            const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#4FC3C3';
            const remaining = b.allocated_amount - (b.spent || 0);
            return (
              <div key={b.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5 hover:border-[#4FC3C3]/30 transition-all duration-200 group"
                data-testid={`budget-card-${b.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CAT_ICONS[b.category] || '📦'}</span>
                    <span className="text-white text-sm font-bold capitalize">{b.category}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(b)} className="text-[#6B6B6B] hover:text-[#4FC3C3] p-1 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="text-[#6B6B6B] hover:text-[#EF4444] p-1 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className="text-[#6B6B6B] text-xs">{t('budgets.spent')}</p>
                    <p className="text-white font-bold tabular-nums text-base">{fmt(b.spent)} SEK</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#6B6B6B] text-xs">{t('budgets.allocated')}</p>
                    <p className="text-[#A3A3A3] tabular-nums text-sm">{fmt(b.allocated_amount)} SEK</p>
                  </div>
                </div>

                <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: barColor }}>{pct}% used</span>
                  <span className={`text-xs font-semibold tabular-nums ${remaining >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(Math.abs(remaining))} over`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-sm" data-testid="budget-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {editing ? t('budgets.editBudget') : t('budgets.createBudget')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              >
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#1A1A1A]">{c.charAt(0).toUpperCase()+c.slice(1)} {CAT_ICONS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Allocated Amount (SEK)</label>
              <input type="number" value={form.allocated_amount} onChange={e => setForm(f => ({ ...f, allocated_amount: e.target.value }))}
                placeholder="5000" required min="1" data-testid="budget-amount-input"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <p className="text-xs text-[#6B6B6B]">Period: {MONTHS[month-1]} {year}</p>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving} data-testid="save-budget-btn"
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
