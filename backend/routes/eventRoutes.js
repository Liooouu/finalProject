const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const Attendance = require("../models/Attendance");
const { protect } = require("../middleware/authMiddleware");

// CREATE EVENT
router.post("/", protect, async (req, res) => {
  try {
    const { title, description, date, time, location } = req.body;

    const event = new Event({
      title,
      description,
      date,
      time,
      location,
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

// UPDATE EVENT STATUS
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const { status } = req.body;

    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user._id },
      { status },
      { returnDocument: "after" } // ✅ fixed mongoose deprecation
    );

    if (!event) return res.status(404).json({ error: "Event not found" });

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

    attendance = new Attendance({
      event: req.params.id,
      student: req.user._id,
      status: "present",
    });

    await attendance.save();
    res.status(201).json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ATTENDEES (organizers)
router.get("/:id/attendees", protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to view attendees" });
    }

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
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { status } = req.body;
    const attendance = await Attendance.findOneAndUpdate(
      { event: req.params.id, student: req.params.studentId },
      { status },
      { new: true }
    ).populate("student", "name email");

    if (!attendance) return res.status(404).json({ error: "Attendance not found" });

    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ DELETE EVENT
router.delete("/:id", protect, async (req, res) => {
  try {
    const event = await Event.findOneAndDelete({
      _id: req.params.id,
      organizer: req.user._id,
    });

    if (!event) return res.status(404).json({ error: "Event not found" });

    await Attendance.deleteMany({ event: req.params.id });

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;