import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { getUserFromToken, logout } from "../../utils/auth";
import { isStrongPassword, PASSWORD_MESSAGE, PASSWORD_HINT } from "../../utils/password";
import { FaUser, FaLock, FaImage, FaCheck, FaTimes, FaDoorOpen, FaCamera } from "react-icons/fa";
import { usePageMeta } from "../../context/PageMetaContext";
import { Button, Card, FlightPanel, PageHeader } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Loading from "../shared/Loading";

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
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
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
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const res = await api.patch("/account", form);
      setProfile(res.data);
      setEditing(false);
      showMessage("Profile updated successfully!");
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (savingPassword) return;
    if (!isStrongPassword(passwordForm.newPassword)) {
      showMessage(PASSWORD_MESSAGE, "error");
      return;
    }
    setSavingPassword(true);
    try {
      await api.patch("/account/password", passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setShowPasswordForm(false);
      showMessage("Password changed successfully!");
    } catch (err) {
      showMessage(err.response?.data?.error || "Password update failed", "error");
    } finally {
      setSavingPassword(false);
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
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Profile settings"
        subtitle="Update how you appear in TrackED and manage your sign-in details."
      />

      {message && (
        <div
          className={`alert ${messageType === "success" ? "alert-ok" : "alert-danger"}`}
          role="status"
        >
          <span aria-hidden="true">{messageType === "success" ? "✓" : "!"}</span>
          <p>{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[var(--brand)] to-[#312e81] p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl"
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                {profile?.profilePicture ? (
                  <img
                    src={profile.profilePicture}
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-white/20"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/20">
                    <FaUser className="text-3xl text-white" />
                  </div>
                )}
                <label
                  className={`absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-white p-2 text-indigo-700 shadow-md transition-colors hover:bg-slate-100 ${
                    uploadingPic ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <FaCamera className="text-xs" aria-hidden="true" />
                  <span className="sr-only">Upload profile picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureUpload}
                    className="hidden"
                    disabled={uploadingPic}
                    aria-label="Upload profile picture"
                  />
                </label>
              </div>
              <div className="min-w-0 text-white">
                <h2 className="truncate font-display text-2xl font-semibold tracking-tight">
                  {profile?.name}
                </h2>
                <p className="truncate text-sm text-white/75">{profile?.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium capitalize">
                    {profile?.role}
                  </span>
                  {uploadingPic && (
                    <span className="text-[11px] text-white/80">Uploading…</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {editing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="panel-heading text-base">Edit profile</h3>
                <div>
                  <label htmlFor="pf-name" className="field-label">
                    Full name
                  </label>
                  <input
                    id="pf-name"
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="field"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="pf-email" className="field-label">
                    Email address
                  </label>
                  <input
                    id="pf-email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="field"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={savingProfile}>
                    <FaCheck /> {savingProfile ? "Saving…" : "Save changes"}
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
                <h3 className="panel-heading text-base">Change password</h3>
                <div>
                  <label htmlFor="pw-current" className="field-label">
                    Current password
                  </label>
                  <input
                    id="pw-current"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    className="field"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="pw-new" className="field-label">
                    New password
                  </label>
                  <input
                    id="pw-new"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    className="field"
                    required
                  />
                  <p className="field-hint">{PASSWORD_HINT}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={savingPassword}>
                    <FaCheck /> {savingPassword ? "Updating…" : "Update password"}
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
                <h3 className="panel-heading text-base">Account details</h3>
                <dl className="divide-y divide-line rounded-xl border border-line">
                  {[
                    { label: "Full name", value: profile?.name },
                    { label: "Email address", value: profile?.email },
                    {
                      label: "Role",
                      value: profile?.role
                        ? profile.role[0].toUpperCase() + profile.role.slice(1)
                        : "",
                    },
                  ].map((field) => (
                    <div key={field.label} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <dt className="text-sm text-on-dim">{field.label}</dt>
                      <dd className="text-sm font-medium text-on">{field.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setEditing(true)}>
                    <FaUser /> Edit profile
                  </Button>
                  <Button
                    onClick={() => setShowPasswordForm(true)}
                    variant="secondary"
                  >
                    <FaLock /> Change password
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <FlightPanel
            level="instrument"
            glass
            eyebrow="Account"
            title="Your statistics"
            icon={<FaImage />}
          >
            <div className="space-y-2.5">
              {user.role === "student" && (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-line bg-card-alt/40 p-3.5">
                    <span className="text-sm text-on-dim">Events attended</span>
                    <span className="num text-lg font-semibold text-brand">
                      {stats.totalAttended || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-line bg-card-alt/40 p-3.5">
                    <span className="text-sm text-on-dim">Community service</span>
                    <span className="num text-lg font-semibold text-warn">
                      {stats.totalHours || 0} hrs
                    </span>
                  </div>
                </>
              )}
              {user.role === "organizer" && (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-line bg-card-alt/40 p-3.5">
                    <span className="text-sm text-on-dim">Events created</span>
                    <span className="num text-lg font-semibold text-brand">
                      {stats.totalEvents || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-line bg-card-alt/40 p-3.5">
                    <span className="text-sm text-on-dim">Total attendees</span>
                    <span className="num text-lg font-semibold text-ok">
                      {stats.totalAttendees || 0}
                    </span>
                  </div>
                </>
              )}
              {user.role === "admin" && (
                <p className="text-sm leading-relaxed text-on-dim">
                  Admin accounts have full system access.
                </p>
              )}
            </div>
          </FlightPanel>

          <Button onClick={handleLogout} variant="danger" className="w-full">
            <FaDoorOpen /> Log out
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
