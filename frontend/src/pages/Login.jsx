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
    setError('');
    setLoading(true);

    try {
      if (isLoginView) {
        await login(email, password);
      } else {
        await register(email, password, name || 'New User');
      }
      // If we get here, it worked!
      alert("Success! Logging you in...");
      navigate('/dashboard'); 
      
    } catch (err) {
      console.error(err);
      setLoading(false);
      
      // iPad Crash Reporter: This grabs the hidden data from the server
      const status = err.response?.status || "No Status";
      const detail = err.response?.data?.detail || err.response?.data || "No Data";
      const message = err.message;
      
      // Pop it up on the screen
      alert(`🚨 CRASH REPORT 🚨\n\nStatus: ${status}\nError: ${message}\nDetails: ${JSON.stringify(detail)}`);
      
      setError(typeof detail === 'string' ? detail : "Authentication failed. See alert for details.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left panel */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-12 lg:px-20 max-w-xl mx-auto lg:mx-0 lg:max-w-none w-full lg:w-1/2">
        {/* Logo */}
        <div className="mb-10">
          <img
            src="https://customer-assets.emergentagent.com/job_kronaflow-preview/artifacts/bv380685_IMG_3033.jpeg"
            alt="KronaFlow"
            className="h-20 w-auto object-contain"
            style={{ mixBlendMode: 'multiply', filter: 'contrast(1.1)' }}
          />
        </div>

        <h1 className="text-4xl font-black text-white mb-1 tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          {mode === 'login' ? 'Welcome back' : 'Get started'}
        </h1>
        <p className="text-[#A3A3A3] text-sm mb-8">
          {mode === 'login' ? 'Sign in to your KronaFlow account' : 'Create your account — it\'s free'}
        </p>

       
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
