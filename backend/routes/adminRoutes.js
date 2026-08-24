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
      attendance.communityServiceHours = hours;
      await attendance.save();

      let message;
      if (hours === 0 && previousHours > 0) {
        message = `Your community service hours for "${attendance.event.title}" have been removed by an admin.`;
      } else if (hours > previousHours) {
        message = `${hours - previousHours} community service hour(s) were added to your record for "${attendance.event.title}". You now have ${hours} hour(s) for this event.`;
      } else {
        message = `Your community service hours for "${attendance.event.title}" were updated to ${hours} hour(s).`;
      }

      const notification = new Notification({
        user: attendance.student,
        type: "penalty",
        title: "Community Service Updated",
        message,
        relatedEvent: attendance.event._id,
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