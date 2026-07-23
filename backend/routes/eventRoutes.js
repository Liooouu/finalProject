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

    const { title, description, date, time, location, attendanceStartTime, attendanceEndTime } = req.body;

    if (!attendanceStartTime || !attendanceEndTime) {
      return res.status(400).json({ error: "Attendance window (start and end time) is required" });
    }

    const event = new Event({
      title,
      description,
      date,
      time,
      location,
      attendanceStartTime,
      attendanceEndTime,
      organizer: req.user._id,
    });

    await event.save();
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

    if (attendance) {
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

    attendance = new Attendance({
      event: req.params.id,
      student: req.user._id,
      attendedAt: now,
      status,
      communityServiceHours,
    });

    await attendance.save();

    if (status === "late") {
      const notification = new Notification({
        user: req.user._id,
        type: "attendance",
        title: "Marked Late",
        message: `You were late for event "${event.title}". 4 community service hours have been added to your record.`,
        relatedEvent: event._id,
      });
      await notification.save();
    }

    res.status(201).json(attendance);
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

    const student = await require("../models/User").findById(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "student") return res.status(400).json({ error: "This user is not a student" });

    let attendance = await Attendance.findOne({
      event: req.params.id,
      student: studentId,
    });

    if (attendance) {
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

    attendance = new Attendance({
      event: req.params.id,
      student: studentId,
      attendedAt: now,
      status,
      communityServiceHours,
    });

    await attendance.save();

    if (status === "late") {
      const notification = new Notification({
        user: studentId,
        type: "attendance",
        title: "Marked Late",
        message: `You were marked as late for event "${event.title}" by the organizer. 4 community service hours have been added to your record.`,
        relatedEvent: event._id,
      });
      await notification.save();
    }

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("student", "name email");

    res.status(201).json({
      success: true,
      attendance: populatedAttendance,
      message: `${student.name} marked as ${status}`,
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
    
    let communityServiceHours = 0;
    if (status === "late") {
      communityServiceHours = 4;
    } else if (status === "absent") {
      communityServiceHours = 8;
    }

    const attendance = await Attendance.findOneAndUpdate(
      { event: req.params.id, student: req.params.studentId },
      { status, communityServiceHours },
      { new: true }
    ).populate("student", "name email");

    if (!attendance) return res.status(404).json({ error: "Attendance not found" });

    res.json(attendance);
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
    });

    await attendance.save();

    if (status === "late" || status === "absent") {
      const Notification = require("../models/Notification");
      const hours = status === "late" ? 4 : 8;
      const notification = new Notification({
        user: studentId,
        type: status === "late" ? "attendance" : "penalty",
        title: status === "late" ? "Marked Late" : "Marked Absent",
        message: `You were marked as ${status} for event "${event.title}" by the organizer. ${hours} community service hours have been added to your record.`,
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

    const { title, description, date, time, location, status, attendanceStartTime, attendanceEndTime } = req.body;
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { title, description, date, time, location, status, attendanceStartTime, attendanceEndTime },
      { new: true }
    ).populate("organizer", "name email");

    if (!event) return res.status(404).json({ error: "Event not found" });

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