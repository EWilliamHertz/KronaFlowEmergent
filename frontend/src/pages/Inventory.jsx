import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Loader2, Package, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtDec = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const EMPTY = { name: '', sku: '', quantity: '', buy_price: '', b2b_price: '', b2c_price: '', vat_pct: 25, description: '', low_stock_threshold: 5 };

export default function Inventory() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/inventory`);
      setItems(res.data);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name, sku: item.sku || '', quantity: item.quantity,
      buy_price: item.buy_price, b2b_price: item.b2b_price || '',
      b2c_price: item.b2c_price || '', vat_pct: item.vat_pct || 25,
      description: item.description || '', low_stock_threshold: item.low_stock_threshold || 5
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: parseFloat(form.quantity),
        buy_price: parseFloat(form.buy_price),
        b2b_price: form.b2b_price ? parseFloat(form.b2b_price) : null,
        b2c_price: form.b2c_price ? parseFloat(form.b2c_price) : null,
        vat_pct: parseFloat(form.vat_pct),
        low_stock_threshold: parseFloat(form.low_stock_threshold),
      };
      if (editing) {
        await axios.put(`${API}/inventory/${editing.id}`, payload);
        toast.success('Product updated');
      } else {
        await axios.post(`${API}/inventory`, payload);
        toast.success('Product added');
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`${API}/inventory/${id}`);
      toast.success('Product deleted');
      fetchItems();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = items.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase()) || (item.sku || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = items.reduce((s, it) => s + (it.total_value || 0), 0);
  const lowStockCount = items.filter(it => it.low_stock).length;

  return (
    <div className="space-y-5" data-testid="inventory-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('nav.inventory')}
        </h1>
        <button onClick={openAdd} data-testid="add-product-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
        >
          <Plus size={15} /> Add Product
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Total Inventory Value</p>
          <p className="text-white font-bold tabular-nums text-xl">{fmt(totalValue)} SEK</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Products</p>
          <p className="text-white font-bold text-xl">{items.length}</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Low Stock</p>
          <p className={`font-bold text-xl ${lowStockCount > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{lowStockCount}</p>
        </div>
      </div>

      {/* Search + Table */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm overflow-hidden">
        <div className="p-4 border-b border-[#2A2A2A]">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full max-w-xs px-3 py-1.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
          />
        </div>
        {loading ? (
          <div className="p-8 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-[#4FC3C3]" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <Package size={36} className="text-[#2A2A2A]" />
            <p className="text-[#6B6B6B] text-sm">{items.length === 0 ? 'No products yet' : 'No products found'}</p>
            {items.length === 0 && <button onClick={openAdd} className="text-[#4FC3C3] text-xs hover:underline">Add first product</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A2A]">
                  {['Product','SKU','Stock','Buy Price','B2B Price','B2C Price','VAT','Total Value',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-[#2A2A2A] hover:bg-[#4FC3C3]/5 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{item.name}</p>
                      {item.description && <p className="text-[#6B6B6B] text-xs truncate max-w-[120px]">{item.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#A3A3A3] text-xs font-mono">{item.sku || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white text-sm font-semibold tabular-nums">{item.quantity}</span>
                        {item.low_stock && (
                          <AlertTriangle size={13} className="text-[#F59E0B]" title="Low stock" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#A3A3A3] text-sm tabular-nums">{fmtDec(item.buy_price)}</td>
                    <td className="px-4 py-3 text-[#A3A3A3] text-sm tabular-nums">{item.b2b_price ? fmtDec(item.b2b_price) : '—'}</td>
                    <td className="px-4 py-3 text-[#A3A3A3] text-sm tabular-nums">{item.b2c_price ? fmtDec(item.b2c_price) : '—'}</td>
                    <td className="px-4 py-3 text-[#A3A3A3] text-sm">{item.vat_pct}%</td>
                    <td className="px-4 py-3 text-white font-bold tabular-nums">{fmt(item.total_value)} SEK</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(item)} className="text-[#6B6B6B] hover:text-[#4FC3C3] transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-[#6B6B6B] hover:text-[#EF4444] transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md" data-testid="product-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {editing ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Product Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Product name" data-testid="product-name-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">SKU</label>
                <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Quantity *</label>
                <input required type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="0" min="0" step="0.001"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Buy Price (SEK) *</label>
                <input required type="number" value={form.buy_price} onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">B2B Price</label>
                <input type="number" value={form.b2b_price} onChange={e => setForm(f => ({ ...f, b2b_price: e.target.value }))}
                  placeholder="Optional" min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">B2C Price</label>
                <input type="number" value={form.b2c_price} onChange={e => setForm(f => ({ ...f, b2c_price: e.target.value }))}
                  placeholder="Optional" min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">VAT %</label>
                <select value={form.vat_pct} onChange={e => setForm(f => ({ ...f, vat_pct: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                >
                  {[0,6,12,25].map(v => <option key={v} value={v} className="bg-[#1A1A1A]">{v}%</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Low Stock Alert</label>
                <input type="number" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))}
                  min="0" step="1"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving} data-testid="save-product-btn"
                className="flex-1 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                Save
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
