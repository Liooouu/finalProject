// models/Attendance.js
const mongoose = require("mongoose");

const communityServiceLogSchema = new mongoose.Schema({
  action: { type: String, enum: ["penalty", "removed", "restored"], required: true },
  hours: { type: Number, required: true },
  note: { type: String, default: "" },
  at: { type: Date, default: Date.now },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  // Null for legacy time-in-only records (one per event/student). Set for new
  // session-based records (one per event/session/student).
  session: { type: mongoose.Schema.Types.ObjectId, default: null },
  // Saved with the event title/date when an event is deleted; balances remain intact.
  academicYearStart: { type: Number, default: null },
  semester: { type: String, enum: ["first", "second", null], default: null },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  attendedAt: { type: Date, default: Date.now },
  // Time In / Time Out timestamps (full instants, overnight-safe).
  timeInAt: { type: Date, default: null },
  timeOutAt: { type: Date, default: null },
  // Arrival status (on_time | late) kept separate from completion.
  arrivalStatus: { type: String, enum: ["on_time", "late", null], default: null },
  // Completion status (completed | incomplete | absent | pending | excused).
  completionStatus: { type: String, enum: ["completed", "incomplete", "absent", "pending", "excused", null], default: null },
  // Automatic session contribution, distinct from the remaining balance after staff adjustments.
  sessionPenaltyHours: { type: Number, default: null, min: 0 },
  excusedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Excuse", default: null },
  excuseRemovedHours: { type: Number, default: 0 },
  timeOutMethod: { type: String, enum: ["face", "manual", "id_photo", null], default: null },
  timeOutStation: { type: mongoose.Schema.Types.ObjectId, ref: "CheckInSession", default: null },
  timeOutDistance: { type: Number, default: null },
  sessionName: { type: String, default: "" },
  status: { type: String, enum: ["present", "late", "absent", "pending", "excused"], default: "pending" },
  // How the record was produced. `qr` is kept for rows written before the face
  // kiosk replaced the QR scanner; `auto` is the background absence pass.
  method: { type: String, enum: ["face", "manual", "id_photo", "qr", "auto"], default: "manual" },
  // Identification confidence (Euclidean distance) when method is "face".
  matchDistance: { type: Number, default: null },
  checkInSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CheckInSession",
    default: null,
  },
  verifiedAt: { type: Date, default: null },
  manualAttendanceRequest: { type: mongoose.Schema.Types.ObjectId, ref: "ManualAttendanceRequest", default: null },
  manualAttendanceAudit: [{
    request: { type: mongoose.Schema.Types.ObjectId, ref: "ManualAttendanceRequest" },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedAt: Date,
    effectiveAt: Date,
    action: String,
    reviewedAt: Date,
    reason: String,
    reviewNote: String,
    previousStatus: String,
    nextStatus: String,
    previousHours: Number,
    nextHours: Number,
  }],
  communityServiceHours: { type: Number, default: 0, min: 0 },
  reportDeletedAt: Date,
  reportDeletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  communityServiceLog: [communityServiceLogSchema],
  eventTitle: { type: String },
  eventDate: { type: Date },
}, { timestamps: true });

// New session-based records: one per event/session/student.
attendanceSchema.index(
  { event: 1, session: 1, student: 1 },
  { unique: true, partialFilterExpression: { session: { $type: "objectId" } }, name: "event_1_session_1_student_1" }
);
// Legacy time-in-only records: one per event/student (session null).
attendanceSchema.index(
  { event: 1, student: 1 },
  { unique: true, partialFilterExpression: { session: null }, name: "unique_legacy_attendance" }
);
attendanceSchema.index({ student: 1, status: 1 });
attendanceSchema.index({ event: 1, status: 1 });
attendanceSchema.index({ event: 1, session: 1, status: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
