import React, { useState, useEffect } from "react";
import api from "../../api/axios";

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userAttendance, setUserAttendance] = useState([]);
  const [showModal, setShowModal] = useState(false);

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const deleteUser = async (userId, userRole) => {
    if (userRole === "admin") {
      alert("Cannot delete admin accounts");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(users.filter((u) => u._id !== userId));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete user");
    }
  };

  const openUserDetails = async (user) => {
    setSelectedUser(user);
    setShowModal(true);
    try {
      const res = await api.get("/reports/attendance");
      const userRecords = res.data.records.filter(
        (r) => r.student?._id === user._id || r.student === user._id
      );
      setUserAttendance(userRecords);
    } catch (err) {
      console.error(err);
      setUserAttendance([]);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h2 className="text-2xl font-bold text-red-400">Manage Users</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 bg-card dark:bg-black rounded border border-line text-on placeholder-on-muted focus:outline-none focus:border-red-500"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-card dark:bg-black rounded border border-line text-on focus:outline-none focus:border-red-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="organizer">Organizer</option>
            <option value="student">Student</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-xl border border-line">
          <p className="text-sm text-on-dim">Total Users</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card p-4 rounded-xl border dark:border-cyan-900/50 border-cyan-200">
          <p className="text-sm dark:text-cyan-400 text-cyan-600">Admins</p>
          <p className="text-2xl font-bold dark:text-cyan-400 text-cyan-600">{stats.admin}</p>
        </div>
        <div className="bg-card p-4 rounded-xl border dark:border-yellow-900/50 border-yellow-200">
          <p className="text-sm dark:text-yellow-400 text-yellow-600">Organizers</p>
          <p className="text-2xl font-bold dark:text-yellow-400 text-yellow-600">{stats.organizer}</p>
        </div>
        <div className="bg-card p-4 rounded-xl border dark:border-purple-900/50 border-purple-200">
          <p className="text-sm dark:text-purple-400 text-purple-600">Students</p>
          <p className="text-2xl font-bold dark:text-purple-400 text-purple-600">{stats.student}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-dim">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-on-dim">No users found</div>
      ) : (
        <div className="bg-card rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-card-alt">
                  <th className="text-left p-4 font-medium text-on-dim">Name</th>
                  <th className="text-left p-4 font-medium text-on-dim">Email</th>
                  <th className="text-left p-4 font-medium text-on-dim">Role</th>
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
                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-on-dim">{user.email}</td>
                    <td className="p-4">{getRoleBadge(user.role)}</td>
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
                        {user.role !== "admin" && (
                          <button
                            onClick={() => deleteUser(user._id, user.role)}
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

      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-line">
            <div className="border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-linear-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xl font-bold">
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
              <div className="flex items-center gap-3 mb-6">
                <span className="text-sm text-on-dim">Role:</span>
                {getRoleBadge(selectedUser.role)}
                <span className="text-sm text-on-dim">
                  Joined: {new Date(selectedUser.createdAt).toLocaleDateString()}
                </span>
              </div>

              <h4 className="text-lg font-semibold mb-4">
                Attendance History ({userAttendance.length})
              </h4>
              {userAttendance.length === 0 ? (
                <p className="text-on-dim text-center py-8">No attendance records</p>
              ) : (
                <div className="space-y-2">
                  {userAttendance.map((record, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-card-alt rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{record.event?.title || "Event"}</p>
                        <p className="text-sm text-on-dim">
                          {record.event?.date && new Date(record.event.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          record.status === "present"
                            ? "dark:bg-green-900/50 bg-green-100 dark:text-green-400 text-green-700"
                            : record.status === "absent"
                            ? "dark:bg-red-900/50 bg-red-100 dark:text-red-400 text-red-700"
                            : "dark:bg-yellow-900/50 bg-yellow-100 dark:text-yellow-400 text-yellow-700"
                        }`}
                      >
                        {record.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;
