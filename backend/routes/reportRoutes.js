const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const User = require("../models/User");
const academicPeriods = require("../services/academicPeriods");
const { attendanceRows, exportFormat, sendReport } = require("../services/reportExport");
const { protect, authorize } = require("../middleware/authMiddleware");
const { manilaDayRange } = require("../services/eventLifecycle");
const ManualAttendanceRequest = require("../models/ManualAttendanceRequest");
const { projectManualAttendance, manualPendingStatusStages } = require("../services/manualAttendanceView");

async function reviewedRecords(records) {
  if (!records.length) return records;
  const pending = await ManualAttendanceRequest.find({ status: "pending",
    event: { $in: records.map(record => record.event?._id || record.event) },
    student: { $in: records.map(record => record.student?._id || record.student) },
  }).select("event session sessionName action student status proposedStatus proposedHours effectiveAt submittedAt requestedBy").lean();
  return projectManualAttendance(records, pending, { includeUnrecorded: false });
}

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

function buildMatch({ startDate, endDate, eventId, sessionId, completionStatus }) {
  const match = {};
  if (sessionId) { if (!mongoose.Types.ObjectId.isValid(sessionId)) throw badRequest("Invalid session id"); match.session = new mongoose.Types.ObjectId(sessionId); }
  if (completionStatus) { if (!["completed","incomplete","absent","pending","excused"].includes(completionStatus)) throw badRequest("Invalid completion status"); match.completionStatus = completionStatus; }

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
  const periodMatch = await academicPeriods.attendanceFilter(query);
  if (Object.keys(periodMatch).length) match.$and = [periodMatch];

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

  return { match: { ...match, reportDeletedAt: null }, studentFilter };
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

function fail(res, error) {
  const status = error.status || 500;
  res.status(status).json({
    message: status >= 500 ? "Server error" : error.message || "Request failed",
  });
}

// Admin-only: router authorization above applies to this mutation too.
router.delete("/attendance/:id", async (req, res) => {
 try {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid attendance record." });
  const record = await Attendance.findById(req.params.id).lean();
  if (!record || record.reportDeletedAt) return res.status(404).json({ message: "This attendance record no longer exists in the report. Refresh the list." });
  if (await ManualAttendanceRequest.exists({ event: record.event, student: record.student, status: "pending" }))
   return res.status(409).json({ message: "Review the pending manual attendance request before deleting this record." });
  if (record.communityServiceHours > 0) {
    const result = await Attendance.updateOne({ _id: record._id, updatedAt: record.updatedAt,
      reportDeletedAt: null, communityServiceHours: record.communityServiceHours }, {
      $set: { reportDeletedAt: new Date(), reportDeletedBy: req.user._id || req.user.id },
      $inc: { __v: 1 },
    });
    if (!result.modifiedCount) return res.status(409).json({ message: "Attendance changed. Refresh and review it before deleting." });
    return res.json({ message: "Attendance removed from reports. The student's service hours were kept." });
  }
  const DeletedAttendance = require("../models/DeletedAttendance");
  // Archive first so a storage failure cannot lose the original record.
  await DeletedAttendance.updateOne({ attendanceId: record._id }, { $set: {
   event: record.event, student: record.student, deletedBy: req.user._id || req.user.id, record,
  } }, { upsert: true });
  const result = await Attendance.deleteOne({ _id: record._id, updatedAt: record.updatedAt, reportDeletedAt: null,
    ...(record.communityServiceHours == null ? { communityServiceHours: null } : { communityServiceHours: record.communityServiceHours }) });
  if (!result.deletedCount) return res.status(409).json({ message: "Attendance changed. Refresh and review it before deleting." });
  res.json({ message: "Attendance record deleted. Reports and service hours have been updated." });
 } catch (error) { fail(res, error); }
});

router.get("/attendance/service-ledger/:studentId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.studentId)) throw badRequest("Invalid student id");
    const records = await Attendance.find({ student: req.params.studentId })
      .populate("event", "title date time academicYearStart semester")
      .sort({ attendedAt: -1, _id: -1 });
    res.json({ records });
  } catch (error) { fail(res, error); }
});

router.get("/attendance", async (req, res) => {
  try {
    const { match, studentFilter } = await buildAttendanceMatch(req.query);

    // The report screen charts the aggregate results and lists only the latest
    // rows, but this endpoint used to send every matching record (with both
    // references populated) so the payload grew with the term. Pages ask for a
    // window instead; the totals still describe every matching record.
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 200);
    const requestedPage = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > Math.floor(Number.MAX_SAFE_INTEGER / limit)) {
      throw badRequest("Invalid attendance page");
    }

    const [attendance, totalRecords, statusStats, byEvent, students, matchedStudents, filters, events] =
      await Promise.all([
        Attendance.find(match)
          .populate("event", "title date time academicYearStart semester")
          .populate("student", "name email program yearLevel section")
          .sort({ attendedAt: -1, _id: -1 })
          .skip((requestedPage - 1) * limit)
          .limit(limit),
        Attendance.countDocuments(match),
        Attendance.aggregate([
          { $match: match },
          ...manualPendingStatusStages(),
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Attendance.aggregate([
          { $match: match },
          ...manualPendingStatusStages(),
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
        Event.find({}, "title date attendanceSessions").sort({ date: -1 }).limit(250).lean(),
      ]);

    const completionRows = await Attendance.aggregate([{ $match: { ...match, session: match.session || { $type: "objectId" } } }, ...manualPendingStatusStages(), { $group: { _id: "$completionStatus", count: { $sum: 1 } } }]);
    const completion = Object.fromEntries(completionRows.map(row => [row._id || "pending", row.count]));
    const statsMap = { present: 0, late: 0, absent: 0, pending: 0, excused: 0 };
    statusStats.forEach((s) => {
      statsMap[s._id] = s.count;
    });

    res.json({
      records: await reviewedRecords(attendance),
      pagination: { page: requestedPage, pageSize: limit, total: totalRecords, totalPages: Math.max(1, Math.ceil(totalRecords / limit)) },
      stats: {
        completion,
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
    const format = exportFormat(req.query);
    const { match, studentFilter } = await buildAttendanceMatch(req.query);
    const [records, selectedEvent] = await Promise.all([
      Attendance.find(match)
        .populate("student", "name firstName middleName lastName email program yearLevel section enrollmentStatus")
        .populate("event", "title date time academicYearStart semester attendanceSessions._id attendanceSessions.name attendanceSessions.timeInOpen")
        .lean(),
      isActiveFilter(req.query.eventId) ? Event.findById(req.query.eventId).select("title").lean() : null,
    ]);
    const rows = attendanceRows(await reviewedRecords(records));
    await sendReport(res, attendanceFilename(studentFilter, selectedEvent), rows, format);
  } catch (error) {
    fail(res, error);
  }
});

// One grouped pass over attendance instead of a find() per event. The old shape
// ran an extra query — and loaded every attendance document — for every event
// in the list, which is what made this report slow once the term filled up.
async function attendanceCountsByEvent() {
  const rows = await Attendance.aggregate([
    { $match: { reportDeletedAt: null } },
    ...manualPendingStatusStages(),
    {
      $group: {
        _id: "$event",
        total: { $sum: 1 },
        students: { $addToSet: "$student" },
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
      Event.find(academicPeriods.eventFilter(req.query)).populate("organizer", "name email").sort({ date: -1 }).lean(),
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
        endDate: event.endDate, endTime: event.endTime,
        attendanceStartTime: event.attendanceStartTime, attendanceEndTime: event.attendanceEndTime,
        attendanceSessions: (event.attendanceSessions || []).map(({ _id, name, timeInPolicy, activityStart, activityEnd, timeInOpen, onTimeDeadline, timeInCutoff, timeOutOpen, timeOutClose }) => ({ _id, name, timeInPolicy, activityStart, activityEnd, timeInOpen, onTimeDeadline, timeInCutoff, timeOutOpen, timeOutClose })),
        academicYearStart: event.academicYearStart ?? null,
        semester: event.semester ?? null,
        date: event.date,
        time: event.time,
        createdAt: event.createdAt,
        location: event.location,
        status: event.status,
        organizer: event.organizer,
        totalAttendees: count.students?.length || total,
        attendanceRecords: total,
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
      Event.find(academicPeriods.eventFilter(req.query)).populate("organizer", "name email").sort({ date: -1 }).lean(),
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
        totalAttendees: count.students?.length || count.total || 0,
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

    await sendReport(res, "events-report.csv", rows, exportFormat(req.query));
  } catch (error) {
    fail(res, error);
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select(REPORT_USER_FIELDS).sort({ createdAt: -1 }).lean();

    // Count each account once, from the same snapshot as the user ledger.
    // Promotion grants organizer access without changing the student identity.
    const roleMap = { student: 0, organizer: 0, admin: 0 };
    for (const user of users) {
      const reportRole = user.role === "student" && user.organizerAccess === true ? "organizer" : user.role;
      if (Object.hasOwn(roleMap, reportRole)) roleMap[reportRole] += 1;
    }

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
        u.role === "student" && u.organizerAccess === true ? "Student/Organizer" : u.role,
        u.createdAt ? fmtDate.format(new Date(u.createdAt)) : "",
      ]),
    ];

    await sendReport(res, "users-report.csv", rows, exportFormat(req.query));
  } catch (error) {
    fail(res, error);
  }
});

module.exports = router;
