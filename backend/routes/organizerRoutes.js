const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const Excuse = require("../models/Excuse");
const Event = require("../models/Event");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");

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

    if (status === "approved") {
      if (excuse.type === "advance") {
        // Pre-create the attendance as excused BEFORE the event happens,
        // so the auto-absent background job never penalizes this student.
        const attendance = await Attendance.findOneAndUpdate(
          { event: excuse.event._id, student: excuse.student._id },
          { status: "excused", communityServiceHours: 0 },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const notification = new Notification({
          user: excuse.student._id,
          type: "excuse",
          title: "Advance Excuse Approved",
          message: `Your advance excuse for "${excuse.event.title}" was approved. You won't receive community service hours if you miss this event.`,
          relatedEvent: excuse.event._id,
        });
        await notification.save();
      } else {
        const attendance = await Attendance.findOneAndUpdate(
          { event: excuse.event._id, student: excuse.student._id },
          { status: "excused", communityServiceHours: 0 },
          { new: true }
        );

        const notification = new Notification({
          user: excuse.student._id,
          type: "excuse",
          title: "Excuse Approved",
          message: `Your excuse for "${excuse.event.title}" was approved. Any community service hours for this event have been removed.`,
          relatedEvent: excuse.event._id,
        });
        await notification.save();
      }
    } else if (status === "rejected") {
      const notification = new Notification({
        user: excuse.student._id,
        type: "excuse",
        title: "Excuse Rejected",
        message: `Your excuse for "${excuse.event.title}" was rejected.${responseNote ? ` Note: ${responseNote}` : ""}`,
        relatedEvent: excuse.event._id,
      });
      await notification.save();
    }

    res.json(excuse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
