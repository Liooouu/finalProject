// backend/models/PinResetRequest.js
// A student who cannot use face verification (no camera, no enrolled photo, or
// locked out) asks for a security PIN reset. Identity was proven with email +
// password when the request was filed, and is confirmed on-site by an admin or
// event organizer before a new PIN is minted — deliberately not by email, so a
// student cannot reset their own security out of a lockout by themselves.
const mongoose = require("mongoose");

const pinResetRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    responseNote: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Device the request was filed from. On approval it is trusted so the
    // student can sign in with their password alone and see the new PIN.
    deviceId: { type: String, default: "" },
    deviceLabel: { type: String, default: "" },
  },
  { timestamps: true }
);

pinResetRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("PinResetRequest", pinResetRequestSchema);
