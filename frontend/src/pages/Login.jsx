import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.email, form.password, form.name || 'New User');
      }
      
      // If successful, redirect to dashboard
      navigate('/dashboard'); 
      
    } catch (err) {
      console.error(err);
      
      // iPad Crash Reporter: This grabs the hidden data from the server
      const status = err.response?.status || "No Status";
      const detail = err.response?.data?.detail || err.response?.data || "No Data";
      const message = err.message;
      
      // Pop it up on the screen so we can debug on iPad
      alert(`🚨 CRASH REPORT 🚨\n\nStatus: ${status}\nError: ${message}\nDetails: ${JSON.stringify(detail)}`);
      
      setError(typeof detail === 'string' ? detail : "Authentication failed. See alert for details.");
    } finally {
      setLoading(false);
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

        {/* Error Alert */}
        {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-sm">
                <p className="text-red-400 text-xs font-semibold">{error}</p>
            </div>
        )}

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
              className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm focus:outline-none focus:ring-1 focus:ring-[#4FC3C3] focus:border-[#4FC3C3] transition-all placeholder:text-[#6B6B6B] text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1.5 block">
              Password (Min 8 Characters)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                minLength={8}
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
            className="w-full py-2.5 rounded-sm bg-[#4FC3C3] text-[#0A0A0A] font-bold text-sm hover:bg-[#3AA8A8] transition-all duration-200 shadow-[0_0_10px_rgba(79,195,195,0.3)] hover:shadow-[0_0_20px_rgba(79,195,195,0.5)] disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-[#A3A3A3] text-sm">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
            }}
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