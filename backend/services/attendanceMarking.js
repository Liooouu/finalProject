// services/attendanceMarking.js
// One implementation of "this student checked in to this event", shared by the
// face kiosk (and available to any future check-in method). The QR/self routes
// used to duplicate this block; keeping it here means the present/late rules,
// excuse replacement and late notification can never drift.
const Attendance = require("../models/Attendance");
const Excuse = require("../models/Excuse");
const { notifyUsers } = require("./notify");
const {
  isTerminal,
  eventWindow,
  eventLastCheckInAt,
} = require("./eventLifecycle");

// An approved excuse may have deducted flat hours. If the student ends up
// attending after all, those hours must come back — attendance supersedes the
// excuse. Returns the number of hours to restore and marks the excuse spent.
async function takeExcuseRestore(studentId, eventId) {
  const excuse = await Excuse.findOne({
    student: studentId,
    event: eventId,
    status: "approved",
    removedHours: { $gt: 0 },
  });
  if (!excuse) return 0;
  const hours = excuse.removedHours;
  excuse.removedHours = 0;
  await excuse.save();
  return hours;
}

// Reasons the station must refuse a check-in, shared with the kiosk status.
function checkInGate(event, now = new Date()) {
  if (!event) return { reason: "not-found" };
  if (isTerminal(event.status)) {
    return { reason: event.status === "closed" ? "closed" : "finished" };
  }
  const window = eventWindow(event);
  const lastCheckIn = eventLastCheckInAt(event);
  if (!window || !lastCheckIn) return { reason: "no-window" };
  if (now < window.start) return { reason: "before" };
  if (now > lastCheckIn) return { reason: "closed" };
  return { window, lastCheckIn, late: now > window.end };
}

/**
 * Record a check-in for one student.
 *
 * @returns {{ok: true, attendance, status, hours, replacedExcuse, late}}
 *        | {{ok: false, reason: "already"|"closed"|"finished"|"before"|"no-window", attendance?}}
 */
async function recordAttendance({
  event,
  student,
  now = new Date(),
  method = "face",
  matchDistance = null,
  checkInSession = null,
}) {
  if (!event || !student) return { ok: false, reason: "not-found" };

  const gate = checkInGate(event, now);
  if (gate.reason) {
    return {
      ok: false,
      reason: gate.reason,
      window: gate.window,
      lastCheckIn: gate.lastCheckIn,
    };
  }

  const existing = await Attendance.findOne({
    event: event._id,
    student: student._id,
  });

  if (existing && existing.status !== "excused") {
    return { ok: false, reason: "already", attendance: existing };
  }

  const status = gate.late ? "late" : "present";
  const hours = gate.late ? 4 : 0;
  const replacedExcuse = existing?.status === "excused";
  const restoredHours = replacedExcuse
    ? await takeExcuseRestore(student._id, event._id)
    : 0;
  const noteSuffix = method === "face" ? " (face check-in)" : "";

  let attendance;
  if (replacedExcuse) {
    // Student had an approved excuse but attended anyway.
    existing.attendedAt = now;
    existing.status = status;
    existing.communityServiceHours = hours + restoredHours;
    existing.method = method;
    existing.matchDistance = matchDistance;
    existing.checkInSession = checkInSession;
    existing.verifiedAt = now;
    if (hours > 0) {
      existing.communityServiceLog.push({
        action: "penalty",
        hours,
        note: `Marked late${noteSuffix}`,
      });
    }
    if (restoredHours > 0) {
      existing.communityServiceLog.push({
        action: "restored",
        hours: restoredHours,
        note: "Approved excuse replaced by attendance",
      });
    }
    attendance = await existing.save();
  } else {
    attendance = await Attendance.create({
      event: event._id,
      student: student._id,
      attendedAt: now,
      status,
      method,
      matchDistance,
      checkInSession,
      verifiedAt: now,
      communityServiceHours: hours + restoredHours,
      communityServiceLog:
        hours > 0
          ? [{ action: "penalty", hours, note: `Marked late${noteSuffix}` }]
          : [],
    });
  }

  if (gate.late) {
    await notifyUsers([student], {
      type: "attendance",
      title: "Marked Late",
      message:
        `You were marked late for the event "${event.title}". 4 community service hours ` +
        `have been added to your total.` +
        (replacedExcuse ? " Your approved excuse was replaced since you attended." : ""),
      relatedEvent: event._id,
      event,
    });
  }

  return {
    ok: true,
    attendance,
    status,
    hours: hours + restoredHours,
    replacedExcuse,
    late: gate.late,
  };
}

module.exports = { takeExcuseRestore, checkInGate, recordAttendance };
