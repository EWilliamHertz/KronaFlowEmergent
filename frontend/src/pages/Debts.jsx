import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, CheckCircle2, Loader2, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { extractArray } from '../utils/apiHelpers';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const DEBT_TYPES = ['personal_loan', 'credit_card', 'mortgage', 'student_loan', 'car_loan', 'other'];

const TYPE_COLORS = {
  personal_loan: '#3B82F6',
  credit_card: '#EF4444',
  mortgage: '#10B981',
  student_loan: '#F59E0B',
  car_loan: '#8B5CF6',
  other: '#6B7280'
};

const TYPE_ICONS = {
  personal_loan: '🤝',
  credit_card: '💳',
  mortgage: '🏠',
  student_loan: '📚',
  car_loan: '🚗',
  other: '📋'
};

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const EMPTY = { type: 'personal_loan', creditor: '', principal: '', interest_rate: '0', remaining_amount: '', currency: 'SEK', due_date: '', description: '' };

export default function Debts() {
  const { t } = useLanguage();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ debt_id: '', amount: '' });
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeType !== 'all' ? { type: activeType } : {};
      const res = await axios.get(`${API}/debts`, { params });
      setDebts(extractArray(res.data, 'debts'));
    } catch (err) { 
      console.error('Failed to load debts:', err);
      toast.error('Failed to load debts'); 
    }
    finally { setLoading(false); }
  }, [activeType]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (d) => {
    setEditing(d);
    setForm({
      type: d.type,
      creditor: d.creditor,
      principal: d.principal,
      interest_rate: d.interest_rate || '0',
      remaining_amount: d.remaining_amount,
      currency: d.currency || 'SEK',
      due_date: d.due_date || '',
      description: d.description || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        principal: parseFloat(form.principal),
        remaining_amount: parseFloat(form.remaining_amount),
        interest_rate: parseFloat(form.interest_rate)
      };
      if (editing) {
        await axios.put(`${API}/debts/${editing.id}`, payload);
        toast.success('Debt updated');
      } else {
        await axios.post(`${API}/debts`, payload);
        toast.success('Debt added');
      }
      setModalOpen(false);
      fetchDebts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setPaymentLoading(true);
    try {
      await axios.post(`${API}/debts/${paymentForm.debt_id}/payments`, {
        amount: parseFloat(paymentForm.amount)
      });
      toast.success('Payment recorded');
      setPaymentModal(false);
      setPaymentForm({ debt_id: '', amount: '' });
      fetchDebts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record payment');
    } finally { setPaymentLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this debt?')) return;
    try {
      await axios.delete(`${API}/debts/${id}`);
      toast.success('Debt deleted');
      fetchDebts();
    } catch { toast.error('Failed to delete'); }
  };

  const safeArray = Array.isArray(debts) ? debts : [];
  const totalRemaining = safeArray.reduce((s, d) => s + (d.remaining_amount || 0), 0);
  const totalPaid = safeArray.reduce((s, d) => s + ((d.principal || 0) - (d.remaining_amount || 0)), 0);

  return (
    <div className="space-y-5" data-testid="debts-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('debts.title')}
        </h1>
        <button onClick={openAdd} data-testid="add-debt-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
        >
          <Plus size={15} />
          {t('debts.addDebt')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Total Remaining</p>
          <p className="text-[#EF4444] font-bold tabular-nums text-xl">{fmt(totalRemaining)} SEK</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Total Paid</p>
          <p className="text-[#10B981] font-bold tabular-nums text-xl">{fmt(totalPaid)} SEK</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Active Debts</p>
          <p className="text-white font-bold text-xl">{safeArray.length}</p>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...DEBT_TYPES].map(type => (
          <button key={type} onClick={() => setActiveType(type)}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold capitalize transition-all ${
              activeType === type
                ? 'bg-[#4FC3C3]/20 text-[#4FC3C3] border border-[#4FC3C3]/40'
                : 'bg-[#1A1A1A] text-[#A3A3A3] border border-[#2A2A2A] hover:text-white hover:border-[#4FC3C3]/20'
            }`}
          >
            {TYPE_ICONS[type] || ''} {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Debt Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-48 rounded-sm" />)}
        </div>
      ) : safeArray.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-12 flex flex-col items-center gap-3">
          <Wallet size={36} className="text-[#2A2A2A]" />
          <p className="text-[#6B6B6B] text-sm">{t('debts.noDebts')}</p>
          <button onClick={openAdd} className="text-[#4FC3C3] text-xs font-semibold hover:underline">{t('debts.addDebt')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="debt-cards">
          {safeArray.map(d => {
            const color = TYPE_COLORS[d.type] || '#6B7280';
            const progress = d.principal > 0 ? ((d.principal - d.remaining_amount) / d.principal * 100) : 0;
            const isOverdue = d.due_date && new Date(d.due_date) < new Date();
            return (
              <div key={d.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5 hover:border-[#4FC3C3]/30 transition-all duration-200 group relative"
                data-testid={`debt-card-${d.id}`}
              >
                {isOverdue && <div className="absolute top-2 right-2 px-2 py-1 rounded-sm bg-[#EF4444]/20 text-[#EF4444] text-xs font-bold">OVERDUE</div>}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xl">{TYPE_ICONS[d.type]}</span>
                    <div>
                      <p className="text-white text-sm font-bold">{d.creditor}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-sm" style={{ background: `${color}20`, color }}>
                        {d.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setPaymentForm({ debt_id: d.id, amount: '' }); setPaymentModal(true); }} className="text-[#6B6B6B] hover:text-[#10B981] p-1 transition-colors">
                      <CheckCircle2 size={13} />
                    </button>
                    <button onClick={() => openEdit(d)} className="text-[#6B6B6B] hover:text-[#4FC3C3] p-1 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="text-[#6B6B6B] hover:text-[#EF4444] p-1 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex items-end justify-between mb-1">
                      <p className="text-[#6B6B6B] text-xs">Remaining</p>
                      <span className="text-xs text-[#A3A3A3]">{progress.toFixed(0)}% paid</span>
                    </div>
                    <p className="text-white font-bold tabular-nums text-lg">{fmt(d.remaining_amount)} <span className="text-sm text-[#A3A3A3]">{d.currency}</span></p>
                  </div>

                  <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#10B981] transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {d.due_date && (
                  <p className="text-xs text-[#6B6B6B] mt-2">Due: {new Date(d.due_date).toLocaleDateString('sv-SE')}</p>
                )}
                {d.interest_rate > 0 && (
                  <p className="text-xs text-[#6B6B6B] mt-1">Interest: {d.interest_rate}%</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md" data-testid="debt-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {editing ? t('debts.editDebt') : t('debts.addDebt')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Debt Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              >
                {DEBT_TYPES.map(tp => <option key={tp} value={tp} className="bg-[#1A1A1A]">{TYPE_ICONS[tp]} {tp.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Creditor Name</label>
              <input type="text" value={form.creditor} onChange={e => setForm(f => ({ ...f, creditor: e.target.value }))}
                placeholder="e.g. Bank of Sweden" required data-testid="creditor-input"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Principal (SEK)</label>
                <input type="number" value={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.value }))}
                  placeholder="0" required min="0" step="0.01" data-testid="principal-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Remaining (SEK)</label>
                <input type="number" value={form.remaining_amount} onChange={e => setForm(f => ({ ...f, remaining_amount: e.target.value }))}
                  placeholder="0" required min="0" step="0.01" data-testid="remaining-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Interest Rate (%) - Optional</label>
              <input type="number" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                placeholder="0" min="0" step="0.01"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Due Date - Optional</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving} data-testid="save-debt-btn"
                className="flex-1 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentModal} onOpenChange={setPaymentModal}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Payment Amount (SEK)</label>
              <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" required min="0.01" step="0.01"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setPaymentModal(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={paymentLoading}
                className="flex-1 py-2 rounded-sm bg-[#10B981] text-white text-sm font-bold hover:bg-[#059669] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {paymentLoading && <Loader2 size={13} className="animate-spin" />}
                Record Payment
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
