import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Loader2, PiggyBank, Target, Users, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { API } from '../config/api';

const fmt = (n) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const ICONS = ['🎯', '✈️', '🚗', '💻', '🏠', '💍', '🎓', '🏥'];

export default function Savings() {
  const { t } = useLanguage();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [goalModal, setGoalModal] = useState(false);
  const [contribModal, setContribModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  
  // States
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Forms
  const [goalForm, setGoalForm] = useState({ name: '', target_amount: '', target_date: '', icon: '🎯' });
  const [contribForm, setContribForm] = useState({ amount: '', contributor_name: 'Me', date: new Date().toISOString().split('T')[0] });

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await axios.get(`${API}/savings`, { headers: { 'Authorization': `Bearer ${token}` } });
      setGoals(Array.isArray(res.data) ? res.data : []);
      
      // Update selected goal if details modal is open
      if (selectedGoal) {
        const updated = res.data.find(g => g.id === selectedGoal.id);
        if (updated) setSelectedGoal(updated);
      }
    } catch { toast.error('Failed to load savings goals'); } 
    finally { setLoading(false); }
  }, [selectedGoal]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      await axios.post(`${API}/savings`, {
        ...goalForm,
        target_amount: parseFloat(goalForm.target_amount)
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      toast.success('Savings goal created!');
      setGoalModal(false);
      fetchGoals();
    } catch { toast.error('Failed to create goal'); } 
    finally { setSaving(false); }
  };

  const handleAddContribution = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      await axios.post(`${API}/savings/${selectedGoal.id}/contribute`, {
        amount: parseFloat(contribForm.amount),
        contributor_name: contribForm.contributor_name || 'Anonymous',
        date: contribForm.date
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      toast.success('Contribution added!');
      setContribModal(false);
      fetchGoals(); // Will automatically update the selectedGoal data
    } catch { toast.error('Failed to add contribution'); } 
    finally { setSaving(false); }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this goal entirely?')) return;
    try {
      const token = localStorage.getItem('session_token');
      await axios.delete(`${API}/savings/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      toast.success('Goal deleted');
      setDetailModal(false);
      fetchGoals();
    } catch { toast.error('Failed to delete goal'); }
  };

  const totalSavedAll = goals.reduce((sum, g) => sum + (g.total_saved || 0), 0);
  const totalTargetAll = goals.reduce((sum, g) => sum + (g.target_amount || 0), 0);

  return (
    <div className="space-y-5" data-testid="savings-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          Shared Savings Goals
        </h1>
        <button onClick={() => { setGoalForm({ name: '', target_amount: '', target_date: '', icon: '🎯' }); setGoalModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)]"
        >
          <Plus size={15} /> Create Goal
        </button>
      </div>

      {/* Master Progress */}
      {goals.length > 0 && (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#4FC3C3]/10 text-[#4FC3C3] rounded-full flex items-center justify-center">
              <PiggyBank size={24} />
            </div>
            <div>
              <p className="text-[#A3A3A3] text-sm font-semibold uppercase tracking-widest">Total Master Saved</p>
              <p className="text-white text-2xl font-black tabular-nums">{fmt(totalSavedAll)} <span className="text-sm text-[#6B6B6B]">/ {fmt(totalTargetAll)} SEK</span></p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[#4FC3C3] font-bold text-xl">{totalTargetAll > 0 ? ((totalSavedAll/totalTargetAll)*100).toFixed(1) : 0}%</p>
            <p className="text-[#6B6B6B] text-xs">Overall Progress</p>
          </div>
        </div>
      )}

      {/* Goal Cards */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#4FC3C3]" size={32} /></div>
      ) : goals.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-16 flex flex-col items-center justify-center text-center gap-3">
          <Target size={48} className="text-[#2A2A2A]" />
          <p className="text-[#A3A3A3]">No savings goals yet. Start planning for the future!</p>
          <button onClick={() => setGoalModal(true)} className="text-[#4FC3C3] font-bold hover:underline">Create your first goal &rarr;</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(goal => {
            const pct = goal.target_amount > 0 ? (goal.total_saved / goal.target_amount) * 100 : 0;
            const contributors = new Set(goal.contributions.map(c => c.contributor_name)).size;
            
            return (
              <div key={goal.id} onClick={() => { setSelectedGoal(goal); setDetailModal(true); }}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-5 hover:border-[#4FC3C3]/30 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{goal.icon}</span>
                      <div>
                        <h3 className="text-white font-bold text-lg leading-tight">{goal.name}</h3>
                        {contributors > 1 && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-[#8B5CF6]/20 text-[#8B5CF6] px-1.5 py-0.5 rounded-sm font-bold uppercase mt-1">
                            <Users size={10} /> Shared ({contributors})
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={(e) => handleDelete(goal.id, e)} className="text-[#6B6B6B] hover:text-[#EF4444] opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="mb-2 flex justify-between items-end">
                    <p className="text-white font-black tabular-nums text-xl">{fmt(goal.total_saved)} SEK</p>
                    <p className="text-[#6B6B6B] text-xs">of {fmt(goal.target_amount)}</p>
                  </div>
                  <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-[#4FC3C3] transition-all duration-700" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <p className="text-right text-[#4FC3C3] text-[10px] font-bold">{pct.toFixed(1)}% Funded</p>
                </div>

                {goal.target_date && (
                  <div className="mt-4 pt-3 border-t border-[#2A2A2A] flex items-center gap-2 text-[#A3A3A3] text-xs">
                    <Calendar size={12} className="text-[#F59E0B]" /> Target: {new Date(goal.target_date).toLocaleDateString('en-SE', { month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Details Modal */}
      <Dialog open={detailModal} onOpenChange={setDetailModal}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedGoal && (
            <>
              <DialogHeader className="border-b border-[#2A2A2A] pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{selectedGoal.icon}</span>
                  <div>
                    <DialogTitle className="text-2xl font-black text-white tracking-tight">{selectedGoal.name}</DialogTitle>
                    {selectedGoal.target_date && <p className="text-[#F59E0B] text-xs font-bold uppercase tracking-widest mt-1">Target Date: {selectedGoal.target_date}</p>}
                  </div>
                </div>
              </DialogHeader>

              {/* Contributor Breakdown */}
              {selectedGoal.contributions.length > 0 && (
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4 mb-6">
                  <h4 className="text-xs font-bold text-[#A3A3A3] uppercase tracking-widest mb-3">Funding Breakdown</h4>
                  <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
                    {/* Calculate dynamic share colors based on contributor */}
                    {Object.entries(
                      selectedGoal.contributions.reduce((acc, c) => {
                        acc[c.contributor_name] = (acc[c.contributor_name] || 0) + c.amount;
                        return acc;
                      }, {})
                    ).map(([name, amount], i) => {
                      const colors = ['#4FC3C3', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899'];
                      const sharePct = (amount / selectedGoal.total_saved) * 100;
                      return <div key={name} style={{ width: `${sharePct}%`, backgroundColor: colors[i % colors.length] }} title={`${name}: ${sharePct.toFixed(1)}%`} />
                    })}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(
                      selectedGoal.contributions.reduce((acc, c) => {
                        acc[c.contributor_name] = (acc[c.contributor_name] || 0) + c.amount;
                        return acc;
                      }, {})
                    ).map(([name, amount], i) => {
                      const colors = ['#4FC3C3', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899'];
                      return (
                        <div key={name} className="flex items-center gap-1.5 text-xs">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                          <span className="text-white font-bold">{name}:</span>
                          <span className="text-[#A3A3A3]">{fmt(amount)} SEK</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white uppercase tracking-widest text-sm">Contribution History</h3>
                <button onClick={() => { setContribForm({ amount: '', contributor_name: 'Me', date: new Date().toISOString().split('T')[0] }); setContribModal(true); }} 
                  className="bg-[#4FC3C3] text-[#0A0A0A] font-bold text-xs px-3 py-1.5 rounded-sm hover:bg-[#3AA8A8]">
                  + Add Funds
                </button>
              </div>

              {selectedGoal.contributions.length === 0 ? (
                <div className="text-center py-8 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm text-[#6B6B6B] text-sm">No funds added yet. Be the first!</div>
              ) : (
                <div className="space-y-2">
                  {selectedGoal.contributions.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center text-xs font-bold text-white">
                          {c.contributor_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-bold">{c.contributor_name}</p>
                          <p className="text-[#6B6B6B] text-[10px]">{c.date}</p>
                        </div>
                      </div>
                      <p className="text-[#4FC3C3] font-bold tabular-nums">+{fmt(c.amount)} SEK</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Goal Modal */}
      <Dialog open={goalModal} onOpenChange={setGoalModal}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-sm">
          <DialogTitle>New Savings Goal</DialogTitle>
          <form onSubmit={handleCreateGoal} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-bold uppercase text-[#4FC3C3] mb-2 block">Choose Icon</label>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map(i => (
                  <button key={i} type="button" onClick={() => setGoalForm({...goalForm, icon: i})}
                    className={`w-10 h-10 rounded-sm text-xl transition-all ${goalForm.icon === i ? 'bg-[#4FC3C3] border border-[#4FC3C3]' : 'bg-[#0A0A0A] border border-[#2A2A2A] hover:bg-[#2A2A2A]'}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <input type="text" value={goalForm.name} onChange={e => setGoalForm({...goalForm, name: e.target.value})} placeholder="Goal Name (e.g. Japan Trip)" required className="w-full p-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm text-sm" />
            <input type="number" value={goalForm.target_amount} onChange={e => setGoalForm({...goalForm, target_amount: e.target.value})} placeholder="Target Amount (SEK)" required min="1" className="w-full p-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm text-sm" />
            <input type="date" value={goalForm.target_date} onChange={e => setGoalForm({...goalForm, target_date: e.target.value})} className="w-full p-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm text-sm [color-scheme:dark]" />
            <button type="submit" disabled={saving} className="w-full p-2 bg-[#4FC3C3] text-[#0A0A0A] font-bold rounded-sm">Save Goal</button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Contribution Modal */}
      <Dialog open={contribModal} onOpenChange={setContribModal}>
        <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-sm">
          <DialogTitle>Add Funds</DialogTitle>
          <form onSubmit={handleAddContribution} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-bold uppercase text-[#A3A3A3] mb-1 block">Contributor Name</label>
              <input type="text" value={contribForm.contributor_name} onChange={e => setContribForm({...contribForm, contributor_name: e.target.value})} placeholder="e.g. Me, Alice, Team" required className="w-full p-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[#A3A3A3] mb-1 block">Amount (SEK)</label>
              <input type="number" value={contribForm.amount} onChange={e => setContribForm({...contribForm, amount: e.target.value})} placeholder="0" required min="1" className="w-full p-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm text-sm" />
            </div>
            <input type="date" value={contribForm.date} onChange={e => setContribForm({...contribForm, date: e.target.value})} required className="w-full p-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm text-sm [color-scheme:dark]" />
            <button type="submit" disabled={saving} className="w-full p-2 bg-[#4FC3C3] text-[#0A0A0A] font-bold rounded-sm">Confirm Payment</button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}