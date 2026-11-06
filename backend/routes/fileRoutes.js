const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const Excuse = require("../models/Excuse");
const fileStore = require("../services/fileStore");

router.get("/:filename", protect, async (req, res) => {
  try {
    const name = req.params.filename;
    if (!/^[A-Za-z0-9_-]+\.(?:pdf|docx?|jpe?g|png)$/i.test(name)) return res.status(404).end();
    const url = `/uploads/${name}`;
    const letter = await Excuse.findOne({ $or: [{ attachments: url }, { attachmentUrl: url }, { "submissionHistory.attachments": url }] }).select("student");
    if (!letter || (String(letter.student) !== String(req.user._id) && !["organizer", "admin"].includes(req.user.role))) return res.status(404).end();
    res.setHeader("Content-Disposition", `${/\.(?:doc|docx)$/i.test(name) ? "attachment" : "inline"}; filename="${name}"`);
    await fileStore.sendFile(res, url, { cacheControl: "private, no-store" });
  } catch (error) {
    if (res.headersSent) return res.destroy(error);
    res.status(error.code === "FILE_NOT_FOUND" ? 404 : 503).json({ message: "Attachment is unavailable. Please try again." });
  }
});
module.exports = router;
