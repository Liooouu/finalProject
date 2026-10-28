export const recordsForAcademicPeriod = (records, period, semester = "all") => {
  if (!period) return records;
  const range = semester === "all" ? period : period.semesters.find(item => item.id === semester);
  if (!range) return [];
  const start = new Date(range.start).getTime(), end = new Date(range.end).getTime();
  return records.filter(record => {
    const value = record.event?.date || record.eventDate || record.date || record.attendedAt;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
  });
};
