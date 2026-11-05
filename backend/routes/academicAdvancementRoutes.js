const router = require("express").Router();
const { isValidObjectId } = require("mongoose");
const advancement = require("../services/academicAdvancement");
const { schoolYearStart } = require("../services/academicCalendar");

// Mounted behind protect + authorize("admin") in adminRoutes.
router.get("/", (req, res) => {
  const currentSchoolYear = Math.max(2026, schoolYearStart());
  res.set("Cache-Control", "no-store");
  res.json({ currentSchoolYear, sourceYears: Array.from({ length: currentSchoolYear - 2026 + 1 }, (_, index) => currentSchoolYear - index) });
});
router.post("/preview", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await advancement.preview(req.user._id, req.body.sourceYear));
  } catch (error) {
    res.status(error.status || 503).json({ message: error.status ? error.message : "Could not prepare the student masterlist. Please try again." });
  }
});
router.post("/:id/confirm", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid batch ID" });
    if (req.body.confirmed !== true) return res.status(400).json({ message: "Review and confirm the academic changes first." });
    res.json(await advancement.commit(req.user._id, req.params.id, req.body.retainedIds, req.body.graduateIds));
  } catch (error) {
    res.status(error.status || 503).json({ message: error.status ? error.message : "Could not complete the batch. Retry with the same selections; completed students will not advance again." });
  }
});
module.exports = router;
