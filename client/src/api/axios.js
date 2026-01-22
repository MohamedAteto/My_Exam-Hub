import axios from "axios";
import { storage } from "../utils/storage";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // adjust to your backend
});
console.log(import.meta.env.VITE_API_BASE_URL);

// Later when you add JWT:
api.interceptors.request.use((config) => {
  const token = storage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
