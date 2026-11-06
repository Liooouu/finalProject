// Legacy students without an explicit enrollment status remain active.
const activeStudentFilter = () => ({ role: "student", enrollmentStatus: { $ne: "graduated" }, emailVerified: { $ne: false } });
const isActiveStudent = user => user?.role === "student" && user.enrollmentStatus !== "graduated" && user.emailVerified !== false;
module.exports = { activeStudentFilter, isActiveStudent };
