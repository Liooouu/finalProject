const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Excuse = require("../models/Excuse");
const Notification = require("../models/Notification");
const FaceAppeal = require("../models/FaceAppeal");
const CheckInSession = require("../models/CheckInSession");
const { protect, authorize } = require("../middleware/authMiddleware");
const { availableRoles } = require("../services/accountRoles");
const { getRawEmailSetting, saveEmailSetting } = require("../services/appSettings");
const { resetTransporter, sendMail, isMailEnabled } = require("../services/mailer");
const { notifyUsers } = require("../services/notify");
const fileStore = require("../services/fileStore");
const faceIdentify = require("../services/faceIdentify");
const { seal } = require("../utils/secretBox");

// Organizer access is granted to an existing student; no duplicate account/password.
router.post("/create-organizer", protect, authorize("admin"), (req, res) => res.status(410).json({ message: "Promote an existing student using the Promote Student page." }));
router.get("/organizer-candidates", protect, authorize("admin"), async (req, res) => {
  try {
    const students = await User.find({ role: "student", organizerAccess: { $ne: true } }).select("name email program yearLevel section enrollmentStatus").sort({ name: 1 });
    res.json(students);
  } catch { res.status(500).json({ message: "Could not load eligible students" }); }
});
router.post("/users/:id/promote-organizer", protect, authorize("admin"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid student ID" });
    const existing = await User.findById(req.params.id).select("name email role organizerAccess");
    if (!existing) return res.status(404).json({ message: "Student not found" });
    if (existing.role !== "student") return res.status(400).json({ message: "Only an existing student can be promoted" });
    if (existing.organizerAccess) return res.status(409).json({ message: "This student already has organizer access" });
    const student = await User.findOneAndUpdate({ _id: existing._id, role: "student", organizerAccess: { $ne: true } }, { $set: { organizerAccess: true, organizerPromotedAt: new Date(), organizerPromotedBy: req.user._id }, $inc: { organizerAccessVersion: 1 } }, { new: true, runValidators: true }).select("name email role organizerAccess organizerPromotedAt program yearLevel section enrollmentStatus");
    if (!student) return res.status(409).json({ message: "This student was already promoted or the account changed. Refresh the list." });
    let notificationWarning;
    try {
      await notifyUsers([student], { type: "system", title: "Organizer access granted", message: "An administrator granted you organizer access. Your student attendance and service ledger remain available. Use your account menu to switch between the student and organizer portals." });
    } catch { notificationWarning = "Access was granted, but the notification could not be delivered."; }
    res.json({ message: "Student promoted to organizer. Student access and records are retained.", student: { ...student.toObject(), availableRoles: availableRoles(student) }, ...(notificationWarning ? { notificationWarning } : {}) });
  } catch (error) { res.status(500).json({ message: "Could not promote the student" }); }
});

// Demotion removes only the additional portal grant; student records stay intact.
router.post("/users/:id/demote-organizer", protect, authorize("admin"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid student ID" });
    const existing = await User.findById(req.params.id).select("role organizerAccess");
    if (!existing) return res.status(404).json({ message: "Student not found" });
    if (existing.role !== "student") return res.status(400).json({ message: "Only promoted students can have organizer access removed" });
    const now = new Date();
    const student = await User.findOneAndUpdate({ _id: existing._id, role: "student", organizerAccess: true }, { $set: { organizerAccess: false, organizerDemotedAt: now, organizerDemotedBy: req.user._id }, $inc: { organizerAccessVersion: 1 } }, { new: true, runValidators: true }).select("name email role organizerAccess program yearLevel section enrollmentStatus");
    if (!student) return res.status(409).json({ message: "This student no longer has organizer access. Refresh the list." });
    // The station endpoint also checks the operator's current grant/version.
    let notificationWarning;
    try { await CheckInSession.updateMany({ openedBy: student._id, closedAt: null }, { $set: { closedAt: now } }); }
    catch { notificationWarning = "Access was removed. Station access is revoked, but station closure records could not be updated."; }
    try { await notifyUsers([student], { type: "system", title: "Organizer access removed", message: "An administrator removed your organizer access. Your student account, attendance and community service ledger remain available." }); }
    catch { notificationWarning = [notificationWarning, "The notification could not be delivered."].filter(Boolean).join(" "); }
    res.json({ message: "Organizer access removed. Student access and records are retained.", student: { ...student.toObject(), availableRoles: availableRoles(student) }, ...(notificationWarning ? { notificationWarning } : {}) });
  } catch { res.status(500).json({ message: "Could not remove organizer access" }); }
});

// GET USERS (admin/organizer) - optionally filter by ?role=student
router.get("/users", protect, authorize("admin", "organizer"), async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};

    // Organizers only need the student directory; letting them request
    // role=admin would expose admin accounts (and their metadata).
    if (req.user.role === "organizer") {
      query.role = "student";
    } else if (role) {
      const roles = String(role)
        .split(",")
        .map((r) => r.trim())
        .filter((r) => ["student", "organizer", "admin"].includes(r));
      if (roles.includes("organizer")) query.$or = [{ role: { $in: roles } }, { role: "student", organizerAccess: true }];
      else if (roles.length) query.role = roles.length > 1 ? { $in: roles } : roles[0];
    }

    const projection =
      req.user.role === "organizer"
        ? "name email role program yearLevel section enrollmentStatus academicYearStart faceEnrolledAt organizerAccess createdAt updatedAt"
        : "name email role profilePicture program yearLevel section emailVerified facePhoto faceAttempts faceLockUntil organizerAccess organizerPromotedAt createdAt updatedAt";

    const users = await User.find(query).select(projection).sort({ name: 1 });

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

    if (role !== undefined && role !== user.role && (role === "organizer" || (user.role === "student" && user.organizerAccess))) {
      return res.status(400).json({ message: "Use Promote Student to grant organizer access while keeping student records." });
    }
    if (role !== undefined) {
      if (!["student", "organizer", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      if (String(user._id) === String(req.user._id) && role !== "admin") {
        return res.status(400).json({ message: "You cannot change your own role" });
      }
      // Never leave the system without an admin.
      if (user.role === "admin" && role !== "admin") {
        const admins = await User.countDocuments({ role: "admin" });
        if (admins <= 1) {
          return res.status(400).json({ message: "Cannot change the last admin account" });
        }
      }
      user.role = role;
    }

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ message: "Name cannot be empty" });
      user.name = trimmed;
    }

    if (email !== undefined) {
      const normalized = User.normalizeEmail(email);
      if (!normalized) return res.status(400).json({ message: "Email cannot be empty" });
      if (normalized !== user.email) {
        const conflict = await User.findOne({ email: normalized, _id: { $ne: user._id } });
        if (conflict) return res.status(400).json({ message: "Email already exists" });
        user.email = normalized;
        // A new address has not been proven — require verification when mail is on.
        user.emailVerified = !(await isMailEnabled());
        user.emailVerificationCodeHash = "";
        user.emailVerificationExpires = null;
        user.emailVerificationAttempts = 0;
      }
    }

    if ([program, yearLevel, section].some(value => value !== undefined) && user.role !== "student") return res.status(400).json({ message: "Academic details can only be edited for students" });
    if (program !== undefined && !["BSIT", "BSCS", "BSEMC"].includes(String(program).trim().toUpperCase())) return res.status(400).json({ message: "Program must be BSIT, BSCS, or BSEMC" });
    if (yearLevel !== undefined && (typeof yearLevel !== "number" && typeof yearLevel !== "string" || !String(yearLevel).trim() || !Number.isInteger(Number(yearLevel)) || Number(yearLevel) < 1 || Number(yearLevel) > 4)) return res.status(400).json({ message: "Year level must be a whole number between 1 and 4" });
    if (section !== undefined && !/^[ABC]$/.test(String(section).trim().toUpperCase())) return res.status(400).json({ message: "Section must be A, B, or C" });
    if (program !== undefined) user.program = String(program).trim().toUpperCase();
    if (section !== undefined) user.section = String(section).trim().toUpperCase();
    if (yearLevel !== undefined) user.yearLevel = Number(yearLevel);

    if (user.role === "student") {
      const allowedPrograms = ["BSIT", "BSCS", "BSEMC"];
      if (user.program && !allowedPrograms.includes(user.program)) {
        return res.status(400).json({ message: "Invalid program" });
      }
      if (user.yearLevel !== null && user.yearLevel !== undefined) {
        if (!Number.isInteger(user.yearLevel) || user.yearLevel < 1 || user.yearLevel > 4) {
          return res.status(400).json({ message: "Year level must be between 1 and 4" });
        }
      }
      if (user.section && !/^[ABC]$/.test(user.section)) {
        return res.status(400).json({ message: "Section must be A, B, or C" });
      }
    }

    await user.save();
    const sanitized = user.toObject();
    delete sanitized.password;
    delete sanitized.faceDescriptor;
    delete sanitized.pinHash;
    delete sanitized.pinPlain;
    delete sanitized.emailVerificationCodeHash;
    delete sanitized.passwordResetCodeHash;
    delete sanitized.trustedDevices;
    res.json(sanitized);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: error.message });
  }
});

// RESET A STUDENT'S FACE ENROLLMENT (admin)
// Optional support action. Students can also replace their own face photo
// from Profile > Security.
router.delete("/users/:id/face", protect, authorize("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "student") {
      return res.status(400).json({ message: "Only student accounts have an attendance face" });
    }

    const previous = user.facePhoto;
    user.facePhoto = "";
    user.faceDescriptor = [];
    user.faceEnrolledAt = null;
    user.faceConsentAt = null;
    user.faceEnrollmentVersion = (user.faceEnrollmentVersion || 0) + 1;
    await user.save();

    faceIdentify.remove(user._id);
    if (previous) {
      await fileStore.deleteByUrl(previous).catch((err) => {
        console.error("face reset cleanup error:", err.message);
      });
    }

    res.json({
      message: "Face enrollment reset. The student can enroll again.",
      id: user._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

      // Cascade: removing the account must not leave orphaned attendance,
      // excuse, notification, appeal or reset records (or their files).
      const [excuses, appeals] = await Promise.all([
        Excuse.find({ student: user._id }).select("attachments attachmentUrl submissionHistory"),
        FaceAppeal.find({ student: user._id }).select("photoUrl"),
      ]);
      const files = new Set(
        [
          user.facePhoto,
          user.profilePicture,
          ...excuses.flatMap((e) => [...(e.attachments || []), e.attachmentUrl, ...(e.submissionHistory || []).flatMap(revision => revision.attachments || [])]),
          ...appeals.map((a) => a.photoUrl),
        ].filter(Boolean)
      );
      await fileStore.deleteByUrls([...files]);

      await Promise.all([
        User.findByIdAndDelete(user._id),
        Attendance.deleteMany({ student: user._id }),
        Excuse.deleteMany({ student: user._id }),
        Notification.deleteMany({ user: user._id }),
        FaceAppeal.deleteMany({ student: user._id }),
      ]);
      faceIdentify.remove(user._id);

      res.json({ message: "User deleted successfully" });
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

      await notifyUsers([user], {
        type: "system",
        title: "Face verification unlocked",
        message: "An admin unlocked your face verification. You can try again now.",
      });

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

      const appeal = await FaceAppeal.findOneAndUpdate(
        { _id: req.params.id, status: "pending" },
        {
          status: action,
          reviewedBy: req.user._id,
          responseNote: (note || "").trim(),
        },
        { new: true }
      ).populate("student", "name email");
      if (!appeal) {
        const existing = await FaceAppeal.findById(req.params.id);
        if (!existing) {
          return res.status(404).json({ message: "Appeal not found" });
        }
        return res.status(400).json({ message: `This appeal was already ${existing.status}` });
      }

      if (action === "approved") {
        appeal.student.faceAttempts = 0;
        appeal.student.faceLockUntil = null;
        await appeal.student.save();
      }

      await notifyUsers([appeal.student], {
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

      console.log(`Admin ${action} appeal of`, appeal.student.email);

      res.json({ appeal, message: `Appeal ${action}` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Overall correction uses the existing attendance ledger so every portal agrees.
router.patch("/users/:id/community-service", protect, authorize("admin"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid student ID" });
    const { hours, expectedTotal } = req.body;
    if ((typeof hours !== "number" && typeof hours !== "string") || !String(hours).trim() || !Number.isFinite(Number(hours)) || Number(hours) < 0) return res.status(400).json({ message: "Enter a valid total of zero hours or more" });
    if (typeof expectedTotal !== "number" || !Number.isFinite(expectedTotal) || expectedTotal < 0) return res.status(400).json({ message: "Refresh the student's balance before making an adjustment" });
    const student = await User.findById(req.params.id).select("role");
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (student.role !== "student") return res.status(400).json({ message: "Only student balances can be adjusted" });
    const records = await Attendance.find({ student: student._id }).sort({ attendedAt: 1, _id: 1 });
    const total = records.reduce((sum, record) => sum + (record.communityServiceHours || 0), 0);
    if (Math.abs(total - expectedTotal) > 0.000001) return res.status(409).json({ message: "The balance changed. Reload the student's details and try again." });
    const target = Number(hours);
    if (target > 0 && !records.length) return res.status(400).json({ message: "There are no attendance records to adjust yet" });
    let remaining = Math.abs(target - total);
    const note = `Overall balance adjusted by admin from ${total} to ${target} hours`;
    const changed = [];
    const preservePenalty = record => {
      record.communityServiceLog ||= [];
      if (record.communityServiceHours > 0 && !record.communityServiceLog.some(entry => entry.action === "penalty" || entry.action === "restored")) record.communityServiceLog.push({ action: "penalty", hours: record.communityServiceHours, note: "Existing event hours before overall adjustment" });
    };
    if (target > total) {
      const record = [...records].reverse().find(record => record.communityServiceHours > 0) || records[records.length - 1];
      preservePenalty(record);
      record.communityServiceHours = (record.communityServiceHours || 0) + remaining;
      record.communityServiceLog.push({ action: "penalty", hours: remaining, note });
      changed.push(record);
    } else if (target < total) {
      // Apply reductions oldest first, retaining the event and its original log.
      for (const record of records) {
        if (remaining <= 0) break;
        const removed = Math.min(record.communityServiceHours || 0, remaining);
        if (removed <= 0) continue;
        preservePenalty(record);
        record.communityServiceHours -= removed;
        record.communityServiceLog.push({ action: "removed", hours: removed, note });
        changed.push(record);
        remaining -= removed;
      }
    }
    for (const record of changed) await record.save();
    let notificationWarning;
    if (changed.length) {
      try { await notifyUsers([student._id], { type: "penalty", title: "Overall community service balance updated", message: `An administrator adjusted your overall community service balance from ${total} to ${target} hours.` }); }
      catch { notificationWarning = "The balance was updated, but the notification could not be delivered."; }
    }
    res.json({ totalHours: target, message: "Overall service balance updated.", ...(notificationWarning ? { notificationWarning } : {}) });
  } catch (error) { console.error(error); res.status(500).json({ message: "Could not finish the adjustment. Reload the student's details to check the latest balance before retrying." }); }
});

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

      await notifyUsers([attendance.student], {
        type: "penalty",
        title: "Community Service Hours Updated",
        message: `Your community service hours for "${attendance.event?.title || "an event"}" have been set to ${hours} hour${hours === 1 ? "" : "s"} by an admin.`,
        relatedEvent: attendance.event ? attendance.event._id : undefined,
      });

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

        await notifyUsers([studentId], {
          type: "penalty",
          title: "Community Service Removed",
          message: "Your community service hours have been removed by an admin.",
          relatedEvent: attendance.event ? attendance.event._id : undefined,
        });

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

      await notifyUsers([studentId], {
        type: "penalty",
        title: "Community Service Hours Removed",
        message: `${removed} community service hour${removed === 1 ? "" : "s"} ${removed === 1 ? "has" : "have"} been removed from your record by an admin.`,
        relatedEvent: attendance.event ? attendance.event._id : undefined,
      });

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
      patch.smtp.secure =
        smtp.secure === null || smtp.secure === ""
          ? null
          : smtp.secure === true || smtp.secure === "true";
    }

    if (clearSmtpPassword === true) {
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
    // Record the attempt BEFORE sending: a broken SMTP config must also be
    // throttled, otherwise it can be retried in a tight loop.
    testEmailCooldown.set(String(req.user._id), Date.now());

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

    res.json({ message: `Test email sent to ${email}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
