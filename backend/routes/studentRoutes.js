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
const FaceAppeal = require("../models/FaceAppeal");
const { notifyAdmins } = require("../services/notifyAdmins");
const { notifyUsers } = require("../services/notify");
const { isTerminal, eventStartsAt } = require("../services/eventLifecycle");

// Multer has already written the files to disk before the route runs, so every
// early return must remove them or failed submissions leak storage.
function unlinkUploads(req) {
  const files = [...(req.files || []), ...(req.file ? [req.file] : [])];
  for (const file of files) {
    try {
      if (file.path) fs.unlinkSync(file.path);
    } catch {
      // Already gone — nothing to clean up.
    }
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // JPEG/PNG only — these files are served back from the app origin, so
    // scriptable types (svg/html/gif) would be a stored-XSS vector.
    const okExt = /jpeg|jpg|png/.test(path.extname(file.originalname).toLowerCase());
    const okMime = /jpeg|jpg|png/.test(file.mimetype);
    if (okExt && okMime) return cb(null, true);
    cb(new Error("Only JPEG or PNG images are allowed"));
  },
});

// Appeal proof photos are biometric: keep them out of the public /uploads tree.
const FACE_DIR = path.join(__dirname, "..", "uploads", "private-faces");
fs.mkdirSync(FACE_DIR, { recursive: true });
const appealUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, FACE_DIR),
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      cb(null, `appeal-${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExt = /jpeg|jpg|png/.test(path.extname(file.originalname).toLowerCase());
    const okMime = /jpeg|jpg|png/.test(file.mimetype);
    if (okExt && okMime) return cb(null, true);
    cb(new Error("Only JPEG or PNG images are allowed"));
  },
});

router.get("/community-service", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Only students can access this" });
    }

    const attendances = await Attendance.find({ student: req.user._id })
      .populate("event", "title date time")
      .sort({ attendedAt: -1 });

    const totalHours = attendances.reduce((sum, a) => sum + (a.communityServiceHours || 0), 0);
    // Only real attendance counts; pending (never marked) and excused do not.
    const totalAttended = attendances.filter(
      (a) => a.status === "present" || a.status === "late"
    ).length;
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
      unlinkUploads(req);
      return res.status(404).json({ error: "Event not found" });
    }

    // Only one active (pending/approved) excuse allowed per event
    const activeExcuse = await Excuse.findOne({
      student: req.user._id,
      event: eventId,
      status: { $in: ["pending", "approved"] },
    });
    if (activeExcuse) {
      unlinkUploads(req);
      return res.status(400).json({
        error:
          activeExcuse.status === "pending"
            ? "You already have a pending excuse for this event"
            : "Your excuse for this event was already approved",
      });
    }

    if (type === "advance") {
      // Advance excuses must be filed before the event starts, while it can
      // still be missed. Otherwise a student could file one after the event
      // ends but before the absence job runs and dodge the penalty.
      const startsAt = eventStartsAt(event);
      if (isTerminal(event.status) || !startsAt || startsAt <= new Date()) {
        unlinkUploads(req);
        return res.status(400).json({
          error: "Advance excuses can only be filed for upcoming events",
        });
      }

      // Upcoming events only — student must not have an attendance record yet
      const existingAttendance = await Attendance.findOne({
        event: eventId,
        student: req.user._id,
      });
      if (existingAttendance) {
        unlinkUploads(req);
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
        unlinkUploads(req);
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
    }).select("_id name email");
    if (reviewers.length > 0) {
      await notifyUsers(reviewers, {
        type: "excuse",
        title: "New Excuse Letter",
        message: `${req.user.name} submitted an ${
          type === "advance" ? "advance" : "absence"
        } excuse letter for "${event.title}". It awaits your review.`,
        relatedEvent: event._id,
        event,
      });
    }

    res.status(201).json(excuse);
  } catch (err) {
    unlinkUploads(req);
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
router.post("/security/face-appeals", protect, appealUpload.single("photo"), async (req, res) => {
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
      photoUrl: `/uploads/private-faces/${req.file.filename}`,
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
  // fileFilter rejections are plain Errors; without this they surface as 500s.
  if (err && /Only JPEG or PNG/.test(err.message || "")) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
