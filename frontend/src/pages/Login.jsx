import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) {
          toast.error('Please enter your name');
          setLoading(false);
          return;
        }
        await register(form.email, form.password, form.name);
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left panel */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-12 lg:px-20 max-w-xl mx-auto lg:mx-0 lg:max-w-none w-full lg:w-1/2">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-full bg-[#4FC3C3] flex items-center justify-center shadow-[0_0_16px_rgba(79,195,195,0.5)]">
            <span className="text-[#0A0A0A] font-black text-lg" style={{ fontFamily: 'Chivo, sans-serif' }}>K</span>
          </div>
          <span className="text-white font-black text-xl tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
            KronaFlow
          </span>
        </div>

        <h1 className="text-4xl font-black text-white mb-1 tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {mode === 'login' ? 'Welcome back' : 'Get started'}
        </h1>
        <p className="text-[#A3A3A3] text-sm mb-8">
          {mode === 'login' ? 'Sign in to your KronaFlow account' : 'Create your account — it\'s free'}
        </p>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleLogin}
          data-testid="google-login-btn"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] text-white hover:border-[#4FC3C3]/40 hover:bg-[#2A2A2A] transition-all duration-200 text-sm font-medium mb-5"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.657 14.08 17.64 11.773 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1 h-px bg-[#2A2A2A]" />
          <span className="text-[#6B6B6B] text-xs uppercase tracking-widest font-bold">or</span>
          <div className="flex-1 h-px bg-[#2A2A2A]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-form">
          {mode === 'register' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">
                Full Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
                data-testid="register-name-input"
                className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] focus:border-[#4FC3C3] transition-all placeholder:text-[#6B6B6B] text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
              data-testid="login-email-input"
              className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] focus:border-[#4FC3C3] transition-all placeholder:text-[#6B6B6B] text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                data-testid="login-password-input"
                className="w-full px-4 py-2.5 pr-11 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] focus:border-[#4FC3C3] transition-all placeholder:text-[#6B6B6B] text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#A3A3A3] transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit-btn"
            className="w-full py-2.5 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] font-bold text-sm hover:bg-[#3AA8A8] transition-all duration-200 shadow-[0_0_10px_rgba(79,195,195,0.3)] hover:shadow-[0_0_20px_rgba(79,195,195,0.5)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-[#A3A3A3] text-sm">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            data-testid="toggle-auth-mode"
            className="text-[#4FC3C3] hover:underline font-semibold"
          >
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>

      {/* Right panel */}
      <div className="hidden lg:block w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1762279389006-43963a0cee55?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
          alt="KronaFlow"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0A0A0A]/10 to-[#0A0A0A]" />
        <div className="absolute bottom-16 left-12 right-12">
          <p className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-3">
            Financial Control
          </p>
          <h2 className="text-4xl font-black text-white mb-3 leading-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
            Your finances,<br />fully in control.
          </h2>
          <p className="text-[#A3A3A3] text-sm leading-relaxed">
            Track transactions, manage budgets, monitor assets and debts — all in one powerful dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
