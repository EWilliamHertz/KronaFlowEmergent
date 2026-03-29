import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { ArrowDown, TrendingUp, ShieldCheck, PieChart, Wallet, ChevronRight } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome back!');
        navigate('/dashboard');
      } else {
        await register(email, password, name);
        toast.success('Account created! Logging in...');
        await login(email, password);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToAuth = () => {
    document.getElementById('auth-section').scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans overflow-x-hidden selection:bg-[#4FC3C3] selection:text-[#0A0A0A]">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#2A2A2A]">
        <img
          src="https://customer-assets.emergentagent.com/job_kronaflow-preview/artifacts/bv380685_IMG_3033.jpeg"
          alt="KronaFlow"
          className="h-10 w-auto object-contain"
style={{ filter: 'invert(1) brightness(1.5)', mixBlendMode: 'screen' }}        />
        <button onClick={scrollToAuth} className="text-sm font-bold text-[#4FC3C3] hover:text-white transition-colors">
          Sign In
        </button>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center pt-20 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#4FC3C3]/5 to-[#0A0A0A] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center z-10">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6" style={{ fontFamily: 'Chivo, sans-serif' }}>
            Master Your Money.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4FC3C3] to-[#10B981]">
              Predict Your Freedom.
            </span>
          </h1>
          <p className="text-[#A3A3A3] text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            KronaFlow is the ultimate financial operating system built for modern professionals. Automatically track cashflow, manage dynamic budgets, and project exactly when you'll be 100% debt-free.
          </p>
          
          <button 
            onClick={scrollToAuth}
            className="group flex items-center justify-center gap-2 mx-auto px-8 py-4 bg-[#4FC3C3] text-[#0A0A0A] rounded-sm font-black text-lg hover:bg-[#3AA8A8] hover:-translate-y-1 transition-all duration-300 shadow-[0_0_30px_rgba(79,195,195,0.3)]"
          >
            Start Your Journey
            <ArrowDown size={20} className="group-hover:translate-y-1 transition-transform" />
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-24 z-10">
          {[
            { icon: PieChart, title: 'Smart Budgets', text: 'Set limits and visually track your monthly utilization across all categories.' },
            { icon: TrendingUp, title: 'Debt Projector', text: 'Instantly calculate your debt-free date based on interest rates and payments.' },
            { icon: ShieldCheck, title: 'Total Privacy', text: 'Bank-grade security ensures your financial data remains yours, and yours alone.' }
          ].map((feat, i) => (
            <div key={i} className="bg-[#1A1A1A] border border-[#2A2A2A] p-8 rounded-sm hover:border-[#4FC3C3]/30 transition-colors">
              <feat.icon size={32} className="text-[#4FC3C3] mb-4" />
              <h3 className="text-lg font-bold mb-2">{feat.title}</h3>
              <p className="text-[#6B6B6B] text-sm leading-relaxed">{feat.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Auth Section */}
      <section id="auth-section" className="min-h-screen flex items-center justify-center p-6 border-t border-[#2A2A2A]">
        <div className="w-full max-w-md bg-[#1A1A1A] p-8 rounded-sm border border-[#2A2A2A] shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#4FC3C3] rounded-full mix-blend-screen filter blur-[100px] opacity-10 pointer-events-none" />

          <div className="text-center mb-8 relative z-10">
            <h2 className="text-3xl font-black text-white mb-2" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-[#6B6B6B] text-sm">
              {isLogin ? 'Enter your credentials to access your dashboard.' : 'Start taking control of your finances today.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {!isLogin && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm focus:outline-none focus:border-[#4FC3C3] focus:ring-1 focus:ring-[#4FC3C3] transition-all"
                  placeholder="John Doe"
                />
              </div>
            )}
            
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm focus:outline-none focus:border-[#4FC3C3] focus:ring-1 focus:ring-[#4FC3C3] transition-all"
                placeholder="you@example.com"
              />
            </div>
            
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#4FC3C3] mb-1 block">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] text-white rounded-sm focus:outline-none focus:border-[#4FC3C3] focus:ring-1 focus:ring-[#4FC3C3] transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-4 bg-[#4FC3C3] text-[#0A0A0A] font-black rounded-sm hover:bg-[#3AA8A8] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center relative z-10">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#A3A3A3] text-sm hover:text-white transition-colors"
            >
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <span className="text-[#4FC3C3] font-bold hover:underline">
                {isLogin ? 'Sign up' : 'Log in'}
              </span>
            </button>
          </div>
        </div>
      </section>
      
    </div>
  );
}