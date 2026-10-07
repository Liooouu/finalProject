import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { FaKey, FaCheck, FaTimes, FaShieldAlt } from "react-icons/fa";
import StatusBadge from "../shared/StatusBadge";
import { usePageMeta } from "../../context/PageMetaContext";
import { TableSkeleton } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Button from "../ui/Button";

const API_BASE = api.defaults.baseURL.replace(/\/api$/, "");

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userAttendance, setUserAttendance] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [csDrafts, setCsDrafts] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetClearDevices, setResetClearDevices] = useState(false);
  const [resetPin, setResetPin] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [activeTab, setActiveTab] = useState("users");
  const [appeals, setAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [unlockTarget, setUnlockTarget] = useState(null);

  usePageMeta("Manage Users", "Search, inspect, and manage all accounts.");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/users");
      setUsers(res.data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppeals = async () => {
    setAppealsLoading(true);
    try {
      const res = await api.get("/admin/security/face-appeals");
      setAppeals(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setAppealsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAppeals();
  }, []);

  const isFaceLocked = (u) =>
    !!u && !!u.faceLockUntil && new Date(u.faceLockUntil) > new Date();

  const getGroupLabel = (u) => {
    if (!u || u.role !== "student") return "-";
    const p = String(u.program || "").trim().toUpperCase();
    const y = u.yearLevel != null ? String(u.yearLevel) : "";
    const sec = String(u.section || "").trim().toUpperCase();
    if (p && y && sec) return `${p}-${y}${sec}`;
    return "Unassigned";
  };

  const PROGRAMS = ["BSIT", "BSCS", "IT", "BSIS", "BSEMC", "OTHER"];

  const unlockFace = async (target) => {
    try {
      const res = await api.post(`/admin/users/${target._id}/unlock-face`);
      setUsers(
        users.map((u) =>
          u._id === target._id ? { ...u, faceLockUntil: null, faceAttempts: 0 } : u
        )
      );
      setUnlockTarget(null);
      setMessage(res.data.message || "Face verification unlocked");
      setMessageType("success");
    } catch (err) {
      console.error(err);
      setUnlockTarget(null);
      setMessage(err.response?.data?.message || "Failed to unlock face verification");
      setMessageType("error");
    }
  };

  const handleReview = async (appeal, action) => {
    try {
      const res = await api.post(`/admin/security/face-appeals/${appeal._id}/review`, {
        action,
        note: action === "rejected" ? reviewNote : "",
      });
      setAppeals(appeals.map((a) => (a._id === appeal._id ? res.data.appeal : a)));
      setReviewTarget(null);
      setReviewNote("");
      setMessage(res.data.message || `Appeal ${action}`);
      setMessageType("success");
      if (action === "approved" && appeal.student?._id) {
        setUsers(
          users.map((u) =>
            u._id === appeal.student._id
              ? { ...u, faceLockUntil: null, faceAttempts: 0 }
              : u
          )
        );
      }
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || "Failed to review appeal");
      setMessageType("error");
    }
  };

  const deleteUser = async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(users.filter((u) => u._id !== userId));
      setMessage("User deleted successfully");
      setMessageType("success");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || "Failed to delete user");
      setMessageType("error");
    }
  };

  const resetSecurity = async (userId, clearDevices) => {
    try {
      const res = await api.post(`/admin/users/${userId}/reset-security`, {
        clearDevices,
      });
      setResetPin(res.data.pin);
    } catch (err) {
      console.error(err);
      setResetTarget(null);
      setMessage(err.response?.data?.message || "Failed to reset security");
      setMessageType("error");
    }
  };

  const loadAttendance = async (user) => {
    const res = await api.get("/reports/attendance");
    const userRecords = res.data.records.filter(
      (r) => r.student?._id === user._id || r.student === user._id
    );
    setUserAttendance(userRecords);
    setCsDrafts({});
  };

  const openUserDetails = async (user) => {
    setSelectedUser(user);
    setShowModal(true);
    setCsDrafts({});
    try {
      await loadAttendance(user);
    } catch (err) {
      console.error(err);
      setUserAttendance([]);
    }
  };

  const handleUpdateCS = async (record, hours) => {
    const value = Number(hours);
    if (!Number.isFinite(value) || value < 0) {
      setMessage("Please enter a valid number of hours (0 or more)");
      setMessageType("error");
      return;
    }
    try {
      const res = await api.patch(`/admin/attendance/${record._id}/community-service`, {
        hours: value,
      });
      setUserAttendance(userAttendance.map((r) => (r._id === res.data._id ? res.data : r)));
      setMessage(`Community service hours set to ${value} hrs`);
      setMessageType("success");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update community service");
      setMessageType("error");
    }
  };

  const handleRemoveCS = async (record) => {
    const studentId = record.student?._id || record.student;
    try {
      await api.patch(`/admin/attendance/${record._id}/community-service/remove`, {});
      if (selectedUser && selectedUser._id === studentId) {
        await loadAttendance(selectedUser);
      }
      setMessage("Community service hours removed");
      setMessageType("success");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to remove community service");
      setMessageType("error");
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role) => {
  const styles = {
    admin: "dark:bg-cyan-900/50 bg-cyan-100 dark:text-cyan-400 text-cyan-700 dark:border-cyan-700 border-cyan-300",
    organizer: "dark:bg-yellow-900/50 bg-yellow-100 dark:text-yellow-400 text-yellow-700 dark:border-yellow-700 border-yellow-300",
    student: "dark:bg-purple-900/50 bg-purple-100 dark:text-purple-400 text-purple-700 dark:border-purple-700 border-purple-300",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[role] || styles.student}`}>
      {role}
    </span>
  );
};

  const stats = {
    total: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    organizer: users.filter((u) => u.role === "organizer").length,
    student: users.filter((u) => u.role === "student").length,
  };

  const pendingCount = appeals.filter((a) => a.status === "pending").length;

  const inputClasses =
    "px-3.5 py-2 bg-card rounded-lg border border-line text-sm text-on placeholder-on-muted focus:outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500/40 transition-colors";

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${messageType === "error" ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
          {message}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/30 dark:text-indigo-400"
              : "text-on-dim hover:text-on"
          }`}
        >
          Users
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("appeals")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "appeals"
              ? "bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/30 dark:text-indigo-400"
              : "text-on-dim hover:text-on"
          }`}
        >
          Face appeals
          {pendingCount > 0 && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "users" ? (
        <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-on-dim">
          {filteredUsers.length} of {users.length} accounts
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={inputClasses}
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`${inputClasses} bg-card`}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="organizer">Organizer</option>
            <option value="student">Student</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-sm text-on-dim">Total Users</p>
          <p className="text-2xl font-bold text-on">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-sm text-cyan-600 dark:text-cyan-400">Admins</p>
          <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stats.admin}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">Organizers</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.organizer}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-sm text-violet-600 dark:text-violet-400">Students</p>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{stats.student}</p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-line bg-card py-12 text-center text-sm text-on-dim">
          No users found
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-card-alt">
                  <th className="text-left p-4 font-medium text-on-dim">Name</th>
                  <th className="text-left p-4 font-medium text-on-dim">Email</th>
                  <th className="text-left p-4 font-medium text-on-dim">Role</th>
                  <th className="text-left p-4 font-medium text-on-dim">Program/Year/Section</th>
                  <th className="text-left p-4 font-medium text-on-dim">Created</th>
                  <th className="text-left p-4 font-medium text-on-dim">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b border-line hover:bg-card-alt transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-indigo-800 flex items-center justify-center text-white font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium">{user.name}</span>
                          {user.role === "student" && isFaceLocked(user) && (
                            <span className="ml-2 inline-block rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                              Face locked
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-on-dim">{user.email}</td>
                    <td className="p-4">{getRoleBadge(user.role)}</td>
                    <td className="p-4 text-on-dim text-sm">
                      {user.role === "student" ? (
                        <div>
                          <p>{getGroupLabel(user)}</p>
                          {(user.program || user.yearLevel || user.section) ? (
                            <p className="text-xs text-on-muted">
                              {user.program || "?"}-{user.yearLevel ?? "?"}-{user.section || "?"}
                            </p>
                          ) : (
                            <p className="text-xs text-on-muted">Unassigned</p>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-4 text-on-dim text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openUserDetails(user)}
                          className="px-3 py-1 dark:bg-gray-800 dark:hover:bg-gray-700 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
                        >
                          View
                        </button>
                        {user.role === "student" && (
                          <button
                            onClick={() => {
                              setResetClearDevices(false);
                              setResetPin(null);
                              setResetTarget(user);
                            }}
                            className="px-3 py-1 dark:bg-indigo-900/30 bg-indigo-50 dark:hover:bg-indigo-900/50 hover:bg-indigo-100 dark:text-indigo-400 text-indigo-600 dark:border-indigo-900 border-indigo-300 border rounded text-sm transition-colors"
                          >
                            Reset PIN
                          </button>
                        )}
                        {user.role === "student" && isFaceLocked(user) && (
                          <button
                            onClick={() => setUnlockTarget(user)}
                            className="px-3 py-1 dark:bg-red-900/30 bg-red-50 dark:hover:bg-red-900/50 hover:bg-red-100 dark:text-red-400 text-red-600 dark:border-red-900 border-red-300 border rounded text-sm transition-colors"
                            title="Clear face-verification lockout"
                          >
                            Unlock
                          </button>
                        )}
                        {user.role !== "admin" && (
                          <button
                            onClick={() => setDeleteTarget(user._id)}
                            className="px-3 py-1 dark:bg-red-900/30 bg-red-50 dark:hover:bg-red-900/50 hover:bg-red-100 dark:text-red-400 text-red-600 dark:border-red-900 border-red-300 border rounded text-sm transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-on-dim">
            {pendingCount} pending &middot; {appeals.length} total appeals
          </p>
          {appealsLoading ? (
            <TableSkeleton rows={4} />
          ) : appeals.length === 0 ? (
            <div className="rounded-xl border border-line bg-card py-12 text-center text-sm text-on-dim">
              No face verification appeals
            </div>
          ) : (
            <div className="space-y-4">
              {appeals.map((appeal) => (
                <div key={appeal._id} className="rounded-xl border border-line bg-card p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{appeal.student?.name || "Unknown student"}</p>
                      <p className="text-sm text-on-dim">{appeal.student?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isFaceLocked(appeal.student) && (
                        <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                          Face locked
                        </span>
                      )}
                      <StatusBadge status={appeal.status} />
                    </div>
                  </div>

                  {appeal.note && (
                    <p className="mb-4 text-sm text-on-dim">&quot;{appeal.note}&quot;</p>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium text-on-muted">Proof photo (submitted)</p>
                      <img
                        src={`${API_BASE}${appeal.photoUrl}`}
                        alt="Proof"
                        className="aspect-[4/3] w-full rounded-lg border border-line object-cover"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-on-muted">Enrolled face photo</p>
                      {appeal.student?.facePhoto ? (
                        <img
                          src={`${API_BASE}${appeal.student.facePhoto}`}
                          alt="Enrolled face"
                          className="aspect-[4/3] w-full rounded-lg border border-line object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-line bg-card-alt text-sm text-on-muted">
                          No face enrolled
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-on-muted">
                    Submitted {new Date(appeal.createdAt).toLocaleString()}
                  </p>

                  {appeal.status === "pending" && (
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReviewNote("");
                          setReviewTarget({ appeal, action: "approved" });
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                      >
                        <FaCheck className="text-xs" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewNote("");
                          setReviewTarget({ appeal, action: "rejected" });
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                      >
                        <FaTimes className="text-xs" /> Reject
                      </button>
                    </div>
                  )}

                  {appeal.status !== "pending" && appeal.responseNote && (
                    <p className="mt-3 text-sm text-on-dim">
                      <span className="font-medium text-on">Admin note:</span> {appeal.responseNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-line">
            <div className="border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-500 to-indigo-800 flex items-center justify-center text-white text-xl font-bold">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                  <p className="text-sm text-on-dim">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-card-alt rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="text-sm text-on-dim">Role:</span>
                {getRoleBadge(selectedUser.role)}
                <span className="text-sm text-on-dim">
                  Joined: {new Date(selectedUser.createdAt).toLocaleDateString()}
                </span>
                {selectedUser.role === "student" && (
                  <span className="text-sm text-on-dim">
                    Group: <span className="text-on font-medium">{getGroupLabel(selectedUser)}</span>
                  </span>
                )}
              </div>

              {selectedUser.role === "student" && (
                <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-card-alt/50 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <FaShieldAlt className="text-lg text-indigo-500" />
                    <div>
                      <p className="font-medium text-on">Face verification</p>
                      {selectedUser.facePhoto ? (
                        <p className="text-sm text-on-dim">Face photo enrolled</p>
                      ) : (
                        <p className="text-sm text-on-dim">No face photo enrolled</p>
                      )}
                      {isFaceLocked(selectedUser) ? (
                        <p className="mt-0.5 text-sm font-medium text-red-600 dark:text-red-400">
                          Locked until {new Date(selectedUser.faceLockUntil).toLocaleString()}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm text-on-muted">Not locked</p>
                      )}
                    </div>
                  </div>
                  {selectedUser.facePhoto && (
                    <img
                      src={`${API_BASE}${selectedUser.facePhoto}`}
                      alt="Enrolled face"
                      className="h-20 w-20 rounded-xl border border-line object-cover sm:ml-auto"
                    />
                  )}
                  {isFaceLocked(selectedUser) && (
                    <Button
                      variant="secondary"
                      className="border border-line"
                      onClick={() => setUnlockTarget(selectedUser)}
                    >
                      Unlock face verification
                    </Button>
                  )}
                </div>
              )}

              <h4 className="text-lg font-semibold mb-4">
                Attendance History ({userAttendance.length})
              </h4>
              {userAttendance.length === 0 ? (
                <p className="text-on-dim text-center py-8">No attendance records</p>
              ) : (
                <div className="space-y-2">
                  {userAttendance.map((record) => (
                    <div
                      key={record._id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card-alt rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{record.event?.title || record.eventTitle || "Event"}</p>
                        <p className="text-sm text-on-dim">
                          {(record.event?.date || record.eventDate) && new Date(record.event?.date || record.eventDate).toLocaleDateString()}
                          {record.communityServiceHours > 0 && (
                            <span className="dark:text-yellow-400 text-yellow-600 font-medium">
                              {" "}• {record.communityServiceHours} hrs CS
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={record.status} />
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={csDrafts[record._id] ?? String(record.communityServiceHours)}
                            onChange={(e) =>
                              setCsDrafts({ ...csDrafts, [record._id]: e.target.value })
                            }
                            className="w-16 bg-card border border-line rounded-lg px-2 py-1.5 text-sm text-on focus:outline-none focus:ring-2 focus:ring-green-500/50"
                            title="Set this student's community service hours"
                          />
                          <button
                            onClick={() =>
                              handleUpdateCS(
                                record,
                                csDrafts[record._id] ?? record.communityServiceHours
                              )
                            }
                            className="bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            Set hrs
                          </button>
                          <button
                              onClick={() => handleRemoveCS(record)}
                              className="bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Remove CS
                            </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!resetTarget}
        title={resetPin ? "New security PIN assigned" : "Reset this student's security PIN?"}
        message={
          resetPin
            ? "Give this PIN to the student in person. It replaces their previous PIN, and any failed-attempt lockout is cleared."
            : resetTarget
              ? `A brand-new PIN will be generated for "${resetTarget.name}". Only an admin can recover it — relay it to the student directly.`
              : ""
        }
        confirmLabel={resetPin ? "Done" : "Reset PIN"}
        cancelLabel={resetPin ? "Close" : "Cancel"}
        variant={resetPin ? "default" : "danger"}
        icon={resetPin ? <FaKey /> : undefined}
        onConfirm={() => {
          if (resetPin) {
            setResetTarget(null);
            setResetPin(null);
            setMessage("Student security PIN reset");
            setMessageType("success");
          } else {
            const target = resetTarget;
            resetSecurity(target._id, resetClearDevices);
          }
        }}
        onCancel={() => {
          setResetTarget(null);
          setResetPin(null);
        }}
      >
        {resetPin ? (
          <p className="mt-3 rounded-xl border border-dashed border-indigo-400/50 bg-indigo-500/5 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-on">
            {resetPin}
          </p>
        ) : (
          <label className="mt-3 flex items-center gap-2 text-sm text-on-dim">
            <input
              type="checkbox"
              checked={resetClearDevices}
              onChange={(e) => setResetClearDevices(e.target.checked)}
              className="accent-indigo-600"
            />
            Also remove all trusted devices (student lost every browser)
          </label>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this user?"
        message="This will permanently remove the account and all of its attendance records. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          deleteUser(target);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!unlockTarget}
        title="Unlock face verification?"
        message={
          unlockTarget
            ? `"${unlockTarget.name}" will be able to retry face verification immediately.`
            : ""
        }
        confirmLabel="Unlock"
        cancelLabel="Cancel"
        variant="default"
        icon={<FaShieldAlt />}
        onConfirm={() => unlockTarget && unlockFace(unlockTarget)}
        onCancel={() => setUnlockTarget(null)}
      />

      <ConfirmDialog
        open={!!reviewTarget}
        title={
          reviewTarget?.action === "approved"
            ? "Approve this appeal?"
            : "Reject this appeal?"
        }
        message={
          reviewTarget?.action === "approved"
            ? "Approving unlocks the student's face verification so they can retry immediately."
            : "Rejecting notifies the student that their appeal was declined. Add a reason below."
        }
        confirmLabel={
          reviewTarget?.action === "approved" ? "Approve" : "Reject"
        }
        cancelLabel="Cancel"
        variant={reviewTarget?.action === "approved" ? "default" : "danger"}
        onConfirm={() =>
          reviewTarget && handleReview(reviewTarget.appeal, reviewTarget.action)
        }
        onCancel={() => {
          setReviewTarget(null);
          setReviewNote("");
        }}
      >
        {reviewTarget?.action === "rejected" && (
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Optional reason for rejection (shown to the student)..."
            rows={2}
            className="mt-3 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        )}
      </ConfirmDialog>
    </div>
  );
};

export default ManageUsers;
