const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const faceMatcher = require("../services/faceMatcher");
const fileStore = require("../services/fileStore");
const { isMailEnabled } = require("../services/mailer");
const { protect, authorize } = require("../middleware/authMiddleware");
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
// PIN hash, or the email/reset code hashes.
const ACCOUNT_FIELDS =
  "name email role profilePicture program yearLevel section facePhoto trustedDevices pinPlain createdAt updatedAt";

// =======================
// GET ACCOUNT INFO
// =======================
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(ACCOUNT_FIELDS);
    res.json(user);
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
        const taken = await User.findOne({ email: normalized, _id: { $ne: user._id } });
        if (taken) return res.status(400).json({ error: "Email already in use" });
        user.email = normalized;
        // A new address must be re-verified — otherwise someone could move the
        // account onto an address they do not control, or onto an unvalidated one.
        user.emailVerified = (await isMailEnabled()) ? false : true;
        user.emailVerificationCodeHash = "";
        user.emailVerificationExpires = null;
      }
    }

    await user.save();
    const safe = await User.findById(user._id).select(ACCOUNT_FIELDS);
    res.json(safe);
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
// "forgot PIN" recovery flow. Rejects uploads that don't contain a detectable
// face so a random photo can't be enrolled.
router.post(
  "/face",
  protect,
  authorize("student"),
  faceUpload.single("face"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No face photo uploaded" });
    }

    let detected = null;
    try {
      detected = await faceMatcher.detectFaceDescriptorFromBuffer(req.file.buffer);
    } catch {
      return res
        .status(400)
        .json({ error: "No face detected in the photo. Please look directly at the camera and retake." });
    }

    let saved = null;
    try {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ error: "User not found" });

      saved = await fileStore.saveBuffer(req.file.buffer, {
        private: true,
        originalName: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const previous = user.facePhoto;
      user.facePhoto = saved.url;
      user.faceDescriptor = detected.descriptor;
      await user.save();

      if (previous && previous !== saved.url) {
        await fileStore.deleteByUrl(previous).catch((e) => {
          console.error("face cleanup error:", e.message);
        });
      }

      res.json({ facePhoto: user.facePhoto });
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

    const stored = `/uploads/private-faces/${filename}`;
    if (req.user.role !== "admin" && req.user.facePhoto !== stored) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await fileStore.sendFile(res, stored, { cacheControl: "private, max-age=300" });
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

    // Load and authorize BEFORE deleting: the old code deleted the document and
    // only then checked the role, so an admin account was removed and a 400
    // returned anyway.
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.role === "admin") {
      return res.status(400).json({ error: "Cannot delete admin accounts" });
    }

    await User.findByIdAndDelete(req.params.id);
    await fileStore.deleteByUrls([user.facePhoto, user.profilePicture]);

    res.json({ message: "User account deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
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