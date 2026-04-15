import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:3000/api", // adjust if your backend URL/port differs
  withCredentials: true,
});

export default apiClient;
