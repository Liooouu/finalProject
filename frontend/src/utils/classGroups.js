// utils/classGroups.js
//
// Class identity for the attendance screens (admin event review, attendee
// drawer). One definition so a class is spelled the same everywhere.
//
// A student belongs to a class only when all three academic fields are present.
// Anything incomplete (legacy accounts, dangling student references) is grouped
// as "unassigned" so those records stay visible instead of silently vanishing
// from every class filter — which is exactly what the old inline comparison did.

export const UNASSIGNED_CLASS = "unassigned";

export const classParts = (student) => {
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
  return parts ? `${parts.program}-${parts.yearLevel}${parts.section}` : UNASSIGNED_CLASS;
};

/** Human label for a single record. */
export const classLabelOf = (student) =>
  classKeyOf(student) === UNASSIGNED_CLASS ? "No class on record" : classKeyOf(student);

/**
 * Class options for a set of attendance records, ordered by class with the
 * "Unassigned" bucket last. Options are derived from the records themselves, so
 * every choice has students behind it and no fixed program/year/section list can
 * hide a class the school still stores.
 */
export const groupAttendeesByClass = (attendees = []) => {
  const groups = new Map();

  for (const attendance of attendees) {
    const key = classKeyOf(attendance?.student);
    const group = groups.get(key) || {
      key,
      label: key === UNASSIGNED_CLASS ? "Unassigned" : key,
      count: 0,
    };
    group.count += 1;
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.key === UNASSIGNED_CLASS) return 1;
    if (b.key === UNASSIGNED_CLASS) return -1;
    return a.key.localeCompare(b.key, undefined, { numeric: true });
  });
};
