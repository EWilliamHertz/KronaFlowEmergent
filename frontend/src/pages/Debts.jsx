import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, CheckCircle2, Loader2, Wallet, TrendingDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { API } from '../config/api';

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
  personal_loan: '🏦',
  credit_card: '💳',
  mortgage: '🏠',
  student_loan: '🎓',
  car_loan: '🚗',
  other: '📁'
};

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const EMPTY = { 
  type: 'personal_loan', 
  name: '', 
  total_amount: '', 
  interest_rate: '0', 
  remaining_amount: '', 
  currency: 'SEK', 
  monthly_payment: '' 
};

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
  const [paymentForm, setPaymentForm] = useState({ debt_id: '', amount: '', date: new Date().toISOString().split('T')[0] });
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  // Debt Details State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [debtTransactions, setDebtTransactions] = useState([]);
  const [debtTransLoading, setDebtTransLoading] = useState(false);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const params = activeType !== 'all' ? { type: activeType } : {};
      const res = await axios.get(`${API}/debts`, { 
        params,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let data = res.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data = data.debts || data.data || [];
      }
      if (!Array.isArray(data)) data = [];
      setDebts(data);
    } catch (err) { 
      toast.error('Failed to load debts'); 
      setDebts([]);
    }
    finally { setLoading(false); }
  }, [activeType]);

  const fetchDebtTransactions = useCallback(async (debtId) => {
    setDebtTransLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await axios.get(`${API}/debts/${debtId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const trans = res.data.history || [];
      setDebtTransactions(trans);
    } catch (err) {
      console.error('Failed to load debt transactions:', err);
      setDebtTransactions([]);
    } finally {
      setDebtTransLoading(false);
    }
  }, []);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  
  const openEdit = (d, e) => {
    if (e) e.stopPropagation();
    setEditing(d);
    setForm({
      type: d.type,
      name: d.name,
      total_amount: d.total_amount,
      interest_rate: d.interest_rate || '0',
      remaining_amount: d.remaining_amount,
      currency: d.currency || 'SEK',
      monthly_payment: d.monthly_payment || ''
    });
    setModalOpen(true);
  };

  const openPayment = (id, e) => {
    if (e) e.stopPropagation();
    setPaymentForm({ ...paymentForm, debt_id: id });
    setPaymentModal(true);
  };

  const openDetails = (d) => {
    setSelectedDebt(d);
    setDetailModalOpen(true);
    fetchDebtTransactions(d.id);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      const payload = {
        ...form,
        total_amount: parseFloat(form.total_amount) || 0,
        remaining_amount: parseFloat(form.remaining_amount) || 0,
        interest_rate: parseFloat(form.interest_rate) || 0,
        monthly_payment: parseFloat(form.monthly_payment) || 0
      };
      
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      
      if (editing) {
        await axios.put(`${API}/debts/${editing.id}`, payload, config);
        toast.success('Debt updated');
      } else {
        await axios.post(`${API}/debts`, payload, config);
        toast.success('Debt added');
      }
      setModalOpen(false);
      fetchDebts();
      
      if (detailModalOpen && selectedDebt && (selectedDebt.id === editing?.id)) {
        const res = await axios.get(`${API}/debts/${editing.id}`, config);
        setSelectedDebt(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setPaymentLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      await axios.post(`${API}/debts/${paymentForm.debt_id}/transaction`, {
        amount: parseFloat(paymentForm.amount),
        action: "payment",
        date: paymentForm.date,
        note: "Debt payment recorded from dashboard"
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Payment recorded');
      setPaymentModal(false);
      setPaymentForm({ debt_id: '', amount: '', date: new Date().toISOString().split('T')[0] });
      fetchDebts();
      
      if (detailModalOpen && selectedDebt && selectedDebt.id === paymentForm.debt_id) {
        fetchDebtTransactions(paymentForm.debt_id);
        const res = await axios.get(`${API}/debts/${paymentForm.debt_id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        setSelectedDebt(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record payment');
    } finally { setPaymentLoading(false); }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this debt?')) return;
    try {
      const token = localStorage.getItem('session_token');
      await axios.delete(`${API}/debts/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Debt deleted');
      fetchDebts();
      if (detailModalOpen && selectedDebt && selectedDebt.id === id) {
        setDetailModalOpen(false);
      }
    } catch { toast.error('Failed to delete'); }
  };

  const safeArray = Array.isArray(debts) ? debts : [];
  const totalRemaining = safeArray.reduce((s, d) => s + (d.remaining_amount || 0), 0);
  const totalPaid = safeArray.reduce((s, d) => s + ((d.total_amount || 0) - (d.remaining_amount || 0)), 0);

  return (
    <div className="space-y-5" data-testid="debts-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('debts.title') || 'Debts'}
        </h1>
        <button onClick={openAdd} data-testid="add-debt-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
        >
          <Plus size={15} />
          {t('debts.addDebt') || 'Add Debt'}
        </button>
      </div>

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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-48 rounded-sm" />)}
        </div>
      ) : safeArray.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-12 flex flex-col items-center gap-3">
          <Wallet size={36} className="text-[#2A2A2A]" />
          <p className="text-[#6B6B6B] text-sm">{t('debts.noDebts') || 'No debts found.'}</p>
          <button onClick={openAdd} className="text-[#4FC3C3] text-xs font-semibold hover:underline">{t('debts.addDebt') || 'Add one now'}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="debt-cards">
          {safeArray.map(d => {
            const color = TYPE_COLORS[d.type] || '#6B7280';
            const progress = d.total_amount > 0 ? ((d.total_amount - d.remaining_amount) / d.total_amount * 100) : 0;
            return (
              <div key={d.id} 
                onClick={() => openDetails(d)}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5 hover:border-[#4FC3C3]/30 transition-all duration-200 group relative cursor-pointer flex flex-col justify-between"
                data-testid={`debt-card-${d.id}`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xl">{TYPE_ICONS[d.type]}</span>
                      <div>
                        <p className="text-white text-sm font-bold">{d.name}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-sm" style={{ background: `${color}20`, color }}>
                          {d.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => openPayment(d.id, e)} className="text-[#6B6B6B] hover:text-[#10B981] p-1 transition-colors" title="Record Payment">
                        <CheckCircle2 size={13} />
                      </button>
                      <button onClick={(e) => openEdit(d, e)} className="text-[#6B6B6B] hover:text-[#4FC3C3] p-1 transition-colors" title="Edit Debt">
                        <Pencil size={13} />
                      </button>
                      <button onClick={(e) => handleDelete(d.id, e)} className="text-[#6B6B6B] hover:text-[#EF4444] p-1 transition-colors">
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
                </div>

                {/* CRASH-PROOF DEBT FREE PROJECTOR ON CARD */}
                {(() => {
                  if (!d.monthly_payment || d.monthly_payment <= 0) {
                    return (
                      <div className="mt-5 pt-3 border-t border-[#2A2A2A]">
                        <button onClick={(e) => openEdit(d, e)} className="text-xs text-[#4FC3C3] hover:underline flex items-center gap-1">
                          Set monthly payment to see date &rarr;
                        </button>
                      </div>
                    );
                  }

                  const P = parseFloat(d.remaining_amount) || 0;
                  const PMT = parseFloat(d.monthly_payment);
                  const r = (parseFloat(d.interest_rate) || 0) / 100 / 12;
                  let months = 0;
                  
                  if (P <= 0) {
                     return <p className="text-xs text-[#10B981] font-bold mt-5 pt-3 border-t border-[#2A2A2A]">🎉 Debt fully paid!</p>;
                  } else if (r === 0) {
                    months = Math.ceil(P / PMT);
                  } else if ((P * r) >= PMT) {
                    return <p className="text-xs text-[#EF4444] font-bold mt-5 pt-3 border-t border-[#2A2A2A]">Payment too low to cover interest!</p>;
                  } else {
                    months = Math.ceil(-Math.log(1 - (P * r) / PMT) / Math.log(1 + r));
                  }
                  
                  if (isNaN(months) || !isFinite(months) || months < 0) months = 0;

                  const payoffDate = new Date();
                  payoffDate.setMonth(payoffDate.getMonth() + months);
                  const formattedDate = payoffDate.toLocaleDateString('en-SE', { month: 'short', year: 'numeric' });
                  
                  return (
                    <div className="mt-5 pt-3 border-t border-[#2A2A2A]">
                      <p className="text-[10px] text-[#A3A3A3] uppercase tracking-widest font-bold mb-1">Debt-Free Projection</p>
                      <div className="flex items-end justify-between">
                        <p className="text-sm font-black text-[#4FC3C3]">🎯 {formattedDate}</p>
                        <p className="text-[#6B6B6B] text-[10px]">At {fmt(PMT)}/mo ({months} mos)</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Debt Details Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedDebt && (
            <>
              <DialogHeader className="mb-4">
                <div className="flex items-center justify-between pr-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center text-2xl">
                      {TYPE_ICONS[selectedDebt.type]}
                    </div>
                    <div>
                      <DialogTitle className="text-white font-black text-xl tracking-tight">
                        {selectedDebt.name}
                      </DialogTitle>
                      <span className="text-xs px-1.5 py-0.5 rounded-sm capitalize" 
                        style={{ 
                          background: `${TYPE_COLORS[selectedDebt.type] || '#6B7280'}20`, 
                          color: TYPE_COLORS[selectedDebt.type] || '#6B7280' 
                        }}>
                        {selectedDebt.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-3">
                  <p className="text-[#6B6B6B] text-[10px] uppercase font-bold mb-1">Total Loan</p>
                  <p className="text-white font-semibold text-sm tabular-nums">{fmt(selectedDebt.total_amount)} {selectedDebt.currency}</p>
                </div>
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-3">
                  <p className="text-[#6B6B6B] text-[10px] uppercase font-bold mb-1">Remaining</p>
                  <p className="text-[#EF4444] font-semibold text-sm tabular-nums">{fmt(selectedDebt.remaining_amount)} {selectedDebt.currency}</p>
                </div>
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-3">
                  <p className="text-[#6B6B6B] text-[10px] uppercase font-bold mb-1">Interest Rate</p>
                  <p className="text-white font-semibold text-sm tabular-nums">{selectedDebt.interest_rate}%</p>
                </div>
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-3">
                  <p className="text-[#6B6B6B] text-[10px] uppercase font-bold mb-1">Monthly Pay</p>
                  <p className="text-white font-semibold text-sm tabular-nums">{fmt(selectedDebt.monthly_payment)} {selectedDebt.currency}</p>
                </div>
              </div>

              {/* CRASH-PROOF DEBT FREE PROJECTOR IN MODAL */}
              <div className="bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] border border-[#4FC3C3]/30 rounded-sm p-5 relative overflow-hidden group mb-6">
                <TrendingDown size={64} className="absolute top-0 right-0 p-4 opacity-10 text-[#4FC3C3] group-hover:opacity-20 transition-opacity" />
                <p className="text-[#4FC3C3] text-xs font-bold uppercase tracking-widest mb-1">Debt-Free Projection</p>
                
                {(!selectedDebt.monthly_payment || selectedDebt.monthly_payment <= 0) ? (
                  <div className="mt-2">
                    <p className="text-[#A3A3A3] text-sm">Configure a <span className="text-white font-bold">Monthly Payment</span> to see when you'll be debt-free!</p>
                    <button onClick={(e) => { setDetailModalOpen(false); openEdit(selectedDebt, e); }} className="mt-3 text-xs bg-[#4FC3C3]/10 text-[#4FC3C3] px-3 py-1.5 rounded-sm hover:bg-[#4FC3C3]/20 font-bold transition-colors">
                      Set Monthly Payment
                    </button>
                  </div>
                ) : (
                  (() => {
                    const P = parseFloat(selectedDebt.remaining_amount) || 0;
                    const PMT = parseFloat(selectedDebt.monthly_payment);
                    const r = (parseFloat(selectedDebt.interest_rate) || 0) / 100 / 12;
                    let months = 0;
                    
                    if (P <= 0) {
                      return <p className="text-white font-black text-2xl mt-2">🎉 Debt fully paid!</p>;
                    } else if (r === 0) {
                      months = Math.ceil(P / PMT);
                    } else if ((P * r) >= PMT) {
                      return <p className="text-[#EF4444] font-bold mt-2">Monthly payment too low to cover interest!</p>;
                    } else {
                      months = Math.ceil(-Math.log(1 - (P * r) / PMT) / Math.log(1 + r));
                    }
                    
                    if (isNaN(months) || !isFinite(months) || months < 0) months = 0;
                    
                    const payoffDate = new Date();
                    payoffDate.setMonth(payoffDate.getMonth() + months);
                    const formattedDate = payoffDate.toLocaleDateString('en-SE', { month: 'long', year: 'numeric' });
                    
                    return (
                      <div className="mt-2">
                        <h3 className="text-white font-black text-2xl mb-1 tracking-tight">🎯 {formattedDate}</h3>
                        <p className="text-[#A3A3A3] text-sm">
                          At {fmt(PMT)}/mo, you will be completely debt-free in <span className="text-white font-bold">{months} months</span>.
                        </p>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">Payment Progress</span>
                  <span className="text-sm text-[#10B981] font-bold">
                    {selectedDebt.total_amount > 0 
                      ? ((selectedDebt.total_amount - selectedDebt.remaining_amount) / selectedDebt.total_amount * 100).toFixed(1) 
                      : 0}% Paid
                  </span>
                </div>
                <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#10B981] transition-all duration-500" 
                    style={{ width: `${selectedDebt.total_amount > 0 ? (selectedDebt.total_amount - selectedDebt.remaining_amount) / selectedDebt.total_amount * 100 : 0}%` }} 
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-[#6B6B6B]">
                  <span>{fmt(selectedDebt.total_amount - selectedDebt.remaining_amount)} {selectedDebt.currency} paid</span>
                  <span>{fmt(selectedDebt.total_amount)} {selectedDebt.currency} total</span>
                </div>
              </div>

              {/* History Table */}
              <div className="border-t border-[#2A2A2A] pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">Transaction History</h3>
                  <button onClick={() => openPayment(selectedDebt.id)} className="text-xs bg-[#4FC3C3]/10 text-[#4FC3C3] px-3 py-1 rounded-sm hover:bg-[#4FC3C3]/20 font-bold transition-colors">
                    + Record Payment
                  </button>
                </div>
                
                {debtTransLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-[#4FC3C3]" />
                  </div>
                ) : debtTransactions.length === 0 ? (
                  <div className="text-center py-8 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm">
                    <p className="text-[#6B6B6B] text-sm">No payments recorded yet.</p>
                  </div>
                ) : (
                  <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#2A2A2A]">
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">Date</th>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">Amount</th>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">Action</th>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debtTransactions.map((trans, idx) => (
                          <tr key={idx} className="border-b border-[#2A2A2A] hover:bg-[#1A1A1A]/50 transition-colors">
                            <td className="px-4 py-3 text-xs text-[#A3A3A3]">{trans.date || '—'}</td>
                            <td className="px-4 py-3 text-xs font-bold text-[#10B981]">{fmt(trans.amount)} {trans.currency || selectedDebt.currency}</td>
                            <td className="px-4 py-3 text-xs capitalize">
                              <span className="px-2 py-0.5 rounded-sm bg-[#4FC3C3]/10 text-[#4FC3C3]">
                                {trans.type || 'payment'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#6B6B6B]">{trans.description || trans.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-bold">{editing ? 'Edit Debt' : 'Add Debt'}</DialogTitle>
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
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Name / Creditor</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bank of Sweden" required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Total Amount</label>
                <input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                  placeholder="0" required min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Remaining</label>
                <input type="number" value={form.remaining_amount} onChange={e => setForm(f => ({ ...f, remaining_amount: e.target.value }))}
                  placeholder="0" required min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Interest Rate (%)</label>
                <input type="number" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                  placeholder="0" min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Monthly Payment</label>
                <input type="number" value={form.monthly_payment} onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value }))}
                  placeholder="0" min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                Save Debt
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentModal} onOpenChange={setPaymentModal}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white font-bold">Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Payment Amount (SEK)</label>
              <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" required min="0.01" step="0.01"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              />
            </div>
             <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Date</label>
              <input type="date" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                required className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] [color-scheme:dark]"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setPaymentModal(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                Cancel
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