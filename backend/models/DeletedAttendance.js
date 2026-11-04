const mongoose = require("mongoose");
// Retain an administrator deletion receipt without including it in reports/balances.
const schema = new mongoose.Schema({
 attendanceId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
 event: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
 student: { type: mongoose.Schema.Types.ObjectId, required: true },
 deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
 record: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });
module.exports = mongoose.model("DeletedAttendance", schema);
