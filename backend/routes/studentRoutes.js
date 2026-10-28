const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/authMiddleware");
const { hasStudentProfile } = require("../services/accountRoles");
const Attendance = require("../models/Attendance");
const Excuse = require("../models/Excuse");
const Event = require("../models/Event");
const User = require("../models/User");
const FaceAppeal = require("../models/FaceAppeal");
const fileStore = require("../services/fileStore");
const { notifyAdmins } = require("../services/notifyAdmins");
const { notifyUsers } = require("../services/notify");
const { isValidObjectId } = require("mongoose");
const { excuseWindow } = require("../services/excuseWindow");
const { calendarView, promotionPlan } = require("../services/academicCalendar");
const { syncStudentAcademicYear } = require("../services/academicProgression");

router.get("/academic-status", protect, async (req, res) => {
  try {
    if (!hasStudentProfile(req.user)) return res.status(403).json({ error: "Only student accounts can access academic standing" });
    const account = req.user.role === "student" ? req.user : await User.findById(req.user._id);
    if (!account) return res.status(404).json({ error: "Student account not found" });
    const student = await syncStudentAcademicYear(account);
    const calendar = calendarView();
    const basis = student.academicYearStart ?? calendar.current.startYear;
    const next = promotionPlan({ ...student.toObject?.(), yearLevel: student.yearLevel, academicYearStart: basis, section: student.section, program: student.program, enrollmentStatus: student.enrollmentStatus }, calendar.current.startYear + 1);
    res.json({ ...calendar, student: { yearLevel: student.yearLevel, section: student.section, program: student.program, enrollmentStatus: student.enrollmentStatus || "active", academicYearStart: student.academicYearStart, history: student.academicHistory || [] }, nextYear: { label: `${calendar.current.startYear + 1}–${calendar.current.startYear + 2}`, yearLevel: next?.yearLevel || student.yearLevel, enrollmentStatus: next?.enrollmentStatus || student.enrollmentStatus || "active" }, promotionEnabled: calendar.confirmed });
  } catch (err) { res.status(500).json({ error: "Could not load academic standing" }); }
});

const imageFilter = (req, file, cb) => {
  // JPEG/PNG only — these files are served back from the app origin, so
  // scriptable types (svg/html/gif) would be a stored-XSS vector.
  const okExt = /jpeg|jpg|png/.test(path.extname(file.originalname).toLowerCase());
  const okMime = /jpeg|jpg|png/.test(file.mimetype);
  if (okExt && okMime) return cb(null, true);
  cb(new Error("Only JPEG or PNG images are allowed"));
};

const attachmentTypes = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".jpg": ["image/jpeg"], ".jpeg": ["image/jpeg"], ".png": ["image/png"],
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = attachmentTypes[path.extname(file.originalname).toLowerCase()];
    if (allowed?.includes(file.mimetype)) return cb(null, true);
    const error = new Error("Only PDF, DOC, DOCX, JPEG or PNG attachments are allowed");
    error.status = 400;
    cb(error);
  },
});

const appealUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: imageFilter,
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
  const savedUrls = [];
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Only students can submit excuses" });
    }

    const { eventId, excuseText } = req.body;
    if (!isValidObjectId(eventId)) return res.status(400).json({ error: "Please select a valid missed event" });
    if (!String(excuseText || "").trim()) return res.status(400).json({ error: "Please provide an excuse description" });
    if (req.body.type && req.body.type !== "absence") return res.status(400).json({ error: "Only missed-event excuses are supported" });
    if (!req.files?.length) return res.status(400).json({ error: "At least one supporting attachment is required" });
    const type = "absence";

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const window = excuseWindow(event);
    if (!window.allowed) return res.status(400).json({ error: window.reason, deadline: window.deadline });

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

    const absentRecord = await Attendance.findOne({
      event: eventId, student: req.user._id, status: "absent",
    });
    if (!absentRecord) {
      return res.status(400).json({ error: "You can only file excuses for events you were marked absent in" });
    }

    for (const file of req.files || []) {
      const saved = await fileStore.saveBuffer(file.buffer, {
        originalName: file.originalname,
        contentType: file.mimetype,
      });
      savedUrls.push(saved.url);
    }

    const excuse = new Excuse({
      student: req.user._id,
      event: eventId,
      excuseText: String(excuseText).trim(),
      attachmentUrl: savedUrls[0] || null,
      attachments: savedUrls,
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
        message: `${req.user.name} submitted an absence excuse letter for "${event.title}". It awaits your review.`,
        relatedEvent: event._id,
        event,
      }).catch((e) => console.error("EXCUSE NOTIFY ERROR:", e.message));
    }

    res.status(201).json(excuse);
  } catch (err) {
    await fileStore.deleteByUrls(savedUrls);
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
    }).populate("event", "title date time endDate endTime");

    res.json(attendances.map(record => { const data = record.toObject(); const window = record.event ? excuseWindow(record.event) : { allowed: false, deadline: null }; return { ...data, canSubmitExcuse: window.allowed, excuseDeadline: window.deadline }; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MY FACE VERIFICATION APPEALS (student)
router.get("/security/face-appeals", protect, async (req, res) => {
  try {
    if (!hasStudentProfile(req.user)) {
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
  let saved = null;
  try {
    if (!hasStudentProfile(req.user)) {
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
      return res.status(400).json({ error: "You already have a pending appeal awaiting review" });
    }

    saved = await fileStore.saveBuffer(req.file.buffer, {
      private: true,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const appeal = new FaceAppeal({
      student: req.user._id,
      note,
      photoUrl: saved.url,
    });
    await appeal.save();

    // Alert every admin — the message includes the student's name + email so
    // the admin does not have to search for who needs help.
    await notifyAdmins(
      "New face verification appeal",
      `${req.user.name} (${req.user.email}) submitted a face verification appeal. Review their proof photo in Manage Users.`
    ).catch((e) => console.error("APPEAL NOTIFY ERROR:", e.message));

    res.status(201).json(appeal);
  } catch (err) {
    if (saved) await fileStore.deleteByUrl(saved.url).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE" ? "Each file must be less than 4MB" : err.message,
    });
  }
  // fileFilter rejections are plain Errors; without this they surface as 500s.
  if (err && /Only JPEG or PNG/.test(err.message || "")) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
