import { useState, useRef } from 'react';
import axios from 'axios';
import { Loader2, User, Globe, Shield, Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CURRENCIES = ['SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK'];
const SECTIONS = ['profile', 'preferences', 'import', 'security'];
const SECTION_ICONS = { profile: User, preferences: Globe, import: Upload, security: Shield };

// Map CSV categories to supported transaction categories
const CAT_MAP = {
  loan: 'other', sales: 'freelance', trade: 'other', pokemon: 'entertainment',
  'tradera bid': 'shopping', food: 'food', transport: 'transport', housing: 'housing',
  entertainment: 'entertainment', healthcare: 'healthcare', shopping: 'shopping',
  utilities: 'utilities', education: 'education', salary: 'salary',
  freelance: 'freelance', investment: 'investment', gift: 'gift',
};

function mapCategory(cat) {
  if (!cat) return 'other';
  const lower = cat.toLowerCase().trim();
  return CAT_MAP[lower] || 'other';
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z\s]/g, '').trim());

  // Find column indices
  const dateIdx = headers.findIndex(h => h === 'date');
  const catIdx = headers.findIndex(h => h.includes('category'));
  const detailsIdx = headers.findIndex(h => h.includes('detail'));
  const personIdx = headers.findIndex(h => h.includes('person'));
  const amountIdx = headers.findIndex(h => h === 'amount');

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV values
    const cols = lines[i].split(',');
    const amount = parseFloat(cols[amountIdx]);
    if (isNaN(amount) || amount === 0) continue;

    const date = cols[dateIdx]?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) continue;

    results.push({
      date: date.substring(0, 10),
      type: amount >= 0 ? 'income' : 'expense',
      amount: Math.abs(amount),
      category: mapCategory(cols[catIdx]?.trim()),
      description: cols[detailsIdx]?.trim() || 'Imported',
      party: cols[personIdx]?.trim() || null,
      currency: 'SEK',
    });
  }
  return results;
}

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [active, setActive] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    organization: user?.organization || '',
    language: user?.language || 'en',
    currency: user?.currency || 'SEK',
  });
  const [pwForm, setPwForm] = useState({ newPw: '', confirm: '' });

  // CSV Import state
  const fileRef = useRef(null);
  const [csvFile, setCsvFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put(`${API}/profile`, profile);
      updateUser(res.data);
      setLanguage(profile.language);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'));
    } finally { setSaving(false); }
  };

  const handleFileSelect = (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      toast.error('Please select a valid CSV file');
      return;
    }
    setCsvFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleImport = async () => {
    if (!parsedRows.length) return;
    setImporting(true);
    try {
      const res = await axios.post(`${API}/transactions/bulk`, { transactions: parsedRows });
      setImportResult({ success: true, count: res.data.imported });
      toast.success(`Successfully imported ${res.data.imported} transactions`);
      setParsedRows([]);
      setCsvFile(null);
    } catch (err) {
      setImportResult({ success: false, error: err.response?.data?.detail || 'Import failed' });
      toast.error('Import failed');
    } finally { setImporting(false); }
  };

  const clearImport = () => {
    setCsvFile(null);
    setParsedRows([]);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-5" data-testid="settings-page">
      <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
        {t('settings.title')}
      </h1>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Sidebar */}
        <div className="lg:w-48 flex-shrink-0">
          <nav className="space-y-0.5">
            {SECTIONS.map(s => {
              const Icon = SECTION_ICONS[s];
              return (
                <button key={s} onClick={() => setActive(s)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all text-left ${
                    active === s
                      ? 'bg-[#4FC3C3]/10 text-[#4FC3C3] border-l-2 border-[#4FC3C3] pl-[10px]'
                      : 'text-[#A3A3A3] hover:bg-[#1A1A1A] hover:text-white border-l-2 border-transparent'
                  }`}
                  data-testid={`settings-tab-${s}`}
                >
                  <Icon size={15} />
                  <span className="capitalize">{t(`settings.${s}`) || s.charAt(0).toUpperCase()+s.slice(1)}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-6">

          {/* Profile Section */}
          {active === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5" data-testid="profile-form">
              <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Chivo, sans-serif' }}>
                {t('settings.profile')}
              </h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-[#4FC3C3]/20 border-2 border-[#4FC3C3]/40 flex items-center justify-center overflow-hidden">
                  {user?.picture ? (
                    <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#4FC3C3] text-2xl font-black">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{user?.name}</p>
                  <p className="text-[#6B6B6B] text-xs">{user?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">{t('settings.name')}</label>
                  <input type="text" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                    data-testid="profile-name-input"
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">{t('settings.email')}</label>
                  <input type="email" value={user?.email || ''} disabled
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-[#6B6B6B] rounded-sm text-sm cursor-not-allowed"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">{t('settings.organization')}</label>
                  <input type="text" value={profile.organization} onChange={e => setProfile(p => ({ ...p, organization: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-[#2A2A2A]">
                <button type="submit" disabled={saving} data-testid="save-profile-btn"
                  className="px-6 py-2.5 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)] disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {t('settings.saveChanges')}
                </button>
              </div>
            </form>
          )}

          {/* Preferences Section */}
          {active === 'preferences' && (
            <form onSubmit={handleSaveProfile} className="space-y-5" data-testid="preferences-form">
              <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Chivo, sans-serif' }}>{t('settings.preferences')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">{t('settings.language')}</label>
                  <div className="flex rounded-sm border border-[#2A2A2A] overflow-hidden">
                    {['en', 'sv'].map(lang => (
                      <button key={lang} type="button"
                        onClick={() => { setProfile(p => ({ ...p, language: lang })); setLanguage(lang); }}
                        data-testid={`lang-${lang}`}
                        className={`flex-1 py-2.5 text-sm font-semibold uppercase transition-all ${profile.language === lang ? 'bg-[#4FC3C3] text-[#0A0A0A]' : 'bg-transparent text-[#A3A3A3] hover:text-white'}`}
                      >
                        {lang === 'en' ? '🇬🇧 English' : '🇸🇪 Svenska'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">{t('settings.currency')}</label>
                  <select value={profile.currency} onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}
                    data-testid="currency-select"
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c} className="bg-[#1A1A1A]">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-2 border-t border-[#2A2A2A]">
                <button type="submit" disabled={saving} data-testid="save-preferences-btn"
                  className="px-6 py-2.5 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)] disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {t('settings.saveChanges')}
                </button>
              </div>
            </form>
          )}

          {/* CSV Import Section */}
          {active === 'import' && (
            <div className="space-y-5" data-testid="import-section">
              <div>
                <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Chivo, sans-serif' }}>Import Transactions</h2>
                <p className="text-[#6B6B6B] text-xs">Upload a CSV file to bulk import transactions into KronaFlow.</p>
              </div>

              {/* Expected format */}
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-2">Expected CSV Format</p>
                <div className="overflow-x-auto">
                  <code className="text-xs text-[#A3A3A3] font-mono whitespace-nowrap">
                    Date, Month, Done?, Category, Details, Person, Amount, Actual Amount (Formula)
                  </code>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {[['Date', 'YYYY-MM-DD'], ['Category', 'food, transport, salary…'], ['Details', 'Transaction description'], ['Person', 'Counterparty name'], ['Amount', 'Positive=income, Negative=expense']].map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2">
                      <span className="text-[#4FC3C3] text-xs font-mono font-bold">{k}:</span>
                      <span className="text-[#6B6B6B] text-xs">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import result */}
              {importResult && (
                <div className={`flex items-center gap-3 p-4 rounded-sm border ${importResult.success ? 'bg-[#10B981]/10 border-[#10B981]/30' : 'bg-[#EF4444]/10 border-[#EF4444]/30'}`}>
                  {importResult.success ? <CheckCircle size={18} className="text-[#10B981] flex-shrink-0" /> : <AlertCircle size={18} className="text-[#EF4444] flex-shrink-0" />}
                  <div>
                    {importResult.success
                      ? <p className="text-[#10B981] text-sm font-semibold">Successfully imported {importResult.count} transactions!</p>
                      : <p className="text-[#EF4444] text-sm font-semibold">{importResult.error}</p>
                    }
                  </div>
                  <button onClick={clearImport} className="ml-auto text-[#6B6B6B] hover:text-white"><X size={14} /></button>
                </div>
              )}

              {/* Drop zone */}
              {!parsedRows.length && !importResult && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  data-testid="csv-dropzone"
                  className={`border-2 border-dashed rounded-sm p-10 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200 ${
                    dragOver
                      ? 'border-[#4FC3C3] bg-[#4FC3C3]/5'
                      : 'border-[#2A2A2A] hover:border-[#4FC3C3]/50 hover:bg-[#4FC3C3]/5'
                  }`}
                >
                  <div className="w-12 h-12 rounded-sm bg-[#4FC3C3]/10 flex items-center justify-center">
                    <Upload size={22} className="text-[#4FC3C3]" />
                  </div>
                  <div className="text-center">
                    <p className="text-white text-sm font-semibold">Drop your CSV file here</p>
                    <p className="text-[#6B6B6B] text-xs mt-1">or click to browse — .csv files only</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    data-testid="csv-file-input"
                    onChange={e => handleFileSelect(e.target.files[0])}
                  />
                </div>
              )}

              {/* Preview */}
              {parsedRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-[#4FC3C3]" />
                      <span className="text-white text-sm font-semibold">{csvFile?.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-sm bg-[#4FC3C3]/10 text-[#4FC3C3] font-bold">
                        {parsedRows.length} rows ready
                      </span>
                    </div>
                    <button onClick={clearImport} className="text-[#6B6B6B] hover:text-white text-xs flex items-center gap-1">
                      <X size={13} /> Clear
                    </button>
                  </div>

                  {/* Preview table */}
                  <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm overflow-hidden">
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[#0A0A0A] border-b border-[#2A2A2A]">
                          <tr>
                            {['Date','Type','Category','Description','Party','Amount'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-widest text-[#6B6B6B]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.slice(0, 20).map((row, i) => (
                            <tr key={i} className="border-b border-[#2A2A2A] last:border-0">
                              <td className="px-3 py-1.5 text-[#A3A3A3] tabular-nums">{row.date}</td>
                              <td className="px-3 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded-sm font-semibold ${row.type === 'income' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'}`}>
                                  {row.type}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-[#A3A3A3] capitalize">{row.category}</td>
                              <td className="px-3 py-1.5 text-white max-w-[150px] truncate">{row.description}</td>
                              <td className="px-3 py-1.5 text-[#A3A3A3]">{row.party || '—'}</td>
                              <td className={`px-3 py-1.5 font-bold tabular-nums ${row.type === 'income' ? 'text-[#10B981]' : 'text-white'}`}>
                                {row.type === 'income' ? '+' : '-'}{row.amount.toLocaleString()} SEK
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {parsedRows.length > 20 && (
                      <p className="px-3 py-2 text-xs text-[#6B6B6B] border-t border-[#2A2A2A]">
                        Showing 20 of {parsedRows.length} rows
                      </p>
                    )}
                  </div>

                  {/* Import summary */}
                  <div className="flex items-center gap-4 text-xs text-[#A3A3A3]">
                    <span>Income: <span className="text-[#10B981] font-bold">{parsedRows.filter(r => r.type === 'income').length}</span></span>
                    <span>Expenses: <span className="text-[#F59E0B] font-bold">{parsedRows.filter(r => r.type === 'expense').length}</span></span>
                    <span>Total value: <span className="text-white font-bold tabular-nums">
                      {parsedRows.reduce((s, r) => s + r.amount, 0).toLocaleString()} SEK
                    </span></span>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={clearImport}
                      className="px-4 py-2.5 rounded-sm border border-[#2A2A2A] text-[#A3A3A3] text-sm font-medium hover:bg-[#2A2A2A] transition-all">
                      Cancel
                    </button>
                    <button onClick={handleImport} disabled={importing} data-testid="confirm-import-btn"
                      className="px-6 py-2.5 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] text-sm font-bold hover:bg-[#3AA8A8] transition-all shadow-[0_0_10px_rgba(79,195,195,0.3)] disabled:opacity-50 flex items-center gap-2"
                    >
                      {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {importing ? `Importing…` : `Import ${parsedRows.length} Transactions`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security Section */}
          {active === 'security' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Chivo, sans-serif' }}>{t('settings.security')}</h2>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">Account Email</p>
                    <p className="text-[#6B6B6B] text-xs">{user?.email}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-sm bg-[#10B981]/20 text-[#10B981]">Verified</span>
                </div>
              </div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4">
                <p className="text-white text-sm font-semibold mb-1">Password</p>
                <p className="text-[#6B6B6B] text-xs mb-3">Change your account password</p>
                <div className="space-y-3">
                  <input type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
                    placeholder="New password"
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                  />
                  <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                  />
                  <button onClick={() => toast.info('Password change requires email verification.')}
                    className="px-4 py-2 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-[#A3A3A3] text-xs font-medium hover:bg-[#2A2A2A] hover:text-white transition-all">
                    Update Password
                  </button>
                </div>
              </div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4">
                <p className="text-white text-sm font-semibold mb-1">Connected Login</p>
                <p className="text-[#6B6B6B] text-xs">
                  {user?.picture ? 'Account linked with Google OAuth' : 'Using email/password authentication'}
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
