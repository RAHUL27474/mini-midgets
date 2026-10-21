// EP-2 "Maa" Canva cut, timed to ep02/shots.json. Each shot plays its Wan i2v anime clip (ep02/canva_clips/sNN.mp4,
// animated from the Canva still) when one exists, else the still (ep02/canva/sNN.png, design DAHYpG4NzZA) with a
// directed camera move plus FX (rain, steam, door reveal). Always: light flicker, knocks, phone buzz, Hindi subtitles,
// grain and vignette, over ep02/build/mix.wav when it exists.
// Usage: node anime/ep02/canva_animatic.js            -> anime/out/ep02_canva_anime_1080x1920.mp4
//        node anime/ep02/canva_animatic.js stills 5,22  -> PNG frames at those seconds into ep02/canva/preview/
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const { spawn, execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs'), path = require('path');

const W = 1080, H = 1920, FPS = 30, XF = 0.35, TAU = Math.PI * 2;
const DIR = __dirname, IMG = path.join(DIR, 'canva'), CLIPS = path.join(DIR, 'canva_clips');
const MIX = path.join(DIR, 'build', 'mix.wav'), DLG = path.join(DIR, 'build', 'dialogue.json');
const OUT = path.join(DIR, '..', 'out', 'ep02_canva_anime_1080x1920.mp4');
GlobalFonts.registerFromPath('C:/Windows/Fonts/NirmalaB.ttf', 'Deva');

// ---------- utils
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const wob = (t, f, seed) => Math.sin(t * f + seed) * 0.6 + Math.sin(t * f * 2.3 + seed * 1.7) * 0.3 + Math.sin(t * f * 5.1 + seed * 0.3) * 0.1;
function glow(c, x, y, r, rgb, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }

// ---------- timing + dialogue
const SHOTS = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8')).shots;
const DUR = SHOTS.reduce((a, s) => a + s.dur, 0);
const VOICE = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIR, 'voice.json'), 'utf8')).lines.map(l => [l.id, l.text]));
// planned starts from claude-d5; replaced by build/dialogue.json once the takes are picked
let SUBS = [['k1', 17.5, 20.9], ['sh1', 22.0, 24.6], ['sh2', 24.9, 27.0], ['sh3', 30.5, 34.5], ['sh4', 40.0, 43.8], ['k2', 48.5, 51.6]]
  .map(([id, s, e]) => ({ text: VOICE[id], s, e }));
if (fs.existsSync(DLG)) {
  const d = JSON.parse(fs.readFileSync(DLG, 'utf8'));
  const rows = Array.isArray(d) ? d : d.lines || Object.entries(d).map(([id, v]) => ({ id, ...v }));
  const got = rows.map(r => ({ text: r.text || VOICE[r.id], s: r.start ?? r.s, e: r.end ?? r.e ?? (r.start ?? r.s) + (r.dur || 2.5) })).filter(r => r.text && r.s != null);
  if (got.length) SUBS = got;
}

// ---------- particles
const R = rng(7);
const rain = Array.from({ length: 420 }, () => ({ x: R() * W * 1.3, y: R() * H, l: 40 + R() * 70, v: 1900 + R() * 900, a: 0.12 + R() * 0.25 }));
const motes = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H, r: 1.5 + R() * 3.5, p: R() * TAU, v: 8 + R() * 18 }));
const steamP = Array.from({ length: 26 }, () => ({ o: R(), dx: (R() - 0.5) * 50, r: 40 + R() * 60, p: R() * TAU }));
const bokeh = Array.from({ length: 30 }, () => ({ x: R() * W, y: R() * H * 0.7, r: 20 + R() * 70, h: R() < 0.5 ? '255,80,200' : '80,160,255', v: 900 + R() * 900 }));

let anim = false; // current shot is an animated clip: it already has its own rain/steam/door motion
function drawRain(c, t, amt, slant = 0.18) {
  if (anim) return;
  c.save(); c.strokeStyle = '#cfe3ff'; c.lineCap = 'round';
  for (const d of rain) {
    const y = (d.y + t * d.v) % (H + 200) - 100, x = (d.x - y * slant) % (W * 1.3);
    c.globalAlpha = d.a * amt; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + d.l * slant, y + d.l); c.stroke();
  }
  c.restore();
}
function drawSteam(c, t, x0, y0, amt, h = 380) {
  if (anim) return;
  c.save(); c.globalCompositeOperation = 'screen';
  for (const s of steamP) {
    const k = (s.o + t * 0.22) % 1, x = x0 + s.dx * k + Math.sin(t * 1.3 + s.p) * 26 * k, y = y0 - k * h;
    glow(c, x, y, s.r * (0.6 + k), '255,245,230', 0.16 * amt * Math.sin(k * Math.PI));
  }
  c.restore();
}
function drawMotes(c, t, rgb, amt) {
  c.save(); c.globalCompositeOperation = 'screen';
  for (const m of motes) { const y = (m.y - t * m.v + H) % H, x = m.x + Math.sin(t * 0.7 + m.p) * 20; glow(c, x, y, m.r * 3, rgb, 0.5 * amt * (0.5 + 0.5 * Math.sin(t * 2 + m.p))); }
  c.restore();
}
function drawBokehStreaks(c, t, amt) {
  if (anim) return;
  c.save(); c.globalCompositeOperation = 'screen';
  for (const b of bokeh) { const x = W - ((b.x + t * b.v) % (W + 400)) + 200; c.globalAlpha = 0.18 * amt; glow(c, x, b.y, b.r, b.h, 0.55); c.fillStyle = `rgba(${b.h},0.10)`; c.fillRect(x, b.y - b.r * 0.15, b.r * 4, b.r * 0.3); }
  c.restore();
}
const flicker = (t, seed) => 0.5 + 0.5 * (0.6 * Math.sin(t * 7.3 + seed) + 0.4 * Math.sin(t * 13.1 + seed * 2));

// ---------- per-shot direction: camera {z0,z1,x0,x1,y0,y1,rot} (x/y as fraction of spare room, -1..1), shake, fx(c, t, lt, p)
const knocks = [0.75, 1.25, 1.75];
const DIRS = {
  s01: { cam: { z0: 1.12, z1: 1.18, x0: 0.6, x1: -0.6 }, shake: [6, 9], fx: (c, t) => { drawBokehStreaks(c, t, 1); drawRain(c, t, 1.1, 0.45); } },
  s02: { cam: { z0: 1.05, z1: 1.16, y0: 0.2, y1: -0.1 }, shake: [5, 8], fx: (c, t) => { drawBokehStreaks(c, t * 1.4, 0.8); drawRain(c, t, 0.9, 0.5); } },
  s03: { cam: { z0: 1.0, z1: 1.14, y0: 0.4, y1: 0.0 }, shake: [1.2, 1], fx: (c, t) => { drawRain(c, t, 0.7); glow(c, 600, 380, 220, '255,190,90', 0.20 * flicker(t, 1)); } },
  s04: { cam: { z0: 1.08, z1: 1.13 }, shake: [1, 1.5], knock: knocks, fx: (c, t, lt) => {
    drawRain(c, t, 0.45); glow(c, 520, 1800, 420, '255,190,90', 0.22 + 0.10 * flicker(t, 3));
    for (const k of knocks) { const d = lt - k; if (d > 0 && d < 0.25) { c.fillStyle = `rgba(255,255,255,${0.06 * (1 - d / 0.25)})`; c.fillRect(0, 0, W, H); } } } },
  s05: { cam: { z0: 1.16, z1: 1.04, y0: -0.3, y1: 0 }, shake: [1, 1], fx: (c, t, lt) => {
    const o = anim ? 1 : ease(clamp(lt / 1.1)); // door swings open: dark slab slides off, warm light floods in
    if (!anim) { c.fillStyle = '#05070c'; c.fillRect(-W * o * 1.05, 0, W * (1 - o) + 4, H); }
    glow(c, W * 0.6, H * 0.45, 900, '255,190,110', 0.35 * (1 - ss(0.6, 2.2, lt)) * o); glow(c, 780, 600, 300, '255,180,90', 0.10 * flicker(t, 5)); } },
  s06: { cam: { z0: 1.03, z1: 1.12, y0: 0.1, y1: -0.15 }, shake: [2.4, 2.2], breathe: 0.012, fx: (c, t) => { drawRain(c, t, 0.35); glow(c, 200, 500, 380, '255,170,80', 0.16 * flicker(t, 6)); } },
  s07: { cam: { z0: 1.02, z1: 1.12, y0: -0.2, y1: 0.15 }, shake: [0.8, 1], fx: (c, t) => { glow(c, 950, 300, 300, '255,180,90', 0.14 * flicker(t, 7)); drawMotes(c, t, '255,210,150', 0.6); } },
  s08: { cam: { z0: 1.0, z1: 1.20, x0: 0.25, x1: 0.35, y0: -0.1, y1: -0.15 }, shake: [0.8, 1], fx: (c, t, lt) => {
    glow(c, 780, 830, 420, '255,255,240', 0.12 + 0.10 * (0.5 + 0.5 * Math.sin(lt * 4.5))); glow(c, 880, 120, 260, '255,190,90', 0.16 * flicker(t, 8)); } },
  s09: { cam: { z0: 1.0, z1: 1.09 }, shake: [0.6, 0.8], fx: (c, t) => { glow(c, 950, 300, 300, '255,180,90', 0.14 * flicker(t, 9)); drawMotes(c, t, '255,210,150', 0.7); } },
  s10: { cam: { z0: 1.12, z1: 1.04, y0: -0.6, y1: 0.3 }, shake: [1.2, 1], sob: true, fx: (c, t) => { drawRain(c, t, 0.4); glow(c, 260, 400, 420, '255,170,80', 0.18 * flicker(t, 10)); } },
  s11: { cam: { z0: 1.14, z1: 1.02, y0: -0.2, y1: 0.1 }, shake: [0.8, 1], fx: (c, t) => { drawRain(c, t, 0.25); glow(c, 150, 300, 420, '255,170,80', 0.18 * flicker(t, 11)); } },
  s12: { cam: { z0: 1.0, z1: 1.12, y0: 0.2, y1: 0.4 }, shake: [0.6, 1], fx: (c, t) => { drawSteam(c, t, 350, 1240, 1); drawSteam(c, t + 1.7, 620, 1260, 0.9); glow(c, 80, 120, 260, '255,200,120', 0.15 * flicker(t, 12)); } },
  s13: { cam: { z0: 1.02, z1: 1.12, x0: -0.1, x1: 0.1 }, shake: [1.4, 1.6], fx: (c, t) => { glow(c, 220, 400, 380, '255,170,80', 0.16 * flicker(t, 13)); } },
  s14: { cam: { z0: 1.12, z1: 1.0, y0: 0.5, y1: -0.2 }, shake: [0.5, 0.8], fx: (c, t, lt) => {
    drawSteam(c, t, 182, 1110, 1, 420); drawSteam(c, t + 2.3, 899, 1110, 1, 420); drawMotes(c, t, '255,200,170', 0.8);
    glow(c, 290, 600, 360, '255,170,120', 0.18 + 0.08 * Math.sin(lt * 1.5)); } },
  s15: { cam: { z0: 1.0, z1: 1.10, y0: 0.15, y1: 0.25 }, shake: [0.6, 0.8], buzz: [0.4, 1.6], fx: (c, t, lt) => {
    const on = ss(0.2, 0.5, lt); glow(c, 560, 1220, 520, '255,240,255', (0.10 + 0.08 * Math.sin(lt * 5)) * on); drawMotes(c, t, '255,200,220', 0.4); } },
};

// ---------- frame
const cv = createCanvas(W, H), ctx = cv.getContext('2d');
const grain = [0, 1, 2].map(k => { const g = createCanvas(W / 2, H / 2), gc = g.getContext('2d'), id = gc.createImageData(W / 2, H / 2), r = rng(99 + k);
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gc.putImageData(id, 0, 0); return g; });
const vign = (() => { const g = createCanvas(W, H), c = g.getContext('2d'), r = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = r; c.fillRect(0, 0, W, H); return g; })();
const layer = createCanvas(W, H), lc = layer.getContext('2d');

function drawShot(c, img, isClip, sh, t, lt) {
  anim = isClip;
  const D = DIRS[sh.id], cam = D.cam, p = ease(clamp(lt / sh.dur)), k = isClip ? 0.3 : 1; // clips move by themselves: keep the camera subtle
  let z = 1 + (lerp(cam.z0, cam.z1, p) - 1) * k + (isClip ? 0.02 : 0);
  if (D.breathe && !isClip) z += Math.sin(lt * 2.2) * D.breathe;
  let sx = wob(t, 1.1 * D.shake[1], 1) * D.shake[0] * k, sy = wob(t, 0.9 * D.shake[1], 4) * D.shake[0] * k, rot = wob(t, 0.5, 9) * 0.0015 * D.shake[0] * k;
  if (D.sob && !isClip) sy += Math.max(0, Math.sin(lt * 5.5)) * 5 * ss(0.8, 1.4, lt);
  for (const k of D.knock || []) { const d = lt - k; if (d > 0 && d < 0.3) { const e = Math.exp(-d * 18); sx += 14 * e; z += 0.012 * e; } }
  if (D.buzz) for (const b of D.buzz) { const d = lt - b; if (d > 0 && d < 0.6) { sx += Math.sin(d * 120) * 5; sy += Math.cos(d * 97) * 3; } }
  const sw = W * z, shh = H * z, ox = (sw - W) / 2, oy = (shh - H) / 2;
  const x = -ox + ox * lerp(cam.x0 || 0, cam.x1 || 0, p) + sx, y = -oy + oy * lerp(cam.y0 || 0, cam.y1 || 0, p) + sy;
  c.save(); c.translate(W / 2, H / 2); c.rotate(rot); c.translate(-W / 2, -H / 2);
  c.drawImage(img, x, y, sw, shh); c.restore();
  D.fx(c, t, lt, p);
}

function subtitle(c, t) {
  const s = SUBS.find(s => t >= s.s - 0.1 && t <= s.e + 0.25); if (!s) return;
  const a = ss(s.s - 0.1, s.s + 0.15, t) * (1 - ss(s.e, s.e + 0.25, t));
  c.save(); c.globalAlpha = a; c.font = '58px Deva'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 10; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineJoin = 'round'; c.fillStyle = '#fff6e6';
  const words = s.text.split(' '), lines = []; let cur = '';
  for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (c.measureText(tt).width > 900 && cur) { lines.push(cur); cur = w; } else cur = tt; } lines.push(cur);
  lines.forEach((l, i) => { const y = 1560 + (i - (lines.length - 1) / 2) * 76; c.strokeText(l, W / 2, y); c.fillText(l, W / 2, y); });
  c.restore();
}

function titleCard(c, t, title) { // Canva title card (lettering band only, screen-blended) over the opening ride
  const a = ss(0.3, 0.9, t) * (1 - ss(3.0, 3.7, t)); if (a <= 0) return;
  c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'screen';
  const k = 1 + t * 0.01; c.drawImage(title, 0, 640, W, 560, -W * (k - 1) / 2, 640 - 560 * (k - 1) / 2, W * k, 560 * k); c.restore();
}

// ---------- animated clips: frames pre-extracted at 30fps, 1080x1920 (minterpolated from Wan's 16fps)
const clipFrames = {};
function prepClips() {
  for (const s of SHOTS) {
    const mp4 = path.join(CLIPS, `${s.id}.mp4`), fd = path.join(CLIPS, 'frames', s.id);
    if (!fs.existsSync(mp4)) continue;
    if (!fs.existsSync(fd) || fs.statSync(mp4).mtimeMs > fs.statSync(fd).mtimeMs) {
      fs.rmSync(fd, { recursive: true, force: true }); fs.mkdirSync(fd, { recursive: true });
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', mp4, '-vf',
        `minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:vsbmc=1,scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}`,
        '-q:v', '2', path.join(fd, '%04d.jpg')]);
    }
    clipFrames[s.id] = fs.readdirSync(fd).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(fd, f));
  }
}
const cache = new Map();
async function source(sh, lt, imgs) { // clip frame for local time lt (slowed down if the clip is shorter than the shot), else the still
  const fr = clipFrames[sh.id]; if (!fr) return [imgs[sh.id], false];
  const span = sh.dur + XF, n = fr.length;
  const idx = clamp(Math.floor(n >= span * FPS ? lt * FPS : lt / span * n), 0, n - 1);
  const f = fr[idx];
  if (!cache.has(f)) { cache.set(f, await loadImage(f)); if (cache.size > 8) cache.delete(cache.keys().next().value); }
  return [cache.get(f), true];
}

async function frame(t, imgs, title) {
  // shots are laid end-to-end; the last XF seconds of each crossfade into the next
  let st = 0, i = 0; while (i < SHOTS.length - 1 && t >= st + SHOTS[i].dur) { st += SHOTS[i].dur; i++; }
  const sh = SHOTS[i], lt = t - st;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawShot(ctx, ...await source(sh, lt, imgs), sh, t, lt);
  const nx = SHOTS[i + 1];
  if (nx && lt > sh.dur - XF) { const nlt = lt - sh.dur, [nimg, nclip] = await source(nx, Math.max(0, nlt), imgs); lc.clearRect(0, 0, W, H); drawShot(lc, nimg, nclip, nx, t, nlt); ctx.globalAlpha = ss(sh.dur - XF, sh.dur, lt); ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1; }
  titleCard(ctx, t, title);
  ctx.drawImage(vign, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.07; ctx.drawImage(grain[Math.floor(t * FPS) % 3], 0, 0, W, H); ctx.restore();
  subtitle(ctx, t);
  const fade = Math.min(ss(0, 0.6, t), 1 - ss(DUR - 0.8, DUR, t));
  if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fade})`; ctx.fillRect(0, 0, W, H); }
}

(async () => {
  const imgs = {}; for (const s of SHOTS) imgs[s.id] = await loadImage(path.join(IMG, `${s.id}.png`));
  const title = await loadImage(path.join(IMG, 'title.png'));
  prepClips(); console.log('animated clips:', Object.keys(clipFrames).join(' ') || 'none', '| stills for the rest');
  if (process.argv[2] === 'stills') {
    const pd = path.join(IMG, 'preview'); fs.mkdirSync(pd, { recursive: true });
    for (const s of process.argv[3].split(',').map(Number)) { await frame(s, imgs, title); fs.writeFileSync(path.join(pd, `t${String(s).padStart(5, '0')}.png`), await cv.encode('png')); }
    return console.log('stills ->', pd);
  }
  const hasMix = fs.existsSync(MIX);
  const args = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-'];
  if (hasMix) args.push('-i', MIX, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT);
  console.log(hasMix ? 'with mix.wav' : 'no mix.wav yet - rendering silent', '|', SUBS.length, 'subtitles');
  const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round(DUR * FPS);
  for (let f = 0; f < N; f++) {
    await frame(f / FPS, imgs, title);
    const buf = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log(`frame ${f}/${N}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('wrote', OUT);
})();
