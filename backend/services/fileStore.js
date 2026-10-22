const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");

const { GridFSBucket } = mongoose.mongo;

let bucket = null;

mongoose.connection.on("connected", () => {
  bucket = null;
});

function getBucket() {
  if (!mongoose.connection.db) {
    const err = new Error("Database is not connected");
    err.code = "NO_DATABASE";
    throw err;
  }
  if (!bucket) {
    bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
  }
  return bucket;
}

function contentTypeForExt(ext) {
  return ext.toLowerCase() === ".png" ? "image/png" : "image/jpeg";
}

function relativeName(url) {
  const value = String(url || "").replace(/^\/+/, "");
  if (!value.startsWith("uploads/")) return null;
  const name = value.slice("uploads/".length);
  return name || null;
}

function notFound() {
  const err = new Error("File not found");
  err.code = "FILE_NOT_FOUND";
  return err;
}

async function findFile(name) {
  const files = await getBucket()
    .find({ filename: name })
    .sort({ uploadDate: -1 })
    .limit(1)
    .toArray();

  if (files.length === 0) throw notFound();
  return files[0];
}

async function saveBuffer(buffer, { private: isPrivate = false, originalName = "", contentType = "" } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error("File is empty");
    err.code = "EMPTY_FILE";
    throw err;
  }

  const ext = path.extname(originalName || "").toLowerCase();
  const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : ".jpg";
  const name = `${isPrivate ? "private-faces/" : ""}${crypto.randomUUID()}${safeExt}`;
  const upload = getBucket().openUploadStream(name, {
    contentType: contentType || contentTypeForExt(safeExt),
    metadata: { originalName: originalName || name },
  });

  await new Promise((resolve, reject) => {
    upload.on("finish", resolve);
    upload.on("error", reject);
    upload.end(buffer);
  });

  return { filename: name, url: `/uploads/${name}` };
}

async function readBuffer(url) {
  const name = relativeName(url);
  if (!name) throw notFound();

  const file = await findFile(name);
  const chunks = [];
  const stream = getBucket().openDownloadStream(file._id);

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function sendFile(res, url, { cacheControl = "" } = {}) {
  const name = relativeName(url);
  if (!name) throw notFound();

  const file = await findFile(name);
  const ext = path.extname(name);

  res.setHeader("Content-Type", file.contentType || contentTypeForExt(ext));
  res.setHeader("Content-Length", String(file.length));
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (cacheControl) res.setHeader("Cache-Control", cacheControl);

  await new Promise((resolve, reject) => {
    const stream = getBucket().openDownloadStream(file._id);
    stream.on("error", reject);
    res.on("finish", resolve);
    res.on("close", resolve);
    stream.pipe(res);
  });
}

async function deleteByUrl(url) {
  const name = relativeName(url);
  if (!name) return 0;

  const files = await getBucket().find({ filename: name }).toArray();
  for (const file of files) {
    await getBucket().delete(file._id);
  }

  return files.length;
}

async function deleteByUrls(urls) {
  const unique = [...new Set((urls || []).filter(Boolean))];
  await Promise.all(unique.map((url) => deleteByUrl(url).catch(() => 0)));
}

module.exports = {
  saveBuffer,
  readBuffer,
  sendFile,
  deleteByUrl,
  deleteByUrls,
};
