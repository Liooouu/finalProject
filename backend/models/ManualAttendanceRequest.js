const mongoose = require("mongoose");

// Separate from Attendance: an unreviewed assertion is not proof of attendance.
const schema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, immutable: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  mode: { type: String, enum: ["checkin", "correction"], required: true, immutable: true },
  reason: { type: String, required: true, maxlength: 1000, immutable: true },
  identityChecked: { type: Boolean, required: true, immutable: true },
  effectiveAt: { type: Date, required: true, immutable: true },
  submittedAt: { type: Date, required: true, immutable: true },
  proposedStatus: { type: String, enum: ["present", "late", "absent"], required: true, immutable: true },
  proposedHours: { type: Number, required: true, immutable: true },
  schedule: { start: Date, deadline: Date, cutoff: Date },
  // Fingerprint of the record observed by the requester. Approval must not
  // overwrite a later human decision, face check-in, or approved excuse.
  previousAttendance: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: "", maxlength: 1000 },
  reviewLock: { token: String, until: Date },
}, { timestamps: true });

schema.index({ event: 1, student: 1 }, { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_manual_request" });
schema.index({ status: 1, submittedAt: -1 });
schema.index({ requestedBy: 1, status: 1 });
schema.index({ student: 1, status: 1 });
module.exports = mongoose.model("ManualAttendanceRequest", schema);
