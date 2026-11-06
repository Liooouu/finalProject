// backend/models/FaceAppeal.js
// A student who cannot pass face verification (locked out, changed appearance,
// camera issues, etc.) submits a proof photo + note for an admin to review.
// Approving clears the face lock. Replacement appeals additionally grant a
// seven-day, enrollment-version-bound update to the reviewed identity only.
const mongoose = require("mongoose");

const faceAppealSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    replacement: { type: Boolean, default: false },
    enrollmentVersion: Number,
    replacementDescriptor: { type: [Number], select: false, default: undefined },
    consentAt: Date,
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    responseNote: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
  },
  { timestamps: true }
);

faceAppealSchema.index({ student: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("FaceAppeal", faceAppealSchema);
