import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { FaUserPlus, FaSearch, FaCheck, FaTimes, FaClock, FaArrowLeft } from "react-icons/fa";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import Loading from "../shared/Loading";
import { usePageMeta } from "../../context/PageMetaContext";
import { getUserRole } from "../../utils/auth";
import Button from "../ui/Button";

const OrgManageAttendees = () => {
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [csDrafts, setCsDrafts] = useState({});

  usePageMeta("Manage Attendees", "Manually add or scan student attendance.");

  const fetchData = useCallback(async () => {
    try {
      const [studentsRes, attendeesRes] = await Promise.all([
        api.get("/admin/users?role=student"),
        api.get(`/events/${eventId}/attendees`),
      ]);
      setStudents(studentsRes.data || []);
      setAttendees(attendeesRes.data || []);
    } catch (err) {
      console.error(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const alreadyAttended = attendees.map((a) => a.student?._id || a.student);
  const availableStudents = filteredStudents.filter(
    (s) => !alreadyAttended.includes(s._id)
  );
  const matchedAlready = students.filter(
    (s) =>
      alreadyAttended.includes(s._id) &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddAttendance = async (status, student = selectedStudent) => {
    if (!student) return;
    setSubmitting(true);
    setMessage("");

    try {
      const res = await api.post(`/events/${eventId}/attendees/manual`, {
        studentId: student._id,
        status,
      });

      setAttendees([...attendees, res.data]);
      setSelectedStudent(null);
      setSearchTerm("");
      setMessage("Attendance added successfully!");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to add attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCS = async (attendance, hours) => {
    const value = Number(hours);
    if (!Number.isFinite(value) || value < 0) {
      setMessage("Please enter a valid number of hours (0 or more)");
      return;
    }

    try {
      const studentId = attendance.student?._id || attendance.student;
      const res = await api.patch(
        `/events/${eventId}/attendees/${studentId}/community-service`,
        { hours: value }
      );
      setAttendees(attendees.map((a) => (a._id === res.data._id ? res.data : a)));
      setMessage(`Service goal set to ${value} hrs`);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update community service");
    }
  };

  const handleRemoveCS = async (attendance) => {
    const studentId = attendance.student?._id || attendance.student;
    try {
      const res = await api.patch(
        `/events/${eventId}/attendees/${studentId}/community-service/remove`,
        {}
      );
      const newGoal = res.data.requiredServiceHours ?? res.data.student?.requiredServiceHours ?? 0;
      setAttendees(attendees.map((a) => (a._id === res.data._id ? res.data : a)));
      setCsDrafts((d) => ({ ...d, [attendance._id]: String(newGoal) }));
      setMessage("Community service removed");
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to remove community service");
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(
            getUserRole() === "admin"
              ? `/admin/dashboard/events/${eventId}`
              : `/organizer/dashboard/events/${eventId}`
          )}
        >
          <FaArrowLeft /> Back to event
        </Button>
      </div>

      <p className="text-sm text-on-dim">
        {attendees.length} {attendees.length === 1 ? "student" : "students"} checked in
      </p>

      {message && (
        <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${message.includes("success") ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"}`}>
          {message}
        </div>
      )}

      {/* Manual Attendance Section */}
      <div className="rounded-xl border border-line bg-card p-6">
        <h2 className="text-xl font-bold text-on mb-4 flex items-center gap-2">
          <FaUserPlus className="text-indigo-500" />
          Add Attendance Manually
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-on-dim mb-2">Search Student</label>
            <div className="relative">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-on-muted" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedStudent) setSelectedStudent(null);
                }}
                className="w-full rounded-lg border border-line bg-card-alt/60 py-2.5 pl-10 pr-4 text-sm text-on focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {selectedStudent ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-on font-medium">{selectedStudent.name}</p>
                  <p className="text-on-dim text-sm">{selectedStudent.email}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setSearchTerm("");
                  }}
                  className="p-2 text-on-dim hover:text-on transition-colors"
                  aria-label="Clear selection"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button
                  onClick={() => handleAddAttendance("present")}
                  disabled={submitting}
                  variant="primary"
                  className="flex-1"
                >
                  <FaCheck /> Present (0 hrs)
                </Button>
                <Button
                  onClick={() => handleAddAttendance("late")}
                  disabled={submitting}
                  className="flex-1 bg-amber-500 text-white shadow-sm hover:bg-amber-600"
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
            <div className="max-h-72 overflow-auto rounded-lg border border-line bg-card p-1.5 space-y-1">
              {availableStudents.map((student) => (
                <div
                  key={student._id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card-alt/40 p-2.5"
                >
                  <button
                    onClick={() => {
                      setSelectedStudent(student);
                      setSearchTerm(student.email);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-on font-medium">{student.name}</p>
                    <p className="truncate text-on-dim text-sm">{student.email}</p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => handleAddAttendance("present", student)}
                      disabled={submitting}
                      className="rounded-lg bg-green-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                    >
                      <FaCheck /> Present
                    </button>
                    <button
                      onClick={() => handleAddAttendance("late", student)}
                      disabled={submitting}
                      className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                    >
                      <FaClock /> Late
                    </button>
                    <button
                      onClick={() => handleAddAttendance("absent", student)}
                      disabled={submitting}
                      className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      <FaTimes /> Absent
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm ? (
            matchedAlready.length > 0 ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <FaCheck className="text-xs" /> Already checked in for this event
                </p>
                <div className="mt-2 space-y-1.5">
                  {matchedAlready.map((s) => (
                    <div key={s._id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-on">{s.name}</span>
                      <span className="text-on-muted">{s.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-on-muted">
                No students match "{searchTerm}".
              </p>
            )
          ) : (
            <p className="text-sm text-on-muted">
              No students to add — everyone is already checked in for this event.
            </p>
          )}
        </div>
      </div>

      {/* Current Attendees List */}
      <div className="rounded-xl border border-line bg-card p-6">
        <h2 className="text-xl font-bold text-on mb-4">
          Current Attendees ({attendees.length})
        </h2>

        {attendees.length === 0 ? (
          <EmptyState icon={<FaUserPlus />} title="No attendees yet" description="Students marked present, absent, or late for this event will appear here." />
        ) : (
          <div className="space-y-3">
            {attendees.map((attendance) => (
              <div
                key={attendance._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card rounded-xl border border-line"
              >
                <div>
                  <p className="text-on font-medium">
                    {attendance.student?.name || "Unknown"}
                  </p>
                  <p className="text-on-dim text-sm">
                    {attendance.student?.email || ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <StatusBadge status={attendance.status} />
                    <p className="text-on-dim text-sm mt-1">
                      {attendance.communityServiceHours} hrs CS
                    </p>
                    <p className="text-on-muted text-xs mt-0.5">
                      Goal: {attendance.requiredServiceHours ?? attendance.student?.requiredServiceHours ?? 0} hrs
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={csDrafts[attendance._id] ?? String(attendance.requiredServiceHours ?? attendance.student?.requiredServiceHours ?? 0)}
                      onChange={(e) =>
                        setCsDrafts({ ...csDrafts, [attendance._id]: e.target.value })
                      }
                      className="w-16 bg-card-alt border border-line rounded-lg px-2 py-1.5 text-sm text-on focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      title="Set the student's community service goal"
                    />
                    <button
                      onClick={() =>
                        handleUpdateCS(
                          attendance,
                          csDrafts[attendance._id] ?? attendance.requiredServiceHours ?? attendance.student?.requiredServiceHours ?? 0
                        )
                      }
                      className="bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      Set goal
                    </button>
                    <button
                      onClick={() => handleRemoveCS(attendance)}
                      className="bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      Remove CS
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgManageAttendees;