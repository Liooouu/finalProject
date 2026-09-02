import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { FaBook, FaCheck, FaFileAlt, FaCalendarTimes, FaCalendarPlus } from "react-icons/fa";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import Button from "../ui/Button";

const SubmitExcuse = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("absence");
  const [absentEvents, setAbsentEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [excuseText, setExcuseText] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  usePageMeta("Submit Excuse", "File an excuse for a missed or upcoming event.");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [absentRes, eventsRes, myAttendanceRes, excusesRes] = await Promise.all([
          api.get("/student/absent-events"),
          api.get("/events"),
          api.get("/events/my-attendance"),
          api.get("/student/excuses"),
        ]);

        // Events that already have a pending/approved excuse can't be re-filed
        const excusedEventIds = new Set(
          excusesRes.data
            .filter((e) => e.status === "pending" || e.status === "approved")
            .map((e) => e.event?._id || e.event)
        );

        setAbsentEvents(absentRes.data.filter((r) => !excusedEventIds.has(r.event._id)));

        const attendedEventIds = new Set(
          myAttendanceRes.data.map((a) => a.event?._id || a.event)
        );
        const now = new Date();
        const upcoming = eventsRes.data.filter((e) => {
          if (attendedEventIds.has(e._id) || excusedEventIds.has(e._id)) return false;
          const dayEnd = new Date(e.date);
          dayEnd.setHours(23, 59, 59, 999);
          return dayEnd >= now || e.status === "live";
        });
        setUpcomingEvents(upcoming);
      } catch (err) {
        console.error(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const switchMode = (newMode) => {
    setMode(newMode);
    setSelectedEvent("");
    setMessage("");
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setMessage("File size must be less than 5MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvent) {
      setMessage("Please select an event");
      return;
    }
    if (!excuseText.trim()) {
      setMessage("Please provide an excuse description");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("eventId", selectedEvent);
      formData.append("excuseText", excuseText);
      formData.append("type", mode);
      if (file) {
        formData.append("attachment", file);
      }

      await api.post("/student/excuses", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("Excuse submitted successfully!");
      setTimeout(() => navigate("/student/dashboard"), 2000);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to submit excuse");
    } finally {
      setSubmitting(false);
    }
  };

  const isAdvance = mode === "advance";
  const eventOptions = isAdvance ? upcomingEvents : absentEvents;

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Guidelines */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-6">
        <h3 className="text-lg font-semibold text-on mb-3 flex items-center gap-2">
          <span><FaBook /></span> Important Guidelines
        </h3>
        {isAdvance ? (
          <ul className="text-sm text-on-dim space-y-2">
            <li className="flex items-start gap-2">
              <span className="dark:text-blue-400 text-blue-600">•</span>
              File before the event happens if you know you can't attend
            </li>
            <li className="flex items-start gap-2">
              <span className="dark:text-blue-400 text-blue-600">•</span>
              Once approved, you won't receive community service hours for missing it
            </li>
            <li className="flex items-start gap-2">
              <span className="dark:text-blue-400 text-blue-600">•</span>
              If you attend anyway, your attendance will simply be recorded as usual
            </li>
            <li className="flex items-start gap-2">
              <span className="dark:text-blue-400 text-blue-600">•</span>
              Your excuse will be reviewed by the event organizer
            </li>
          </ul>
        ) : (
          <ul className="text-sm text-on-dim space-y-2">
            <li className="flex items-start gap-2">
              <span className="dark:text-blue-400 text-blue-600">•</span>
              Submit your excuse within 24 hours after the event
            </li>
            <li className="flex items-start gap-2">
              <span className="dark:text-blue-400 text-blue-600">•</span>
              Attach supporting documents (medical certificate, etc.) if available
            </li>
            <li className="flex items-start gap-2">
              <span className="dark:text-blue-400 text-blue-600">•</span>
              Provide a clear and detailed explanation
            </li>
            <li className="flex items-start gap-2">
              <span className="dark:text-blue-400 text-blue-600">•</span>
              Approved excuses remove your community service hours for that event
            </li>
          </ul>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl ${message.includes("success") ? "bg-green-500/20 border border-green-500/30 dark:text-green-400 text-green-600" : "bg-red-500/20 border border-red-500/30 dark:text-red-400 text-red-600"}`}>
          {message}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-card p-6 space-y-6">
        {/* Mode Toggle */}
        <div>
          <label className="block text-sm font-semibold text-on mb-2">Excuse Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => switchMode("absence")}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-medium text-sm transition-all ${
                mode === "absence"
                  ? "bg-red-500/20 border-red-500/40 dark:text-red-400 text-red-600"
                  : "bg-card border-line text-on-dim hover:text-on"
              }`}
            >
              <FaCalendarTimes /> Missed Event
            </button>
            <button
              type="button"
              onClick={() => switchMode("advance")}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-medium text-sm transition-all ${
                mode === "advance"
                  ? "bg-blue-500/20 border-blue-500/40 dark:text-blue-400 text-blue-600"
                  : "bg-card border-line text-on-dim hover:text-on"
              }`}
            >
              <FaCalendarPlus /> Upcoming Event
            </button>
          </div>
        </div>

        {/* Event Selection */}
        <div>
          <label className="block text-sm font-semibold text-on mb-2">
            Select Event {isAdvance ? "(Upcoming)" : "(Absences Only)"}
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full bg-card border border-line rounded-lg px-3.5 py-2.5 text-on focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
            required
          >
            <option value="">-- Select an event --</option>
            {eventOptions.length === 0 ? (
              <option value="" disabled>
                {isAdvance ? "No upcoming events found" : "No absent events found"}
              </option>
            ) : (
              eventOptions.map((item) => {
                const event = isAdvance ? item : item.event;
                return (
                  <option key={event._id} value={event._id}>
                    {event.title} - {new Date(event.date).toLocaleDateString()}
                  </option>
                );
              })
            )}
          </select>
          {eventOptions.length === 0 && (
            <p className="text-sm text-on-dim mt-2">
              {isAdvance
                ? "You have no upcoming events to file an advance excuse for."
                : "You don't have any absent events to excuse."}
            </p>
          )}
        </div>

        {/* Excuse Text */}
        <div>
          <label className="block text-sm font-semibold text-on mb-2">Excuse Description</label>
          <textarea
            value={excuseText}
            onChange={(e) => setExcuseText(e.target.value)}
            rows={5}
            placeholder={
              isAdvance
                ? "Explain why you won't be able to attend this event..."
                : "Please provide a detailed explanation for your absence..."
            }
            className="w-full bg-card border border-line rounded-xl px-4 py-3 text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
            required
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-semibold text-on mb-2">Attach Document (Optional)</label>
          <div className="border-2 border-dashed border-line rounded-xl p-8 text-center hover:border-indigo-500/40 transition-colors">
            <input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {file ? (
                <div className="space-y-2">
                  <span className="text-4xl"><FaCheck /></span>
                  <p className="dark:text-green-400 text-green-600 font-medium">{file.name}</p>
                  <p className="text-sm text-on-dim">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-4xl"><FaFileAlt /></span>
                  <p className="text-on-dim">Click to upload or drag and drop</p>
                  <p className="text-xs text-on-muted">PDF, DOC, JPG, PNG (max 5MB)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            type="submit"
            disabled={submitting || eventOptions.length === 0}
            className="flex-1 py-2.5"
          >
            {submitting ? (
              <>
                <span className="skeleton h-4 w-4 rounded-full" />
                Submitting...
              </>
            ) : (
              "Submit Excuse"
            )}
          </Button>
          <Button
            type="button"
            onClick={() => navigate(-1)}
            variant="secondary"
            className="px-8"
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl">
        <p className="dark:text-yellow-400 text-yellow-600 text-sm">
          <strong>Note:</strong> Submitting false or misleading information may result in disciplinary action.
        </p>
      </div>
    </div>
  );
};

export default SubmitExcuse;
