import AcademicPeriodsSettings from "./AcademicPeriodsSettings";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { useTransientState } from "../../utils/useTransientState";
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import {
  FaTimes,
  FaEye,
  FaShieldAlt,
  FaTrash,
  FaUnlock,
  FaUsers,
} from "react-icons/fa";
import EmptyState from "../shared/EmptyState";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  Button,
  Card,
  PageHeader,
  StatusChip,
  TableSkeleton,
  Tabs,
} from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Pagination from "../ui/Pagination";
import StablePage from "../ui/StablePage";
import AcademicAdvancement from "./AcademicAdvancement";
import { formatDate, formatDateTime } from "../../utils/helpers";
import { readScreen, writeScreen } from "../../utils/queryCache";

const CACHE_KEY = "admin:users:enrollment-status";

const roleStyles = {
  admin: "border-brand/25 bg-brand/10 text-brand",
  organizer: "border-warn/25 bg-warn/10 text-warn",
  student: "border-info/25 bg-info/10 text-info",
};

const PROGRAM_OPTIONS = ["BSIT", "BSCS", "BSEMC"];
const YEAR_OPTIONS = [1, 2, 3, 4];
const SECTION_OPTIONS = ["A", "B", "C"];

const ManageUsers = () => {
  const seed = readScreen(CACHE_KEY);
  const [users, setUsers] = useState(seed?.users ?? []);
  const [loading, setLoading] = useState(seed === undefined);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [promoteTarget, setPromoteTarget] = useState(null);
  const [promoting, setPromoting] = useState(false);
  const [faceStatusLoading, setFaceStatusLoading] = useState(false);
  const [faceStatusError, setFaceStatusError] = useState(false);
  const faceStatusRequest = useRef(0);
  const [academicDraft, setAcademicDraft] = useState({ program: "", yearLevel: "", section: "" });
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [detailNotice, setDetailNotice] = useTransientState(null);
  const [demoteTarget, setDemoteTarget] = useState(null);
  const [demoting, setDemoting] = useState(false);
  const listLoaded = useRef(seed !== undefined);

  const mergeStudent = (student) => {
    setUsers(previous => previous.map(user => user._id === student._id ? { ...user, ...student } : user));
    setSelectedUser(previous => previous?._id === student._id ? { ...previous, ...student } : previous);
  };
  const saveAcademic = async (event) => {
    event.preventDefault();
    if (savingAcademic || demoting) return;
    setSavingAcademic(true);
    setDetailNotice(null);
    try {
      const response = await api.patch(`/admin/users/${selectedUser._id}`, { ...academicDraft, yearLevel: Number(academicDraft.yearLevel) });
      mergeStudent(response.data);
      setAcademicDraft({ program: response.data.program || "", yearLevel: String(response.data.yearLevel || ""), section: response.data.section || "" });
      fetchUsers({ silent: true });
      setDetailNotice({ type: "success", text: "Student academic details updated." });
    } catch (error) {
      setDetailNotice({ type: "error", text: error.response?.data?.message || "Could not update academic details. Please try again." });
    } finally { setSavingAcademic(false); }
  };
  const promoteStudent = async () => {
    if (!promoteTarget || promoting) return;
    setPromoting(true);
    setDetailNotice(null);
    try {
      const { data } = await api.post(`/admin/users/${promoteTarget._id}/promote-organizer`);
      mergeStudent(data.student);
      setDetailNotice({ type: "success", text: [data.message, data.notificationWarning].filter(Boolean).join(" ") });
    } catch (error) {
      setDetailNotice({ type: "error", text: error.response?.data?.message || "Could not grant organizer access. Please try again." });
    } finally {
      setPromoting(false);
      setPromoteTarget(null);
    }
  };
  const demoteStudent = async () => {
    if (!demoteTarget || demoting) return;
    setDemoting(true);
    setDetailNotice(null);
    try {
      const response = await api.post(`/admin/users/${demoteTarget._id}/demote-organizer`);
      mergeStudent(response.data.student);
      setDetailNotice({ type: "success", text: [response.data.message, response.data.notificationWarning].filter(Boolean).join(" ") });
    } catch (error) {
      setDetailNotice({ type: "error", text: error.response?.data?.message || "Could not remove organizer access. Please try again." });
    } finally { setDemoting(false); setDemoteTarget(null); }
  };
  const [userAttendance, setUserAttendance] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [serviceDraft, setServiceDraft] = useState("");
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [faceResetTarget, setFaceResetTarget] = useState(null);
  const [resettingFace, setResettingFace] = useState(false);

  const resetFace = async () => {
    if (!faceResetTarget) return;
    setResettingFace(true);
    try {
      await api.delete(`/admin/users/${faceResetTarget._id}/face`);
      const cleared = { ...faceResetTarget, faceEnrolled: false };
      setUsers((previous) => previous.map((u) => u._id === cleared._id ? { ...u, ...cleared } : u));
      setSelectedUser((previous) => previous?._id === cleared._id ? cleared : previous);
      setFaceResetTarget(null);
      setMessage("Face enrollment reset. The student can enroll again in Security settings.");
      setMessageType("success");
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not reset face enrollment");
      setMessageType("error");
    } finally { setResettingFace(false); }
  };
  const [message, setMessage] = useTransientState("");
  const [messageType, setMessageType] = useState("success");
  const [pendingRemoveCS, setPendingRemoveCS] = useState(null);
  const [removingCS, setRemovingCS] = useState(false);
  const totalServiceHours = userAttendance.reduce((total, record) => total + (record.communityServiceHours || 0), 0);
  const attendancePages = Math.max(1, Math.ceil(userAttendance.length / 5));
  const currentAttendancePage = Math.min(attendancePage, attendancePages);
  const visibleAttendance = userAttendance.slice((currentAttendancePage - 1) * 5, currentAttendancePage * 5);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = ["advancement","terms"].includes(searchParams.get("tab")) ? searchParams.get("tab") : "users";
  const setActiveTab = tab => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (tab !== "users") next.set("tab", tab); else next.delete("tab");
    return next;
  }, { replace: true });
  const [unlockTarget, setUnlockTarget] = useState(null);

  usePageMeta("Manage Users", "Search, inspect, and manage all accounts.");

  const fetchUsers = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
      writeScreen(CACHE_KEY, { users: res.data });
      listLoaded.current = true;
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Anything cached is already painted, so the background refresh must not
    // flash the table back to a skeleton.
    fetchUsers({ silent: readScreen(CACHE_KEY) !== undefined });
  }, []);

  useAutoRefresh(fetchUsers, { interval: 30000, enabled: !selectedUser });

  // Promote, unlock and delete edit the list locally, so the cache has to
  // follow them — otherwise a deleted account reappears for a second on the
  // next visit before the refresh lands. The flag skips the first paint,
  // where "users" is still the cache it was seeded from.
  useEffect(() => {
    if (!listLoaded.current) return;
    writeScreen(CACHE_KEY, { users });
  }, [users]);

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

  // Readable class line for the directory: "BSIT · 3rd Year · A".
  const yearLabels = { 1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year" };
  const academicSummary = (user) => {
    const year = yearLabels[Number(user.yearLevel)];
    const parts = [user.program, year, user.section].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Unassigned";
  };

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

  const deleteUser = async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setMessage("User deleted successfully");
      setMessageType("success");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || "Failed to delete user");
      setMessageType("error");
    }
  };

  const loadAttendance = async (user) => {
    // The report endpoint returns a window, so ask for this student's ledger
    // instead of pulling the institution-wide list and filtering it here.
    const res = await api.get("/reports/attendance", {
      params: { studentId: user._id, limit: 200 },
    });
    const userRecords = res.data.records;
    setUserAttendance(userRecords);
    setServiceDraft(String(userRecords.reduce((total, record) => total + (record.communityServiceHours || 0), 0)));
  };

  const openUserDetails = async (user) => {
    setSelectedUser(user);
    const requestId = ++faceStatusRequest.current;
    setFaceStatusLoading(true);
    setFaceStatusError(false);
    api.get(`/admin/users/${user._id}`).then(({ data }) => {
      if (requestId === faceStatusRequest.current) mergeStudent(data);
    }).catch(() => {
      if (requestId === faceStatusRequest.current) setFaceStatusError(true);
    }).finally(() => {
      if (requestId === faceStatusRequest.current) setFaceStatusLoading(false);
    });
    setAcademicDraft({ program: user.program || "", yearLevel: String(user.yearLevel || ""), section: user.section || "" });
    setDetailNotice(null);
    setUserAttendance([]);
    setServiceDraft("");
    setAttendancePage(1);
    setAttendanceError("");
    setAttendanceLoading(true);
    setShowModal(true);
    try { await loadAttendance(user); }
    catch { setAttendanceError("Could not load attendance and service hours. Close this window and reopen it to retry."); }
    finally { setAttendanceLoading(false); }
  };

  const requestServiceUpdate = (hours) => {
    const target = Number(hours);
    if (!String(hours).trim() || !Number.isFinite(target) || target < 0) {
      setDetailNotice({ type: "error", text: "Enter a valid total of zero hours or more." });
      return;
    }
    setPendingRemoveCS({ studentId: selectedUser._id, previous: totalServiceHours, target });
  };

  const confirmRemoveCS = async () => {
    if (!pendingRemoveCS || removingCS) return;
    setRemovingCS(true);
    try {
      const response = await api.patch(`/admin/users/${pendingRemoveCS.studentId}/community-service`, { hours: pendingRemoveCS.target, expectedTotal: pendingRemoveCS.previous });
      await loadAttendance(selectedUser);
      setDetailNotice({ type: "success", text: [response.data.message, response.data.notificationWarning].filter(Boolean).join(" ") });
    } catch (error) {
      setDetailNotice({ type: "error", text: error.response?.data?.message || "Could not finish the adjustment. Reload these details to check the latest balance." });
    } finally { setRemovingCS(false); setPendingRemoveCS(null); }
  };

  const term = search.trim().toLowerCase();
  const matchingUsers = users.filter(user => !term ||
    [user.name, user.email].some(value => String(value || "").toLowerCase().includes(term)));
  const studentCount = users.filter((user) => user.role === "student").length;
  // Staff access as the portal defines it: an admin, a legacy organizer, or a
  // student who was promoted. Counting them once keeps the summary honest.
  const staffCount = users.filter(
    (user) => user.role === "admin" || user.role === "organizer" || user.organizerAccess === true
  ).length;
  const filteredUsers = matchingUsers
    .filter((user) => {
      if (roleFilter === "admins") return user.role === "admin";
      if (roleFilter === "organizers") return user.role === "organizer" || user.organizerAccess === true;
      if (roleFilter === "students") return user.role === "student";
      return true;
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  const getRoleBadge = (role, organizerAccess = false) => (
    <span
      className={`inline-flex whitespace-nowrap items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
        roleStyles[role] || roleStyles.student
      }`}
    >
      {role === "student" && organizerAccess ? "Student/Organizer" : role}
    </span>
  );

  // One row action. Face unlocks, organizer access, service balances and
  // account deletion live in the details dialog, where the student's state is
  // visible; keeping them in the table turned every row into a menu.
  const renderUserActions = (user, compact = false) =>
    compact ? (
      <div className="flex items-center justify-end gap-1">
        <Button
          onClick={() => openUserDetails(user)}
          variant="secondary"
          size="icon"
          style={{ width: 28, height: 28 }}
          title="View details"
          aria-label={`View ${user.name}`}
        >
          <FaEye className="text-[11px]" />
        </Button>
      </div>
    ) : (
      <div className="mt-3">
        <Button
          onClick={() => openUserDetails(user)}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          <FaEye className="text-[11px]" />
          View details
        </Button>
      </div>
    );

  // One directory for every account. Two tables doubled the filters and hid the
  // role behind the section a person happened to be filed under; a single list
  // with a role filter answers "who has access to what" in one place.
  const renderDirectory = () => {
    const currentPage = Math.min(directoryPage, Math.max(1, Math.ceil(filteredUsers.length / 5)));
    const visibleUsers = filteredUsers.slice((currentPage - 1) * 5, currentPage * 5);
    return (
    <Card as="section" aria-label="Accounts" padding="none" className="flex min-w-0 flex-col overflow-hidden">
      <StablePage fill pageKey={`directory:${roleFilter}:${term}`} loading={loading} footer={<div className="px-4 pb-4"><Pagination page={currentPage} pageSize={5} total={filteredUsers.length} onChange={setDirectoryPage} disabled={loading} label="Account pages" /></div>}>
      <div className="min-w-0">
        {loading ? (
        <div className="p-4">
          <TableSkeleton rows={4} />
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<FaUsers />}
          title="No accounts found"
          description={
            term || roleFilter !== "all"
              ? "Try another name or email, or switch the filter back to all accounts."
              : "Accounts will appear here once registered."
          }
        />
      ) : (
        <>
          <div className="space-y-2.5 p-3 sm:hidden">
            {visibleUsers.map((user) => (
              <article
                key={user._id}
                className="portal-card relative overflow-hidden rounded-xl border border-line/80 bg-card-alt/35 p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] text-sm font-semibold text-white shadow-[var(--glow-brand)]">
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-on">
                          {user.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-on-muted">
                          {user.email}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {getRoleBadge(user.role, user.organizerAccess)}
                      </div>
                    </div>

                    <p className="mt-1.5 text-xs text-on-muted">
                      {user.role === "student" ? academicSummary(user) : "Staff account"}
                    </p>

                    {user.role === "student" && isFaceLocked(user) && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                        <FaShieldAlt className="text-[9px]" />
                        Face locked
                      </span>
                    )}

                    {renderUserActions(user)}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <table className="data-table hidden table-fixed sm:table">
            <colgroup>
              <col />
              <col className="w-[150px]" />
              <col className="w-[186px]" />
              <col className="w-[68px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th>Name / Email</th>
                <th>Role</th>
                <th>Program · Year · Section</th>
                <th
                  className="text-right"
                  style={{ paddingLeft: 8, paddingRight: 8 }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] text-xs font-semibold text-white">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-on" title={user.name}>
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-on-muted" title={user.email}>
                          {user.email}
                        </p>
                        {user.role === "student" && isFaceLocked(user) && (
                          <span className="mt-0.5 inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                            Face locked
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{getRoleBadge(user.role, user.organizerAccess)}</td>
                  <td>
                    <p className="truncate text-on-dim" title={user.role === "student" ? academicSummary(user) : undefined}>
                      {user.role === "student" ? academicSummary(user) : "—"}
                    </p>
                  </td>
                  <td style={{ paddingLeft: 8, paddingRight: 8 }}>
                    {renderUserActions(user, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      </div>
      </StablePage>
    </Card>
  );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People & access"
        title="Manage users"
        subtitle={`${users.length} accounts · ${studentCount} students · ${staffCount} with staff access`}
      />

      {message && (
        <div
          className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}
          role="status"
        >
          <span aria-hidden="true">{messageType === "error" ? "!" : "✓"}</span>
          <p>{message}</p>
        </div>
      )}

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: "users", label: "Users", count: users.length },
          { key: "advancement", label: "Year levels" },
          { key: "terms", label: "School terms" },
        ]}
      />

      {activeTab === "users" ? (
        <>
          <Card padding="sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <label htmlFor="manage-user-search" className="field-label">Search accounts</label>
                <input id="manage-user-search" type="search" className="field" placeholder="Search name or email..." value={search} onChange={event => { setSearch(event.target.value); setDirectoryPage(1); }} />
              </div>
              <div className="w-full sm:w-56">
                <label htmlFor="manage-user-role" className="field-label">Filter</label>
                <select id="manage-user-role" className="field-select" value={roleFilter} onChange={event => { setRoleFilter(event.target.value); setDirectoryPage(1); }}>
                  <option value="all">All accounts</option>
                  <option value="students">Students</option>
                  <option value="organizers">Organizers</option>
                  <option value="admins">Admins</option>
                </select>
              </div>
            </div>
          </Card>

          {renderDirectory()}
        </>
      ) : activeTab === "terms" ? <AcademicPeriodsSettings /> : (
        <AcademicAdvancement onApplied={() => fetchUsers({ silent: true })} />
      )}

      {showModal && selectedUser && (
        <div role="dialog" aria-modal="true" aria-label="User details" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="portal-card flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--panel-radius)] border border-line bg-card shadow-[var(--elev-3)]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-5">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] text-lg font-semibold text-white">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-xl font-semibold tracking-tight text-on">
                    {selectedUser.name}
                  </h3>
                  <p className="truncate text-sm text-on-dim">{selectedUser.email}</p>
                </div>
              </div>
              <Button
                onClick={() => setShowModal(false)}
                disabled={savingAcademic || demoting || removingCS}
                variant="ghost"
                size="icon"
                aria-label="Close user details"
              >
                <FaTimes />
              </Button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="text-sm text-on-dim">Role:</span>
                {getRoleBadge(selectedUser.role, selectedUser.organizerAccess)}
                <span className="text-sm text-on-dim">
                  Joined {formatDate(selectedUser.createdAt)}
                </span>
                {selectedUser.role === "student" && (
                  <span className="text-sm text-on-dim">
                    Group{" "}
                    <span className="font-medium text-on">
                      {getGroupLabel(selectedUser)}
                    </span>
                  </span>
                )}
              </div>

              {detailNotice && <p role="status" className={`mb-4 rounded-xl border p-3 text-sm ${detailNotice.type === "error" ? "border-danger/30 bg-danger/10 text-danger" : "border-success/30 bg-success/10 text-on"}`}>{detailNotice.text}</p>}
              {selectedUser.role === "student" && (
                <section className="portal-card mb-6 space-y-4 rounded-xl border border-line bg-card-alt/50 p-4">
                  <div>
                    <h4 className="font-medium text-on">Student academic details</h4>
                    <p className="text-sm text-on-dim">Update the student's current program, year level and section.</p>
                  </div>
                  <form onSubmit={saveAcademic} className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[["program", "Program", PROGRAM_OPTIONS], ["yearLevel", "Year level", YEAR_OPTIONS], ["section", "Section", SECTION_OPTIONS]].map(([field, label, options]) => (
                        <label key={field} className="space-y-1 text-sm text-on-dim">
                          <span>{label}</span>
                          <select aria-label={label} required value={academicDraft[field]} disabled={savingAcademic || demoting} onChange={event => setAcademicDraft(previous => ({ ...previous, [field]: event.target.value }))} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-on">
                            <option value="">Select {label.toLowerCase()}</option>
                            {options.map(option => <option key={option} value={option}>{field === "yearLevel" ? `Year ${option}` : option}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                    <Button type="submit" size="sm" disabled={savingAcademic || demoting}>{savingAcademic ? "Saving…" : "Save student details"}</Button>
                  </form>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <div><h4 className="font-medium text-on">Organizer access</h4><p className="text-sm text-on-dim">{selectedUser.organizerAccess ? "This student also has access to the organizer portal." : "Grant this student access to manage departmental events."}</p></div>
                    {selectedUser.organizerAccess
                      ? <Button variant="danger" size="sm" disabled={savingAcademic || demoting || promoting} onClick={() => setDemoteTarget(selectedUser)}>Remove organizer access</Button>
                      : <Button variant="secondary" size="sm" disabled={savingAcademic || demoting || promoting} onClick={() => setPromoteTarget(selectedUser)}>Promote student</Button>}
                  </div>
                </section>
              )}
              {selectedUser.role === "student" && (
                <div className="portal-card mb-6 flex flex-col gap-4 rounded-xl border border-line bg-card-alt/50 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                      <FaShieldAlt />
                    </span>
                    <div>
                      <p className="font-medium text-on">Face verification</p>
                      <p className="text-sm text-on-dim">
                        {faceStatusLoading ? "Checking enrollment..." : faceStatusError || typeof selectedUser.faceEnrolled !== "boolean" ? "Enrollment status unavailable" : selectedUser.faceEnrolled ? "Face enrolled" : "Face not enrolled"}
                      </p>
                      {isFaceLocked(selectedUser) ? (
                        <p className="mt-0.5 text-sm font-medium text-danger">
                          Locked until {formatDateTime(selectedUser.faceLockUntil)}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm text-on-muted">Not locked</p>
                      )}
                    </div>
                  </div>
                  {!faceStatusLoading && !faceStatusError && selectedUser.faceEnrolled && (
                    <Button variant="danger" size="sm" onClick={() => setFaceResetTarget(selectedUser)}>
                      Reset face enrollment
                    </Button>
                  )}
                  {isFaceLocked(selectedUser) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setUnlockTarget(selectedUser)}
                    >
                      <FaUnlock className="text-[11px]" />
                      Unlock face verification
                    </Button>
                  )}
                </div>
              )}

              {selectedUser.role === "student" && (
                <section className="mb-6 space-y-3 rounded-xl border border-brand/25 bg-brand/5 p-4" aria-label="Overall community service">
                  <div><h4 className="font-medium text-on">Overall service balance</h4><p className="text-sm text-on-dim">Total hours remaining across all events.</p></div>
                  <p className="text-3xl font-semibold tabular-nums text-on">{attendanceLoading || attendanceError ? "—" : totalServiceHours} <span className="text-sm font-normal text-on-dim">hrs</span></p>
                  <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); requestServiceUpdate(serviceDraft); }}>
                    <label className="text-sm text-on-dim"><span className="mb-1 block">New overall total (hrs)</span><input aria-label="New overall total (hrs)" type="number" min="0" step="any" required value={serviceDraft} onChange={event => setServiceDraft(event.target.value)} disabled={attendanceLoading || !!attendanceError || removingCS} className="field w-32" /></label>
                    <Button type="submit" size="sm" disabled={attendanceLoading || !!attendanceError || removingCS || !userAttendance.length || Number(serviceDraft) === totalServiceHours}>Set total</Button>
                    <Button type="button" variant="danger" size="sm" disabled={attendanceLoading || !!attendanceError || removingCS || totalServiceHours <= 0} onClick={() => requestServiceUpdate(0)}>Clear balance</Button>
                  </form>
                  <p className="text-xs text-on-muted">Adjustments keep the event history. Reductions apply to the oldest outstanding hours first.</p>
                </section>
              )}
              <h4 className="panel-heading text-base">Attendance history ({userAttendance.length})</h4>
              <p className="mt-1 text-sm text-on-dim">Event penalties and remaining hours are shown below.</p>
              {attendanceLoading ? <p className="py-4 text-sm text-on-dim" role="status">Loading attendance…</p> : attendanceError ? <p role="alert" className="py-4 text-sm text-danger">{attendanceError}</p> : userAttendance.length === 0 ? (
                <EmptyState compact icon={<FaUsers />} title="No attendance records" description="This account has not checked in to any event yet." />
              ) : (
                <>
                  <div className="mt-3 space-y-2">
                    {visibleAttendance.map(record => {
                      const penalties = (record.communityServiceLog || []).filter(entry => entry.action === "penalty" || entry.action === "restored").reduce((sum, entry) => sum + (entry.hours || 0), 0);
                      const penaltyHours = Math.max(penalties, record.communityServiceHours || 0);
                      return (
                        <div key={record._id} data-testid="attendance-history-record" className="portal-card flex flex-col gap-2 rounded-xl border border-line bg-card-alt/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words font-medium text-on">{record.event?.title || record.eventTitle || "Event"}</p>
                            <p className="text-sm text-on-dim">{(record.event?.date || record.eventDate) && formatDate(record.event?.date || record.eventDate)}</p>
                            {penaltyHours > 0 && <p className="text-sm text-warn">{penaltyHours} penalty hrs added <span className="text-on-dim">· {record.communityServiceHours || 0} hrs remaining</span></p>}
                            {(record.communityServiceLog || []).some(entry => entry.note?.startsWith("Overall balance adjusted")) && <p className="text-xs text-on-muted">Includes an overall balance adjustment</p>}
                          </div>
                          <StatusChip status={record.status} />
                        </div>
                      );
                    })}
                  </div>
                  <Pagination page={currentAttendancePage} pageSize={5} total={userAttendance.length} onChange={setAttendancePage} label="Student attendance history pages" />
                </>
              )}

              {selectedUser.role !== "admin" && (
                <section
                  aria-label="Delete account"
                  className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
                >
                  <div>
                    <h4 className="font-medium text-on">Delete this account</h4>
                    <p className="text-sm text-on-dim">
                      Permanently removes the account and its attendance records.
                      This cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={savingAcademic || demoting || removingCS}
                    onClick={() => setDeleteTarget(selectedUser._id)}
                  >
                    <FaTrash className="text-[11px]" />
                    Delete account
                  </Button>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingRemoveCS}
        title="Update overall service balance?"
        message={pendingRemoveCS ? `Change this student's overall balance from ${pendingRemoveCS.previous} to ${pendingRemoveCS.target} hours across all events? Their attendance and penalty history will be retained.` : ""}
        confirmLabel="Update balance"
        onConfirm={confirmRemoveCS}
        onCancel={() => setPendingRemoveCS(null)}
        busy={removingCS}
      />

      <ConfirmDialog open={!!faceResetTarget} title="Reset face enrollment?"
        message={`Confirm the identity of ${faceResetTarget?.name || "this student"} before resetting. Their saved face will be removed and attendance will require manual check-in until they enroll again.`}
        confirmLabel="Reset face" variant="danger" busy={resettingFace}
        onConfirm={resetFace} onCancel={() => setFaceResetTarget(null)} />
      <ConfirmDialog open={!!promoteTarget} title="Grant organizer access?" message={`${promoteTarget?.name || "This student"} will gain access to manage events, operate face stations, and review other students' excuse letters. Their student portal and records will stay available.`} confirmLabel="Promote student" busy={promoting} onConfirm={promoteStudent} onCancel={() => setPromoteTarget(null)} />
      <ConfirmDialog open={!!demoteTarget} title="Remove organizer access?" message={`${demoteTarget?.name || "This student"} will lose organizer access and their face stations will close. Their student account, face enrollment, attendance and community service ledger will remain available.`} confirmLabel="Remove organizer access" busy={demoting} onConfirm={demoteStudent} onCancel={() => setDemoteTarget(null)} />
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
          setShowModal(false);
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


    </div>
  );
};

export default ManageUsers;
