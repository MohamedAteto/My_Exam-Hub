import axios from 'axios';
import { storage, logoutFromCas } from "../utils/storage";

const getDefaultApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5500/api';
  }

  return 'https://exam.sewedy.com.eg/api';
};

const api = axios.create({
  baseURL: getDefaultApiBaseUrl(),
  timeout: 15000,
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {

    const token = storage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRedirecting = false;
let isSsoCallback = false;

// Set flag when on SSO callback page
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    isSsoCallback = window.location.pathname.includes('/sso-callback');
  });
}

// Response interceptor for handling errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle unauthorized access
    if (error.response?.status === 401) {
      const currentToken = storage.getItem('token');
      
      // Don't redirect if we're currently in the SSO callback flow or already redirecting
      const isOnSsoCallback = window.location.pathname.includes('/sso-callback') || 
                             window.location.pathname.includes('/greeting');
      
      if (!isRedirecting && !isOnSsoCallback) {
        isRedirecting = true;
        logoutFromCas(currentToken);
        storage.clear();
        
        const casUrl = import.meta.env.VITE_CAS_URL || 'https://centerlizedlogin.sewedy.com.eg';
        const callbackUrl = encodeURIComponent(`${window.location.origin}/sso-callback`);
        window.location.href = `${casUrl}/login?prompt=login&redirect=${callbackUrl}&businessEntityId=9`;
      } else if (isOnSsoCallback) {
        // If we get a 401 during SSO callback, clear everything and go to login
        console.error('Authentication failed during SSO callback');
        storage.clear();
        // Reset the flag after a delay to allow a fresh attempt
        setTimeout(() => { isRedirecting = false; }, 2000);
      }
    }

    // Conditional logging based on environment
    if (import.meta.env.DEV) {
      console.error('API Request Failed:', {
        url: error.config?.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        data: error.response?.data
      });
    } else {
      // In production, only log minimal info and send to monitoring if available
      console.error('API Error:', error.response?.status || 'Network Error');
      
      // Send to monitoring service if configured
      if (window.errorTracker) {
        window.errorTracker.captureException(error, {
          extra: {
            url: error.config?.url,
            status: error.response?.status
          }
        });
      }
    }

    return Promise.reject(error);
  }
);


export default api;
