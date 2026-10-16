// Character matting for plain/gradient studio backgrounds, plus a cel-shade look filter.
const { createCanvas } = require('@napi-rs/canvas');

// weighted box blur (normalized convolution) of a channel using integral images; w = 0/1 weights
function nblur(src, w, sw, sh, r) {
  const n = sw * sh, I = new Float64Array((sw + 1) * (sh + 1)), Iw = new Float64Array((sw + 1) * (sh + 1));
  for (let y = 1; y <= sh; y++) { let rs = 0, rw = 0; for (let x = 1; x <= sw; x++) { const p = (y - 1) * sw + (x - 1); rs += src[p] * w[p]; rw += w[p]; I[y * (sw + 1) + x] = I[(y - 1) * (sw + 1) + x] + rs; Iw[y * (sw + 1) + x] = Iw[(y - 1) * (sw + 1) + x] + rw; } }
  const out = new Float32Array(n), ow = new Float32Array(n);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(sw, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(sh, y + r + 1);
    const S = (A) => A[y1 * (sw + 1) + x1] - A[y0 * (sw + 1) + x1] - A[y1 * (sw + 1) + x0] + A[y0 * (sw + 1) + x0];
    const ws = S(Iw); out[y * sw + x] = ws > 0 ? S(I) / ws : 0; ow[y * sw + x] = ws;
  }
  return [out, ow];
}
function flood(dist, sw, sh, lim, bottom = true) {
  const n = sw * sh, f = new Uint8Array(n), st = [];
  const push = p => { if (!f[p] && dist[p] < lim) { f[p] = 1; st.push(p); } };
  for (let x = 0; x < sw; x++) { push(x); if (bottom) push((sh - 1) * sw + x); }
  for (let y = 0; y < sh; y++) { push(y * sw); push(y * sw + sw - 1); }
  while (st.length) { const p = st.pop(), y = (p / sw) | 0, x = p - y * sw; if (x > 0) push(p - 1); if (x < sw - 1) push(p + 1); if (y > 0) push(p - sw); if (y < sh - 1) push(p + sw); }
  return f;
}
function keyPlain(im, { tol = 12, soft = 12, cropBottom = 0.93 } = {}) {
  const sw = im.width, sh = Math.floor(im.height * cropBottom), n = sw * sh;
  const cv = createCanvas(sw, sh), x = cv.getContext('2d'); x.drawImage(im, 0, 0);
  const id = x.getImageData(0, 0, sw, sh), d = id.data;
  const ch = [0, 1, 2].map(k => { const a = new Float32Array(n); for (let p = 0; p < n; p++) a[p] = d[p * 4 + k]; return a; });
  // pass 1: global border-colour key to find the rough subject, then dilate it
  let br = 0, bg = 0, bb = 0, bc = 0;
  for (let xx = 0; xx < sw; xx++) for (const y of [0, 1, 2, sh - 3, sh - 2, sh - 1]) { const p = y * sw + xx; br += ch[0][p]; bg += ch[1][p]; bb += ch[2][p]; bc++; }
  for (let y = 0; y < sh; y++) for (const xx of [0, 1, 2, sw - 3, sw - 2, sw - 1]) { const p = y * sw + xx; br += ch[0][p]; bg += ch[1][p]; bb += ch[2][p]; bc++; }
  br /= bc; bg /= bc; bb /= bc;
  // rough background = unsaturated (grey) and near the border luminance; anything tinted or much lighter/darker is subject
  const bl = 0.299 * br + 0.587 * bg + 0.114 * bb;
  const d0 = new Float32Array(n);
  for (let p = 0; p < n; p++) { const dr = ch[0][p] - br, dg = ch[1][p] - bg, db = ch[2][p] - bb, dL = (dr + dg + db) / 3, chroma = Math.hypot(dr - dL, dg - dL, db - dL); d0[p] = Math.max(chroma * 2, Math.abs(dL) * 0.5); }
  const f0 = flood(d0, sw, sh, 40);
  const w = new Float32Array(n); for (let p = 0; p < n; p++) w[p] = f0[p] ? 1 : 0;
  // dilate the subject (shrink weights) by 10px via a box blur threshold
  const [wd] = nblur(w, new Float32Array(n).fill(1), sw, sh, 10); const w2 = new Float32Array(n); for (let p = 0; p < n; p++) w2[p] = wd[p] > 0.999 ? 1 : 0;
  // pass 2: local background estimate from the surrounding background pixels (two radii to fill holes)
  const est = [0, 1, 2].map(k => { const [a, aw] = nblur(ch[k], w2, sw, sh, 28); const [b] = nblur(ch[k], w2, sw, sh, 90); const [, bw] = nblur(ch[k], w2, sw, sh, 90); const gl = [br, bg, bb][k]; const o = new Float32Array(n); for (let p = 0; p < n; p++) o[p] = aw[p] > 40 ? a[p] : (bw[p] > 40 ? b[p] : gl); return o; });
  // tint differences count more than brightness differences (the background is grey)
  const dist = new Float32Array(n);
  for (let p = 0; p < n; p++) { const dr = ch[0][p] - est[0][p], dg = ch[1][p] - est[1][p], db = ch[2][p] - est[2][p], dL = (dr + dg + db) / 3; dist[p] = Math.hypot(dr - dL, dg - dL, db - dL) * 2.0 + Math.abs(dL) * 0.7; }
  const f = flood(dist, sw, sh, tol + soft, false);
  const a0 = new Float32Array(n); for (let p = 0; p < n; p++) a0[p] = f[p] ? Math.min(1, Math.max(0, (dist[p] - tol) / soft)) : 1;
  // erode 1px then 3x3 soften
  const a1 = new Float32Array(n);
  for (let y = 0; y < sh; y++) for (let xx = 0; xx < sw; xx++) { const p = y * sw + xx; let m = a0[p]; if (xx > 0) m = Math.min(m, a0[p - 1]); if (xx < sw - 1) m = Math.min(m, a0[p + 1]); if (y > 0) m = Math.min(m, a0[p - sw]); if (y < sh - 1) m = Math.min(m, a0[p + sw]); a1[p] = m; }
  for (let y = 0; y < sh; y++) for (let xx = 0; xx < sw; xx++) {
    let s = 0, k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, x2 = xx + dx; if (yy < 0 || yy >= sh || x2 < 0 || x2 >= sw) continue; s += a1[yy * sw + x2]; k++; }
    d[(y * sw + xx) * 4 + 3] = Math.round((s / k) * 255);
  }
  x.putImageData(id, 0, 0);
  return cv;
}
// Cel-shade look: light smoothing, gentle luminance banding, inked edges.
function celShade(cv, { levels = 12, edge = 70, ink = 0.55, smooth = 1, band = 0.6 } = {}) {
  const sw = cv.width, sh = cv.height, x = cv.getContext('2d');
  const src = x.getImageData(0, 0, sw, sh).data, out = x.createImageData(sw, sh), o = out.data, n = sw * sh;
  const lum = new Float32Array(n);
  const px = (xx, y, k) => src[((Math.min(sh - 1, Math.max(0, y)) * sw) + Math.min(sw - 1, Math.max(0, xx))) * 4 + k];
  for (let y = 0; y < sh; y++) for (let xx = 0; xx < sw; xx++) {
    const p = y * sw + xx; let r = 0, g = 0, b = 0, k = 0;
    for (let dy = -smooth; dy <= smooth; dy++) for (let dx = -smooth; dx <= smooth; dx++) { r += px(xx + dx, y + dy, 0); g += px(xx + dx, y + dy, 1); b += px(xx + dx, y + dy, 2); k++; }
    r /= k; g /= k; b /= k;
    const L = 0.299 * r + 0.587 * g + 0.114 * b, q = (Math.round(L / 255 * (levels - 1)) / (levels - 1)) * 255, Lq = L + (q - L) * band, f = L > 0 ? Lq / L : 1;
    o[p * 4] = Math.min(255, r * f); o[p * 4 + 1] = Math.min(255, g * f); o[p * 4 + 2] = Math.min(255, b * f); o[p * 4 + 3] = src[p * 4 + 3];
    lum[p] = L;
  }
  for (let y = 1; y < sh - 1; y++) for (let xx = 1; xx < sw - 1; xx++) {
    const p = y * sw + xx;
    const gx = -lum[p - sw - 1] - 2 * lum[p - 1] - lum[p + sw - 1] + lum[p - sw + 1] + 2 * lum[p + 1] + lum[p + sw + 1];
    const gy = -lum[p - sw - 1] - 2 * lum[p - sw] - lum[p - sw + 1] + lum[p + sw - 1] + 2 * lum[p + sw] + lum[p + sw + 1];
    const e = Math.min(1, Math.max(0, (Math.hypot(gx, gy) - edge) / 120)) * ink;
    if (e > 0) { o[p * 4] *= 1 - e; o[p * 4 + 1] *= 1 - e; o[p * 4 + 2] *= 1 - e; }
  }
  x.putImageData(out, 0, 0);
  return cv;
}
module.exports = { keyPlain, celShade };
