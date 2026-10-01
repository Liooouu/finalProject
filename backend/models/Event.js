// models/Event.js
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
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
  openNotified: { type: Boolean, default: false },
  closingSoonNotified: { type: Boolean, default: false },
  closedNotified: { type: Boolean, default: false },
  upcomingNotified: { type: Boolean, default: false },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

// The background job and every event list filter/sort on status + date.
eventSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model("Event", eventSchema);