import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Loader2, CreditCard, Calculator } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const DEBT_TYPES = ['mortgage','student_loan','car_loan','credit_card','other'];
const TYPE_COLORS = { mortgage: '#8B5CF6', student_loan: '#3B82F6', car_loan: '#F59E0B', credit_card: '#EF4444', other: '#6B7280' };
const TYPE_LABELS = { mortgage: 'Mortgage', student_loan: 'Student Loan', car_loan: 'Car Loan', credit_card: 'Credit Card', other: 'Other' };

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const today = () => new Date().toISOString().split('T')[0];

const EMPTY_DEBT = { name: '', type: 'mortgage', total_amount: '', remaining_amount: '', interest_rate: '', monthly_payment: '', currency: 'SEK' };

function calcPayoff(principal, annualRate, monthlyPayment) {
  const monthlyRate = (annualRate / 100) / 12;
  const schedule = [];
  let remaining = principal;
  for (let i = 0; i < 360 && remaining > 0; i++) {
    const interest = remaining * monthlyRate;
    const principalPaid = Math.min(monthlyPayment - interest, remaining);
    if (principalPaid <= 0) break;
    remaining = Math.max(0, remaining - principalPaid);
    if ((i + 1) % 12 === 0 || remaining === 0) {
      schedule.push({ year: Math.ceil((i + 1) / 12), balance: Math.round(remaining) });
    }
  }
  return schedule;
}

export default function Debts() {
  const { t } = useLanguage();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debtModal, setDebtModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [form, setForm] = useState(EMPTY_DEBT);
  const [payForm, setPayForm] = useState({ amount: '', date: today(), note: '' });
  const [saving, setSaving] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calc, setCalc] = useState({ principal: 100000, rate: 5, payment: 1000 });
  const [schedule, setSchedule] = useState([]);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/debts`);
      setDebts(res.data);
    } catch { toast.error('Failed to load debts'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const openAdd = () => { setEditing(null); setForm(EMPTY_DEBT); setDebtModal(true); };
  const openEdit = (d) => {
    setEditing(d);
    setForm({ name: d.name, type: d.type, total_amount: d.total_amount, remaining_amount: d.remaining_amount, interest_rate: d.interest_rate, monthly_payment: d.monthly_payment, currency: d.currency || 'SEK' });
    setDebtModal(true);
  };

  const openPayment = (d) => {
    setSelectedDebt(d);
    setPayForm({ amount: d.monthly_payment, date: today(), note: '' });
    setPayModal(true);
  };

  const handleSaveDebt = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        total_amount: parseFloat(form.total_amount),
        remaining_amount: parseFloat(form.remaining_amount),
        interest_rate: parseFloat(form.interest_rate),
        monthly_payment: parseFloat(form.monthly_payment),
      };
      if (editing) {
        await axios.put(`${API}/debts/${editing.id}`, payload);
        toast.success('Debt updated');
      } else {
        await axios.post(`${API}/debts`, payload);
        toast.success('Debt added');
      }
      setDebtModal(false);
      fetchDebts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/debts/${selectedDebt.id}/payment`, {
        amount: parseFloat(payForm.amount),
        date: payForm.date,
        note: payForm.note || null
      });
      toast.success('Payment recorded');
      setPayModal(false);
      fetchDebts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this debt?')) return;
    try {
      await axios.delete(`${API}/debts/${id}`);
      toast.success('Debt deleted');
      fetchDebts();
    } catch { toast.error('Failed to delete'); }
  };

  const runCalc = () => {
    const s = calcPayoff(calc.principal, calc.rate, calc.payment);
    setSchedule(s);
  };

  const totalDebt = debts.reduce((s, d) => s + d.remaining_amount, 0);
  const totalMonthly = debts.reduce((s, d) => s + d.monthly_payment, 0);
  const avgInterest = debts.length > 0 ? debts.reduce((s, d) => s + d.interest_rate, 0) / debts.length : 0;

  return (
    <div className="space-y-5" data-testid="debts-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('debts.title')}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCalcOpen(true)} data-testid="calculator-btn"
            className="flex items-center gap-2 px-3 py-2 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:text-white hover:border-[#4FC3C3]/30 transition-all"
          >
            <Calculator size={15} />
            {t('debts.calculator')}
          </button>
          <button onClick={openAdd} data-testid="add-debt-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
          >
            <Plus size={15} />
            {t('debts.addDebt')}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('debts.totalDebt'), val: `${fmt(totalDebt)} SEK`, color: '#EF4444' },
          { label: t('debts.monthlyPayments'), val: `${fmt(totalMonthly)} SEK`, color: '#F59E0B' },
          { label: t('debts.interestRate'), val: `${avgInterest.toFixed(1)}%`, color: '#A3A3A3' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
            <p className="text-[#6B6B6B] text-xs mb-1">{label}</p>
            <p className="font-bold tabular-nums text-xl" style={{ color }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Debt Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="skeleton h-36 rounded-sm" />)}
        </div>
      ) : debts.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-12 flex flex-col items-center gap-3">
          <CreditCard size={36} className="text-[#2A2A2A]" />
          <p className="text-[#6B6B6B] text-sm">{t('debts.noDebts')}</p>
          <button onClick={openAdd} className="text-[#4FC3C3] text-xs font-semibold hover:underline">{t('debts.addDebt')}</button>
        </div>
      ) : (
        <div className="space-y-3" data-testid="debt-cards">
          {debts.map(d => {
            const paid = d.total_amount - d.remaining_amount;
            const pct = d.total_amount > 0 ? Math.round((paid / d.total_amount) * 100) : 0;
            const color = TYPE_COLORS[d.type] || '#6B7280';
            return (
              <div key={d.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5 hover:border-[#4FC3C3]/30 transition-all group"
                data-testid={`debt-card-${d.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-bold">{d.name}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-sm" style={{ background: `${color}20`, color }}>
                      {TYPE_LABELS[d.type] || d.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(d)} className="text-[#6B6B6B] hover:text-[#4FC3C3] p-1 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="text-[#6B6B6B] hover:text-[#EF4444] p-1 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className="text-[#6B6B6B] text-xs">Remaining</p>
                    <p className="text-white font-bold tabular-nums text-xl">{fmt(d.remaining_amount)} <span className="text-sm text-[#A3A3A3]">SEK</span></p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[#6B6B6B] text-xs">Rate: <span className="text-[#A3A3A3]">{d.interest_rate}%</span></p>
                    <p className="text-[#6B6B6B] text-xs">Monthly: <span className="text-[#A3A3A3] tabular-nums">{fmt(d.monthly_payment)} SEK</span></p>
                  </div>
                </div>

                <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-[#4FC3C3] transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6B6B]">{pct}% paid · {fmt(paid)} SEK paid</span>
                  <button onClick={() => openPayment(d)} data-testid={`pay-debt-${d.id}`}
                    className="px-3 py-1 rounded-sm bg-[#4FC3C3]/10 text-[#4FC3C3] text-xs font-bold hover:bg-[#4FC3C3]/20 border border-[#4FC3C3]/30 transition-all"
                  >
                    {t('debts.makePayment')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Debt Calculator Modal */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-lg" data-testid="calc-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {t('debts.calculator')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Principal (SEK)</label>
                <input type="number" value={calc.principal} onChange={e => setCalc(c => ({ ...c, principal: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Rate (%)</label>
                <input type="number" value={calc.rate} onChange={e => setCalc(c => ({ ...c, rate: parseFloat(e.target.value) || 0 }))}
                  step="0.1"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Payment/mo</label>
                <input type="number" value={calc.payment} onChange={e => setCalc(c => ({ ...c, payment: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
            </div>
            <button onClick={runCalc} className="w-full py-2 bg-[#4FC3C3] text-[#0A0A0A] font-bold text-sm rounded-sm hover:bg-[#3AA8A8] transition-all">
              Calculate Payoff
            </button>
            {schedule.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-[#A3A3A3]">Payoff in <span className="text-white font-bold">{schedule.length} years</span></p>
                  <p className="text-xs text-[#A3A3A3]">Total paid: <span className="text-white font-bold tabular-nums">{fmt(calc.payment * schedule.length * 12)} SEK</span></p>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={schedule} margin={{ left: -20, right: 5, top: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `Yr ${v}`} />
                    <YAxis tick={{ fill: '#6B6B6B', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '2px', fontSize: 11 }}
                      formatter={(v) => [`${fmt(v)} SEK`, 'Balance']} />
                    <Area type="monotone" dataKey="balance" stroke="#EF4444" fill="rgba(239,68,68,0.1)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Debt Modal */}
      <Dialog open={debtModal} onOpenChange={setDebtModal}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md" data-testid="debt-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {editing ? t('debts.editDebt') : t('debts.addDebt')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveDebt} className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Debt Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Home Mortgage, Student Loan" required data-testid="debt-name-input"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              >
                {DEBT_TYPES.map(tp => <option key={tp} value={tp} className="bg-[#1A1A1A]">{TYPE_LABELS[tp]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Total Amount</label>
                <input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                  placeholder="0" required min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Remaining</label>
                <input type="number" value={form.remaining_amount} onChange={e => setForm(f => ({ ...f, remaining_amount: e.target.value }))}
                  placeholder="0" required min="0" step="0.01" data-testid="remaining-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Interest Rate %</label>
                <input type="number" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                  placeholder="5.0" required min="0" step="0.1"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Monthly Payment</label>
                <input type="number" value={form.monthly_payment} onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value }))}
                  placeholder="0" required min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setDebtModal(false)}
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
      <Dialog open={payModal} onOpenChange={setPayModal}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-sm" data-testid="payment-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {t('debts.makePayment')}
            </DialogTitle>
          </DialogHeader>
          {selectedDebt && (
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="bg-[#0A0A0A] rounded-sm p-3 border border-[#2A2A2A]">
                <p className="text-white text-sm font-semibold">{selectedDebt.name}</p>
                <p className="text-[#6B6B6B] text-xs">Remaining: {fmt(selectedDebt.remaining_amount)} SEK</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Payment Amount (SEK)</label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  required min="0" step="0.01" data-testid="payment-amount-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Payment Date</label>
                <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))}
                  required className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] [color-scheme:dark]"
                />
              </div>
              {payForm.amount && (
                <p className="text-xs text-[#A3A3A3]">
                  New remaining: <span className="text-white font-bold tabular-nums">{fmt(Math.max(0, selectedDebt.remaining_amount - parseFloat(payForm.amount)))} SEK</span>
                </p>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setPayModal(false)}
                  className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving} data-testid="confirm-payment-btn"
                  className="flex-1 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
