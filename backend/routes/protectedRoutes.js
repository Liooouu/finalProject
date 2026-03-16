const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/admin-data", protect, authorize("admin"), (req, res) => {
  res.json({ message: "This is admin-only data", user: req.user });
});

router.get("/student-data", protect, authorize("student"), (req, res) => {
  res.json({ message: "This is student-only data", user: req.user });
});

module.exports = router;