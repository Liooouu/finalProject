const { randomUUID } = require("crypto");
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

// A user-side receipt makes retrying safe if the appeal write fails after the
// enrollment write. The version check protects newer camera enrollments.
function createService({ User, FaceAppeal, faceIdentify }) {
  return async function review({ id, admin, action, note = "", identityChecked }) {
    if (admin.role !== "admin") fail(403, "Only administrators can review face enrollment uploads.");
    if (!["approved", "rejected"].includes(action)) fail(400, "Choose Approve or Reject.");
    if (typeof note !== "string" || note.length > 1000) fail(400, "Review notes must be at most 1000 characters.");
    if (action === "approved" && identityChecked !== true) fail(400, "Confirm that you verified this student's identity.");
    if (action === "rejected" && note.trim().length < 5) fail(400, "Add a rejection reason of at least 5 characters.");
    const claim = randomUUID();
    const appeal = await FaceAppeal.findOneAndUpdate({ _id: id, enrollmentUpload: true, status: "pending",
      $or: [{ reviewClaim: null }, { reviewClaimedAt: { $lt: new Date(Date.now() - 60000) } }] },
    { $set: { reviewClaim: claim, reviewClaimedAt: new Date() } }, { new: true }).select("+enrollmentDescriptor");
    if (!appeal) fail(409, "This request changed or is being reviewed. Refresh before retrying.");
    try {
      if (String(appeal.student) === String(admin._id)) fail(403, "You cannot review your own enrollment.");
      const student = await User.findById(appeal.student).select("+faceEnrollmentAppeal");
      if (!student || student.role !== "student") fail(409, "The student account is no longer available.");
      const applied = String(student.faceEnrollmentAppeal) === String(appeal._id) &&
        student.faceEnrollmentVersion === appeal.enrollmentVersion + 1 && student.facePhoto === appeal.photoUrl;
      if (applied && action === "rejected") fail(409, "Enrollment was already applied. Retry approval to finish the review.");
      if (action === "approved") {
        if (!appeal.consentAt || !appeal.photoUrl || appeal.enrollmentDescriptor?.length !== 128 || !appeal.enrollmentDescriptor.every(Number.isFinite)) fail(409, "This request has no valid enrollment photo or consent. Ask the student to resubmit.");
        let updated = student;
        if (!applied) {
          const version = appeal.enrollmentVersion;
          updated = await User.findOneAndUpdate({ _id: student._id, role: "student",
            ...(version === 0 ? { $or: [{ faceEnrollmentVersion: 0 }, { faceEnrollmentVersion: { $exists: false } }] } : { faceEnrollmentVersion: version }) },
          { $set: { facePhoto: appeal.photoUrl, faceDescriptor: appeal.enrollmentDescriptor,
            faceEnrolledAt: new Date(), faceConsentAt: appeal.consentAt, faceAttempts: 0, faceLockUntil: null,
            faceEnrollmentAppeal: appeal._id }, $inc: { faceEnrollmentVersion: 1 } }, { new: true });
          if (!updated) fail(409, "The student's enrollment changed after this request. Reject this outdated request and ask for a new photo.");
        }
        faceIdentify.upsert(updated);
      }
      const saved = await FaceAppeal.findOneAndUpdate({ _id: appeal._id, status: "pending", reviewClaim: claim },
        { $set: { status: action, reviewedBy: admin._id, reviewedAt: new Date(), responseNote: note.trim() },
          $unset: { reviewClaim: 1, reviewClaimedAt: 1 } }, { new: true }).populate("student", "name email facePhoto faceLockUntil");
      if (!saved) fail(409, "The review changed. Refresh and retry.");
      return saved;
    } finally {
      await FaceAppeal.updateOne({ _id: appeal._id, reviewClaim: claim }, { $unset: { reviewClaim: 1, reviewClaimedAt: 1 } }).catch(() => {});
    }
  };
}
module.exports = { createService };
