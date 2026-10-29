// Restore legacy disk-backed excuse attachments to GridFS without changing URLs.
// Dry run: node scripts/migrate-legacy-excuse-attachments.js
// Apply:   node scripts/migrate-legacy-excuse-attachments.js --apply
const path = require('path');
const fs = require('fs/promises');
const mongoose = require('mongoose');

async function migrateLegacyExcuseAttachments({ db, uploadsDir, apply = false, bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' }) }) {
  const letters = await db.collection('excuses').find({}, { projection: { attachments: 1, attachmentUrl: 1, submissionHistory: 1 } }).toArray();
  const urls = new Set(letters.flatMap(letter => [...(letter.attachments || []), letter.attachmentUrl, ...(letter.submissionHistory || []).flatMap(revision => [...(revision.attachments || []), revision.attachmentUrl])]).filter(Boolean));
  const result = { migrated: [], ready: [], alreadyStored: [], missing: [], skipped: [] };
  for (const url of urls) {
    // Only the original public excuse-upload naming format; never face photos,
    // nested/private directories, arbitrary disk paths or external URLs.
    const match = /^\/uploads\/(\d{13}-[a-z0-9]+\.(?:png|jpe?g|gif|webp|pdf|docx?))$/i.exec(url);
    if (!match) { result.skipped.push(url); continue; }
    const name = match[1];
    if (await db.collection('uploads.files').findOne({ filename: name })) { result.alreadyStored.push(url); continue; }
    const filename = path.resolve(uploadsDir, name);
    if (path.dirname(filename) !== path.resolve(uploadsDir)) throw new Error('Invalid legacy upload path');
    let stat;
    try { stat = await fs.lstat(filename); } catch (error) { if (error.code === 'ENOENT') { result.missing.push(url); continue; } throw error; }
    if (!stat.isFile()) { result.skipped.push(url); continue; }
    if (!apply) { result.ready.push(url); continue; }
    const bytes = await fs.readFile(filename);
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    const stream = bucket.openUploadStream(name, { contentType: types[path.extname(name).toLowerCase()], metadata: { originalName: name, migratedFromLegacyDisk: true } });
    await new Promise((resolve, reject) => { stream.once('finish', resolve); stream.once('error', reject); stream.end(bytes); });
    result.migrated.push(url);
  }
  return result;
}
module.exports = { migrateLegacyExcuseAttachments };
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
      const result = await migrateLegacyExcuseAttachments({ db: mongoose.connection.db, uploadsDir: path.join(__dirname, '../uploads'), apply: process.argv.includes('--apply') });
      console.log(JSON.stringify(result, null, 2));
    } finally { await mongoose.disconnect(); }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
