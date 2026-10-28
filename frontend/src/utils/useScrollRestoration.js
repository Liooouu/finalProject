// utils/useScrollRestoration.js
//
// The dashboards scroll inside a <main>, not the window, so the browser's own
// scroll restoration never applies. Going back to a long list (Manage Users,
// the attendance report) therefore dropped the user at the top and made the
// site feel like it had reloaded. This keeps one scroll offset per route in
// memory for the life of the tab.
//
// Plain memory, not sessionStorage: it only has to survive navigation, not a
// refresh, and this avoids stale offsets from another session.

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const offsets = new Map();

// How long we keep trying to reach the remembered offset. A route renders its
// skeleton first and its data a moment later, so the container is not tall
// enough to hold the offset on the first frame — assigning it then would clamp
// to a shorter distance and (worse) be saved back as the new position.
const RESTORE_WINDOW_MS = 1200;

export function useScrollRestoration() {
  const ref = useRef(null);
  const { pathname, search } = useLocation();
  const key = `${pathname}${search}`;
  // While a restore is in flight, scroll events are the restore itself, not the
  // user, so they must not overwrite the saved offset.
  const restoring = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onScroll = () => {
      if (!restoring.current) offsets.set(key, el.scrollTop);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [key]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const target = offsets.get(key) || 0;
    if (!target) {
      el.scrollTop = 0;
      return undefined;
    }

    restoring.current = true;
    const deadline = performance.now() + RESTORE_WINDOW_MS;
    let frame = 0;
    let timer = 0;

    const finish = () => {
      restoring.current = false;
      clearTimeout(timer);
    };

    const apply = () => {
      if (!restoring.current) return;
      el.scrollTop = target;
      // Done once the container is tall enough to actually hold the offset.
      if (Math.abs(el.scrollTop - target) < 1 || performance.now() > deadline) {
        finish();
        return;
      }
      frame = requestAnimationFrame(apply);
    };

    apply();
    // When something else provides the height (slow API, images), the frame
    // loop may finish early; this is the backstop.
    timer = setTimeout(() => {
      el.scrollTop = target;
      finish();
    }, RESTORE_WINDOW_MS);

    // Scrolling yourself during the restore wins over the restore.
    const cancel = () => finish();
    el.addEventListener("wheel", cancel, { passive: true });
    el.addEventListener("touchstart", cancel, { passive: true });
    el.addEventListener("keydown", cancel);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      restoring.current = false;
      el.removeEventListener("wheel", cancel);
      el.removeEventListener("touchstart", cancel);
      el.removeEventListener("keydown", cancel);
    };
  }, [key]);

  return ref;
}
