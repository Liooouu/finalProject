// Run during a maintenance window, before enabling multi-session captures.
// Dry run by default. Requires an explicit URI; never loads deployment secrets.
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Request = require('../models/ManualAttendanceRequest');
const apply = process.argv.includes('--apply');
const uri = process.env.TRACKED_MIGRATION_URI;
(async () => {
  if (!uri) throw new Error('Set TRACKED_MIGRATION_URI explicitly. Dry run is the default.');
  await mongoose.connect(uri, { autoIndex: false });
  for (const [Model, key, partial] of [
    [Attendance, { event: '$event', student: '$student', session: { $ifNull: ['$session', null] } }, {}],
    [Request, { event: '$event', student: '$student', session: { $ifNull: ['$session', null] }, action: { $ifNull: ['$action', 'time_in'] } }, { status: 'pending' }],
  ]) {
    const conflicts = await Model.aggregate([{ $match: partial }, { $group: { _id: key, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 }]);
    if (conflicts.length) throw new Error(`${Model.modelName}: duplicate attendance keys need manual reconciliation; no records were changed.`);
  }
  const oldAttendance = (await Attendance.collection.indexes()).filter(x => x.unique && !x.partialFilterExpression && Object.keys(x.key).length === 2 && x.key.event === 1 && x.key.student === 1);
  const oldRequests = (await Request.collection.indexes()).filter(x => x.unique && Object.keys(x.key).length === 2 && x.key.event === 1 && x.key.student === 1 && x.partialFilterExpression?.status === 'pending');
  console.log('Legacy indexes to replace:', oldAttendance.map(x => x.name), oldRequests.map(x => x.name));
  console.log('No events, attendance, service balances, or historical survey records will be rewritten.');
  if (apply) {
    await Request.collection.updateMany({ action: { $exists: false } }, { $set: { action: "time_in" } });
    // Create narrower replacement uniqueness guards before removing old guards.
    for (const Model of [Attendance, Request]) for (const [key, options] of Model.schema.indexes()) {
      const indexes = await Model.collection.indexes();
      const equivalent = indexes.some(index => JSON.stringify(index.key) === JSON.stringify(key) && !!index.unique === !!options.unique && JSON.stringify(index.partialFilterExpression || {}) === JSON.stringify(options.partialFilterExpression || {}));
      if (!equivalent) await Model.collection.createIndex(key, options);
    }
    for (const index of oldAttendance) await Attendance.collection.dropIndex(index.name);
    for (const index of oldRequests) await Request.collection.dropIndex(index.name);
    console.log('Session indexes applied. Re-running is safe.');
  } else console.log('Dry run complete. Use --apply in a maintenance window after backup.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
