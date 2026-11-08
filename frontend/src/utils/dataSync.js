import { startRecordUpdates } from './recordUpdates';

const CHANNEL_NAME = "tracked:data-sync";
const EVENT_NAME = "tracked:data-changed";

let channel = null;
let subscribers = 0;
let stopRecordUpdates = null;

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
  subscribers += 1;
  if (!stopRecordUpdates) stopRecordUpdates = startRecordUpdates(() => dispatch({ source: 'server', at: Date.now() }));
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    window.removeEventListener(EVENT_NAME, listener);
    subscribers -= 1;
    if (!subscribers) {
      stopRecordUpdates?.();
      stopRecordUpdates = null;
    }
  };
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopRecordUpdates?.();
    channel?.close();
    channel = null;
  });
}
