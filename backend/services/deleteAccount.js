const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Excuse = require("../models/Excuse");
const Notification = require("../models/Notification");
const FaceAppeal = require("../models/FaceAppeal");
const Request = require("../models/ManualAttendanceRequest");
const fileStore = require("./fileStore");
const faceIdentify = require("./faceIdentify");

async function deleteAccount(id) {
  const user = await User.findById(id);
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  if (user.role === "admin") throw Object.assign(new Error("Cannot delete admin accounts"), { status: 403 });
  if (await Request.exists({ status: "pending", $or: [{ student: user._id }, { requestedBy: user._id }] })) {
    throw Object.assign(new Error("Resolve this account's pending manual attendance requests before deleting it."), { status: 409 });
  }
  const [excuses, appeals, idPhotos] = await Promise.all([
    Excuse.find({ student: user._id }).select("attachments attachmentUrl submissionHistory"),
    FaceAppeal.find({ student: user._id }).select("photoUrl"),
    Request.find({ $or: [{ student: user._id }, { requestedBy: user._id }] }).select("idPhotoUrl"),
  ]);
  const files = [...new Set([user.facePhoto, user.profilePicture,
    ...excuses.flatMap(letter => [...(letter.attachments || []), letter.attachmentUrl, ...(letter.submissionHistory || []).flatMap(revision => revision.attachments || [])]),
    ...appeals.map(appeal => appeal.photoUrl), ...idPhotos.map(row => row.idPhotoUrl)].filter(Boolean))];
  // Stop authentication and identification before cleaning related records.
  const deleted = await User.findOneAndDelete({ _id: user._id, updatedAt: user.updatedAt });
  if (!deleted) throw Object.assign(new Error("Account changed. Refresh before deleting."), { status: 409 });
  faceIdentify.remove(user._id);
  await Promise.all([Attendance.deleteMany({ student: user._id }), Excuse.deleteMany({ student: user._id }),
    Notification.deleteMany({ user: user._id }), FaceAppeal.deleteMany({ student: user._id })]);
  await fileStore.deleteByUrls(files);
  await Request.updateMany({ $or: [{ student: user._id }, { requestedBy: user._id }] }, { $set: { idPhotoUrl: "", photoDeletedAt: new Date() } });
  return { message: "User deleted successfully" };
}
module.exports = { deleteAccount };
