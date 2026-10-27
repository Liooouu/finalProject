import { useEffect, useState } from "react";
import api from "../api/axios";
import { subscribeToDataChanges } from "./dataSync";

/**
 * Pending-work badges for the sidebar and the mobile tab bar.
 *
 * Both surfaces show the same numbers, so they share one module-level store
 * with a single poll loop. It starts with the first subscriber and stops with
 * the last one; before this, the drawer and the tab bar each ran their own
 * request burst every minute.
 */
const EMPTY = Object.freeze({});

const shared = {
  role: null,
  counts: EMPTY,
  subscribers: new Set(),
  timer: null,
  unsubscribe: null,
  running: false,
};

const publish = (counts) => {
  shared.counts = counts;
  shared.subscribers.forEach((notify) => notify(counts));
};

const load = async () => {
  const role = shared.role;
  if (!role || shared.running) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

  shared.running = true;
  const next = {};

  try {
    if (role === "organizer") {
      const [stats] = await Promise.allSettled([
        api.get("/organizer/stats"),
      ]);
      if (stats.status === "fulfilled") {
        next.excuses = stats.value.data?.pendingExcuses || 0;
      }
    }

    if (role === "admin") {
      const [stats, appeals] = await Promise.allSettled([
        api.get("/organizer/stats"),
        api.get("/admin/security/face-appeals", { params: { status: "pending" } }),
      ]);
      if (stats.status === "fulfilled") {
        next.excuses = stats.value.data?.pendingExcuses || 0;
      }
      if (appeals.status === "fulfilled") {
        next.appeals = appeals.value.data?.length || 0;
      }
    }
  } finally {
    shared.running = false;
  }

  // A role switch may have happened while the requests were in flight.
  if (shared.role === role) publish(next);
};

const stop = () => {
  if (shared.timer) clearInterval(shared.timer);
  if (shared.unsubscribe) shared.unsubscribe();
  shared.timer = null;
  shared.unsubscribe = null;
};

const start = (role) => {
  if (shared.timer && shared.role === role) return;

  const switched = shared.role !== role;
  stop();
  shared.role = role;
  if (switched) publish(EMPTY);

  shared.unsubscribe = subscribeToDataChanges(load);
  shared.timer = setInterval(load, 60000);
  load();
};

export const useNavCounts = (role) => {
  const [counts, setCounts] = useState(shared.counts);

  useEffect(() => {
    if (!role) return undefined;

    shared.subscribers.add(setCounts);
    start(role);

    return () => {
      shared.subscribers.delete(setCounts);
      if (shared.subscribers.size === 0) stop();
    };
  }, [role]);

  return shared.role === role ? counts : EMPTY;
};
