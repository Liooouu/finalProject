import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { getUserFromToken, logout } from "../../utils/auth";
import { FaUser, FaLock, FaImage, FaCheck, FaTimes, FaDoorOpen } from "react-icons/fa";
import { usePageMeta } from "../../context/PageMetaContext";
import { BaseCard } from "../ui";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Loading from "../shared/Loading";

const inputClasses =
  "w-full rounded-lg border border-line bg-card-alt/60 px-3.5 py-2.5 text-sm text-on placeholder-on-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors";

const ProfileSettings = () => {
  const user = getUserFromToken();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [uploadingPic, setUploadingPic] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  usePageMeta("Profile Settings", "Manage your account information.");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileRes = await api.get("/account");
        setProfile(profileRes.data);
        setForm({ name: profileRes.data.name, email: profileRes.data.email });

        if (user.role === "student") {
          const statsRes = await api.get("/student/community-service");
          setStats({
            totalHours: statsRes.data.totalHours || 0,
            totalAttended: statsRes.data.totalAttended || 0,
          });
        } else if (user.role === "organizer") {
          const statsRes = await api.get("/organizer/stats");
          setStats({
            totalEvents: statsRes.data.totalEvents || 0,
            totalAttendees: statsRes.data.totalAttendees || 0,
          });
        }
      } catch (err) {
        console.error(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.role]);

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch("/account", form);
      setProfile(res.data);
      setEditing(false);
      showMessage("Profile updated successfully!");
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to update profile", "error");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    try {
      await api.patch("/account/password", passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setShowPasswordForm(false);
      showMessage("Password changed successfully!");
    } catch (err) {
      showMessage(err.response?.data?.error || "Password update failed", "error");
    }
  };

  const handlePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showMessage("File size must be less than 5MB", "error");
      return;
    }

    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append("picture", file);

      const res = await api.post("/account/picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfile(res.data.user);
      showMessage("Profile picture updated!");
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to upload picture", "error");
    } finally {
      setUploadingPic(false);
    }
  };

  const handleLogout = () => {
    setConfirmLogout(true);
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <BaseCard>
            <div className="mb-6 flex flex-col gap-4 rounded-xl bg-linear-to-br from-indigo-600 to-indigo-900 p-6 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                {profile?.profilePicture ? (
                  <img
                    src={`http://localhost:5000${profile.profilePicture}`}
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-white/20"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/20">
                    <FaUser className="text-3xl text-white" />
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-white p-1.5 text-indigo-700 shadow-md transition-colors hover:bg-slate-100">
                  <FaImage className="text-xs" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureUpload}
                    className="hidden"
                    disabled={uploadingPic}
                  />
                </label>
              </div>
              <div className="min-w-0 text-white">
                <h2 className="truncate text-2xl font-bold">{profile?.name}</h2>
                <p className="truncate text-indigo-200">{profile?.email}</p>
                <span className="mt-2 inline-block rounded-full bg-white/20 px-3 py-0.5 text-sm capitalize">
                  {profile?.role}
                </span>
              </div>
            </div>

            {editing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="pf-name" className="text-sm font-medium text-on">
                    Full Name
                  </label>
                  <input
                    id="pf-name"
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className={inputClasses}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pf-email" className="text-sm font-medium text-on">
                    Email Address
                  </label>
                  <input
                    id="pf-email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClasses}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit">
                    <FaCheck /> Save Changes
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setForm({ name: profile.name, email: profile.email });
                    }}
                    variant="secondary"
                  >
                    <FaTimes /> Cancel
                  </Button>
                </div>
              </form>
            ) : showPasswordForm ? (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <h3 className="text-lg font-semibold text-on">Change Password</h3>
                <div className="space-y-1.5">
                  <label htmlFor="pw-current" className="text-sm font-medium text-on">
                    Current Password
                  </label>
                  <input
                    id="pw-current"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className={inputClasses}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pw-new" className="text-sm font-medium text-on">
                    New Password
                  </label>
                  <input
                    id="pw-new"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className={inputClasses}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit">
                    <FaCheck /> Update Password
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({ currentPassword: "", newPassword: "" });
                    }}
                    variant="secondary"
                  >
                    <FaTimes /> Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {[
                  { label: "Full Name", value: profile?.name },
                  { label: "Email Address", value: profile?.email },
                  {
                    label: "Role",
                    value: profile?.role ? profile.role[0].toUpperCase() + profile.role.slice(1) : "",
                  },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="text-sm text-on-dim">{field.label}</label>
                    <p className="text-lg font-medium text-on">{field.value}</p>
                  </div>
                ))}
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setEditing(true)}>
                    <FaUser /> Edit Profile
                  </Button>
                  <Button onClick={() => setShowPasswordForm(true)} variant="secondary">
                    <FaLock /> Change Password
                  </Button>
                </div>
              </div>
            )}
          </BaseCard>
        </div>

        <div className="space-y-6">
          <BaseCard title="Your Statistics" icon={<FaUser />}>
            <div className="space-y-4">
              {user.role === "student" && (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-indigo-500/10 p-3">
                    <span className="text-sm text-on-dim">Events Attended</span>
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {stats.totalAttended || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-amber-500/10 p-3">
                    <span className="text-sm text-on-dim">Community Service</span>
                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {stats.totalHours || 0} hrs
                    </span>
                  </div>
                </>
              )}
              {user.role === "organizer" && (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-indigo-500/10 p-3">
                    <span className="text-sm text-on-dim">Events Created</span>
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {stats.totalEvents || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 p-3">
                    <span className="text-sm text-on-dim">Total Attendees</span>
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {stats.totalAttendees || 0}
                    </span>
                  </div>
                </>
              )}
              {user.role === "admin" && (
                <p className="text-sm text-on-dim">Admin accounts have full system access.</p>
              )}
            </div>
          </BaseCard>

          <Button onClick={handleLogout} variant="danger" className="w-full py-2.5">
            <FaDoorOpen /> Log Out
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out of TrackED?"
        message="You will need to sign back in to continue tracking attendance."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
};

export default ProfileSettings;