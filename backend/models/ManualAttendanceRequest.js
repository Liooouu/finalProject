const mongoose = require("mongoose");

// Evidence and audit ledger for attendance requests that require an administrator decision.
const schema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, immutable: true },
  session: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
  sessionName: { type: String, default: "", immutable: true },
  action: { type: String, enum: ["time_in", "time_out"], default: "time_in", immutable: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  mode: { type: String, enum: ["checkin", "correction"], required: true, immutable: true },
  source: { type: String, enum: ["manual", "id_photo"], default: "manual", immutable: true },
  clientId: { type: String, immutable: true },
  photoDigest: { type: String, immutable: true },
  photoScheduleSignature: { type: String, immutable: true },
  idPhotoUrl: { type: String, default: "" },
  photoExpiresAt: Date,
  photoDeletedAt: Date,
  captureBasis: { type: String, enum: ["server", "device"] },
  receivedAt: Date,
  attestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reason: { type: String, required: true, maxlength: 1000, immutable: true },
  identityChecked: { type: Boolean, required: true, immutable: true },
  effectiveAt: { type: Date, required: true, immutable: true },
  submittedAt: { type: Date, required: true, immutable: true },
  proposedStatus: { type: String, enum: ["present", "late", "absent", "time_out"], required: true, immutable: true },
  proposedHours: { type: Number, required: true, immutable: true },
  schedule: { start: Date, deadline: Date, cutoff: Date },
  // Fingerprint of the record observed by the requester. Approval must not
  // overwrite a later human decision, face check-in, or approved excuse.
  previousAttendance: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: "", maxlength: 1000 },
  resolution: { type: String, enum: ["manual", "existing_face", "id_photo"] },
  confirmedAttendance: {
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance" },
    status: String, method: String, attendedAt: Date, hours: Number,
    session: mongoose.Schema.Types.ObjectId, sessionName: String, timeInAt: Date, timeOutAt: Date, timeOutMethod: String, completionStatus: String,
  },
  reviewLock: { token: String, until: Date },
}, { timestamps: true });

schema.index({ event: 1, student: 1, session: 1, action: 1 }, { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_session_action" });
schema.index({ status: 1, submittedAt: -1 });
schema.index({ requestedBy: 1, status: 1 });
schema.index({ student: 1, status: 1 });
schema.index({ requestedBy: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: "string" } }, name: "unique_id_photo_upload" });
module.exports = mongoose.model("ManualAttendanceRequest", schema);
