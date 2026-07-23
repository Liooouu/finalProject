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