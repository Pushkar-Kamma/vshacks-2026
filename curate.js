// curate.js — Candid's "automation brain".
// Plain browser JavaScript. No framework, no network.
// It does two jobs:
//   1) analyzePhoto(img) -> a "fingerprint" + a sharpness score for one photo
//   2) curate(photos)    -> groups near-duplicates, stars the sharpest, builds "moments"
//
// This is the piece that makes Candid an automation tool instead of a shared folder.

const Curate = (function () {
  // One small offscreen canvas we reuse for speed.
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Draw an image small and return its brightness (grayscale) values.
  function grayscalePixels(img, w, h) {
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data; // [r,g,b,a, r,g,b,a, ...]
    const gray = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      // standard brightness formula
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return gray;
  }

  // dHash: shrink to 9x8 and compare each pixel to its right neighbor -> 64 bits.
  // Two similar photos end up with almost identical fingerprints.
  function dHash(img) {
    const w = 9;
    const h = 8;
    const gray = grayscalePixels(img, w, h);
    let bits = "";
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w - 1; x++) {
        const left = gray[y * w + x];
        const right = gray[y * w + x + 1];
        bits += left > right ? "1" : "0";
      }
    }
    return bits; // 64-character string of "1" and "0"
  }

  // Sharpness ~ "variance of the Laplacian".
  // Blurry photos have soft edges -> low score. Crisp photos -> high score.
  function sharpness(img) {
    const w = 64;
    const h = 64;
    const gray = grayscalePixels(img, w, h);
    let sum = 0;
    let sumSquares = 0;
    let count = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        // How different is this pixel from its 4 neighbors? (edge strength)
        const edge =
          4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
        sum += edge;
        sumSquares += edge * edge;
        count++;
      }
    }
    const mean = sum / count;
    return sumSquares / count - mean * mean; // variance
  }

  // Count how many bits differ between two fingerprints (0 = identical).
  function hamming(a, b) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
    }
    return diff;
  }

  // Analyze one loaded <img>: returns its fingerprint + sharpness.
  function analyzePhoto(img) {
    return { phash: dHash(img), sharpness: sharpness(img) };
  }

  // Group near-duplicates with a simple greedy pass.
  // A photo joins the first group whose photo it is within `threshold` bits of.
  function groupDuplicates(photos, threshold) {
    if (threshold === undefined) threshold = 10;
    const groups = [];
    for (const photo of photos) {
      let placed = false;
      for (const group of groups) {
        if (hamming(photo.phash, group[0].phash) <= threshold) {
          group.push(photo);
          placed = true;
          break;
        }
      }
      if (!placed) groups.push([photo]);
    }
    return groups;
  }

  // Split photos into "moments" by capture time. A big time gap starts a new moment.
  function groupMoments(photos, windowMs) {
    if (windowMs === undefined) windowMs = 60 * 1000; // 1 minute
    const sorted = photos.slice().sort(function (a, b) {
      return a.takenAt - b.takenAt;
    });
    let momentId = 0;
    let lastTime = null;
    for (const photo of sorted) {
      if (lastTime !== null && photo.takenAt - lastTime > windowMs) {
        momentId++;
      }
      photo.momentId = momentId;
      lastTime = photo.takenAt;
    }
    return photos;
  }

  // Main entry point. Photos must already have { phash, sharpness, takenAt }.
  // Marks the sharpest photo in each duplicate group as isBest, and tags moments.
  function curate(photos, options) {
    options = options || {};
    const threshold = options.threshold === undefined ? 10 : options.threshold;

    for (const p of photos) {
      p.isBest = false;
      p.groupId = null;
    }

    const groups = groupDuplicates(photos, threshold);
    groups.forEach(function (group, index) {
      let best = group[0];
      for (const p of group) {
        p.groupId = index;
        if (p.sharpness > best.sharpness) best = p;
      }
      best.isBest = true;
    });

    groupMoments(photos, options.momentWindowMs);

    const best = photos.filter(function (p) {
      return p.isBest;
    });
    return { photos: photos, groups: groups, best: best };
  }

  return {
    analyzePhoto: analyzePhoto,
    curate: curate,
    hamming: hamming,
  };
})();
