const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Event = require("../models/Event");
const Attendance = require("../models/Attendance");
const Excuse = require("../models/Excuse");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { notifyUsers, eventRecipients } = require("../services/notify");
const fileStore = require("../services/fileStore");
const { protect } = require("../middleware/authMiddleware");
const {
  STATUS,
  EVENT_STATUSES,
  isTerminal,
  parseClock,
  eventStartsAt,
  eventEndAt,
  eventWindow,
  eventLastCheckInAt,
  attendanceWindowPayload,
  resolveAutomation,
  eventLiveNotification,
} = require("../services/eventLifecycle");

// Event ownership lives in one service so the face kiosk and the event routes
// cannot disagree about who may manage an event.
const { canManageEvent, canViewEventAttendance, canEditEvent } = require("../services/eventAccess");
const manualAttendance = require("../services/manualAttendance");
const ManualAttendanceRequest = require("../models/ManualAttendanceRequest");
const { projectManualAttendance } = require("../services/manualAttendanceView");

// Only explicit human edits stamp the editor; scheduled jobs do not impersonate one.
const editorStamp = user => ({ lastEditedBy: user._id, lastEditedByName: user.name || "Staff member", lastEditedAt: new Date() });

// In-flight create promises, keyed by organizer + event identity. Serializes
// double-clicks on a slow network so both can't pass the duplicate check.
const inFlightCreates = new Map();
function createKey(userId, title, date, time) {
  const day = date instanceof Date ? date.toISOString() : String(date || "");
  return [userId, String(title || "").trim().toLowerCase(), day, String(time || "").trim()].join("|");
}

// Rejects a schedule the system could never make sense of: unparseable dates,
// an attendance window that runs backwards, or an event that ends before it
// starts. Only the fields present in the payload are checked, so a partial
// update is still validated against the stored values.
function validateSchedule(schedule) {
  const startsAt = eventStartsAt(schedule);
  if (!startsAt) {
    return "A valid event date is required";
  }

  const { attendanceStartTime, attendanceEndTime } = schedule;
  // `parseClock` rejects out-of-range values ("24:00", "99:99", "9:5") that the
  // old split-on-colon check let through and that later broke the date math.
  if (attendanceStartTime && !parseClock(attendanceStartTime)) {
    return "Attendance window start must be in HH:mm format";
  }
  if (attendanceEndTime && !parseClock(attendanceEndTime)) {
    return "Attendance window end must be in HH:mm format";
  }
  // An end clock earlier than the start clock is allowed: it means the window
  // crosses midnight (e.g. 23:00–01:00), which the attendance checks resolve by
  // rolling the end onto the next Manila day.

  const endsAt = eventEndAt(schedule);
  if (endsAt && endsAt <= startsAt) {
    return "The event must end after it starts";
  }

  return null;
}

// CREATE EVENT (organizer/admin only)
router.post("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only organizers and admins can create events" });
    }

    const { title, description, date, time, location, mapQuery, attendanceStartTime, attendanceEndTime } = req.body;

    if (!attendanceStartTime || !attendanceEndTime) {
      return res.status(400).json({ error: "The attendance window (start and end time) is required" });
    }

    const endDate = req.body.endDate || date;
    const endTime = req.body.endTime || null;

    const scheduleError = validateSchedule({
      date,
      time,
      endDate,
      endTime,
      attendanceStartTime,
      attendanceEndTime,
    });
    if (scheduleError) {
      return res.status(400).json({ error: scheduleError });
    }

    // Duplicate-submission guard, made concurrency-safe with an in-process lock.
    // A plain check-then-insert lets two simultaneous requests both pass the
    // check before either inserts; serializing identical creates closes that
    // window for this single API process.
    const key = createKey(req.user._id, title, date, time);
    const pending = inFlightCreates.get(key);
    if (pending) {
      try {
        const { event } = await pending;
        return res.status(200).json(event);
      } catch {
        // Fall through and let this request attempt the create itself.
      }
    }

    const work = (async () => {
      const duplicate = await Event.findOne({
        organizer: req.user._id,
        title,
        date,
        time,
        attendanceStartTime,
        attendanceEndTime,
        createdAt: { $gte: new Date(Date.now() - 30 * 1000) },
      });
      if (duplicate) return { event: duplicate, created: false };

      const created = new Event({
        title,
        description,
        date,
        time,
        endDate,
        endTime,
        location,
        mapQuery,
        attendanceStartTime,
        attendanceEndTime,
        organizer: req.user._id,
      });
      await created.save();
      return { event: created, created: true };
    })();

    inFlightCreates.set(key, work);
    let result;
    try {
      result = await work;
    } finally {
      inFlightCreates.delete(key);
    }

    const { event, created } = result;
    if (!created) return res.status(200).json(event);

    // Persist bell notifications before confirming; email delivery continues
    // separately so SMTP latency is not part of event creation.
    let notificationWarning;
    try {
      await notifyUsers(await eventRecipients(event), {
        type: "info",
        title: "New Event Posted",
        message: `A new event "${event.title}" has been scheduled for ${new Date(event.date).toLocaleDateString()} at ${event.time}.`,
        relatedEvent: event._id,
        event,
        deferEmail: true,
      });
    } catch (error) {
      console.error("Event notification failed:", error.message);
      notificationWarning = "Event saved, but notifications could not be delivered.";
    }
    res.status(201).json(notificationWarning ? { ...(event.toObject ? event.toObject() : event), notificationWarning } : event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET MY EVENTS
router.get("/my-events", protect, async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user._id }).populate("organizer", "name email role");
    const eventIds = events.map((e) => e._id);
    const counts = await Attendance.aggregate([
      { $match: { event: { $in: eventIds }, status: { $in: ["present", "late"] } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
    const withCounts = events.map((e) => ({ ...e.toObject(), attendeeCount: map[e._id.toString()] || 0 }));
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL EVENTS (for organizers - all events they can manage)
router.get("/all", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    const events = await Event.find()
      .populate("organizer", "name email role")
      .sort({ createdAt: -1 });
    const eventIds = events.map((e) => e._id);
    const counts = await Attendance.aggregate([
      { $match: { event: { $in: eventIds }, status: { $in: ["present", "late"] } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
    const withCounts = events.map((e) => ({ ...e.toObject(), attendeeCount: map[e._id.toString()] || 0 }));
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE EVENT STATUS
//
// A status chosen here is a human decision, so it also pins the event: the
// background job will not move it again until the schedule is edited (or
// someone hits "Resume auto-close").
router.patch("/:id/status", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { status } = req.body;
    if (!EVENT_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid event status" });
    }
    const oldEvent = await Event.findById(req.params.id);

    if (!oldEvent) return res.status(404).json({ error: "Event not found" });
    if (!canEditEvent(oldEvent, req.user)) {
      return res.status(403).json({ error: "You are not allowed to manage this event" });
    }

    const update = { status, ...editorStamp(req.user) };
    // Reopening an event means it is no longer sitting finished.
    if (status !== STATUS.FINISHED) update.autoFinishedAt = null;

    // Reopening resets the one-shot notices so the new run can notify again.
    if (status === STATUS.UPCOMING) {
      update.openNotified = false;
      update.closingSoonNotified = false;
      update.closedNotified = false;
      update.upcomingNotified = false;
      update.attendanceUpcomingNotified = false;
    }

    // Reopening an auto-finished event must also undo the absences + 8-hour
    // penalties the automation wrote, or students stay penalized/blocked before
    // the event has actually happened.
    if (status === STATUS.UPCOMING && oldEvent.status !== status) {
      await Attendance.deleteMany({
        event: oldEvent._id,
        status: "absent",
        communityServiceLog: {
          $elemMatch: { action: "penalty", note: "Marked absent (auto)" },
        },
      });
    }

    // Reopening hands the event back to the clock; every other status chosen
    // here is a human decision that pins it.
    const pinned = resolveAutomation({ currentStatus: oldEvent.status, nextStatus: status });
    if (pinned !== undefined) update.manualOverride = pinned;

    const event = await Event.findByIdAndUpdate(req.params.id, update, { new: true });

    // Announce when an event goes live
    if (status === STATUS.LIVE && oldEvent.status !== STATUS.LIVE) {
      const { type, title, message } = eventLiveNotification(event);
      await notifyUsers(await eventRecipients(event), {
        type,
        title,
        message,
        relatedEvent: event._id,
        event,
      });
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESUME / PAUSE AUTOMATIC STATUS CHANGES
// The counterpart to the manual override: gives an event back to the background
// job, or holds it still without pretending the status was chosen by hand.
router.patch("/:id/automation", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Send { enabled: true|false }" });
    }

    const existing = await Event.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Event not found" });
    if (!canEditEvent(existing, req.user)) {
      return res.status(403).json({ error: "You are not allowed to manage this event" });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { manualOverride: !enabled, ...editorStamp(req.user) },
      { new: true }
    );
    if (!event) return res.status(404).json({ error: "Event not found" });

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL EVENTS (for students)
// Everything is returned — an event never silently disappears — with the ones
// still worth acting on first. The client splits them into Upcoming / Past.
router.get("/", protect, async (req, res) => {
  try {
    // Sorted in the database (date, then lifecycle ranking applied below) and
    // sent as plain objects: this runs on every student dashboard visit.
    const events = await Event.find()
      .populate("organizer", "name")
      .sort({ date: 1 })
      .lean();

    const rank = (event) => (isTerminal(event.status) ? 1 : 0);
    events.sort(
      (a, b) => rank(a) - rank(b) || new Date(a.date) - new Date(b.date)
    );

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET MY ATTENDANCE (students)
router.get("/my-attendance", protect, async (req, res) => {
  try {
    const attendance = await Attendance.find({ student: req.user._id })
      .populate("event", "title date time location")
      .sort({ attendedAt: -1 });
    const pending = await manualAttendance.pendingManualEventsForStudent(req.user._id);
    res.json(projectManualAttendance(attendance, pending, { studentId: req.user._id }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE EVENT
router.get("/:id", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("organizer", "name email role");
    if (!event) return res.status(404).json({ error: "Event not found" });
    // The resolved window travels with the event so the student's QR gate uses
    // the same instants the scan endpoint checks, instead of re-deriving them
    // from the clock strings on the device.
    res.json({ ...event.toObject(), attendanceWindow: attendanceWindowPayload(event) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MARK ATTENDANCE (students)
// GET ATTENDEES (organizers)
router.get("/:id/attendees", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!canViewEventAttendance(event, req.user)) {
      return res.status(403).json({ error: "You are not allowed to manage attendance for this event" });
    }

    const attendees = await Attendance.find({ event: req.params.id })
      // The log is an audit trail nobody reads on this screen, and it is the
      // only unbounded field per record — a full event would carry thousands.
      .select("-communityServiceLog")
      .populate("student", "name email program yearLevel section enrollmentStatus faceEnrolledAt")
      .sort({ attendedAt: -1 })
      .lean();

    const pending = await ManualAttendanceRequest.find({ event: req.params.id, status: "pending" })
      .populate("student", "name email program yearLevel section")
      .populate("requestedBy", "name email")
      .select("event student requestedBy status effectiveAt submittedAt proposedStatus proposedHours").lean();
    res.json(projectManualAttendance(attendees, pending));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ATTENDEES GROUPED BY PROGRAM-YEAR-SECTION (organizer/admin)
router.get("/:id/attendees/groups", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!canViewEventAttendance(event, req.user)) {
      return res.status(403).json({ error: "You are not allowed to manage attendance for this event" });
    }

    const groups = await Attendance.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(req.params.id) } },
      { $lookup: { from: "users", localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: "$student" },
      {
        $group: {
          _id: {
            program: { $ifNull: ["$student.program", ""] },
            yearLevel: { $ifNull: ["$student.yearLevel", null] },
            section: { $ifNull: ["$student.section", ""] },
          },
          count: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          excused: { $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        },
      },
      { $sort: { "_id.program": 1, "_id.yearLevel": 1, "_id.section": 1 } },
    ]);

    const mapped = groups.map((g) => {
      const p = g._id.program || "";
      const yl = g._id.yearLevel;
      const s = g._id.section || "";
      const label = p && yl !== null && s ? `${p}-${yl}${s}` : "Unassigned";
      const key = `${p}|${yl ?? "X"}|${s}`;
      const attended = (g.present || 0) + (g.late || 0);
      return {
        key,
        label,
        program: p,
        yearLevel: yl,
        section: s,
        count: g.count,
        total: g.count,
        present: g.present || 0,
        late: g.late || 0,
        absent: g.absent || 0,
        excused: g.excused || 0,
        pending: g.pending || 0,
        attended,
      };
    });

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual status changes are review requests, never direct attendance writes.
const requestOnly = (req, res) => {
  if (req.user.role !== "organizer") return res.status(403).json({ error: "Only organizers may submit attendance requests" });
  if ([req.params.studentId, req.body?.studentId].some(id => id && String(req.user._id) === String(id))) return res.status(403).json({ error: "Another organizer must handle your own attendance" });
  return res.status(409).json({ error: "Submit a manual attendance request for independent review", requestPath: "/api/manual-attendance/requests" });
};
router.patch("/:id/attendees/:studentId", protect, requestOnly);
router.post("/:id/attendees/manual", protect, requestOnly);
// An unreviewed hours edit could bypass attendance review. Existing admin
// service-ledger interventions remain available through their dedicated API.
const administrativeHoursOnly = (req, res) => {
  if (req.user.role !== "organizer") return res.status(403).json({ error: "Not authorized" });
  return res.status(409).json({ error: "Attendance corrections require independent review. Other service-hour adjustments must be handled by an administrator." });
};
router.patch("/:id/attendees/:studentId/community-service", protect, administrativeHoursOnly);
router.patch("/:id/attendees/:studentId/community-service/remove", protect, administrativeHoursOnly);
// UPDATE EVENT (organizers)
router.put("/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const existing = await Event.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Event not found" });
    if (!canEditEvent(existing, req.user)) {
      return res.status(403).json({ error: "You are not allowed to edit this event" });
    }

    const { title, description, date, time, endDate, endTime, location, mapQuery, status, attendanceStartTime, attendanceEndTime } = req.body;

    // This route writes the status straight from the body, so it needs the same
    // allow-list as PATCH /:id/status — otherwise any string reaches the database.
    if (status !== undefined && !EVENT_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid event status" });
    }

    // Validate the schedule that would result from this edit.
    const nextSchedule = {
      date: date ?? existing.date,
      time: time ?? existing.time,
      endDate: endDate ?? existing.endDate,
      endTime: endTime ?? existing.endTime,
      attendanceStartTime: attendanceStartTime ?? existing.attendanceStartTime,
      attendanceEndTime: attendanceEndTime ?? existing.attendanceEndTime,
    };
    const scheduleError = validateSchedule(nextSchedule);
    if (scheduleError) {
      return res.status(400).json({ error: scheduleError });
    }

    const update = {
      ...editorStamp(req.user),
      title,
      description,
      date,
      time,
      endDate,
      endTime,
      location,
      mapQuery,
      status,
      attendanceStartTime,
      attendanceEndTime,
    };

    // Touching the schedule only counts when a value actually CHANGED. Checking
    // mere presence released the manual override every time the edit form
    // resubmitted the same schedule (which it always does), so editing a title
    // could un-pause an event the organizer was holding open.
    const normDate = (v) => (v ? new Date(v).getTime() : null);
    const normClock = (v) => (v == null ? null : String(v).trim());
    const scheduleTouched =
      ["date", "endDate"].some(
        (field) => req.body[field] !== undefined && normDate(req.body[field]) !== normDate(existing[field])
      ) ||
      ["time", "endTime", "attendanceStartTime", "attendanceEndTime"].some(
        (field) => req.body[field] !== undefined && normClock(req.body[field]) !== normClock(existing[field])
      );

    // A schedule change moves the event back to the clock, so its old one-shot
    // notices must fire again for the new date/window.
    if (scheduleTouched) {
      update.openNotified = false;
      update.closingSoonNotified = false;
      update.closedNotified = false;
      update.upcomingNotified = false;
      update.attendanceUpcomingNotified = false;
    }

    // Rescheduling a finished/closed event into the future must revive it —
    // otherwise it stays terminal forever because the automation only moves
    // `upcoming`/`live` events.
    const nextStartsAt = eventStartsAt(nextSchedule);
    if (
      scheduleTouched &&
      nextStartsAt &&
      nextStartsAt > new Date() &&
      isTerminal(existing.status) &&
      (status === undefined || status === existing.status)
    ) {
      update.status = STATUS.UPCOMING;
      update.autoFinishedAt = null;
    }

    const pinned = resolveAutomation({
      currentStatus: existing.status,
      nextStatus: update.status,
      scheduleTouched,
    });
    if (pinned !== undefined) update.manualOverride = pinned;

    if (status !== undefined && status !== STATUS.FINISHED) {
      update.autoFinishedAt = null;
    }

    const event = await Event.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).populate("organizer", "name email");

    if (!event) return res.status(404).json({ error: "Event not found" });

    // Notify students, admins and the organizer that event details changed
    await notifyUsers(await eventRecipients(event), {
      type: "info",
      title: "Event Updated",
      message: `Details of "${event.title}" were updated. Check the latest schedule.`,
      relatedEvent: event._id,
      event,
    });

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE EVENT
router.delete("/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!canManageEvent(event, req.user)) {
      return res.status(403).json({ error: "You are not the organizer of this event" });
    }

    if (await ManualAttendanceRequest.exists({ event: event._id, status: "pending" })) {
      return res.status(409).json({ error: "Resolve pending manual attendance requests before deleting this event" });
    }

    // Preserve community service hours: keep the attendance records and
    // snapshot the event's name/date onto them. The event reference is kept
    // (now dangling) so the unique { event, student } index stays intact —
    // nulling it would make two deleted events collide for the same student.
    await Attendance.updateMany(
      { event: req.params.id },
      {
        $set: {
          eventTitle: event.title,
          eventDate: event.date,
        },
      }
    );

    await Event.findByIdAndDelete(req.params.id);

    // Cascade: an Excuse requires its event, and Notifications point at it, so
    // leaving them behind creates orphan records that break later approval and
    // keep stale notifications around. Attendance is intentionally preserved
    // above to keep community-service history.
    const excuses = await Excuse.find({ event: req.params.id }).select("attachments attachmentUrl submissionHistory");
    for (const excuse of excuses) {
      const files = new Set([
        ...(excuse.attachments || []),
        ...(excuse.submissionHistory || []).flatMap(revision => revision.attachments || []),
        ...(excuse.attachmentUrl ? [excuse.attachmentUrl] : []),
      ]);
      await fileStore.deleteByUrls([...files]);
    }
    await Excuse.deleteMany({ event: req.params.id });
    await Notification.deleteMany({ relatedEvent: req.params.id });

    res.json({ message: "Event deleted successfully. Community service hours were preserved." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
