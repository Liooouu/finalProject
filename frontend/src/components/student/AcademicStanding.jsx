import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { FlightPanel } from "../ui";
import { FaGraduationCap } from "react-icons/fa";

const yearLabel = (year) => ({ 1: "1st year", 2: "2nd year", 3: "3rd year", 4: "4th year" }[year] || "Year level unavailable");
const AcademicStanding = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.get("/student/academic-status").then(({ data: value }) => {
      if (active && value?.student) setData(value);
    }).catch(() => { if (active) setError("Academic standing is unavailable. Refresh to try again."); });
    return () => { active = false; };
  }, []);
  if (!data) return <p role="status" className={error ? "alert alert-warn" : "p-4 text-sm text-on-muted"}>{error || "Loading academic record…"}</p>;
  const student = data.student;
  const graduated = student.enrollmentStatus === "graduated";
  const displayedYear=student.academicYearStart!=null?`${student.academicYearStart}–${student.academicYearStart+1}`:"Not assigned";
  return <FlightPanel level="ledger" glass title="Academic standing" subtitle="Your enrollment details and the current department term." icon={<FaGraduationCap />}>
    <p className="mb-4 text-sm text-on-dim">Current department term: <strong className="text-on">{data.configured?`${data.current.label} · ${data.currentSemester.label}`:"Not set by the administrator"}</strong></p>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[
        { label: "Year level", value: graduated ? "Graduated" : yearLabel(student.yearLevel) },
        { label: graduated ? "Last section" : "Section", value: data.student.section || "—" },
        { label: "School year", value: displayedYear },
      ].map(field => <div key={field.label} className={`student-card rounded-xl border border-line bg-card-alt/30 p-4 ${field.label === "School year" ? "col-span-2 sm:col-span-1" : ""}`}><dt className="text-xs text-on-muted">{field.label}</dt><dd className="mt-2 font-display text-xl font-semibold text-on">{field.value}</dd></div>)}
    </dl>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-on-muted">{data.student.program} · {data.currentSemester?.label || "Current semester not set"}</p>
    </div>
    <p className="mt-4 text-xs text-on-muted">The administrator sets the active semester manually. Changing semesters does not advance year levels or reset attendance and service balances.</p>
    <details className="mt-5 rounded-xl border border-line px-4 py-3 text-xs text-on-dim">
      <summary className="cursor-pointer font-medium text-on">How school-year progression works</summary>
      <p className="mt-3 leading-relaxed">An administrator reviews registered student accounts before advancing year levels. Students may retain their year level in the new school year. Graduation requires explicit confirmation. Past attendance and service balances are retained.</p>
    </details>
    {!!data.student.history?.length && <details className="mt-3 rounded-xl border border-line px-4 py-3 text-xs text-on-dim"><summary className="cursor-pointer font-medium text-on">Previous school years</summary><ul className="mt-3 space-y-2">{data.student.history.map((record, index) => <li key={record._id || index}>SY {record.schoolYearStart}–{record.schoolYearStart + 1}: {yearLabel(record.yearLevel)}, Section {record.section}</li>)}</ul></details>}
  </FlightPanel>;
};
export default AcademicStanding;
