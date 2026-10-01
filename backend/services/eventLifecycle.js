// services/eventLifecycle.js
// Single source of truth for when an event starts, when it ends, and what
// counts as an active status. The background job, the routes and the reports
// all agree because they all ask these helpers instead of re-deriving the
// date math (which previously compared a UTC-midnight date against local
// midnight — right in UTC+8, off by one day in negative offsets).

const STATUS = {
  UPCOMING: "upcoming",
  LIVE: "live",
  FINISHED: "finished",
  CLOSED: "closed",
};

const EVENT_STATUSES = [STATUS.UPCOMING, STATUS.LIVE, STATUS.FINISHED, STATUS.CLOSED];

// Ended either because the clock ran out or because a human closed it.
const TERMINAL_STATUSES = [STATUS.FINISHED, STATUS.CLOSED];

// Query fragment: every event that is still going to happen / happening.
const OPEN_STATUS_FILTER = { status: { $nin: TERMINAL_STATUSES } };

const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

function parseClock(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

// `date` is stored as UTC midnight (the browser sends YYYY-MM-DD), so the
// calendar day has to be read from the UTC parts and then rebuilt in the
// server's local timezone — the school runs on wall-clock time.
function localDayStart(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    0,
    0,
    0,
    0
  );
}

// Instant the event is scheduled to begin.
function eventStartsAt(event) {
  const day = localDayStart(event.date);
  if (!day) return null;
  const clock = parseClock(event.time);
  if (!clock) return day;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), clock.hours, clock.minutes);
}

// Instant the event is over: its own end date/time, falling back to the end of
// the attendance window and then to midnight of that day.
function eventEndAt(event) {
  const day = localDayStart(event.endDate || event.date);
  if (!day) return null;
  const clock = parseClock(event.endTime || event.attendanceEndTime);
  if (!clock) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  }
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), clock.hours, clock.minutes);
}

// Events a human has taken control of are left alone by the automation.
function isAutomated(event) {
  return !event.manualOverride;
}

// Flip to live once the event's start time has arrived but it has not ended.
function shouldAutoGoLive(event, now = new Date()) {
  if (event.status !== STATUS.UPCOMING || !isAutomated(event)) return false;
  const startsAt = eventStartsAt(event);
  const endsAt = eventEndAt(event);
  if (!startsAt || !endsAt) return false;
  if (endsAt <= startsAt) return false;
  return now >= startsAt && now < endsAt;
}

// Flip to finished once the event's end time has arrived.
function shouldAutoFinish(event, now = new Date()) {
  if (isTerminal(event.status) || !isAutomated(event)) return false;
  const endsAt = eventEndAt(event);
  return !!endsAt && now >= endsAt;
}

// Decide whether the background job should keep running on an event.
//
// Returns true/false to pin or release the event, or undefined to leave
// `manualOverride` untouched. Three rules, in order:
//
//   1. Reopening an ended event hands it back to the clock — that is the whole
//      point of reopening, so it must not stay pinned.
//   2. A status the client actually *changed* is a human decision, so it pins.
//      Echoing the status that is already stored is not a decision: the edit
//      form resubmits it on every save, and treating that as a manual choice
//      would silently freeze any event whose schedule was edited.
//   3. Otherwise, touching the schedule releases the event, because extending
//      an event is how an organizer says "this is still running".
function resolveAutomation({ currentStatus, nextStatus, scheduleTouched }) {
  const statusSent = nextStatus !== undefined;
  const reopening = statusSent && nextStatus === STATUS.UPCOMING && isTerminal(currentStatus);

  if (reopening) return false;
  if (statusSent && nextStatus !== currentStatus) return true;
  if (scheduleTouched) return false;
  return undefined;
}

// Notification body for "this event is running now", shared by the automatic
// transition and the manual status change so the wording cannot drift.
function eventLiveNotification(event) {
  return {
    type: "info",
    title: "Event Live Now",
    message: `"${event.title}" is now live! Attendance closes at ${event.attendanceEndTime}.`,
  };
}

module.exports = {
  STATUS,
  EVENT_STATUSES,
  TERMINAL_STATUSES,
  OPEN_STATUS_FILTER,
  isTerminal,
  isAutomated,
  eventStartsAt,
  eventEndAt,
  shouldAutoGoLive,
  shouldAutoFinish,
  resolveAutomation,
  eventLiveNotification,
};