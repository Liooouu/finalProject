import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  FaBook,
  FaCheck,
  FaFileAlt,
} from "react-icons/fa";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import { formatDate, formatDateTime } from "../../utils/helpers";
import { BaseCard, Button, FlightPanel, PageHeader } from "../ui";

const GUIDELINES = [
  "Submit your excuse within 7 days after the event ends.",
  "Attach at least one supporting document, such as a medical certificate.",
  "Provide a clear and detailed explanation for your absence.",
  "Approved excuses remove your community service hours for that event.",
];

const SubmitExcuse = () => {
  const navigate = useNavigate();
  const [absentEvents, setAbsentEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [excuseText, setExcuseText] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  usePageMeta("Submit Excuse", "File an excuse for a missed event with supporting documents.");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [absentRes, excusesRes] = await Promise.all([
          api.get("/student/absent-events"),
          api.get("/student/excuses"),
        ]);

        // Events that already have a pending/approved excuse can't be re-filed
        const excusedEventIds = new Set(
          excusesRes.data
            .filter((e) => e.status === "pending" || e.status === "approved")
            .map((e) => e.event?._id || e.event)
        );

        setAbsentEvents(absentRes.data.filter((r) => r.event && r.canSubmitExcuse !== false && !excusedEventIds.has(r.event._id)));

      } catch (err) {
        console.error(err.response?.data || err.message);
        setMessage("Could not load your missed events. Please refresh and try again.");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (selected.length === 0) return;
    if (selected.some((file) => !/\.(pdf|doc|docx|jpg|jpeg|png)$/i.test(file.name))) {
      setMessage("Use PDF, DOC, DOCX, JPG or PNG files.");
      setMessageType("error");
      return;
    }
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

    if (!files.length) {
      setMessage("Please attach at least one supporting document.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("eventId", selectedEvent);
      formData.append("excuseText", excuseText);
      formData.append("type", "absence");
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

  const eventOptions = absentEvents;

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow="Student request"
        title="Submit an excuse"
        subtitle="Explain a missed event and include the required supporting documents."
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
            description="For missed events"
            icon={<FaBook />}
          >
            <ul className="space-y-2.5">
              {GUIDELINES.map((line) => (
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

        <FlightPanel
          level="ledger"
          glass
          eyebrow="Excuse request"
          title="Missed event excuse"
          subtitle="Explain what happened and attach at least one supporting document."
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="excuse-event" className="field-label">
                Select event (absences only)
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
                    No absent events found
                  </option>
                ) : (
                  eventOptions.map((item) => {
                    const event = item.event;
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
                  You have no eligible absences within the 7-day submission window.
                </p>
              )}
            </div>

            {selectedEvent && eventOptions.find(item => item.event._id === selectedEvent)?.excuseDeadline && <p className="alert alert-info text-xs">Submit by {formatDateTime(eventOptions.find(item => item.event._id === selectedEvent).excuseDeadline)}.</p>}

            <div>
              <label htmlFor="excuse-text" className="field-label">
                Excuse description
              </label>
              <textarea
                id="excuse-text"
                value={excuseText}
                onChange={(e) => setExcuseText(e.target.value)}
                rows={5}
                placeholder="Please provide a detailed explanation for your absence..."
                className="field"
                required
              />
              <p className="field-hint">
                Be specific — organizers use this to decide on your request.
              </p>
            </div>

            <div>
              <p className="field-label">
                Attach documents (required){" "}
                <span className="font-normal text-on-muted">— 1 to 5 files</span>
              </p>
              <div className="relative rounded-xl border-2 border-dashed border-line p-6 text-center transition-colors hover:border-brand/40 hover:bg-card-alt/30">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="sr-only"
                  required={files.length === 0}
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
                    PDF, DOC, DOCX, JPG or PNG · max 5MB each
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
        </FlightPanel>
      </div>
    </div>
  );
};

export default SubmitExcuse;
