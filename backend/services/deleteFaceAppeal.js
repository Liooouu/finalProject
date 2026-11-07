// Keep minimal deletion/review audit, but remove the request from all queues.
// Evidence already used as the active enrollment must remain available.
function createService({ FaceAppeal, User, fileStore }) {
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  return async function deleteAppeal({ id, admin }) {
    if (admin.role !== "admin") fail(403, "Only administrators can delete face appeals.");
    const before = await FaceAppeal.findOne({ _id: id, deletedAt: null }).select("status photoUrl enrollmentUpload");
    if (!before) fail(404, "This appeal was already deleted or is unavailable.");
    if (before.status === "pending" && await User.exists({ faceEnrollmentAppeal: id })) {
      fail(409, "Enrollment approval is unfinished. Complete its review before deleting this request.");
    }
    const removed = await FaceAppeal.findOneAndUpdate({ _id: id, deletedAt: null, status: before.status,
      $or: [{ reviewClaim: null }, { reviewClaimedAt: { $lt: new Date(Date.now() - 60000) } }] },
    { $set: { status: "deleted", statusBeforeDeletion: before.status, deletedAt: new Date(), deletedBy: admin._id, photoUrl: "" },
      $unset: { enrollmentDescriptor: 1, replacementDescriptor: 1, reviewClaim: 1, reviewClaimedAt: 1 } }, { new: true });
    if (!removed) fail(409, "This appeal changed or is being reviewed. Refresh before deleting.");
    if (before.photoUrl) {
      try {
        const activePhoto = await User.exists({ $or: [{ facePhoto: before.photoUrl }, { profilePicture: before.photoUrl }] });
        const otherEvidence = await FaceAppeal.exists({ photoUrl: before.photoUrl, deletedAt: null });
        if (!activePhoto && !otherEvidence) await fileStore.deleteByUrl(before.photoUrl);
      } catch (error) {
        // Queue deletion succeeded; a storage cleanup failure must not imply that
        // the request or enrollment was lost. Keep the reference for maintenance.
        await FaceAppeal.updateOne({ _id: id, status: "deleted" }, { $set: { photoUrl: before.photoUrl } }).catch(() => {});
        console.error("Deleted face appeal evidence cleanup:", error.message);
      }
    }
    return { message: "Face appeal deleted. Active face enrollment and attendance were kept." };
  };
}
module.exports = { createService };
