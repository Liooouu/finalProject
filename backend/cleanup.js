const mongoose = require("mongoose");
require("dotenv").config();

async function cleanup() {
  await mongoose.connect(process.env.MONGO_URI);
  const Attendance = require("./models/Attendance");
  const result = await Attendance.deleteMany({});
  console.log(`Deleted ${result.deletedCount} attendance records`);
  await mongoose.disconnect();
}

cleanup();
