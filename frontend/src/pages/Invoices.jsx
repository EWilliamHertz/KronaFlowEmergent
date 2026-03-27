import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, DollarSign, Check, Loader2, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { extractArray } from '../utils/apiHelpers';
import { toast } from 'sonner';
import { API } from '../config/api';

const STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
const STATUS_COLORS = {
  draft: '#6B7280', sent: '#4FC3C3', paid: '#10B981', overdue: '#EF4444', cancelled: '#6B7280'
};
const STATUS_ICONS = {
  draft: '📑', sent: '✈️', paid: '✓️', overdue: '⚠️', cancelled: '❌'
};

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const EMPTY = { invoice_number: '', client_name: '', amount: '', due_date: '', status: 'draft', currency: 'SEK', description: '' };

export default function Invoices() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeStatus !== 'all' ? { status: activeStatus } : {};
      const res = await axios.get(`${API}/invoices`, { params });
      setInvoices(extractArray(res.data, 'invoices'));
    } catch (err) { 
      console.error('Failed to load invoices:', err);
      toast.error('Failed to load invoices'); 
    }
    finally { setLoading(false); }
  }, [activeStatus]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (inv) => {
    setEditing(inv);
    setForm({
      invoice_number: inv.invoice_number,
      client_name: inv.client_name,
      amount: inv.amount,
      due_date: inv.due_date || '',
      status: inv.status || 'draft',
      currency: inv.currency || 'SEK',
      description: inv.description || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        client_name: form.client_name,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: form.due_date || new Date().toISOString().split('T')[0],
        // Backend requires an "items" array with these specific keys:
        items: [{
          description: form.description || "Service Rendered",
          quantity: 1,
          unit_price: parseFloat(form.amount),
          vat_pct: 25.0
        }],
        currency: form.currency || 'SEK',
        notes: form.description || ''
      };    
        if (editing) {
        await axios.put(`${API}/invoices/${editing.id}`, payload);
        toast.success('Invoice updated');
      } else {
        await axios.post(`${API}/invoices`, payload);
        toast.success('Invoice created');
      }
      setModalOpen(false);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.patch(`${API}/invoices/${id}`, { status: newStatus });
      toast.success('Invoice status updated');
      fetchInvoices();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await axios.delete(`${API}/invoices/${id}`);
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch { toast.error('Failed to delete'); }
  };

  const safeArray = Array.isArray(invoices) ? invoices : [];
  const statuses = ['all', ...STATUSES];
  const filtered = activeStatus === 'all' ? safeArray : safeArray.filter(inv => inv.status === activeStatus);
  const totalAmount = filtered.reduce((s, inv) => s + (inv.amount || 0), 0);
  const paidAmount = filtered.filter(inv => inv.status === 'paid').reduce((s, inv) => s + (inv.amount || 0), 0);

  return (
    <div className="space-y-5" data-testid="invoices-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('invoices.title')}
        </h1>
        <button onClick={openAdd} data-testid="create-invoice-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
        >
          <Plus size={15} />
          {t('invoices.createInvoice')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Total Amount</p>
          <p className="text-white font-bold tabular-nums text-xl">{fmt(totalAmount)} SEK</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Paid</p>
          <p className="text-[#10B981] font-bold tabular-nums text-xl">{fmt(paidAmount)} SEK</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Total Invoices</p>
          <p className="text-white font-bold text-xl">{filtered.length}</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map(status => {
          const count = status === 'all' ? safeArray.length : safeArray.filter(inv => inv.status === status).length;
          return (
            <button key={status} onClick={() => setActiveStatus(status)}
              className={`px-3 py-1.5 rounded-sm text-xs font-semibold capitalize transition-all ${
                activeStatus === status
                  ? 'bg-[#4FC3C3]/20 text-[#4FC3C3] border border-[#4FC3C3]/40'
                  : 'bg-[#1A1A1A] text-[#A3A3A3] border border-[#2A2A2A] hover:text-white hover:border-[#4FC3C3]/20'
              }`}
            >
              {STATUS_ICONS[status] || ''} {status} ({count})
            </button>
          );
        })}
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-sm" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-12 flex flex-col items-center gap-3">
          <FileText size={36} className="text-[#2A2A2A]" />
          <p className="text-[#6B6B6B] text-sm">{t('invoices.noInvoices')}</p>
          <button onClick={openAdd} className="text-[#4FC3C3] text-xs font-semibold hover:underline">{t('invoices.createInvoice')}</button>
        </div>
      ) : (
        <div className="overflow-x-auto" data-testid="invoices-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A2A]">
                <th className="text-left px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Invoice #</th>
                <th className="text-left px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Client</th>
                <th className="text-left px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Amount</th>
                <th className="text-left px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Status</th>
                <th className="text-left px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Due Date</th>
                <th className="text-right px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="border-b border-[#2A2A2A] hover:bg-[#4FC3C3]/5 transition-colors group"
                  data-testid={`invoice-row-${inv.id}`}
                >
                  <td className="px-4 py-3 text-white font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-white text-sm">{inv.client_name}</td>
                  <td className="px-4 py-3 text-white font-bold tabular-nums">{fmt(inv.amount)} {inv.currency}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-sm text-xs font-semibold capitalize" 
                      style={{ background: `${STATUS_COLORS[inv.status]}20`, color: STATUS_COLORS[inv.status] }}
                    >
                      {STATUS_ICONS[inv.status]} {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#A3A3A3] text-xs">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString('sv-SE') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {inv.status !== 'paid' && (
                        <button onClick={() => handleStatusChange(inv.id, 'paid')} 
                          className="text-[#6B6B6B] hover:text-[#10B981] transition-colors" title="Mark as Paid">
                          <Check size={13} />
                        </button>
                      )}
                      <button onClick={() => openEdit(inv)} className="text-[#6B6B6B] hover:text-[#4FC3C3] transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(inv.id)} className="text-[#6B6B6B] hover:text-[#EF4444] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md" data-testid="invoice-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {editing ? t('invoices.editInvoice') : t('invoices.createInvoice')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Invoice Number</label>
              <input type="text" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                placeholder="INV-2024-001" required data-testid="invoice-number-input"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Client Name</label>
              <input type="text" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                placeholder="e.g. Acme Corp" required data-testid="client-input"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Amount (SEK)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" required min="0" step="0.01" data-testid="amount-input"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              >
                {STATUSES.map(st => <option key={st} value={st} className="bg-[#1A1A1A]">{STATUS_ICONS[st]} {st}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Due Date - Optional</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Description - Optional</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Notes..." rows={2}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B] resize-none"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving} data-testid="save-invoice-btn"
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
