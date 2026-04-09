import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getUserRole } from "../utils/auth";

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [myAttendance, setMyAttendance] = useState(null);
  const role = getUserRole();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventRes = await api.get(`/events/${id}`);
        setEvent(eventRes.data);

        if (role === "organizer") {
          const attendeesRes = await api.get(`/events/${id}/attendees`);
          setAttendees(attendeesRes.data);
        } else if (role === "student") {
          const myAttendances = await api.get(`/events/my-attendance`);
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
  }, [id, role]);

  const handleMarkAttendance = async () => {
    try {
      const res = await api.post(`/events/${id}/attendance`);
      setMyAttendance(res.data);
      setMessage("Attendance marked successfully!");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center">
        <p className="text-red-400">Event not found</p>
        <button onClick={() => navigate(-1)} className="text-red-400 hover:underline mt-2">
          Go back
        </button>
      </div>
    );
  }

  const statusColors = {
    upcoming: "bg-blue-600",
    live: "bg-green-600",
    closed: "bg-gray-600",
  };

  return (
    <div className="p-6 text-white">
      <button
        onClick={() => navigate(-1)}
        className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
      >
        ← Back
      </button>

      <div className="bg-white/10 rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <span className={`px-3 py-1 rounded-full text-sm ${statusColors[event.status]}`}>
            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
          </span>
        </div>

        <p className="text-gray-300 mb-4">{event.description || "No description"}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white/5 p-3 rounded-lg">
            <p className="text-gray-400">Date</p>
            <p className="text-lg">{new Date(event.date).toLocaleDateString()}</p>
          </div>
          <div className="bg-white/5 p-3 rounded-lg">
            <p className="text-gray-400">Time</p>
            <p className="text-lg">{event.time}</p>
          </div>
          <div className="bg-white/5 p-3 rounded-lg">
            <p className="text-gray-400">Location</p>
            <p className="text-lg">{event.location || "TBA"}</p>
          </div>
        </div>

        {event.organizer && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-gray-400 text-sm">Organized by</p>
            <p className="text-lg">{event.organizer.name}</p>
          </div>
        )}
      </div>

      {role === "student" && (
        <div className="bg-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Attendance</h2>
          {message && <p className="text-green-400 mb-4">{message}</p>}
          {myAttendance ? (
            <div>
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <span className="text-2xl">✓</span>
                <p className="text-lg">You have marked your attendance for this event.</p>
              </div>
              <p className="text-gray-400">
                Checked in at: {new Date(myAttendance.attendedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <button
              onClick={handleMarkAttendance}
              className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg transition"
            >
              Mark My Attendance
            </button>
          )}
        </div>
      )}

      {role === "organizer" && (
        <div className="bg-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Attendees ({attendees.length})</h2>
          {message && <p className="text-green-400 mb-4">{message}</p>}
          {attendees.length === 0 ? (
            <p className="text-gray-400">No attendees yet.</p>
          ) : (
            <div className="space-y-3">
              {attendees.map((attendance) => (
                <div
                  key={attendance._id}
                  className="flex justify-between items-center bg-white/5 p-4 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{attendance.student?.name}</p>
                    <p className="text-sm text-gray-400">{attendance.student?.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Checked in: {new Date(attendance.attendedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={attendance.status}
                      onChange={(e) => handleUpdateStatus(attendance.student._id, e.target.value)}
                      className="bg-white/10 border border-white/20 px-3 py-1 rounded text-black text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventDetails;
