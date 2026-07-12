const Faces = (function () {
  let ready = false;
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";

  const THRESHOLD = 0.55;

  function waitForFaceapi(timeout) {
    return new Promise(function (resolve) {
      if (typeof faceapi !== "undefined") { resolve(true); return; }
      const start = Date.now();
      const timer = setInterval(function () {
        if (typeof faceapi !== "undefined") { clearInterval(timer); resolve(true); }
        else if (Date.now() - start > timeout) { clearInterval(timer); resolve(false); }
      }, 150);
    });
  }

  async function ensureReady() {
    if (ready) return true;
    const libLoaded = await waitForFaceapi(8000);
    if (!libLoaded) return false;
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

  async function describe(imageEl) {
    const result = await faceapi
      .detectSingleFace(imageEl)
      .withFaceLandmarks()
      .withFaceDescriptor();
    return result ? result.descriptor : null;
  }

  async function describeAll(imageEl) {
    const results = await faceapi
      .detectAllFaces(imageEl)
      .withFaceLandmarks()
      .withFaceDescriptors();
    return results.map(function (r) {
      return r.descriptor;
    });
  }

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
