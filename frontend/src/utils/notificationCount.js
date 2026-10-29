import api from "../api/axios";

const RETRY_DELAYS = [800, 2400];
const cancelled = () => Object.assign(new Error("Notification request cancelled"), { code: "ERR_CANCELED" });

const waitForRetry = (delay, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(cancelled()); return; }
  const onAbort = () => { clearTimeout(timer); reject(cancelled()); };
  const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, delay);
  signal?.addEventListener("abort", onAbort, { once: true });
});

// Retry brief API/proxy outages without replacing the last known badge count.
// Authentication/permission errors and cancelled requests are never retried.
export async function fetchNotificationCount(signal) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await api.get("/notifications/unread-count", { signal, timeout: 8000 });
      const count = response.data?.count;
      if (!Number.isInteger(count) || count < 0) throw Object.assign(new Error("Invalid unread count"), { code: "INVALID_UNREAD_COUNT" });
      return count;
    } catch (error) {
      const status = error.response?.status;
      const temporary = status >= 500 || ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"].includes(error.code);
      if (signal?.aborted || !temporary || attempt >= RETRY_DELAYS.length) throw error;
      await waitForRetry(RETRY_DELAYS[attempt], signal);
    }
  }
}
