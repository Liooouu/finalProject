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

// Load all three model files (tiny detector + tiny landmarks + recognition).
async function loadModels(force = false) {
  const fa = await init();
  if (!force) {
    const allLoaded = ["tinyFaceDetector", "faceLandmark68TinyNet", "faceRecognitionNet"].every(
      (n) => fa.nets[n].loaded
    );
    if (allLoaded) return fa;
  }
  await Promise.all([
    fa.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH),
    fa.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
    fa.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH),
  ]);
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

// Verify that an image actually contains a face (used on enrollment uploads).
async function hasFace(imagePath) {
  try {
    await loadModels();
    const desc = await detectFaceDescriptor(imagePath);
    return !!desc;
  } catch (err) {
    return false;
  }
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
  hasFace,
  descriptorsMatch,
  distance: faceEuclideanDistance,
};