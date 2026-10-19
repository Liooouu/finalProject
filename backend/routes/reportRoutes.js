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

// Safe account fields for reports: never hashes, PINs, device ids, or photos.
const REPORT_USER_FIELDS = "name email role program yearLevel section createdAt";

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
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.send(csvFromRows(rows));
}

function fail(res, error) {
  const status = error.status || 500;
  res.status(status).json({
    message: status >= 500 ? "Server error" : error.message || "Request failed",
  });
}

router.get("/attendance", async (req, res) => {
  try {
    const match = buildMatch(req.query);

    const attendance = await Attendance.find(match)
      .populate("event", "title date")
      .populate("student", "name email")
      .sort({ attendedAt: -1 });

    const stats = await Attendance.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statsMap = { present: 0, late: 0, absent: 0, pending: 0, excused: 0 };
    stats.forEach((s) => {
      statsMap[s._id] = s.count;
    });

    const byEvent = await Attendance.aggregate([
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
    ]);

    res.json({
      records: attendance,
      stats: {
        total: attendance.length,
        present: statsMap.present,
        late: statsMap.late,
        absent: statsMap.absent,
        pending: statsMap.pending,
        excused: statsMap.excused,
      },
      byEvent,
    });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/attendance/export", async (req, res) => {
  try {
    const match = buildMatch(req.query);

    const attendance = await Attendance.find(match)
      .populate("event", "title date")
      .populate("student", "name email")
      .sort({ attendedAt: -1 });

    const rows = [
      ["Event", "Event Date", "Student Name", "Student Email", "Status", "Marked At"],
      ...attendance.map((a) => [
        a.event?.title || "",
        a.event?.date ? fmtDate.format(new Date(a.event.date)) : "",
        a.student?.name || "",
        a.student?.email || "",
        a.status,
        a.attendedAt ? fmtDateTime.format(new Date(a.attendedAt)) : "",
      ]),
    ];

    sendCsv(res, "attendance-report.csv", rows);
  } catch (error) {
    fail(res, error);
  }
});

router.get("/events", async (req, res) => {
  try {
    const events = await Event.find()
      .populate("organizer", "name email")
      .sort({ date: -1 });

    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const attendance = await Attendance.find({ event: event._id });
        const present = attendance.filter((a) => a.status === "present").length;
        const late = attendance.filter((a) => a.status === "late").length;
        const absent = attendance.filter((a) => a.status === "absent").length;
        const pending = attendance.filter((a) => a.status === "pending").length;
        const excused = attendance.filter((a) => a.status === "excused").length;
        const total = attendance.length;

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
          absent,
          pending,
          excused,
          attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100 * 10) / 10 : 0,
        };
      })
    );

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
    const events = await Event.find()
      .populate("organizer", "name email")
      .sort({ date: -1 });

    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const attendance = await Attendance.find({ event: event._id });
        const present = attendance.filter((a) => a.status === "present").length;
        const late = attendance.filter((a) => a.status === "late").length;
        return {
          title: event.title,
          date: event.date,
          location: event.location || "",
          status: event.status,
          organizer: event.organizer?.name || "",
          totalAttendees: attendance.length,
          present,
          late,
        };
      })
    );

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
    const users = await User.find().select(REPORT_USER_FIELDS).sort({ createdAt: -1 });

    const byRole = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const roleMap = { student: 0, organizer: 0, admin: 0 };
    byRole.forEach((r) => {
      roleMap[r._id] = r.count;
    });

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name email role createdAt");

    res.json({
      users,
      stats: {
        total: users.length,
        ...roleMap,
      },
      recentUsers,
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
