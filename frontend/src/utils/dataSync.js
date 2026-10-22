const CHANNEL_NAME = "tracked:data-sync";
const EVENT_NAME = "tracked:data-changed";

let channel = null;

const dispatch = (detail = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
};

const ensureChannel = () => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", (event) => dispatch(event.data || {}));
  }
  return channel;
};

export const announceDataChange = (detail = {}) => {
  const payload = { ...detail, at: Date.now() };
  dispatch(payload);
  ensureChannel()?.postMessage(payload);
};

export const subscribeToDataChanges = (handler) => {
  if (typeof window === "undefined") return () => {};
  const listener = (event) => handler(event.detail || {});
  window.addEventListener(EVENT_NAME, listener);
  ensureChannel();
  return () => window.removeEventListener(EVENT_NAME, listener);
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    channel?.close();
    channel = null;
  });
}
