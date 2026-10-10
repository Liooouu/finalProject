// backend/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// NOTE: `deviceId` must not be `unique: true`. On a subdocument path Mongoose
// builds a COLLECTION-WIDE unique index, so every user with no trusted device
// indexed as `null` and only one such user could exist at all — creating a
// second account of any role failed with E11000. Uniqueness within a user is
// enforced in application code by the model's trustDevice()/isDeviceTrusted()
// helpers. Databases created before this fix get the stale index dropped at
// boot by services/repairUserIndexes.js.
const trustedDeviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true },
    label: { type: String, default: "Unknown device" },
    verifiedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
    pinHash: {
      type: String,
      default: "",
    },
    // Plaintext copy of the current PIN — needed so the student can view their
    // rotating PIN on the Security settings page. Hash (`pinHash`) is still used
    // for verification; this is only for display.
    pinPlain: {
      type: String,
      default: "",
    },
    trustedDevices: {
      type: [trustedDeviceSchema],
      default: [],
    },
    pinAttempts: {
      type: Number,
      default: 0,
    },
    pinLockUntil: {
      type: Date,
      default: null,
    },
    // Webcam-captured reference face photo used for "forgot PIN" recovery and,
    // later, check-in face verification.
    facePhoto: {
      type: String,
      default: "",
    },
    faceAttempts: {
      type: Number,
      default: 0,
    },
    faceLockUntil: {
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
      match: [/^[A-Z]{1,2}$/, "Section must be 1–2 letters (e.g., A, B)"],
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

// ✅ GENERATE A RANDOM 6-DIGIT SECURITY PIN (system-assigned, never user-chosen)
userSchema.statics.generatePin = function () {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
};

// ✅ HASH + STORE THE CURRENT SECURITY PIN
userSchema.methods.setPin = async function (pin) {
  const salt = await bcrypt.genSalt(10);
  this.pinHash = await bcrypt.hash(pin, salt);
  this.pinPlain = pin;
};

// ✅ COMPARE AN ENTERED PIN
userSchema.methods.comparePin = async function (enteredPin) {
  if (!this.pinHash) return false;
  return await bcrypt.compare(enteredPin, this.pinHash);
};

// ✅ IS THIS DEVICE ALREADY TRUSTED?
userSchema.methods.isDeviceTrusted = function (deviceId) {
  return this.trustedDevices.some((d) => d.deviceId === deviceId);
};

// ✅ TRUST A DEVICE (or refresh its last-used time)
userSchema.methods.trustDevice = function (deviceId, label = "") {
  const existing = this.trustedDevices.find((d) => d.deviceId === deviceId);
  if (existing) {
    existing.lastUsedAt = new Date();
  } else {
    this.trustedDevices.push({
      deviceId,
      label: label || "Unknown device",
      verifiedAt: new Date(),
      lastUsedAt: new Date(),
    });
  }
};

module.exports = mongoose.model("User", userSchema);