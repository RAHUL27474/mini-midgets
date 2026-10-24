// Aakhri Local EP3 "1975": animates the AI stills (ep03/shots_ai/sNN.png; a dark placeholder until a shot exists) with directed camera moves
// and FX (rain, train-window light streaks, tube flicker, warm glow on the old man), title card, on-screen text, Hindi subtitles,
// grain and vignette, over ep03/build/mix.wav.
// node ep03_animatic.js [fps=60]            -> ep03/out/ep03_shorts_1080x1920.mp4 and ep03/out/ep03_youtube_1920x1080.mp4
// node ep03_animatic.js stills 2,25,57      -> preview PNGs at those seconds into ep03/out/preview/
const path = require('path'), fs = require('fs');
const NM = path.join(__dirname, '..', '..', '..', 'chai-pending-hai', 'render', 'node_modules');
const { createCanvas, GlobalFonts, loadImage } = require(path.join(NM, '@napi-rs', 'canvas'));
const ffmpeg = require(path.join(NM, 'ffmpeg-static'));
const { spawn, execFileSync } = require('child_process');
const T = require('./ep03_timing');

const EP = path.join(__dirname, '..', '..', 'ep03'), OUT = path.join(EP, 'out'), B = path.join(EP, 'build');
const W = 1080, H = 1920, XF = 0.4, TAU = Math.PI * 2;
const mode = process.argv[2] === 'stills' ? 'stills' : 'video', FPS = mode === 'video' ? Number(process.argv[2] || 60) : 30;
GlobalFonts.registerFromPath('C:/Windows/Fonts/NirmalaB.ttf', 'Deva');

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const wob = (t, f, seed) => Math.sin(t * f + seed) * 0.6 + Math.sin(t * f * 2.3 + seed * 1.7) * 0.3 + Math.sin(t * f * 5.1 + seed * 0.3) * 0.1;
function glow(c, x, y, r, rgb, a) { if (a <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
const flicker = (t, seed) => 0.5 + 0.5 * (0.6 * Math.sin(t * 7.3 + seed) + 0.4 * Math.sin(t * 13.1 + seed * 2));

const SHOTS = T.SHOTS, DUR = T.DUR;
const DLG = fs.existsSync(path.join(B, 'dialogue.json')) ? JSON.parse(fs.readFileSync(path.join(B, 'dialogue.json'), 'utf8')) : [];

// ---------- particles / FX
const R = rng(7);
const rain = Array.from({ length: 460 }, () => ({ x: R() * W * 1.3, y: R() * H, l: 40 + R() * 80, v: 1900 + R() * 900, a: 0.12 + R() * 0.25 }));
const streaks = Array.from({ length: 26 }, () => ({ y: R() * H, w: 200 + R() * 600, v: 1400 + R() * 1800, h: ['255,180,90', '255,240,200', '110,210,255', '255,110,90'][Math.floor(R() * 4)], o: R() * 4000 }));
const motes = Array.from({ length: 60 }, () => ({ x: R() * W, y: R() * H, r: 1.5 + R() * 3, p: R() * TAU, v: 6 + R() * 14 }));
function drawRain(c, t, amt, slant = 0.16) {
  c.save(); c.strokeStyle = '#d6e8ff'; c.lineCap = 'round';
  for (const d of rain) { const y = (d.y + t * d.v) % (H + 200) - 100, x = (d.x - y * slant) % (W * 1.3); c.globalAlpha = d.a * amt; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + d.l * slant, y + d.l); c.stroke(); }
  c.restore();
}
function drawStreaks(c, t, amt, y0 = 0, y1 = H) { // city lights rushing past the train windows
  c.save(); c.globalCompositeOperation = 'screen';
  for (const s of streaks) { const x = W + 300 - ((s.o + t * s.v) % (W + 900)), y = y0 + (s.y / H) * (y1 - y0); const g = c.createLinearGradient(x, 0, x + s.w, 0); g.addColorStop(0, `rgba(${s.h},0)`); g.addColorStop(0.5, `rgba(${s.h},${0.22 * amt})`); g.addColorStop(1, `rgba(${s.h},0)`); c.fillStyle = g; c.fillRect(x, y, s.w, 5); }
  c.restore();
}
function drawMotes(c, t, rgb, amt) { c.save(); c.globalCompositeOperation = 'screen'; for (const m of motes) { const y = (m.y - t * m.v + H) % H, x = m.x + Math.sin(t * 0.7 + m.p) * 20; glow(c, x, y, m.r * 3, rgb, 0.45 * amt * (0.5 + 0.5 * Math.sin(t * 2 + m.p))); } c.restore(); }
function tubeFlicker(c, t, lt, at, amt = 1) { for (const a of at) { const d = lt - a; if (d > 0 && d < 0.35) { const on = Math.sin(d * 90) > 0; c.fillStyle = `rgba(0,0,0,${on ? 0.05 : 0.45 * amt})`; c.fillRect(0, 0, W, H); } } }
function headlight(c, lt, x, y) { const k = ss(0, 3.5, lt); glow(c, x, y, 380 + 900 * k, '255,248,230', 0.35 + 0.45 * k); glow(c, x, y, 120 + 200 * k, '255,255,255', 0.7); }

// ---------- per-shot direction: camera {z0,z1,x0,x1,y0,y1} (x/y as a fraction of the spare room, -1..1), shake [amp, speed], fx
function steam(c, t, x0, y0, amt) { c.save(); c.globalCompositeOperation = 'screen'; for (let i = 0; i < 14; i++) { const k = ((i / 14) + t * 0.2) % 1; glow(c, x0 + Math.sin(t * 1.3 + i) * 30 * k, y0 - k * 360, 50 + 60 * k, '255,240,225', 0.14 * amt * Math.sin(k * Math.PI)); } c.restore(); }
function film(c, t, lt) { // 1975 flashback: sepia wash, gate flicker, fire glow
  c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(255,226,180)'; c.fillRect(0, 0, W, H); c.restore();
  c.fillStyle = 'rgba(255,220,170,' + (0.04 + 0.04 * Math.abs(Math.sin(t * 23) * Math.sin(t * 7))) + ')'; c.fillRect(0, 0, W, H);
  glow(c, W * 0.5, H * 0.7, 700, '255,120,40', 0.10 + 0.08 * flicker(t, 2));
  if (Math.sin(t * 3.1) > 0.97) { c.fillStyle = 'rgba(255,255,240,0.35)'; c.fillRect(W * (0.2 + 0.6 * Math.abs(Math.sin(t))), 0, 2, H); }
}
const DIRS = {
  s01: { cam: { z0: 1.0, z1: 1.12, y0: 0.3, y1: -0.1 }, shake: [0.8, 1], fx: (c, t) => drawMotes(c, t, '255,250,230', 0.3) },
  s02: { cam: { z0: 1.04, z1: 1.12 }, shake: [1.0, 1.5], fx: (c, t) => drawMotes(c, t, '255,240,210', 0.5) },
  s03: { cam: { z0: 1.12, z1: 1.02 }, shake: [0.6, 1], fx: (c, t) => drawMotes(c, t, '255,240,210', 0.8) },
  s04: { cam: { z0: 1.0, z1: 1.1 }, shake: [0.8, 1.5], fx: (c, t) => drawMotes(c, t, '255,240,210', 0.4) },
  s05: { cam: { z0: 1.0, z1: 1.14 }, shake: [0.6, 1.2], fx: (c, t) => drawMotes(c, t, '255,240,210', 0.9) },
  s06: { cam: { z0: 1.04, z1: 1.12 }, shake: [0.8, 1.2], fx: (c, t) => glow(c, W * 0.5, H * 0.3, 500, '170,255,190', 0.06) },
  s07: { cam: { z0: 1.0, z1: 1.16 }, shake: [0.5, 1], text: ['LAST LOCAL FIRE: UNKNOWN HERO SAVES INFANT', 0.4], fx: () => {} },
  s08: { cam: { z0: 1.0, z1: 1.1 }, shake: [2.0, 4], fx: (c, t, lt) => film(c, t, lt) },
  s09: { cam: { z0: 1.06, z1: 1.14 }, shake: [1.6, 3], fx: (c, t, lt) => film(c, t, lt) },
  s10: { cam: { z0: 1.0, z1: 1.1 }, shake: [1.4, 2.5], fx: (c, t, lt) => film(c, t, lt) },
  s11: { cam: { z0: 1.08, z1: 1.14 }, shake: [0.8, 1.4], fx: (c, t) => glow(c, W * 0.5, H * 0.35, 500, '170,255,190', 0.06) },
  s12: { cam: { z0: 1.0, z1: 1.12 }, shake: [0.6, 1], fx: () => {} },
  s13: { cam: { z0: 1.0, z1: 1.2 }, shake: [0.4, 0.8], text: ['Rescued infant: Sudha Kulkarni, 6 months', 0.5], fx: () => {} },
  s14: { cam: { z0: 1.12, z1: 1.04 }, shake: [0.6, 1], fx: () => {} },
  s15: { cam: { z0: 1.0, z1: 1.1 }, shake: [1.6, 6], text: ['भाग 4  »', 3.0, 'end'], fx: () => {} },
};

// ---------- frame
const cv = createCanvas(W, H), ctx = cv.getContext('2d');
const grain = [0, 1, 2].map(k => { const g = createCanvas(W / 2, H / 2), gc = g.getContext('2d'), id = gc.createImageData(W / 2, H / 2), r = rng(99 + k);
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gc.putImageData(id, 0, 0); return g; });
const vign = (() => { const g = createCanvas(W, H), c = g.getContext('2d'), r = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = r; c.fillRect(0, 0, W, H); return g; })();
const layer = createCanvas(W, H), lc = layer.getContext('2d');

// 2.5D parallax: every output pixel samples the still through its depth (Depth Anything V2), so near things (characters,
// foreground) shift and grow more than the background while the camera drifts and dollies - a moving camera, not a sliding photo.
const SRC = {}, CLIPS = {};
const warpBufs = [0, 1].map(() => { const cv = createCanvas(W, H), cx = cv.getContext('2d'), im = cx.createImageData(W, H); return { cv, cx, im, out: new Uint32Array(im.data.buffer) }; });
function warp(buf, s, z, px, py, ox, oy, dol, t = 0) {
  const { pix, dep } = s, { out } = buf, cx = W / 2, cy = H / 2, br = 0.012 * Math.sin(t * 1.7), ph = t * 1.3;
  const sway = new Float32Array(H); for (let y = 0; y < H; y++) sway[y] = 3.2 * Math.sin(ph + y * 0.0045) + 1.4 * Math.sin(ph * 1.9 + y * 0.011);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const d = dep[row + x], n = d * d, sc = z * (1 + dol * (d - 0.5) + br * n);           // near things breathe
      let sx = (cx + (x - cx - px - ox * d - sway[y] * n) / sc) | 0, sy = (cy + (y - cy - py - oy * d) / sc) | 0; // and sway (hair, cloth)
      if (sx < 0) sx = 0; else if (sx >= W) sx = W - 1;
      if (sy < 0) sy = 0; else if (sy >= H) sy = H - 1;
      out[row + x] = pix[sy * W + sx];
    }
  }
  buf.cx.putImageData(buf.im, 0, 0); return buf.cv;
}
const clipCache = new Map();
async function clipFrame(id, lt) { // real motion clip from Kaggle LTX (1080x1920 @60fps), held on its last frame if shorter than the shot
  const fr = CLIPS[id], f = fr[Math.min(fr.length - 1, Math.max(0, Math.floor(lt * 60)))];
  if (!clipCache.has(f)) { clipCache.set(f, await loadImage(f)); if (clipCache.size > 6) clipCache.delete(clipCache.keys().next().value); }
  return clipCache.get(f);
}
async function drawShot(c, img, sh, t, lt, bi = 0) {
  const D = DIRS[sh.id], cam = D.cam, p = ease(clamp(lt / sh.dur)), clip = !!CLIPS[sh.id], k = clip ? 0.25 : 1;
  const z = 1 + (lerp(cam.z0, cam.z1, p) - 1) * k, sx = wob(t, 1.1 * D.shake[1], 1) * D.shake[0] * k, sy = wob(t, 0.9 * D.shake[1], 4) * D.shake[0] * k;
  const px = lerp(cam.x0 || 0, cam.x1 || 0, p) * W * (z - 1) / 2 + sx, py = lerp(cam.y0 || 0, cam.y1 || 0, p) * H * (z - 1) / 2 + sy;
  if (clip) { const f = await clipFrame(sh.id, lt), sw = W * z, shh = H * z; c.drawImage(f, (W - sw) / 2 + px, (H - shh) / 2 + py, sw, shh); }
  else if (SRC[sh.id]) {
    const par = D.par ?? 34, dir = Math.sign((cam.x1 || 0) - (cam.x0 || 0)) || (sh.id.charCodeAt(2) % 2 ? 1 : -1);
    c.drawImage(warp(warpBufs[bi], SRC[sh.id], z, px, py, dir * lerp(-par, par, p), lerp(par * 0.25, -par * 0.25, p), 0.10 * p, t), 0, 0);
  } else c.drawImage(img, 0, 0, W, H);
  D.fx(c, t, lt, p);
  if (D.text) onScreen(c, D.text, lt, sh.dur);
}
function onScreen(c, [txt, at, where], lt, dur) {
  const a = ss(at, at + 0.4, lt) * (1 - ss(dur - 0.2, dur + 0.2, lt)); if (a <= 0) return;
  c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (where === 'end') { c.font = '74px Deva'; c.fillStyle = '#ffffff'; c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 18; c.fillText(txt, W / 2, 300); }
  else { c.font = 'bold 40px Consolas'; const w = c.measureText(txt).width + 60; c.fillStyle = 'rgba(10,10,14,0.6)'; c.fillRect((W - w) / 2, 1360, w, 74); c.fillStyle = '#f3e1b0'; c.fillText(txt, W / 2, 1398); }
  c.restore();
}
function titleCard(c, t) { // "आख़िरी लोकल" over the opening shot, plus the place/time stamp
  const a = ss(0.4, 1.0, t) * (1 - ss(3.0, 3.8, t));
  if (a > 0) { c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 24; c.fillStyle = '#fff3dc'; c.font = '120px Deva'; c.fillText('आख़िरी लोकल', W / 2, 620); c.font = '44px Deva'; c.fillStyle = '#e8d6b8'; c.fillText('एपिसोड 3 · 1975', W / 2, 700); c.restore(); }
  const b = ss(1.0, 1.4, t) * (1 - ss(3.4, 3.9, t));
  if (b > 0) { c.save(); c.globalAlpha = b; c.font = '40px Deva'; c.fillStyle = '#ffffff'; c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 10; c.fillText('अगली सुबह', 60, H - 120); c.restore(); }
}
function subtitle(c, t) {
  const s = DLG.find(s => t >= s.start - 0.1 && t <= s.end + 0.3); if (!s) return;
  const a = ss(s.start - 0.1, s.start + 0.15, t) * (1 - ss(s.end + 0.05, s.end + 0.3, t));
  c.save(); c.globalAlpha = a; c.font = '60px Deva'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 10; c.strokeStyle = 'rgba(0,0,0,0.78)'; c.lineJoin = 'round'; c.fillStyle = s.char === 'oldman' ? '#ffe2b0' : '#ffffff';
  const words = s.text.split(' '), lines = []; let cur = '';
  for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (c.measureText(tt).width > 920 && cur) { lines.push(cur); cur = w; } else cur = tt; } lines.push(cur);
  lines.forEach((l, i) => { const y = 1600 + (i - (lines.length - 1) / 2) * 78; c.strokeText(l, W / 2, y); c.fillText(l, W / 2, y); });
  c.restore();
}

async function frame(t, imgs) {
  let st = 0, i = 0; while (i < SHOTS.length - 1 && t >= st + SHOTS[i].dur) { st += SHOTS[i].dur; i++; }
  const sh = SHOTS[i], lt = t - st;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  await drawShot(ctx, imgs[sh.id], sh, t, lt, 0);
  const nx = SHOTS[i + 1];
  if (nx && lt > sh.dur - XF) { lc.clearRect(0, 0, W, H); await drawShot(lc, imgs[nx.id], nx, t, lt - sh.dur, 1); ctx.globalAlpha = ss(sh.dur - XF, sh.dur, lt); ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1; }
  titleCard(ctx, t);
  ctx.drawImage(vign, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.07; ctx.drawImage(grain[Math.floor(t * FPS) % 3], 0, 0, W, H); ctx.restore();
  subtitle(ctx, t);
  const fade = Math.min(ss(0, 0.6, t), 1 - ss(DUR - 0.9, DUR, t));
  if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fade})`; ctx.fillRect(0, 0, W, H); }
}

(async () => {
  const imgs = {}, missing = [];
  for (const s of SHOTS) {
    const ai = path.join(EP, 'shots_ai', `${s.id}.png`);
    const clip = path.join(EP, 'clips', `${s.id}.mp4`), fd = path.join(EP, 'build', 'clipframes', s.id);
    if (fs.existsSync(clip)) {
      if (!fs.existsSync(fd) || fs.statSync(clip).mtimeMs > fs.statSync(fd).mtimeMs) {
        fs.rmSync(fd, { recursive: true, force: true }); fs.mkdirSync(fd, { recursive: true });
        execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', clip, '-vf', `fps=60,scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}`, '-q:v', '2', path.join(fd, '%04d.jpg')]);
      }
      CLIPS[s.id] = fs.readdirSync(fd).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(fd, f));
    }
    if (!fs.existsSync(ai)) { missing.push(s.id); const ph = createCanvas(W, H), pc = ph.getContext('2d'); pc.fillStyle = '#0b1218'; pc.fillRect(0, 0, W, H); imgs[s.id] = ph; continue; }
    imgs[s.id] = await loadImage(ai);
    const dp = path.join(EP, 'build', 'depth', `${s.id}.png`);
    if (!CLIPS[s.id] && fs.existsSync(dp)) { // pixels + depth at output resolution for the parallax warp
      const a = createCanvas(W, H), ax = a.getContext('2d'); ax.imageSmoothingQuality = 'high'; ax.drawImage(imgs[s.id], 0, 0, W, H);
      const dm = await loadImage(dp), b = createCanvas(W, H), bx = b.getContext('2d'); bx.filter = 'blur(6px)'; bx.drawImage(dm, 0, 0, W, H);
      const dd = bx.getImageData(0, 0, W, H).data, dep = new Float32Array(W * H);
      for (let k = 0; k < dep.length; k++) dep[k] = dd[k * 4] / 255;
      SRC[s.id] = { pix: new Uint32Array(ax.getImageData(0, 0, W, H).data.buffer.slice(0)), dep };
    }
  }
  console.log(missing.length ? `AI shots missing (dark placeholder): ${missing.join(' ')}` : 'all 15 AI shots present',
    '| real motion clips:', Object.keys(CLIPS).join(' ') || 'none', '| parallax:', Object.keys(SRC).length);
  fs.mkdirSync(OUT, { recursive: true });
  if (mode === 'stills') {
    const pd = path.join(OUT, 'preview'); fs.mkdirSync(pd, { recursive: true });
    for (const s of process.argv[3].split(",").map(Number)) { await frame(s, imgs); fs.writeFileSync(path.join(pd, `t${String(s).padStart(5, '0')}.png`), await cv.encode('png')); }
    return console.log('stills ->', pd);
  }
  const MIX = path.join(B, 'mix.wav'), V = path.join(OUT, 'ep03_shorts_1080x1920.mp4'), Y = path.join(OUT, 'ep03_youtube_1920x1080.mp4');
  const args = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-'];
  if (fs.existsSync(MIX)) args.push('-i', MIX, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', V);
  const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round(DUR * FPS);
  for (let f = 0; f < N; f++) {
    await frame(f / FPS, imgs);
    const buf = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 600 === 0) console.log(`frame ${f}/${N}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  // YouTube 16:9: the vertical frame centred over a blurred, darkened copy of itself
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', V, '-filter_complex',
    '[0:v]split[a][b];[a]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=30:3,eq=brightness=-0.12[bg];[b]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', Y]);
  console.log('wrote', V, '\n      ', Y);
})();
