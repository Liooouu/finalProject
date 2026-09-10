// models/Attendance.js
const mongoose = require("mongoose");

const communityServiceLogSchema = new mongoose.Schema({
  action: { type: String, enum: ["penalty", "removed"], required: true },
  hours: { type: Number, required: true },
  note: { type: String, default: "" },
  at: { type: Date, default: Date.now },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  attendedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["present", "late", "absent", "pending", "excused"], default: "pending" },
  communityServiceHours: { type: Number, default: 0 },
  communityServiceLog: [communityServiceLogSchema],
}, { timestamps: true });

attendanceSchema.index({ event: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
