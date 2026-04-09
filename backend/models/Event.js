// models/Event.js
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  location: { type: String },
  status: { type: String, enum: ["upcoming", "live", "closed"], default: "upcoming" },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);