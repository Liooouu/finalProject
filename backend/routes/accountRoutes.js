const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const faceMatcher = require("../services/faceMatcher");
const { isMailEnabled } = require("../services/mailer");
const { protect, authorize } = require("../middleware/authMiddleware");
const { isStrongPassword, PASSWORD_MESSAGE } = require("../utils/passwordPolicy");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const prefix = file.fieldname === "face" ? "face" : "profile";
    cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Face photos are biometric data: they live in their own directory that the
// public /uploads static handler refuses to serve (see server.js) and are only
// readable through the authenticated /account/face/:filename route.
const FACE_DIR = path.join(__dirname, "..", "uploads", "private-faces");
fs.mkdirSync(FACE_DIR, { recursive: true });

const faceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FACE_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `face-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

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
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: allowedImage,
});

const faceUpload = multer({
  storage: faceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
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
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const pictureUrl = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: pictureUrl },
      { new: true }
    ).select("-password");

    res.json({ profilePicture: pictureUrl, user });
  } catch (err) {
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

    const filePath = req.file.path;
    try {
      // Validates the photo and caches its descriptor in the same pass, so the
      // student's first PIN recovery doesn't have to re-analyse the reference.
      try {
        await faceMatcher.detectFaceDescriptorCached(filePath);
      } catch {
        fs.unlinkSync(filePath);
        return res
          .status(400)
          .json({ error: "No face detected in the photo. Please look directly at the camera and retake." });
      }

      const user = await User.findById(req.user._id);

      // Remove the old face photo to avoid growing storage with stale files.
      if (user.facePhoto) {
        const oldPath = path.join(__dirname, "..", user.facePhoto.replace(/^\//, ""));
        try {
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (e) {
          console.error("face cleanup error:", e.message);
        }
      }

      user.facePhoto = `/uploads/private-faces/${req.file.filename}`;
      await user.save();

      res.json({ facePhoto: user.facePhoto });
    } catch (err) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {}
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

    const abs = path.join(FACE_DIR, filename);
    if (!abs.startsWith(FACE_DIR + path.sep) || !fs.existsSync(abs)) {
      return res.status(404).json({ error: "Photo not found" });
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.sendFile(abs);
  } catch (err) {
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
      error: err.code === "LIMIT_FILE_SIZE" ? "File must be less than 5MB" : err.message,
    });
  }
  if (err && /only jpeg or png/i.test(String(err.message))) {
    return res.status(400).json({ error: "Only JPEG or PNG images are allowed" });
  }
  next(err);
});

module.exports = router;