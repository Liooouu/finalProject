const mongoose = require("mongoose");

// A saved roster makes retries use the reviewed batch rather than a new search.
const schema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sourceYear: { type: Number, required: true },
  targetYear: { type: Number, required: true },
  classScope: { type: new mongoose.Schema({
    program: { type: String, enum: ["BSIT", "BSCS", "BSEMC"], required: true },
    yearLevel: { type: Number, min: 1, max: 4, required: true },
    section: { type: String, enum: ["A", "B", "C"], required: true },
  }, { _id: false }), default: null },
  status: { type: String, enum: ["draft", "running", "partial", "completed", "reverting", "undo_partial", "undone"], default: "draft" },
  students: [{
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: String, email: String, program: String, section: String,
    yearLevel: Number, academicYearStart: { type: Number, default: null },
    enrollmentStatus: String,
  }],
  retainedIds: [String],
  graduateIds: [String],
  results: [{ _id: false, studentId: String, name: String, outcome: String, message: String }],
  undoResults: [{ _id: false, studentId: String, name: String, outcome: String, message: String }],
  undoneBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  undoneAt: Date,
}, { timestamps: true });

schema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("AcademicAdvancement", schema);
