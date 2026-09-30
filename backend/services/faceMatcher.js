// backend/services/faceMatcher.js
// Server-side face verification using @vladmandic/face-api with a pure-JS
// TensorFlow backend (no native tfjs-node build required).
//
// Uses:
//   - @vladmandic/face-api@1.7.15  (face detection + recognition nets)
//   - @tensorflow/tfjs              (aliased as @tensorflow/tfjs-node so the
//                                    face-api node entry resolves without a
//                                    native build)
//   - jpeg-js / pngjs               (decode images into tensors ourselves since
//                                    tf.node.decodeImage does not exist here)
const path = require("path");
const fs = require("fs");

const { decode: decodeJpeg } = require("jpeg-js");
const { PNG } = require("pngjs");
const tf = require("@tensorflow/tfjs");

const MODEL_PATH = path.join(__dirname, "..", "models", "face");
const DEFAULT_INPUT_SIZE = 320;
const DEFAULT_SCORE_THRESHOLD = 0.4;

let faceapi = null;
let readyPromise = null;
let modelsLoaded = false;

async function init() {
  if (faceapi) return faceapi;
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    const fa = require("@vladmandic/face-api");
    // Register the pure-JS CPU backend explicitly.
    await tf.ready();
    tf.setBackend("cpu");
    faceapi = fa;
    return faceapi;
  })();
  return readyPromise;
}

// Load all three model files (tiny detector + full landmarks + recognition).
// Guarded by an explicit flag: checking net.loaded names was unreliable and
// caused the weights to be re-read from disk on every single match (~1s each).
async function loadModels(force = false) {
  const fa = await init();
  if (modelsLoaded && !force) return fa;
  await Promise.all([
    fa.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH),
    fa.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
    fa.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH),
  ]);
  modelsLoaded = true;
  console.log("[faceMatcher] models loaded from", MODEL_PATH);
  return fa;
}

// Decode a JPEG/PNG file into a uint8 [1, h, w, 3] tensor (0-255 values).
function decodeImageTensor(imagePath) {
  const buf = fs.readFileSync(imagePath);
  let width, height, data;
  if (/\.png$/i.test(imagePath)) {
    const png = PNG.sync.read(buf);
    width = png.width;
    height = png.height;
    data = png.data;
  } else {
    const jpg = decodeJpeg(buf, { useTArray: true, maxMemoryUsageInMB: 256 });
    width = jpg.width;
    height = jpg.height;
    data = jpg.data;
  }

  const rgbLen = width * height * 3;
  const rgb = new Uint8Array(rgbLen);
  for (let i = 0, j = 0; i < width * height * 4; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return tf.tensor3d(rgb, [height, width, 3]);
}

// Detect the largest face in an image and return its 128-d descriptor.
async function detectFaceDescriptor(imagePath) {
  const fa = await loadModels();
  const input = decodeImageTensor(imagePath);
  try {
    // Landmark alignment (via the full 68-point model) is required for accurate
    // descriptors — without it distances compress and strangers look alike.
    const result = await fa
      .detectSingleFace(
        input,
        new fa.TinyFaceDetectorOptions({
          inputSize: DEFAULT_INPUT_SIZE,
          scoreThreshold: DEFAULT_SCORE_THRESHOLD,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result) {
      throw Object.assign(new Error("No face detected in the image. Please look directly at the camera."), {
        code: "NO_FACE",
      });
    }
    return {
      descriptor: Array.from(result.descriptor),
      box: result.detection.box,
      score: result.detection.score,
    };
  } finally {
    input.dispose();
  }
}

// Enrolled reference photos never change unless the student re-enrolls (which
// writes a new filename), so their descriptor is cached in memory. Re-analysing
// the reference on every attempt doubled the cost of each match (~3.5s each pass
// on the pure-JS backend). Keyed by path + mtime + size so a replaced file is
// never served stale.
const descriptorCache = new Map();
const descriptorInFlight = new Map();
const DESCRIPTOR_CACHE_MAX = 200;

async function detectFaceDescriptorCached(imagePath) {
  const key = path.resolve(imagePath);
  let stat = null;
  try {
    stat = fs.statSync(imagePath);
  } catch {
    stat = null;
  }

  if (stat) {
    const hit = descriptorCache.get(key);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
      return hit.value;
    }
    const pending = descriptorInFlight.get(key);
    if (pending) return pending;
  }

  const promise = detectFaceDescriptor(imagePath)
    .then((value) => {
      if (stat) {
        if (descriptorCache.size >= DESCRIPTOR_CACHE_MAX) {
          descriptorCache.delete(descriptorCache.keys().next().value);
        }
        descriptorCache.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, value });
      }
      return value;
    })
    .finally(() => {
      descriptorInFlight.delete(key);
    });

  if (stat) descriptorInFlight.set(key, promise);
  return promise;
}

function clearDescriptorCache() {
  descriptorCache.clear();
}

// Compare two descriptors; returns true when they likely belong to the same person.
function descriptorsMatch(d1, d2, threshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.5")) {
  return faceEuclideanDistance(d1, d2) <= threshold;
}

function faceEuclideanDistance(d1, d2) {
  let sum = 0;
  for (let i = 0; i < d1.length; i++) {
    const d = d1[i] - d2[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

module.exports = {
  init,
  loadModels,
  detectFaceDescriptor,
  detectFaceDescriptorCached,
  clearDescriptorCache,
  descriptorsMatch,
  distance: faceEuclideanDistance,
};