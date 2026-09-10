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

    let attendance = await Attendance.findOne({
      event: req.params.id,
      student: req.user._id,
    });

    if (attendance && attendance.status !== "excused") {
      return res.status(400).json({ error: "Attendance already marked" });
    }

    const now = new Date();
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
      .populate("student", "name email requiredServiceHours")
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
      .populate("student", "name email requiredServiceHours");

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SET A STUDENT'S COMMUNITY SERVICE GOAL (organizers/admins)
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

    const attendance = await Attendance.findOne({ event: req.params.id, student: req.params.studentId });
    if (!attendance) return res.status(404).json({ error: "Attendance not found" });

    // Goal-only: the hours an organizer/admin gives become the student's required
    // service goal. The student's accumulated total stays driven by auto-penalties.
    const student = await User.findByIdAndUpdate(
      attendance.student,
      { requiredServiceHours: hours },
      { new: true }
    );
    if (!student) return res.status(404).json({ error: "Student not found" });

    let message = `Your community service goal has been set to ${hours} hour(s) by the organizer.`;
    if (hours === 0) {
      message = `Your community service requirement has been cleared by the organizer.`;
    }

    const notification = new Notification({
      user: attendance.student,
      type: "penalty",
      title: "Community Service Goal Updated",
      message,
      relatedEvent: event._id,
    });
    await notification.save();

    const populated = await Attendance.findById(attendance._id).populate("student", "name email requiredServiceHours");
    res.json({ ...populated.toObject(), requiredServiceHours: student.requiredServiceHours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REMOVE A STUDENT'S COMMUNITY SERVICE HOURS (organizers/admins)
// No `hours` in body = full forgiveness: clears the student's stored goal AND
// all accumulated penalty hours across every attendance record.
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
    let student = await User.findById(studentId);

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

      if (student && student.requiredServiceHours > 0) {
        student.requiredServiceHours = 0;
        await student.save();
      }

      const notification = new Notification({
        user: studentId,
        type: "penalty",
        title: "Community Service Removed",
        message: "Your community service requirement has been cleared by the organizer.",
        relatedEvent: event._id,
      });
      await notification.save();

      const populated = await Attendance.findById(attendance._id).populate("student", "name email requiredServiceHours");
      return res.json({
        ...populated.toObject(),
        requiredServiceHours: student ? student.requiredServiceHours : 0,
      });
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

    const populated = await Attendance.findById(attendance._id).populate("student", "name email requiredServiceHours");
    res.json({
      ...populated.toObject(),
      requiredServiceHours: student ? student.requiredServiceHours : 0,
    });
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
      status: status || "present",
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
        message: `You were marked as ${status} for event "${event.title}" by the organizer. ${hours} community service hours have been added to your community service goal.`,
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

    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) return res.status(404).json({ error: "Event not found" });

    await Attendance.deleteMany({ event: req.params.id });

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;