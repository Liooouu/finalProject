import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../../api/axios";
import {
  FaArrowLeft,
  FaCheck,
  FaClock,
  FaSearch,
  FaTimes,
  FaUserPlus,
  FaUsers,
} from "react-icons/fa";
import Pagination from "../ui/Pagination";
import { formatDateTime } from "../../utils/helpers";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import { getUserRole } from "../../utils/auth";
import { Button, Card, PageHeader } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useAutoRefresh } from "../../utils/useAutoRefresh";

const OrgManageAttendees = ({ embedded = false }) => {
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [recordPage, setRecordPage] = useState(1);
  const [enrollment, setEnrollment] = useState("all");
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [rowBusyId, setRowBusyId] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [csDrafts, setCsDrafts] = useState({});
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");

  usePageMeta(embedded ? "Manual attendance" : "Manage Attendees", "Manually add or adjust student attendance.");

  const fetchData = useCallback(async () => {
    try {
      const [studentsRes, attendeesRes] = await Promise.all([
        api.get("/admin/users?role=student"),
        api.get(`/events/${eventId}/attendees`),
      ]);
      setLoadError(false);
      setStudents(studentsRes.data || []);
      setAttendees(attendeesRes.data || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useAutoRefresh(fetchData);

  const getStudentKey = (s) => {
    if (!s) return "unassigned";
    const p = String(s.program || "").trim().toUpperCase();
    const y = s.yearLevel != null ? String(s.yearLevel) : "";
    const sec = String(s.section || "").trim().toUpperCase();
    if (p && y && sec) return `${p}-${y}${sec}`;
    if (p || y || sec) return "partial";
    return "unassigned";
  };

  // The class the organizer is inspecting: built from the program dropdown plus
  // the year and section inputs (e.g. BSIT + 1 + A -> "BSIT-1A"). Empty until
  // all three are filled, so no student info shows before a class is chosen.
  const selectedGroup =
    program && yearLevel && section.trim()
      ? `${program}-${yearLevel}${section.trim().toUpperCase()}`
      : "";

  const matchesEnrollment = student => enrollment === "all" || (student?.enrollmentStatus || "active") === enrollment;
  const filteredByGroupAttendees = attendees.filter((a) => {
    if (!matchesEnrollment(a.student)) return false;
    if (!selectedGroup) return true;
    return getStudentKey(a.student) === selectedGroup;
  });

  const currentRecordPage = Math.min(recordPage, Math.max(1, Math.ceil(filteredByGroupAttendees.length / 10)));
  const pageAttendees = filteredByGroupAttendees.slice((currentRecordPage - 1) * 10, currentRecordPage * 10);

  const filteredStudents = students.filter((s) => {
    if (!matchesEnrollment(s)) return false;
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (!selectedGroup) return true;
    return getStudentKey(s) === selectedGroup;
  });

  const alreadyAttended = attendees.map((a) => a.student?._id || a.student);
  const availableStudents = filteredStudents.filter(
    (s) => !alreadyAttended.includes(s._id)
  );
  const matchedAlready = filteredStudents.filter(
    (s) =>
      alreadyAttended.includes(s._id) &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddAttendance = async (status, student = selectedStudent) => {
    if (!student || submitting) return;
    setSubmitting(true);
    setMessage("");
    setMessageType("success");

    try {
      const res = await api.post(`/events/${eventId}/attendees/manual`, {
        studentId: student._id,
        status,
      });

      setAttendees((prev) => [...prev, res.data]);
      setSelectedStudent(null);
      setSearchTerm("");
      setMessage("Attendance added successfully!");
      setMessageType("success");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to add attendance");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (attendance, status) => {
    if (rowBusyId) return;
    setRowBusyId(attendance._id);
    try {
      const studentId = attendance.student?._id || attendance.student;
      const { data } = await api.patch(`/events/${eventId}/attendees/${studentId}`, { status });
      setAttendees(rows => rows.map(row => row._id === data._id ? data : row));
      setCsDrafts(drafts => ({ ...drafts, [data._id]: String(data.communityServiceHours || 0) }));
      setMessage("Attendance status updated."); setMessageType("success");
    } catch (err) { setMessage(err.response?.data?.error || "Attendance could not be updated."); setMessageType("error"); }
    finally { setRowBusyId(null); }
  };

  const handleUpdateCS = async (attendance, hours) => {
    if (rowBusyId) return;
    const value = Number(hours);
    if (!Number.isFinite(value) || value < 0) {
      setMessage("Please enter a valid number of hours (0 or more)");
      setMessageType("error");
      return;
    }

    setRowBusyId(attendance._id);
    try {
      const studentId = attendance.student?._id || attendance.student;
      const res = await api.patch(
        `/events/${eventId}/attendees/${studentId}/community-service`,
        { hours: value }
      );
      setAttendees((prev) => prev.map((a) => (a._id === res.data._id ? res.data : a)));
      setMessage(`Community service hours set to ${value} hrs`);
      setMessageType("success");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update community service");
      setMessageType("error");
    } finally {
      setRowBusyId(null);
    }
  };

  const confirmRemoveCS = async () => {
    const attendance = pendingRemove;
    if (!attendance || removing) return;
    setRemoving(true);
    const studentId = attendance.student?._id || attendance.student;
    try {
      const res = await api.patch(
        `/events/${eventId}/attendees/${studentId}/community-service/remove`,
        { hours: attendance.communityServiceHours || 0 }
      );
      const remaining = res.data.communityServiceHours || 0;
      setAttendees((prev) => prev.map((a) => (a._id === res.data._id ? res.data : a)));
      setCsDrafts((d) => ({ ...d, [attendance._id]: String(remaining) }));
      setMessage("Community service hours removed");
      setMessageType("success");
      setPendingRemove(null);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to remove community service");
      setMessageType("error");
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  const backPath =
    getUserRole() === "admin"
      ? `/admin/dashboard/events/${eventId}`
      : `/organizer/dashboard/events/${eventId}`;
  const goBackToEvent = () => {
    if (location.key && location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(backPath);
  };

  return (
    <div className="space-y-5">
      {loadError && <div role="alert" className="alert alert-danger">Student attendance could not be refreshed. Showing any previously loaded records. Reload to try again.</div>}
      {!embedded && <PageHeader
        eyebrow="Attendance desk"
        title="Manage attendees"
        subtitle="Add students manually or adjust community service hours for this event."
        actions={
          <Button variant="secondary" size="sm" onClick={goBackToEvent}>
            <FaArrowLeft /> Back to event
          </Button>
        }
      />}

      {message && (
        <div
          className={`alert ${messageType === "success" ? "alert-ok" : "alert-danger"}`}
          role="status"
        >
          <span aria-hidden="true">{messageType === "success" ? "✓" : "!"}</span>
          <p>{message}</p>
        </div>
      )}

      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
            <FaUsers />
          </span>
          <div>
            <h2 className="panel-heading">Choose a class</h2>
            <p className="mt-0.5 text-xs text-on-muted">
              Students only appear after program, year and section are set.
            </p>
          </div>
        </div>

        <div className="mt-4 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="attendee-program" className="field-label">Program</label>
            <select
              id="attendee-program"
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
            <label htmlFor="attendee-year" className="field-label">Year</label>
            <input
              id="attendee-year"
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
            <label htmlFor="attendee-section" className="field-label">Section</label>
            <input
              id="attendee-section"
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

        <p className="mt-4 text-sm text-on-dim">
          {selectedGroup ? (
            <>
              Showing students for{" "}
              <span className="font-semibold text-on">{selectedGroup}</span>
            </>
          ) : (
            <span className="text-on-muted">
              Pick a program, year and section to view its students.
            </span>
          )}
        </p>
      </Card>

      <label className="block max-w-xs text-xs text-on-muted">Enrollment status
        <select aria-label="Enrollment status" className="field-select mt-1" value={enrollment} onChange={e => { setEnrollment(e.target.value); setRecordPage(1); }}><option value="all">All students</option><option value="active">Active</option><option value="graduated">Graduated</option></select>
      </label>
      <p className="text-xs text-on-muted">Class and enrollment labels reflect the student’s current academic record. Historical attendance remains available.</p>
      {selectedGroup && (
        <>
          <Card>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ok/10 text-ok ring-1 ring-inset ring-ok/20">
                <FaUserPlus />
              </span>
              <div>
                <h2 className="panel-heading">Add attendance manually</h2>
                <p className="mt-0.5 text-xs text-on-muted">
                  Search the class and choose a status.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="attendee-search" className="field-label">Search student</label>
                <div className="relative">
                  <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-on-muted" />
                  <input
                    id="attendee-search"
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (selectedStudent) setSelectedStudent(null);
                    }}
                    className="field field-search"
                  />
                </div>
              </div>

              {selectedStudent ? (
                <div className="rounded-xl border border-ok/25 bg-ok/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-on">{selectedStudent.name}</p>
                      <p className="truncate text-sm text-on-dim">{selectedStudent.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStudent(null);
                        setSearchTerm("");
                      }}
                      className="shrink-0 rounded-lg p-2 text-on-dim transition-colors hover:text-on"
                      aria-label="Clear selection"
                    >
                      <FaTimes />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={() => handleAddAttendance("present")}
                      disabled={submitting}
                      className="flex-1"
                    >
                      <FaCheck /> Present (0 hrs)
                    </Button>
                    <Button
                      onClick={() => handleAddAttendance("late")}
                      disabled={submitting}
                      variant="secondary"
                      className="flex-1 border-warn/30 text-warn hover:bg-warn/10"
                    >
                      <FaClock /> Late (4 hrs)
                    </Button>
                    <Button
                      onClick={() => handleAddAttendance("absent")}
                      disabled={submitting}
                      variant="danger"
                      className="flex-1"
                    >
                      <FaTimes /> Absent (8 hrs)
                    </Button>
                  </div>
                </div>
              ) : availableStudents.length > 0 ? (
                <div className="max-h-80 space-y-1.5 overflow-auto rounded-xl border border-line bg-card-alt/30 p-2">
                  {availableStudents.map((student) => (
                    <div
                      key={student._id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-card p-2.5"
                    >
                      <button
                        onClick={() => {
                          setSelectedStudent(student);
                          setSearchTerm(student.email);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium text-on">{student.name}</p>
                        <p className="truncate text-xs text-on-dim">{student.email}</p>
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => handleAddAttendance("present", student)}
                          disabled={submitting}
                          className="rounded-lg border border-ok/25 bg-ok/10 px-2.5 py-1.5 text-xs font-medium text-ok transition-colors hover:bg-ok/15 disabled:opacity-50"
                        >
                          <FaCheck /> Present
                        </button>
                        <button
                          onClick={() => handleAddAttendance("late", student)}
                          disabled={submitting}
                          className="rounded-lg border border-warn/25 bg-warn/10 px-2.5 py-1.5 text-xs font-medium text-warn transition-colors hover:bg-warn/15 disabled:opacity-50"
                        >
                          <FaClock /> Late
                        </button>
                        <button
                          onClick={() => handleAddAttendance("absent", student)}
                          disabled={submitting}
                          className="rounded-lg border border-danger/25 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/15 disabled:opacity-50"
                        >
                          <FaTimes /> Absent
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchTerm ? (
                matchedAlready.length > 0 ? (
                  <div className="alert alert-warn">
                    <FaCheck className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Attendance already recorded for this event</p>
                      <div className="mt-1.5 space-y-1">
                        {matchedAlready.map((s) => (
                          <div key={s._id} className="flex items-center justify-between gap-3">
                            <span className="text-on">{s.name}</span>
                            <span className="text-xs opacity-80">{s.email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-on-muted">
                    No students match &quot;{searchTerm}&quot;.
                  </p>
                )
              ) : (
                <p className="text-sm text-on-muted">
                  All matching students already have an attendance record for this event.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="panel-heading">
                Attendance records ({filteredByGroupAttendees.length})
              </h2>
              <p className="text-xs text-on-muted">
                Adjust hours per student for this event only.
              </p>
            </div>

            {filteredByGroupAttendees.length === 0 ? (
              <EmptyState
                icon={<FaUsers />}
                title="No attendance records in this class"
                description="No attendance records match the selected class and enrollment status."
                compact
              />
            ) : (
              <ul className="mt-4 space-y-2.5">
                {pageAttendees.map((attendance) => (
                  <li
                    key={attendance._id}
                    className="flex flex-col gap-3 rounded-xl border border-line bg-card-alt/30 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-on">
                        {attendance.student?.name || "Unknown"}
                      </p>
                      <p className="truncate text-xs text-on-dim">
                        {attendance.student?.email || ""}
                      </p>
                      <p className="mt-1 text-xs text-on-muted">{attendance.student?.enrollmentStatus === "graduated" ? "Graduated" : "Active"} · {attendance.student?.faceEnrolledAt ? "Face enrolled" : "Face enrollment required"}</p>
                      <p className="mt-1 text-xs text-on-muted">{attendance.method === "face" ? "Face verified" : attendance.method === "auto" ? "Automatic record" : attendance.method === "manual" ? "Manually recorded" : "Attendance record"}{["present", "late"].includes(attendance.status) && (attendance.verifiedAt || attendance.attendedAt) ? ` · ${formatDateTime(attendance.verifiedAt || attendance.attendedAt)}` : ""}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <StatusBadge status={attendance.status} />
                        <span className="text-xs text-on-muted">
                          {attendance.communityServiceHours} service hrs
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select aria-label={`Attendance status for ${attendance.student?.name || "student"}`} value={attendance.status} disabled={!!rowBusyId} onChange={e => handleStatusChange(attendance, e.target.value)} className="field-select w-auto text-xs">
                        {!["present", "late", "absent"].includes(attendance.status) && <option value={attendance.status} disabled>{attendance.status}</option>}
                        <option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={
                          csDrafts[attendance._id] ?? String(attendance.communityServiceHours)
                        }
                        onChange={(e) =>
                          setCsDrafts({ ...csDrafts, [attendance._id]: e.target.value })
                        }
                        className="w-16 rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-on focus:outline-none focus:ring-2 focus:ring-brand/30"
                        title="Set this student's community service hours for this event"
                      />
                      <Button
                        onClick={() =>
                          handleUpdateCS(
                            attendance,
                            csDrafts[attendance._id] ?? attendance.communityServiceHours
                          )
                        }
                        disabled={rowBusyId === attendance._id}
                        size="sm"
                      >
                        Set hrs
                      </Button>
                      <Button
                        onClick={() => setPendingRemove(attendance)}
                        disabled={
                          rowBusyId === attendance._id ||
                          attendance.communityServiceHours <= 0
                        }
                        variant="danger"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={currentRecordPage} pageSize={10} total={filteredByGroupAttendees.length} onChange={setRecordPage} label="Attendance record pages" />
          </Card>
        </>
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        title="Remove community service hours?"
        message={
          pendingRemove
            ? `Remove the ${pendingRemove.communityServiceHours} service hour${
                pendingRemove.communityServiceHours === 1 ? "" : "s"
              } recorded for ${pendingRemove.student?.name || "this student"} in this event? This only affects this event.`
            : ""
        }
        confirmLabel="Remove hours"
        onConfirm={confirmRemoveCS}
        onCancel={() => setPendingRemove(null)}
        busy={removing}
      />
    </div>
  );
};

export default OrgManageAttendees;
