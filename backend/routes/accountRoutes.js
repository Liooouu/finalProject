const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const User = require("../models/User");
const { accountView, hasStudentProfile } = require("../services/accountRoles");
const bcrypt = require("bcryptjs");
const faceMatcher = require("../services/faceMatcher");
const fileStore = require("../services/fileStore");
const { isMailEnabled, sendMail } = require("../services/mailer");
const { renderVerificationEmail } = require("../services/emailTemplate");
const { protect } = require("../middleware/authMiddleware");
const faceIdentify = require("../services/faceIdentify");
const FaceAppeal = require("../models/FaceAppeal");
const { deleteAccount } = require("../services/deleteAccount");
const { isStrongPassword, PASSWORD_MESSAGE } = require("../utils/passwordPolicy");

const allowedImage = (req, file, cb) => {
  // JPEG/PNG only. GIF/SVG/HTML are omitted on purpose: the files are served
  // back from the app origin, so any executable/scriptable type would be a
  // stored-XSS vector.
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error("Only JPEG or PNG images are allowed"));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: allowedImage,
});

const faceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: allowedImage,
});

// Fields the client is allowed to see about an account: never the password, the
// legacy authentication fields or the email/reset code hashes.
const ACCOUNT_FIELDS =
  "name email role organizerAccess organizerPromotedAt profilePicture program yearLevel section academicYearStart academicHistory enrollmentStatus facePhoto faceEnrolledAt faceConsentAt createdAt updatedAt";

// =======================
// GET ACCOUNT INFO
// =======================
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(ACCOUNT_FIELDS);
    res.json(accountView(user, req.user.role));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// UPDATE ACCOUNT INFO
// =======================
router.patch("/", protect, async (req, res) => {
  try {
    const { name, email } = req.body;
    let verificationCode = null;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: "Name cannot be empty" });
      user.name = String(name).trim();
    }

    if (email !== undefined) {
      const normalized = User.normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return res.status(400).json({ error: "Enter a valid email address" });
      }
      if (normalized !== user.email) {
        if (!await isMailEnabled()) return res.status(503).json({ error: "Email verification is unavailable. Your current address was kept; try again later." });
        const taken = await User.findOne({ email: normalized, _id: { $ne: user._id } });
        if (taken) return res.status(400).json({ error: "Email already in use" });
        user.email = normalized;
        // A new address must be re-verified — otherwise someone could move the
        // account onto an address they do not control, or onto an unvalidated one.
        user.emailVerified = false;
        user.sessionVersion = (user.sessionVersion || 0) + 1;
        verificationCode = User.generateCode();
        await user.setEmailCode(verificationCode);
        user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.emailVerificationAttempts = 0;
        user.emailVerificationLastSentAt = new Date();
      }
    }

    await user.save();
    let codeSent;
    if (verificationCode) {
      try { const content = await renderVerificationEmail({ name: user.name, code: verificationCode }); codeSent = await sendMail({ to: user.email, ...content }); }
      catch { codeSent = false; }
    }
    const safe = await User.findById(user._id).select(ACCOUNT_FIELDS);
    res.json({ ...accountView(safe, req.user.role), emailVerificationRequired: user.emailVerified === false, ...(verificationCode ? { codeSent } : {}) });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ error: "Email already in use" });
    }
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CHANGE PASSWORD
// =======================
router.patch("/password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || !String(newPassword).trim()) {
      return res.status(400).json({ error: "Please fill in all fields" });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: PASSWORD_MESSAGE });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "Current password is incorrect" });
    }

    // Assign the plaintext and let the model's pre-save hook hash it exactly
    // once. Hashing here as well stored a hash-of-a-hash, locking the user out.
    user.password = String(newPassword);
    user.sessionVersion = (user.sessionVersion || 0) + 1;

    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// UPLOAD PROFILE PICTURE
// =======================
router.post("/picture", protect, upload.single("picture"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  let saved = null;
  try {
    const previous = await User.findById(req.user._id).select("profilePicture");

    saved = await fileStore.saveBuffer(req.file.buffer, {
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: saved.url },
      { new: true }
    ).select("-password");

    if (previous && previous.profilePicture && previous.profilePicture !== saved.url) {
      await fileStore.deleteByUrl(previous.profilePicture).catch(() => {});
    }

    res.json({ profilePicture: saved.url, user });
  } catch (err) {
    if (saved) await fileStore.deleteByUrl(saved.url).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// =======================
// ENROLL / UPDATE FACE PHOTO (student)
// =======================
// Stores a webcam-captured photo used as the face-match baseline for the
// attendance check-in flow. Requires one detectable face and protects enrolled
// identity changes with the reviewed replacement flow; this is not liveness.
router.post(
  "/face",
  protect,
  (req, res, next) => {
    if (!hasStudentProfile(req.user)) return res.status(403).json({ error: "Only student accounts can manage their face enrollment" });
    next();
  },
  faceUpload.single("face"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No face photo uploaded" });
    }

    let detected = null;
    try {
      detected = await faceMatcher.detectFaceDescriptorFromBuffer(req.file.buffer);
    } catch (err) {
      return res.status(400).json({ error: err.code === "MULTIPLE_FACES"
        ? "Only one face may be visible. Please retake the photo."
        : "No face detected in the photo. Please look directly at the camera and retake." });
    }

    let saved = null;
    try {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.faceEnrolledAt && user.faceConsentAt && user.faceDescriptor?.length === 128 &&
          !faceMatcher.descriptorsMatch(user.faceDescriptor, detected.descriptor)) {
        const grant = await FaceAppeal.findOne({ student: user._id, replacement: true, status: "approved",
          enrollmentVersion: user.faceEnrollmentVersion || 0, reviewedAt: { $gte: new Date(Date.now() - 7 * 86400000) } }).select("+replacementDescriptor").sort({ reviewedAt: -1 });
        if (!grant?.consentAt || grant.replacementDescriptor?.length !== 128 || !faceMatcher.descriptorsMatch(grant.replacementDescriptor, detected.descriptor)) {
          return res.status(409).json({ error: "This capture does not match your enrolled identity. Your existing face was kept. Use Face verification support below so an admin can verify a replacement.", code: "FACE_IDENTITY_REVIEW_REQUIRED" });
        }
      }

      // Students can replace their own enrollment from Profile > Security.
      const consent = String(req.body?.consent || "").toLowerCase() === "true";
      if (!consent) {
        return res.status(400).json({
          error:
            "Consent is required before enrolling your face. Face data is used only to verify attendance.",
        });
      }

      saved = await fileStore.saveBuffer(req.file.buffer, {
        private: true,
        originalName: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const previous = user.facePhoto;
      user.facePhoto = saved.url;
      user.faceDescriptor = detected.descriptor;
      user.faceEnrolledAt = new Date();
      user.faceConsentAt = new Date();
      user.faceEnrollmentVersion = (user.faceEnrollmentVersion || 0) + 1;
      await user.save();

      // Make the new descriptor usable by the kiosk immediately.
      faceIdentify.upsert(user);

      if (previous && previous !== saved.url) {
        await fileStore.deleteByUrl(previous).catch((e) => {
          console.error("face cleanup error:", e.message);
        });
      }

      res.json({ facePhoto: user.facePhoto, faceEnrolledAt: user.faceEnrolledAt });
    } catch (err) {
      if (saved) await fileStore.deleteByUrl(saved.url).catch(() => {});
      console.error("FACE ENROLL ERROR:", err.message);
      res.status(500).json({ error: "Failed to process face photo. Please try again." });
    }
  }
);

// =======================
// READ A PRIVATE FACE PHOTO (owner or admin)
// =======================
// The /uploads static handler refuses the private-faces directory; this is the
// only way to read a face photo, and it checks who is asking.
router.get("/face/:filename", protect, async (req, res) => {
  try {
    const { filename } = req.params;
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
      return res.status(400).json({ error: "Invalid file name" });
    }

    let stored = `/uploads/private-faces/${filename}`;
    if (req.user.facePhoto === `/uploads/${filename}`) stored = req.user.facePhoto;
    if (req.user.role !== "admin" && req.user.facePhoto !== stored) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (req.user.role === "admin") {
      const legacy = await User.exists({ facePhoto: `/uploads/${filename}` });
      if (legacy) stored = `/uploads/${filename}`;
    }
    await fileStore.sendFile(res, stored, { cacheControl: "private, no-store" });
  } catch (err) {
    if (err.code === "FILE_NOT_FOUND") {
      return res.status(404).json({ error: "Photo not found" });
    }
    if (res.headersSent) return res.destroy(err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// DELETE USER ACCOUNT (Admin only)
// =======================
router.delete("/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can delete accounts" });
    }

    res.json(await deleteAccount(req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : "Could not delete the account. Please refresh and retry." });
  }
});

// Turn multer failures (size limit, rejected file type) into clean 400s instead
// of letting the generic error handler report a 500.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE" ? "File must be less than 4MB" : err.message,
    });
  }
  if (err && /only jpeg or png/i.test(String(err.message))) {
    return res.status(400).json({ error: "Only JPEG or PNG images are allowed" });
  }
  next(err);
});

module.exports = router;
