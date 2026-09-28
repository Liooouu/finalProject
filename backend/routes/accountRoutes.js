const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const faceMatcher = require("../services/faceMatcher");
const { protect, authorize } = require("../middleware/authMiddleware");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const prefix = file.fieldname === "face" ? "face" : "profile";
    cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif)"));
  },
});

// =======================
// GET ACCOUNT INFO
// =======================
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// UPDATE ACCOUNT INFO
// =======================
router.patch("/", protect, async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CHANGE PASSWORD
// =======================
router.patch("/password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "Current password incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// UPLOAD PROFILE PICTURE
// =======================
router.post("/picture", protect, upload.single("picture"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const pictureUrl = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: pictureUrl },
      { new: true }
    ).select("-password");

    res.json({ profilePicture: pictureUrl, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// ENROLL / UPDATE FACE PHOTO (student)
// =======================
// Stores a webcam-captured photo used as the face-match baseline for the
// "forgot PIN" recovery flow. Rejects uploads that don't contain a detectable
// face so a random photo can't be enrolled.
router.post(
  "/face",
  protect,
  authorize("student"),
  upload.single("face"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No face photo uploaded" });
    }

    const filePath = `uploads/${req.file.filename}`;
    try {
      const has = await faceMatcher.hasFace(filePath);
      if (!has) {
        fs.unlinkSync(filePath);
        return res
          .status(400)
          .json({ error: "No face detected in the photo. Please look directly at the camera and retake." });
      }

      const user = await User.findById(req.user._id);

      // Remove the old face photo to avoid growing storage with stale files.
      if (user.facePhoto) {
        const oldPath = path.join(__dirname, "..", user.facePhoto.replace(/^\//, ""));
        try {
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (e) {
          console.error("face cleanup error:", e.message);
        }
      }

      user.facePhoto = `/uploads/${req.file.filename}`;
      await user.save();

      res.json({ facePhoto: user.facePhoto });
    } catch (err) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {}
      console.error("FACE ENROLL ERROR:", err.message);
      res.status(500).json({ error: "Failed to process face photo. Please try again." });
    }
  }
);

// =======================
// DELETE USER ACCOUNT (Admin only)
// =======================
router.delete("/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can delete accounts" });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ error: "Cannot delete admin accounts" });
    }

    res.json({ message: "User account deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;