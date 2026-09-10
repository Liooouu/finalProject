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
  status: { type: String, enum: ["upcoming", "live", "closed"], default: "upcoming" },
  attendanceStartTime: { type: String, required: true },
  attendanceEndTime: { type: String, required: true },
  attendanceProcessed: { type: Boolean, default: false },
  openNotified: { type: Boolean, default: false },
  closingSoonNotified: { type: Boolean, default: false },
  closedNotified: { type: Boolean, default: false },
  upcomingNotified: { type: Boolean, default: false },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);