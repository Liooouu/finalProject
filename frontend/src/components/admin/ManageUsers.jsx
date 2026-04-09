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
    admin: "bg-cyan-900/50 text-cyan-400 border-cyan-700",
    organizer: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
    student: "bg-purple-900/50 text-purple-400 border-purple-700",
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
            className="px-4 py-2 bg-black rounded border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-black rounded border border-gray-700 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="organizer">Organizer</option>
            <option value="student">Student</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0f0f14] p-4 rounded-xl border border-gray-800">
          <p className="text-sm text-gray-400">Total Users</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-[#0f0f14] p-4 rounded-xl border border-cyan-900/50">
          <p className="text-sm text-cyan-400">Admins</p>
          <p className="text-2xl font-bold text-cyan-400">{stats.admin}</p>
        </div>
        <div className="bg-[#0f0f14] p-4 rounded-xl border border-yellow-900/50">
          <p className="text-sm text-yellow-400">Organizers</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.organizer}</p>
        </div>
        <div className="bg-[#0f0f14] p-4 rounded-xl border border-purple-900/50">
          <p className="text-sm text-purple-400">Students</p>
          <p className="text-2xl font-bold text-purple-400">{stats.student}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No users found</div>
      ) : (
        <div className="bg-[#0f0f14] rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-black/30">
                  <th className="text-left p-4 font-medium text-gray-400">Name</th>
                  <th className="text-left p-4 font-medium text-gray-400">Email</th>
                  <th className="text-left p-4 font-medium text-gray-400">Role</th>
                  <th className="text-left p-4 font-medium text-gray-400">Created</th>
                  <th className="text-left p-4 font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b border-gray-800/50 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-400">{user.email}</td>
                    <td className="p-4">{getRoleBadge(user.role)}</td>
                    <td className="p-4 text-gray-400 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openUserDetails(user)}
                          className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
                        >
                          View
                        </button>
                        {user.role !== "admin" && (
                          <button
                            onClick={() => deleteUser(user._id, user.role)}
                            className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900 rounded text-sm transition-colors"
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
          <div className="bg-[#0f0f14] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-700">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-linear-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xl font-bold">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                  <p className="text-sm text-gray-400">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-800 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-sm text-gray-400">Role:</span>
                {getRoleBadge(selectedUser.role)}
                <span className="text-sm text-gray-400">
                  Joined: {new Date(selectedUser.createdAt).toLocaleDateString()}
                </span>
              </div>

              <h4 className="text-lg font-semibold mb-4">
                Attendance History ({userAttendance.length})
              </h4>
              {userAttendance.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No attendance records</p>
              ) : (
                <div className="space-y-2">
                  {userAttendance.map((record, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-black/30 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{record.event?.title || "Event"}</p>
                        <p className="text-sm text-gray-400">
                          {record.event?.date && new Date(record.event.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          record.status === "present"
                            ? "bg-green-900/50 text-green-400"
                            : record.status === "absent"
                            ? "bg-red-900/50 text-red-400"
                            : "bg-yellow-900/50 text-yellow-400"
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
