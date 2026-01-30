  import axios from "axios";
// import api from '@/lib/axios';r

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://192.168.1.51:9000/api",
  headers: {
    Accept: "application/json",
  },
  withCredentials: false, 
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log("Token sent:", token.substring(0, 10) + "...");
  } else {
    console.log("No token found in localStorage");
  }
  return config;
});

export default api;
