const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const connectDB = require("./config/db");
const Event = require("./models/Event");
const User = require("./models/User");
const Attendance = require("./models/Attendance");
const Notification = require("./models/Notification");

const authRoutes = require("./routes/authRoutes");
const protectedRoutes = require("./routes/protectedRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const accountRoutes = require("./routes/accountRoutes");
const reportRoutes = require("./routes/reportRoutes");
const studentRoutes = require("./routes/studentRoutes");
const organizerRoutes = require("./routes/organizerRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// ✅ MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
  res.send("TrackED Backend Running");
});

// ✅ GLOBAL ERROR HANDLER (VERY IMPORTANT)
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err.stack);
  res.status(500).json({
    message: err.message || "Server error",
  });
});

// ✅ CONNECT DB THEN START SERVER
connectDB()
  .then(() => {
    console.log("MongoDB Connected ✅");

    // ✅ BACKGROUND JOB: Auto-mark absent students every minute
    setInterval(async () => {
      try {
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentTime =
          now.getHours().toString().padStart(2, "0") +
          ":" +
          now.getMinutes().toString().padStart(2, "0");

        // Find events from previous days (event day is over) that haven't been processed
        const events = await Event.find({
          date: { $lt: today },
          attendanceProcessed: false,
        });

        for (const event of events) {
          // Get all students
          const students = await User.find({ role: "student" });

          for (const student of students) {
            // Check if student already has attendance
            const existingAttendance = await Attendance.findOne({
              event: event._id,
              student: student._id,
            });

            if (!existingAttendance) {
              // Create absent attendance with 8 hours community service
              const attendance = new Attendance({
                event: event._id,
                student: student._id,
                attendedAt: now,
                status: "absent",
                communityServiceHours: 8,
              });
              await attendance.save();

              // Send notification to student
              const notification = new Notification({
                user: student._id,
                type: "penalty",
                title: "Marked Absent",
                message: `You were marked as absent for event "${event.title}". 8 community service hours have been added to your record.`,
                relatedEvent: event._id,
              });
              await notification.save();
            }
          }

          // Mark event as processed
          event.attendanceProcessed = true;
          await event.save();
        }

        // ✅ EVENT DAY REMINDERS — for events happening today
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const todaysEvents = await Event.find({
          date: { $gte: today, $lte: todayEnd },
          status: { $ne: "closed" },
        });

        for (const event of todaysEvents) {
          let changed = false;

          const allStudents = await User.find({ role: "student" }).select("_id");

          const notifyNonAttendees = async (title, message, type) => {
            const attendeeIds = new Set(
              (
                await Attendance.find({ event: event._id }).select("student")
              ).map((a) => a.student.toString())
            );
            const missing = allStudents.filter(
              (s) => !attendeeIds.has(s._id.toString())
            );
            if (missing.length === 0) return;
            await Notification.insertMany(
              missing.map((s) => ({
                user: s._id,
                type,
                title,
                message,
                relatedEvent: event._id,
              }))
            );
          };

          // Attendance window just opened
          if (!event.openNotified && currentTime >= event.attendanceStartTime) {
            if (allStudents.length > 0) {
              await Notification.insertMany(
                allStudents.map((s) => ({
                  user: s._id,
                  type: "attendance",
                  title: "Attendance Open",
                  message: `Attendance is now open for "${event.title}". Mark your attendance before ${event.attendanceEndTime}.`,
                  relatedEvent: event._id,
                }))
              );
            }
            event.openNotified = true;
            changed = true;
          }

          // Closing soon (15 minutes before the window ends)
          const [endH, endM] = event.attendanceEndTime.split(":").map(Number);
          const cutoffTotal = Math.max(0, endH * 60 + endM - 15);
          const closingSoonTime =
            String(Math.floor(cutoffTotal / 60)).padStart(2, "0") +
            ":" +
            String(cutoffTotal % 60).padStart(2, "0");

          if (!event.closingSoonNotified && currentTime >= closingSoonTime) {
            await notifyNonAttendees(
              "Attendance Closing Soon",
              `The attendance window for "${event.title}" closes at ${event.attendanceEndTime}. Mark your attendance before you're marked absent!`,
              "attendance"
            );
            event.closingSoonNotified = true;
            changed = true;
          }

          // Window fully closed and student never checked in
          if (!event.closedNotified && currentTime >= event.attendanceEndTime) {
            await notifyNonAttendees(
              "Attendance Missed",
              `The attendance window for "${event.title}" has closed and you weren't marked as present. You may be marked absent for this event.`,
              "penalty"
            );
            event.closedNotified = true;
            changed = true;
          }

          if (changed) {
            await event.save();
          }
        }

        // ✅ UPCOMING EVENT REMINDER — 24 hours before the event starts
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const upcomingEvents = await Event.find({
          date: { $gte: now, $lte: in24h },
          status: { $ne: "closed" },
          upcomingNotified: false,
        });

        for (const event of upcomingEvents) {
          const students = await User.find({ role: "student" }).select("_id");
          if (students.length > 0) {
            await Notification.insertMany(
              students.map((s) => ({
                user: s._id,
                type: "info",
                title: "Upcoming Event Reminder",
                message: `Don't forget: "${event.title}" is happening on ${new Date(event.date).toLocaleDateString()} at ${event.time}${event.location ? ` (${event.location})` : ""}.`,
                relatedEvent: event._id,
              }))
            );
          }
          event.upcomingNotified = true;
          await event.save();
        }
      } catch (err) {
        console.error("Error in attendance processing job:", err.message);
      }
    }, 60000); // Run every 60 seconds

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB CONNECTION FAILED ❌", err);
  });