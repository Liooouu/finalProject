// backend/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["student", "organizer", "admin"],
      required: true,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    facePhoto: {
      type: String,
      default: "",
    },
    faceDescriptor: {
      type: [Number],
      default: [],
    },
    faceAttempts: {
      type: Number,
      default: 0,
    },
    faceLockUntil: {
      type: Date,
      default: null,
    },
    // Face check-in bookkeeping. Enrollment is mandatory for attendance, so the
    // timestamp also drives the "enroll your face" gate in the student portal.
    faceEnrolledAt: {
      type: Date,
      default: null,
    },
    // When the student agreed to biometric processing for attendance.
    faceConsentAt: {
      type: Date,
      default: null,
    },
    // Bumped on every enrollment/reset so old descriptors can be told apart.
    faceEnrollmentVersion: {
      type: Number,
      default: 0,
    },
    // Email verification. New student registrations set this explicitly
    // (`false` when mail is configured, `true` when it isn't). It deliberately
    // has NO schema default: Mongoose applies defaults when hydrating documents,
    // so a default would make every legacy account read back as `false` and lock
    // existing users out. With no default, docs created before this field existed
    // stay `undefined`, and application code treats anything other than an
    // explicit `false` as verified.
    emailVerified: {
      type: Boolean,
      default: undefined,
    },
    emailVerificationCodeHash: {
      type: String,
      default: "",
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    emailVerificationAttempts: {
      type: Number,
      default: 0,
    },
    emailVerificationLastSentAt: {
      type: Date,
      default: null,
    },
    // Password reset ("Forgot Password?"). Same one-code-at-a-time scheme as
    // email verification, kept on separate fields so a pending signup code is
    // never clobbered by a reset request (and vice versa).
    passwordResetCodeHash: {
      type: String,
      default: "",
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    passwordResetAttempts: {
      type: Number,
      default: 0,
    },
    passwordResetLastSentAt: {
      type: Date,
      default: null,
    },
    program: {
      type: String,
      trim: true,
      uppercase: true,
      enum: ["BSIT", "BSCS", "IT", "BSIS", "BSEMC", "OTHER"],
      required: function () {
        return this.role === "student";
      },
    },
    yearLevel: {
      type: Number,
      min: 1,
      max: 4,
      required: function () {
        return this.role === "student";
      },
    },
    section: {
      type: String,
      trim: true,
      uppercase: true,
      required: function () {
        return this.role === "student";
      },
      match: [/^[ABC]$/, "Section must be A, B, or C"],
    },
  },
  { timestamps: true }
);

// ✅ HASH PASSWORD (FIXED - NO next())
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ✅ COMPARE PASSWORD
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ GENERATE A RANDOM ONE-TIME EMAIL CODE
userSchema.statics.generateCode = function () {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
};

// ✅ CANONICAL EMAIL — emails are matched case-insensitively everywhere so
// "User@x.com" and "user@x.com" can never become two accounts. Callers must
// use this for every lookup/registration so stored (lowercased) docs are found.
userSchema.statics.normalizeEmail = function (email) {
  return String(email == null ? "" : email).trim().toLowerCase();
};

// ✅ HASH + STORE THE EMAIL VERIFICATION CODE
userSchema.methods.setEmailCode = async function (code) {
  const salt = await bcrypt.genSalt(10);
  this.emailVerificationCodeHash = await bcrypt.hash(String(code), salt);
};

// ✅ COMPARE AN ENTERED EMAIL VERIFICATION CODE
userSchema.methods.compareEmailCode = async function (enteredCode) {
  if (!this.emailVerificationCodeHash) return false;
  return await bcrypt.compare(String(enteredCode), this.emailVerificationCodeHash);
};

// ✅ HASH + STORE THE PASSWORD RESET CODE (separate from the signup code)
userSchema.methods.setPasswordCode = async function (code) {
  const salt = await bcrypt.genSalt(10);
  this.passwordResetCodeHash = await bcrypt.hash(String(code), salt);
};

// ✅ COMPARE AN ENTERED PASSWORD RESET CODE
userSchema.methods.comparePasswordCode = async function (enteredCode) {
  if (!this.passwordResetCodeHash) return false;
  return await bcrypt.compare(String(enteredCode), this.passwordResetCodeHash);
};

module.exports = mongoose.model("User", userSchema);