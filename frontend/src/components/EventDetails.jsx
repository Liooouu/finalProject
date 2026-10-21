import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getUserRole, getUserFromToken } from "../utils/auth";
import {
  formatTime12Hour,
  formatDate,
  formatDateTime,
  isTerminalStatus,
  describeEventLifecycle,
} from "../utils/helpers";
import {
  FaCheck,
  FaEdit,
  FaTrash,
  FaUndo,
  FaExclamationTriangle,
  FaUsers,
} from "react-icons/fa";
import Loading from "./shared/Loading";
import { BsClipboardCheck } from "react-icons/bs";
import { QRCodeSVG } from "qrcode.react";
import QRScanner from "./organizer/QRScanner";
import { usePageMeta } from "../context/PageMetaContext";
import { Button, Card, StatusChip } from "./ui";
import EventMap from "./shared/EventMap";
import MapPicker from "./shared/MapPicker";
import EmptyState from "./shared/EmptyState";
import ConfirmDialog from "./ui/ConfirmDialog";

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [myAttendance, setMyAttendance] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [role, setRole] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [canManageAttendance, setCanManageAttendance] = useState(false);
  const [qrRefreshKey, setQrRefreshKey] = useState(0);
  const [studentId, setStudentId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingRemoveCS, setPendingRemoveCS] = useState(null);
  const [removingCS, setRemovingCS] = useState(false);
  const [csDrafts, setCsDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");
  // Class filter: built from the program dropdown plus the year and section
  // inputs (e.g. BSIT + 1 + A -> "BSIT-1A"). Stays "all" until all three are
  // filled, so the full attendee list shows before a class is picked.
  const selectedGroup =
    program && yearLevel && section.trim()
      ? `${program}-${yearLevel}${section.trim().toUpperCase()}`
      : "all";

  usePageMeta(event?.title || "Event", event?.date
    ? formatDate(event.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "Event details");

  useEffect(() => {
    setRole(getUserRole());
    const user = getUserFromToken();
    if (user) setStudentId(user.id);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setQrRefreshKey((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const refreshAttendees = useCallback(async () => {
    try {
      const attendeesRes = await api.get(`/events/${id}/attendees`);
      setAttendees(attendeesRes.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      const currentRole = getUserRole();
      const currentUser = getUserFromToken();
      let eventData;

      try {
        const eventRes = await api.get(`/events/${id}`);
        eventData = eventRes.data;
        setEvent(eventData);
        setEditForm({
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          mapQuery: eventData.mapQuery || "",
          date: eventData.date ? new Date(eventData.date).toISOString().split("T")[0] : "",
          time: eventData.time,
          endDate: eventData.endDate ? new Date(eventData.endDate).toISOString().split("T")[0] : "",
          endTime: eventData.endTime || "",
          status: eventData.status,
          attendanceStartTime: eventData.attendanceStartTime || "",
          attendanceEndTime: eventData.attendanceEndTime || "",
        });
      } catch (err) {
        console.error(err.response?.data || err.message);
        setMessage("Failed to load event details");
        setMessageType("error");
        setLoading(false);
        return;
      }

      const ownerId = eventData.organizer?._id || eventData.organizer;
      const mayManage =
        currentRole === "admin" ||
        (currentRole === "organizer" &&
          ((currentUser?.id &&
            ownerId &&
            String(ownerId) === String(currentUser.id)) ||
            eventData.organizer?.role === "admin"));
      const mayManageAttendance = mayManage;
      setCanManage(Boolean(mayManage));
      setCanManageAttendance(Boolean(mayManageAttendance));

      try {
        if (mayManageAttendance) {
          const attendeesRes = await api.get(`/events/${id}/attendees`);
          setAttendees(attendeesRes.data);
        } else if (currentRole === "student") {
          const myAttendances = await api.get("/events/my-attendance");
          const found = myAttendances.data.find((a) => a.event?._id === id || a.event === id);
          setMyAttendance(found || null);
        }
      } catch (err) {
        console.error(err.response?.data || err.message);
        setMessage("Failed to load attendance details");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Student: while the QR is showing, keep checking whether the organizer has
  // scanned it. When attendance is recorded (present/late), return to the
  // dashboard automatically with a confirmation toast.
  useEffect(() => {
    if (role !== "student" || !id || !event || myAttendance) return;
    let cancelled = false;
    let intervalId = null;

    const checkAttendance = async () => {
      try {
        const res = await api.get("/events/my-attendance");
        if (cancelled) return;
        const found = res.data.find(
          (a) => a.event?._id === id || a.event === id
        );
        if (found && (found.status === "present" || found.status === "late")) {
          setMyAttendance(found);
          if (intervalId) clearInterval(intervalId);
          navigate("/student/dashboard", {
            replace: true,
            state: { trackedToast: "Attendance successfully recorded!" },
          });
        }
      } catch {
        // transient blip – keep polling
      }
    };

    checkAttendance();
    intervalId = setInterval(checkAttendance, 4000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [role, id, event, myAttendance, navigate]);

  const handleUpdateStatus = async (stdId, status) => {
    try {
      const res = await api.patch(`/events/${id}/attendees/${stdId}`, { status });
      setAttendees((prev) => prev.map((a) => (a._id === res.data._id ? res.data : a)));
      setMessage("Status updated");
      setMessageType("success");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update status");
      setMessageType("error");
    }
  };

  const handleUpdateCS = async (stdId, val) => {
    const hours = Number(val);
    if (!Number.isFinite(hours) || hours < 0) return;
    try {
      const res = await api.patch(`/events/${id}/attendees/${stdId}/community-service`, { hours });
      setAttendees((prev) => prev.map((a) => (a._id === res.data._id ? res.data : a)));
      setCsDrafts((d) => ({ ...d, [stdId]: hours }));
      setMessage(`Community service hours set to ${hours} hrs`);
      setMessageType("success");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update service hours");
      setMessageType("error");
    }
  };

  const confirmRemoveCS = async () => {
    const attendance = pendingRemoveCS;
    if (!attendance || removingCS) return;
    setRemovingCS(true);
    const stdId = attendance.student?._id || attendance.student;
    try {
      const res = await api.patch(
        `/events/${id}/attendees/${stdId}/community-service/remove`,
        { hours: attendance.communityServiceHours || 0 }
      );
      const remaining = res.data.communityServiceHours || 0;
      setAttendees((prev) => prev.map((a) => (a._id === res.data._id ? res.data : a)));
      setCsDrafts((d) => ({ ...d, [stdId]: String(remaining) }));
      setMessage("Community service hours removed");
      setMessageType("success");
      setPendingRemoveCS(null);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to remove service hours");
      setMessageType("error");
    } finally {
      setRemovingCS(false);
    }
  };

  const getStudentKey = (s) => {
    if (!s) return "unassigned";
    const p = String(s.program || "").trim().toUpperCase();
    const y = s.yearLevel != null ? String(s.yearLevel) : "";
    const sec = String(s.section || "").trim().toUpperCase();
    if (p && y && sec) return `${p}-${y}${sec}`;
    if (p || y || sec) return "partial";
    return "unassigned";
  };

  const filteredAttendees = (role === "organizer" || role === "admin")
    ? attendees.filter((a) => {
        if (selectedGroup === "all") return true;
        return getStudentKey(a.student) === selectedGroup;
      })
    : attendees;

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleMapPick = (v) => {
    setEditForm({ ...editForm, location: v, mapQuery: v });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.put(`/events/${id}`, editForm);
      setEvent(res.data);
      setIsEditing(false);
      setMessage("Event updated successfully!");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await api.patch(`/events/${id}/status`, { status: newStatus });
      setEvent({
        ...event,
        status: res.data.status,
        manualOverride: res.data.manualOverride,
        autoFinishedAt: res.data.autoFinishedAt,
      });
      setMessage(
        newStatus === "upcoming"
          ? "Event reopened. It will finish again at its end time."
          : "Status updated! Automatic status changes are paused for this event."
      );
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update status");
    }
  };

  // Hands the event back to the background job without touching the status.
  const handleResumeAuto = async () => {
    try {
      const res = await api.patch(`/events/${id}/automation`, { enabled: true });
      setEvent({ ...event, manualOverride: res.data.manualOverride });
      setMessage("Automatic status changes are back on for this event.");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to resume automatic status");
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      await api.delete(`/events/${id}`);
      navigate(-1);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to delete event");
    }
  };

  const getQRData = () => {
    if (!event || !studentId) return null;
    return JSON.stringify({
      eventId: event._id,
      studentId: studentId,
      timestamp: Date.now(),
    });
  };

  if (loading) {
    return <Loading />;
  }

  if (!event) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-on">Event not found</p>
        <button onClick={() => navigate(-1)} className="mt-2 text-indigo-600 underline hover:text-indigo-500 dark:text-indigo-400">
          Go back
        </button>
      </div>
    );
  }

  const ownerId = event.organizer?._id || event.organizer;
  const canDelete =
    role === "admin" ||
    Boolean(
      role === "organizer" &&
        studentId &&
        ownerId &&
        String(ownerId) === String(studentId)
    );

  const isBeforeAttendanceWindow = () => {
    if (!event.attendanceStartTime) return false;
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
    return currentTime < event.attendanceStartTime;
  };

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-on-dim transition-colors hover:text-on"
      >
        <span aria-hidden="true">←</span> Back
      </button>

      <Card className="overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Event details</p>
              <StatusChip status={event.status} />
            </div>
            <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-on sm:text-[30px]">
              {event.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-dim">
              {event.description || "No description"}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-line bg-card-alt/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-muted">
                  Date
                </p>
                <p className="mt-1 text-sm font-semibold text-on">{formatDate(event.date)}</p>
              </div>
              <div className="rounded-xl border border-line bg-card-alt/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-muted">
                  Starts
                </p>
                <p className="mt-1 text-sm font-semibold text-on">
                  {formatTime12Hour(event.time)}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card-alt/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-muted">
                  Ends
                </p>
                <p className="mt-1 text-sm font-semibold text-on">
                  {formatDate(event.endDate || event.date)} at{" "}
                  {formatTime12Hour(event.endTime || event.attendanceEndTime)}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card-alt/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-muted">
                  Location
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-on" title={event.location || "TBA"}>
                  {event.location || "TBA"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-card-alt/50 p-4">
            <p className="eyebrow">Attendance window</p>
            <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-warn">
              <BsClipboardCheck className="shrink-0" />
              {formatTime12Hour(event.attendanceStartTime)} –{" "}
              {formatTime12Hour(event.attendanceEndTime)}
            </p>
            <p className="mt-1 text-xs text-on-muted">
              Students can only check in during this window.
            </p>
            {event.organizer && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="eyebrow">Organized by</p>
                <p className="mt-1 text-sm font-medium text-on">{event.organizer.name}</p>
              </div>
            )}
          </div>
        </div>

        <EventMap event={event} className="mt-6 h-56 w-full" />
      </Card>

      {/* Message */}
      {message && (
        <div
          className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}
          role="status"
        >
          <span aria-hidden="true">{messageType === "error" ? "!" : "✓"}</span>
          <p>{message}</p>
        </div>
      )}

      {role === "organizer" && !canManageAttendance && (
        <div className="alert alert-info" role="status">
          <span aria-hidden="true">i</span>
          <p>
            This event belongs to {event.organizer?.name || "another organizer"}. You can view
            the details, but only its organizer or an admin can manage attendance.
          </p>
        </div>
      )}

      {/* Student Attendance Section */}
      {role === "student" && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="panel-heading">Attendance</h2>
            {myAttendance && <StatusChip status={myAttendance.status} />}
          </div>

          {myAttendance ? (
            <div className="mt-4 space-y-3">
              <div
                className={`flex items-start gap-3 rounded-xl border p-4 ${
                  myAttendance.status === "absent"
                    ? "border-danger/25 bg-danger/10 text-danger"
                    : myAttendance.status === "late"
                      ? "border-warn/25 bg-warn/10 text-warn"
                      : myAttendance.status === "excused"
                        ? "border-info/25 bg-info/10 text-info"
                        : "border-ok/25 bg-ok/10 text-ok"
                }`}
              >
                <span className="mt-0.5 text-lg">
                  {myAttendance.status === "absent"
                    ? "❌"
                    : myAttendance.status === "late"
                      ? "⏰"
                      : <FaCheck />}
                </span>
                <p className="text-sm font-medium leading-relaxed">
                  {myAttendance.status === "absent"
                    ? "You are marked as absent."
                    : myAttendance.status === "late"
                      ? "You are marked as late."
                      : myAttendance.status === "excused"
                        ? "Your absence has been excused."
                        : "You have marked your attendance."}
                </p>
              </div>
              <p className="text-sm text-on-dim">
                Checked in at:{" "}
                <span className="text-on">{formatDateTime(myAttendance.attendedAt)}</span>
              </p>
              {myAttendance.communityServiceHours > 0 && (
                <p className="flex items-center gap-1.5 text-sm font-medium text-warn">
                  <FaExclamationTriangle /> Community service:{" "}
                  {myAttendance.communityServiceHours} hours
                </p>
              )}
            </div>
          ) : isBeforeAttendanceWindow() ? (
            <div className="alert alert-warn mt-4" role="status">
              <span aria-hidden="true">!</span>
              <p>
                Attendance is not open yet. You can mark your attendance starting at{" "}
                <span className="font-semibold">
                  {formatTime12Hour(event.attendanceStartTime)}
                </span>
                .
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-line bg-card-alt/40 p-5 text-center">
              <p className="text-sm font-medium text-on">
                Show this QR code to the organizer to scan your attendance
              </p>
              <div className="mt-4 flex justify-center">
                {getQRData() && (
                  <div className="w-full max-w-[300px] rounded-2xl bg-white p-4 shadow-sm">
                    <QRCodeSVG
                      key={qrRefreshKey}
                      value={getQRData()}
                      size={300}
                      level="M"
                      includeMargin={false}
                      className="h-auto w-full"
                    />
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-on-muted">
                QR code refreshes every 30 seconds for security.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Organizer Management Section */}
      {(canManage || canManageAttendance) && (
        <div className="space-y-4">
          {/* QR Scanner Card */}
          {canManageAttendance && (
            <QRScanner eventId={id} onScanSuccess={refreshAttendees} />
          )}

          {/* Manage Attendance Button */}
          {canManageAttendance && (
            <Button
              onClick={() =>
                navigate(
                  role === "admin"
                    ? `/admin/dashboard/events/${id}/attendees`
                    : `/organizer/dashboard/events/${id}/attendees`
                )
              }
              className="w-full"
            >
              <FaUsers /> Manage attendance manually
            </Button>
          )}

          {/* Event Management Card */}
          {canManage && (
            <Card>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="panel-heading text-base">Event management</h2>
                <p className="mt-1 text-sm text-on-dim">
                  Update details or status
                  {canDelete ? ", or remove this event." : "."}
                </p>
              </div>
              {!isEditing && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="secondary"
                    size="sm"
                  >
                    <FaEdit /> Edit event
                  </Button>
                  {canDelete && (
                    <Button
                      onClick={() => setConfirmDelete(true)}
                      variant="danger"
                      size="sm"
                    >
                      <FaTrash /> Delete
                    </Button>
                  )}
                </div>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label htmlFor="ed-title" className="field-label">
                    Title
                  </label>
                  <input
                    id="ed-title"
                    type="text"
                    name="title"
                    value={editForm.title}
                    onChange={handleEditChange}
                    className="field"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ed-description" className="field-label">
                    Description
                  </label>
                  <textarea
                    id="ed-description"
                    name="description"
                    value={editForm.description}
                    onChange={handleEditChange}
                    rows={3}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="ed-location" className="field-label">
                    Location
                  </label>
                  <input
                    id="ed-location"
                    type="text"
                    name="location"
                    value={editForm.location}
                    onChange={handleEditChange}
                    placeholder="Location"
                    className="field"
                  />
                </div>
                <MapPicker
                  value={editForm.mapQuery}
                  onChange={handleMapPick}
                  className="h-64"
                />

                <div className="border-t border-line pt-4">
                  <h3 className="text-sm font-semibold text-on">Event starts</h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ed-date" className="field-label">
                        Start date
                      </label>
                      <input
                        id="ed-date"
                        type="date"
                        name="date"
                        value={editForm.date}
                        onChange={handleEditChange}
                        className="field-datetime"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="ed-time" className="field-label">
                        Start time
                      </label>
                      <input
                        id="ed-time"
                        type="time"
                        name="time"
                        value={editForm.time}
                        onChange={handleEditChange}
                        className="field-datetime"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <h3 className="text-sm font-semibold text-on">Attendance window</h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ed-att-start" className="field-label">
                        Opens
                      </label>
                      <input
                        id="ed-att-start"
                        type="time"
                        name="attendanceStartTime"
                        value={editForm.attendanceStartTime}
                        onChange={handleEditChange}
                        className="field-datetime"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="ed-att-end" className="field-label">
                        Closes
                      </label>
                      <input
                        id="ed-att-end"
                        type="time"
                        name="attendanceEndTime"
                        value={editForm.attendanceEndTime}
                        onChange={handleEditChange}
                        className="field-datetime"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <h3 className="text-sm font-semibold text-on">Event ends</h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ed-end-date" className="field-label">
                        End date
                      </label>
                      <input
                        id="ed-end-date"
                        type="date"
                        name="endDate"
                        value={editForm.endDate || ""}
                        onChange={handleEditChange}
                        className="field-datetime"
                      />
                    </div>
                    <div>
                      <label htmlFor="ed-end-time" className="field-label">
                        End time
                      </label>
                      <input
                        id="ed-end-time"
                        type="time"
                        name="endTime"
                        value={editForm.endTime || ""}
                        onChange={handleEditChange}
                        className="field-datetime"
                      />
                    </div>
                  </div>
                  <p className="field-hint">
                    Leave blank to use the event date and attendance end time.
                  </p>
                </div>

                <div>
                  <label htmlFor="ed-status" className="field-label">
                    Status
                  </label>
                  <select
                    id="ed-status"
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    className="field-select"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="finished">Finished</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                {isTerminalStatus(event.status) && (
                  <p className="text-xs text-on-muted">
                    This event has ended. Attendance can no longer be marked.
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="quick-status" className="field-label">
                      Quick status
                    </label>
                    <select
                      id="quick-status"
                      value={event.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="field-select w-auto"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="live">Live</option>
                      <option value="finished">Finished</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  {isTerminalStatus(event.status) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange("upcoming")}
                    >
                      <FaUndo className="text-xs" />
                      Reopen event
                    </Button>
                  )}
                </div>
                {describeEventLifecycle(event) && (
                  <p className="text-xs text-on-muted">
                    {describeEventLifecycle(event)}
                    {event.manualOverride && (
                      <button
                        type="button"
                        onClick={handleResumeAuto}
                        className="ml-2 font-medium text-brand underline-offset-2 hover:underline"
                      >
                        Resume auto-close
                      </button>
                    )}
                  </p>
                )}
              </div>
            )}
          </Card>
          )}

          {/* Attendees Card */}
          {canManageAttendance && (
          <Card>
            <div className="mb-4 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="panel-heading text-base">
                Attendees by group
                {selectedGroup !== "all" && (
                  <span className="num ml-1.5 text-on-muted">
                    ({filteredAttendees.length})
                  </span>
                )}
              </h2>
              <p className="text-xs text-on-muted">
                {selectedGroup === "all"
                  ? "Select a program, year level and section to view students"
                  : `Showing ${selectedGroup}`}
              </p>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="group-program" className="field-label">
                  Program
                </label>
                <select
                  id="group-program"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="field-select"
                >
                  <option value="" disabled hidden />
                  <option value="BSIT">BSIT</option>
                  <option value="BSCS">BSCS</option>
                  <option value="BSEMC">BSEMC</option>
                </select>
              </div>

              <div>
                <label htmlFor="group-year" className="field-label">
                  Year level
                </label>
                <input
                  id="group-year"
                  type="number"
                  min={1}
                  max={4}
                  placeholder="1 – 4"
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="group-section" className="field-label">
                  Section
                </label>
                <input
                  id="group-section"
                  type="text"
                  maxLength={1}
                  placeholder="A – C"
                  value={section}
                  onChange={(e) =>
                    setSection(e.target.value.toUpperCase().replace(/[^ABC]/g, ""))
                  }
                  className="field"
                />
              </div>
            </div>

            {selectedGroup === "all" ? (
              <EmptyState
                compact
                icon={<FaUsers />}
                title="Select a class"
                description="Student information stays hidden until a program, year level, and section are selected."
              />
            ) : filteredAttendees.length === 0 ? (
              <EmptyState
                compact
                icon={<FaUsers />}
                title="No attendees yet"
                description="Scan student QR codes to mark attendance."
              />
            ) : (
              <div className="space-y-2.5">
                {filteredAttendees.map((attendance) => (
                  <div
                    key={attendance._id}
                    className="flex flex-col gap-4 rounded-xl border border-line bg-card-alt/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-on">{attendance.student?.name}</p>
                      <p className="truncate text-sm text-on-dim">
                        {attendance.student?.email}
                      </p>
                      <p className="mt-1 text-xs text-on-muted">
                        Checked in: {formatDateTime(attendance.attendedAt)}
                      </p>
                      {attendance.communityServiceHours > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warn">
                          <FaExclamationTriangle /> Community service:{" "}
                          {attendance.communityServiceHours} hours
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <select
                        value={attendance.status}
                        onChange={(e) =>
                          handleUpdateStatus(attendance.student._id, e.target.value)
                        }
                        className="field-select w-auto py-1.5 text-xs"
                        aria-label={`Attendance status for ${attendance.student?.name}`}
                      >
                        <option value="present">Present (0 hrs)</option>
                        <option value="late">Late (4 hrs)</option>
                        <option value="absent">Absent (8 hrs)</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={
                            csDrafts[attendance.student._id] ??
                            attendance.communityServiceHours
                          }
                          onChange={(e) =>
                            setCsDrafts((d) => ({
                              ...d,
                              [attendance.student._id]: e.target.value,
                            }))
                          }
                          className="field w-20 px-2 py-1.5 text-sm"
                          title="Set this student's community service hours for this event"
                          aria-label={`Community service hours for ${attendance.student?.name}`}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            handleUpdateCS(
                              attendance.student._id,
                              csDrafts[attendance.student._id] ??
                                attendance.communityServiceHours
                            )
                          }
                        >
                          Set hrs
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setPendingRemoveCS(attendance)}
                          disabled={attendance.communityServiceHours <= 0}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this event?"
        message="This deletes the event, but students keep the community service hours they have accumulated from it. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={!!pendingRemoveCS}
        title="Remove community service hours?"
        message={
          pendingRemoveCS
            ? `Remove the ${pendingRemoveCS.communityServiceHours} service hour${pendingRemoveCS.communityServiceHours === 1 ? "" : "s"} recorded for ${pendingRemoveCS.student?.name || "this student"} in this event? This only affects this event.`
            : ""
        }
        confirmLabel="Remove hours"
        variant="danger"
        onConfirm={confirmRemoveCS}
        onCancel={() => setPendingRemoveCS(null)}
        busy={removingCS}
      />
    </div>
  );
};

export default EventDetails;
