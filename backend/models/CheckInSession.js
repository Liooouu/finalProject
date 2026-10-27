// models/CheckInSession.js
// A short-lived "station" token the organizer mints for one event. The kiosk
// page carries the raw token; only its SHA-256 hash is stored, so a database
// dump cannot be replayed against the public check-in endpoint.
const mongoose = require("mongoose");

const checkInSessionSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stationLabel: { type: String, default: "", trim: true },
    expiresAt: { type: Date, required: true },
    closedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    matchCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

checkInSessionSchema.index({ event: 1, closedAt: 1 });

module.exports = mongoose.model("CheckInSession", checkInSessionSchema);
