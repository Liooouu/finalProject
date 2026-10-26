// TEMPORARY — a student whose enrolled face file is gone, so the recovery
// selfie is rejected by the server and the UI must offer a working retake.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({ email: "review.face@tracked.test" });
  const user = await User.create({
    email: "review.face@tracked.test",
    name: "Review Face",
    role: "student",
    program: "BSIT",
    yearLevel: 2,
    section: "A",
    password: "ReviewPass123!",
  });
  user.emailVerified = true;
  user.facePhoto = "/uploads/private-faces/review-missing.jpg";
  user.faceDescriptor = [];
  user.faceAttempts = 0;
  user.faceLockUntil = null;
  await user.save();
  console.log("seeded", user.email, user.facePhoto);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
