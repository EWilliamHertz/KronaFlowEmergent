// API Configuration
// This ensures the frontend can talk to the backend regardless of environment

import axios from 'axios';
import { toast } from 'sonner';

const getAPIUrl = () => {
  // First priority: environment variable from .env or Vercel
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL.replace(/\/$/, '') + '/api';
  }
  
  // Fallback for local development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000/api';
  }
  
  // Last resort: assume same origin
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
