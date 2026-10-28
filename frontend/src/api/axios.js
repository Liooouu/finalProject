import axios from "axios";
import { getToken, getContextRole, clearAuth } from "../utils/auth";
import { announceDataChange } from "../utils/dataSync";

const api = axios.create({
  // Relative on purpose: in production nginx serves this SPA and proxies /api
  // to the API container, so the browser only ever talks to one origin. In
  // development the Vite dev server proxies /api to localhost:5000 (see
  // vite.config.js). Both mean no build-time API URL and no CORS.
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  // A student page may finish a refresh while its owner switches portals.
  // Never send that request with an organizer/admin token from the new page.
  const studentRequest = /^\/student(?:\/|$)/.test(config.url || "");
  const context = getContextRole();
  // Personal academic/face settings belong to the same student account in both
  // portals. The server verifies the stored identity for these endpoints.
  const sharedProfileRequest = context === "organizer" && /^\/student\/(?:academic-status|security\/face-appeals)(?:\?|$)/.test(config.url || "");
  if (studentRequest && context !== "student" && !sharedProfileRequest) throw new axios.CanceledError("Student portal is no longer active");
  const token = getToken(studentRequest && !sharedProfileRequest ? "student" : context);
  if (!token && context && !/^\/auth(?:\/|$)/.test(config.url || "")) {
    window.location.href = "/auth";
    throw new axios.CanceledError("This portal session needs a fresh sign-in");
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = (response.config?.method || "get").toUpperCase();
    const url = response.config?.url || "";
    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
    const isQuiet = /^\/(auth|notifications)\b/.test(url);

    if (isMutation && !isQuiet) {
      announceDataChange({ method, url });
    }

    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  }
);

export default api;
