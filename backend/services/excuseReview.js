const { excuseWindow } = require('./excuseWindow');

// Review uses the submission time, so an on-time request can be reviewed later.
function excuseReviewIssue(excuse, attendance) {
  if (!excuse.event) return 'The event record is unavailable.';
  if (excuse.type !== 'absence') return 'Advance excuse letters are no longer accepted. This request can be rejected only.';
  if (!(excuse.attachments?.length || excuse.attachmentUrl)) return 'A supporting attachment is required before an excuse can be approved.';
  const submitted = new Date(excuse.createdAt);
  if (!Number.isFinite(submitted.getTime())) return 'The submission date is unavailable.';
  const window = excuseWindow(excuse.event, submitted);
  if (!window.allowed) return window.reason;
  if (attendance !== undefined && attendance?.status !== 'absent') return 'Only a recorded absence can be excused.';
  return '';
}
// Older letters have no revision field in MongoDB even though Mongoose gives
// their hydrated documents the default version 1.
function submissionRevisionFilter(excuse) {
  const version = excuse.submissionVersion || 1;
  return version === 1 ? { $or: [{ submissionVersion: 1 }, { submissionVersion: { $exists: false } }] } : { submissionVersion: version };
}
function resubmissionIssue(excuse, attendance, approvedElsewhere = false) {
  if (excuse.status === "approved" || approvedElsewhere) return "This event's excuse was already approved and cannot be changed.";
  if (!excuse.event) return "The event record is unavailable.";
  if (excuse.type !== "absence") return "Only missed-event excuse letters can be resubmitted.";
  const submitted = new Date(excuse.createdAt);
  if (!Number.isFinite(submitted.getTime())) return "The original submission date is unavailable.";
  const window = excuseWindow(excuse.event, submitted);
  if (!window.allowed) return "Only letters originally submitted within the seven-day deadline can be resubmitted.";
  if (attendance?.status !== "absent") return "The event attendance is no longer marked absent.";
  return "";
}
module.exports = { excuseReviewIssue, submissionRevisionFilter, resubmissionIssue };

// Reviews follow the officer grant, independently of who created the event.
function excuseReviewFilter(user) {
  return user.role === 'admin' ? {} : { student: { $ne: user._id } };
}
function canReviewExcuse(excuse, user) {
  if (!excuse || !user) return false;
  if (user.role === 'admin') return true;
  return user.role === 'organizer' && !!excuse.student && String(excuse.student._id || excuse.student) !== String(user._id);
}
function excuseReviewerFilter(studentId) {
  return { $or: [{ role: 'admin' }, { role: 'organizer' }, { role: 'student', organizerAccess: true }], _id: { $ne: studentId } };
}
module.exports.excuseReviewFilter = excuseReviewFilter;
module.exports.canReviewExcuse = canReviewExcuse;
module.exports.excuseReviewerFilter = excuseReviewerFilter;
