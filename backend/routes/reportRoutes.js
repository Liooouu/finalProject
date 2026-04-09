const express = require("express");
const router = express.Router();
const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");

router.use(protect, authorize("admin"));

router.get("/attendance", async (req, res) => {
  try {
    const { startDate, endDate, eventId } = req.query;
    
    const match = {};
    if (eventId) match.event = eventId;
    if (startDate || endDate) {
      match.attendedAt = {};
      if (startDate) match.attendedAt.$gte = new Date(startDate);
      if (endDate) match.attendedAt.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(match)
      .populate("event", "title date")
      .populate("student", "name email")
      .sort({ attendedAt: -1 });

    const stats = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = { present: 0, absent: 0, pending: 0 };
    stats.forEach((s) => {
      statsMap[s._id] = s.count;
    });

    const byEvent = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$event",
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
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
          absent: 1,
          pending: 1,
          attendanceRate: {
            $cond: [
              { $gt: ["$total", 0] },
              { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
      { $sort: { "eventDate": -1 } },
    ]);

    res.json({
      records: attendance,
      stats: {
        total: attendance.length,
        present: statsMap.present,
        absent: statsMap.absent,
        pending: statsMap.pending,
      },
      byEvent,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/attendance/export", async (req, res) => {
  try {
    const { startDate, endDate, eventId } = req.query;
    
    const match = {};
    if (eventId) match.event = eventId;
    if (startDate || endDate) {
      match.attendedAt = {};
      if (startDate) match.attendedAt.$gte = new Date(startDate);
      if (endDate) match.attendedAt.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(match)
      .populate("event", "title date")
      .populate("student", "name email")
      .sort({ attendedAt: -1 });

    const csv = [
      ["Event", "Event Date", "Student Name", "Student Email", "Status", "Marked At"].join(","),
      ...attendance.map((a) =>
        [
          `"${a.event?.title || ""}"`,
          a.event?.date ? new Date(a.event.date).toLocaleDateString() : "",
          `"${a.student?.name || ""}"`,
          a.student?.email || "",
          a.status,
          new Date(a.attendedAt).toLocaleString(),
        ].join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=attendance-report.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
        const absent = attendance.filter((a) => a.status === "absent").length;
        const pending = attendance.filter((a) => a.status === "pending").length;
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
          absent,
          pending,
          attendanceRate: total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0,
        };
      })
    );

    const statusCounts = {
      upcoming: events.filter((e) => e.status === "upcoming").length,
      live: events.filter((e) => e.status === "live").length,
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
    res.status(500).json({ message: error.message });
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
        return {
          title: event.title,
          date: event.date,
          location: event.location || "",
          status: event.status,
          organizer: event.organizer?.name || "",
          totalAttendees: attendance.length,
          present,
        };
      })
    );

    const csv = [
      ["Title", "Date", "Location", "Status", "Organizer", "Total Attendees", "Present"].join(","),
      ...eventsWithStats.map((e) =>
        [
          `"${e.title}"`,
          new Date(e.date).toLocaleDateString(),
          `"${e.location}"`,
          e.status,
          `"${e.organizer}"`,
          e.totalAttendees,
          e.present,
        ].join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=events-report.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    const byRole = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
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
    res.status(500).json({ message: error.message });
  }
});

router.get("/users/export", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select("name email role createdAt");

    const csv = [
      ["Name", "Email", "Role", "Created At"].join(","),
      ...users.map((u) =>
        [
          `"${u.name}"`,
          u.email,
          u.role,
          new Date(u.createdAt).toLocaleDateString(),
        ].join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=users-report.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
