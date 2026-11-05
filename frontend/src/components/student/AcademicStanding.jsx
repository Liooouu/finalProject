import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { formatDate } from "../../utils/helpers";
import { FlightPanel } from "../ui";
import { FaGraduationCap } from "react-icons/fa";

const yearLabel = (year) => ({ 1: "1st year", 2: "2nd year", 3: "3rd year", 4: "4th year" }[year] || "Year level unavailable");
const AcademicStanding = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.get("/student/academic-status").then(({ data: value }) => {
      if (active && value?.current && value?.student) setData(value);
    }).catch(() => { if (active) setError("Academic standing is unavailable. Refresh to try again."); });
    return () => { active = false; };
  }, []);
  if (!data) return <p role="status" className={error ? "alert alert-warn" : "p-4 text-sm text-on-muted"}>{error || "Loading academic record…"}</p>;
  const student = data.student;
  const graduated = student.enrollmentStatus === "graduated";
  const displayedYear = data.years.find(year => year.startYear === student.academicYearStart) || data.current;
  const currentSemester = displayedYear.semesters.find(term => new Date() >= new Date(term.start) && new Date() <= new Date(term.end));
  return <FlightPanel level="ledger" glass title="Academic standing" subtitle="Your enrollment details and school calendar." icon={<FaGraduationCap />}>
    {!data.confirmed && <p className="mb-5 rounded-xl border border-warn/20 bg-warn/5 px-4 py-3 text-xs leading-relaxed text-on-dim"><span className="font-semibold text-warn">Preview calendar.</span> Semester dates are pending confirmation. Academic updates are reviewed by an administrator.</p>}
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[
        { label: "Year level", value: graduated ? "Graduated" : yearLabel(student.yearLevel) },
        { label: graduated ? "Last section" : "Section", value: data.student.section || "—" },
        { label: "School year", value: displayedYear.label },
      ].map(field => <div key={field.label} className={`student-card rounded-xl border border-line bg-card-alt/30 p-4 ${field.label === "School year" ? "col-span-2 sm:col-span-1" : ""}`}><dt className="text-xs text-on-muted">{field.label}</dt><dd className="mt-2 font-display text-xl font-semibold text-on">{field.value}</dd></div>)}
    </dl>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-on-muted">{data.student.program} · {currentSemester?.label || "Outside the displayed semester schedule"}</p>
    </div>
    <div className="mt-5 border-t border-line pt-5">
      <h3 className="text-sm font-semibold text-on">Semester schedule</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {displayedYear.semesters.map(term => <div key={term.id} className="student-card rounded-xl border border-line px-4 py-3"><p className="text-sm font-medium text-on">{term.label}</p><p className="mt-1 text-xs text-on-muted">{formatDate(term.start)} – {formatDate(term.end)}</p></div>)}
      </div>
    </div>
    <details className="mt-5 rounded-xl border border-line px-4 py-3 text-xs text-on-dim">
      <summary className="cursor-pointer font-medium text-on">How school-year progression works</summary>
      <p className="mt-3 leading-relaxed">An administrator reviews the masterlist before advancing year levels. Students may retain their year level in the new school year. Graduation requires explicit confirmation. Past attendance and service balances are retained.</p>
    </details>
    {!!data.student.history?.length && <details className="mt-3 rounded-xl border border-line px-4 py-3 text-xs text-on-dim"><summary className="cursor-pointer font-medium text-on">Previous school years</summary><ul className="mt-3 space-y-2">{data.student.history.map((record, index) => <li key={record._id || index}>SY {record.schoolYearStart}–{record.schoolYearStart + 1}: {yearLabel(record.yearLevel)}, Section {record.section}</li>)}</ul></details>}
  </FlightPanel>;
};
export default AcademicStanding;
