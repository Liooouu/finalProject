// services/eventLifecycle.js
// Single source of truth for when an event starts, when it ends, and what
// counts as an active status. The background job, the routes and the reports
// all agree because they all ask these helpers instead of re-deriving the
// date math.
//
// Every wall-clock value below is resolved in Asia/Manila (UTC+8, no DST), not
// the server's timezone. The API container runs in UTC, so the old
// `new Date(localY, localM, ...)` math was +8h off in production: a 5:45 PM
// attendance window fired its notices at 1:45 AM. Deriving the school clock
// from a fixed offset keeps dev (Windows, PHT) and prod (UTC container) identical.

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

// The school runs on Philippine time. Node reads the server zone (UTC inside
// the container), so every wall-clock instant is anchored to this fixed offset
// instead — the Philippines has never observed DST, so +8 is always correct.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// The current instant shifted so its UTC getters read Manila wall-clock.
function manilaNow(now = new Date()) {
  return new Date(now.getTime() + MANILA_OFFSET_MS);
}

// "HH:mm" on the Manila clock for an instant.
function manilaClock(now = new Date()) {
  const m = manilaNow(now);
  return (
    String(m.getUTCHours()).padStart(2, "0") +
    ":" +
    String(m.getUTCMinutes()).padStart(2, "0")
  );
}

// Calendar day (Y/M/D) of a stored event date. `date` is saved as UTC midnight
// (the browser sends YYYY-MM-DD), so the UTC parts are the organizer's day.
function calendarParts(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    y: parsed.getUTCFullYear(),
    m: parsed.getUTCMonth(),
    d: parsed.getUTCDate(),
  };
}

// Instant at a Manila wall-clock time on a given calendar day.
function manilaInstant(parts, hours = 0, minutes = 0) {
  return new Date(
    Date.UTC(parts.y, parts.m, parts.d, hours, minutes) - MANILA_OFFSET_MS
  );
}

// [start, end] instants of the Manila calendar day that contains `instant`.
function manilaDayRange(instant = new Date()) {
  const m = manilaNow(instant);
  const y = m.getUTCFullYear();
  const mo = m.getUTCMonth();
  const d = m.getUTCDate();
  return {
    start: new Date(Date.UTC(y, mo, d) - MANILA_OFFSET_MS),
    end: new Date(Date.UTC(y, mo, d + 1) - MANILA_OFFSET_MS - 1),
  };
}

// Instant the event is scheduled to begin.
function eventStartsAt(event) {
  const parts = calendarParts(event.date);
  if (!parts) return null;
  const clock = parseClock(event.time);
  if (!clock) return manilaInstant(parts, 0, 0);
  return manilaInstant(parts, clock.hours, clock.minutes);
}

// Instant the event is over: its own end date/time. Without an end time the
// event runs to the end of its calendar day, leaving a late window between the
// attendance deadline and the event's actual end.
function eventEndAt(event) {
  const parts = calendarParts(event.endDate || event.date);
  if (!parts) return null;
  const clock = parseClock(event.endTime);
  if (!clock) {
    return new Date(manilaInstant(parts, 23, 59).getTime() + 59 * 1000 + 999);
  }
  return manilaInstant(parts, clock.hours, clock.minutes);
}

// Events a human has taken control of are left alone by the automation.
function isAutomated(event) {
  return !event.manualOverride;
}

// Attendance-window notice timing. The heads-up goes out an hour before the QR
// window opens; the last call goes out fifteen minutes before it closes.
const ATTENDANCE_UPCOMING_LEAD_MS = 60 * 60 * 1000;
const ATTENDANCE_CLOSING_SOON_MS = 15 * 60 * 1000;

// Bumped whenever the meaning of the one-shot notice flags changes. Events
// stored with an older version get their attendance-notice flags cleared once
// so the corrected job can notify them again (see the self-heal in server.js).
const ATTENDANCE_NOTICES_VERSION = 1;

// The attendance window as real instants: [start, end]. An end clock earlier
// than the start clock means the window crosses midnight, so the end rolls to
// the following Manila day. Returns null when the window can't be parsed.
function eventWindow(event) {
  const startParts = calendarParts(event.date);
  const startClock = parseClock(event.attendanceStartTime);
  if (!startParts || !startClock) return null;

  const start = manilaInstant(startParts, startClock.hours, startClock.minutes);

  const endClock = parseClock(event.attendanceEndTime);
  if (!endClock) return null;
  let end = manilaInstant(startParts, endClock.hours, endClock.minutes);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

// The last instant a check-in counts: the event's end, or the attendance
// window's end when that is later (an event cannot end before its own check-in
// window). Up to the window's end is "present", after it is "late", and after
// this instant the event is over: auto-absence and auto-finish run.
function eventLastCheckInAt(event) {
  const window = eventWindow(event);
  const endsAt = eventEndAt(event);
  const windowEnd = window ? window.end : null;
  if (endsAt && windowEnd) return endsAt > windowEnd ? endsAt : windowEnd;
  return endsAt || windowEnd;
}

// Which attendance notices are due right now. Absolute instants only: the old
// minute-of-day comparison wrapped any time before the window start into
// "tomorrow", so on the morning of an event it fired open/closing/missed all
// at once and then silenced the real notices.
//
// `late` deliberately stops at the last check-in: after that instant the
// absence pass owns the message ("marked absent"), so the "you can still check
// in" wording is never sent when checking in is no longer possible.
function attendanceNoticeState(event, now = new Date()) {
  const window = eventWindow(event);
  const lastCheckIn = eventLastCheckInAt(event);
  if (!window || !lastCheckIn) return null;

  return {
    window,
    lastCheckIn,
    upcoming:
      now >= new Date(window.start.getTime() - ATTENDANCE_UPCOMING_LEAD_MS) &&
      now < window.start,
    open: now >= window.start && now < window.end,
    closingSoon:
      now >= new Date(window.end.getTime() - ATTENDANCE_CLOSING_SOON_MS) &&
      now < window.end,
    late: now >= window.end && now < lastCheckIn,
  };
}

// "Oct 27, 6:00 PM" on the school clock. Used in email copy so the deadline
// reads the same in dev (Windows, PHT) and prod (UTC container).
function manilaDateTimeLabel(instant) {
  if (!instant) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}

// The attendance window as ISO instants for clients. The browser does no
// timezone math: it compares these to its own clock, which is an absolute
// instant, so a phone in another zone still hides the QR exactly when this
// API would reject the scan.
function attendanceWindowPayload(event) {
  const window = eventWindow(event);
  const last = eventLastCheckInAt(event);
  return {
    start: window ? window.start.toISOString() : null,
    end: window ? window.end.toISOString() : null,
    closesAt: last ? last.toISOString() : null,
  };
}

// Flip to live once the event's start time has arrived but it has not ended.
function shouldAutoGoLive(event, now = new Date()) {
  if (event.status !== STATUS.UPCOMING || !isAutomated(event)) return false;
  const startsAt = eventStartsAt(event);
  const last = eventLastCheckInAt(event);
  if (!startsAt || !last) return false;
  if (last <= startsAt) return false;
  return now >= startsAt && now < last;
}

// Flip to finished once the last moment a check-in could count has passed.
function shouldAutoFinish(event, now = new Date()) {
  if (isTerminal(event.status) || !isAutomated(event)) return false;
  const last = eventLastCheckInAt(event);
  return !!last && now >= last;
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
  manilaNow,
  manilaClock,
  manilaDayRange,
  parseClock,
  eventStartsAt,
  eventEndAt,
  eventWindow,
  eventLastCheckInAt,
  attendanceNoticeState,
  manilaDateTimeLabel,
  ATTENDANCE_NOTICES_VERSION,
  attendanceWindowPayload,
  shouldAutoGoLive,
  shouldAutoFinish,
  resolveAutomation,
  eventLiveNotification,
};