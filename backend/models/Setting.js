// backend/models/Setting.js
// Singleton-style key/value settings document. Currently only one entry
// (`key: "email"`) holds the admin-editable SMTP configuration and email
// template texts. Fields left empty fall back to the environment variables in
// services/appSettings.js, so a deploy that never opens the Settings page
// behaves exactly like before.
const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    subject: { type: String, default: "" },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    smtp: {
      host: { type: String, default: "" },
      port: { type: Number, default: null },
      secure: { type: Boolean, default: null },
      user: { type: String, default: "" },
      // AES-256-GCM sealed with a JWT_SECRET-derived key (utils/secretBox.js).
      // Never returned by the API — GET reports hasSmtpPassword instead.
      passEncrypted: { type: String, default: "" },
      from: { type: String, default: "" },
      appUrl: { type: String, default: "" },
    },
    templates: {
      verification: { type: templateSchema, default: () => ({}) },
      passwordReset: { type: templateSchema, default: () => ({}) },
      notification: { type: templateSchema, default: () => ({}) },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
