const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const manual = require("../services/manualAttendance");
const router = express.Router();
router.use(protect);
const handle = (action, status = 200) => async (req, res) => {
  try { res.status(status).json(await action(req)); }
  catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : "Manual attendance is temporarily unavailable. Please try again." }); }
};
router.get("/requests", handle(req => manual.list(req.user, req.query)));
router.post("/requests", handle(async req => ({ request: await manual.submit(req.user, req.body || {}) }), 201));
router.post("/requests/review", handle(req => manual.reviewBatch(req.user, req.body || {})));
router.get("/summary", handle(req => manual.summary(req.user)));
router.get("/review-events", handle(req => manual.reviewEvents(req.user)));
router.get("/reviewers", handle(req => manual.reviewers(req.user, req.query.eventId)));
router.put("/reviewers", handle(req => manual.assignReviewers(req.user, req.body || {})));
module.exports = router;
