// ---------- anime layered animation (gen/anime/pick.json). Overrides the photo scenes when present.
const APICK_FILE = path.join(__dirname, 'gen', 'anime', 'pick.json');
const APICK = fs.existsSync(APICK_FILE) ? JSON.parse(fs.readFileSync(APICK_FILE, 'utf8')) : null;
const AIMG = {};
// crops the generator watermark strip; keyed layers also get the green screen removed (soft key + despill)
function prepLayer(im, key) {
  const sw = im.width, sh = Math.floor(im.height * 0.93);
  const cv = createCanvas(sw, sh), x = cv.getContext('2d'); x.drawImage(im, 0, 0);
  if (!key) return cv;
  const id = x.getImageData(0, 0, sw, sh), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], m = Math.max(r, b), gs = g - m;
    let a = 1;
    if (gs > 60) a = 0; else if (gs > 14) a = 1 - (gs - 14) / 46;
    if (g > 110 && g > m * 1.4) a = 0;
    if (gs > 0) d[i + 1] = Math.min(g, m + (a < 1 ? 4 : 12));
    d[i + 3] = Math.round(a * 255);
  }
  x.putImageData(id, 0, 0);
  // 1px erode of the alpha edge to kill green fringe
  const e = x.getImageData(0, 0, sw, sh), ed = e.data;
  for (let y = 1; y < sh - 1; y++) for (let xx = 1; xx < sw - 1; xx++) {
    const i = (y * sw + xx) * 4 + 3;
    if (d[i] > 0) { const mn = Math.min(d[i - 4], d[i + 4], d[i - sw * 4], d[i + sw * 4]); ed[i] = Math.min(d[i], (d[i] + mn) >> 1); }
  }
  x.putImageData(e, 0, 0);
  return cv;
}
async function loadAnime() {
  if (!APICK) return;
  for (const [k, v] of Object.entries(APICK.layers)) AIMG[k] = prepLayer(await loadImage(fs.readFileSync(path.join(__dirname, 'gen', 'anime', v.file))), !!v.key);
}
const AP = k => APICK.layers[k];
// background: cover-fit with zoom/drift
function abg(c, key, o = {}) {
  const im = AIMG[key], s = Math.max(W / im.width, H / im.height) * (o.z || 1.06);
  c.drawImage(im, W / 2 - im.width * s / 2 + (o.x || 0), H / 2 - im.height * s / 2 + (o.y || 0), im.width * s, im.height * s);
}
// character layer: centre anchored at (x,y), scaled to height h, with optional breathing/sway/talk motion
function achar(c, key, o) {
  const im = AIMG[key], s = o.h / im.height, t = o.t || 0, env = o.talk || 0;
  const rot = (o.rot || 0) + (o.sway ? 0.005 * Math.sin(t * 0.9 + (o.phase || 0)) : 0);
  const by = o.breathe ? 1 + 0.007 * Math.sin(t * 1.6 + (o.phase || 0)) : 1;
  c.save(); c.translate(o.x, o.y - env * 7); c.rotate(rot); c.scale((o.flip ? -1 : 1) * s * (1 + env * 0.012), s * by * (1 + env * 0.012));
  if (o.alpha != null) c.globalAlpha = o.alpha;
  c.drawImage(im, -im.width / 2, -im.height / 2);
  c.restore();
  return { toScreen: ([px, py]) => [o.x + (o.flip ? -1 : 1) * (px - im.width / 2) * s * Math.cos(rot) - (py - im.height / 2) * s * Math.sin(rot), o.y - env * 7 + (px - im.width / 2) * s * Math.sin(rot) + (py - im.height / 2) * s * by * Math.cos(rot)], s };
}
// limited-animation mouth flap drawn over the character's mouth (source-pixel coords from pick.json)
function mouthFlap(c, key, map, env, k = 1) {
  const m = AP(key).mouth; if (!m || env <= 0) return;
  const [sx, sy] = map.toScreen([m[0], m[1]]), w = m[2] * map.s * k;
  const im = AIMG[key], px = im.getContext('2d').getImageData(Math.max(0, m[0] - Math.round(m[2] * 1.1)), m[1], 1, 1).data;
  const skin = `rgb(${px[0]},${px[1]},${px[2]})`;
  const g = c.createRadialGradient(sx, sy, w * 0.2, sx, sy, w * 0.95); g.addColorStop(0, skin); g.addColorStop(0.7, skin); g.addColorStop(1, skin.replace('rgb', 'rgba').replace(')', ',0)'));
  c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, w * 0.95, w * 0.62, 0, 0, TAU); c.fill();
  const open = Math.min(1, env * 1.2);
  c.fillStyle = '#4a1f1d'; c.beginPath(); c.ellipse(sx, sy + w * 0.08 * open, w * (0.42 + 0.1 * open), w * (0.05 + 0.3 * open), 0, 0, TAU); c.fill();
  if (open > 0.45) { c.fillStyle = '#f3e9e4'; c.beginPath(); c.ellipse(sx, sy - w * 0.08, w * 0.32, w * 0.07, 0, 0, TAU); c.fill(); }
  c.strokeStyle = 'rgba(70,30,25,0.6)'; c.lineWidth = Math.max(1.5, w * 0.03); c.beginPath(); c.ellipse(sx, sy + w * 0.08 * open, w * (0.42 + 0.1 * open), w * (0.05 + 0.3 * open), 0, 0, TAU); c.stroke();
}
const dustR = rng(31), DUST = Array.from({ length: 60 }, () => ({ x: dustR(), y: dustR(), r: 2 + dustR() * 5, sp: 0.4 + dustR() * 0.8, ph: dustR() * TAU }));
function dust(c, t, rgb, a = 0.5, drift = 0) {
  for (const d of DUST) { const y = ((d.y - t * 0.03 * d.sp) % 1 + 1) % 1, x = ((d.x + drift * t + Math.sin(t * 0.7 + d.ph) * 0.01) % 1 + 1) % 1; glow(c, x * W, y * H, d.r * 4, rgb, a * (0.4 + 0.6 * Math.sin(t * 2 + d.ph) ** 2)); }
}
function rays(c, x, y, t, a) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x, y);
  for (let i = 0; i < 9; i++) { const ang = i * TAU / 9 + t * 0.05, wdt = 0.09 + 0.05 * Math.sin(t * 0.8 + i); const g = c.createLinearGradient(0, 0, Math.cos(ang) * 1600, Math.sin(ang) * 1600); g.addColorStop(0, `rgba(255,230,180,${a * (0.6 + 0.4 * Math.sin(t * 1.3 + i * 2))})`); g.addColorStop(1, 'rgba(255,230,180,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(ang - wdt) * 1600, Math.sin(ang - wdt) * 1600); c.lineTo(Math.cos(ang + wdt) * 1600, Math.sin(ang + wdt) * 1600); c.closePath(); c.fill(); }
  c.restore();
}
if (APICK) {
  const A = [];
  const ascene = (a, b, fn) => A.push({ a, b, fn });
  const cam = t => 18 * Math.sin(t * 0.5);
  ascene(5, 8, (c, t) => {
    abg(c, 'room_full', { z: 1.06 + 0.03 * t, x: -8 * t }); nightGrade(c, 0.5);
    const g = AP('room_full').glow || [540, 1100]; glow(c, g[0], g[1], 260, '110,160,255', 0.28 + 0.08 * Math.sin(t * 3));
    c.save(); c.globalAlpha = ss(0.3, 0.9, t) * (1 - ss(2.4, 3, t)); c.textAlign = 'center'; c.fillStyle = '#e6ecf7';
    c.font = '30px UISB'; c.fillText('C H A I   P E N D I N G   H A I', W / 2, 250); c.font = '24px UI'; c.fillStyle = '#c9d4e8'; c.fillText('Episode 1  ·  Message', W / 2, 295); c.restore();
  });
  ascene(15, 18, (c, t) => {
    abg(c, 'road_bg', { z: 1.32, x: 120 - t * 80, y: 20 });
    dust(c, t, '255,225,170', 0.5, -0.25);
    achar(c, 'scooter_riders', { x: 540 + Math.sin(t * 1.3) * 10, y: 1240 + Math.sin(t * 18) * 4, h: 1150, t, rot: 0.012 * Math.sin(t * 9) });
    for (let i = 0; i < 3; i++) { const p = ((t * 0.9 + i / 3) % 1); const x = W + 200 - p * (W + 500); const g = c.createLinearGradient(x - 90, 0, x + 90, 0); g.addColorStop(0, 'rgba(40,18,8,0)'); g.addColorStop(0.5, 'rgba(40,18,8,0.55)'); g.addColorStop(1, 'rgba(40,18,8,0)'); c.fillStyle = g; c.fillRect(x - 90, 0, 180, H); }
    glow(c, 980, 120, 500, '255,220,160', 0.35 + 0.1 * Math.sin(t * 5));
  });
  ascene(18, 23, (c, t) => {
    const T = t + 18, env = talkAt(T, 's1'), cx = cam(t), sun = AP('tapri_bg').sun || [760, 760];
    abg(c, 'tapri_bg', { z: 1.1 + 0.015 * t, x: cx * 0.4 });
    rays(c, sun[0], sun[1], T, 0.08); dust(c, T, '255,225,170', 0.45, 0.02);
    const m = achar(c, 'friends_bench', { x: 540 + cx, y: 1330, h: 1180, t: T, breathe: true, sway: true, talk: env * 0.5 });
    mouthFlap(c, 'friends_bench', m, env);
    for (const s of AP('friends_bench').steam || []) { const [sx, sy] = m.toScreen(s); steam(c, sx, sy, T, 0.5, 0.8); }
    glow(c, sun[0], sun[1], 420, '255,230,180', 0.15);
  });
  ascene(23, 26, (c, t) => {
    const T = t + 23, env = talkAt(T, 'y1'), cx = cam(t);
    abg(c, 'blur_bg', { z: 1.08 + 0.02 * t, x: cx * 0.3 });
    dust(c, T, '255,235,190', 0.5, 0.03);
    const laugh = T > 24.6 ? Math.sin(T * 7) * 0.04 : 0;
    const m = achar(c, 'kabir_young_laugh', { x: 540 + cx, y: 1020, h: 1560, t: T, breathe: true, rot: laugh, talk: env });
    mouthFlap(c, 'kabir_young_laugh', m, env);
    for (const s of AP('kabir_young_laugh').steam || []) { const [sx, sy] = m.toScreen(s); steam(c, sx, sy, T, 0.9, 0.8); }
  });
  ascene(26, 30, (c, t) => {
    const T = t + 26, env = talkAt(T, 's2'), cx = cam(t) * 0.5;
    abg(c, 'sky_bg', { z: 1.08 + 0.03 * t, x: cx * 0.3 });
    const sun = AP('sky_bg').sun || [540, 620];
    rays(c, sun[0], sun[1], T, 0.1); glow(c, sun[0], sun[1], 520, '255,235,190', 0.3 + 0.05 * Math.sin(T * 2));
    const m = achar(c, 'sameer_close', { x: 540 + cx, y: 1060 - 10 * t, h: 1600 + 20 * t, t: T, breathe: true, sway: true, talk: env });
    mouthFlap(c, 'sameer_close', m, env);
    for (const s of AP('sameer_close').steam || []) { const [sx, sy] = m.toScreen(s); steam(c, sx, sy, T, 0.9, 0.8); }
    dust(c, T, '255,240,200', 0.4, 0.02);
  });
  ascene(30, 34, (c, t) => {
    const T = t + 30, walk = ss(30.0, 31.2, T), dip = ss(31.3, 32.4, T), dp = Math.sin(Math.PI * dip), z = 1 + 0.9 * Math.pow(ss(33.0, 34, T), 2);
    c.translate(540, 1000); c.scale(z, z); c.translate(-540, -1000);
    abg(c, 'dining_bg', { z: 1.08, x: -walk * 20 });
    const lamp = AP('dining_bg').lamp || [540, 640]; glow(c, lamp[0], lamp[1], 220, '255,215,150', 0.6 + 0.05 * Math.sin(T * 7));
    const pt = AP('dining_bg').paper || [600, 1250, 0.2];
    if (dip < 0.5) { c.save(); c.translate(pt[0], pt[1]); c.rotate(0.15); c.scale(pt[2], pt[2] * 0.35); c.globalAlpha = 1 - ss(0.3, 0.5, dip); c.drawImage(paper.c, -PW / 2, -PH / 2); c.restore(); }
    achar(c, 'kabir_news', { x: lerp(820, 540, easeOut(walk)), y: 1060 + dp * 130 + (walk < 1 ? Math.abs(Math.sin(T * 9)) * 6 : 0), h: 1500 + 60 * walk, t: T, breathe: true, rot: dp * 0.1, alpha: 1 });
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, W, H); nightGrade(c, 0.35);
  });
  ascene(48, 53, (c, t) => {
    const T = t + 48, env = talkAt(T, 'k3');
    const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#3a2412'); g.addColorStop(0.45, '#120c10'); g.addColorStop(1, '#0d1a38'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    glow(c, 0, 700, 700, '255,170,90', 0.25); glow(c, W, 1300, 800, '70,130,255', 0.3 + 0.06 * Math.sin(T * 3));
    const m = achar(c, 'kabir_face', { x: 540, y: 960, h: 1800 + 200 * (t / 5), t: T, breathe: true, talk: env * 0.6 });
    mouthFlap(c, 'kabir_face', m, env, 0.9);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18; const g2 = c.createLinearGradient(0, 0, W, 0); g2.addColorStop(0, 'rgba(255,170,90,1)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(70,130,255,1)'); c.fillStyle = g2; c.fillRect(0, 0, W, H); c.restore();
  });
  ascene(53, 56, (c, t) => {
    const T = t + 53, p = ss(53.1, 55.0, T), door = AP('corridor_bg').door || [820];
    abg(c, 'corridor_bg', { z: 1.1 + 0.05 * t, x: -t * 10 });
    const ph = T * 14;
    achar(c, 'kabir_walk', { x: lerp(160, door[0], p), y: 1150 + Math.abs(Math.sin(ph)) * 7 - p * 60, h: lerp(1450, 1150, p), t: T, rot: 0.02 * Math.sin(ph), alpha: 1 - ss(0.92, 1, p) });
    nightGrade(c, 0.5);
    c.fillStyle = `rgba(0,0,0,${ss(55.0, 55.6, T)})`; c.fillRect(0, 0, W, H);
  });
  ascene(56, 57.3, (c, t) => {
    abg(c, 'bedroom_bg', { z: 1.06 + 0.03 * t }); nightGrade(c, 0.5);
    const ph = AP('bedroom_bg').phone || [330, 1150]; glow(c, ph[0], ph[1], 200, '110,160,255', 0.35 + 0.1 * Math.sin(t * 3));
    c.save(); c.translate(ph[0], ph[1]); c.rotate(0.3); c.fillStyle = '#9cc3ff'; c.fillRect(-14, -24, 28, 48); c.restore();
  });
  S.unshift(...A);
}

