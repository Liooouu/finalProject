import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getUserRole, getUserFromToken } from "../utils/auth";
import { formatTime12Hour } from "../utils/helpers";
import { FaCheck, FaEdit, FaTrash, FaExclamationTriangle, FaUsers } from "react-icons/fa";
import Loading from "./shared/Loading";
import { BsClipboardCheck } from "react-icons/bs";
import { QRCodeSVG } from "qrcode.react";
import QRScanner from "./organizer/QRScanner";
import { usePageMeta } from "../context/PageMetaContext";
import Button from "./ui/Button";
import StatusChip from "./ui/StatusChip";
import EventMap from "./shared/EventMap";
import MapPicker from "./shared/MapPicker";
import ConfirmDialog from "./ui/ConfirmDialog";

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [myAttendance, setMyAttendance] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [role, setRole] = useState(null);
  const [qrRefreshKey, setQrRefreshKey] = useState(0);
  const [studentId, setStudentId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [csDrafts, setCsDrafts] = useState({});

  usePageMeta(event?.title || "Event", event?.date
    ? new Date(event.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
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
      try {
        const currentRole = getUserRole();
        const eventRes = await api.get(`/events/${id}`);
        setEvent(eventRes.data);
        setEditForm({
          title: eventRes.data.title,
          description: eventRes.data.description,
          location: eventRes.data.location,
          mapQuery: eventRes.data.mapQuery || "",
          date: eventRes.data.date ? new Date(eventRes.data.date).toISOString().split("T")[0] : "",
          time: eventRes.data.time,
          status: eventRes.data.status,
          attendanceStartTime: eventRes.data.attendanceStartTime || "",
          attendanceEndTime: eventRes.data.attendanceEndTime || "",
        });

        if (currentRole === "organizer" || currentRole === "admin") {
          const attendeesRes = await api.get(`/events/${id}/attendees`);
          setAttendees(attendeesRes.data);
        } else if (currentRole === "student") {
          const myAttendances = await api.get("/events/my-attendance");
          const found = myAttendances.data.find((a) => a.event?._id === id || a.event === id);
          setMyAttendance(found || null);
        }
      } catch (err) {
        console.error(err.response?.data || err.message);
        setMessage("Failed to load event details");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleUpdateStatus = async (stdId, status) => {
    try {
      const res = await api.patch(`/events/${id}/attendees/${stdId}`, { status });
      setAttendees(attendees.map((a) => (a._id === res.data._id ? res.data : a)));
      setMessage("Status updated");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update status");
    }
  };

  const handleUpdateCS = async (stdId, val) => {
    const hours = Number(val);
    if (!Number.isFinite(hours) || hours < 0) return;
    try {
      const res = await api.patch(`/events/${id}/attendees/${stdId}/community-service`, { hours });
      setAttendees(attendees.map((a) => (a._id === res.data._id ? res.data : a)));
      setCsDrafts((d) => ({ ...d, [stdId]: hours }));
      setMessage("Service hours updated");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update service hours");
    }
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleMapPick = (v) => {
    setEditForm({ ...editForm, location: v, mapQuery: v });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/events/${id}`, editForm);
      setEvent(res.data);
      setIsEditing(false);
      setMessage("Event updated successfully!");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update event");
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await api.patch(`/events/${id}/status`, { status: newStatus });
      setEvent({ ...event, status: res.data.status });
      setMessage("Status updated!");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update status");
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

  const isBeforeAttendanceWindow = () => {
    if (!event.attendanceStartTime) return false;
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
    return currentTime < event.attendanceStartTime;
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-on-dim hover:text-on transition-colors"
      >
        <span>←</span> Back
      </button>

      {/* Event Header Card */}
      <div className="rounded-xl border border-line bg-card p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-on">{event.title}</h1>
            <div className="mt-2">
              <StatusChip status={event.status} />
            </div>
          </div>
        </div>

        <p className="text-on-dim mb-6">{event.description || "No description"}</p>

        {/* Event Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card p-4 rounded-xl border border-line">
            <p className="text-on-dim text-sm mb-1">Date</p>
            <p className="text-lg font-semibold text-on">{new Date(event.date).toLocaleDateString()}</p>
          </div>
          <div className="bg-card p-4 rounded-xl border border-line">
            <p className="text-on-dim text-sm mb-1">Time</p>
            <p className="text-lg font-semibold text-on">{formatTime12Hour(event.time)}</p>
          </div>
          <div className="bg-card p-4 rounded-xl border border-line">
            <p className="text-on-dim text-sm mb-1">Location</p>
            <p className="text-lg font-semibold text-on">{event.location || "TBA"}</p>
          </div>
        </div>

        <EventMap event={event} className="mb-6 h-56 w-full" />

        {/* Attendance Window */}
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <p className="dark:text-yellow-400 text-yellow-600 flex items-center gap-2">
            <span><BsClipboardCheck /></span>
            <span className="font-semibold">Attendance Window:</span>{" "}
            {formatTime12Hour(event.attendanceStartTime)} - {formatTime12Hour(event.attendanceEndTime)}
          </p>
        </div>

        {/* Organizer */}
        {event.organizer && (
          <div className="mt-6 pt-6 border-t border-line">
            <p className="text-on-dim text-sm">Organized by</p>
            <p className="text-lg font-semibold text-on">{event.organizer.name}</p>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl ${myAttendance?.status === "late" || message.includes("late") ? "bg-yellow-500/20 border border-yellow-500/30 dark:text-yellow-400 text-yellow-600" : "bg-green-500/20 border border-green-500/30 dark:text-green-400 text-green-600"}`}>
          {message}
        </div>
      )}

      {/* Student Attendance Section */}
      {role === "student" && (
        <div className="rounded-xl border border-line bg-card p-6">
          <h2 className="text-xl font-bold text-on mb-4">Attendance</h2>
          {myAttendance ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-3 ${myAttendance.status === "absent" ? "dark:text-red-400 text-red-600" : myAttendance.status === "late" ? "dark:text-yellow-400 text-yellow-600" : myAttendance.status === "excused" ? "dark:text-blue-400 text-blue-600" : "dark:text-green-400 text-green-600"}`}>
                <span className="text-2xl">
                  {myAttendance.status === "absent" ? "❌" : myAttendance.status === "late" ? "⏰" : <FaCheck />}
                </span>
                <p className="text-lg font-medium">
                  {myAttendance.status === "absent"
                    ? "You are marked as absent."
                    : myAttendance.status === "late"
                    ? "You are marked as late."
                    : myAttendance.status === "excused"
                    ? "Your absence has been excused."
                    : "You have marked your attendance."}
                </p>
              </div>
              <p className="text-on-dim">
                Checked in at: {new Date(myAttendance.attendedAt).toLocaleString()}
              </p>
              {myAttendance.communityServiceHours > 0 && (
                <p className="dark:text-yellow-400 text-yellow-600 font-medium">
                  <FaExclamationTriangle /> Community Service: {myAttendance.communityServiceHours} hours
                </p>
              )}
            </div>
          ) : isBeforeAttendanceWindow() ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="dark:text-yellow-400 text-yellow-600">
                Attendance is not open yet. You can mark your attendance starting at{" "}
                <span className="font-bold">{formatTime12Hour(event.attendanceStartTime)}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* QR Code Display */}
              <div className="bg-card rounded-xl p-6 text-center">
                <p className="text-on font-medium mb-4">Show this QR code to the organizer to scan your attendance</p>
                <div className="flex justify-center mb-4">
                  {getQRData() && (
                    <div className="p-4 bg-white rounded-xl">
                      <QRCodeSVG
                        key={qrRefreshKey}
                        value={getQRData()}
                        size={200}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  )}
                </div>
                <p className="text-on-dim text-sm">
                  QR code refreshes every 30 seconds for security
                </p>
                <p className="text-on-muted text-sm text-center mt-3">
                  Show this QR code to the organizer to mark your attendance
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Organizer Management Section */}
      {(role === "organizer" || role === "admin") && (
        <div className="space-y-6">
          {/* QR Scanner Card */}
          <QRScanner eventId={id} onScanSuccess={refreshAttendees} />

          {/* Manage Attendance Button */}
          <Button
            onClick={() => navigate(
              role === "admin"
                ? `/admin/dashboard/events/${id}/attendees`
                : `/organizer/dashboard/events/${id}/attendees`
            )}
            className="w-full py-3"
          >
            <FaUsers /> Manage Attendance Manually
          </Button>

          {/* Event Management Card */}
          <div className="rounded-xl border border-line bg-card p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
              <h2 className="text-xl font-bold text-on">Event Management</h2>
              <div className="flex flex-wrap gap-2">
                {!isEditing && (
                  <>
                    <Button
                      onClick={() => setIsEditing(true)}
                      variant="secondary"
                      size="sm"
                    >
                      <FaEdit /> Edit Event
                    </Button>
                    <Button
                      onClick={() => setConfirmDelete(true)}
                      variant="danger"
                      size="sm"
                    >
                      <FaTrash /> Delete
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <input
                  type="text"
                  name="title"
                  value={editForm.title}
                  onChange={handleEditChange}
                  className="w-full bg-card border border-line rounded-xl px-4 py-3 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  required
                />
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  rows={3}
                  className="w-full bg-card border border-line rounded-xl px-4 py-3 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <input
                  type="text"
                  name="location"
                  value={editForm.location}
                  onChange={handleEditChange}
                  placeholder="Location"
                  className="w-full bg-card border border-line rounded-xl px-4 py-3 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <MapPicker
                  value={editForm.mapQuery}
                  onChange={handleMapPick}
                  className="h-64"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="date"
                    name="date"
                    value={editForm.date}
                    onChange={handleEditChange}
                    className="bg-card border border-line rounded-xl px-4 py-3 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    required
                  />
                  <input
                    type="time"
                    name="time"
                    value={editForm.time}
                    onChange={handleEditChange}
                    className="bg-card border border-line rounded-xl px-4 py-3 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="time"
                    name="attendanceStartTime"
                    value={editForm.attendanceStartTime}
                    onChange={handleEditChange}
                    className="bg-card border border-line rounded-xl px-4 py-3 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    required
                  />
                  <input
                    type="time"
                    name="attendanceEndTime"
                    value={editForm.attendanceEndTime}
                    onChange={handleEditChange}
                    className="bg-card border border-line rounded-xl px-4 py-3 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    required
                  />
                </div>
                <select
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                  className="w-full bg-card border border-line rounded-xl px-4 py-3 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="closed">Closed</option>
                </select>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                  >
                    Save Changes
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="text-on-dim">Quick Status:</span>
                <select
                  value={event.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="bg-card border border-line rounded-lg px-4 py-2 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}
          </div>

          {/* Attendees Card */}
          <div className="rounded-xl border border-line bg-card p-6">
            <h2 className="text-xl font-bold text-on mb-6">Attendees ({attendees.length})</h2>
            {attendees.length === 0 ? (
              <p className="text-on-dim text-center py-8">No attendees yet. Scan student QR codes to mark attendance.</p>
            ) : (
              <div className="space-y-3">
                {attendees.map((attendance) => (
                  <div key={attendance._id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-card rounded-xl gap-4">
                    <div>
                      <p className="font-medium text-on">{attendance.student?.name}</p>
                      <p className="text-sm text-on-dim">{attendance.student?.email}</p>
                      <p className="text-xs text-on-muted mt-1">
                        Checked in: {new Date(attendance.attendedAt).toLocaleString()}
                      </p>
                      {attendance.communityServiceHours > 0 && (
                        <p className="dark:text-yellow-400 text-yellow-600 text-xs mt-1">
                          <FaExclamationTriangle /> Community Service: {attendance.communityServiceHours} hours
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <select
                        value={attendance.status}
                        onChange={(e) => handleUpdateStatus(attendance.student._id, e.target.value)}
                        className="bg-card border border-line rounded-lg px-3 py-2 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      >
                        <option value="present">Present (0 hrs)</option>
                        <option value="late">Late (4 hrs)</option>
                        <option value="absent">Absent (8 hrs)</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={csDrafts[attendance.student._id] ?? attendance.communityServiceHours ?? 0}
                          onChange={(e) =>
                            setCsDrafts((d) => ({ ...d, [attendance.student._id]: e.target.value }))
                          }
                          className="w-20 bg-card border border-line rounded-lg px-3 py-2 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleUpdateCS(attendance.student._id, csDrafts[attendance.student._id] ?? attendance.communityServiceHours ?? 0)
                          }
                        >
                          Set hrs
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this event?"
        message="This will permanently delete the event and all of its attendance records. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default EventDetails;
