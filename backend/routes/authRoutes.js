// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const User = require("../models/User");
const FaceAppeal = require("../models/FaceAppeal");
const faceMatcher = require("../services/faceMatcher");
const { notifyAdmins } = require("../services/notifyAdmins");
const { protect, authorize } = require("../middleware/authMiddleware");

const LOCK_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const FACE_LOCK_ATTEMPTS = 3;
const FACE_LOCK_MINUTES = 5;

const getDeviceId = (req) => req.headers["x-device-id"] || req.body.deviceId || "";

// Temporary upload for recovery selfies (deleted right after processing).
const recoveryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `recovery-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const recoveryUpload = multer({
  storage: recoveryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      /jpeg|jpg|png|gif/.test(path.extname(file.originalname).toLowerCase()) &&
      /jpeg|jpg|png|gif/.test(file.mimetype)
    ) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif)"));
  },
});

// Persistent upload for appeal proof photos (kept on disk like face photos, so
// admins can review them side-by-side with the enrolled face photo).
const appealStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `appeal-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const appealUpload = multer({
  storage: appealStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      /jpeg|jpg|png|gif/.test(path.extname(file.originalname).toLowerCase()) &&
      /jpeg|jpg|png|gif/.test(file.mimetype)
    ) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif)"));
  },
});

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

const lockRemaining = (user) => {
  if (!user.pinLockUntil || user.pinLockUntil <= new Date()) return 0;
  return Math.ceil((user.pinLockUntil - new Date()) / 60000);
};

const rejectIfLocked = (user, res) => {
  const mins = lockRemaining(user);
  if (mins > 0) {
    res
      .status(423)
      .json({ message: `Too many attempts. Try again in ${mins} minute(s).` });
    return true;
  }
  return false;
};

// -------------------- REGISTER (STUDENT ONLY) --------------------
// The system mints the security PIN (students never choose it) and shows it
// once in the response so the student can record it.
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const deviceId = getDeviceId(req);

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const pin = User.generatePin();
    const user = new User({
      name,
      email,
      password, // ✅ plain (model will hash)
      role: "student",
    });
    await user.setPin(pin);
    if (deviceId) user.trustDevice(deviceId, req.body.deviceLabel);

    await user.save();

    console.log("Registered student:", email, "| PIN assigned");

    res.status(201).json({
      message: "User registered successfully",
      token: signToken(user),
      role: user.role,
      pin,
      deviceTrusted: !!deviceId,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- LOGIN (ALL ROLES) --------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const deviceId = getDeviceId(req);

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    // Non-students skip device verification entirely
    if (user.role !== "student") {
      return res.json({ token: signToken(user), role: user.role });
    }

    if (rejectIfLocked(user, res)) return;

    // First assignment: no PIN hashed yet (legacy student or admin cleared it)
    if (!user.pinHash) {
      const pin = User.generatePin();
      await user.setPin(pin);
      if (deviceId) user.trustDevice(deviceId, req.body.deviceLabel);
      await user.save();
      console.log("Assigned fresh security PIN to", email);
      return res.json({
        token: signToken(user),
        role: user.role,
        pin,
        message: "A security PIN has been assigned. Save it for new devices.",
      });
    }

    // Trusted device → straight in
    if (deviceId && user.isDeviceTrusted(deviceId)) {
      user.trustDevice(deviceId);
      await user.save();
      console.log("Login successful (trusted device):", email);
      return res.json({ token: signToken(user), role: user.role });
    }

    // New/unknown device → ask for the security PIN
    return res.json({
      requiresPin: true,
      email,
      message: "This device isn't verified yet. Enter your security PIN.",
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- VERIFY DEVICE (STUDENT, NEW DEVICE) --------------------
// Verifies the entering PIN, signs the student in, and silently rotates the PIN
// for the next new device. The current PIN is only shown on the Security page.
router.post("/verify-device", async (req, res) => {
  const { email, pin, deviceId, deviceLabel } = req.body;

  try {
    if (!email || !pin || !deviceId) {
      return res.status(400).json({ message: "Please fill all fields" });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: "Invalid security PIN" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (rejectIfLocked(user, res)) return;

    const ok = await user.comparePin(pin);
    if (!ok) {
      user.pinAttempts = (user.pinAttempts || 0) + 1;
      let status = 400;
      let message = "Incorrect security PIN";
      if (user.pinAttempts >= LOCK_ATTEMPTS) {
        user.pinLockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
        user.pinAttempts = 0;
        status = 423;
        message = `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`;
      } else {
        message += ` (${LOCK_ATTEMPTS - user.pinAttempts} attempts left)`;
      }
      await user.save();
      return res.status(status).json({ message });
    }

    const isNew = !user.isDeviceTrusted(deviceId);
    user.pinAttempts = 0;
    user.pinLockUntil = null;
    user.trustDevice(deviceId, deviceLabel);

    // Rotate silently only when a genuinely new device is verified. The new PIN
    // is never shown here — students view it on the Security settings page.
    if (isNew) {
      await user.setPin(User.generatePin());
      console.log("New device verified:", email, "| PIN rotated (silent)");
    }

    await user.save();
    res.json({ token: signToken(user), role: user.role });
  } catch (err) {
    console.error("VERIFY DEVICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- ROTATE PIN (STUDENT, TRUSTED DEVICE) --------------------
router.post("/rotate-pin", protect, authorize("student"), async (req, res) => {
  try {
    const newPin = User.generatePin();
    await req.user.setPin(newPin);
    await req.user.save();
    console.log("PIN rotated by student:", req.user.email);
    res.json({ pin: newPin, message: "Your security PIN has changed." });
  } catch (err) {
    console.error("ROTATE PIN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- TRUSTED DEVICE LIST + CURRENT PIN (STUDENT) --------------------
router.get("/devices", protect, authorize("student"), (req, res) => {
  const devices = [...req.user.trustedDevices].sort(
    (a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt)
  );
  res.json({ devices, pin: req.user.pinPlain || null, facePhoto: req.user.facePhoto || null });
});

// -------------------- REVOKE DEVICE (STUDENT) --------------------
router.delete("/devices/:deviceId", protect, authorize("student"), async (req, res) => {
  try {
    req.user.trustedDevices = req.user.trustedDevices.filter(
      (d) => d.deviceId !== req.params.deviceId
    );
    await req.user.save();
    res.json({ message: "Device removed", devices: req.user.trustedDevices });
  } catch (err) {
    console.error("REVOKE DEVICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- FACE-BASED PIN RECOVERY --------------------
// Students who forgot their security PIN can prove their identity with a live
// face scan (compared server-side against their enrolled face photo). On a
// match the system mints a NEW PIN and signs them in.

const faceLockRemaining = (user) => {
  if (!user.faceLockUntil || user.faceLockUntil <= new Date()) return 0;
  return Math.ceil((user.faceLockUntil - new Date()) / 60000);
};

// STEP 1 — is face recovery available for this account? (password-gated)
router.post("/forgot-pin", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }
    const user = await User.findOne({ email });
    if (!user || user.role !== "student") {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    res.json({ enrolled: !!user.facePhoto, locked: faceLockRemaining(user) > 0 });
  } catch (err) {
    console.error("FORGOT-PIN CHECK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// STEP 2 — upload the live selfie; the server compares it to the enrolled face.
router.post(
  "/forgot-pin/verify",
  recoveryUpload.single("photo"),
  async (req, res) => {
    const tempPath = req.file ? req.file.path : null;
    const cleanup = () => {
      try {
        if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (e) {}
    };

    try {
      const { email, password, deviceId, deviceLabel } = req.body;
      if (!email || !password || !req.file || !getDeviceId(req)) {
        cleanup();
        return res.status(400).json({ message: "Please fill all fields" });
      }

      const user = await User.findOne({ email });
      if (!user || user.role !== "student") {
        cleanup();
        return res.status(400).json({ message: "Invalid email or password" });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        cleanup();
        return res.status(400).json({ message: "Invalid email or password" });
      }

      const mins = faceLockRemaining(user);
      if (mins > 0) {
        cleanup();
        return res
          .status(429)
          .json({ message: `Too many face attempts. Try again in ${mins} minute(s).` });
      }

      if (!user.facePhoto) {
        cleanup();
        return res
          .status(400)
          .json({ message: "You have no face photo enrolled. Ask an admin to reset your security PIN." });
      }

      const refPath = path.join(__dirname, "..", user.facePhoto.replace(/^\//, ""));
      if (!fs.existsSync(refPath)) {
        cleanup();
        return res
          .status(400)
          .json({ message: "Your enrolled face photo is missing. Ask an admin to reset your security PIN." });
      }

      const startedAt = Date.now();
      let live;
      try {
        live = await faceMatcher.detectFaceDescriptor(tempPath);
      } catch (err) {
        cleanup();
        return res
          .status(400)
          .json({ message: err.message || "No face detected. Please look directly at the camera and retake." });
      }
      const liveMs = Date.now() - startedAt;
      const ref = await faceMatcher.detectFaceDescriptorCached(refPath);
      const matched = faceMatcher.descriptorsMatch(live.descriptor, ref.descriptor);
      console.log(
        `[face-verify] ${email}: selfie ${liveMs}ms, total ${Date.now() - startedAt}ms, matched=${matched}`
      );

      if (!matched) {
        user.faceAttempts = (user.faceAttempts || 0) + 1;
        let status = 403;
        let message = `Face does not match the enrolled photo (${FACE_LOCK_ATTEMPTS - user.faceAttempts} attempt(s) left).`;
        if (user.faceAttempts >= FACE_LOCK_ATTEMPTS) {
          user.faceLockUntil = new Date(Date.now() + FACE_LOCK_MINUTES * 60000);
          user.faceAttempts = 0;
          status = 429;
          message = `Too many face attempts. Try again in ${FACE_LOCK_MINUTES} minutes.`;
          // Three failed matches is a red flag — likely a classmate trying to
          // impersonate this student. Alert every admin automatically.
          await notifyAdmins(
            "Possible impersonation attempt",
            `${user.name} (${user.email}) failed face verification ${FACE_LOCK_ATTEMPTS} times and is now locked out for ${FACE_LOCK_MINUTES} minutes. A classmate may be trying to impersonate them.`
          );
        }
        await user.save();
        cleanup();
        return res.status(status).json({ message });
      }

      // Success — mint a fresh PIN, trust this device, clear all lockouts.
      user.faceAttempts = 0;
      user.faceLockUntil = null;
      user.pinAttempts = 0;
      user.pinLockUntil = null;
      const newPin = User.generatePin();
      await user.setPin(newPin);
      user.trustDevice(getDeviceId(req), deviceLabel);
      await user.save();
      cleanup();
      console.log("Face-based PIN recovery succeeded:", email);

      // Informative security alert for the admins (no action required).
      await notifyAdmins(
        "Security PIN recovered via face scan",
        `${user.name} (${user.email}) recovered their security PIN by face verification.`
      );

      res.json({
        token: signToken(user),
        role: user.role,
        pin: newPin,
        message: "Identity verified by face scan. This is your new security PIN.",
      });
    } catch (err) {
      cleanup();
      console.error("FORGOT-PIN VERIFY ERROR:", err);
      res.status(500).json({ message: "Face verification failed. Please try again." });
    }
  }
);

// STEP 3 (fallback) — locked out / camera won't verify you? Submit an appeal.
// Unauthenticated by design: a locked student has no token. Identity is proven
// with email + password (already required by STEP 1), and the proof photo lets
// the admin compare against the enrolled face later.
router.post(
  "/forgot-pin/appeal",
  appealUpload.single("photo"),
  async (req, res) => {
    const cleanup = () => {
      try {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch (e) {}
    };

    try {
      const { email, password } = req.body;
      const note = (req.body.note || "").trim();
      if (!email || !password || !req.file) {
        cleanup();
        return res.status(400).json({ message: "Please fill all fields and attach a proof photo" });
      }

      const user = await User.findOne({ email });
      if (!user || user.role !== "student") {
        cleanup();
        return res.status(400).json({ message: "Invalid email or password" });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        cleanup();
        return res.status(400).json({ message: "Invalid email or password" });
      }
      if (!user.facePhoto) {
        cleanup();
        return res
          .status(400)
          .json({ message: "You have no face photo enrolled. Ask an admin to reset your security PIN." });
      }

      const pending = await FaceAppeal.findOne({ student: user._id, status: "pending" });
      if (pending) {
        cleanup();
        return res.status(400).json({ message: "You already have a pending appeal awaiting review" });
      }

      const appeal = new FaceAppeal({
        student: user._id,
        note,
        photoUrl: `/uploads/${req.file.filename}`,
      });
      await appeal.save();

      await notifyAdmins(
        "New face verification appeal",
        `${user.name} (${user.email}) submitted a face verification appeal. Review their proof photo in Manage Users.`
      );

      res.status(201).json({
        message: "Appeal submitted. An admin will review your proof photo.",
        appeal,
      });
    } catch (err) {
      cleanup();
      console.error("FORGOT-PIN APPEAL ERROR:", err);
      res.status(500).json({ message: "Failed to submit appeal. Please try again." });
    }
  }
);

module.exports = router;