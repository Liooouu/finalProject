import React, { useState, useEffect } from "react";
import api from "../../api/axios";

const StudentProfile = () => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ totalHours: 0, totalAttended: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileRes = await api.get("/account");
        setProfile(profileRes.data);
        setForm({ name: profileRes.data.name, email: profileRes.data.email });

        const statsRes = await api.get("/student/community-service");
        setStats({
          totalHours: statsRes.data.totalHours || 0,
          totalAttended: statsRes.data.totalAttended || 0,
        });
      } catch (err) {
        console.error(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.patch("/account", form);
      setProfile({ ...profile, ...form });
      setEditing(false);
      setMessage("Profile updated successfully!");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update profile");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">My Profile</h1>
        <p className="text-gray-400 mt-1">Manage your account information</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl ${message.includes("success") ? "bg-green-500/20 border border-green-500/30 text-green-400" : "bg-red-500/20 border border-red-500/30 text-red-400"}`}>
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-2">
          <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-linear-to-r from-red-600 to-red-800 p-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl">
                  👤
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{profile?.name}</h2>
                  <p className="text-white/80">{profile?.email}</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-sm capitalize">
                    {profile?.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {editing ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      required
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="bg-linear-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setForm({ name: profile.name, email: profile.email });
                      }}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 rounded-xl transition-all duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400">Full Name</label>
                    <p className="text-lg font-medium text-white">{profile?.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400">Email Address</label>
                    <p className="text-lg font-medium text-white">{profile?.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400">Role</label>
                    <p className="text-lg font-medium text-white capitalize">{profile?.role}</p>
                  </div>
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all duration-200"
                  >
                    Edit Profile
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="space-y-6">
          {/* Statistics */}
          <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-xl">
                <span className="text-gray-400">Events Attended</span>
                <span className="text-2xl font-bold text-green-400">{stats.totalAttended}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-500/10 rounded-xl">
                <span className="text-gray-400">Community Service</span>
                <span className="text-2xl font-bold text-yellow-400">{stats.totalHours} hrs</span>
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Account Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors flex items-center gap-3">
                <span>🔒</span> Change Password
              </button>
              <button
                onClick={() => window.location.href = "/student/dashboard/community-service"}
                className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors flex items-center gap-3"
              >
                <span>📊</span> View Community Service
              </button>
              <button
                onClick={() => window.location.href = "/student/dashboard/submit-excuse"}
                className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors flex items-center gap-3"
              >
                <span>📝</span> Submit Excuse
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
