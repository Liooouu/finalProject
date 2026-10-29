// models/Excuse.js
const mongoose = require("mongoose");

const excuseSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  excuseText: { type: String, required: true },
  attachmentUrl: { type: String },
  attachments: [{ type: String }],
  type: { type: String, enum: ["absence", "advance"], default: "absence" },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  lastSubmittedAt: { type: Date },
  submissionVersion: { type: Number, default: 1 },
  submissionHistory: [{
    submittedAt: Date,
    submissionVersion: Number,
    excuseText: String,
    attachments: [String],
    status: String,
    responseNote: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  }],
  responseNote: { type: String },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Flat hours actually deducted when this excuse was approved. Recorded so a
  // later attendance replacement can restore exactly what was taken.
  removedHours: { type: Number, default: 0 },
}, { timestamps: true });

excuseSchema.index({ student: 1, event: 1, status: 1 });
excuseSchema.index({ event: 1, status: 1 });

module.exports = mongoose.model("Excuse", excuseSchema);
