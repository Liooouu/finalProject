// models/Event.js
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  academicYearStart: { type: Number, min: 2026, max: 2100, default: null },
  semester: { type: String, enum: ["first", "second", null], default: null },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  endDate: { type: Date },
  endTime: { type: String },
  location: { type: String },
  mapQuery: { type: String, trim: true },
  // upcoming/live are the active states, finished is set automatically once the
  // event's end time passes, and closed is reserved for a manual close.
  status: { type: String, enum: ["upcoming", "live", "finished", "closed"], default: "upcoming" },
  // Set by the background job when it finishes an event on the organizer/admin's
  // behalf, so the UI can explain why an event is no longer active.
  autoFinishedAt: { type: Date },
  // Set when a human changes the status by hand. The background job leaves
  // manual events alone until the schedule is edited (see routes/eventRoutes).
  manualOverride: { type: Boolean, default: false },
  attendanceStartTime: { type: String, required: true },
  attendanceEndTime: { type: String, required: true },
  // Session-based Time In / Time Out. Empty array = legacy time-in-only event
  // (no Time Out, no incomplete penalty). Each session is a full timestamp
  // window so overnight sessions work.
  sessionScheduleLockedAt: { type: Date, default: null },
  attendanceSessions: [{
    name: { type: String, required: true, trim: true },
    // Absent on older schedules; never reinterpret their saved deadlines.
    timeInPolicy: { type: String, enum: ['window_then_late'] },
    activityStart: { type: Date },
    activityEnd: { type: Date },
    timeInOpen: { type: Date, required: true },
    onTimeDeadline: { type: Date, required: true },
    timeInCutoff: { type: Date, required: true },
    timeOutOpen: { type: Date, required: true },
    timeOutClose: { type: Date, required: true },
    eligibleStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    rosterLockedAt: { type: Date, default: null },
  }],
  openNotified: { type: Boolean, default: false },
  closingSoonNotified: { type: Boolean, default: false },
  closedNotified: { type: Boolean, default: false },
  upcomingNotified: { type: Boolean, default: false },
  // One-shot heads-up sent an hour before the attendance window opens.
  attendanceUpcomingNotified: { type: Boolean, default: false },
  // Version of the attendance-notice logic that produced the flags above. An
  // event stored with an older version has its notice flags cleared once, so a
  // corrected job can notify it again (see the self-heal in server.js).
  noticesVersion: { type: Number, default: 0 },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  lastEditedByName: { type: String, default: "" },
  lastEditedAt: { type: Date, default: null },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // Admin-assigned, event-scoped review access; this is not an admin role grant.
  manualAttendanceReviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

// The background job and every event list filter/sort on status + date.
eventSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model("Event", eventSchema);
