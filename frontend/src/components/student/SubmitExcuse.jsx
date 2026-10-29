import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  FaBook,
  FaCheck,
  FaFileAlt,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import { formatDate, formatDateTime } from "../../utils/helpers";
import { BaseCard, Button, FlightPanel, PageHeader, SegmentedControl, StatusChip } from "../ui";

const LETTERS_PER_PAGE = 3;

const formatSubmissionTime = value => formatDateTime(value, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

const GUIDELINES = [
  "Submit your first excuse within 7 days after the event ends.",
  "You can revise and resubmit a filed letter until it is approved.",
  "Attach at least one supporting document, such as a medical certificate.",
  "Provide a clear and detailed explanation for your absence.",
  "Approved excuses remove your community service hours for that event.",
];

const SubmitExcuse = () => {
  const navigate = useNavigate();
  const [absentEvents, setAbsentEvents] = useState([]);
  const [letters, setLetters] = useState([]);
  const [editingLetter, setEditingLetter] = useState(null);
  const [retainedAttachments, setRetainedAttachments] = useState([]);
  const [view, setView] = useState("form");
  const [historyPage, setHistoryPage] = useState(1);
  const letterRailRef = useRef(null);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [excuseText, setExcuseText] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  usePageMeta("Submit Excuse", "File an excuse for a missed event with supporting documents.");
  const refreshLetters = useCallback(async () => {
    try { const response = await api.get("/student/excuses"); setLetters(response.data); }
    catch { /* Preserve the visible receipt if a background refresh fails. */ }
  }, []);
  useAutoRefresh(refreshLetters, { interval: 30000, enabled: !loading && view === "history" });


  useEffect(() => {
    const fetchData = async () => {
      try {
        const [absentRes, excusesRes] = await Promise.all([
          api.get("/student/absent-events"),
          api.get("/student/excuses"),
        ]);

        setLetters(excusesRes.data);
        setView(excusesRes.data.length ? "history" : "form");
        setAbsentEvents(absentRes.data.filter(record => record.event && record.canSubmitExcuse !== false));

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
    if (files.length + retainedAttachments.length + selected.length > 5) {
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
    if (submitting) return;
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

    if (!files.length && !retainedAttachments.length) {
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

      if (editingLetter) {
        formData.append("expectedVersion", editingLetter.submissionVersion || 1);
        formData.append("retainedAttachments", JSON.stringify(retainedAttachments));
      }
      const response = editingLetter
        ? await api.patch(`/student/excuses/${editingLetter._id}`, formData)
        : await api.post("/student/excuses", formData);
      const saved = { ...response.data, event: typeof response.data.event === "object" ? response.data.event : eventOptions.find(item => item.event._id === selectedEvent)?.event, canResubmit: true };
      setLetters(previous => [saved, ...previous.filter(letter => letter._id !== saved._id)]);
      setMessage(`${editingLetter ? "Excuse resubmitted" : "Excuse submitted"} successfully!${response.data.notificationWarning ? ` ${response.data.notificationWarning}` : ""}`);
      setMessageType("success");
      setEditingLetter(null);setRetainedAttachments([]);setSelectedEvent("");setExcuseText("");setFiles([]);setHistoryPage(1);setView("history");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to submit excuse");
      setMessageType("error");
      if (err.response?.status === 409 || err.response?.status === 400) {
        try { const response = await api.get("/student/excuses"); setLetters(response.data); } catch { /* Keep the draft for retry. */ }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const eventOptions = editingLetter ? [{ event: editingLetter.event }] : absentEvents.filter(record => !letters.some(letter => (letter.event?._id || letter.event) === record.event._id));
  const letterPages = Math.max(1, Math.ceil(letters.length / LETTERS_PER_PAGE));
  const page = Math.min(historyPage, letterPages);
  const visibleLetters = letters.slice((page - 1) * LETTERS_PER_PAGE, page * LETTERS_PER_PAGE);
  const changeHistoryPage = nextPage => {
    setHistoryPage(nextPage);
    letterRailRef.current?.scrollTo({ left: 0, behavior: "auto" });
  };
  const resetForm = () => { setEditingLetter(null);setRetainedAttachments([]);setSelectedEvent("");setExcuseText("");setFiles([]); };
  const editLetter = letter => {
    setEditingLetter(letter);setSelectedEvent(letter.event._id);setExcuseText(letter.excuseText);setFiles([]);
    setRetainedAttachments([...new Set([...(letter.attachments || []), letter.attachmentUrl].filter(Boolean))]);
    setMessage("");setView("form");
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow="Student request"
        title="Excuse letters"
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

      <SegmentedControl ariaLabel="Excuse letter view" value={view} onChange={value => { if (submitting) return; setView(value); if (value === "form") resetForm(); }} options={[{ value: "history", label: "My letters", count: letters.length }, { value: "form", label: "Submit a letter" }]} />
      {view === "history" && <FlightPanel level="ledger" glass title="My excuse letters" subtitle="Track submission times and decisions. Times are in Philippine time.">
        {letters.length === 0 ? <p className="text-sm text-on-dim">You have not submitted an excuse letter yet.</p> : <>
          <p className="mb-3 text-xs text-on-muted sm:hidden">Swipe left or right to see the letters on this page.</p>
          <div ref={letterRailRef} role="region" aria-label="Excuse letter cards" tabIndex={0} className="nice-scroll grid grid-flow-col items-stretch gap-3 overflow-x-auto snap-x snap-mandatory pb-2" style={{ gridAutoColumns: "minmax(min(16rem, 100%), calc((100% - 1.5rem) / 3))" }}>
            {visibleLetters.map(letter => <article key={letter._id} className="student-card flex h-full min-w-0 snap-start flex-col rounded-2xl border border-line bg-card-alt/40 p-4">
              <div className="mb-3"><StatusChip status={letter.status} /><h3 className="mt-3 line-clamp-2 break-words font-display text-base font-semibold text-on" title={letter.event?.title || "Event unavailable"}>{letter.event?.title || "Event unavailable"}</h3></div>
              <div className="space-y-1 text-xs text-on-muted"><p>First submitted:<br /><span className="text-on-dim">{formatSubmissionTime(letter.createdAt)}</span></p>{(letter.submissionVersion || 1) > 1 && <p>Last resubmitted:<br /><span className="text-on-dim">{formatSubmissionTime(letter.lastSubmittedAt || letter.updatedAt)} · Version {letter.submissionVersion}</span></p>}</div>
              <p className="mt-3 line-clamp-3 break-words text-sm leading-relaxed text-on-dim">{letter.excuseText}</p>
              {letter.responseNote && <p className="mt-2 line-clamp-2 text-xs text-on-dim">Reviewer note: {letter.responseNote}</p>}
              <details className="mt-3 text-xs text-on-muted"><summary className="cursor-pointer font-medium text-brand">Read full letter</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm text-on-dim">{letter.excuseText}</p>{letter.responseNote && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-on-dim">Reviewer note: {letter.responseNote}</p>}</details>
              <div className="mt-auto border-t border-line pt-3">
                {letter.canResubmit && letter.status !== "approved" ? <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => editLetter(letter)}>Edit and resubmit</Button> : <p className="text-xs text-on-muted">{letter.status === "approved" ? "Approved letters are final." : letter.resubmissionIssue || "This letter cannot be resubmitted."}</p>}
              </div>
            </article>)}
          </div>
          {letterPages > 1 && <nav aria-label="My excuse letter pages" className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => changeHistoryPage(page - 1)}><FaChevronLeft aria-hidden="true" /><span>Previous</span></Button>
            <span aria-live="polite" className="whitespace-nowrap text-xs text-on-muted">Page {page} of {letterPages}</span>
            <Button type="button" variant="secondary" size="sm" disabled={page >= letterPages} onClick={() => changeHistoryPage(page + 1)}><span>Next</span><FaChevronRight aria-hidden="true" /></Button>
          </nav>}
        </>}
      </FlightPanel>}
      {view === "form" && <div className="grid items-start gap-5 lg:grid-cols-[320px_1fr]">
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
          title={editingLetter ? "Revise and resubmit" : "Missed event excuse"}
          subtitle="Explain what happened and attach at least one supporting document."
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="excuse-event" className="field-label">
                Select event (absences only)
              </label>
              <select
                id="excuse-event"
                disabled={!!editingLetter || submitting}
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
              {editingLetter && <p className="field-hint">First submitted {formatSubmissionTime(editingLetter.createdAt)}. Resubmitting sends the revised letter back for review.</p>}
              {eventOptions.length === 0 && (
                <p className="field-hint">
                  You have no eligible absences within the 7-day submission window.
                </p>
              )}
            </div>

            {selectedEvent && eventOptions.find(item => item.event._id === selectedEvent)?.excuseDeadline && <p className="alert alert-info text-xs">Submit by {formatSubmissionTime(eventOptions.find(item => item.event._id === selectedEvent).excuseDeadline)}.</p>}

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
                  required={files.length === 0 && retainedAttachments.length === 0}
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

              {retainedAttachments.length > 0 && <ul className="mt-3 space-y-2">{retainedAttachments.map((url, index) => <li key={url} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card-alt/60 px-3.5 py-2"><span className="text-sm text-on-dim">Existing attachment {index + 1}</span><Button type="button" variant="ghost" size="sm" aria-label={`Remove existing attachment ${index + 1}`} onClick={() => setRetainedAttachments(previous => previous.filter(item => item !== url))}>Remove</Button></li>)}</ul>}
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
                <p className="mt-2 text-xs text-on-muted">No new files selected</p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
              <Button
                type="submit"
                loading={submitting}
                disabled={eventOptions.length === 0}
                className="flex-1"
              >
                {submitting ? "Submitting..." : editingLetter ? "Resubmit excuse" : "Submit excuse"}
              </Button>
              <Button
                type="button"
                onClick={() => { if (editingLetter || letters.length) { resetForm();setView("history"); } else navigate(-1); }}
                disabled={submitting}
                variant="secondary"
                className="px-8"
              >
                Cancel
              </Button>
            </div>
          </form>
        </FlightPanel>
      </div>}
    </div>
  );
};

export default SubmitExcuse;
