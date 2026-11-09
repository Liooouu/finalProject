import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import { useAutoRefresh } from "../../utils/useAutoRefresh";
import { FlightPanel } from "../ui";
import { FaGraduationCap } from "react-icons/fa";

const yearLabel = (year) => ({ 1: "1st year", 2: "2nd year", 3: "3rd year", 4: "4th year" }[year] || "Year level unavailable");
const AcademicStanding = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const request = useRef(0);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    try {
      const { data: value } = await api.get("/student/academic-status");
      if (mounted.current && current === request.current && value?.student) {
        setData(value);
        setError("");
      }
    } catch {
      if (mounted.current && current === request.current) setError("Could not refresh academic standing. It will retry automatically.");
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    Promise.resolve().then(() => { if (mounted.current) refresh(); });
    return () => { mounted.current = false; };
  }, [refresh]);
  useAutoRefresh(refresh, { interval: 30000 });
  if (!data) return <p role="status" className={error ? "alert alert-warn" : "p-4 text-sm text-on-muted"}>{error || "Loading academic record…"}</p>;
  const student = data.student;
  const graduated = student.enrollmentStatus === "graduated";
  const standingYear=student.academicYearStart;
  const currentYear=data.configured?data.current?.startYear:null;
  const displayedYear=graduated?standingYear:(currentYear??standingYear);
  const yearText=displayedYear!=null?`${displayedYear}–${Number(displayedYear)+1}`:"Not set by the administrator";
  return <FlightPanel level="ledger" glass title="Academic standing" subtitle="Your enrollment details and the current department term." icon={<FaGraduationCap />}>
    {error&&<p role="status" className="mb-3 text-xs text-on-muted">{error}</p>}
    <p className="mb-4 text-sm text-on-dim">Current department term: <strong className="text-on">{data.configured?`${data.current.label} · ${data.currentSemester.label}`:"Not set by the administrator"}</strong></p>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[
        { label: "Year level", value: graduated ? "Graduated" : yearLabel(student.yearLevel) },
        { label: graduated ? "Last section" : "Section", value: data.student.section || "—" },
        { label: graduated ? "Last recorded school year" : "School year", value: yearText },
      ].map((field,index) => <div key={field.label} className={`student-card rounded-xl border border-line bg-card-alt/30 p-4 ${index === 2 ? "col-span-2 sm:col-span-1" : ""}`}><dt className="text-xs text-on-muted">{field.label}</dt><dd className="mt-2 font-display text-xl font-semibold text-on">{field.value}</dd></div>)}
    </dl>
    {!graduated&&standingYear!=null&&currentYear!=null&&standingYear!==currentYear&&<p className="mt-3 text-xs text-on-muted">Your year-level record is for S.Y. {standingYear}–{Number(standingYear)+1}. The department term shown above is separate.</p>}
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
