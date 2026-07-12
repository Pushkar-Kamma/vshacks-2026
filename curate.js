const Curate = (function () {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  function grayscalePixels(img, w, h) {
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return gray;
  }

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
    return bits;
  }

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
        const edge =
          4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
        sum += edge;
        sumSquares += edge * edge;
        count++;
      }
    }
    const mean = sum / count;
    return sumSquares / count - mean * mean;
  }

  function hamming(a, b) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
    }
    return diff;
  }

  function analyzePhoto(img) {
    return { phash: dHash(img), sharpness: sharpness(img) };
  }

  function averageColor(img) {
    const w = 16, h = 16;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let r = 0, g = 0, b = 0;
    const count = w * h;
    for (let i = 0; i < count; i++) {
      r += data[i * 4];
      g += data[i * 4 + 1];
      b += data[i * 4 + 2];
    }
    return { r: r / count, g: g / count, b: b / count };
  }

  function sceneFromRgb(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    let s = 0, h = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === rn) h = (((gn - bn) / d) % 6 + 6) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
    }
    if (l < 0.20) return "night";
    if (s < 0.15) return l > 0.70 ? "bright" : "mono";
    if (h < 70 || h >= 330) return "warm";
    if (h < 170) return "green";
    if (h < 260) return "blue";
    return "vivid";
  }

  function analyzeScene(img) {
    const c = averageColor(img);
    return sceneFromRgb(c.r, c.g, c.b);
  }

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

    const best = photos.filter(function (p) {
      return p.isBest;
    });
    return { photos: photos, groups: groups, best: best };
  }

  return {
    analyzePhoto: analyzePhoto,
    analyzeScene: analyzeScene,
    curate: curate,
    hamming: hamming,
  };
})();
