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

// Strict ownership: only the creator or an admin. Destructive actions (delete)
// stay here; normal event operations use canManageEventOrAdminCreated below.
function canManageEvent(event, user) {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "organizer") return false;
  return String(event.organizer) === String(user._id);
}

// Organizers run their own events and events an admin created. This covers
// attendance plus editing/status changes; deleting an admin-created event still
// requires the admin or the event's original creator.
async function canManageEventOrAdminCreated(event, user) {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "organizer") return false;

  const ownerId = event.organizer?._id || event.organizer;
  if (String(ownerId) === String(user._id)) return true;

  const creator = await User.findById(ownerId).select("role").lean();
  return creator?.role === "admin";
}

// Age of a scanned QR payload in milliseconds, or null when no timestamp was
// sent. Accepts epoch seconds/ms or an ISO string.
function qrTimestampAgeMs(timestamp) {
  if (timestamp === undefined || timestamp === null || timestamp === "") return null;
  const numeric = Number(timestamp);
  if (Number.isFinite(numeric)) {
    const ms = numeric < 1e12 ? numeric * 1000 : numeric;
    return Date.now() - ms;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? NaN : Date.now() - parsed;
}

// In-flight create promises, keyed by organizer + event identity. Serializes
// double-clicks on a slow network so both can't pass the duplicate check.
const inFlightCreates = new Map();
function createKey(userId, title, date, time) {
  const day = date instanceof Date ? date.toISOString() : String(date || "");
  return [userId, String(title || "").trim().toLowerCase(), day, String(time || "").trim()].join("|");
}

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

    // Announce the new event to students, admins and the organizer
    await notifyUsers(await eventRecipients(event), {
      type: "info",
      title: "New Event Posted",
      message: `A new event "${event.title}" has been scheduled for ${new Date(event.date).toLocaleDateString()} at ${event.time}.`,
      relatedEvent: event._id,
      event,
    });

    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET MY EVENTS
router.get("/my-events", protect, async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user._id });
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
    if (!(await canManageEventOrAdminCreated(oldEvent, req.user))) {
      return res.status(403).json({ error: "You are not allowed to manage this event" });
    }

    const update = { status };
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
    if (!(await canManageEventOrAdminCreated(existing, req.user))) {
      return res.status(403).json({ error: "You are not allowed to manage this event" });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { manualOverride: !enabled },
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
    const events = await Event.find()
      .populate("organizer", "name")
      .sort({ date: 1 });

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
    res.json(attendance);
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
router.post("/:id/attendance", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Only students can mark attendance" });
    }

    const now = new Date();

    if (isTerminal(event.status)) {
      const label = event.status === STATUS.CLOSED ? "closed" : "already finished";
      return res.status(400).json({ error: `This event is ${label} — attendance can no longer be marked` });
    }

    // Attendance is only accepted inside the real window (no early check-in at
    // 00:01, no late check-in after the grace period). `eventWindow` resolves
    // the window as Manila instants, so a window that crosses midnight works.
    const window = eventWindow(event);
    const lastCheckIn = eventLastCheckInAt(event);
    if (!window || !lastCheckIn) {
      return res.status(400).json({ error: "This event has no valid attendance window" });
    }

    let attendance = await Attendance.findOne({
      event: req.params.id,
      student: req.user._id,
    });

    if (attendance && attendance.status !== "excused") {
      return res.status(400).json({ error: "Attendance already marked" });
    }

    if (now < window.start) {
      return res.status(400).json({ error: "Attendance is not open yet" });
    }
    if (now > lastCheckIn) {
      return res.status(400).json({ error: "The attendance window has closed" });
    }

    let status = "present";
    let communityServiceHours = 0;

    // After the window closes but before the event is over, a check-in is late.
    if (now > window.end) {
      status = "late";
      communityServiceHours = 4;
    }

    const replacedExcuse = attendance && attendance.status === "excused";
    const restoredHours = replacedExcuse
      ? await takeExcuseRestore(req.user._id, event._id)
      : 0;

    if (replacedExcuse) {
      // Student had an approved advance excuse but attended anyway
      attendance.attendedAt = now;
      attendance.status = status;
      attendance.communityServiceHours = communityServiceHours + restoredHours;
      if (communityServiceHours > 0) {
        attendance.communityServiceLog.push({
          action: "penalty",
          hours: communityServiceHours,
          note: "Marked late",
        });
      }
      if (restoredHours > 0) {
        attendance.communityServiceLog.push({
          action: "restored",
          hours: restoredHours,
          note: "Approved excuse replaced by attendance",
        });
      }
      await attendance.save();
    } else {
      attendance = new Attendance({
        event: req.params.id,
        student: req.user._id,
        attendedAt: now,
        status,
        communityServiceHours,
        communityServiceLog:
          communityServiceHours > 0
            ? [{ action: "penalty", hours: communityServiceHours, note: "Marked late" }]
            : [],
      });

      await attendance.save();
    }

    if (status === "late") {
      await notifyUsers([req.user], {
        type: "attendance",
        title: "Marked Late",
        message: `You were late for the event "${event.title}".${replacedExcuse ? " Your approved excuse was replaced since you attended." : ""} 4 community service hours have been added to your total.`,
        relatedEvent: event._id,
        event,
      });
    }

    res.status(201).json({
      ...attendance.toObject(),
      message: replacedExcuse
        ? `Your approved excuse was replaced — you were marked ${status}.`
        : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SCAN ATTENDANCE (organizer scans student QR)
router.post("/:id/attendance/scan", protect, async (req, res) => {
  try {
    const { studentId, timestamp } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: "Student ID is required" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (!(await canManageEventOrAdminCreated(event, req.user))) {
      return res.status(403).json({ error: "You are not allowed to manage attendance for this event" });
    }

    const now = new Date();

    // Same day/status/window rules as self-marking: scanning days early or late,
    // or after the event closed, must not record attendance.
    if (isTerminal(event.status)) {
      const label = event.status === STATUS.CLOSED ? "closed" : "already finished";
      return res.status(400).json({ error: `This event is ${label} — attendance can no longer be marked` });
    }
    const window = eventWindow(event);
    const lastCheckIn = eventLastCheckInAt(event);
    if (!window || !lastCheckIn) {
      return res.status(400).json({ error: "This event has no valid attendance window" });
    }
    if (now < window.start) {
      return res.status(400).json({ error: "Attendance is not open yet" });
    }
    if (now > lastCheckIn) {
      return res.status(400).json({ error: "The attendance window has closed" });
    }

    // Reject stale/replayed QR payloads. A missing timestamp is tolerated for
    // older clients, but a present one must be recent.
    const age = qrTimestampAgeMs(timestamp);
    if (age !== null && (Number.isNaN(age) || age > 10 * 60 * 1000 || age < -60 * 1000)) {
      return res.status(400).json({ error: "This QR code has expired. Ask the student to refresh it." });
    }

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "student") return res.status(400).json({ error: "This user is not a student" });

    let attendance = await Attendance.findOne({
      event: req.params.id,
      student: studentId,
    });

    if (attendance && attendance.status !== "excused") {
      return res.status(400).json({ error: `${student.name} has already marked attendance` });
    }

    let status = "present";
    let communityServiceHours = 0;

    // Late once the window closes, until the event's own end / grace runs out.
    if (now > window.end) {
      status = "late";
      communityServiceHours = 4;
    }

    const replacedExcuse = attendance && attendance.status === "excused";
    const restoredHours = replacedExcuse
      ? await takeExcuseRestore(studentId, event._id)
      : 0;

    if (replacedExcuse) {
      // Student had an approved advance excuse but attended anyway
      attendance.attendedAt = now;
      attendance.status = status;
      attendance.communityServiceHours = communityServiceHours + restoredHours;
      if (communityServiceHours > 0) {
        attendance.communityServiceLog.push({
          action: "penalty",
          hours: communityServiceHours,
          note: "Marked late (scanned)",
        });
      }
      if (restoredHours > 0) {
        attendance.communityServiceLog.push({
          action: "restored",
          hours: restoredHours,
          note: "Approved excuse replaced by attendance",
        });
      }
      await attendance.save();
    } else {
      attendance = new Attendance({
        event: req.params.id,
        student: studentId,
        attendedAt: now,
        status,
        communityServiceHours,
        communityServiceLog:
          communityServiceHours > 0
            ? [{ action: "penalty", hours: communityServiceHours, note: "Marked late (scanned)" }]
            : [],
      });

      await attendance.save();
    }

    if (status === "late") {
      await notifyUsers([student], {
        type: "attendance",
        title: "Marked Late",
        message: `You were marked as late for the event "${event.title}" by the organizer. 4 community service hours have been added to your total.`,
        relatedEvent: event._id,
        event,
      });
    }

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("student", "name email");

    res.status(201).json({
      success: true,
      attendance: populatedAttendance,
      message: `${student.name} marked as ${status}${replacedExcuse ? " (approved excuse replaced)" : ""}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ATTENDEES (organizers)
router.get("/:id/attendees", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEventOrAdminCreated(event, req.user))) {
      return res.status(403).json({ error: "You are not allowed to manage attendance for this event" });
    }

    const attendees = await Attendance.find({ event: req.params.id })
      .populate("student", "name email program yearLevel section")
      .sort({ attendedAt: -1 });

    res.json(attendees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ATTENDEES GROUPED BY PROGRAM-YEAR-SECTION (organizer/admin)
router.get("/:id/attendees/groups", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEventOrAdminCreated(event, req.user))) {
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

// UPDATE ATTENDEE STATUS (organizers)
router.patch("/:id/attendees/:studentId", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEventOrAdminCreated(event, req.user))) {
      return res.status(403).json({ error: "You are not allowed to manage attendance for this event" });
    }

    const { status } = req.body;

    const validStatuses = ["present", "late", "absent", "excused"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid attendance status" });
    }

    const targetStudent = await User.findById(req.params.studentId).select("role");
    if (!targetStudent || targetStudent.role !== "student") {
      return res.status(400).json({ error: "This user is not a student" });
    }

    let communityServiceHours = 0;
    if (status === "late") {
      communityServiceHours = 4;
    } else if (status === "absent") {
      communityServiceHours = 8;
    }

    let attendance = await Attendance.findOne({
      event: req.params.id,
      student: req.params.studentId,
    });

    if (!attendance) {
      // No attendance row yet — create one so marking someone absent/late
      // always distributes community service hours instead of failing.
      attendance = new Attendance({
        event: req.params.id,
        student: req.params.studentId,
        attendedAt: new Date(),
        status,
        communityServiceHours,
        communityServiceLog:
          communityServiceHours > 0
            ? [{ action: "penalty", hours: communityServiceHours, note: `Marked ${status} (organizer)` }]
            : [],
      });
      await attendance.save();
    } else {
      const previousHours = attendance.communityServiceHours || 0;
      const wasExcused = attendance.status === "excused";
      const restoredHours =
        wasExcused && (status === "present" || status === "late")
          ? await takeExcuseRestore(req.params.studentId, event._id)
          : 0;
      attendance.status = status;
      attendance.communityServiceHours = communityServiceHours + restoredHours;

      const delta = communityServiceHours - previousHours;
      if (delta > 0) {
        attendance.communityServiceLog.push({
          action: "penalty",
          hours: delta,
          note: `Marked ${status}`,
        });
      } else if (delta < 0) {
        attendance.communityServiceLog.push({
          action: "removed",
          hours: -delta,
          note: `Status set to ${status}`,
        });
      }
      if (restoredHours > 0) {
        attendance.communityServiceLog.push({
          action: "restored",
          hours: restoredHours,
          note: "Approved excuse replaced by attendance",
        });
      }
      await attendance.save();
    }

    if (status === "late" || status === "absent") {
      await notifyUsers([req.params.studentId], {
        type: status === "late" ? "attendance" : "penalty",
        title: status === "late" ? "Marked Late" : "Marked Absent",
        message: `You were marked as ${status} for the event "${event.title}" by the organizer. ${communityServiceHours} community service hours have been added to your total.`,
        relatedEvent: event._id,
        event,
      });
    }

    const populated = await Attendance.findById(attendance._id)
      .populate("student", "name email");

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SET A STUDENT'S COMMUNITY SERVICE HOURS FOR THIS EVENT (organizers/admins)
// Overwrites the hours this event contributes to the student's CS balance (e.g.
// correcting the automatic 8 absent / 4 late). Creates a `present` record with
// the given hours if the student has no attendance record for this event yet.
router.patch("/:id/attendees/:studentId/community-service", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEventOrAdminCreated(event, req.user))) {
      return res.status(403).json({ error: "You are not allowed to manage attendance for this event" });
    }

    const hours = Number(req.body.hours);
    if (!Number.isFinite(hours) || hours < 0) {
      return res.status(400).json({ error: "Hours must be a number greater than or equal to 0" });
    }

    const targetStudent = await User.findById(req.params.studentId).select("role");
    if (!targetStudent || targetStudent.role !== "student") {
      return res.status(400).json({ error: "This user is not a student" });
    }

    let attendance = await Attendance.findOne({ event: req.params.id, student: req.params.studentId });
    if (!attendance) {
      attendance = new Attendance({
        event: req.params.id,
        student: req.params.studentId,
        status: "present",
        attendedAt: new Date(),
        communityServiceHours: 0,
        communityServiceLog: [],
      });
      await attendance.save();
    }

    const previousHours = attendance.communityServiceHours || 0;
    const delta = hours - previousHours;

    if (delta > 0) {
      attendance.communityServiceLog.push({
        action: "penalty",
        hours: delta,
        note: "Adjusted manually",
      });
    } else if (delta < 0) {
      attendance.communityServiceLog.push({
        action: "removed",
        hours: -delta,
        note: "Adjusted manually",
      });
    }
    attendance.communityServiceHours = hours;
    await attendance.save();

    await notifyUsers([req.params.studentId], {
      type: "penalty",
      title: "Community Service Hours Updated",
      message: `Your community service hours for "${event.title}" have been set to ${hours} hour${hours === 1 ? "" : "s"} by the organizer or admin.`,
      relatedEvent: event._id,
      event,
    });

    const populated = await Attendance.findById(attendance._id).populate("student", "name email");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REMOVE A STUDENT'S COMMUNITY SERVICE HOURS (organizers/admins)
// No `hours` in body = full forgiveness: clears all accumulated penalty hours
// across every attendance record.
// With `hours` = remove that many hours from this event's record only.
router.patch("/:id/attendees/:studentId/community-service/remove", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEventOrAdminCreated(event, req.user))) {
      return res.status(403).json({ error: "You are not allowed to manage attendance for this event" });
    }

    const attendance = await Attendance.findOne({ event: req.params.id, student: req.params.studentId });
    if (!attendance) return res.status(404).json({ error: "Attendance not found" });

    const studentId = attendance.student;

    // --- Full forgiveness (all admin/organizer UI buttons hit this path) ---
    if (req.body.hours === undefined) {
      const penalized = await Attendance.find({ student: studentId, communityServiceHours: { $gt: 0 } });
      for (const rec of penalized) {
        rec.communityServiceLog.push({
          action: "removed",
          hours: rec.communityServiceHours || 0,
          note: "Community service hours removed manually",
        });
        rec.communityServiceHours = 0;
        await rec.save();
      }

      await notifyUsers([studentId], {
        type: "penalty",
        title: "Community Service Removed",
        message: "Your community service hours have been removed by the organizer.",
        relatedEvent: event._id,
        event,
      });

      const populated = await Attendance.findById(attendance._id).populate("student", "name email");
      return res.json(populated);
    }

    // --- Partial removal (direct API use): removes penalty hours from THIS record only ---
    const hoursToRemove = Number(req.body.hours);
    if (!Number.isFinite(hoursToRemove) || hoursToRemove < 0) {
      return res.status(400).json({ error: "Hours must be a number greater than or equal to 0" });
    }

    const previousHours = attendance.communityServiceHours || 0;
    const removed = Math.min(hoursToRemove, previousHours);

    if (removed > 0) {
      attendance.communityServiceHours = previousHours - removed;
      attendance.communityServiceLog.push({
        action: "removed",
        hours: removed,
        note: "Community service hours removed manually",
      });
      await attendance.save();
    }

    await notifyUsers([studentId], {
      type: "penalty",
      title: "Community Service Hours Removed",
      message: `${removed} community service hour${removed === 1 ? "" : "s"} ${removed === 1 ? "has" : "have"} been removed from your record by the organizer or admin.`,
      relatedEvent: event._id,
      event,
    });

    const populated = await Attendance.findById(attendance._id).populate("student", "name email");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MANUAL ATTENDANCE (organizers add student manually)
router.post("/:id/attendees/manual", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEventOrAdminCreated(event, req.user))) {
      return res.status(403).json({ error: "You are not allowed to manage attendance for this event" });
    }

    const { studentId, status } = req.body;
    if (!studentId) return res.status(400).json({ error: "Student ID is required" });

    const validStatuses = ["present", "late", "absent", "excused"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid attendance status" });
    }

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "student") return res.status(400).json({ error: "User is not a student" });

    // Check if attendance already exists
    const existingAttendance = await Attendance.findOne({
      event: req.params.id,
      student: studentId,
    });

    if (existingAttendance) {
      return res.status(400).json({ error: "Attendance already exists for this student" });
    }

    let communityServiceHours = 0;
    if (status === "late") {
      communityServiceHours = 4;
    } else if (status === "absent") {
      communityServiceHours = 8;
    }

    const attendance = new Attendance({
      event: req.params.id,
      student: studentId,
      attendedAt: new Date(),
      status,
      communityServiceHours,
      communityServiceLog:
        communityServiceHours > 0
          ? [{ action: "penalty", hours: communityServiceHours, note: `Marked ${status} (manual)` }]
          : [],
    });

    await attendance.save();

    if (status === "late" || status === "absent") {
      const hours = status === "late" ? 4 : 8;
      await notifyUsers([student], {
        type: status === "late" ? "attendance" : "penalty",
        title: status === "late" ? "Marked Late" : "Marked Absent",
        message: `You were marked as ${status} for the event "${event.title}" by the organizer. ${hours} community service hours have been added to your total.`,
        relatedEvent: event._id,
        event,
      });
    }

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("student", "name email");

    res.status(201).json(populatedAttendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE EVENT (organizers)
router.put("/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const existing = await Event.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEventOrAdminCreated(existing, req.user))) {
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
    const excuses = await Excuse.find({ event: req.params.id }).select("attachments attachmentUrl");
    for (const excuse of excuses) {
      const files = new Set([
        ...(excuse.attachments || []),
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