// faces.js — optional "Photos of You" helper.
// Uses the face-api.js library (loaded from a CDN in index.html) entirely on-device.
// Everything here is guarded so that if the library or models fail to load, the rest
// of the app keeps working — this is a bonus feature, never a dependency.

const Faces = (function () {
  let ready = false;
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";

  // How close two faces must be to count as the same person (lower = stricter).
  const THRESHOLD = 0.55;

  // Load the models once, on first use. Returns false if unavailable.
  async function ensureReady() {
    if (ready) return true;
    if (typeof faceapi === "undefined") return false;
    try {
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      ready = true;
      return true;
    } catch (e) {
      console.error("face models failed to load", e);
      return false;
    }
  }

  // Get the "faceprint" (128 numbers) of the single main face in an image.
  async function describe(imageEl) {
    const result = await faceapi
      .detectSingleFace(imageEl)
      .withFaceLandmarks()
      .withFaceDescriptor();
    return result ? result.descriptor : null;
  }

  // Get faceprints of every face in an image.
  async function describeAll(imageEl) {
    const results = await faceapi
      .detectAllFaces(imageEl)
      .withFaceLandmarks()
      .withFaceDescriptors();
    return results.map(function (r) {
      return r.descriptor;
    });
  }

  // Does `target` (the selfie faceprint) appear among the faces in an image?
  function containsFace(faceList, target) {
    for (const face of faceList) {
      if (faceapi.euclideanDistance(face, target) < THRESHOLD) return true;
    }
    return false;
  }

  return {
    ensureReady: ensureReady,
    describe: describe,
    describeAll: describeAll,
    containsFace: containsFace,
  };
})();
