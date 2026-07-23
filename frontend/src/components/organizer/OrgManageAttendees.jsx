import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import { FaUserPlus, FaSearch, FaCheck, FaTimes, FaClock } from "react-icons/fa";

const OrgManageAttendees = () => {
  const { id: eventId } = useParams();
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const alreadyAttended = attendees.map((a) => a.student?._id || a.student);
  const availableStudents = filteredStudents.filter(
    (s) => !alreadyAttended.includes(s._id)
  );

  const handleAddAttendance = async (status) => {
    if (!selectedStudent) return;
    setSubmitting(true);
    setMessage("");

    try {
      const res = await api.post(`/events/${eventId}/attendees/manual`, {
        studentId: selectedStudent._id,
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

  const getStatusBadge = (status) => {
    const styles = {
      present: "bg-green-500/20 text-green-400 border-green-500/30",
      late: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      absent: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.present}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-on-dim">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-on">Manage Attendees</h1>
        <p className="text-on-dim mt-1">Manually add or scan student attendance</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl ${message.includes("success") ? "bg-green-500/20 border border-green-500/30 text-green-400" : "bg-red-500/20 border border-red-500/30 text-red-400"}`}>
          {message}
        </div>
      )}

      {/* Manual Attendance Section */}
      <div className="bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6">
        <h2 className="text-xl font-bold text-on mb-4 flex items-center gap-2">
          <FaUserPlus className="text-blue-400" />
          Add Attendance Manually
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-on-dim mb-2">Search Student</label>
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-on-dim" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (!selectedStudent && e.target.value) {
                    const found = students.find(
                      (s) => s.email === e.target.value || s.name.toLowerCase().includes(e.target.value.toLowerCase())
                    );
                    if (found && !alreadyAttended.includes(found._id)) {
                      setSelectedStudent(found);
                    }
                  }
                }}
                className="w-full bg-card border border-line rounded-xl pl-12 pr-4 py-3 text-on focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {selectedStudent ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
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
                >
                  <FaTimes />
                </button>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleAddAttendance("present")}
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FaCheck /> Present (0 hrs)
                </button>
                <button
                  onClick={() => handleAddAttendance("late")}
                  disabled={submitting}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FaClock /> Late (4 hrs)
                </button>
                <button
                  onClick={() => handleAddAttendance("absent")}
                  disabled={submitting}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FaTimes /> Absent (8 hrs)
                </button>
              </div>
            </div>
          ) : (
            availableStudents.length > 0 && searchTerm && (
              <div className="space-y-2">
                {availableStudents.slice(0, 5).map((student) => (
                  <button
                    key={student._id}
                    onClick={() => {
                      setSelectedStudent(student);
                      setSearchTerm(student.email);
                    }}
                    className="w-full text-left p-3 bg-card hover:bg-card-alt border border-line rounded-lg transition-colors"
                  >
                    <p className="text-on font-medium">{student.name}</p>
                    <p className="text-on-dim text-sm">{student.email}</p>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Current Attendees List */}
      <div className="bg-linear-to-br dark:from-white/10 dark:to-white/5 from-slate-50 to-slate-100 backdrop-blur-sm border border-line rounded-2xl p-6">
        <h2 className="text-xl font-bold text-on mb-4">
          Current Attendees ({attendees.length})
        </h2>

        {attendees.length === 0 ? (
          <p className="text-on-dim text-center py-8">No attendance records yet</p>
        ) : (
          <div className="space-y-3">
            {attendees.map((attendance) => (
              <div
                key={attendance._id}
                className="flex items-center justify-between p-4 bg-card rounded-xl border border-line"
              >
                <div>
                  <p className="text-on font-medium">
                    {attendance.student?.name || "Unknown"}
                  </p>
                  <p className="text-on-dim text-sm">
                    {attendance.student?.email || ""}
                  </p>
                </div>
                <div className="text-right">
                  {getStatusBadge(attendance.status)}
                  <p className="text-on-dim text-sm mt-1">
                    {attendance.communityServiceHours} hrs CS
                  </p>
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