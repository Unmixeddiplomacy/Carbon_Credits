import axios from "axios";

const envApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE_URL =
  envApiUrl ??
  (import.meta.env.PROD ? "/api" : "http://localhost:3000/api");

if (import.meta.env.PROD && !envApiUrl) {
  console.warn("VITE_API_URL is not set. Using '/api' fallback for frontend-backend same-origin deployments.");
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export default apiClient;
