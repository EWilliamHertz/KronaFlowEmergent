import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Trash2, TrendingUp, TrendingDown, LineChart as LineChartIcon,
  Edit2, X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export default function Investments() {
  const { user, token } = useAuth();
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    buy_price: '',
    purchase_date: '',
    description: '',
    currency: 'SEK'
  });
  const [updateData, setUpdateData] = useState({
    current_value: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Fetch investments
  const fetchInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/investments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch investments');
      const data = await response.json();
      setInvestments(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load investments');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchInvestments();
  }, [token, fetchInvestments]);

  // Create investment
  const handleAddInvestment = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/investments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          quantity: parseFloat(formData.quantity),
          buy_price: parseFloat(formData.buy_price)
        })
      });
      if (!response.ok) throw new Error('Failed to create investment');
      toast.success('Investment created successfully!');
      setShowAddModal(false);
      setFormData({
        name: '',
        category: '',
        quantity: '',
        buy_price: '',
        purchase_date: '',
        description: '',
        currency: 'SEK'
      });
      fetchInvestments();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Update investment value
  const handleUpdateValue = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/investments/${selectedInvestment.id}/update-value`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_value: parseFloat(updateData.current_value),
          date: updateData.date
        })
      });
      if (!response.ok) throw new Error('Failed to update investment value');
      toast.success('Investment value updated!');
      setShowUpdateModal(false);
      setUpdateData({ current_value: '', date: new Date().toISOString().split('T')[0] });
      fetchInvestments();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Delete investment
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure? This will delete the investment and all related transactions.')) return;
    try {
      const response = await fetch(`${API_URL}/api/investments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete investment');
      toast.success('Investment deleted');
      fetchInvestments();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Open detail modal
  const handleViewDetail = async (investment) => {
    try {
      const response = await fetch(`${API_URL}/api/investments/${investment.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch investment details');
      const detailed = await response.json();
      setSelectedInvestment(detailed);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load investment details');
    }
  };

  // Calculate totals
  const totalInvested = investments.reduce((sum, inv) => sum + (inv.quantity * inv.buy_price), 0);
  const currentValue = investments.reduce((sum, inv) => sum + inv.current_value, 0);
  const profitLoss = currentValue - totalInvested;
  const profitLossPct = totalInvested > 0 ? ((profitLoss / totalInvested) * 100).toFixed(2) : 0;

  const categoryPresets = ['Pokemon', 'Magic: The Gathering', 'Sealed Boxes', 'Stocks', 'Cryptocurrencies', 'Collectibles', 'Art', 'Real Estate', 'Other'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#4FC3C3]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white font-chivo">Investments</h1>
          <p className="text-[#A3A3A3] text-sm mt-1">Track your collectibles and investments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#4FC3C3] text-[#0A0A0A] rounded-lg hover:bg-[#3BA6A6] transition-colors font-medium"
        >
          <Plus size={18} /> Add Investment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-6">
          <p className="text-[#A3A3A3] text-sm font-medium mb-2">Total Invested</p>
          <p className="text-2xl font-bold text-white">{totalInvested.toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK</p>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-6">
          <p className="text-[#A3A3A3] text-sm font-medium mb-2">Current Value</p>
          <p className="text-2xl font-bold text-white">{currentValue.toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK</p>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-6">
          <p className="text-[#A3A3A3] text-sm font-medium mb-2">Total Profit/Loss</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-bold ${profitLoss >= 0 ? 'text-[#4FC3C3]' : 'text-[#EF4444]'}`}>
              {profitLoss.toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK
            </p>
            {profitLoss >= 0 ? (
              <TrendingUp size={20} className="text-[#4FC3C3]" />
            ) : (
              <TrendingDown size={20} className="text-[#EF4444]" />
            )}
          </div>
          <p className={`text-sm mt-1 ${profitLoss >= 0 ? 'text-[#4FC3C3]' : 'text-[#EF4444]'}`}>
            {profitLossPct}%
          </p>
        </div>
      </div>

      {/* Investments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {investments.length === 0 ? (
          <div className="col-span-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-8 text-center">
            <LineChartIcon size={48} className="mx-auto text-[#4FC3C3] mb-4 opacity-50" />
            <p className="text-[#A3A3A3]">No investments yet. Create one to get started!</p>
          </div>
        ) : (
          investments.map((inv) => (
            <div
              key={inv.id}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-5 cursor-pointer hover:border-[#4FC3C3]/50 transition-colors"
              onClick={() => handleViewDetail(inv)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-white font-bold font-chivo">{inv.name}</h3>
                  <p className="text-[#A3A3A3] text-xs">{inv.category}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(inv.id);
                  }}
                  className="text-[#6B6B6B] hover:text-[#EF4444] transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-[#A3A3A3]">Quantity:</span>
                  <span className="text-white font-medium">{inv.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A3A3A3]">Buy Price:</span>
                  <span className="text-white font-medium">{(inv.buy_price || 0).toFixed(0)} SEK</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A3A3A3]">Current Value:</span>
                  <span className="text-white font-medium">{(inv.current_value || 0).toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK</span>
                </div>
              </div>

              <div className={`p-2 rounded text-center ${inv.profit_loss_pct >= 0 ? 'bg-[#4FC3C3]/10' : 'bg-[#EF4444]/10'}`}>
                <p className={inv.profit_loss_pct >= 0 ? 'text-[#4FC3C3]' : 'text-[#EF4444]'}>
                  {inv.profit_loss_pct >= 0 ? '+' : ''}{(inv.profit_loss_pct || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Investment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white font-chivo">Add Investment</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#A3A3A3] hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddInvestment} className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Pokemon 1st Edition Charizard"
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-3 py-2 text-white placeholder-[#6B6B6B] focus:border-[#4FC3C3] outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">Category</label>
                <div className="space-y-2">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-3 py-2 text-white focus:border-[#4FC3C3] outline-none transition-colors"
                  >
                    <option value="">Select or type category</option>
                    {categoryPresets.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Or type custom category"
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-3 py-2 text-white placeholder-[#6B6B6B] focus:border-[#4FC3C3] outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="e.g., 1"
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-3 py-2 text-white placeholder-[#6B6B6B] focus:border-[#4FC3C3] outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-medium mb-1">Buy Price (per unit)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.buy_price}
                    onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
                    placeholder="e.g., 5000"
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-3 py-2 text-white placeholder-[#6B6B6B] focus:border-[#4FC3C3] outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-3 py-2 text-white focus:border-[#4FC3C3] outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add notes about this investment"
                  rows="2"
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-3 py-2 text-white placeholder-[#6B6B6B] focus:border-[#4FC3C3] outline-none transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#4FC3C3] text-[#0A0A0A] rounded py-2 font-medium hover:bg-[#3BA6A6] transition-colors"
                >
                  Create Investment
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-[#2A2A2A] text-white rounded py-2 font-medium hover:bg-[#3A3A3A] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Investment Detail Modal */}
      {showDetailModal && selectedInvestment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white font-chivo">{selectedInvestment.name}</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedInvestment(null);
                }}
                className="text-[#A3A3A3] hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Investment Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded p-3">
                <p className="text-[#A3A3A3] text-xs mb-1">Category</p>
                <p className="text-white font-medium text-sm">{selectedInvestment.category}</p>
              </div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded p-3">
                <p className="text-[#A3A3A3] text-xs mb-1">Quantity</p>
                <p className="text-white font-medium text-sm">{selectedInvestment.quantity}</p>
              </div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded p-3">
                <p className="text-[#A3A3A3] text-xs mb-1">Total Invested</p>
                <p className="text-white font-medium text-sm">
                  {(selectedInvestment.quantity * selectedInvestment.buy_price).toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK
                </p>
              </div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded p-3">
                <p className="text-[#A3A3A3] text-xs mb-1">Current Value</p>
                <p className="text-white font-medium text-sm">
                  {(selectedInvestment.current_value || 0).toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK
                </p>
              </div>
            </div>

            {/* Profit/Loss */}
            <div className={`p-4 rounded-lg mb-6 ${selectedInvestment.profit_loss_pct >= 0 ? 'bg-[#4FC3C3]/10' : 'bg-[#EF4444]/10'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[#A3A3A3] text-sm mb-1">Profit / Loss</p>
                  <p className={`text-2xl font-bold ${selectedInvestment.profit_loss_pct >= 0 ? 'text-[#4FC3C3]' : 'text-[#EF4444]'}`}>
                    {selectedInvestment.profit_loss_pct >= 0 ? '+' : ''}{(selectedInvestment.profit_loss || 0).toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK
                  </p>
                </div>
                <p className={`text-xl font-bold ${selectedInvestment.profit_loss_pct >= 0 ? 'text-[#4FC3C3]' : 'text-[#EF4444]'}`}>
                  {selectedInvestment.profit_loss_pct >= 0 ? '+' : ''}{selectedInvestment.profit_loss_pct}%
                </p>
              </div>
            </div>

            {/* Price History Chart */}
            {selectedInvestment.history && selectedInvestment.history.length > 0 && (
              <div className="mb-6">
                <h3 className="text-white font-bold font-chivo mb-3">Price History</h3>
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded p-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={selectedInvestment.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                      <XAxis
                        dataKey="recorded_date"
                        stroke="#6B6B6B"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis stroke="#6B6B6B" style={{ fontSize: '12px' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1A1A1A',
                          border: '1px solid #2A2A2A',
                          borderRadius: '6px'
                        }}
                        labelStyle={{ color: '#A3A3A3' }}
                        formatter={(value) => [
                          `${value.toLocaleString('sv-SE', { minimumFractionDigits: 0 })} SEK`,
                          'Value'
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="recorded_value"
                        stroke="#4FC3C3"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedInvestment(selectedInvestment);
                  setUpdateData({
                    current_value: selectedInvestment.current_value.toString(),
                    date: new Date().toISOString().split('T')[0]
                  });
                  setShowDetailModal(false);
                  setShowUpdateModal(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-[#4FC3C3] text-[#0A0A0A] rounded py-2 font-medium hover:bg-[#3BA6A6] transition-colors"
              >
                <Edit2 size={16} /> Log New Price
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedInvestment(null);
                }}
                className="flex-1 bg-[#2A2A2A] text-white rounded py-2 font-medium hover:bg-[#3A3A3A] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Value Modal */}
      {showUpdateModal && selectedInvestment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white font-chivo mb-4">Log New Price</h2>

            <form onSubmit={handleUpdateValue} className="space-y-4">
              <div>
                <p className="text-[#A3A3A3] text-sm mb-3">{selectedInvestment.name}</p>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-1">Current Value (SEK)</label>
                <input
                  type="number"
                  step="0.01"
                  value={updateData.current_value}
                  onChange={(e) => setUpdateData({ ...updateData, current_value: e.target.value })}
                  placeholder="e.g., 5500"
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-3 py-2 text-white placeholder-[#6B6B6B] focus:border-[#4FC3C3] outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={updateData.date}
                  onChange={(e) => setUpdateData({ ...updateData, date: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-3 py-2 text-white focus:border-[#4FC3C3] outline-none transition-colors"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#4FC3C3] text-[#0A0A0A] rounded py-2 font-medium hover:bg-[#3BA6A6] transition-colors"
                >
                  Update Value
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateModal(false);
                    setShowDetailModal(true);
                  }}
                  className="flex-1 bg-[#2A2A2A] text-white rounded py-2 font-medium hover:bg-[#3A3A3A] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
