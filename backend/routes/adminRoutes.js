const express = require("express");
const router = express.Router();

const { createOrganizer } = require("../controllers/adminController");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

router.post(
  "/create-organizer",
  verifyToken,
  verifyAdmin,
  createOrganizer
);

module.exports = router;