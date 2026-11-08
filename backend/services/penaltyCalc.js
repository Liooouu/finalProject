// services/penaltyCalc.js
// Pure penalty computation for a single attendance session. Returns the
// contribution in hours plus arrival/completion statuses. No DB access.
//
// Rules (per required session):
//   on-time Time In + valid Time Out  -> present, completed, 0
//   late Time In + valid Time Out     -> late, completed, 4
//   on-time Time In + missing Time Out after deadline -> present, incomplete, 2
//   late Time In + missing Time Out after deadline -> late, incomplete, 6
//   no valid Time In when Time Out closes -> absent, 8 (no incomplete add-on)
// A Time Out alone never establishes attendance.

const HOURS = { present: 0, lateTimeIn: 4, incomplete: 2, absent: 8 };

function classify({ timeInAt, timeOutAt, session, now = new Date() }) {
  const s = session;
  if (!s) return { arrivalStatus: null, completionStatus: "pending", hours: 0, state: "pending" };

  const cutoff = new Date(s.timeInCutoff);
  const outClose = new Date(s.timeOutClose);
  const onTimeDeadline = new Date(s.onTimeDeadline);

  // Invalid/missing entry is pending until the entire attendance period ends.
  const entry = timeInAt ? new Date(timeInAt) : null;
  if (!entry || !Number.isFinite(+entry) || entry < new Date(s.timeInOpen) || entry > cutoff) {
    // Finish the whole attendance period before charging absence. A pending
    // entry may still be confirmed while the exit desk is open.
    if (now <= outClose) return { arrivalStatus: null, completionStatus: "pending", hours: 0, state: "pending" };
    return { arrivalStatus: null, completionStatus: "absent", hours: HOURS.absent, state: "absent" };
  }

  const late = new Date(timeInAt) > onTimeDeadline;
  const arrivalStatus = late ? "late" : "on_time";

  // Time Out valid?
  const hasTimeOut = !!timeOutAt && new Date(timeOutAt) >= entry && new Date(timeOutAt) >= new Date(s.timeOutOpen) && new Date(timeOutAt) <= outClose;

  if (hasTimeOut) {
    return { arrivalStatus, completionStatus: "completed", hours: late ? HOURS.lateTimeIn : HOURS.present, state: "completed" };
  }

  // Missing Time Out: incomplete only after exit deadline; before that, awaiting.
  if (now <= outClose) {
    return { arrivalStatus, completionStatus: "pending", hours: late ? HOURS.lateTimeIn : HOURS.present, state: "awaiting_timeout" };
  }
  // after deadline: incomplete (late adds 2 on top of the 4 already counted)
  const base = late ? HOURS.lateTimeIn : HOURS.present;
  const incompleteExtra = HOURS.incomplete;
  return { arrivalStatus, completionStatus: "incomplete", hours: base + incompleteExtra, state: "incomplete" };
}

// Diff: returns delta hours to apply to ledger given previous contribution.
function diff(previousHours, newHours) {
  return newHours - (previousHours || 0);
}

module.exports = { classify, diff, HOURS };
