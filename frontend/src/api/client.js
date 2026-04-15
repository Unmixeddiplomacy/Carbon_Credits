import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "/api" : "http://localhost:3000/api");

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export default apiClient;
