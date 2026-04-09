const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const Excuse = require("../models/Excuse");
const Event = require("../models/Event");
const Attendance = require("../models/Attendance");

router.get("/excuses", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const excuses = await Excuse.find()
      .populate("student", "name email")
      .populate("event", "title date organizer")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    res.json(excuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    let events;
    if (req.user.role === "admin") {
      events = await Event.find();
    } else {
      events = await Event.find({ organizer: req.user._id });
    }

    const eventIds = events.map(e => e._id);
    const totalAttendees = await Attendance.countDocuments({ event: { $in: eventIds } });
    const pendingExcuses = await Excuse.countDocuments({ status: "pending" });
    const totalEvents = events.length;

    res.json({
      totalEvents,
      totalAttendees,
      pendingExcuses,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/excuses/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "organizer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { status, responseNote } = req.body;

    const excuse = await Excuse.findByIdAndUpdate(
      req.params.id,
      { status, responseNote, reviewedBy: req.user._id },
      { new: true }
    )
      .populate("student", "name email")
      .populate("event", "title date")
      .populate("reviewedBy", "name");

    if (!excuse) {
      return res.status(404).json({ error: "Excuse not found" });
    }

    res.json(excuse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
