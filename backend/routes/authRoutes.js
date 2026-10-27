// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { sendMail, isMailEnabled } = require("../services/mailer");
const { renderVerificationEmail, renderPasswordResetEmail } = require("../services/emailTemplate");
const { isStrongPassword, PASSWORD_MESSAGE } = require("../utils/passwordPolicy");

// Email-verification policy.
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
// Mint a fresh 6-digit code, store its hash + expiry, and email it. Any prior
// code is replaced, so only the newest email can be used.
async function issueEmailCode(user) {
  const code = User.generateCode();
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
  const code = User.generateCode();
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

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

// -------------------- REGISTER (STUDENT ONLY) --------------------
// Registration requires email verification when email delivery is enabled.
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

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
    await user.save();

    // No mail configured → keep the original instant-signup behaviour.
    if (!mailEnabled) {
      console.log("Registered student:", email, "| email verification off");
      return res.status(201).json({
        message: "User registered successfully",
        token: signToken(user),
        role: user.role,
        requiresFaceEnrollment: true,
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
// Verify the email, then continue to attendance face enrollment.
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;

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

    await user.save();
    console.log("Email verified:", email);

    res.json({
      message: "Email verified successfully",
      token: signToken(user),
      role: user.role,
      requiresFaceEnrollment: !user.faceEnrolledAt || !user.faceConsentAt,
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
// does NOT sign the caller in; the user signs in with the new password.
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

    return res.json({ token: signToken(user), role: user.role,
      requiresFaceEnrollment: user.role === "student" && (!user.faceEnrolledAt || !user.faceConsentAt || user.faceDescriptor?.length !== 128),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
