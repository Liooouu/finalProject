import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  FaBook,
  FaCalendarPlus,
  FaCalendarTimes,
  FaCheck,
  FaFileAlt,
} from "react-icons/fa";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import { isTerminalStatus, formatDate } from "../../utils/helpers";
import { BaseCard, Button, Card, PageHeader } from "../ui";

const GUIDELINES = {
  absence: [
    "Submit your excuse within 24 hours after the event.",
    "Attach supporting documents (medical certificate, etc.) if available.",
    "Provide a clear and detailed explanation.",
    "Approved excuses remove your community service hours for that event.",
  ],
  advance: [
    "File before the event happens if you know you can't attend.",
    "Once approved, you won't receive community service hours for missing it.",
    "If you attend anyway, your attendance will simply be recorded as usual.",
    "Your excuse will be reviewed by the event organizer.",
  ],
};

const SubmitExcuse = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("absence");
  const [absentEvents, setAbsentEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [excuseText, setExcuseText] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

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

        setAbsentEvents(absentRes.data.filter((r) => r.event && !excusedEventIds.has(r.event._id)));

        const attendedEventIds = new Set(
          myAttendanceRes.data.map((a) => a.event?._id || a.event)
        );
        const now = new Date();
        // An "advance" excuse is for something still to come, so anything the
        // system has already finished or that has been closed is not offered.
        const upcoming = eventsRes.data.filter((e) => {
          if (attendedEventIds.has(e._id) || excusedEventIds.has(e._id)) return false;
          if (isTerminalStatus(e.status)) return false;
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
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (selected.length === 0) return;
    const overSize = selected.find((f) => f.size > 5 * 1024 * 1024);
    if (overSize) {
      setMessage("Each file must be less than 5MB");
      setMessageType("error");
      return;
    }
    if (files.length + selected.length > 5) {
      setMessage("You can attach up to 5 files total");
      setMessageType("error");
      return;
    }
    setFiles([...files, ...selected]);
    setMessage("");
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvent) {
      setMessage("Please select an event");
      setMessageType("error");
      return;
    }
    if (!excuseText.trim()) {
      setMessage("Please provide an excuse description");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("eventId", selectedEvent);
      formData.append("excuseText", excuseText);
      formData.append("type", mode);
      files.forEach((f) => formData.append("attachments", f));

      await api.post("/student/excuses", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("Excuse submitted successfully!");
      setMessageType("success");
      setTimeout(() => navigate("/student/dashboard"), 2000);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to submit excuse");
      setMessageType("error");
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
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow="Student request"
        title="Submit an excuse"
        subtitle="File for a missed event or let an organizer know you cannot attend."
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            Back
          </Button>
        }
      />

      {message && (
        <div
          className={`alert ${messageType === "error" ? "alert-danger" : "alert-ok"}`}
          role="status"
        >
          <span aria-hidden="true">{messageType === "error" ? "!" : <FaCheck />}</span>
          <p>{message}</p>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          <BaseCard
            title="Important guidelines"
            description={isAdvance ? "For upcoming events" : "For missed events"}
            icon={<FaBook />}
          >
            <ul className="space-y-2.5">
              {GUIDELINES[isAdvance ? "advance" : "absence"].map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-on-dim">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                  />
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </BaseCard>

          <div className="alert alert-warn">
            <span aria-hidden="true" className="mt-0.5 font-semibold">!</span>
            <p>
              <strong>Note:</strong> Submitting false or misleading information may
              result in disciplinary action.
            </p>
          </div>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <p className="field-label">Excuse type</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => switchMode("absence")}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors ${
                    mode === "absence"
                      ? "border-danger/35 bg-danger/10"
                      : "border-line bg-card hover:border-brand/25 hover:bg-card-alt/50"
                  }`}
                >
                  <span
                    className={`flex items-center gap-2 text-sm font-medium ${
                      mode === "absence" ? "text-danger" : "text-on"
                    }`}
                  >
                    <FaCalendarTimes /> Missed event
                  </span>
                  <span className="text-xs text-on-muted">
                    Something already happened
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("advance")}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors ${
                    mode === "advance"
                      ? "border-info/35 bg-info/10"
                      : "border-line bg-card hover:border-brand/25 hover:bg-card-alt/50"
                  }`}
                >
                  <span
                    className={`flex items-center gap-2 text-sm font-medium ${
                      mode === "advance" ? "text-info" : "text-on"
                    }`}
                  >
                    <FaCalendarPlus /> Upcoming event
                  </span>
                  <span className="text-xs text-on-muted">
                    Let them know in advance
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="excuse-event" className="field-label">
                Select event {isAdvance ? "(upcoming)" : "(absences only)"}
              </label>
              <select
                id="excuse-event"
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="field-select"
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
                        {event.title} - {formatDate(event.date)}
                      </option>
                    );
                  })
                )}
              </select>
              {eventOptions.length === 0 && (
                <p className="field-hint">
                  {isAdvance
                    ? "You have no upcoming events to file an advance excuse for."
                    : "You don't have any absent events to excuse."}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="excuse-text" className="field-label">
                Excuse description
              </label>
              <textarea
                id="excuse-text"
                value={excuseText}
                onChange={(e) => setExcuseText(e.target.value)}
                rows={5}
                placeholder={
                  isAdvance
                    ? "Explain why you won't be able to attend this event..."
                    : "Please provide a detailed explanation for your absence..."
                }
                className="field"
                required
              />
              <p className="field-hint">
                Be specific — organizers use this to decide on your request.
              </p>
            </div>

            <div>
              <p className="field-label">
                Attach documents (optional){" "}
                <span className="font-normal text-on-muted">— up to 5 files</span>
              </p>
              <div className="rounded-xl border-2 border-dashed border-line p-6 text-center transition-colors hover:border-brand/40 hover:bg-card-alt/30">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <label htmlFor="file-upload" className="block cursor-pointer">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                    <FaFileAlt />
                  </span>
                  <p className="mt-2 text-sm font-medium text-on">
                    Click to upload
                  </p>
                  <p className="mt-0.5 text-xs text-on-muted">
                    PDF, DOC, JPG or PNG · max 5MB each
                  </p>
                </label>
              </div>

              {files.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card-alt/60 px-3.5 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <FaCheck className="shrink-0 text-xs text-ok" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-on">{f.name}</p>
                          <p className="text-xs text-on-muted">
                            {(f.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="shrink-0 text-xs font-medium text-danger transition-opacity hover:opacity-75"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-on-muted">No files selected</p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
              <Button
                type="submit"
                loading={submitting}
                disabled={eventOptions.length === 0}
                className="flex-1"
              >
                {submitting ? "Submitting..." : "Submit excuse"}
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
        </Card>
      </div>
    </div>
  );
};

export default SubmitExcuse;
