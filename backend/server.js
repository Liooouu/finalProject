const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const connectDB = require("./config/db");
const { freePort } = require("./scripts/free-port");
const { ensureAdmin } = require("./seedAdmin");
const { repairUserIndexes } = require("./services/repairUserIndexes");
const Event = require("./models/Event");
const User = require("./models/User");
const Attendance = require("./models/Attendance");
const Notification = require("./models/Notification");
const {
  STATUS,
  OPEN_STATUS_FILTER,
  eventEndAt,
  shouldAutoGoLive,
  shouldAutoFinish,
  eventLiveNotification,
} = require("./services/eventLifecycle");

const authRoutes = require("./routes/authRoutes");
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

// ✅ HEALTH CHECK — used by the container HEALTHCHECK and by Coolify's health
// probe. Reports database state without failing on it: the process only starts
// listening after a successful connect, so a failing probe here would only
// produce restart loops around a database that is already coming back up.
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? "up" : "down",
    uptime: Math.round(process.uptime()),
  });
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
  .then(async () => {
    console.log("MongoDB Connected ✅");

    // ✅ INDEX REPAIRS — a database that ran an older schema keeps indexes whose
    // definition has since been corrected. Dropping them here means a deploy
    // heals the database without a manual migration step. Runs before accounts
    // are created so a first-run admin is never the only account that can exist.
    await repairUserIndexes();

    // ✅ FIRST-RUN ADMIN — only when explicitly configured (Coolify sets
    // ADMIN_EMAIL/ADMIN_PASSWORD). Idempotent: it never touches an existing
    // admin, so restarts are harmless. Locally these vars are unset and the
    // manual `npm run seed:admin` remains the way in.
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      try {
        await ensureAdmin({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
          name: process.env.ADMIN_NAME,
        });
      } catch (err) {
        // A bad seed must not take the API down: the app is still usable by
        // existing accounts, and the error is visible in the logs.
        console.error("[seed] Could not create the admin account:", err.message);
      }
    }

    // ✅ BACKGROUND JOB — keeps event statuses honest and handles attendance.
    //
    // Step 1  upcoming -> live    when the event's start time arrives
    // Step 2  absence marking + attendance-window notices
    // Step 3  -> finished          when the event's end time arrives
    //
    // Step 2 must run before step 3: an event leaves the "still open" query the
    // moment it finishes, so the absences for its last day would never be
    // written otherwise.
    const runLifecycleJob = async () => {
      try {
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentTime =
          now.getHours().toString().padStart(2, "0") +
          ":" +
          now.getMinutes().toString().padStart(2, "0");

        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        // ── STEP 1: go live automatically at the start time ──────────────
        const toGoLive = await Event.find({
          status: STATUS.UPCOMING,
          date: { $lte: todayEnd },
        });

        for (const event of toGoLive) {
          if (!shouldAutoGoLive(event, now)) continue;

          await Event.findByIdAndUpdate(event._id, { status: STATUS.LIVE });

          const recipients = await User.find({ role: { $in: ["student", "admin"] } }).select("_id");
          if (recipients.length > 0) {
            const { type, title, message } = eventLiveNotification(event);
            await Notification.insertMany(
              recipients.map((u) => ({
                user: u._id,
                type,
                title,
                message,
                relatedEvent: event._id,
              }))
            );
          }
          console.log(`[lifecycle] "${event.title}" is now live (auto)`);
        }

        // ── STEP 2: absence marking for events that are over ─────────────
        // Reconcile every run so students registered after an earlier pass
        // still get their absent record + hours.
        const candidateEvents = await Event.find({
          date: { $lte: todayEnd },
          ...OPEN_STATUS_FILTER,
        });

        for (const event of candidateEvents) {
          const endsAt = eventEndAt(event);
          if (!endsAt || now < endsAt) continue;

          // Get all students
          const students = await User.find({ role: "student" });

          for (const student of students) {
            // Check if student already has attendance (idempotent — no duplicates)
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
                communityServiceLog: [
                  { action: "penalty", hours: 8, note: "Marked absent (auto)" },
                ],
              });
              await attendance.save();

              // Send notification to student
              const notification = new Notification({
                user: student._id,
                type: "penalty",
                title: "Marked Absent",
                message: `You were marked as absent for event "${event.title}". 8 community service hours have been added to your community service hours.`,
                relatedEvent: event._id,
              });
              await notification.save();
            }
          }
        }

        // ✅ EVENT DAY REMINDERS — for events happening today

        const todaysEvents = await Event.find({
          date: { $gte: today, $lte: todayEnd },
          ...OPEN_STATUS_FILTER,
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
          ...OPEN_STATUS_FILTER,
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

        // ── STEP 3: finish automatically at the end time ─────────────────
        // Silent on purpose: the status label in the UI already tells the story,
        // and these events are in the past, so there is nothing to act on.
        const toFinish = await Event.find({
          ...OPEN_STATUS_FILTER,
          manualOverride: { $ne: true },
        });

        for (const event of toFinish) {
          if (!shouldAutoFinish(event, now)) continue;
          await Event.findByIdAndUpdate(event._id, {
            status: STATUS.FINISHED,
            autoFinishedAt: now,
          });
          console.log(`[lifecycle] "${event.title}" finished (auto)`);
        }
      } catch (err) {
        console.error("Error in attendance processing job:", err.message);
      }
    };

    // Run once at boot so a restart immediately repairs statuses, then every minute.
    runLifecycleJob();
    setInterval(runLifecycleJob, 60000);

    // A stale TrackED backend on this port should never block startup: free it
    // and bind again. This is what makes "node server.js" behave like
    // "npm run dev" / "npm run start".
    let attempt = 0;
    const listen = () => {
      const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });

      server.on("error", (err) => {
        if (err.code !== "EADDRINUSE") throw err;

        if (attempt < 1 && process.env.TRACKED_NO_AUTO_FREE !== "1") {
          attempt += 1;
          console.warn(`Port ${PORT} is already in use — freeing it and retrying...`);
          try {
            freePort(PORT);
          } catch (freeErr) {
            console.error(`Could not free port ${PORT}: ${freeErr.message}`);
          }
          setTimeout(listen, 500);
          return;
        }

        console.error(`\nPort ${PORT} is already in use.`);
        console.error("Free it and try again:");
        console.error(`  Windows (PowerShell): Get-NetTCPConnection -LocalPort ${PORT} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
        console.error(`  Windows (Git Bash):  netstat -ano | grep :${PORT} && taskkill //F //PID <pid>`);
        console.error(`  macOS/Linux:         lsof -ti tcp:${PORT} | xargs kill -9`);
        console.error(`\nOr set TRACKED_NO_AUTO_FREE=1 to skip the automatic stop.`);
        process.exit(1);
      });
    };

    listen();
  })
  .catch((err) => {
    console.error("DB CONNECTION FAILED ❌", err);
  });