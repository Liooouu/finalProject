const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getDeviceId = () => {
  try {
    let id = localStorage.getItem("trackedDeviceId");
    if (!id) {
      id = generateId();
      localStorage.setItem("trackedDeviceId", id);
    }
    return id;
  } catch {
    return generateId();
  }
};

export const getDeviceLabel = () => {
  const ua = navigator.userAgent || "";
  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("OPR/")) browser = "Opera";
  else if (ua.includes("Safari/")) browser = "Safari";

  let os = "Computer";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} on ${os}`;
};