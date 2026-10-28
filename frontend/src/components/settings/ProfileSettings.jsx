import React, { useState, useEffect, lazy, Suspense } from "react";
import api from "../../api/axios";
import { useSearchParams } from "react-router-dom";
import SecuritySettings from "./SecuritySettings";
import AcademicStanding from "../student/AcademicStanding";
import { getUserFromToken, logout } from "../../utils/auth";
import { isStrongPassword, PASSWORD_MESSAGE, PASSWORD_HINT } from "../../utils/password";
import { FaUser, FaLock, FaCheck, FaTimes, FaDoorOpen, FaCamera } from "react-icons/fa";
import { usePageMeta } from "../../context/PageMetaContext";
import { Button, Card, FlightPanel, PageHeader, SegmentedControl } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Loading from "../shared/Loading";

const EmailSettings = lazy(() => import("../admin/EmailSettings"));

const ProfileSettings = () => {
  const user = getUserFromToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get("section");
  const [profile, setProfile] = useState(null);
  const hasStudentProfile = (profile?.accountRole || profile?.role || user.role) === "student";
  const section = user.role === "admin" && requestedSection === "email" ? "email" : hasStudentProfile && ["security", "academic"].includes(requestedSection) ? requestedSection : "profile";
  const profileRole = hasStudentProfile && profile?.organizerAccess ? "Student/Organizer" : profile?.role || user.role;
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
      <PageHeader eyebrow="Account" title="Profile settings" subtitle="Your personal details, academic record, and account security." />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <div className="relative shrink-0">
            {profile?.profilePicture ? <img src={profile.profilePicture} alt="Profile" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-line sm:h-20 sm:w-20" /> :
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20 sm:h-20 sm:w-20"><FaUser className="text-2xl" /></div>}
            <label title="Change profile picture" className={`absolute -bottom-1 -right-1 cursor-pointer rounded-lg border border-line bg-card p-2 text-brand shadow-sm hover:bg-card-alt ${uploadingPic ? "pointer-events-none opacity-60" : ""}`}>
              <FaCamera className="text-xs" aria-hidden="true" /><span className="sr-only">Upload profile picture</span>
              <input type="file" accept="image/*" onChange={handlePictureUpload} className="hidden" disabled={uploadingPic} aria-label="Upload profile picture" />
            </label>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="break-words font-display text-xl font-semibold tracking-tight text-on sm:text-2xl">{profile?.name || "Your profile"}</h1>
            <p className="mt-1 break-words text-sm text-on-muted [overflow-wrap:anywhere]">{profile?.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 font-medium capitalize text-brand">{profileRole}</span>
              {profile?.program && <span className="text-on-muted">{profile.program}</span>}
              {uploadingPic && <span role="status" className="text-on-muted">Updating photo…</span>}
            </div>
          </div>
        </div>
      </Card>

      {(hasStudentProfile || user.role === "admin") && <SegmentedControl ariaLabel="Profile sections" value={section}
        onChange={(value) => { setSearchParams(value === "profile" ? {} : { section: value }); setEditing(false); setShowPasswordForm(false); }}
        options={user.role === "admin" ? [{ value: "profile", label: "Profile" }, { value: "email", label: "Email settings" }] : [{ value: "profile", label: "Profile" }, { value: "academic", label: "Academic record" }, { value: "security", label: "Security" }]} />}

      {section === "email" ? <Suspense fallback={<Loading label="Loading email settings..." />}><EmailSettings embedded /></Suspense> : section === "security" ? <SecuritySettings embedded /> : section === "academic" ? <AcademicStanding /> : <>
        {message && <div className={`alert ${messageType === "success" ? "alert-ok" : "alert-danger"}`} role="status"><span aria-hidden="true">{messageType === "success" ? "✓" : "!"}</span><p>{message}</p></div>}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
          <FlightPanel level="ledger" glass title={editing ? "Edit personal information" : showPasswordForm ? "Update password" : "Personal information"} icon={<FaUser />}>
            {editing ? (
              <form onSubmit={handleSubmit} className="space-y-4">

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

                <dl className="divide-y divide-line rounded-xl border border-line">
                  {[
                    { label: "Full name", value: profile?.name },
                    { label: "Email address", value: profile?.email },
                    {
                      label: "Role",
                      value: profileRole[0].toUpperCase() + profileRole.slice(1),
                    },
                  ].map((field) => (
                    <div key={field.label} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <dt className="text-sm text-on-dim">{field.label}</dt>
                      <dd className="min-w-0 break-words text-sm font-medium text-on [overflow-wrap:anywhere]">{field.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setEditing(true)}>
                    <FaUser /> Edit profile
                  </Button>

                </div>
              </div>
            )}
          </FlightPanel>
          <FlightPanel level="instrument" glass title="Account access" icon={<FaLock />}>
            <p className="text-sm leading-relaxed text-on-dim">Manage your sign-in password or securely sign out of this device.</p>
            <div className="mt-4 space-y-2">
              <Button onClick={() => { setEditing(false); setShowPasswordForm(true); }} variant="secondary" className="w-full"><FaLock /> Change password</Button>
              <Button onClick={handleLogout} variant="danger" className="w-full"><FaDoorOpen /> Log out</Button>
            </div>
          </FlightPanel>
        </div>
      </>}

      <ConfirmDialog open={confirmLogout} title="Log out of TrackED?" message="You will need to sign back in to continue tracking attendance." confirmLabel="Log Out" cancelLabel="Cancel" variant="danger" onConfirm={logout} onCancel={() => setConfirmLogout(false)} />
    </div>
  );
};

export default ProfileSettings;
