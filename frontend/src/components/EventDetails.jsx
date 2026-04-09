import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getUserRole } from "../utils/auth";
import { formatTime12Hour } from "../utils/helpers";

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

  useEffect(() => {
    setRole(getUserRole());
  }, []);

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

  const handleMarkAttendance = async () => {
    try {
      const res = await api.post(`/events/${id}/attendance`);
      setMyAttendance(res.data);
      if (res.data.status === "late") {
        setMessage(`Attendance marked! Warning: You are late. 2 hours community service added.`);
      } else {
        setMessage("Attendance marked successfully!");
      }
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to mark attendance");
    }
  };

  const handleUpdateStatus = async (studentId, status) => {
    try {
      const res = await api.patch(`/events/${id}/attendees/${studentId}`, { status });
      setAttendees(attendees.map((a) => (a._id === res.data._id ? res.data : a)));
      setMessage("Status updated");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update status");
    }
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
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
    if (!window.confirm("Delete this event?")) return;
    try {
      await api.delete(`/events/${id}`);
      navigate(-1);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to delete event");
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

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-lg">Event not found</p>
        <button onClick={() => navigate(-1)} className="text-red-400 hover:underline mt-2">
          Go back
        </button>
      </div>
    );
  }

  const statusConfig = {
    upcoming: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
    live: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
    closed: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30" },
  };

  const status = statusConfig[event.status] || statusConfig.upcoming;

  const isWithinAttendanceWindow = () => {
    if (!event.attendanceStartTime || !event.attendanceEndTime) return true;
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
    return currentTime >= event.attendanceStartTime && currentTime <= event.attendanceEndTime;
  };

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
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <span>←</span> Back
      </button>

      {/* Event Header Card */}
      <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{event.title}</h1>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${status.bg} ${status.text} border ${status.border}`}>
              {event.status?.charAt(0).toUpperCase() + event.status?.slice(1)}
            </span>
          </div>
        </div>

        <p className="text-gray-300 mb-6">{event.description || "No description"}</p>

        {/* Event Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <p className="text-gray-400 text-sm mb-1">Date</p>
            <p className="text-lg font-semibold text-white">{new Date(event.date).toLocaleDateString()}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <p className="text-gray-400 text-sm mb-1">Time</p>
            <p className="text-lg font-semibold text-white">{formatTime12Hour(event.time)}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <p className="text-gray-400 text-sm mb-1">Location</p>
            <p className="text-lg font-semibold text-white">{event.location || "TBA"}</p>
          </div>
        </div>

        {/* Attendance Window */}
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <p className="text-yellow-400 flex items-center gap-2">
            <span>📋</span>
            <span className="font-semibold">Attendance Window:</span>{" "}
            {formatTime12Hour(event.attendanceStartTime)} - {formatTime12Hour(event.attendanceEndTime)}
          </p>
        </div>

        {/* Organizer */}
        {event.organizer && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-gray-400 text-sm">Organized by</p>
            <p className="text-lg font-semibold text-white">{event.organizer.name}</p>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl ${myAttendance?.status === "late" || message.includes("late") ? "bg-yellow-500/20 border border-yellow-500/30 text-yellow-400" : "bg-green-500/20 border border-green-500/30 text-green-400"}`}>
          {message}
        </div>
      )}

      {/* Student Attendance Section */}
      {role === "student" && (
        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Attendance</h2>
          {myAttendance ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-3 ${myAttendance.status === "late" ? "text-yellow-400" : "text-green-400"}`}>
                <span className="text-2xl">✓</span>
                <p className="text-lg font-medium">
                  {myAttendance.status === "late" ? "You marked attendance (Late)." : "You have marked your attendance."}
                </p>
              </div>
              <p className="text-gray-400">
                Checked in at: {new Date(myAttendance.attendedAt).toLocaleString()}
              </p>
              {myAttendance.communityServiceHours > 0 && (
                <p className="text-yellow-400 font-medium">
                  ⚠️ Community Service: {myAttendance.communityServiceHours} hours
                </p>
              )}
            </div>
          ) : isBeforeAttendanceWindow() ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-yellow-400">
                ⏰ Attendance is not open yet. You can mark your attendance starting at{" "}
                <span className="font-bold">{formatTime12Hour(event.attendanceStartTime)}</span>
              </p>
            </div>
          ) : (
            <button
              onClick={handleMarkAttendance}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold px-8 py-3 rounded-xl shadow-lg shadow-green-600/30 transition-all duration-200"
            >
              Mark My Attendance
            </button>
          )}
        </div>
      )}

      {/* Organizer Management Section */}
      {(role === "organizer" || role === "admin") && (
        <div className="space-y-6">
          {/* Event Management Card */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Event Management</h2>
              <div className="flex gap-2">
                {!isEditing && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <span>✏️</span> Edit Event
                    </button>
                    <button
                      onClick={handleDelete}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <span>🗑️</span> Delete
                    </button>
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  required
                />
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
                <input
                  type="text"
                  name="location"
                  value={editForm.location}
                  onChange={handleEditChange}
                  placeholder="Location"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    name="date"
                    value={editForm.date}
                    onChange={handleEditChange}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    required
                  />
                  <input
                    type="time"
                    name="time"
                    value={editForm.time}
                    onChange={handleEditChange}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="time"
                    name="attendanceStartTime"
                    value={editForm.attendanceStartTime}
                    onChange={handleEditChange}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    required
                  />
                  <input
                    type="time"
                    name="attendanceEndTime"
                    value={editForm.attendanceEndTime}
                    onChange={handleEditChange}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    required
                  />
                </div>
                <select
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="closed">Closed</option>
                </select>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 rounded-xl transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-gray-400">Quick Status:</span>
                <select
                  value={event.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}
          </div>

          {/* Attendees Card */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Attendees ({attendees.length})</h2>
            {attendees.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No attendees yet.</p>
            ) : (
              <div className="space-y-3">
                {attendees.map((attendance) => (
                  <div key={attendance._id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="font-medium text-white">{attendance.student?.name}</p>
                      <p className="text-sm text-gray-400">{attendance.student?.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Checked in: {new Date(attendance.attendedAt).toLocaleString()}
                      </p>
                      {attendance.communityServiceHours > 0 && (
                        <p className="text-yellow-400 text-xs mt-1">
                          ⚠️ Community Service: {attendance.communityServiceHours} hours
                        </p>
                      )}
                    </div>
                    <select
                      value={attendance.status}
                      onChange={(e) => handleUpdateStatus(attendance.student._id, e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    >
                      <option value="pending">Pending</option>
                      <option value="present">Present (0 hrs)</option>
                      <option value="late">Late (2 hrs)</option>
                      <option value="absent">Absent (4 hrs)</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetails;
