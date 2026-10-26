// TEMPORARY — removes the face-recovery review account.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const res = await User.deleteMany({ email: "review.face@tracked.test" });
  const left = await User.countDocuments({ email: "review.face@tracked.test" });
  console.log(JSON.stringify({ deleted: res.deletedCount, left }));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
