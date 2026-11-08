// services/sessionSchedule.js
// Validation for attendance sessions attached to an event. Uses full timestamps
// (Date instants) so overnight sessions work. All instants are absolute (UTC);
// callers pass Manila-resolved instants or ISO strings.
const { isValidObjectId } = require("mongoose");
const SESSION_FIELDS = ['name','timeInOpen','onTimeDeadline','timeInCutoff','timeOutOpen','timeOutClose'];
function normalizeSessions(rows, previous = []) {
  if (!Array.isArray(rows) || rows.length > 30) throw Object.assign(new Error('Use between 1 and 30 attendance sessions.'), { status: 400 });
  return rows.map(row => {
    if (!row || typeof row !== "object") throw Object.assign(new Error("Each session must contain a name and schedule."), { status: 400 });
    const old = previous.find(value => String(value._id) === String(row._id));
    if (row._id && (!isValidObjectId(row._id) || !old)) throw Object.assign(new Error('Unknown attendance session. Reload this event.'), { status: 400 });
    const clean = { name: String(row.name || '').trim() };
    for (const key of SESSION_FIELDS.slice(1)) {
      const raw = row[key];
      if (!(raw instanceof Date) && (typeof raw !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(raw))) throw Object.assign(new Error('Session timestamps must include a time zone.'), { status: 400 });
      clean[key] = toDate(raw);
    }
    const policy = row.timeInPolicy ?? old?.timeInPolicy;
    if (policy !== undefined && policy !== 'window_then_late') throw Object.assign(new Error('Unknown Time In rule. Reload this event.'), { status: 400 });
    if (policy) {
      clean.timeInPolicy = policy;
      // Minute-only inputs include the whole displayed on-time minute. The
      // late-entry period ends immediately before departure opens.
      if (clean.onTimeDeadline) clean.onTimeDeadline = new Date(Math.floor(+clean.onTimeDeadline / 60000) * 60000 + 59999);
      if (clean.timeOutOpen) clean.timeInCutoff = new Date(+clean.timeOutOpen - 1);
    }
    if (old) Object.assign(clean, { _id: old._id, eligibleStudents: old.eligibleStudents, rosterLockedAt: old.rosterLockedAt });
    return clean;
  });
}
function sessionConfig(rows) {
  return JSON.stringify((rows || []).map(row => ({ ...Object.fromEntries(SESSION_FIELDS.map(key => [key, key === 'name' ? row.name : toDate(row[key])?.toISOString()])), timeInPolicy: row.timeInPolicy || null })));
}

function toDate(v) {
  if (v instanceof Date) return Number.isFinite(+v) ? v : null;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function validateSession(s, index, _eventStart, eventEnd) {
  const name = String(s?.name || "").trim();
  const label = name === "Event attendance" ? "Attendance" : name || `Attendance ${index + 1}`;
  if (!name || name.length > 80) return `${label}: use a name of 1–80 characters`;
  const fields = ["timeInOpen", "onTimeDeadline", "timeInCutoff", "timeOutOpen", "timeOutClose"];
  const vals = {};
  for (const f of fields) {
    const d = toDate(s[f]);
    if (!d) return `${label}: ${f} must be a valid timestamp`;
    vals[f] = d;
  }
  if (vals.onTimeDeadline < vals.timeInOpen) return `${label}: On-time until is earlier than Time In opens. Move the on-time deadline forward.`;
  if (!(vals.onTimeDeadline <= vals.timeInCutoff)) return `${label}: Time In must finish before Time Out opens. Move Time Out later or shorten the Time In range.`;
  if (!(vals.timeInCutoff < vals.timeOutOpen)) return `${label}: Time Out must open after Time In closes`;
  if (!(vals.timeOutOpen < vals.timeOutClose)) return `${label}: Time Out close must be after Time Out opens`;
  // Avoid overlapping entry and exit windows: time-in window [open,cutoff] and
  // time-out window [open,close] must not overlap.
  if (vals.timeInCutoff >= vals.timeOutOpen) return `${label}: entry and exit windows must not overlap`;
  // Arrival queues may open before the event starts, just as departure
  // queues may close afterward. Keep the system's 2026 date floor instead.
  if (vals.timeInOpen < new Date("2026-01-01T00:00:00+08:00")) return `${label}: attendance dates must be January 1, 2026 or later`;
  // Entry must still close by the event end. Departure uses its own deadline.
  const arrivalEnd = s.timeInPolicy === 'window_then_late' ? vals.onTimeDeadline : vals.timeInCutoff;
  const eventLimit = s.timeInPolicy === 'window_then_late' && eventEnd ? new Date(Math.floor(+eventEnd / 60000) * 60000 + 59999) : eventEnd;
  if (eventLimit && arrivalEnd > eventLimit) return `${label}: Time In must close by the event end time. Move its on-time deadline earlier or extend the event.`;
  return null;
}

function validateSessions(sessions, eventStart, eventEnd) {
  if (!Array.isArray(sessions)) return "sessions must be an array";
  if (sessions.length === 0) return null; // legacy allowed
  const seen = new Set();
  for (let i = 0; i < sessions.length; i++) {
    const err = validateSession(sessions[i], i, eventStart, eventEnd);
    if (err) return err;
    const key = String(sessions[i].name).trim().toLowerCase();
    if (seen.has(key)) return `Duplicate session name: ${sessions[i].name}`;
    seen.add(key);
  }
  // Sessions must not overlap with each other's entry/exit windows.
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i], b = sessions[j];
      const aIn = [new Date(a.timeInOpen), new Date(a.timeInCutoff)];
      const aOut = [new Date(a.timeOutOpen), new Date(a.timeOutClose)];
      const bIn = [new Date(b.timeInOpen), new Date(b.timeInCutoff)];
      const bOut = [new Date(b.timeOutOpen), new Date(b.timeOutClose)];
      const overlap = (x, y) => x[0] <= y[1] && y[0] <= x[1];
      if (overlap(aIn, bIn) || overlap(aIn, bOut) || overlap(aOut, bIn) || overlap(aOut, bOut)) {
        return `Sessions ${i + 1} and ${j + 1} have overlapping windows`;
      }
    }
  }
  return null;
}

function defaultSession(event) {
  // Build a single session from legacy event window fields (best effort).
  const start = eventStartsAt(event);
  const end = eventEndAt(event);
  const w = eventWindow(event);
  const onTimeDeadline = w ? w.end : (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);
  const timeInCutoff = w ? w.end : onTimeDeadline;
  const timeOutOpen = timeInCutoff ? new Date(timeInCutoff.getTime() + 60 * 1000) : (start ? new Date(start.getTime()) : null);
  const timeOutClose = end || timeOutOpen;
  return {
    name: "Session 1",
    timeInOpen: (w && w.start) || start || new Date(),
    onTimeDeadline: onTimeDeadline || new Date(),
    timeInCutoff: timeInCutoff || new Date(),
    timeOutOpen: timeOutOpen || new Date(),
    timeOutClose: timeOutClose || new Date(),
  };
}

const { eventStartsAt, eventEndAt, eventWindow } = require("./eventLifecycle");

module.exports = { validateSession, validateSessions, defaultSession, toDate, normalizeSessions, sessionConfig };
