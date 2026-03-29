import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Search, Pencil, Trash2, Loader2, BarChart2, RefreshCw, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { API } from '../config/api';

// Safe number formatter
const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const today = () => new Date().toISOString().split('T')[0];

const EMPTY = { type: 'expense', amount: '', categories: [], description: '', date: today(), party: '', currency: 'SEK', recurring: false, recurrence: 'monthly' };

const CATEGORY_COLORS = {
  food: '#10B981', transport: '#3B82F6', housing: '#8B5CF6',
  entertainment: '#F59E0B', healthcare: '#EF4444', shopping: '#EC4899',
  utilities: '#06B6D4', education: '#14B8A6', salary: '#10B981',
  freelance: '#4FC3C3', investment: '#8B5CF6', gift: '#F59E0B', other: '#6B7280'
};

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

export default function Transactions() {
  const { t } = useLanguage();
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: 'all', search: '', category: '' });
  const [view, setView] = useState('list');
  const [stats, setStats] = useState(null);
  const [statPeriod, setStatPeriod] = useState('');
  
  // Dynamic Categories State
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Bulk Edit State
  const [selectedTxns, setSelectedTxns] = useState(new Set());
  const [bulkEditModal, setBulkEditModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({ categories: [], date: today() });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // Fetch Transactions
  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.type !== 'all') params.type = filter.type;
      if (filter.category) params.category = filter.category;
      if (filter.search) params.search = filter.search;
      
      const token = localStorage.getItem('session_token');
      const res = await axios.get(`${API}/transactions`, { 
        params,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      let data = res.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data = data.transactions || data.data || [];
      }
      if (!Array.isArray(data)) data = [];
      setTxns(data);
      setSelectedTxns(new Set()); // Clear selections on refresh
    } catch (err) {
      console.error('Failed to load transactions:', err);
      toast.error(`Failed to load transactions`);
      setTxns([]);
    } finally { 
      setLoading(false); 
    }
  }, [filter]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const params = PERIOD_PARAMS[statPeriod] || {};
      const token = localStorage.getItem('session_token');
      const res = await axios.get(`${API}/transactions/stats`, { 
        params,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      toast.error('Failed to load statistics');
    }
  }, [statPeriod]);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
        const token = localStorage.getItem('session_token');
        const res = await axios.get(`${API}/categories`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
        console.error("Failed to fetch categories");
    }
  }, []);

  useEffect(() => { fetchTxns(); fetchCategories(); }, [fetchTxns, fetchCategories]);
  useEffect(() => { if (view === 'stats') fetchStats(); }, [view, fetchStats]);

  // Create new Category
  const handleCreateCategory = async (type) => {
    if (!newCategoryName.trim()) return;
    try {
        const token = localStorage.getItem('session_token');
        const res = await axios.post(`${API}/categories`, {
            name: newCategoryName,
            type: type 
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        setCategories([...categories, res.data]);
        setForm({ ...form, categories: [...form.categories, res.data.name] });
        
        setNewCategoryName("");
        setIsAddingCategory(false);
        toast.success('Category created!');
    } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to create category");
    }
  };

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); setIsAddingCategory(false); };
  
  const openEdit = (txn) => {
    setEditing(txn);
    setForm({
      type: txn.type, amount: txn.amount, categories: Array.isArray(txn.categories) ? txn.categories : (txn.category ? [txn.category] : []),
      description: txn.description, date: txn.date, party: txn.party || '',
      currency: txn.currency || 'SEK',
      recurring: txn.recurring || false, recurrence: txn.recurrence || 'monthly'
    });
    setModalOpen(true);
    setIsAddingCategory(false);
  };

  const toggleTxnSelection = (id) => {
    const newSelected = new Set(selectedTxns);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTxns(newSelected);
  };

  const toggleAllTxns = () => {
    if (selectedTxns.size === txns.length) {
      setSelectedTxns(new Set());
    } else {
      setSelectedTxns(new Set(txns.map(t => t.id)));
    }
  };

  const openBulkEdit = () => {
    if (selectedTxns.size === 0) {
      toast.error('Select at least one transaction');
      return;
    }
    setBulkForm({ categories: [], date: today() });
    setBulkEditModal(true);
  };

  const handleBulkSave = async (e) => {
    e.preventDefault();
    if (bulkForm.categories.length === 0) {
      toast.error('Select at least one category to apply');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      
      for (const txnId of selectedTxns) {
        const txn = txns.find(t => t.id === txnId);
        const payload = {
          ...txn,
          categories: bulkForm.categories,
          date: bulkForm.date || txn.date,
          amount: parseFloat(txn.amount)
        };
        await axios.put(`${API}/transactions/${txnId}`, payload, config);
      }
      
      toast.success(`Updated ${selectedTxns.size} transactions`);
      setBulkEditModal(false);
      setSelectedTxns(new Set());
      fetchTxns();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to bulk update');
    } finally { 
      setSaving(false); 
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.categories.length === 0) {
        toast.error("Please select or create at least one category");
        return;
    }
    
    setSaving(true);
    try {
      const payload = {
        ...form,
        categories: form.categories, // Array of categories
        amount: parseFloat(form.amount),
        recurring: form.recurring,
        recurrence: form.recurring ? form.recurrence : null,
      };
      
      const token = localStorage.getItem('session_token');
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      
      if (editing) {
        await axios.put(`${API}/transactions/${editing.id}`, payload, config);
        toast.success('Transaction updated');
      } else {
        await axios.post(`${API}/transactions`, payload, config);
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
      const token = localStorage.getItem('session_token');
      await axios.delete(`${API}/transactions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Deleted');
      fetchTxns();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-5" data-testid="transactions-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {t('transactions.title') || "Transactions"}
        </h1>
        <div className="flex gap-2">
          {selectedTxns.size > 0 && (
            <button onClick={openBulkEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#F59E0B] text-[#0A0A0A] text-sm font-bold hover:bg-[#DC2626] transition-all"
            >
              <Check size={15} />
              Bulk Edit ({selectedTxns.size})
            </button>
          )}
          <button onClick={openAdd} data-testid="add-transaction-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
          >
            <Plus size={15} />
            Add Transaction
          </button>
        </div>
      </div>

      {/* View Toggle + Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-sm border border-[#2A2A2A] overflow-hidden">
          {['list','stats'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 text-xs font-semibold transition-all ${view === v ? 'bg-[#4FC3C3] text-[#0A0A0A]' : 'bg-[#1A1A1A] text-[#A3A3A3] hover:text-white'}`}
            >
              {v === 'list' ? 'List' : 'Statistics'}
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
                  {tp}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]" />
              <input value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                placeholder="Search..." data-testid="search-input"
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
              <p className="text-[#6B6B6B] text-sm">No transactions found.</p>
              <button onClick={openAdd} className="text-[#4FC3C3] text-xs font-semibold hover:underline">Add one now</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="transactions-table">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    <th className="px-4 py-3 text-left">
                      <input type="checkbox" checked={selectedTxns.size === txns.length} onChange={toggleAllTxns}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    {['Date','Description','Categories','Party','Amount',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txns.map(txn => {
                    const catArray = Array.isArray(txn.categories) ? txn.categories : (txn.category ? [txn.category] : []);
                    return (
                      <tr key={txn.id} className={`border-b border-[#2A2A2A] transition-colors ${selectedTxns.has(txn.id) ? 'bg-[#4FC3C3]/10' : 'hover:bg-[#4FC3C3]/5'}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedTxns.has(txn.id)} onChange={() => toggleTxnSelection(txn.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
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
                          <div className="flex flex-wrap gap-1">
                            {catArray.length > 0 ? (
                              catArray.map((cat, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded-sm text-xs font-medium capitalize"
                                  style={{ background: `${CATEGORY_COLORS[cat] || '#6B7280'}20`, color: CATEGORY_COLORS[cat] || '#6B7280' }}>
                                  {cat}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-[#6B6B6B]">—</span>
                            )}
                          </div>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stats View - unchanged from original */}
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
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {editing ? 'Edit Transaction' : 'Add Transaction'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Type Toggle */}
            <div className="flex rounded-sm border border-[#2A2A2A] overflow-hidden">
              {['expense','income'].map(tp => (
                <button key={tp} type="button" onClick={() => setForm(f => ({ ...f, type: tp, categories: [] }))}
                  className={`flex-1 py-2 text-xs font-bold capitalize transition-all ${form.type === tp ? 'bg-[#4FC3C3] text-[#0A0A0A]' : 'bg-transparent text-[#A3A3A3] hover:text-white'}`}
                >
                  {tp}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Amount</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0" required min="0" step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] [color-scheme:dark]"
                />
              </div>
            </div>

            {/* MULTI-CATEGORY SECTION */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-2 block">Categories (Select Multiple)</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(Array.isArray(categories) ? categories : [])
                  .filter(c => c.type === form.type)
                  .map(cat => (
                    <label key={cat.id} className="flex items-center gap-2 p-2 hover:bg-[#0A0A0A] rounded-sm cursor-pointer">
                      <input type="checkbox" checked={form.categories.includes(cat.name)} onChange={(e) => {
                        if (e.target.checked) {
                          setForm(f => ({ ...f, categories: [...f.categories, cat.name] }));
                        } else {
                          setForm(f => ({ ...f, categories: f.categories.filter(c => c !== cat.name) }));
                        }
                      }}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm text-white capitalize">{cat.name}</span>
                    </label>
                  ))}
              </div>

              {!isAddingCategory ? (
                <button 
                    type="button" 
                    onClick={() => setIsAddingCategory(true)}
                    className="text-xs text-[#4FC3C3] hover:underline flex items-center gap-1 mt-2 font-semibold"
                >
                    <Plus size={12} /> Create new category
                </button>
              ) : (
                <div className="flex items-center gap-2 mt-2 p-2 bg-[#0A0A0A] rounded-sm border border-[#2A2A2A]">
                    <input 
                        type="text" 
                        placeholder="New category name" 
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 px-2 py-1 bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-sm text-xs focus:outline-none"
                    />
                    <button 
                        type="button"
                        onClick={() => handleCreateCategory(form.type)}
                        className="bg-[#4FC3C3] text-[#0A0A0A] px-3 py-1 rounded-sm text-xs font-bold"
                    >
                        Save
                    </button>
                    <button 
                        type="button"
                        onClick={() => { setIsAddingCategory(false); setNewCategoryName(""); }}
                        className="text-[#6B6B6B] hover:text-white px-2 py-1 text-xs"
                    >
                        Cancel
                    </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What was this for?" required 
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Party (optional)</label>
              <input type="text" value={form.party} onChange={e => setForm(f => ({ ...f, party: e.target.value }))}
                placeholder="Store, person, etc."
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-[#2A2A2A]">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                Save Transaction
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Modal */}
      <Dialog open={bulkEditModal} onOpenChange={setBulkEditModal}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
              Bulk Edit Transactions ({selectedTxns.size})
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkSave} className="space-y-4">
            
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-2 block">Update Categories (Optional)</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(Array.isArray(categories) ? categories : []).map(cat => (
                  <label key={cat.id} className="flex items-center gap-2 p-2 hover:bg-[#0A0A0A] rounded-sm cursor-pointer">
                    <input type="checkbox" checked={bulkForm.categories.includes(cat.name)} onChange={(e) => {
                      if (e.target.checked) {
                        setBulkForm(f => ({ ...f, categories: [...f.categories, cat.name] }));
                      } else {
                        setBulkForm(f => ({ ...f, categories: f.categories.filter(c => c !== cat.name) }));
                      }
                    }}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-white capitalize">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Update Date (Optional)</label>
              <input type="date" value={bulkForm.date} onChange={e => setBulkForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] [color-scheme:dark]"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-[#2A2A2A]">
              <button type="button" onClick={() => setBulkEditModal(false)}
                className="flex-1 py-2 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-sm bg-[#F59E0B] text-[#0A0A0A] text-sm font-bold hover:bg-[#DC2626] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                Apply Changes
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}