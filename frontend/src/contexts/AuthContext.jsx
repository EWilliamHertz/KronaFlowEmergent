import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// By using just '/api', Vercel automatically routes it to your Python backend!
const API = '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('session_token');
      if (!token) throw new Error("No token");
      
      const res = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    // FastAPI expects form data for login, NOT json!
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const res = await axios.post(`${API}/auth/jwt/login`, formData);
    localStorage.setItem('session_token', res.data.access_token);
    await checkAuth();
  };

  const register = async (email, password, name) => {
    // 1. Create the user
    await axios.post(`${API}/auth/register`, {
      email,
      password,
      name,
      is_active: true,
      is_superuser: false,
      is_verified: false
    });
    
    // 2. Automatically log them in after creating the account
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('session_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, checkAuth, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);