require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
(async () => {
 try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const rows = await mongoose.connection.collection('attendances').aggregate([
   { $group: { _id: { student: '$student', event: '$event' }, count: { $sum: 1 } } },
   { $match: { count: { $gt: 1 } } },
   { $group: { _id: null, duplicatePairs: { $sum: 1 }, surplusRows: { $sum: { $subtract: ['$count', 1] } } } }
  ]).toArray();
  const indexes = await mongoose.connection.collection('attendances').indexes();
  console.log(JSON.stringify({ duplicatePairs: rows[0]?.duplicatePairs || 0, surplusRows: rows[0]?.surplusRows || 0, uniqueEventStudentIndex: indexes.some(i => i.unique && i.key.event === 1 && i.key.student === 1) }));
 } catch (e) { console.log(JSON.stringify({ auditUnavailable: true, errorType: e.name })); process.exitCode = 1; }
 finally { await mongoose.disconnect(); }
})();
