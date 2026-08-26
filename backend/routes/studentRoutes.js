const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/authMiddleware");
const Attendance = require("../models/Attendance");
const Excuse = require("../models/Excuse");
const Event = require("../models/Event");
const User = require("../models/User");
const Notification = require("../models/Notification");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.get("/community-service", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Only students can access this" });
    }

    const attendances = await Attendance.find({ student: req.user._id })
      .populate("event", "title date time")
      .sort({ attendedAt: -1 });

    const totalHours = attendances.reduce((sum, a) => sum + (a.communityServiceHours || 0), 0);
    const totalAttended = attendances.filter(a => a.status !== "absent").length;

    res.json({
      totalHours,
      totalAttended,
      breakdown: attendances,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/excuses", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Only students can access this" });
    }

    const excuses = await Excuse.find({ student: req.user._id })
      .populate("event", "title date")
      .sort({ createdAt: -1 });

    res.json(excuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/excuses", protect, upload.single("attachment"), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Only students can submit excuses" });
    }

    const { eventId, excuseText } = req.body;
    const type = req.body.type === "advance" ? "advance" : "absence";

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Only one active (pending/approved) excuse allowed per event
    const activeExcuse = await Excuse.findOne({
      student: req.user._id,
      event: eventId,
      status: { $in: ["pending", "approved"] },
    });
    if (activeExcuse) {
      return res.status(400).json({
        error:
          activeExcuse.status === "pending"
            ? "You already have a pending excuse for this event"
            : "Your excuse for this event was already approved",
      });
    }

    if (type === "advance") {
      // Upcoming events only — student must not have an attendance record yet
      const existingAttendance = await Attendance.findOne({
        event: eventId,
        student: req.user._id,
      });
      if (existingAttendance) {
        return res.status(400).json({
          error: "You already have an attendance record for this event",
        });
      }
    } else {
      // Absence excuses require an actual absence
      const absentRecord = await Attendance.findOne({
        event: eventId,
        student: req.user._id,
        status: "absent",
      });
      if (!absentRecord) {
        return res.status(400).json({
          error: "You can only file absence excuses for events you were marked absent in",
        });
      }
    }

    const excuse = new Excuse({
      student: req.user._id,
      event: eventId,
      excuseText,
      attachmentUrl: req.file ? `/uploads/${req.file.filename}` : null,
      type,
    });

    await excuse.save();

    // Notify the event organizer and admins that a letter awaits their review
    const reviewers = await User.find({
      $or: [{ _id: event.organizer }, { role: "admin" }],
    }).select("_id");
    if (reviewers.length > 0) {
      await Notification.insertMany(
        reviewers.map((u) => ({
          user: u._id,
          type: "excuse",
          title: "New Excuse Letter",
          message: `${req.user.name} submitted an ${
            type === "advance" ? "advance" : "absence"
          } excuse letter for "${event.title}". It awaits your review.`,
          relatedEvent: event._id,
        }))
      );
    }

    res.status(201).json(excuse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/absent-events", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Only students can access this" });
    }

    const attendances = await Attendance.find({ 
      student: req.user._id,
      status: "absent"
    }).populate("event", "title date time");

    res.json(attendances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
