const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const FaceAppeal = require("../models/FaceAppeal");
const PinResetRequest = require("../models/PinResetRequest");
const { protect, authorize } = require("../middleware/authMiddleware");
const { isStrongPassword, PASSWORD_MESSAGE } = require("../utils/passwordPolicy");
const { getRawEmailSetting, saveEmailSetting } = require("../services/appSettings");
const { resetTransporter, sendMail } = require("../services/mailer");
const { seal } = require("../utils/secretBox");

// ADMIN CREATES ORGANIZER
// Registration is student-only, so this is the only way an organizer account is
// created. The password is passed in plain text on purpose: the User model
// hashes it in a pre-save hook.
router.post(
  "/create-organizer",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ message: "Missing fields" });
      if (!isStrongPassword(password)) {
        return res.status(400).json({ message: PASSWORD_MESSAGE });
      }

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

// GET USERS (admin/organizer) - optionally filter by ?role=student
router.get("/users", protect, authorize("admin", "organizer"), async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};
    if (role) {
      const roles = String(role)
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (roles.length) query.role = roles.length > 1 ? { $in: roles } : roles[0];
    }

    const users = await User.find(query)
      .select("-password -pinHash -pinPlain -trustedDevices")
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH USER (admin only) - allow editing basic details + program/year/section
router.patch("/users/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, email, program, yearLevel, section, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (program !== undefined) user.program = String(program).trim().toUpperCase();
    if (section !== undefined) user.section = String(section).trim().toUpperCase();
    if (yearLevel !== undefined) user.yearLevel = Number(yearLevel);

    if (user.role === "student") {
      const allowedPrograms = ["BSIT", "BSCS", "IT", "BSIS", "BSEMC", "OTHER"];
      if (user.program && !allowedPrograms.includes(user.program)) {
        return res.status(400).json({ message: "Invalid program" });
      }
      if (user.yearLevel !== null && user.yearLevel !== undefined) {
        if (!Number.isFinite(user.yearLevel) || user.yearLevel < 1 || user.yearLevel > 4) {
          return res.status(400).json({ message: "Year level must be between 1 and 4" });
        }
      }
      if (user.section && !/^[A-Z]{1,2}$/.test(user.section)) {
        return res.status(400).json({ message: "Section must be 1-2 letters" });
      }
    }

    await user.save();
    const sanitized = user.toObject();
    delete sanitized.password;
    delete sanitized.pinHash;
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE USER (admin)
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

// RESET STUDENT SECURITY (admin)
// Mints a fresh security PIN and returns it so the admin can relay it (student
// forgot their PIN, lost every device, or got locked out). Optionally clears
// all trusted devices too.
router.post(
  "/users/:id/reset-security",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.role !== "student") {
        return res.status(400).json({ message: "Only student accounts have a security PIN" });
      }

      const pin = User.generatePin();
      await user.setPin(pin);
      user.pinAttempts = 0;
      user.pinLockUntil = null;
      // A security reset must also unlock face verification — otherwise a
      // student locked out of the face scanner stays locked even after their
      // PIN is reset.
      user.faceAttempts = 0;
      user.faceLockUntil = null;
      if (req.body.clearDevices) {
        user.trustedDevices = [];
      }
      await user.save();

      console.log("Admin reset security for", user.email);

      res.json({
        message: "Student security reset",
        pin,
        devicesCleared: !!req.body.clearDevices,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// UNLOCK FACE VERIFICATION (admin)
// Clears the failed-attempt counter and face lock so the student can retry
// face verification immediately (e.g. they are physically present and were
// falsely rejected by the camera).
router.post(
  "/users/:id/unlock-face",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.role !== "student") {
        return res.status(400).json({ message: "Only student accounts have face verification" });
      }

      user.faceAttempts = 0;
      user.faceLockUntil = null;
      await user.save();

      const notification = new Notification({
        user: user._id,
        type: "system",
        title: "Face verification unlocked",
        message: "An admin unlocked your face verification. You can try again now.",
      });
      await notification.save();

      res.json({ message: "Face verification unlocked for " + user.email });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// LIST FACE VERIFICATION APPEALS (admin)
// Includes the student's enrolled face photo so the admin can compare it with
// the submitted proof photo without leaving the page.
router.get(
  "/security/face-appeals",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      const appeals = await FaceAppeal.find(filter)
        .populate("student", "name email facePhoto faceAttempts faceLockUntil")
        .sort({ createdAt: -1 });
      res.json(appeals);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// REVIEW A FACE VERIFICATION APPEAL (admin)
// Approve -> clears the face lock and notifies the student they can retry.
// Reject -> records the response note and notifies the student.
router.post(
  "/security/face-appeals/:id/review",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { action, note } = req.body;
      if (!["approved", "rejected"].includes(action)) {
        return res.status(400).json({ message: "action must be 'approved' or 'rejected'" });
      }

      const appeal = await FaceAppeal.findById(req.params.id).populate("student", "name email");
      if (!appeal) {
        return res.status(404).json({ message: "Appeal not found" });
      }
      if (appeal.status !== "pending") {
        return res.status(400).json({ message: `This appeal was already ${appeal.status}` });
      }

      appeal.status = action;
      appeal.reviewedBy = req.user._id;
      appeal.responseNote = (note || "").trim();
      await appeal.save();

      if (action === "approved") {
        appeal.student.faceAttempts = 0;
        appeal.student.faceLockUntil = null;
        await appeal.student.save();
      }

      const notification = new Notification({
        user: appeal.student._id,
        type: "system",
        title:
          action === "approved"
            ? "Face verification appeal approved"
            : "Face verification appeal rejected",
        message:
          action === "approved"
            ? "An admin verified your appeal. You can try face verification again now."
            : `Your face verification appeal was rejected.${appeal.responseNote ? ` Reason: ${appeal.responseNote}` : ""} Ask an admin if you need help.`,
      });
      await notification.save();

      console.log(`Admin ${action} appeal of`, appeal.student.email);

      res.json({ appeal, message: `Appeal ${action}` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// LIST PIN RESET REQUESTS (admin/organizer)
// Camera-less students file these from the sign-in screen; staff verify them
// in person before any PIN is minted. Organizers see the whole queue.
router.get(
  "/security/pin-reset-requests",
  protect,
  authorize("admin", "organizer"),
  async (req, res) => {
    try {
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      const requests = await PinResetRequest.find(filter)
        .populate("student", "name email program yearLevel section")
        .sort({ createdAt: -1 });
      res.json(requests);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// REVIEW A PIN RESET REQUEST (admin/organizer)
// Approve -> mints a fresh PIN, clears every lockout, trusts the device the
// request came from (so the student can sign in with their password alone and
// read the PIN), and returns the PIN for the reviewer to relay in person.
// Reject -> records the reason and notifies the student.
router.post(
  "/security/pin-reset-requests/:id/review",
  protect,
  authorize("admin", "organizer"),
  async (req, res) => {
    try {
      const { action, note, clearDevices } = req.body;
      if (!["approved", "rejected"].includes(action)) {
        return res.status(400).json({ message: "action must be 'approved' or 'rejected'" });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ message: "Reset request not found" });
      }
      const request = await PinResetRequest.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Reset request not found" });
      }
      if (request.status !== "pending") {
        return res.status(400).json({ message: `This request was already ${request.status}` });
      }

      // Load the full document: setPin/trustDevice mutate fields we need intact.
      const student = await User.findById(request.student);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      request.status = action;
      request.reviewedBy = req.user._id;
      request.responseNote = (note || "").trim();

      let pin = null;
      if (action === "approved") {
        pin = User.generatePin();
        await student.setPin(pin);
        student.pinAttempts = 0;
        student.pinLockUntil = null;
        student.faceAttempts = 0;
        student.faceLockUntil = null;
        if (clearDevices) student.trustedDevices = [];
        // Trusted last so a device wipe can never lock the student back out.
        if (request.deviceId) {
          student.trustDevice(request.deviceId, request.deviceLabel);
        }
        await student.save();
      }
      await request.save();

      const notification = new Notification({
        user: student._id,
        type: "system",
        title:
          action === "approved"
            ? "Security PIN reset approved"
            : "Security PIN reset rejected",
        message:
          action === "approved"
            ? `Your identity was verified. Your new security PIN is ${pin}.`
            : `Your security PIN reset request was rejected.${request.responseNote ? ` Reason: ${request.responseNote}` : ""} Ask an admin if you need help.`,
      });
      await notification.save();

      console.log(
        `${req.user.role} ${action} PIN reset request of`,
        student.email
      );

      await request.populate("student", "name email program yearLevel section");
      res.json({ request, pin, message: `Request ${action}` });
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

// -------------------- EMAIL SETTINGS --------------------
// GET — raw DB values (password stripped; hasSmtpPassword flag instead) plus
// which fields currently fall back to environment variables, so the UI can
// show "using environment variables" hints.
router.get("/settings/email", protect, authorize("admin"), async (req, res) => {
  try {
    const raw = await getRawEmailSetting();

    const envFallback = {
      host: !raw.smtp.host && Boolean(process.env.SMTP_HOST),
      user: !raw.smtp.user && Boolean(process.env.SMTP_USER),
      password: !raw.hasSmtpPassword && Boolean(process.env.SMTP_PASS),
      from: !raw.smtp.from && Boolean(process.env.MAIL_FROM),
      appUrl: !raw.smtp.appUrl && Boolean(process.env.APP_URL),
    };

    res.json({ ...raw, envFallback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH — partial update. Empty/absent password keeps the current one;
// clearSmtpPassword: true removes it (reverting to the env fallback).
// Saving invalidates the mailer's cached transporter so the next send uses
// the new values immediately.
router.patch("/settings/email", protect, authorize("admin"), async (req, res) => {
  try {
    const { smtp = {}, templates = {}, clearSmtpPassword } = req.body || {};
    const patch = { smtp: {}, templates: {} };

    if (smtp.host !== undefined) patch.smtp.host = String(smtp.host).trim();
    if (smtp.user !== undefined) patch.smtp.user = String(smtp.user).trim();
    if (smtp.from !== undefined) patch.smtp.from = String(smtp.from).trim();
    if (smtp.appUrl !== undefined) patch.smtp.appUrl = String(smtp.appUrl).trim();

    if (smtp.port !== undefined && smtp.port !== null && smtp.port !== "") {
      const port = Number(smtp.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return res.status(400).json({ message: "Port must be a number between 1 and 65535" });
      }
      patch.smtp.port = port;
    } else if (smtp.port === null || smtp.port === "") {
      patch.smtp.port = null;
    }

    if (smtp.secure !== undefined) {
      patch.smtp.secure = smtp.secure === null || smtp.secure === "" ? null : Boolean(smtp.secure);
    }

    if (clearSmtpPassword) {
      patch.smtp.passEncrypted = "";
    } else if (typeof smtp.password === "string" && smtp.password.trim()) {
      patch.smtp.passEncrypted = seal(smtp.password.trim());
    }

    const allowedTemplateFields = ["subject", "title", "body"];
    for (const key of ["verification", "passwordReset", "notification"]) {
      const block = templates[key];
      if (!block || typeof block !== "object") continue;
      const clean = {};
      for (const field of allowedTemplateFields) {
        if (block[field] !== undefined) clean[field] = String(block[field]);
      }
      if (Object.keys(clean).length) patch.templates[key] = clean;
    }

    const saved = await saveEmailSetting(patch, req.user._id);
    resetTransporter();

    res.json({
      message: "Email settings saved",
      ...saved,
      envFallback: {
        host: !saved.smtp.host && Boolean(process.env.SMTP_HOST),
        user: !saved.smtp.user && Boolean(process.env.SMTP_USER),
        password: !saved.hasSmtpPassword && Boolean(process.env.SMTP_PASS),
        from: !saved.smtp.from && Boolean(process.env.MAIL_FROM),
        appUrl: !saved.smtp.appUrl && Boolean(process.env.APP_URL),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST — send a short test email through the current settings so a
// misconfigured host/credential is visible immediately. Simple in-memory
// 60s-per-admin cooldown to deter spamming.
const testEmailCooldown = new Map();
router.post("/settings/email/test", protect, authorize("admin"), async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    const last = testEmailCooldown.get(String(req.user._id)) || 0;
    if (Date.now() - last < 60 * 1000) {
      return res.status(429).json({ message: "Please wait a minute before sending another test email." });
    }

    const sent = await sendMail({
      to: email,
      subject: "[TrackED] Test email",
      html: `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:28px;"><h1 style="font-size:20px;color:#111827;">TrackED test email</h1><p style="font-size:15px;color:#374151;">If you're reading this, the SMTP settings saved on the Email Settings page are working.</p></div>`,
      text: "TrackED test email — if you're reading this, the SMTP settings saved on the Email Settings page are working.",
    });

    if (!sent) {
      return res.status(502).json({
        message: "Could not send the test email. Check the host, port, user, and password, then try again.",
      });
    }

    testEmailCooldown.set(String(req.user._id), Date.now());
    res.json({ message: `Test email sent to ${email}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
