const User = require('../models/User');
const { config, schoolYearStart, promotionPlan } = require('./academicCalendar');
async function syncStudentAcademicYear(student, now = new Date()) {
  if (!config.confirmed || student?.role !== 'student' || student.enrollmentStatus === 'graduated') return student;
  const plan = promotionPlan(student, schoolYearStart(now));
  if (!plan) return student;
  // Compare the previous anchor so concurrent requests cannot promote twice.
  const filter = { _id: student._id, role: 'student', yearLevel: student.yearLevel, academicYearStart: student.academicYearStart ?? null };
  const update = { $set: { yearLevel: plan.yearLevel, academicYearStart: plan.academicYearStart, enrollmentStatus: plan.enrollmentStatus || student.enrollmentStatus || "active" } };
  if (plan.history.length) update.$push = { academicHistory: { $each: plan.history } };
  return await User.findOneAndUpdate(filter, update, { new: true, runValidators: true }) || await User.findById(student._id);
}
async function syncAllStudentAcademicYears() {
  if (!config.confirmed) return;
  const current = schoolYearStart();
  const cursor = User.find({ role: 'student', enrollmentStatus: { $ne: 'graduated' }, $or: [{ academicYearStart: null }, { academicYearStart: { $lt: current } }] }).cursor();
  for await (const student of cursor) await syncStudentAcademicYear(student);
}
module.exports = { syncStudentAcademicYear, syncAllStudentAcademicYears };
