const router = require('express').Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/authMiddleware');
const service = require('../services/idPhotoAttendance');
const Request = require('../models/ManualAttendanceRequest');
const Event = require('../models/Event');
const { canSubmitManualAttendance } = require('../services/manualAttendance');
const fileStore = require('../services/fileStore');
router.use(protect);
const handle = action => async (req, res) => {
  try { res.set('Cache-Control', 'no-store'); res.json(await action(req)); }
  catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Photo attendance is unavailable. Your local capture can be retried safely.' }); }
};
router.post('/prepare', authorize('organizer'), handle(req => service.prepare(req.user, req.body.eventId, new Date(), req.body.sessionId)));
router.post('/capture-time', authorize('organizer'), handle(req => service.captureTime(req.user, req.body)));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 8 } }).single('photo');
router.post('/captures', authorize('organizer'), (req, res, next) => upload(req, res, error => error ? res.status(400).json({ error: 'Capture one JPEG ID photo up to 3 MB.' }) : next()), handle(req => service.submit(req.user, req.body, req.file)));
router.get('/requests/:id/photo', async (req, res) => {
  try {
    if (!require('mongoose').isValidObjectId(req.params.id)) return res.status(404).end();
    const row = await Request.findById(req.params.id).lean();
    const event = row && await Event.findById(row.event).lean();
    const owner = row && (String(row.student) === String(req.user._id) || (req.user.role === 'organizer' && String(row.requestedBy) === String(req.user._id)));
    if (!row || !row.idPhotoUrl || new Date(row.photoExpiresAt) <= new Date() || !(owner || req.user.role === 'admin' || canSubmitManualAttendance(req.user, event))) return res.status(404).end();
    res.set('Content-Disposition', 'inline; filename="school-id.jpg"');
    await fileStore.sendFile(res, row.idPhotoUrl, { cacheControl: 'private, no-store' });
  } catch (error) { if (res.headersSent) return res.destroy(error); res.status(error.code === 'FILE_NOT_FOUND' ? 404 : 503).json({ error: 'ID evidence is unavailable or its retention period has ended.' }); }
});
module.exports = router;
