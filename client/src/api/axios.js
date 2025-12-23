import axios from "axios";
import { storage } from "../utils/storage";

const api = axios.create({
  baseURL: "http://localhost:5051/api", // adjust to your backend
});

// Later when you add JWT:
api.interceptors.request.use((config) => {
  const token = storage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
