const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/authMiddleware");
const Attendance = require("../models/Attendance");
const Excuse = require("../models/Excuse");
const Event = require("../models/Event");

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

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const excuse = new Excuse({
      student: req.user._id,
      event: eventId,
      excuseText,
      attachmentUrl: req.file ? `/uploads/${req.file.filename}` : null,
    });

    await excuse.save();
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
