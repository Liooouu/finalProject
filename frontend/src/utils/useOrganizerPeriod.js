import { useEffect, useState } from "react";
import api from "../api/axios";

export function useOrganizerPeriod() {
  const [calendar, setCalendar] = useState(null);
  const [schoolYear, setSchoolYear] = useState("all");
  const [semester, setSemester] = useState("all");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    api.get("/organizer/academic-calendar").then(({ data }) => { if (active) setCalendar(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const period = calendar?.years?.find(year => String(year.startYear) === schoolYear);
  return { calendar, schoolYear, semester, period, error, setSchoolYear: value => { setSchoolYear(value); setSemester("all"); }, setSemester };
}
