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

      // Goal-only: the hours an admin gives become the student's required service
      // goal. The accumulated total stays driven by automatic penalties.
      const student = await User.findByIdAndUpdate(
        attendance.student,
        { requiredServiceHours: hours },
        { new: true }
      );
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      let message;
      if (hours === 0) {
        message = `Your community service requirement has been cleared by an admin.`;
      } else {
        message = `Your community service goal has been set to ${hours} hour(s) by an admin.`;
      }

      const notification = new Notification({
        user: attendance.student,
        type: "penalty",
        title: "Community Service Goal Updated",
        message,
        relatedEvent: attendance.event._id,
      });
      await notification.save();

      const populated = await Attendance.findById(attendance._id)
        .populate("student", "name email requiredServiceHours")
        .populate("event", "title date");

      res.json({ ...populated.toObject(), requiredServiceHours: student.requiredServiceHours });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// REMOVE COMMUNITY SERVICE HOURS (admin)
// No `hours` in body = full forgiveness: clears the student's stored goal AND
// all accumulated penalty hours across every attendance record.
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
      let student = await User.findById(studentId);

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

        if (student && student.requiredServiceHours > 0) {
          student.requiredServiceHours = 0;
          await student.save();
        }

        const notification = new Notification({
          user: studentId,
          type: "penalty",
          title: "Community Service Removed",
          message: "Your community service requirement has been cleared by an admin.",
          relatedEvent: attendance.event ? attendance.event._id : undefined,
        });
        await notification.save();

        const populated = await Attendance.findById(attendance._id)
          .populate("student", "name email requiredServiceHours")
          .populate("event", "title date");
        return res.json({
          ...populated.toObject(),
          requiredServiceHours: student ? student.requiredServiceHours : 0,
        });
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
        .populate("student", "name email requiredServiceHours")
        .populate("event", "title date");

      res.json({
        ...populated.toObject(),
        requiredServiceHours: student ? student.requiredServiceHours : 0,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;