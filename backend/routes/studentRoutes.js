const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/authMiddleware");
const Attendance = require("../models/Attendance");
const Excuse = require("../models/Excuse");
const Event = require("../models/Event");
const User = require("../models/User");
const Notification = require("../models/Notification");
const FaceAppeal = require("../models/FaceAppeal");
const { notifyAdmins } = require("../services/notifyAdmins");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

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
    // Penalties (late=4, absent=8) add to totalHours (the student's community
    // service hours); excuses/removals take them off. completedHours stays 0
    // here — it only moves when the student genuinely finishes service.
    const completedHours = 0;

    res.json({
      totalHours,
      completedHours,
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

router.post("/excuses", protect, upload.array("attachments", 5), async (req, res) => {
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
      attachmentUrl: req.files && req.files.length ? `/uploads/${req.files[0].filename}` : null,
      attachments: req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [],
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

// MY FACE VERIFICATION APPEALS (student)
router.get("/security/face-appeals", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Only students can access this" });
    }
    const appeals = await FaceAppeal.find({ student: req.user._id }).sort({ createdAt: -1 });
    res.json(appeals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SUBMIT A FACE VERIFICATION APPEAL (student)
// "The camera won't verify me" -> upload a proof photo + a short note. The
// admin compares the proof against the enrolled face photo and either unlocks
// the student or rejects the appeal.
router.post("/security/face-appeals", protect, upload.single("photo"), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {}
      }
      return res.status(403).json({ error: "Only students can submit an appeal" });
    }

    const note = (req.body.note || "").trim();
    if (!req.file) {
      return res.status(400).json({ error: "A proof photo is required" });
    }

    const pending = await FaceAppeal.findOne({
      student: req.user._id,
      status: "pending",
    });
    if (pending) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
      return res.status(400).json({ error: "You already have a pending appeal awaiting review" });
    }

    const appeal = new FaceAppeal({
      student: req.user._id,
      note,
      photoUrl: `/uploads/${req.file.filename}`,
    });
    await appeal.save();

    // Alert every admin — the message includes the student's name + email so
    // the admin does not have to search for who needs help.
    await notifyAdmins(
      "New face verification appeal",
      `${req.user.name} (${req.user.email}) submitted a face verification appeal. Review their proof photo in Manage Users.`
    );

    res.status(201).json(appeal);
  } catch (err) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({ error: err.message });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE" ? "Each file must be less than 5MB" : err.message,
    });
  }
  next(err);
});

module.exports = router;
