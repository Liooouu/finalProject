const mongoose = require("mongoose");

// A saved roster makes retries use the reviewed batch rather than a new search.
const schema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sourceYear: { type: Number, required: true },
  targetYear: { type: Number, required: true },
  status: { type: String, enum: ["draft", "running", "partial", "completed"], default: "draft" },
  students: [{
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: String, email: String, program: String, section: String,
    yearLevel: Number, academicYearStart: { type: Number, default: null },
    enrollmentStatus: String,
  }],
  retainedIds: [String],
  graduateIds: [String],
  results: [{ _id: false, studentId: String, name: String, outcome: String, message: String }],
}, { timestamps: true });

module.exports = mongoose.model("AcademicAdvancement", schema);
