const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

// CREATE EVENT (organizer/admin only)
router.post("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only organizers and admins can create events" });
    }

    const { title, description, date, time, location, mapQuery, attendanceStartTime, attendanceEndTime } = req.body;

    if (!attendanceStartTime || !attendanceEndTime) {
      return res.status(400).json({ error: "Attendance window (start and end time) is required" });
    }

    const endDate = req.body.endDate || date;
    const endTime = req.body.endTime || attendanceEndTime;

    const event = new Event({
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

    await event.save();

    // Announce the new event to all students and admins
    const recipients = await User.find({ role: { $in: ["student", "admin"] } }).select("_id");
    if (recipients.length > 0) {
      await Notification.insertMany(
        recipients.map((u) => ({
          user: u._id,
          type: "info",
          title: "New Event Posted",
          message: `A new event "${event.title}" has been posted for ${new Date(event.date).toLocaleDateString()} at ${event.time}.`,
          relatedEvent: event._id,
        }))
      );
    }

    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET MY EVENTS
router.get("/my-events", protect, async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user._id });
    res.json(events);
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
      .populate("organizer", "name email")
      .sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE EVENT STATUS
router.patch("/:id/status", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { status } = req.body;
    const validEventStatuses = ["upcoming", "live", "closed"];
    if (!validEventStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid event status" });
    }
    const oldEvent = await Event.findById(req.params.id);
    
    if (!oldEvent) return res.status(404).json({ error: "Event not found" });

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (status === "closed" && oldEvent.status !== "closed") {
      // Absent marking handled by background job at end of day — not on close
    }

    // Announce when an event goes live
    if (status === "live" && oldEvent.status !== "live") {
      const recipients = await User.find({ role: { $in: ["student", "admin"] } }).select("_id");
      if (recipients.length > 0) {
        await Notification.insertMany(
          recipients.map((u) => ({
            user: u._id,
            type: "info",
            title: "Event Live Now",
            message: `"${event.title}" is now live! Attendance closes at ${event.attendanceEndTime}.`,
            relatedEvent: event._id,
          }))
        );
      }
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL EVENTS (for students)
router.get("/", protect, async (req, res) => {
  try {
    const events = await Event.find({ status: { $ne: "closed" } })
      .populate("organizer", "name")
      .sort({ date: 1 });
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
    const event = await Event.findById(req.params.id).populate("organizer", "name email");
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
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

    if (event.status === "closed") {
      return res.status(400).json({ error: "Event is closed — attendance can no longer be marked" });
    }

    const eventDay = new Date(event.date);
    const sameDay =
      now.getFullYear() === eventDay.getFullYear() &&
      now.getMonth() === eventDay.getMonth() &&
      now.getDate() === eventDay.getDate();
    if (!sameDay) {
      return res.status(400).json({ error: "Attendance can only be marked on the event day" });
    }

    let attendance = await Attendance.findOne({
      event: req.params.id,
      student: req.user._id,
    });

    if (attendance && attendance.status !== "excused") {
      return res.status(400).json({ error: "Attendance already marked" });
    }

    const currentTime = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
    const endTime = event.attendanceEndTime;

    let status = "present";
    let communityServiceHours = 0;

    if (currentTime > endTime) {
      status = "late";
      communityServiceHours = 4;
    }

    const replacedExcuse = attendance && attendance.status === "excused";

    if (replacedExcuse) {
      // Student had an approved advance excuse but attended anyway
      attendance.attendedAt = now;
      attendance.status = status;
      attendance.communityServiceHours = communityServiceHours;
      if (communityServiceHours > 0) {
        attendance.communityServiceLog.push({
          action: "penalty",
          hours: communityServiceHours,
          note: "Marked late",
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
      const notification = new Notification({
        user: req.user._id,
        type: "attendance",
        title: "Marked Late",
        message: `You were late for event "${event.title}".${replacedExcuse ? " Your approved excuse was replaced since you attended." : ""} 4 community service hours have been added to your community service hours.`,
        relatedEvent: event._id,
      });
      await notification.save();
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

    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only organizers can scan attendance" });
    }

    if (req.user.role === "organizer" && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You are not the organizer of this event" });
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

    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
    const endTime = event.attendanceEndTime;

    console.log(`[SCAN] currentTime: "${currentTime}", endTime: "${endTime}", currentTime > endTime: ${currentTime > endTime}`);

    let status = "present";
    let communityServiceHours = 0;

    if (currentTime > endTime) {
      status = "late";
      communityServiceHours = 4;
    }

    const replacedExcuse = attendance && attendance.status === "excused";

    if (replacedExcuse) {
      // Student had an approved advance excuse but attended anyway
      attendance.attendedAt = now;
      attendance.status = status;
      attendance.communityServiceHours = communityServiceHours;
      if (communityServiceHours > 0) {
        attendance.communityServiceLog.push({
          action: "penalty",
          hours: communityServiceHours,
          note: "Marked late (scanned)",
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
      const notification = new Notification({
        user: studentId,
        type: "attendance",
        title: "Marked Late",
        message: `You were marked as late for event "${event.title}" by the organizer. 4 community service hours have been added to your community service hours.`,
        relatedEvent: event._id,
      });
      await notification.save();
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
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const attendees = await Attendance.find({ event: req.params.id })
      .populate("student", "name email")
      .sort({ attendedAt: -1 });

    res.json(attendees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE ATTENDEE STATUS (organizers)
router.patch("/:id/attendees/:studentId", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const { status } = req.body;

    const validStatuses = ["present", "late", "absent", "excused"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid attendance status" });
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
      attendance.status = status;
      attendance.communityServiceHours = communityServiceHours;

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
      await attendance.save();
    }

    if (status === "late" || status === "absent") {
      const notification = new Notification({
        user: req.params.studentId,
        type: status === "late" ? "attendance" : "penalty",
        title: status === "late" ? "Marked Late" : "Marked Absent",
        message: `You were marked as ${status} for event "${event.title}" by the organizer. ${communityServiceHours} community service hours have been added to your community service hours.`,
        relatedEvent: event._id,
      });
      await notification.save();
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
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const hours = Number(req.body.hours);
    if (!Number.isFinite(hours) || hours < 0) {
      return res.status(400).json({ error: "Hours must be a number greater than or equal to 0" });
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

    const notification = new Notification({
      user: req.params.studentId,
      type: "penalty",
      title: "Community Service Hours Updated",
      message: `Your community service hours for "${event.title}" have been set to ${hours} hour(s) by the organizer.`,
      relatedEvent: event._id,
    });
    await notification.save();

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
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

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

      const notification = new Notification({
        user: studentId,
        type: "penalty",
        title: "Community Service Removed",
        message: "Your community service hours have been removed by the organizer.",
        relatedEvent: event._id,
      });
      await notification.save();

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

    const notification = new Notification({
      user: studentId,
      type: "penalty",
      title: "Community Service Hours Removed",
      message: `${removed} community service hour(s) have been removed from your record by the organizer.`,
      relatedEvent: event._id,
    });
    await notification.save();

    const populated = await Attendance.findById(attendance._id).populate("student", "name email");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MANUAL ATTENDANCE (organizers add student manually)
router.post("/:id/attendees/manual", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

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
      const notification = new Notification({
        user: studentId,
        type: status === "late" ? "attendance" : "penalty",
        title: status === "late" ? "Marked Late" : "Marked Absent",
        message: `You were marked as ${status} for event "${event.title}" by the organizer. ${hours} community service hours have been added to your community service hours.`,
        relatedEvent: event._id,
      });
      await notification.save();
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

    const { title, description, date, time, endDate, endTime, location, mapQuery, status, attendanceStartTime, attendanceEndTime } = req.body;
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { title, description, date, time, endDate, endTime, location, mapQuery, status, attendanceStartTime, attendanceEndTime },
      { new: true }
    ).populate("organizer", "name email");

    if (!event) return res.status(404).json({ error: "Event not found" });

    // Notify students and admins that event details changed
    const recipients = await User.find({ role: { $in: ["student", "admin"] } }).select("_id");
    if (recipients.length > 0) {
      await Notification.insertMany(
        recipients.map((u) => ({
          user: u._id,
          type: "info",
          title: "Event Updated",
          message: `Details of "${event.title}" were updated. Check the latest schedule.`,
          relatedEvent: event._id,
        }))
      );
    }

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

    res.json({ message: "Event deleted successfully. Community service hours were preserved." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;