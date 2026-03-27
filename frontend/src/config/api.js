// API Configuration
// This ensures the frontend can talk to the backend regardless of environment

import axios from 'axios';
import { toast } from 'sonner';

// frontend/src/config/api.js
const getAPIUrl = () => {
  // Use the env var if provided (ensure no trailing slash)
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL.replace(/\/$/, '') + '/api';
  }
  
  // Last resort: assume same origin (works with your vercel.json rewrites)
  return '/api';
};

export const API = getAPIUrl();

console.log('🔌 API URL:', API);

// --- GLOBAL AXIOS RESPONSE INTERCEPTOR ---
axios.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || error.message;
    
    console.error('❌ API Error:', { status, detail, url: error.config?.url });
    
    // Handle specific error codes
    if (status === 401) {
      console.warn('⚠️ Unauthorized - session may have expired');
      // Auth context will handle this
    } else if (status === 403) {
      toast.error('Permission denied');
    } else if (status === 404) {
      console.warn('⚠️ Resource not found:', error.config?.url);
    } else if (status === 500) {
      toast.error('Server error - please try again');
    }
    
    // Always re-throw so calling code can handle it
    return Promise.reject(error);
  }
);
