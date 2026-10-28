import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import {
  FaCheck,
  FaTimes,
  FaEye,
  FaFilter,
  FaShieldAlt,
  FaTrash,
  FaUnlock,
  FaUsers,
  FaUserGraduate,
  FaUserTie,
} from "react-icons/fa";
import PrivateImage from "../shared/PrivateImage";
import EmptyState from "../shared/EmptyState";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  Button,
  Card,
  PageHeader,
  StatTile,
  StatusChip,
  TableSkeleton,
  Tabs,
} from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import Pagination from "../ui/Pagination";
import { formatDate, formatDateTime } from "../../utils/helpers";

const roleStyles = {
  admin: "border-brand/25 bg-brand/10 text-brand",
  organizer: "border-warn/25 bg-warn/10 text-warn",
  student: "border-info/25 bg-info/10 text-info",
};

const PROGRAM_OPTIONS = ["BSEMC", "BSIT", "BSCS", "BSIS", "IT", "OTHER"];
const YEAR_OPTIONS = [1, 2, 3, 4];
const SECTION_OPTIONS = ["A", "B", "C"];

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [academicDraft, setAcademicDraft] = useState({ program: "", yearLevel: "", section: "" });
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [detailNotice, setDetailNotice] = useState(null);
  const [demoteTarget, setDemoteTarget] = useState(null);
  const [demoting, setDemoting] = useState(false);

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
      setDetailNotice({ type: "success", text: "Student academic details updated." });
    } catch (error) {
      setDetailNotice({ type: "error", text: error.response?.data?.message || "Could not update academic details. Please try again." });
    } finally { setSavingAcademic(false); }
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
      const cleared = { ...faceResetTarget, facePhoto: "", faceEnrolledAt: null, faceConsentAt: null };
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
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [pendingRemoveCS, setPendingRemoveCS] = useState(null);
  const [removingCS, setRemovingCS] = useState(false);
  const totalServiceHours = userAttendance.reduce((total, record) => total + (record.communityServiceHours || 0), 0);
  const attendancePages = Math.max(1, Math.ceil(userAttendance.length / 5));
  const currentAttendancePage = Math.min(attendancePage, attendancePages);
  const visibleAttendance = userAttendance.slice((currentAttendancePage - 1) * 5, currentAttendancePage * 5);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "appeals" ? "appeals" : "users";
  const setActiveTab = tab => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (tab === "appeals") next.set("tab", "appeals"); else next.delete("tab");
    return next;
  }, { replace: true });
  const [appeals, setAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingAppeal, setReviewingAppeal] = useState(false);
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
    if (reviewingAppeal) return;
    setReviewingAppeal(true);
    try {
      const res = await api.post(`/admin/security/face-appeals/${appeal._id}/review`, {
        action,
        note: action === "rejected" ? reviewNote : "",
      });
      setAppeals((prev) => prev.map((a) => (a._id === appeal._id ? res.data.appeal : a)));
      setReviewTarget(null);
      setReviewNote("");
      setMessage(res.data.message || `Appeal ${action}`);
      setMessageType("success");
      if (action === "approved" && appeal.student?._id) {
        setUsers((prev) =>
          prev.map((u) =>
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
    } finally {
      setReviewingAppeal(false);
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
    const res = await api.get("/reports/attendance");
    const userRecords = res.data.records.filter(record => record.student?._id === user._id || record.student === user._id);
    setUserAttendance(userRecords);
    setServiceDraft(String(userRecords.reduce((total, record) => total + (record.communityServiceHours || 0), 0)));
  };

  const openUserDetails = async (user) => {
    setSelectedUser(user);
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

  const hasActiveFilters =
    searchTerm ||
    programFilter !== "all" ||
    yearFilter !== "all" ||
    sectionFilter !== "all";

  const activeFilterCount =
    (searchTerm ? 1 : 0) +
    (programFilter !== "all" ? 1 : 0) +
    (yearFilter !== "all" ? 1 : 0) +
    (sectionFilter !== "all" ? 1 : 0);

  const resetFilters = () => {
    setSearchTerm("");
    setProgramFilter("all");
    setYearFilter("all");
    setSectionFilter("all");
  };

  const staffUsers = users.filter(
    (user) => user.role === "admin" || user.role === "organizer" || user.organizerAccess === true
  );
  const studentUsers = users.filter((user) => {
    if (user.role !== "student" || user.organizerAccess === true) return false;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term);
    const matchesProgram =
      programFilter === "all" ||
      String(user.program || "").toUpperCase() === programFilter;
    const matchesYear =
      yearFilter === "all" ||
      String(user.yearLevel) === String(yearFilter);
    const matchesSection =
      sectionFilter === "all" ||
      String(user.section || "").toUpperCase() === sectionFilter;
    return matchesSearch && matchesProgram && matchesYear && matchesSection;
  });

  const getRoleBadge = (role, organizerAccess = false) => (
    <span
      className={`inline-flex whitespace-nowrap items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
        roleStyles[role] || roleStyles.student
      }`}
    >
      {role === "student" && organizerAccess ? "Student/Organizer" : role}
    </span>
  );

  const renderUserActions = (user, compact = false) => {
    const showUnlock = user.role === "student" && isFaceLocked(user);
    const actionCount =
      1 +
      (showUnlock ? 1 : 0) +
      (user.role !== "admin" ? 1 : 0);

    if (compact) {
      return (
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
          {showUnlock && (
            <Button
              onClick={() => setUnlockTarget(user)}
              variant="secondary"
              size="icon"
              style={{ width: 28, height: 28 }}
              title="Clear face-verification lockout"
              aria-label={`Unlock face verification for ${user.name}`}
            >
              <FaUnlock className="text-[11px]" />
            </Button>
          )}
          {user.role !== "admin" && (
            <Button
              onClick={() => setDeleteTarget(user._id)}
              variant="danger"
              size="icon"
              style={{ width: 28, height: 28 }}
              title="Delete account"
              aria-label={`Delete ${user.name}`}
            >
              <FaTrash className="text-[11px]" />
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={() => openUserDetails(user)}
          variant="secondary"
          size="sm"
          className={`w-full ${actionCount === 1 ? "col-span-2" : ""}`}
        >
          <FaEye className="text-[11px]" />
          View
        </Button>
        {showUnlock && (
          <Button
            onClick={() => setUnlockTarget(user)}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            <FaUnlock className="text-[11px]" />
            Unlock
          </Button>
        )}
        {user.role !== "admin" && (
          <Button
            onClick={() => setDeleteTarget(user._id)}
            variant="danger"
            size="sm"
            className={`w-full ${actionCount === 3 ? "col-span-2" : ""}`}
          >
            <FaTrash className="text-[11px]" />
            Delete
          </Button>
        )}
      </div>
    );
  };

  const renderUserTable = (
    list,
    {
      title,
      subtitle,
      emptyTitle,
      showGroup = false,
      filters = null,
      filtersId,
      filtersOpen = false,
      onToggleFilters,
      activeFilterCount = 0,
    }
  ) => (
    <Card padding="none" className="flex h-[34rem] min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-on">{title}</h2>
          <p className="text-xs text-on-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {onToggleFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleFilters}
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
            >
              <FaFilter aria-hidden="true" />
              {filtersOpen ? "Hide filters" : "Filters"}
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-brand/10 px-1.5 text-[10px] font-semibold text-brand">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}
          <span className="rounded-full border border-line bg-card-alt px-2.5 py-0.5 text-xs font-medium text-on-dim">
            {list.length}
          </span>
        </div>
      </div>

      {filters && filtersOpen && (
        <div
          id={filtersId}
          className="border-b border-line bg-card-alt/40 px-4 py-3"
        >
          {filters}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
        <div className="p-4">
          <TableSkeleton rows={4} />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<FaUsers />}
          title={emptyTitle}
          description={
            showGroup
              ? "Try a different search term or filter."
              : "Staff accounts will appear here once created."
          }
        />
      ) : (
        <>
          <div className="space-y-2.5 p-3 sm:hidden">
            {list.map((user) => (
              <article
                key={user._id}
                className="relative overflow-hidden rounded-xl border border-line/80 bg-card-alt/35 p-3.5"
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
                        {showGroup ? (
                          <span className="inline-flex items-center rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                            {getGroupLabel(user)}
                          </span>
                        ) : (
                          getRoleBadge(user.role, user.organizerAccess)
                        )}
                      </div>
                    </div>

                    {showGroup && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10px] font-medium text-on-dim">
                          {user.program || "No program"}
                        </span>
                        <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10px] font-medium text-on-dim">
                          Year {user.yearLevel ?? "?"}
                        </span>
                        <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10px] font-medium text-on-dim">
                          Section {user.section || "?"}
                        </span>
                      </div>
                    )}

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
              <col className={showGroup ? "w-[128px]" : "w-[152px]"} />
              <col className="w-[156px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th>Name / Email</th>
                {showGroup ? <th>Academic group</th> : <th>Role</th>}
                <th
                  className="text-right"
                  style={{ paddingLeft: 8, paddingRight: 8 }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((user) => (
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
                  <td>
                    {showGroup ? (
                      <div>
                        <p className="text-on-dim">{getGroupLabel(user)}</p>
                        <p className="truncate text-xs text-on-muted">
                          {user.program || "?"} · Year {user.yearLevel ?? "?"} · Section{" "}
                          {user.section || "?"}
                        </p>
                      </div>
                    ) : (
                      getRoleBadge(user.role, user.organizerAccess)
                    )}
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
    </Card>
  );

  const stats = {
    total: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    organizer: users.filter((u) => u.role === "organizer" || (u.role === "student" && u.organizerAccess === true)).length,
    student: users.filter((u) => u.role === "student" && u.organizerAccess !== true).length,
  };

  const pendingCount = appeals.filter((a) => a.status === "pending").length;

  const studentFilters = (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="col-span-2">
        <label htmlFor="user-search" className="field-label">
          Search students
        </label>
        <input
          id="user-search"
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="field"
        />
      </div>

      <div className="min-w-0">
        <label htmlFor="user-program-filter" className="field-label">
          Program
        </label>
        <select
          id="user-program-filter"
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          className="field-select"
        >
          <option value="all">All programs</option>
          {PROGRAM_OPTIONS.map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label htmlFor="user-year-filter" className="field-label">
          Year level
        </label>
        <select
          id="user-year-filter"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="field-select"
        >
          <option value="all">All years</option>
          {YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>
              Year {year}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label htmlFor="user-section-filter" className="field-label">
          Section
        </label>
        <select
          id="user-section-filter"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="field-select"
        >
          <option value="all">All sections</option>
          {SECTION_OPTIONS.map((section) => (
            <option key={section} value={section}>
              Section {section}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 items-end">
        <Button
          variant="secondary"
          size="lg"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
          className="w-full"
        >
          Reset filters
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People & access"
        title="Manage users"
        subtitle={`${stats.total} accounts`}
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
          { key: "appeals", label: "Face appeals", count: pendingCount || undefined },
        ]}
      />

      {activeTab === "users" ? (
        <>
          <div
            role="note"
            aria-label="User action icon guide"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--panel-radius)] border border-line bg-card-alt/40 px-4 py-3 text-xs text-on-dim"
          >
            <span className="font-semibold uppercase tracking-[0.12em] text-on-muted">
              Action guide
            </span>
            <span className="inline-flex items-center gap-2">
              <FaEye className="text-[11px] text-brand" aria-hidden="true" />
              View user details and attendance
            </span>

          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Total accounts" value={stats.total} icon={<FaUsers />} />
            <StatTile
              label="Admins"
              value={stats.admin}
              icon={<FaShieldAlt />}
              tone="ok"
            />
            <StatTile
              label="Organizers"
              value={stats.organizer}
              icon={<FaUserTie />}
              tone="warn"
            />
            <StatTile
              label="Students"
              value={stats.student}
              icon={<FaUserGraduate />}
              tone="info"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {renderUserTable(staffUsers, {
              title: "Admin & Event Organizers",
              subtitle: "Admins and accounts with organizer access",
              emptyTitle: "No admin or organizer accounts found",
            })}

            {renderUserTable(studentUsers, {
              title: "Students",
              subtitle: "Accounts with student access only",
              emptyTitle: "No students found",
              showGroup: true,
              filters: studentFilters,
              filtersId: "student-user-filters",
              filtersOpen,
              onToggleFilters: () => setFiltersOpen((open) => !open),
              activeFilterCount,
            })}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-on-dim">
            {pendingCount} pending · {appeals.length} total appeals
          </p>
          {appealsLoading ? (
            <Card>
              <TableSkeleton rows={4} />
            </Card>
          ) : appeals.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FaShieldAlt />}
                title="No face verification appeals"
                description="Appeals submitted by students will appear here for review."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {appeals.map((appeal) => (
                <Card key={appeal._id} as="article">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-on">
                        {appeal.student?.name || "Unknown student"}
                      </p>
                      <p className="truncate text-sm text-on-dim">{appeal.student?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isFaceLocked(appeal.student) && (
                        <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-[11px] font-medium text-danger">
                          Face locked
                        </span>
                      )}
                      <StatusChip status={appeal.status} />
                    </div>
                  </div>

                  {appeal.note && (
                    <p className="mb-4 rounded-xl border border-line bg-card-alt/40 px-3.5 py-2.5 text-sm text-on-dim">
                      &quot;{appeal.note}&quot;
                    </p>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-on-muted">
                        Proof photo (submitted)
                      </p>
                      <PrivateImage
                        src={appeal.photoUrl}
                        alt="Proof"
                        className="aspect-[4/3] w-full rounded-xl border border-line object-cover"
                      />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-on-muted">
                        Enrolled face photo
                      </p>
                      {appeal.student?.facePhoto ? (
                        <PrivateImage
                          src={appeal.student.facePhoto}
                          alt="Enrolled face"
                          className="aspect-[4/3] w-full rounded-xl border border-line object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-line bg-card-alt text-sm text-on-muted">
                          No face enrolled
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-on-muted">
                    Submitted {formatDateTime(appeal.createdAt)}
                  </p>

                  {appeal.status === "pending" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setReviewNote("");
                          setReviewTarget({ appeal, action: "approved" });
                        }}
                      >
                        <FaCheck className="text-xs" /> Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setReviewNote("");
                          setReviewTarget({ appeal, action: "rejected" });
                        }}
                      >
                        <FaTimes className="text-xs" /> Reject
                      </Button>
                    </div>
                  )}

                  {appeal.status !== "pending" && appeal.responseNote && (
                    <p className="mt-3 text-sm text-on-dim">
                      <span className="font-medium text-on">Admin note:</span>{" "}
                      {appeal.responseNote}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && selectedUser && (
        <div role="dialog" aria-modal="true" aria-label="User details" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--panel-radius)] border border-line bg-card shadow-[var(--elev-3)]">
            <div className="flex items-start justify-between gap-3 border-b border-line p-5">
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
            <div className="overflow-y-auto p-5">
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
                <section className="mb-6 space-y-4 rounded-xl border border-line bg-card-alt/50 p-4">
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
                  {selectedUser.organizerAccess && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                      <div><h4 className="font-medium text-on">Organizer access</h4><p className="text-sm text-on-dim">This student also has access to the organizer portal.</p></div>
                      <Button variant="danger" size="sm" disabled={savingAcademic || demoting} onClick={() => setDemoteTarget(selectedUser)}>Remove organizer access</Button>
                    </div>
                  )}
                </section>
              )}
              {selectedUser.role === "student" && (
                <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-card-alt/50 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                      <FaShieldAlt />
                    </span>
                    <div>
                      <p className="font-medium text-on">Face verification</p>
                      <p className="text-sm text-on-dim">
                        {selectedUser.facePhoto
                          ? "Face photo enrolled"
                          : "No face photo enrolled"}
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
                  {selectedUser.facePhoto && (
                    <PrivateImage
                      src={selectedUser.facePhoto}
                      alt="Enrolled face"
                      className="h-16 w-16 rounded-xl border border-line object-cover sm:ml-auto"
                    />
                  )}
                  {selectedUser.facePhoto && (
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
                        <div key={record._id} data-testid="attendance-history-record" className="flex flex-col gap-2 rounded-xl border border-line bg-card-alt/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
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
        confirmLabel={reviewTarget?.action === "approved" ? "Approve" : "Reject"}
        cancelLabel="Cancel"
        variant={reviewTarget?.action === "approved" ? "default" : "danger"}
        busy={reviewingAppeal}
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
            className="field mt-3"
          />
        )}
      </ConfirmDialog>
    </div>
  );
};

export default ManageUsers;
