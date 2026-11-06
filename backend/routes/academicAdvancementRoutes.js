const router = require("express").Router();
const { isValidObjectId } = require("mongoose");
const advancement = require("../services/academicAdvancement");
const academicPeriods = require("../services/academicPeriods");

// Mounted behind protect + authorize("admin") in adminRoutes.
router.get("/", async (req, res) => {
  try {
    const currentSchoolYear = (await academicPeriods.read()).current?.startYear || Math.max(2026, new Date().getFullYear());
    const selectedSourceYear = req.query.sourceYear === undefined ? currentSchoolYear : Number(req.query.sourceYear);
    if (selectedSourceYear > currentSchoolYear) return res.status(400).json({message:"Choose the current or an earlier school year for advancement."});
    const { classes, students } = await advancement.studentOptions(selectedSourceYear);
    res.set("Cache-Control", "no-store");
    res.json({ currentSchoolYear, selectedSourceYear, classes, students, sourceYears: Array.from({ length: currentSchoolYear - 2026 + 1 }, (_, index) => currentSchoolYear - index) });
  } catch (error) { res.status(error.status || 503).json({ message: error.status ? error.message : "Could not load classes. Please try again." }); }
});
router.post("/preview", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const currentSchoolYear=(await academicPeriods.read()).current?.startYear || Math.max(2026,new Date().getFullYear());
    if (Number(req.body.sourceYear)>currentSchoolYear) return res.status(400).json({message:"Choose the current or an earlier school year for advancement."});
    if (!req.body.classScope) return res.status(400).json({ message: "Choose a class before preparing an academic update." });
    res.json(await advancement.preview(req.user._id, req.body.sourceYear, req.body.classScope, true));
  } catch (error) {
    res.status(error.status || 503).json({ message: error.status ? error.message : "Could not prepare the student masterlist. Please try again." });
  }
});
router.get("/history", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await advancement.history(req.query));
  } catch { res.status(503).json({ message: "Could not load previous academic updates. Please try again." }); }
});
router.get("/:id/results", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid batch ID" });
    res.set("Cache-Control", "no-store");
    res.json(await advancement.details(req.params.id, req.query));
  } catch (error) { res.status(error.status || 503).json({ message: error.status ? error.message : "Could not load saved results. Please try again." }); }
});
router.get("/:id/undo-preview", async (req,res)=>{
  try {
    if(!isValidObjectId(req.params.id))return res.status(400).json({message:"Invalid batch ID"});
    res.set("Cache-Control","no-store");
    res.json(await advancement.undoPreview(req.params.id));
  }catch(error){res.status(error.status||503).json({message:error.status?error.message:"Could not review this undo. Please try again."});}
});
router.post("/:id/undo", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid batch ID" });
    if (req.body.confirmed !== true) return res.status(400).json({ message: "Confirm which academic update to undo first." });
    res.json(await advancement.undo(req.user._id, req.params.id, req.body.reconcileStudentIds));
  } catch (error) {
    res.status(error.status || 503).json({ message: error.status ? error.message : "Undo could not be confirmed. Retry undo; restored students will not change again." });
  }
});
router.post("/:id/confirm", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid batch ID" });
    if (req.body.confirmed !== true) return res.status(400).json({ message: "Review and confirm the academic changes first." });
    res.json(await advancement.commit(req.user._id, req.params.id, req.body.retainedIds, req.body.graduateIds, req.body.selectedIds));
  } catch (error) {
    res.status(error.status || 503).json({ message: error.status ? error.message : "Could not complete the batch. Retry with the same selections; completed students will not advance again." });
  }
});
module.exports = router;
