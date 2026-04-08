const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const protectedRoutes = require("./routes/protectedRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const accountRoutes = require("./routes/accountRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ MIDDLEWARES
app.use(cors());
app.use(express.json());

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/account", accountRoutes);

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

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB CONNECTION FAILED ❌", err);
  });