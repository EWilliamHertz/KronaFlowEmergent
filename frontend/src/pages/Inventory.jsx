import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Loader2, Package2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { extractArray } from '../utils/apiHelpers';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const EMPTY = { name: '', sku: '', quantity: '', unit_price: '', category: '', description: '' };

export default function Inventory() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/inventory`);
      setItems(extractArray(res.data, 'items'));
    } catch (err) { 
      console.error('Failed to load inventory:', err);
      toast.error('Failed to load inventory'); 
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      category: item.category || '',
      description: item.description || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: parseInt(form.quantity),
        unit_price: parseFloat(form.unit_price)
      };
      if (editing) {
        await axios.put(`${API}/inventory/${editing.id}`, payload);
        toast.success('Item updated');
      } else {
        await axios.post(`${API}/inventory`, payload);
        toast.success('Item added');
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await axios.delete(`${API}/inventory/${id}`);
      toast.success('Item deleted');
      fetchItems();
    } catch { toast.error('Failed to delete'); }
  };

  const safeArray = Array.isArray(items) ? items : [];
  const filtered = safeArray.filter(e => 
    !search || 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    (e.sku || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalValue = filtered.reduce((s, item) => s + (item.quantity * item.unit_price), 0);
  const lowStockCount = filtered.filter(item => item.quantity < 10).length;

  return (
    <div className="space-y-5" data-testid="inventory-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('inventory.title')}
        </h1>
        <button onClick={openAdd} data-testid="add-item-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
        >
          <Plus size={15} />
          {t('inventory.addItem')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Total Items</p>
          <p className="text-white font-bold text-xl">{filtered.length}</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Total Units</p>
          <p className="text-white font-bold text-xl">{filtered.reduce((s, i) => s + i.quantity, 0)}</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Inventory Value</p>
          <p className="text-white font-bold text-xl">{fmt(totalValue)} SEK</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Low Stock</p>
          <p className={`font-bold text-xl ${lowStockCount > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>{lowStockCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
          className="w-full pl-10 pr-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
        />
      </div>

      {/* Items Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-sm" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-12 flex flex-col items-center gap-3">
          <Package2 size={36} className="text-[#2A2A2A]" />
          <p className="text-[#6B6B6B] text-sm">{search ? 'No items match your search' : t('inventory.noItems')}</p>
          {!search && <button onClick={openAdd} className="text-[#4FC3C3] text-xs font-semibold hover:underline">{t('inventory.addItem')}</button>}
        </div>
      ) : (
        <div className="overflow-x-auto" data-testid="inventory-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A2A]">
                <th className="text-left px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Item Name</th>
                <th className="text-left px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">SKU</th>
                <th className="text-right px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Qty</th>
                <th className="text-right px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Unit Price</th>
                <th className="text-right px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Total Value</th>
                <th className="text-right px-4 py-3 font-bold text-[#A3A3A3] text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const itemValue = item.quantity * item.unit_price;
                const isLowStock = item.quantity < 10;
                return (
                  <tr key={item.id} className={`border-b border-[#2A2A2A] hover:bg-[#4FC3C3]/5 transition-colors group ${
                    isLowStock ? 'bg-[#EF4444]/5' : ''
                  }`} data-testid={`item-row-${item.id}`}>
                    <td className="px-4 py-3 text-white font-semibold">{item.name}</td>
                    <td className="px-4 py-3 text-[#A3A3A3] text-xs font-mono">{item.sku || '—'}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${
                      isLowStock ? 'text-[#F59E0B]' : 'text-white'
                    }`}>{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-[#A3A3A3] tabular-nums">{fmt(item.unit_price)} SEK</td>
                    <td className="px-4 py-3 text-right text-white font-bold tabular-nums">{fmt(itemValue)} SEK</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(item)} className="text-[#6B6B6B] hover:text-[#4FC3C3] transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-[#6B6B6B] hover:text-[#EF4444] transition-colors">
                          <Trash2 size={13} />
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

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md" data-testid="item-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {editing ? t('inventory.editItem') : t('inventory.addItem')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Item Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Widget X-500" required data-testid="item-name-input"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">SKU (optional)</label>
              <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                placeholder="e.g. WX-500-BLK"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Quantity</label>
                <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="0" required min="0" data-testid="quantity-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Unit Price (SEK)</label>
                <input type="number" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                  placeholder="0" required min="0" step="0.01" data-testid="unit-price-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Category (optional)</label>
              <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Electronics"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Description (optional)</label>
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
              <button type="submit" disabled={saving} data-testid="save-item-btn"
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
