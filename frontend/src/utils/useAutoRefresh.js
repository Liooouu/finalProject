import { useEffect, useRef } from "react";
import { subscribeToDataChanges } from "./dataSync";

/**
 * Keeps a screen current without a full-page reload: refetches when another
 * tab reports a change, when the tab regains focus, and on a slow fallback
 * interval for changes made from another device.
 */
export const useAutoRefresh = (
  callback,
  { interval = 10000, enabled = true } = {}
) => {
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    let disposed = false;
    let running = false;
    let queued = false;

    const run = async () => {
      if (disposed) return;
      if (running) {
        queued = true;
        return;
      }
      if (document.visibilityState === "hidden") return;

      running = true;
      try {
        await latest.current({ silent: true });
      } catch (err) {
        console.error(err);
      } finally {
        running = false;
        if (queued && !disposed) {
          queued = false;
          run();
        }
      }
    };

    const unsubscribe = subscribeToDataChanges(run);
    const onFocus = () => run();
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(run, interval);

    return () => {
      disposed = true;
      clearInterval(timer);
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [interval, enabled]);
};
