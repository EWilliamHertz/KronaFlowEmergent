import { useState } from 'react';
import axios from 'axios';
import { Loader2, User, Globe, DollarSign, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CURRENCIES = ['SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK'];
const SECTIONS = ['profile', 'preferences', 'security'];
const SECTION_ICONS = { profile: User, preferences: Globe, security: Shield };

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
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put(`${API}/profile`, profile);
      updateUser(res.data);
      setLanguage(profile.language);
      toast.success(t('common.success') + ': Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'));
    } finally { setSaving(false); }
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
                  <span className="capitalize">{t(`settings.${s}`) || s}</span>
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
              <div>
                <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Chivo, sans-serif' }}>
                  {t('settings.profile')}
                </h2>

                {/* Avatar */}
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
                    <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">
                      {t('settings.name')}
                    </label>
                    <input type="text" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                      data-testid="profile-name-input"
                      className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">
                      {t('settings.email')}
                    </label>
                    <input type="email" value={user?.email || ''} disabled
                      className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-[#6B6B6B] rounded-sm text-sm cursor-not-allowed"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">
                      {t('settings.organization')}
                    </label>
                    <input type="text" value={profile.organization} onChange={e => setProfile(p => ({ ...p, organization: e.target.value }))}
                      placeholder="Optional"
                      className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] placeholder:text-[#6B6B6B]"
                    />
                  </div>
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
              <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Chivo, sans-serif' }}>
                {t('settings.preferences')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">
                    {t('settings.language')}
                  </label>
                  <div className="flex rounded-sm border border-[#2A2A2A] overflow-hidden">
                    {['en', 'sv'].map(lang => (
                      <button key={lang} type="button"
                        onClick={() => { setProfile(p => ({ ...p, language: lang })); setLanguage(lang); }}
                        data-testid={`lang-${lang}`}
                        className={`flex-1 py-2.5 text-sm font-semibold uppercase transition-all ${
                          profile.language === lang
                            ? 'bg-[#4FC3C3] text-[#0A0A0A]'
                            : 'bg-transparent text-[#A3A3A3] hover:text-white'
                        }`}
                      >
                        {lang === 'en' ? '🇬🇧 English' : '🇸🇪 Svenska'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">
                    {t('settings.currency')}
                  </label>
                  <select value={profile.currency} onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}
                    data-testid="currency-select"
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3]"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c} className="bg-[#1A1A1A]">{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4">
                <p className="text-xs text-[#A3A3A3] leading-relaxed">
                  Language affects all text in the application. Currency affects how amounts are displayed on the dashboard.
                </p>
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

          {/* Security Section */}
          {active === 'security' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Chivo, sans-serif' }}>
                {t('settings.security')}
              </h2>

              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-4 space-y-3">
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
                  <button
                    onClick={() => toast.info('Password change requires current session verification.')}
                    className="px-4 py-2 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-[#A3A3A3] text-xs font-medium hover:bg-[#2A2A2A] hover:text-white transition-all"
                  >
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
