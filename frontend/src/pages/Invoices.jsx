import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Loader2, FileText, Send, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const STATUS_STYLES = {
  draft:   { bg: 'bg-[#6B7280]/20', text: 'text-[#A3A3A3]', label: 'Draft' },
  sent:    { bg: 'bg-[#3B82F6]/20', text: 'text-[#3B82F6]', label: 'Sent' },
  paid:    { bg: 'bg-[#10B981]/20', text: 'text-[#10B981]', label: 'Paid' },
  overdue: { bg: 'bg-[#EF4444]/20', text: 'text-[#EF4444]', label: 'Overdue' },
};

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const today = () => new Date().toISOString().split('T')[0];

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: '', vat_pct: 25 };

export default function Invoices() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_address: '',
    issue_date: today(), due_date: '', currency: 'SEK', notes: '',
    items: [{ ...EMPTY_ITEM }]
  });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const res = await axios.get(`${API}/invoices`, { params });
      setInvoices(res.data);
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const updateItem = (i, field, val) => setForm(f => ({
    ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item)
  }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const calcTotals = () => {
    const subtotal = form.items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
    const vat = form.items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0) * (parseFloat(it.vat_pct) || 0) / 100, 0);
    return { subtotal, vat, total: subtotal + vat };
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/invoices`, {
        ...form,
        items: form.items.map(it => ({
          description: it.description,
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          vat_pct: parseFloat(it.vat_pct) || 25,
        }))
      });
      toast.success('Invoice created');
      setModalOpen(false);
      fetchInvoices();
      setForm({ client_name: '', client_email: '', client_address: '', issue_date: today(), due_date: '', currency: 'SEK', notes: '', items: [{ ...EMPTY_ITEM }] });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create invoice');
    } finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/invoices/${id}/status`, { status });
      toast.success(`Invoice marked as ${status}`);
      fetchInvoices();
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await axios.delete(`${API}/invoices/${id}`);
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch { toast.error('Failed to delete'); }
  };

  const totals = calcTotals();

  const counts = { all: invoices.length };
  ['draft','sent','paid','overdue'].forEach(s => {
    counts[s] = invoices.filter(inv => inv.status === s).length;
  });

  return (
    <div className="space-y-5" data-testid="invoices-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('nav.invoices')}
        </h1>
        <button onClick={() => setModalOpen(true)} data-testid="create-invoice-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
        >
          <Plus size={15} /> Create Invoice
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {[['','All'], ['draft','Draft'], ['sent','Sent'], ['paid','Paid'], ['overdue','Overdue']].map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === val
                ? 'bg-[#4FC3C3]/20 text-[#4FC3C3] border border-[#4FC3C3]/40'
                : 'bg-[#1A1A1A] text-[#A3A3A3] border border-[#2A2A2A] hover:text-white'
            }`}
          >
            {label}
            <span className="px-1.5 py-0.5 rounded-sm bg-[#2A2A2A] text-[#6B6B6B] text-xs">{counts[val || 'all'] || 0}</span>
          </button>
        ))}
      </div>

      {/* Invoice Table */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-[#4FC3C3]" /></div>
        ) : invoices.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <FileText size={36} className="text-[#2A2A2A]" />
            <p className="text-[#6B6B6B] text-sm">No invoices yet</p>
            <button onClick={() => setModalOpen(true)} className="text-[#4FC3C3] text-xs hover:underline">Create your first invoice</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A2A]">
                  {['Invoice #','Client','Amount (incl. VAT)','Status','Issue Date','Due Date',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const st = STATUS_STYLES[inv.status] || STATUS_STYLES.draft;
                  return (
                    <tr key={inv.id} className="border-b border-[#2A2A2A] hover:bg-[#4FC3C3]/5 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-[#4FC3C3]">{inv.invoice_number}</td>
                      <td className="px-4 py-3">
                        <p className="text-white text-sm font-medium">{inv.client_name}</p>
                        {inv.client_email && <p className="text-[#6B6B6B] text-xs">{inv.client_email}</p>}
                      </td>
                      <td className="px-4 py-3 text-white font-bold tabular-nums">{fmt(inv.total)} {inv.currency}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-sm text-xs font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-[#A3A3A3] text-xs tabular-nums">{inv.issue_date}</td>
                      <td className="px-4 py-3 text-[#A3A3A3] text-xs tabular-nums">{inv.due_date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {inv.status === 'draft' && (
                            <button onClick={() => updateStatus(inv.id, 'sent')} title="Mark Sent"
                              className="p-1.5 rounded-sm bg-[#3B82F6]/20 text-[#3B82F6] hover:bg-[#3B82F6]/30 transition-all">
                              <Send size={12} />
                            </button>
                          )}
                          {(inv.status === 'sent' || inv.status === 'overdue') && (
                            <button onClick={() => updateStatus(inv.id, 'paid')} title="Mark Paid"
                              className="p-1.5 rounded-sm bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30 transition-all">
                              <CheckCircle size={12} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(inv.id)}
                            className="p-1.5 rounded-sm text-[#6B6B6B] hover:text-[#EF4444] transition-all">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="invoice-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>Create Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5">
            {/* Client info */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-3">Client Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-[#6B6B6B] mb-1 block">Client Name *</label>
                  <input required value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                    placeholder="Company or person name"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B6B6B] mb-1 block">Email</label>
                  <input type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B6B6B] mb-1 block">Address</label>
                  <input value={form.client_address} onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))}
                    placeholder="Street, City"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#6B6B6B] mb-1 block">Issue Date *</label>
                <input type="date" required value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-xs text-[#6B6B6B] mb-1 block">Due Date *</label>
                <input type="date" required value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-3">Line Items</p>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-5">
                      <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                        placeholder="Description" required
                        className="w-full px-2.5 py-1.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                      />
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                        placeholder="Qty" min="0" step="0.01" required
                        className="w-full px-2.5 py-1.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                      />
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)}
                        placeholder="Price" min="0" step="0.01" required
                        className="w-full px-2.5 py-1.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                      />
                    </div>
                    <div className="col-span-2">
                      <select value={item.vat_pct} onChange={e => updateItem(i, 'vat_pct', e.target.value)}
                        className="w-full px-2 py-1.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                      >
                        {[0,6,12,25].map(v => <option key={v} value={v} className="bg-[#1A1A1A]">{v}% VAT</option>)}
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="text-[#6B6B6B] hover:text-[#EF4444] p-1 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem}
                className="mt-2 flex items-center gap-1.5 text-xs text-[#4FC3C3] hover:underline">
                <Plus size={12} /> Add line item
              </button>
            </div>

            {/* Totals */}
            <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4 text-sm space-y-1">
              <div className="flex justify-between text-[#A3A3A3]">
                <span>Subtotal</span><span className="tabular-nums">{fmt(totals.subtotal)} SEK</span>
              </div>
              <div className="flex justify-between text-[#A3A3A3]">
                <span>VAT</span><span className="tabular-nums">{fmt(totals.vat)} SEK</span>
              </div>
              <div className="flex justify-between text-white font-bold border-t border-[#2A2A2A] pt-1 mt-1">
                <span>Total</span><span className="tabular-nums">{fmt(totals.total)} SEK</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#6B6B6B] mb-1 block">Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Payment terms, bank details, etc." rows={2}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B] resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving} data-testid="save-invoice-btn"
                className="flex-1 py-2.5 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                Create Invoice
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
