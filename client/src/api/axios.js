import axios from 'axios';
import { storage } from "../utils/storage";

// Prefer a Vite env var `VITE_API_BASE_URL`; in dev fallback to local backend.
// In production this should be set to the deployed API (e.g. https://exam.sewedy.com.eg/api)
const DEFAULT_PROD_BASE = 'https://exam.sewedy.com.eg/api';
const BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? 'http://localhost:5051/api' : DEFAULT_PROD_BASE);

const api = axios.create({
  baseURL: BASE_URL,
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

// Response interceptor for handling errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle unauthorized access
    if (error.response?.status === 401) {
      storage.removeItem('token');
      storage.removeItem('user');
      // Optional: Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // Log detailed error information
    console.error('API Request Failed:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      data: error.response?.data
    });

    return Promise.reject(error);
  }
);


export default api;