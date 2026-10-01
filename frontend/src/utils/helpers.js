export const formatTime12Hour = (time24) => {
  if (!time24) return "";

  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;

  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

// Event lifecycle statuses. The backend closes an event as "finished" when its
// end time passes and keeps "closed" for a manual close, so the two must never
// be collapsed into one label.
export const EVENT_STATUSES = ["upcoming", "live", "finished", "closed"];

export const TERMINAL_EVENT_STATUSES = ["finished", "closed"];

export const isTerminalStatus = (status) =>
  TERMINAL_EVENT_STATUSES.includes(status);

// Splits a list into what a student can still act on and what is history.
// Upcoming first (soonest date first), then finished/closed (most recent first).
export const splitEventsByLifecycle = (events = []) => {
  const byStart = (a, b) => new Date(a.date) - new Date(b.date);
  const byMostRecentEnd = (a, b) => new Date(b.endDate || b.date) - new Date(a.endDate || a.date);

  return {
    active: events.filter((e) => !isTerminalStatus(e.status)).sort(byStart),
    past: events.filter((e) => isTerminalStatus(e.status)).sort(byMostRecentEnd),
  };
};

// Why an event is in the state it is in — shown to organizers and admins so the
// automation never looks arbitrary.
export const describeEventLifecycle = (event) => {
  if (!event) return "";
  if (event.status === "finished") {
    return event.manualOverride
      ? "Status set manually"
      : "Finished automatically when the event ended";
  }
  if (event.status === "closed") {
    return event.manualOverride
      ? "Closed manually"
      : "Closed — automation paused for this event";
  }
  if (event.status === "live" && event.manualOverride) {
    return "Set live manually — automation paused";
  }
  if (event.status === "upcoming" && event.manualOverride) {
    return "Reopened manually — automation paused until the schedule changes";
  }
  return "";
};