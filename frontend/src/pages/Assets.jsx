import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Loader2, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { extractArray } from '../utils/apiHelpers';
import { toast } from 'sonner';
import { API } from '../config/api';
const ASSET_TYPES = ['stock','crypto','real_estate','vehicle','collectible','other'];

const TYPE_COLORS = {
  stock: '#4FC3C3', crypto: '#F59E0B', real_estate: '#10B981',
  vehicle: '#3B82F6', collectible: '#8B5CF6', other: '#6B7280'
};

const TYPE_ICONS = {
  stock: '📈', crypto: '🪙', real_estate: '🏠',
  vehicle: '🚗', collectible: '🎨', other: '📦'
};

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const EMPTY = { type: 'stock', name: '', current_value: '', purchase_value: '', quantity: '', currency: 'SEK', description: '' };

export default function Assets() {
  const { t } = useLanguage();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchAssets = useCallback(async () => {
  setLoading(true);
  try {
    const token = localStorage.getItem('session_token');
    const params = activeType !== 'all' ? { type: activeType } : {};
    const res = await axios.get(`${API}/assets`, { 
      params,
      headers: { 'Authorization': `Bearer ${token}` } // Add header
    });
setAssets(extractArray(res.data));
  } catch (err) { 
    toast.error('Failed to load assets'); 
  } finally { setLoading(false); }
}, [activeType]);
  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({ type: a.type, name: a.name, current_value: a.current_value, purchase_value: a.purchase_value || '', quantity: a.quantity || '', currency: a.currency || 'SEK', description: a.description || '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        current_value: parseFloat(form.current_value),
        purchase_value: form.purchase_value ? parseFloat(form.purchase_value) : null,
        quantity: form.quantity ? parseFloat(form.quantity) : null,
      };
      if (editing) {
        await axios.put(`${API}/assets/${editing.id}`, payload);
        toast.success('Asset updated');
      } else {
        await axios.post(`${API}/assets`, payload);
        toast.success('Asset added');
      }
      setModalOpen(false);
      fetchAssets();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this asset?')) return;
    try {
      await axios.delete(`${API}/assets/${id}`);
      toast.success('Asset deleted');
      fetchAssets();
    } catch { toast.error('Failed to delete'); }
  };

  const safeArray = Array.isArray(assets) ? assets : [];
  const totalValue = safeArray.reduce((s, a) => s + (a.current_value || 0), 0);
  const totalGain = safeArray.reduce((s, a) => s + (a.gain_loss || 0), 0);

  return (
    <div className="space-y-5" data-testid="assets-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('assets.title')}
        </h1>
        <button onClick={openAdd} data-testid="add-asset-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
        >
          <Plus size={15} />
          {t('assets.addAsset')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Total Portfolio Value</p>
          <p className="text-white font-bold tabular-nums text-xl">{fmt(totalValue)} SEK</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Total Gain/Loss</p>
          <p className={`font-bold tabular-nums text-xl ${totalGain >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {totalGain >= 0 ? '+' : ''}{fmt(totalGain)} SEK
          </p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-4">
          <p className="text-[#6B6B6B] text-xs mb-1">Assets Tracked</p>
          <p className="text-white font-bold text-xl">{safeArray.length}</p>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...ASSET_TYPES].map(type => (
          <button key={type} onClick={() => setActiveType(type)}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold capitalize transition-all ${
              activeType === type
                ? 'bg-[#4FC3C3]/20 text-[#4FC3C3] border border-[#4FC3C3]/40'
                : 'bg-[#1A1A1A] text-[#A3A3A3] border border-[#2A2A2A] hover:text-white hover:border-[#4FC3C3]/20'
            }`}
          >
            {TYPE_ICONS[type] || ''} {t(`assets.${type}`) || type}
          </button>
        ))}
      </div>

      {/* Asset Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-sm" />)}
        </div>
      ) : safeArray.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-12 flex flex-col items-center gap-3">
          <TrendingUp size={36} className="text-[#2A2A2A]" />
          <p className="text-[#6B6B6B] text-sm">{t('assets.noAssets')}</p>
          <button onClick={openAdd} className="text-[#4FC3C3] text-xs font-semibold hover:underline">{t('assets.addAsset')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="asset-cards">
          {safeArray.map(a => {
            const color = TYPE_COLORS[a.type] || '#6B7280';
            return (
              <div key={a.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5 hover:border-[#4FC3C3]/30 transition-all duration-200 group"
                data-testid={`asset-card-${a.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{TYPE_ICONS[a.type]}</span>
                    <div>
                      <p className="text-white text-sm font-bold">{a.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-sm capitalize" style={{ background: `${color}20`, color }}>
                        {a.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(a)} className="text-[#6B6B6B] hover:text-[#4FC3C3] p-1 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="text-[#6B6B6B] hover:text-[#EF4444] p-1 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-end justify-between">
                    <p className="text-[#6B6B6B] text-xs">{t('assets.currentValue')}</p>
                  </div>
                  <p className="text-white font-bold tabular-nums text-xl">{fmt(a.current_value)} <span className="text-sm text-[#A3A3A3]">{a.currency}</span></p>
                </div>

                {a.purchase_value > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#2A2A2A] flex items-center justify-between">
                    <span className="text-xs text-[#6B6B6B]">Purchase: {fmt(a.purchase_value)}</span>
                    <span className={`text-xs font-bold tabular-nums ${a.gain_loss >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {a.gain_loss >= 0 ? '+' : ''}{a.gain_loss_pct?.toFixed(1)}%
                    </span>
                  </div>
                )}
                {a.quantity && (
                  <p className="text-xs text-[#6B6B6B] mt-1">Qty: {a.quantity}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md" data-testid="asset-modal">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {editing ? t('assets.editAsset') : t('assets.addAsset')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Asset Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              >
                {ASSET_TYPES.map(tp => <option key={tp} value={tp} className="bg-[#1A1A1A]">{TYPE_ICONS[tp]} {tp.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Apple Inc., BTC, Apartment" required data-testid="asset-name-input"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Current Value</label>
                <input type="number" value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))}
                  placeholder="0" required min="0" step="0.01" data-testid="current-value-input"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Purchase Price</label>
                <input type="number" value={form.purchase_value} onChange={e => setForm(f => ({ ...f, purchase_value: e.target.value }))}
                  placeholder="Optional" min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Quantity (optional)</label>
              <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="e.g. 10 shares" min="0" step="0.000001"
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
              <button type="submit" disabled={saving} data-testid="save-asset-btn"
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
