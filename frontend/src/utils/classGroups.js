// utils/classGroups.js
//
// Class identity for the admin event attendance view.
//
// The class an admin picks and the class stored on a student have to be
// compared the same way: trimmed, upper-cased, and with the year level read as
// a number (it is a Number on the schema but a form input hands back a string).
// Keeping that in one place means the picker and the filter can never drift.

const UNASSIGNED = "unassigned";

const classParts = (student) => {
  const program = String(student?.program || "").trim().toUpperCase();
  const rawYear = student?.yearLevel;
  const yearLevel =
    rawYear === null || rawYear === undefined || String(rawYear).trim() === ""
      ? NaN
      : Number(rawYear);
  const section = String(student?.section || "").trim().toUpperCase();

  if (!program || !Number.isInteger(yearLevel) || yearLevel < 1 || !section) return null;
  return { program, yearLevel, section };
};

/** "BSIT-1A" for a complete class, "unassigned" otherwise. */
export const classKeyOf = (student) => {
  const parts = classParts(student);
  return parts ? `${parts.program}-${parts.yearLevel}${parts.section}` : UNASSIGNED;
};

/**
 * Classes present in a set of attendance records, with counts, "Unassigned"
 * last. Only used to explain an empty result: the filter used to say "no
 * attendees" for a class the event simply has no records for, which is
 * indistinguishable from registered students going missing.
 */
export const groupAttendeesByClass = (attendees = []) => {
  const groups = new Map();

  for (const attendance of attendees) {
    const key = classKeyOf(attendance?.student);
    const group = groups.get(key) || {
      key,
      label: key === UNASSIGNED ? "Unassigned" : key,
      count: 0,
    };
    group.count += 1;
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.key === UNASSIGNED) return 1;
    if (b.key === UNASSIGNED) return -1;
    return a.key.localeCompare(b.key, undefined, { numeric: true });
  });
};
