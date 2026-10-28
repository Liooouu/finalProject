const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");
const { manilaDayRange } = require("../services/eventLifecycle");

router.use(protect, authorize("admin"));

const fmtDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
});
const fmtDateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});
const fmtEventDay = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

// Programs and sections offered by the college. Reports use these fixed option
// sets so stale or legacy user records cannot add unsupported choices.
const PROGRAM_VALUES = ["BSEMC", "BSIT", "BSCS"];
const SECTION_VALUES = ["A", "B", "C"];
const YEAR_LEVEL_VALUES = [1, 2, 3, 4];

function isActiveFilter(value) {
  return value !== undefined && value !== null && value !== "" && value !== "all";
}

function formatEventTime(value) {
  if (typeof value !== "string") return "";
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23 || Number(minutes) > 59) return value;
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
}


// Safe account fields for reports: never hashes, PINs, device ids, or photos.
const REPORT_USER_FIELDS = "name email role organizerAccess program yearLevel section createdAt";

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function buildMatch({ startDate, endDate, eventId }) {
  const match = {};

  if (eventId) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw badRequest("Invalid event id");
    }
    match.event = new mongoose.Types.ObjectId(eventId);
  }

  if (startDate || endDate) {
    match.attendedAt = {};
    if (startDate) {
      const start = new Date(startDate);
      if (Number.isNaN(start.getTime())) throw badRequest("Invalid start date");
      match.attendedAt.$gte = manilaDayRange(start).start;
    }
    if (endDate) {
      const end = new Date(endDate);
      if (Number.isNaN(end.getTime())) throw badRequest("Invalid end date");
      // Inclusive of the whole selected Manila day.
      match.attendedAt.$lte = manilaDayRange(end).end;
    }
  }

  return match;
}

// Demographic filters are stored on the student, so resolve them to User ids
// once and apply that id set to every attendance query (records, stats, charts
// and exports) to keep the whole report consistent.
function buildStudentFilter(query = {}) {
  const filter = { role: "student" };

  if (isActiveFilter(query.program)) {
    const program = String(query.program).trim().toUpperCase();
    if (!PROGRAM_VALUES.includes(program)) throw badRequest("Invalid program");
    filter.program = program;
  }

  if (isActiveFilter(query.yearLevel)) {
    const yearLevel = Number(query.yearLevel);
    if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 4) {
      throw badRequest("Year level must be between 1 and 4");
    }
    filter.yearLevel = yearLevel;
  }

  if (isActiveFilter(query.section)) {
    const section = String(query.section).trim().toUpperCase();
    if (!SECTION_VALUES.includes(section)) {
      throw badRequest("Section must be A, B, or C");
    }
    filter.section = section;
  }

  return filter;
}

async function buildAttendanceMatch(query = {}) {
  const match = buildMatch(query);

  // A single student's ledger (the admin user panel) asks for their records
  // directly instead of downloading the whole report and filtering it here.
  if (isActiveFilter(query.studentId)) {
    if (!mongoose.Types.ObjectId.isValid(query.studentId)) {
      throw badRequest("Invalid student id");
    }
    match.student = new mongoose.Types.ObjectId(query.studentId);
  }

  const studentFilter = buildStudentFilter(query);

  if (Object.keys(studentFilter).length > 1) {
    const ids = await User.distinct("_id", studentFilter);
    if (match.student) {
      // Both filters must hold; an id outside the demographic slice matches
      // nothing rather than silently widening the query.
      const allowed = new Set(ids.map(String));
      if (!allowed.has(String(match.student))) {
        match.student = { $in: [] };
      }
    } else {
      match.student = { $in: ids };
    }
  }

  return { match, studentFilter };
}

function loadFilterOptions() {
  return {
    programs: PROGRAM_VALUES,
    yearLevels: YEAR_LEVEL_VALUES,
    sections: SECTION_VALUES,
  };
}

function attendanceFilename(studentFilter, event) {
  const parts = ["attendance"];
  if (event?.title) {
    const title = String(event.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
    if (title) parts.push(title);
  }
  if (studentFilter.program) parts.push(studentFilter.program);
  if (studentFilter.yearLevel) parts.push(`year${studentFilter.yearLevel}`);
  if (studentFilter.section) parts.push(studentFilter.section);
  return `${parts.join("-")}.csv`;
}

// CSV cell: always quoted, embedded quotes doubled, newlines flattened, and
// leading =/+/-/@ neutralized so a spreadsheet never evaluates user text.
function csvCell(value) {
  let text = value === undefined || value === null ? "" : String(value);
  text = text.replace(/[\r\n]+/g, " ").trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvFromRows(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function sendCsv(res, filename, rows) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // BOM keeps Excel from guessing the wrong encoding for accented names.
  res.send(`\uFEFF${csvFromRows(rows)}`);
}

function fail(res, error) {
  const status = error.status || 500;
  res.status(status).json({
    message: status >= 500 ? "Server error" : error.message || "Request failed",
  });
}

router.get("/attendance", async (req, res) => {
  try {
    const { match, studentFilter } = await buildAttendanceMatch(req.query);

    // The report screen charts the aggregate results and lists only the latest
    // rows, but this endpoint used to send every matching record (with both
    // references populated) so the payload grew with the term. Pages ask for a
    // window instead; the totals still describe every matching record.
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 200);

    const [attendance, totalRecords, statusStats, byEvent, students, matchedStudents, filters, events] =
      await Promise.all([
        Attendance.find(match)
          .populate("event", "title date time")
          .populate("student", "name email program yearLevel section")
          .sort({ attendedAt: -1 })
          .limit(limit),
        Attendance.countDocuments(match),
        Attendance.aggregate([
          { $match: match },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Attendance.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$event",
              total: { $sum: 1 },
              present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
              late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
              absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
              pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
              excused: { $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] } },
            },
          },
          {
            $lookup: {
              from: "events",
              localField: "_id",
              foreignField: "_id",
              as: "event",
            },
          },
          { $unwind: "$event" },
          {
            $project: {
              eventTitle: "$event.title",
              eventDate: "$event.date",
              total: 1,
              present: 1,
              late: 1,
              absent: 1,
              pending: 1,
              excused: 1,
              attendanceRate: {
                $cond: [
                  { $gt: ["$total", 0] },
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: [{ $add: ["$present", "$late"] }, "$total"] },
                          100,
                        ],
                      },
                      1,
                    ],
                  },
                  0,
                ],
              },
            },
          },
          { $sort: { eventDate: -1 } },
        ]),
        User.countDocuments(studentFilter),
        Attendance.distinct("student", match),
        loadFilterOptions(),
        Event.find({}, "title date").sort({ date: -1 }).limit(250).lean(),
      ]);

    const statsMap = { present: 0, late: 0, absent: 0, pending: 0, excused: 0 };
    statusStats.forEach((s) => {
      statsMap[s._id] = s.count;
    });

    res.json({
      records: attendance,
      stats: {
        total: totalRecords,
        students,
        studentsWithRecords: matchedStudents.length,
        present: statsMap.present,
        late: statsMap.late,
        absent: statsMap.absent,
        pending: statsMap.pending,
        excused: statsMap.excused,
      },
      byEvent,
      filters: { ...filters, events },
    });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/attendance/export", async (req, res) => {
  try {
    const studentFilter = buildStudentFilter(req.query);
    const match = buildMatch(req.query);

    const [students, selectedEvent] = await Promise.all([
      User.find(studentFilter)
        .select("name email program yearLevel section")
        .sort({ program: 1, yearLevel: 1, section: 1, name: 1 })
        .lean(),
      isActiveFilter(req.query.eventId)
        ? Event.findById(req.query.eventId).select("title date time").lean()
        : null,
    ]);

    match.student = { $in: students.map((student) => student._id) };

    const attendance = await Attendance.find(match)
      .populate("event", "title date time")
      .lean();

    const byStudent = new Map();
    for (const record of attendance) {
      const key = String(record.student);
      if (!byStudent.has(key)) byStudent.set(key, []);
      byStudent.get(key).push(record);
    }

    for (const records of byStudent.values()) {
      records.sort((a, b) => {
        const aDate = new Date(a.event?.date || a.eventDate || 0).getTime() || 0;
        const bDate = new Date(b.event?.date || b.eventDate || 0).getTime() || 0;
        if (aDate !== bDate) return aDate - bDate;
        return String(a.event?.title || a.eventTitle || "").localeCompare(
          String(b.event?.title || b.eventTitle || "")
        );
      });
    }

    const rows = [
      [
        "Student Name",
        "Student Email",
        "Program",
        "Year Level",
        "Section",
        "Event Name",
        "Event Day",
        "Event Time",
        "Attendance Status",
        "Marked At",
      ],
    ];

    for (const student of students) {
      const records = byStudent.get(String(student._id)) || [];

      if (!records.length) {
        rows.push([
          student.name,
          student.email,
          student.program || "",
          student.yearLevel ?? "",
          student.section || "",
          selectedEvent?.title || "",
          selectedEvent?.date ? fmtEventDay.format(new Date(selectedEvent.date)) : "",
          selectedEvent?.time ? formatEventTime(selectedEvent.time) : "",
          "No attendance",
          "",
        ]);
        continue;
      }

      for (const record of records) {
        const eventDate = record.event?.date || record.eventDate;
        rows.push([
          student.name,
          student.email,
          student.program || "",
          student.yearLevel ?? "",
          student.section || "",
          record.event?.title || record.eventTitle || "",
          eventDate ? fmtEventDay.format(new Date(eventDate)) : "",
          record.event?.time ? formatEventTime(record.event.time) : "",
          record.status || "",
          record.attendedAt ? fmtDateTime.format(new Date(record.attendedAt)) : "",
        ]);
      }
    }

    sendCsv(res, attendanceFilename(studentFilter, selectedEvent), rows);
  } catch (error) {
    fail(res, error);
  }
});

// One grouped pass over attendance instead of a find() per event. The old shape
// ran an extra query — and loaded every attendance document — for every event
// in the list, which is what made this report slow once the term filled up.
async function attendanceCountsByEvent() {
  const rows = await Attendance.aggregate([
    {
      $group: {
        _id: "$event",
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        excused: { $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] } },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), row]));
}

router.get("/events", async (req, res) => {
  try {
    const [events, counts] = await Promise.all([
      Event.find().populate("organizer", "name email").sort({ date: -1 }).lean(),
      attendanceCountsByEvent(),
    ]);

    const eventsWithStats = events.map((event) => {
      const count = counts.get(String(event._id)) || {};
      const total = count.total || 0;
      const present = count.present || 0;
      const late = count.late || 0;

      return {
        _id: event._id,
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        location: event.location,
        status: event.status,
        organizer: event.organizer,
        totalAttendees: total,
        present,
        late,
        absent: count.absent || 0,
        pending: count.pending || 0,
        excused: count.excused || 0,
        attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100 * 10) / 10 : 0,
      };
    });

    const statusCounts = {
      upcoming: events.filter((e) => e.status === "upcoming").length,
      live: events.filter((e) => e.status === "live").length,
      finished: events.filter((e) => e.status === "finished").length,
      closed: events.filter((e) => e.status === "closed").length,
    };

    res.json({
      events: eventsWithStats,
      stats: {
        total: events.length,
        ...statusCounts,
      },
    });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/events/export", async (req, res) => {
  try {
    const [events, counts] = await Promise.all([
      Event.find().populate("organizer", "name email").sort({ date: -1 }).lean(),
      attendanceCountsByEvent(),
    ]);

    const eventsWithStats = events.map((event) => {
      const count = counts.get(String(event._id)) || {};
      return {
        title: event.title,
        date: event.date,
        location: event.location || "",
        status: event.status,
        organizer: event.organizer?.name || "",
        totalAttendees: count.total || 0,
        present: count.present || 0,
        late: count.late || 0,
      };
    });

    const rows = [
      ["Title", "Date", "Location", "Status", "Organizer", "Total Attendees", "Present", "Late"],
      ...eventsWithStats.map((e) => [
        e.title,
        e.date ? fmtDate.format(new Date(e.date)) : "",
        e.location,
        e.status,
        e.organizer,
        e.totalAttendees,
        e.present,
        e.late,
      ]),
    ];

    sendCsv(res, "events-report.csv", rows);
  } catch (error) {
    fail(res, error);
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select(REPORT_USER_FIELDS).sort({ createdAt: -1 }).lean();

    const byRole = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const roleMap = { student: 0, organizer: 0, admin: 0 };
    byRole.forEach((r) => {
      roleMap[r._id] = r.count;
    });

    res.json({
      users,
      stats: {
        total: users.length,
        ...roleMap,
      },
    });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/users/export", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select(REPORT_USER_FIELDS);

    const rows = [
      ["Name", "Email", "Role", "Created At"],
      ...users.map((u) => [
        u.name,
        u.email,
        u.role,
        u.createdAt ? fmtDate.format(new Date(u.createdAt)) : "",
      ]),
    ];

    sendCsv(res, "users-report.csv", rows);
  } catch (error) {
    fail(res, error);
  }
});

module.exports = router;
