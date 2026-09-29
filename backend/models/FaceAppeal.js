// backend/models/FaceAppeal.js
// A student who cannot pass face verification (locked out, changed appearance,
// camera issues, etc.) submits a proof photo + note for an admin to review.
// Approving clears the face lock so they can retry verification.
const mongoose = require("mongoose");

const faceAppealSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    responseNote: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

faceAppealSchema.index({ student: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("FaceAppeal", faceAppealSchema);