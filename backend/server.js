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
const { notifyUsers, eventRecipients } = require("./services/notify");
const { isMailEnabled } = require("./services/mailer");
const fileStore = require("./services/fileStore");
const {
  STATUS,
  OPEN_STATUS_FILTER,
  manilaClock,
  manilaDayRange,
  eventEndAt,
  eventStartsAt,
  eventLastCheckInAt,
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
let serverHandle = null;

// ✅ MIDDLEWARES
app.use(cors());
app.use(express.json());

// Face photos are biometric data: never serve the private directory directly.
app.use("/uploads/private-faces", (req, res) => {
  res.status(404).end();
});

app.get("/uploads/:filename", async (req, res) => {
  const { filename } = req.params;
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    return res.status(404).end();
  }

  try {
    await fileStore.sendFile(res, `/uploads/${filename}`, {
      cacheControl: "public, max-age=3600",
    });
  } catch (err) {
    if (err.code === "FILE_NOT_FOUND") return res.status(404).end();
    console.error("UPLOAD READ ERROR:", err.message);
    if (res.headersSent) return res.destroy(err);
    res.status(500).end();
  }
});

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/notifications", notificationRoutes);

// ✅ HEALTH CHECK — used by the container HEALTHCHECK and by Coolify's health
// probe. Reports database state without failing on it: the process only starts
// listening after a successful connect, so a failing probe here would only
// produce restart loops around a database that is already coming back up.
app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? "up" : "down",
    mail: (await isMailEnabled()) ? "on" : "off",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

const clientDist = path.join(__dirname, "..", "frontend-dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false }));
  app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("TrackED Backend Running");
  });
}

// ✅ GLOBAL ERROR HANDLER (VERY IMPORTANT)
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err.stack);

  // Malformed JSON body is a client error, not a server fault.
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }
  // Multer: file too large / rejected type.
  if (err.name === "MulterError") {
    return res.status(400).json({
      message: err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message,
    });
  }

  const status = err.status || err.statusCode || 500;
  // Never leak internal messages for an unexpected 500.
  res.status(status).json({
    message: status >= 500 ? "Server error" : err.message || "Request failed",
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
    let lifecycleRunning = false;
    const runLifecycleJob = async () => {
      // A run can outlast the 60s tick (large student lists). Overlapping runs
      // used to race on the same events and duplicate notifications.
      if (lifecycleRunning) return;
      lifecycleRunning = true;
      try {
        const now = new Date();
        // Day boundaries and the clock come from the school's zone (Asia/Manila),
        // not the container's UTC — otherwise a 5:45 PM window notifies at 1:45 AM.
        const { start: today, end: todayEnd } = manilaDayRange(now);
        const currentTime = manilaClock(now);

        // ── STEP 1: go live automatically at the start time ──────────────
        const toGoLive = await Event.find({
          status: STATUS.UPCOMING,
          manualOverride: { $ne: true },
          date: { $lte: todayEnd },
        });

        for (const event of toGoLive) {
          try {
            if (!shouldAutoGoLive(event, now)) continue;

            await Event.findByIdAndUpdate(event._id, { status: STATUS.LIVE });

            const recipients = await eventRecipients(event);
            if (recipients.length > 0) {
              const { type, title, message } = eventLiveNotification(event);
              await notifyUsers(recipients, {
                type,
                title,
                message,
                relatedEvent: event._id,
                event,
              });
            }
            console.log(`[lifecycle] "${event.title}" is now live (auto)`);
          } catch (err) {
            // One bad event must not stop the rest of the pass.
            console.error(`[lifecycle] go-live failed for "${event.title}":`, err.message);
          }
        }

        // ── STEP 2: absence marking for events that are over ─────────────
        // Reconcile every run so students registered after an earlier pass
        // still get their absent record + hours.
        const candidateEvents = await Event.find({
          date: { $lte: todayEnd },
          ...OPEN_STATUS_FILTER,
          manualOverride: { $ne: true },
        });

        for (const event of candidateEvents) {
          // Absences are written once the check-in window (plus grace) is over,
          // not merely when the event end passes — otherwise an event whose end
          // is earlier than its window would penalize students mid-window.
          const lastCheckIn = eventLastCheckInAt(event) || eventEndAt(event);
          if (!lastCheckIn || now < lastCheckIn) continue;

          try {
            // Get all students
            const students = await User.find({ role: "student" });

            for (const student of students) {
              try {
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

                  // Notify the student (in-app + email)
                  await notifyUsers([student], {
                    type: "penalty",
                    title: "Marked Absent",
                    message: `You were marked as absent for the event "${event.title}". 8 community service hours have been added to your total.`,
                    relatedEvent: event._id,
                    event,
                  });
                }
              } catch (err) {
                // A unique-index race (two replicas / a late self-mark) is fine;
                // anything else is logged and skipped so the pass continues.
                if (err.code !== 11000) {
                  console.error(
                    `[lifecycle] absence failed for "${event.title}" / ${student.email}:`,
                    err.message
                  );
                }
              }
            }
          } catch (err) {
            console.error(`[lifecycle] absence pass failed for "${event.title}":`, err.message);
          }
        }

        // ✅ EVENT DAY REMINDERS — for events happening today

        const todaysEvents = await Event.find({
          date: { $gte: today, $lte: todayEnd },
          ...OPEN_STATUS_FILTER,
        });

        for (const event of todaysEvents) {
          let changed = false;

          const allStudents = await User.find({ role: "student" }).select("_id name email");

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
            await notifyUsers(missing, {
              type,
              title,
              message,
              relatedEvent: event._id,
              event,
            });
          };

          const minutesOf = (value) => {
            const [h, m] = String(value || "0:0").split(":").map(Number);
            return (h || 0) * 60 + (m || 0);
          };
          const nowMin = minutesOf(currentTime);
          const startMin = minutesOf(event.attendanceStartTime);
          let endMin = minutesOf(event.attendanceEndTime);
          // A window can cross midnight (end <= start); lift the end so the
          // comparisons stay monotonic instead of treating it as "already past".
          if (endMin <= startMin) endMin += 24 * 60;
          const nowForWindow = nowMin < startMin ? nowMin + 24 * 60 : nowMin;

          // Attendance window just opened
          if (!event.openNotified && nowForWindow >= startMin) {
            if (allStudents.length > 0) {
              await notifyUsers(allStudents, {
                type: "attendance",
                title: "Attendance Open",
                message: `Attendance is now open for "${event.title}". Mark your attendance before ${event.attendanceEndTime}.`,
                relatedEvent: event._id,
                event,
              });
            }
            event.openNotified = true;
            changed = true;
          }

          // Closing soon (15 minutes before the window ends)
          if (!event.closingSoonNotified && nowForWindow >= endMin - 15) {
            await notifyNonAttendees(
              "Attendance Closing Soon",
              `The attendance window for "${event.title}" closes at ${event.attendanceEndTime}. Mark your attendance before you're marked late!`,
              "attendance"
            );
            event.closingSoonNotified = true;
            changed = true;
          }

          // Window fully closed and student never checked in
          if (!event.closedNotified && nowForWindow >= endMin) {
            await notifyNonAttendees(
              "Attendance Missed",
              `The attendance window for "${event.title}" has closed and you weren't marked as present. Check in now to avoid being marked late or absent.`,
              "attendance"
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
        // `date` is date-only (midnight), so comparing it to `now` fired the
        // reminder at the wrong time. Use the real start instant for the check.
        const upcomingEvents = await Event.find({
          date: { $gte: new Date(now.getTime() - 48 * 60 * 60 * 1000), $lte: in24h },
          ...OPEN_STATUS_FILTER,
          manualOverride: { $ne: true },
          upcomingNotified: false,
        });

        for (const event of upcomingEvents) {
          try {
            const startsAt = eventStartsAt(event);
            if (!startsAt || startsAt < now || startsAt > in24h) continue;

            const students = await User.find({ role: "student" }).select("_id name email");
            if (students.length > 0) {
              await notifyUsers(students, {
                type: "info",
                title: "Upcoming Event Reminder",
                message: `Don't forget: "${event.title}" is happening on ${new Date(event.date).toLocaleDateString()} at ${event.time}${event.location ? ` (${event.location})` : ""}.`,
                relatedEvent: event._id,
                event,
              });
            }
            event.upcomingNotified = true;
            await event.save();
          } catch (err) {
            console.error(`[lifecycle] reminder failed for "${event.title}":`, err.message);
          }
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
      } finally {
        lifecycleRunning = false;
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
      serverHandle = app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
      });

      serverHandle.on("error", (err) => {
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

    const shutdown = () => {
      const finish = () =>
        mongoose.connection.close(false).finally(() => process.exit(0));

      if (serverHandle) {
        serverHandle.close(finish);
      } else {
        finish();
      }

      setTimeout(() => process.exit(1), 25000).unref();
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    listen();
  })
  .catch((err) => {
    console.error("DB CONNECTION FAILED ❌", err);
  });