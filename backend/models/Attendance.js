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
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  attendedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["present", "late", "absent", "pending", "excused"], default: "pending" },
  // How the record was produced. `qr` is kept for rows written before the face
  // kiosk replaced the QR scanner; `auto` is the background absence pass.
  method: { type: String, enum: ["face", "manual", "qr", "auto"], default: "manual" },
  // Identification confidence (Euclidean distance) when method is "face".
  matchDistance: { type: Number, default: null },
  checkInSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CheckInSession",
    default: null,
  },
  verifiedAt: { type: Date, default: null },
  communityServiceHours: { type: Number, default: 0, min: 0 },
  communityServiceLog: [communityServiceLogSchema],
  eventTitle: { type: String },
  eventDate: { type: Date },
}, { timestamps: true });

attendanceSchema.index({ event: 1, student: 1 }, { unique: true });
attendanceSchema.index({ student: 1, status: 1 });
attendanceSchema.index({ event: 1, status: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
