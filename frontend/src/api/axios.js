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
  if (config._backendRecoveryRole !== undefined && config._backendRecoveryRole !== context) throw new axios.CanceledError("Portal changed while the backend was reconnecting");
  config._backendRecoveryRole = context;
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
  async (error) => {
    const config = error.config;
    const attempts = config?._backendRecoveryAttempts || 0;
    const temporaryOutage = error.response?.status === 503 && error.response?.data?.code === "BACKEND_UNAVAILABLE";
    // Only safe reads from a temporarily disconnected dev proxy are retried.
    // Never repeat approvals, submissions or other writes.
    if (config && (config.method || "get").toLowerCase() === "get" && temporaryOutage && attempts < 2 && !config.signal?.aborted) {
      await new Promise((resolve, reject) => {
        const signal = config.signal;
        const onAbort = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); reject(new axios.CanceledError("Request cancelled")); };
        const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, attempts === 0 ? 800 : 1600);
        signal?.addEventListener("abort", onAbort, { once: true });
        if (signal?.aborted) onAbort();
      });
      return api.request({ ...config, _backendRecoveryAttempts: attempts + 1 });
    }
    if (error.response?.status === 401) {
      clearAuth();
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  }
);

export default api;
