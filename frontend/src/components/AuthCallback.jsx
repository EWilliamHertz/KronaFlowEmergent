import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
axios.defaults.withCredentials = true;

export default function AuthCallback() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use useRef to prevent double-processing under StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const sessionId = params.get('session_id');

    if (!sessionId) {
      navigate('/login');
      return;
    }

    axios
      .get(`${API}/auth/session?session_id=${sessionId}`)
      .then((res) => {
        updateUser(res.data.user);
        // Navigate immediately with user data to skip auth check
        navigate('/dashboard', { state: { user: res.data.user }, replace: true });
      })
      .catch(() => {
        navigate('/login', { replace: true });
      });
  }, [navigate, updateUser]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#4FC3C3] border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-[#4FC3C3]/20" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white text-sm font-semibold">Authenticating...</p>
          <p className="text-[#6B6B6B] text-xs mt-1">Please wait</p>
        </div>
      </div>
    </div>
  );
}
