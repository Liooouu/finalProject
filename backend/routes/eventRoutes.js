const express = require("express");
const router = express.Router();
const Event = require("../models/Event");

// ✅ IMPORTANT FIX: destructure protect
const { protect } = require("../middleware/authMiddleware");

// CREATE EVENT (organizer/admin protected)
router.post("/", protect, async (req, res) => {
  try {
    const { title, description, date, location } = req.body;

    const event = new Event({
      title,
      description,
      date,
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
    const events = await Event.find({
      organizer: req.user._id,
    });

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
      {
        _id: req.params.id,
        organizer: req.user._id,
      },
      { status },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;