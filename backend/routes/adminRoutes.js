const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const { protect, authorize } = require("../middleware/authMiddleware");

// Admin creates organizer
router.post(
  "/create-organizer",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ message: "Missing fields" });

      const existing = await User.findOne({ email });
      if (existing)
        return res.status(400).json({ message: "User already exists" });

      const organizer = new User({
        name,
        email,
        password,
        role: "organizer",
      });

      await organizer.save();

      res.json({
        message: "Organizer created successfully",
        organizer: {
          id: organizer._id,
          email: organizer.email,
          role: organizer.role,
        },
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// GET ALL USERS (admin and organizer)
router.get("/users", protect, authorize("admin", "organizer"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete(
  "/users/:id",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === "admin") {
        return res.status(403).json({ message: "Cannot delete admin accounts" });
      }

      await User.findByIdAndDelete(req.params.id);

      res.json({ message: "User deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// MANUALLY ADJUST COMMUNITY SERVICE HOURS (admin)
// Overwrites the hours this attendance record contributes to the student's CS
// balance (e.g. correcting the automatic 8 absent / 4 late).
router.patch(
  "/attendance/:id/community-service",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const hours = Number(req.body.hours);
      if (!Number.isFinite(hours) || hours < 0) {
        return res.status(400).json({ message: "Hours must be a number greater than or equal to 0" });
      }

      const attendance = await Attendance.findById(req.params.id).populate("event", "title");
      if (!attendance) {
        return res.status(404).json({ message: "Attendance record not found" });
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
        user: attendance.student,
        type: "penalty",
        title: "Community Service Hours Updated",
        message: `Your community service hours for "${attendance.event?.title || "an event"}" have been set to ${hours} hour(s) by an admin.`,
        relatedEvent: attendance.event ? attendance.event._id : undefined,
      });
      await notification.save();

      const populated = await Attendance.findById(attendance._id)
        .populate("student", "name email")
        .populate("event", "title date");

      res.json(populated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// REMOVE COMMUNITY SERVICE HOURS (admin)
// No `hours` in body = full forgiveness: clears all accumulated penalty hours
// across every attendance record.
// With `hours` = remove that many hours from this record only.
router.patch(
  "/attendance/:id/community-service/remove",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const attendance = await Attendance.findById(req.params.id).populate("event", "title");
      if (!attendance) {
        return res.status(404).json({ message: "Attendance record not found" });
      }

      const studentId = attendance.student;

      // --- Full forgiveness (all admin UI buttons hit this path) ---
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
          message: "Your community service hours have been removed by an admin.",
          relatedEvent: attendance.event ? attendance.event._id : undefined,
        });
        await notification.save();

        const populated = await Attendance.findById(attendance._id)
          .populate("student", "name email")
          .populate("event", "title date");
        return res.json(populated);
      }

      // --- Partial removal (direct API use): removes penalty hours from THIS record only ---
      const hoursToRemove = Number(req.body.hours);
      if (!Number.isFinite(hoursToRemove) || hoursToRemove < 0) {
        return res.status(400).json({ message: "Hours must be a number greater than or equal to 0" });
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
        message: `${removed} community service hour(s) have been removed from your record by an admin.`,
        relatedEvent: attendance.event ? attendance.event._id : undefined,
      });
      await notification.save();

      const populated = await Attendance.findById(attendance._id)
        .populate("student", "name email")
        .populate("event", "title date");

      res.json(populated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;