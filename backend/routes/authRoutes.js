// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");

const LOCK_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

const getDeviceId = (req) => req.headers["x-device-id"] || req.body.deviceId || "";

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
// On success the system rotates the security PIN and shows the new value once.
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
    await user.save();

    // Already-trusted device re-verifying doesn't rotate anything
    if (!isNew) {
      return res.json({ token: signToken(user), role: user.role });
    }

    // Rotate the security PIN after a successful new-device verification
    const newPin = User.generatePin();
    await user.setPin(newPin);
    await user.save();
    console.log("New device verified:", email, "| PIN rotated");

    res.json({
      token: signToken(user),
      role: user.role,
      pin: newPin,
      message:
        "Device verified. Your security PIN has changed — save the new one for next time.",
    });
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

// -------------------- TRUSTED DEVICE LIST (STUDENT) --------------------
router.get("/devices", protect, authorize("student"), (req, res) => {
  const devices = [...req.user.trustedDevices].sort(
    (a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt)
  );
  res.json(devices);
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

module.exports = router;