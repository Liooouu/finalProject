import axios from "axios";
import { getToken, clearAuth } from "../utils/auth";
import { getDeviceId } from "../utils/device";

const api = axios.create({
  // Relative on purpose: in production nginx serves this SPA and proxies /api
  // to the API container, so the browser only ever talks to one origin. In
  // development the Vite dev server proxies /api to localhost:5000 (see
  // vite.config.js). Both mean no build-time API URL and no CORS.
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Device-Id"] = getDeviceId();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  }
);

export default api;
