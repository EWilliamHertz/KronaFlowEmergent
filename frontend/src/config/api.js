// API Configuration
// This ensures the frontend can talk to the backend regardless of environment

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
