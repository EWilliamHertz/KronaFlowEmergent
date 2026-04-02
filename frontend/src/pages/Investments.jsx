import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '../config/api';
import {
  Plus, Trash2, TrendingUp, TrendingDown, LineChart as LineChartIcon,
  Edit2, X, Loader2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [categories, setCategories] = useState([]); // Global categories
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Category Creation State
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', categories: [], quantity: '', buy_price: '', purchase_date: '', description: '', currency: 'SEK'
  });
  
  const [updateData, setUpdateData] = useState({
    current_value: '', date: new Date().toISOString().split('T')[0]
  });

  const fetchInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('session_token');
      const response = await axios.get(`${API}/investments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setInvestments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error('Failed to load investments');
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchInvestments();
    fetchCategories();
  }, [fetchInvestments, fetchCategories]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const token = localStorage.getItem('session_token');
      const res = await axios.post(`${API}/categories`, {
        name: newCategoryName,
        type: 'investment' // Label it as an investment category
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setCategories([...categories, res.data]);
      setFormData(f => ({ ...f, categories: [...f.categories, res.data.name] }));
      
      setNewCategoryName("");
      setIsAddingCategory(false);
      toast.success('Category created!');
    } catch (err) {
      toast.error("Failed to create category");
    }
  };

  const handleAddInvestment = async (e) => {
    e.preventDefault();
    if (formData.categories.length === 0) {
      return toast.error("Please select or create at least one category");
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      await axios.post(`${API}/investments`, {
        ...formData,
        category: formData.categories.join(', '), // Join array into a string for the backend
        quantity: parseFloat(formData.quantity),
        buy_price: parseFloat(formData.buy_price),
        current_value: parseFloat(formData.quantity) * parseFloat(formData.buy_price) // Default current value
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Investment created successfully!');
      setShowAddModal(false);
      setFormData({ name: '', categories: [], quantity: '', buy_price: '', purchase_date: '', description: '', currency: 'SEK' });
      setIsAddingCategory(false);
      fetchInvestments();
    } catch (error) {
      toast.error('Failed to create investment');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateValue = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      await axios.post(`${API}/investments/${selectedInvestment.id}/update-value`, {
        current_value: parseFloat(updateData.current_value),
        date: updateData.date
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Investment value updated!');
      setShowUpdateModal(false);
      setUpdateData({ current_value: '', date: new Date().toISOString().split('T')[0] });
      fetchInvestments();
      
      // Refresh the detailed view too
      const res = await axios.get(`${API}/investments/${selectedInvestment.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      setSelectedInvestment(res.data);
    } catch (error) {
      toast.error('Failed to update investment value');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure? This will delete the investment and all related transactions.')) return;
    try {
      const token = localStorage.getItem('session_token');
      await axios.delete(`${API}/investments/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Investment deleted');
      setShowDetailModal(false);
      fetchInvestments();
    } catch (error) {
      toast.error('Failed to delete investment');
    }
  };

  const handleViewDetail = async (investment) => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await axios.get(`${API}/investments/${investment.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSelectedInvestment(response.data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load investment details');
    }
  };

  const totalInvested = investments.reduce((sum, inv) => sum + (inv.quantity * inv.buy_price), 0);
  const currentValue = investments.reduce((sum, inv) => sum + inv.current_value, 0);
  const profitLoss = currentValue - totalInvested;
  const profitLossPct = totalInvested > 0 ? ((profitLoss / totalInvested) * 100).toFixed(2) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-[#4FC3C3]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="investments-page">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Chivo, sans-serif' }}>Investments</h1>
          <p className="text-[#A3A3A3] text-xs mt-1">Track your collectibles and assets</p>
        </div>
        <button onClick={() => { setFormData({ name: '', categories: [], quantity: '', buy_price: '', purchase_date: '', description: '', currency: 'SEK' }); setShowAddModal(true); setIsAddingCategory(false); }} 
          className="flex items-center gap-2 px-4 py-2 bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold rounded-sm hover:bg-[#3BA6A6] transition-colors shadow-[0_0_10px_rgba(79,195,195,0.3)]">
          <Plus size={15} /> Add Investment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
          <p className="text-[#A3A3A3] text-xs font-medium mb-2 uppercase tracking-widest">Total Invested</p>
          <p className="text-2xl font-bold text-white tabular-nums">{totalInvested.toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK</p>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
          <p className="text-[#A3A3A3] text-xs font-medium mb-2 uppercase tracking-widest">Current Value</p>
          <p className="text-2xl font-bold text-white tabular-nums">{currentValue.toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK</p>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5">
          <p className="text-[#A3A3A3] text-xs font-medium mb-2 uppercase tracking-widest">Total Profit/Loss</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-bold tabular-nums ${profitLoss >= 0 ? 'text-[#4FC3C3]' : 'text-[#EF4444]'}`}>
              {profitLoss >= 0 ? '+' : ''}{profitLoss.toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK
            </p>
            {profitLoss >= 0 ? <TrendingUp size={20} className="text-[#4FC3C3]" /> : <TrendingDown size={20} className="text-[#EF4444]" />}
          </div>
          <p className={`text-sm font-bold mt-1 tabular-nums ${profitLoss >= 0 ? 'text-[#4FC3C3]' : 'text-[#EF4444]'}`}>
            {profitLoss >= 0 ? '+' : ''}{profitLossPct}%
          </p>
        </div>
      </div>

      {/* Investments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {investments.length === 0 ? (
          <div className="col-span-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-12 text-center flex flex-col items-center">
            <LineChartIcon size={48} className="text-[#2A2A2A] mb-4" />
            <p className="text-[#A3A3A3] text-sm">No investments yet. Create one to get started!</p>
          </div>
        ) : (
          investments.map((inv) => (
            <div key={inv.id} onClick={() => handleViewDetail(inv)} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5 cursor-pointer hover:border-[#4FC3C3]/50 transition-all duration-200 group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight mb-1">{inv.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(inv.category || 'Uncategorized').split(',').map((cat, idx) => (
                      <span key={idx} className="text-[10px] bg-[#2A2A2A] text-[#A3A3A3] px-2 py-0.5 rounded-sm uppercase font-bold">
                        {cat.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={(e) => handleDelete(inv.id, e)} className="text-[#6B6B6B] hover:text-[#EF4444] opacity-0 group-hover:opacity-100 transition-opacity p-1">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-2 text-xs mb-4 pt-4 border-t border-[#2A2A2A]">
                <div className="flex justify-between"><span className="text-[#6B6B6B]">Quantity:</span><span className="text-white font-bold tabular-nums">{inv.quantity}</span></div>
                <div className="flex justify-between"><span className="text-[#6B6B6B]">Buy Price:</span><span className="text-white font-bold tabular-nums">{(inv.buy_price || 0).toLocaleString('sv-SE')} SEK</span></div>
                <div className="flex justify-between"><span className="text-[#6B6B6B]">Total Value:</span><span className="text-[#4FC3C3] font-bold tabular-nums">{(inv.current_value || 0).toLocaleString('sv-SE')} SEK</span></div>
              </div>

              <div className={`p-2 rounded-sm text-center text-xs font-bold tabular-nums ${inv.profit_loss_pct >= 0 ? 'bg-[#4FC3C3]/10 text-[#4FC3C3]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                {inv.profit_loss_pct >= 0 ? '↑ +' : '↓ '}{(inv.profit_loss_pct || 0).toFixed(2)}%
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Investment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Add Investment</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[#A3A3A3] hover:text-white"><X size={20} /></button>
            </div>

            <form onSubmit={handleAddInvestment} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Item Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., 1st Edition Charizard" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-white text-sm focus:border-[#4FC3C3] outline-none" required />
              </div>

              {/* MULTI-CATEGORY SECTION */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-2 block">Categories (Select Multiple)</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(Array.isArray(categories) ? categories : [])
                    .filter(c => c.type === 'investment' || c.type === 'expense') // Show relevant categories
                    .map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 p-2 hover:bg-[#0A0A0A] rounded-sm cursor-pointer">
                        <input type="checkbox" checked={formData.categories.includes(cat.name)} onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(f => ({ ...f, categories: [...f.categories, cat.name] }));
                          } else {
                            setFormData(f => ({ ...f, categories: f.categories.filter(c => c !== cat.name) }));
                          }
                        }}
                          className="w-4 h-4 cursor-pointer accent-[#4FC3C3]"
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
                          onClick={handleCreateCategory}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Quantity</label>
                  <input type="number" step="0.01" min="0" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} placeholder="e.g., 1" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-white text-sm focus:border-[#4FC3C3] outline-none" required />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Buy Price (per unit)</label>
                  <input type="number" step="0.01" min="0" value={formData.buy_price} onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })} placeholder="e.g., 5000" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-white text-sm focus:border-[#4FC3C3] outline-none" required />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Purchase Date</label>
                <input type="date" value={formData.purchase_date} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-white text-sm focus:border-[#4FC3C3] outline-none [color-scheme:dark]" required />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Notes..." rows="2" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-white text-sm focus:border-[#4FC3C3] outline-none" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#2A2A2A]">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-transparent border border-[#2A2A2A] text-[#A3A3A3] rounded-sm py-2 font-bold hover:bg-[#2A2A2A] transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#4FC3C3] text-[#0A0A0A] rounded-sm py-2 font-bold hover:bg-[#3BA6A6] transition-colors text-sm flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />} Save Investment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Investment Detail Modal */}
      {showDetailModal && selectedInvestment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">{selectedInvestment.name}</h2>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(selectedInvestment.category || 'Uncategorized').split(',').map((cat, idx) => (
                    <span key={idx} className="text-[10px] bg-[#2A2A2A] text-[#A3A3A3] px-2 py-0.5 rounded-sm uppercase font-bold">
                      {cat.trim()}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => { setShowDetailModal(false); setSelectedInvestment(null); }} className="text-[#A3A3A3] hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-3">
                <p className="text-[#A3A3A3] text-[10px] uppercase font-bold mb-1">Quantity</p>
                <p className="text-white font-bold text-sm tabular-nums">{selectedInvestment.quantity}</p>
              </div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-3">
                <p className="text-[#A3A3A3] text-[10px] uppercase font-bold mb-1">Buy Price</p>
                <p className="text-white font-bold text-sm tabular-nums">{selectedInvestment.buy_price.toLocaleString('sv-SE')} SEK</p>
              </div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-3">
                <p className="text-[#A3A3A3] text-[10px] uppercase font-bold mb-1">Total Invested</p>
                <p className="text-white font-bold text-sm tabular-nums">{(selectedInvestment.quantity * selectedInvestment.buy_price).toLocaleString('sv-SE')} SEK</p>
              </div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-3">
                <p className="text-[#4FC3C3] text-[10px] uppercase font-bold mb-1">Current Value</p>
                <p className="text-[#4FC3C3] font-bold text-sm tabular-nums">{(selectedInvestment.current_value || 0).toLocaleString('sv-SE')} SEK</p>
              </div>
            </div>

            {/* Price History Chart */}
            {selectedInvestment.history && selectedInvestment.history.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs uppercase tracking-widest text-[#6B6B6B] font-bold mb-3">Price History</h3>
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4 pt-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={selectedInvestment.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                      <XAxis dataKey="recorded_date" stroke="#6B6B6B" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#6B6B6B" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '2px', color: '#fff', fontSize: '12px' }}
                        formatter={(value) => [`${value.toLocaleString('sv-SE')} SEK`, 'Value']}
                      />
                      <Line type="monotone" dataKey="recorded_value" stroke="#8B5CF6" dot={{ fill: '#8B5CF6', r: 4 }} activeDot={{ r: 6 }} strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-[#2A2A2A]">
              <button onClick={() => {
                setSelectedInvestment(selectedInvestment);
                setUpdateData({ current_value: selectedInvestment.current_value.toString(), date: new Date().toISOString().split('T')[0] });
                setShowDetailModal(false);
                setShowUpdateModal(true);
              }} className="flex-1 flex items-center justify-center gap-2 bg-[#8B5CF6] text-white rounded-sm py-2 font-bold hover:bg-[#7C3AED] transition-colors text-sm">
                <Edit2 size={14} /> Log New Price
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Value Modal */}
      {showUpdateModal && selectedInvestment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm max-w-sm w-full p-6">
            <h2 className="text-xl font-bold text-white mb-1">Update Market Value</h2>
            <p className="text-[#A3A3A3] text-xs mb-4">Log the current price of {selectedInvestment.name}</p>

            <form onSubmit={handleUpdateValue} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#8B5CF6] mb-1 block">Total Current Value (SEK)</label>
                <input type="number" step="0.01" min="0" value={updateData.current_value} onChange={(e) => setUpdateData({ ...updateData, current_value: e.target.value })} placeholder="e.g., 5500" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-white text-sm focus:border-[#8B5CF6] outline-none" required />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#8B5CF6] mb-1 block">Date Recorded</label>
                <input type="date" value={updateData.date} onChange={(e) => setUpdateData({ ...updateData, date: e.target.value })} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-white text-sm focus:border-[#8B5CF6] outline-none [color-scheme:dark]" required />
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#2A2A2A]">
                <button type="button" onClick={() => { setShowUpdateModal(false); setShowDetailModal(true); }} className="flex-1 bg-transparent border border-[#2A2A2A] text-[#A3A3A3] rounded-sm py-2 font-bold hover:bg-[#2A2A2A] transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#8B5CF6] text-white rounded-sm py-2 font-bold hover:bg-[#7C3AED] transition-colors text-sm flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />} Save Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}