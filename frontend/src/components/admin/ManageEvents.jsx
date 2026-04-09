import React, { useState, useEffect } from "react";
import api from "../../api/axios";

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get("/events/all");
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchAttendees = async (eventId) => {
    try {
      const res = await api.get(`/events/${eventId}/attendees`);
      setAttendees(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openEventDetails = async (event) => {
    setSelectedEvent(event);
    await fetchAttendees(event._id);
    setShowModal(true);
  };

  const updateEventStatus = async (eventId, newStatus) => {
    try {
      await api.patch(`/events/${eventId}/status`, { status: newStatus });
      fetchEvents();
      if (selectedEvent?._id === eventId) {
        setSelectedEvent((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm("Are you sure you want to delete this event? This will also delete all attendance records.")) {
      return;
    }
    try {
      await api.delete(`/events/${eventId}`);
      setEvents(events.filter((e) => e._id !== eventId));
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete event");
    }
  };

  const updateAttendeeStatus = async (eventId, studentId, newStatus) => {
    try {
      await api.patch(`/events/${eventId}/attendees/${studentId}`, { status: newStatus });
      fetchAttendees(eventId);
    } catch (err) {
      console.error(err);
      alert("Failed to update attendee status");
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.organizer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const styles = {
      upcoming: "bg-blue-900/50 text-blue-400 border-blue-700",
      live: "bg-green-900/50 text-green-400 border-green-700",
      closed: "bg-gray-900/50 text-gray-400 border-gray-700",
    };
    return `px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.closed}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-2xl font-bold text-red-400">Manage Events</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 bg-black rounded border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-black rounded border border-gray-700 text-white focus:outline-none focus:border-red-500"
          >
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No events found</div>
      ) : (
        <div className="grid gap-4">
          {filteredEvents.map((event) => (
            <div
              key={event._id}
              className="bg-[#0f0f14] p-5 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <span className={getStatusBadge(event.status)}>{event.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(event.date).toLocaleDateString()} at {event.time}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {event.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {event.organizer?.name || "Unknown"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={event.status}
                    onChange={(e) => updateEventStatus(event._id, e.target.value)}
                    className="px-3 py-2 bg-black rounded border border-gray-700 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    onClick={() => openEventDetails(event)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded text-sm font-medium transition-colors"
                  >
                    View Attendees
                  </button>
                  <button
                    onClick={() => deleteEvent(event._id)}
                    className="px-4 py-2 bg-gray-800 hover:bg-red-900/50 border border-gray-700 hover:border-red-500 rounded text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f0f14] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-700">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{selectedEvent.title}</h3>
                <p className="text-sm text-gray-400">
                  {new Date(selectedEvent.date).toLocaleDateString()} at {selectedEvent.time}
                  {selectedEvent.location && ` - ${selectedEvent.location}`}
                </p>
              </div>
              <div className="flex gap-2">
                <span className={getStatusBadge(selectedEvent.status)}>{selectedEvent.status}</span>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-800 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <h4 className="text-lg font-semibold mb-4">
                Attendees ({attendees.length})
              </h4>
              {attendees.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No attendees yet</p>
              ) : (
                <div className="space-y-2">
                  {attendees.map((attendee) => (
                    <div
                      key={attendee._id}
                      className="flex items-center justify-between p-4 bg-black/30 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{attendee.student?.name}</p>
                        <p className="text-sm text-gray-400">{attendee.student?.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={attendee.status}
                          onChange={(e) =>
                            updateAttendeeStatus(selectedEvent._id, attendee.student._id, e.target.value)
                          }
                          className="px-3 py-1 bg-black rounded border border-gray-700 text-sm focus:outline-none focus:border-red-500"
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageEvents;
