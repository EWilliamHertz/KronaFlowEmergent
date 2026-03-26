import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

// --- AXIOS INTERCEPTOR ---
// Automatically attach the JWT Bearer token to every request if it exists
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- CHECK AUTH (Get Current User) ---
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('session_token');
    
    // If no token in storage, don't bother pinging the API
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      // fastapi-users endpoint for getting the current user is /users/me
      const res = await axios.get(`${API}/users/me`);
      setUser(res.data);
    } catch (error) {
      console.error("Session invalid or expired");
      localStorage.removeItem('session_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run checkAuth on initial app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // --- LOGIN ---
  const login = async (email, password) => {
    // fastapi-users STRICTLY expects URL Encoded Form Data for login (OAuth2 standard)
    const formData = new URLSearchParams();
    formData.append('username', email); // Must be 'username', even if using an email
    formData.append('password', password);

    const res = await axios.post(`${API}/auth/jwt/login`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Save the new JWT token to local storage
    localStorage.setItem('session_token', res.data.access_token);
    
    // Fetch the user's profile data now that we are authenticated
    await checkAuth();
  };

  // --- REGISTER ---
  const register = async (email, password, name) => {
    // Register uses standard JSON
    await axios.post(`${API}/auth/register`, { 
      email, 
      password, 
      name 
    });

    // fastapi-users does NOT automatically log the user in after registration.
    // We must manually trigger the login flow immediately after a successful register.
    await login(email, password);
  };

  // --- LOGOUT ---
  const logout = async () => {
    try {
      await axios.post(`${API}/auth/jwt/logout`);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Always clear the local state and token, even if the server request fails
      localStorage.removeItem('session_token');
      setUser(null);
    }
  };

  // --- UPDATE USER CONTEXT ---
  const updateUser = (updatedUser) => setUser(updatedUser);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);