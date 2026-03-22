import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, PieChart, TrendingUp, CreditCard,
  Settings, Menu, Bell, LogOut, Globe, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, key: 'nav.dashboard' },
  { path: '/transactions', icon: Receipt, key: 'nav.transactions' },
  { path: '/budgets', icon: PieChart, key: 'nav.budgets' },
  { path: '/assets', icon: TrendingUp, key: 'nav.assets' },
  { path: '/debts', icon: CreditCard, key: 'nav.debts' },
  { path: '/settings', icon: Settings, key: 'nav.settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`fixed left-0 top-0 bottom-0 w-[280px] bg-[#1A1A1A] border-r border-[#2A2A2A] z-40 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-[#2A2A2A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#4FC3C3] flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(79,195,195,0.4)]">
              <span className="text-[#0A0A0A] font-black text-base" style={{ fontFamily: 'Chivo, sans-serif' }}>K</span>
            </div>
            <span className="text-white font-black text-lg tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
              KronaFlow
            </span>
          </div>
          <button className="lg:hidden text-[#A3A3A3] hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, key }) => (
            <NavLink
              key={path}
              to={path}
              data-testid={`nav-${path.replace('/', '')}`}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-sm transition-all duration-150 text-sm font-medium ${
                  isActive
                    ? 'bg-[#4FC3C3]/10 text-[#4FC3C3] border-l-2 border-[#4FC3C3] pl-[14px]'
                    : 'text-[#A3A3A3] hover:bg-[#2A2A2A] hover:text-white border-l-2 border-transparent'
                }`
              }
            >
              <Icon size={17} />
              <span>{t(key)}</span>
            </NavLink>
          ))}
        </nav>

        {/* User profile section */}
        <div className="p-3 border-t border-[#2A2A2A]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-[#0A0A0A] border border-[#2A2A2A]">
            <div className="w-8 h-8 rounded-full bg-[#4FC3C3]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user?.picture ? (
                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="text-[#4FC3C3] text-sm font-bold">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-[#6B6B6B] text-xs truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="text-[#6B6B6B] hover:text-[#EF4444] transition-colors duration-150 p-1"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Top Header */}
      <header className="fixed top-0 right-0 left-0 lg:left-[280px] h-[64px] bg-[#1A1A1A]/95 backdrop-blur-xl border-b border-[#2A2A2A] z-30 flex items-center justify-between px-4 lg:px-6">
        <button
          className="lg:hidden text-[#A3A3A3] hover:text-white transition-colors p-1"
          onClick={() => setSidebarOpen(true)}
          data-testid="mobile-menu-btn"
        >
          <Menu size={22} />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2.5">
          {/* Language switcher */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'sv' : 'en')}
            data-testid="language-switcher"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#0A0A0A] border border-[#2A2A2A] text-[#A3A3A3] hover:text-white hover:border-[#4FC3C3]/40 transition-all duration-150 text-xs font-bold uppercase tracking-wider"
          >
            <Globe size={13} />
            {language.toUpperCase()}
          </button>

          {/* Notifications */}
          <button
            data-testid="notifications-btn"
            className="w-8 h-8 flex items-center justify-center rounded-sm bg-[#0A0A0A] border border-[#2A2A2A] text-[#A3A3A3] hover:text-white hover:border-[#4FC3C3]/40 transition-all duration-150"
          >
            <Bell size={15} />
          </button>

          {/* User avatar */}
          <div className="w-8 h-8 rounded-full bg-[#4FC3C3]/20 flex items-center justify-center overflow-hidden border border-[#4FC3C3]/30">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="text-[#4FC3C3] text-xs font-bold">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-[64px] lg:pl-[280px] min-h-screen">
        <div className="p-4 lg:p-6 animate-fadeIn">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
