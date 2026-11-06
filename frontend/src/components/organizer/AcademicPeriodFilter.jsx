import React from "react";

export default function AcademicPeriodFilter({ selection }) {
  const { calendar, schoolYear, semester, error, setSchoolYear, setSemester, period } = selection;
  return <div className="academic-period-filters space-y-2 rounded-xl border border-line bg-card-alt/30 p-3">
    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-on-muted">School year
        <select aria-label="School year" className="field-select" value={schoolYear} disabled={!calendar} onChange={e => setSchoolYear(e.target.value)}><option value="all">All S.Y.</option><option value="unassigned">Unassigned</option>{calendar?.years?.map(year => <option key={year.startYear} value={year.startYear}>{year.label}</option>)}</select>
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-on-muted">Semester
        <select aria-label="Semester" className="field-select" value={semester} disabled={!period || period.unassigned} onChange={e => setSemester(e.target.value)}><option value="all">All semesters</option>{period?.semesters?.map(term => <option key={term.id} value={term.id}>{term.label}</option>)}</select>
      </label>
    </div>
    <p className="text-xs text-on-muted">{error ? "School terms could not be refreshed." : "Filters use each event’s saved school year and semester. Unassigned events stay visible under All S.Y. or Unassigned."}</p>
  </div>;
}
