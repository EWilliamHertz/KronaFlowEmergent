import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API = '/api';

// --- GLOBAL SECURITY INTERCEPTOR ---
// This ensures EVERY request on EVERY page automatically includes your token!
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('session_token');
      if (!token) throw new Error("No token found");
      
      const res = await axios.get(`${API}/users/me`);
      setUser(res.data);
    } catch (err) {
      setUser(null);
      localStorage.removeItem('session_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const res = await axios.post(`${API}/auth/jwt/login`, formData);
    localStorage.setItem('session_token', res.data.access_token);
    await checkAuth();
  };

  const register = async (email, password, name) => {
    await axios.post(`${API}/auth/register`, {
      email,
      password,
      name,
      is_active: true,
      is_superuser: false,
      is_verified: false
    });
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('session_token');
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, checkAuth, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);