// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const User = require("../models/User");
const FaceAppeal = require("../models/FaceAppeal");
const PinResetRequest = require("../models/PinResetRequest");
const faceMatcher = require("../services/faceMatcher");
const { notifyAdmins, notifyStaff } = require("../services/notifyAdmins");
const { sendMail, isMailEnabled } = require("../services/mailer");
const { renderVerificationEmail, renderPasswordResetEmail } = require("../services/emailTemplate");
const { protect, authorize } = require("../middleware/authMiddleware");
const { isStrongPassword, PASSWORD_MESSAGE } = require("../utils/passwordPolicy");

const LOCK_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const FACE_LOCK_ATTEMPTS = 3;
const FACE_LOCK_MINUTES = 5;

// Biometric uploads live in the private directory the static handler refuses;
// ensure it exists even when this router is loaded outside the full server.
fs.mkdirSync(path.join(__dirname, "..", "uploads", "private-faces"), { recursive: true });

// Email-verification policy.
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
// A student may re-file a PIN reset request this long after their last one.
const RESET_REQUEST_COOLDOWN_MS = 10 * 60 * 1000;

const getDeviceId = (req) => req.headers["x-device-id"] || req.body.deviceId || "";

// Mint a fresh 6-digit code, store its hash + expiry, and email it. Any prior
// code is replaced, so only the newest email can be used.
async function issueEmailCode(user) {
  const code = User.generatePin();
  await user.setEmailCode(code);
  user.emailVerificationExpires = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  user.emailVerificationAttempts = 0;
  user.emailVerificationLastSentAt = new Date();
  await user.save();

  const { subject, html, text } = await renderVerificationEmail({ name: user.name, code });
  const sent = await sendMail({
    to: user.email,
    subject,
    html,
    text,
  });

  // Mail is enabled but the send failed (bad credentials, provider outage).
  // The student can't complete signup without the code, so outside production
  // print it to the server console to keep the flow testable. Never do this in
  // production — a verification code in the logs is a security leak.
  if (!sent && process.env.NODE_ENV !== "production") {
    console.warn(
      `[mail] Verification email NOT sent to ${user.email}. DEV-ONLY code: ${code}`
    );
  }

  return code;
}

// Mint a fresh 6-digit reset code for an EXISTING account, store its hash +
// expiry, and email it. Mirrors issueEmailCode() but writes to the dedicated
// password-reset fields, so a signup verification code in flight is never
// clobbered (and vice versa).
async function issuePasswordResetCode(user) {
  const code = User.generatePin();
  await user.setPasswordCode(code);
  user.passwordResetExpires = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  user.passwordResetAttempts = 0;
  user.passwordResetLastSentAt = new Date();
  await user.save();

  const { subject, html, text } = await renderPasswordResetEmail({ name: user.name, code });
  const sent = await sendMail({
    to: user.email,
    subject,
    html,
    text,
  });

  // Same DEV-only escape hatch as signup verification: keep the flow testable
  // when mail is off or the send fails. Never print a code in production.
  if (!sent && process.env.NODE_ENV !== "production") {
    console.warn(
      `[mail] Password reset email NOT sent to ${user.email}. DEV-ONLY code: ${code}`
    );
  }

  return sent;
}

// Temporary upload for recovery selfies (deleted right after processing).
const recoveryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/private-faces/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `recovery-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const recoveryUpload = multer({
  storage: recoveryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Biometric images: JPEG/PNG only, never GIF/SVG/HTML.
    if (
      /jpeg|jpg|png/.test(path.extname(file.originalname).toLowerCase()) &&
      /jpeg|jpg|png/.test(file.mimetype)
    ) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG or PNG images are allowed"));
  },
});

// Persistent upload for appeal proof photos (kept on disk like face photos, so
// admins can review them side-by-side with the enrolled face photo). Stored in
// the private directory because they are biometric proof.
const appealStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/private-faces/"),
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
      /jpeg|jpg|png/.test(path.extname(file.originalname).toLowerCase()) &&
      /jpeg|jpg|png/.test(file.mimetype)
    ) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG or PNG images are allowed"));
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
      .json({ message: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` });
    return true;
  }
  return false;
};

// -------------------- REGISTER (STUDENT ONLY) --------------------
// The system mints the security PIN (students never choose it) and shows it
// once in the response so the student can record it. When email sending is
// configured the account stays inactive until the student enters the 6-digit
// code we email them; when it isn't configured (e.g. local dev) the student is
// auto-verified and signed in exactly as before.
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const deviceId = getDeviceId(req);

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: PASSWORD_MESSAGE });
    }

    const mailEnabled = await isMailEnabled();
    const existingUser = await User.findOne({ email: User.normalizeEmail(email) });

    if (existingUser) {
      // A student who started signup while verification was on but never
      // finished can resume it. The pending account cannot be used until the
      // emailed code is entered, so refreshing the password here is safe — and
      // necessary, otherwise a typo in the password would be permanent.
      if (existingUser.emailVerified === false && mailEnabled) {
        existingUser.name = String(name).trim();
        existingUser.password = String(password);
        existingUser.trustedDevices = [];
        await existingUser.save();
        await issueEmailCode(existingUser);
        return res.status(200).json({
          message: "We re-sent your verification code. Check your inbox.",
          requiresEmailVerification: true,
          email: existingUser.email,
        });
      }
      return res.status(400).json({ message: "Email already exists" });
    }

    const pin = User.generatePin();
    let program = req.body.program;
    let yearLevel = req.body.yearLevel;
    let section = req.body.section;

    if (!program || !yearLevel || !section) {
      return res
        .status(400)
        .json({ message: "Please provide your program, year level, and section" });
    }

    program = String(program).trim().toUpperCase();
    section = String(section).trim().toUpperCase();
    yearLevel = Number(yearLevel);

    const allowedPrograms = ["BSIT", "BSCS", "BSEMC"];
    if (!allowedPrograms.includes(program)) {
      return res.status(400).json({ message: "Invalid program" });
    }
    if (!Number.isFinite(yearLevel) || yearLevel < 1 || yearLevel > 4) {
      return res.status(400).json({ message: "Year level must be between 1 and 4" });
    }
    if (!/^[ABC]$/.test(section)) {
      return res.status(400).json({ message: "Section must be A, B, or C" });
    }

    const user = new User({
      name,
      email,
      password, // ✅ plain (model will hash)
      role: "student",
      program,
      yearLevel,
      section,
      emailVerified: !mailEnabled,
    });
    await user.setPin(pin);
    // Only trust the device once the account is actually usable; when mail is
    // on, the device is trusted at /verify-email after the code is entered.
    if (deviceId && !mailEnabled) user.trustDevice(deviceId, req.body.deviceLabel);

    await user.save();

    // No mail configured → keep the original instant-signup behaviour.
    if (!mailEnabled) {
      console.log("Registered student:", email, "| PIN assigned (email verification off)");
      return res.status(201).json({
        message: "User registered successfully",
        token: signToken(user),
        role: user.role,
        pin,
        deviceTrusted: !!deviceId,
      });
    }

    await issueEmailCode(user);
    console.log("Registered student (awaiting email verification):", email);

    res.status(201).json({
      message: "We emailed you a 6-digit code to finish creating your account.",
      requiresEmailVerification: true,
      email: user.email,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- VERIFY EMAIL (STUDENT, AFTER REGISTER) --------------------
// Exchanges the emailed 6-digit code for a token + the security PIN, continuing
// the normal onboarding flow (show PIN → enroll face).
router.post("/verify-email", async (req, res) => {
  const { email, code, deviceLabel } = req.body;
  const deviceId = getDeviceId(req);

  try {
    if (!email || !code) {
      return res.status(400).json({ message: "Please enter the code we emailed you." });
    }
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    const user = await User.findOne({ email: User.normalizeEmail(email) });
    if (!user || user.emailVerified !== false) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    if (
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires <= new Date()
    ) {
      return res.status(400).json({ message: "That code has expired. Request a new one." });
    }

    const ok = await user.compareEmailCode(String(code));
    if (!ok) {
      // Atomic increment: concurrent guesses must not overwrite each other's
      // count and reset the attempt budget.
      const updated = await User.findByIdAndUpdate(
        user._id,
        { $inc: { emailVerificationAttempts: 1 } },
        { new: true }
      );
      let message = "Incorrect verification code";
      if (updated.emailVerificationAttempts >= EMAIL_CODE_MAX_ATTEMPTS) {
        await User.findByIdAndUpdate(user._id, {
          emailVerificationCodeHash: "",
          emailVerificationExpires: null,
          emailVerificationAttempts: 0,
        });
        message = "Too many attempts. Request a new code.";
      } else {
        const left = EMAIL_CODE_MAX_ATTEMPTS - updated.emailVerificationAttempts;
        message += ` (${left} ${left === 1 ? "attempt" : "attempts"} left)`;
      }
      return res.status(400).json({ message });
    }

    // Success — activate the account and complete onboarding.
    user.emailVerified = true;
    user.emailVerificationCodeHash = "";
    user.emailVerificationExpires = null;
    user.emailVerificationAttempts = 0;

    const pin = user.pinPlain || User.generatePin();
    if (!user.pinPlain) await user.setPin(pin);
    if (deviceId) user.trustDevice(deviceId, deviceLabel);

    await user.save();
    console.log("Email verified:", email);

    res.json({
      message: "Email verified successfully",
      token: signToken(user),
      role: user.role,
      pin,
      deviceTrusted: !!deviceId,
    });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- RESEND VERIFICATION CODE --------------------
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!(await isMailEnabled())) {
      return res.status(400).json({ message: "Email sending is not configured." });
    }

    const user = await User.findOne({ email: User.normalizeEmail(email) });
    if (!user || user.emailVerified !== false) {
      return res.status(400).json({ message: "No pending verification for this email." });
    }

    if (
      user.emailVerificationLastSentAt &&
      Date.now() - user.emailVerificationLastSentAt.getTime() < EMAIL_RESEND_COOLDOWN_MS
    ) {
      const wait = Math.ceil(
        (EMAIL_RESEND_COOLDOWN_MS -
          (Date.now() - user.emailVerificationLastSentAt.getTime())) /
          1000
      );
      return res
        .status(429)
        .json({ message: `Please wait ${wait}s before requesting another code.` });
    }

    await issueEmailCode(user);
    res.json({
      message: "We sent a new verification code.",
      requiresEmailVerification: true,
      email: user.email,
    });
  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- FORGOT PASSWORD (ALL ROLES) --------------------
// STEP 1 — request a 6-digit code by email. Works for every role (student,
// organizer, admin): anyone with a registered, verified email can recover
// access. The success response is byte-for-byte identical whether or not the
// address exists, so this endpoint can't be used to discover which emails are
// registered.
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Without SMTP nobody could ever receive the code, so don't pretend we sent
    // one. Development keeps going — issuePasswordResetCode() prints the code
    // to the console instead, which keeps the flow testable locally.
    if (!(await isMailEnabled()) && process.env.NODE_ENV === "production") {
      return res.status(503).json({
        message: "Password reset by email is unavailable right now. Contact your administrator.",
      });
    }

    const genericMessage =
      "If an account exists for that email, we've sent a 6-digit code. Check your inbox.";

    const user = await User.findOne({ email: User.normalizeEmail(email) });
    // A registration that never finished verifying can't reset a password it
    // never finished setting — answer exactly like a missing account anyway.
    if (!user || user.emailVerified === false) {
      return res.json({ message: genericMessage });
    }

    if (
      user.passwordResetLastSentAt &&
      Date.now() - user.passwordResetLastSentAt.getTime() < EMAIL_RESEND_COOLDOWN_MS
    ) {
      // Same generic 200 as the normal path: a 429 only for existing accounts
      // would reveal which emails are registered.
      return res.json({ message: genericMessage });
    }

    await issuePasswordResetCode(user);
    res.json({ message: genericMessage });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// STEP 2 — exchange the emailed code for a brand-new password. Deliberately
// does NOT sign the caller in (this runs before login) and does NOT touch the
// security PIN — that stays behind the separate "Forgot your security PIN?"
// face-recovery flow.
router.post("/forgot-password/verify", async (req, res) => {
  const { email, code, password } = req.body;

  try {
    if (!email || !code || !password || !String(password).trim()) {
      return res.status(400).json({ message: "Please fill in all fields." });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: PASSWORD_MESSAGE });
    }
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    const user = await User.findOne({ email: User.normalizeEmail(email) });
    if (
      !user ||
      user.emailVerified === false ||
      !user.passwordResetCodeHash ||
      !user.passwordResetExpires ||
      user.passwordResetExpires <= new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired code. Request a new one." });
    }

    const ok = await user.comparePasswordCode(String(code));
    if (!ok) {
      // Atomic: parallel guesses must not overwrite each other's count.
      const updated = await User.findByIdAndUpdate(
        user._id,
        { $inc: { passwordResetAttempts: 1 } },
        { new: true }
      );
      let message = "Incorrect verification code";
      if (updated.passwordResetAttempts >= EMAIL_CODE_MAX_ATTEMPTS) {
        await User.findByIdAndUpdate(user._id, {
          passwordResetCodeHash: "",
          passwordResetExpires: null,
          passwordResetAttempts: 0,
        });
        message = "Too many attempts. Request a new code.";
      } else {
        const left = EMAIL_CODE_MAX_ATTEMPTS - updated.passwordResetAttempts;
        message += ` (${left} ${left === 1 ? "attempt" : "attempts"} left)`;
      }
      return res.status(400).json({ message });
    }

    // Success — assigning the plain password marks it modified, so the pre-save
    // hook hashes it exactly like registration does.
    user.password = String(password);
    user.passwordResetCodeHash = "";
    user.passwordResetExpires = null;
    user.passwordResetAttempts = 0;
    user.passwordResetLastSentAt = null;
    await user.save();

    console.log("Password reset:", email);
    res.json({ message: "Password updated. Sign in with your new password." });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// -------------------- LOGIN (ALL ROLES) --------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const deviceId = getDeviceId(req);

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    const user = await User.findOne({ email: User.normalizeEmail(email) });
    // Identical message for unknown address and wrong password so this endpoint
    // can't be used to enumerate accounts.
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    // Email not verified yet. If mail is configured, block login and let the
    // frontend route to the code screen; if mail is off, auto-verify so nobody
    // gets stranded (this only happens when SMTP was disabled after signup).
    if (user.emailVerified === false) {
      if (await isMailEnabled()) {
        return res.status(403).json({
          message: "Please verify your email to continue. We can send you a new code.",
          requiresEmailVerification: true,
          email: user.email,
        });
      }
      user.emailVerified = true;
      await user.save();
    }

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
  const { email, password, pin, deviceId, deviceLabel } = req.body;

  try {
    // Requiring the password here means a stolen security PIN alone cannot be
    // used to sign in from an unknown device.
    if (!email || !password || !pin || !deviceId) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: "Invalid security PIN" });
    }

    const user = await User.findOne({ email: User.normalizeEmail(email) });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) return res.status(400).json({ message: "Invalid email or password" });

    if (user.emailVerified === false && (await isMailEnabled())) {
      return res.status(403).json({
        message: "Please verify your email to continue.",
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    if (rejectIfLocked(user, res)) return;

    const ok = await user.comparePin(pin);
    if (!ok) {
      // Increment atomically so parallel guesses can't erase each other's count.
      const updated = await User.findByIdAndUpdate(
        user._id,
        { $inc: { pinAttempts: 1 } },
        { new: true }
      );
      let status = 400;
      let message = "Incorrect security PIN";
      if (updated.pinAttempts >= LOCK_ATTEMPTS) {
        await User.findByIdAndUpdate(user._id, {
          pinLockUntil: new Date(Date.now() + LOCK_MINUTES * 60000),
          pinAttempts: 0,
        });
        status = 423;
        message = `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`;
      } else {
        const left = LOCK_ATTEMPTS - updated.pinAttempts;
        message += ` (${left} ${left === 1 ? "attempt" : "attempts"} left)`;
      }
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
    // A freshly rotated PIN must also clear any lockout left over from the
    // previous one, or the student stays locked on new devices.
    req.user.pinAttempts = 0;
    req.user.pinLockUntil = null;
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
      return res.status(400).json({ message: "Please fill in all fields" });
    }
    const user = await User.findOne({ email: User.normalizeEmail(email) });
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
        return res.status(400).json({ message: "Please fill in all fields" });
      }

      const user = await User.findOne({ email: User.normalizeEmail(email) });
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
          .json({ message: `Too many face attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` });
      }

      if (!user.facePhoto) {
        cleanup();
        return res
          .status(400)
          .json({ message: "You have no face photo enrolled. Request a PIN reset instead — an admin or event organizer can verify you in person." });
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
        // Atomic increment so concurrent attempts can't reset each other's count.
        const updated = await User.findByIdAndUpdate(
          user._id,
          { $inc: { faceAttempts: 1 } },
          { new: true }
        );
        let status = 403;
        let message = "Face does not match the enrolled photo.";
        if (updated.faceAttempts >= FACE_LOCK_ATTEMPTS) {
          await User.findByIdAndUpdate(user._id, {
            faceLockUntil: new Date(Date.now() + FACE_LOCK_MINUTES * 60000),
            faceAttempts: 0,
          });
          status = 429;
          message = `Too many face attempts. Try again in ${FACE_LOCK_MINUTES} minutes.`;
          // Three failed matches is a red flag — likely a classmate trying to
          // impersonate this student. Alert every admin automatically.
          await notifyAdmins(
            "Possible impersonation attempt",
            `${user.name} (${user.email}) failed face verification ${FACE_LOCK_ATTEMPTS} times and is now locked out for ${FACE_LOCK_MINUTES} minutes. A classmate may be trying to impersonate them.`
          );
        } else {
          const left = FACE_LOCK_ATTEMPTS - updated.faceAttempts;
          message = `Face does not match the enrolled photo (${left} ${left === 1 ? "attempt" : "attempts"} left).`;
        }
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
        return res.status(400).json({ message: "Please fill in all fields and attach a proof photo" });
      }

      const user = await User.findOne({ email: User.normalizeEmail(email) });
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
          .json({ message: "You have no face photo enrolled. Request a PIN reset instead — an admin or event organizer can verify you in person." });
      }

      const pending = await FaceAppeal.findOne({ student: user._id, status: "pending" });
      if (pending) {
        cleanup();
        return res.status(400).json({ message: "You already have a pending appeal awaiting review" });
      }

      const appeal = new FaceAppeal({
        student: user._id,
        note,
        photoUrl: `/uploads/private-faces/${req.file.filename}`,
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

// STEP 4 (camera-less fallback) — no camera, no enrolled face, or locked out?
// Ask for a PIN reset instead of a photo appeal. Password-gated exactly like
// the other forgot-PIN steps; an admin or event organizer confirms identity
// on-site and mints the new PIN, so a student can never reset their own
// security by themselves.
router.post("/forgot-pin/reset-request", async (req, res) => {
  try {
    const { email, password, deviceLabel } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    const user = await User.findOne({ email: User.normalizeEmail(email) });
    if (!user || user.role !== "student") {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const pending = await PinResetRequest.findOne({ student: user._id, status: "pending" });
    if (pending) {
      return res
        .status(400)
        .json({ message: "You already have a pending reset request awaiting review" });
    }

    const recent = await PinResetRequest.findOne({ student: user._id }).sort({ createdAt: -1 });
    if (recent && Date.now() - recent.createdAt.getTime() < RESET_REQUEST_COOLDOWN_MS) {
      return res
        .status(429)
        .json({ message: "You already sent a request recently. Please wait a few minutes before sending another." });
    }

    const request = new PinResetRequest({
      student: user._id,
      note: (req.body.note || "").trim(),
      deviceId: getDeviceId(req),
      deviceLabel: deviceLabel || "",
    });
    await request.save();

    await notifyStaff(
      "New security PIN reset request",
      `${user.name} (${user.email}) requested a security PIN reset without face verification. Verify them in person, then approve it to mint a new PIN.`
    );

    console.log("PIN reset request from", user.email);
    res.status(201).json({
      message: "Request sent. An admin or event organizer will verify you in person and give you your new PIN.",
      request,
    });
  } catch (err) {
    console.error("PIN RESET REQUEST ERROR:", err);
    res.status(500).json({ message: "Failed to submit request. Please try again." });
  }
});

module.exports = router;