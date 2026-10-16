// ---------- anime characters (front view; local units: head radius ~100, head centre at 0,0)
const layer = createCanvas(W, H), lctx = layer.getContext('2d');
const LINE = '#2a1a14';
// each character has their own face: Sameer = round face, warm skin, big amber eyes, thick brows, mole;
// Kabir = narrow face, fair skin, calm dark almond eyes, thin brows, neat hair (adult adds stubble + tired eyes)
const KABIR_FACE = { skin: '#f3c9a6', skinSh: '#d8a17d', faceW: 0.92, eyeW: 19, eyeH: 19, iris: '#2e1c12', brow: 6, hair: '#17110f' };
const LOOKS = {
  sameer: { skin: '#d79c6e', skinSh: '#b47a50', faceW: 1.07, eyeW: 24, eyeH: 29, iris: '#8a5426', brow: 11, mole: true, hair: '#1b1311', messy: true, top: '#c0392b', topSh: '#8f2a21', pants: '#3e5c86', kind: 'hoodie' },
  kabir: { ...KABIR_FACE, top: '#a3a8b0', jacket: '#4a6a94', pants: '#2c3440', kind: 'jacket' },
  kabirAdult: { ...KABIR_FACE, top: '#a9c4e6', pants: '#2c3440', kind: 'shirt', stubble: true, tired: true },
};
const VL = JSON.parse(fs.readFileSync(path.join(__dirname, 'voice', 'lines.json'), 'utf8'));
function talkAt(T, id) { const l = VL.find(v => v.id === id); if (!l) return 0; const f = Math.floor((T - l.start) * 30); return f < 0 || f >= l.env.length ? 0 : Math.min(1, l.env[f] * 1.3); }
const speaking = (T, id) => { const l = VL.find(v => v.id === id); return !!l && T >= l.start && T <= l.start + l.dur; };
function chaiGlass(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = 'rgba(255,245,230,0.6)'; c.beginPath(); c.moveTo(-24, -70); c.lineTo(24, -70); c.lineTo(19, 0); c.lineTo(-19, 0); c.closePath(); c.fill();
  c.fillStyle = '#b8682a'; c.beginPath(); c.moveTo(-22, -52); c.lineTo(22, -52); c.lineTo(19, -2); c.lineTo(-19, -2); c.closePath(); c.fill();
  c.fillStyle = '#d9975a'; c.beginPath(); c.ellipse(0, -52, 22, 5, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-15, -64); c.lineTo(-12, -6); c.stroke();
  c.restore();
}
function faceP(c) { c.beginPath(); c.moveTo(-98, -20); c.bezierCurveTo(-102, 60, -62, 118, 0, 140); c.bezierCurveTo(62, 118, 102, 60, 98, -20); c.bezierCurveTo(98, -125, -98, -125, -98, -20); c.closePath(); }
function drawPerson(c, o) {
  const L = LOOKS[o.who], t = o.t || 0, turn = o.turn || 0, sit = o.pose === 'sit';
  const bp = (t + (o.seed || 0)) % 3.3, bl = bp < 0.14 ? Math.abs(bp - 0.07) / 0.07 : 1;
  const bottom = sit ? 540 : 720;
  const arms = o.arms || { l: [-120, 520], r: [120, 520] };
  c.lineCap = 'round'; c.lineJoin = 'round';
  // back hair
  if (L.messy) { c.fillStyle = L.hair; c.beginPath(); for (let i = 0; i <= 18; i++) { const a = Math.PI * (0.93 + i * 1.14 / 18), r = i % 2 ? 150 + Math.sin(t * 5 + i) * 4 : 112; c.lineTo(Math.cos(a) * r, -18 + Math.sin(a) * r); } c.closePath(); c.fill(); }
  // legs
  if (sit) {
    c.fillStyle = L.pants; rr(c, -155, 470, 310, 130, 50); c.fill();
    c.fillRect(-125, 560, 85, 250); c.fillRect(40, 560, 85, 250);
    c.fillStyle = '#ece6dc'; c.beginPath(); c.ellipse(-82, 820, 58, 24, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(82, 820, 58, 24, 0, 0, TAU); c.fill();
  }
  // neck + torso
  const SKIN = L.skin, SKIN_SH = L.skinSh;
  c.fillStyle = SKIN_SH; c.fillRect(-30, 90, 60, 90);
  c.fillStyle = L.top; c.beginPath(); c.moveTo(-55, 150); c.quadraticCurveTo(-150, 162, -168, 235); c.lineTo(-172, bottom); c.lineTo(172, bottom); c.lineTo(168, 235); c.quadraticCurveTo(150, 162, 55, 150); c.closePath(); c.fill();
  let sleeve = L.top;
  if (L.kind === 'hoodie') {
    c.strokeStyle = L.topSh; c.lineWidth = 30; c.beginPath(); c.ellipse(0, 168, 82, 26, 0, 0, TAU); c.stroke();
    c.strokeStyle = '#f1e6da'; c.lineWidth = 5; c.beginPath(); c.moveTo(-22, 190); c.lineTo(-27, 300); c.moveTo(22, 190); c.lineTo(27, 300); c.stroke();
    c.fillStyle = L.topSh; rr(c, -95, 400, 190, 95, 32); c.fill();
  } else if (L.kind === 'jacket') {
    sleeve = L.jacket; c.fillStyle = L.jacket;
    for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * 55, 150); c.quadraticCurveTo(d * 150, 162, d * 168, 235); c.lineTo(d * 172, bottom); c.lineTo(d * 52, bottom); c.lineTo(d * 44, 300); c.lineTo(d * 30, 172); c.closePath(); c.fill(); }
    c.fillStyle = '#3a5677'; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * 32, 172); c.lineTo(d * 80, 165); c.lineTo(d * 50, 270); c.closePath(); c.fill(); }
  } else {
    c.fillStyle = '#d5e4f5'; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * 50, 150); c.lineTo(d * 4, 196); c.lineTo(d * 36, 210); c.closePath(); c.fill(); }
    c.fillStyle = '#7d93b3'; for (let yy = 240; yy < bottom; yy += 62) { c.beginPath(); c.arc(0, yy, 5, 0, TAU); c.fill(); }
  }
  // arms + hands
  for (const [d, key] of [[-1, 'l'], [1, 'r']]) {
    const [hx, hy] = arms[key], sx = d * 140, sy = 215;
    c.strokeStyle = sleeve; c.lineWidth = 62; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo((sx + hx) / 2 + d * 55, (sy + hy) / 2 + 45, hx, hy); c.stroke();
    if (o.glass === key) chaiGlass(c, hx, hy + 14, 1.1);
    c.fillStyle = SKIN; rr(c, hx - 30, hy - 16, 60, 42, 18); c.fill();
  }
  // head
  c.save(); c.translate(0, 120); c.rotate(o.tilt || 0); c.scale(L.faceW, 1); c.translate(0, -120);
  c.fillStyle = SKIN_SH; for (const d of [-1, 1]) { c.beginPath(); c.ellipse(d * 98, 22, 17, 28, 0, 0, TAU); c.fill(); }
  c.fillStyle = SKIN; faceP(c); c.fill();
  if (L.stubble) { c.save(); faceP(c); c.clip(); c.fillStyle = 'rgba(70,60,70,0.18)'; c.beginPath(); c.ellipse(0, 122, 88, 44, 0, 0, TAU); c.fill(); c.restore(); }
  c.fillStyle = 'rgba(240,120,110,0.28)'; for (const d of [-1, 1]) { c.beginPath(); c.ellipse(d * 58 + turn * 10, 60, 18, 9, 0, 0, TAU); c.fill(); }
  // eyes
  for (const d of [-1, 1]) {
    const ex = d * 42 + turn * 18, ey = 18;
    c.strokeStyle = LINE; c.lineCap = 'round';
    if (o.laugh) { c.lineWidth = 7; c.beginPath(); c.arc(ex, ey + 12, 18, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); continue; }
    const b = Math.max(bl, 0.08), EW = L.eyeW, EH = L.eyeH;
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, EW, EH * b, 0, 0, TAU); c.fill();
    const lx = ex + turn * 8 + (o.lookX || 0), ly = ey + 3 + (o.lookY || 0);
    c.save(); c.beginPath(); c.ellipse(ex, ey, EW, EH * b, 0, 0, TAU); c.clip();
    c.fillStyle = L.iris; c.beginPath(); c.ellipse(lx, ly, EW * 0.68, EH * 0.8, 0, 0, TAU); c.fill();
    c.fillStyle = '#1a0e08'; c.beginPath(); c.ellipse(lx, ly + 2, 8, 11, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(lx + 5, ly - 7, 5.5, 0, TAU); c.fill(); c.beginPath(); c.arc(lx - 5, ly + 8, 2.5, 0, TAU); c.fill();
    c.restore();
    c.lineWidth = 7; c.beginPath(); c.moveTo(ex - EW - 5, ey - 2 * b); c.quadraticCurveTo(ex, ey - (EH + 8) * b, ex + EW + 5, ey - 6 * b); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(ex + d * (EW + 2), ey - 9 * b); c.lineTo(ex + d * (EW + 11), ey - 15 * b); c.stroke();
    if (L.tired) { c.strokeStyle = 'rgba(90,60,70,0.45)'; c.lineWidth = 3; c.beginPath(); c.arc(ex, ey + 4, EW + 2, Math.PI * 0.25, Math.PI * 0.75); c.stroke(); }
  }
  if (L.mole) { c.fillStyle = '#4a2a1a'; c.beginPath(); c.arc(-54 + turn * 18, 54, 4.5, 0, TAU); c.fill(); }
  // brows, nose, mouth
  c.strokeStyle = L.hair; c.lineWidth = L.brow;
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * 20 + turn * 18, -30 - (o.sad ? 7 : 0)); c.lineTo(d * 62 + turn * 18, -38 + (o.sad ? 5 : 0)); c.stroke(); }
  c.strokeStyle = SKIN_SH; c.lineWidth = 4; c.beginPath(); c.moveTo(6 + turn * 24, 48); c.lineTo(turn * 24, 62); c.lineTo(8 + turn * 24, 64); c.stroke();
  const mx = turn * 16, my = 92, m = o.talk || 0;
  if (o.laugh) {
    c.fillStyle = '#7a2622'; c.beginPath(); c.moveTo(mx - 32, my - 8); c.quadraticCurveTo(mx, my + 46, mx + 32, my - 8); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mx - 28, my - 6); c.lineTo(mx + 28, my - 6); c.lineTo(mx + 24, my + 2); c.lineTo(mx - 24, my + 2); c.fill();
  } else if (m > 0.08) {
    c.fillStyle = '#7a2622'; c.beginPath(); c.ellipse(mx, my, 15, 3 + 13 * m, 0, 0, TAU); c.fill();
  } else {
    c.strokeStyle = '#8a3b2c'; c.lineWidth = 5; c.beginPath(); c.arc(mx, my - 22, o.sad ? 17 : 22, Math.PI * 0.27, Math.PI * 0.73); c.stroke();
  }
  // front hair
  c.fillStyle = L.hair;
  if (L.messy) {
    c.beginPath(); c.moveTo(-112, 30); c.bezierCurveTo(-138, -178, 138, -178, 112, 30); c.lineTo(108, -8);
    [[92, -30], [86, 8], [64, -38], [48, -4], [30, -48], [6, -8], [-14, -50], [-34, -6], [-56, -46], [-74, -2], [-92, -34], [-110, 4]]
      .forEach(([px, py], i) => c.lineTo(px, py + Math.sin(t * 4 + i) * 2.5));
    c.closePath(); c.fill();
  } else { // neat side part, fringe swept to one side
    c.beginPath(); c.moveTo(-104, 20); c.bezierCurveTo(-125, -160, 125, -160, 104, 20); c.lineTo(100, -30);
    [[70, -45], [40, -52], [10, -62], [-20, -74], [-45, -88], [-30, -60], [-62, -66], [-84, -40], [-100, -36]].forEach(p => c.lineTo(...p));
    c.closePath(); c.fill();
    c.fillRect(-106, -20, 14, 50); c.fillRect(92, -20, 14, 50);
  }
  c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 7; c.beginPath(); c.arc(-10, -40, 78, Math.PI * 1.15, Math.PI * 1.5); c.stroke();
  c.restore();
}
// draws a character onto c with scene lighting (gold = backlit sunset, night = blue room + warm lamp)
function person(c, x, y, s, o) {
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1; lctx.clearRect(0, 0, W, H);
  lctx.save(); lctx.translate(x, y); lctx.scale(s, s); drawPerson(lctx, o); lctx.restore();
  lctx.globalCompositeOperation = 'source-atop';
  if (o.light === 'gold') {
    lctx.fillStyle = 'rgba(120,55,30,0.16)'; lctx.fillRect(0, 0, W, H);
    const g = lctx.createRadialGradient(o.sunX, o.sunY, 0, o.sunX, o.sunY, 900); g.addColorStop(0, 'rgba(255,215,150,0.45)'); g.addColorStop(1, 'rgba(255,215,150,0)');
    lctx.fillStyle = g; lctx.fillRect(0, 0, W, H);
  } else if (o.light === 'night') {
    lctx.fillStyle = 'rgba(18,30,80,0.45)'; lctx.fillRect(0, 0, W, H);
    const g = lctx.createRadialGradient(o.lampX, o.lampY, 0, o.lampX, o.lampY, 650); g.addColorStop(0, 'rgba(255,190,120,0.3)'); g.addColorStop(1, 'rgba(255,190,120,0)');
    lctx.fillStyle = g; lctx.fillRect(0, 0, W, H);
  }
  lctx.globalCompositeOperation = 'source-over';
  c.drawImage(layer, 0, 0);
}
const handW = (x, y, s, h) => [x + h[0] * s, y + h[1] * s];
function tapriBg(c, T, sunX, sunY) {
  goldenSky(c, sunX, sunY, 110);
  c.fillStyle = 'rgba(180,100,60,0.45)'; for (let i = 0; i < 9; i++) c.fillRect(i * 130 - 40, 1050 - (i * 71 % 200), 120, 400);
  c.fillStyle = '#7a4226'; c.fillRect(0, 1300, W, H);
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#b8452e' : '#f3d9b8'; c.beginPath(); c.moveTo(610 + i * 52, 950); c.lineTo(662 + i * 52, 950); c.lineTo(636 + i * 52, 1010); c.closePath(); c.fill(); }
  c.fillStyle = '#5a2c18'; c.fillRect(605, 935, 420, 18); c.fillRect(630, 950, 12, 100); c.fillRect(996, 950, 12, 100);
  sitter(c, 900, 1120, 0.8, '#2a140c', { face: -1, arm: 0.6 });
  c.fillStyle = '#3b2014'; c.fillRect(630, 1040, 380, 290);
  c.fillStyle = '#2a1610'; c.beginPath(); c.ellipse(700, 1015, 44, 30, 0, 0, TAU); c.fill(); c.fillRect(736, 1000, 40, 8);
  steam(c, 700, 985, T, 0.8, 0.8);
}

scene(18, 23, (c, t) => { // S07 tapri — both friends with chai
  const T = t + 18;
  tapriBg(c, T, 540, 800);
  scooter(c, 545, 1330, 0.62, '#3a2116');
  billu(c, 502, 1208, 0.42, T);
  c.fillStyle = '#2b150c'; c.fillRect(60, 1395, 960, 32); c.fillRect(90, 1427, 24, 200); c.fillRect(966, 1427, 24, 200);
  const m = talkAt(T, 's1');
  const kArms = { l: [20, 345], r: [75, 330] }, sArms = { l: [-215, 235 + Math.sin(T * 4) * 25], r: [-40, 330] };
  person(c, 290, 925, 0.88, { who: 'kabir', t: T, seed: 1.1, turn: 0.4, lookX: 6, pose: 'sit', arms: kArms, glass: 'r', light: 'gold', sunX: 540, sunY: 800 });
  person(c, 790, 925, 0.88, { who: 'sameer', t: T, turn: -0.4, lookX: -6, pose: 'sit', talk: m, arms: sArms, glass: 'r', light: 'gold', sunX: 540, sunY: 800 });
  const [k1, k2] = handW(290, 925, 0.88, kArms.r), [s1, s2] = handW(790, 925, 0.88, sArms.r);
  steam(c, k1, k2 - 50, T, 0.45, 0.8); steam(c, s1, s2 - 50, T + 1, 0.45, 0.8);
  glow(c, 540, 800, 420, '255,230,180', 0.15);
});
scene(23, 26, (c, t) => { // S08 young Kabir laughing with his chai
  const T = t + 23;
  c.fillStyle = vgrad(c, 0, H, [[0, '#f2a865'], [0.55, '#ffd8a0'], [1, '#b8693a']]); c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(150,80,45,0.35)'; c.fillRect(640, 900, 440, 700); c.fillRect(0, 1100, 300, 600);
  for (const b of bokeh) glow(c, b.x, (b.y + t * 15) % H, b.r * 1.3, '255,240,200', b.a);
  const z = 1 + 0.03 * t; c.translate(540, 900); c.scale(z, z); c.translate(-540, -900);
  const arms = { l: [-5, 300], r: [70, 280] };
  person(c, 540, 760, 1.9, { who: 'kabir', t: T, laugh: !speaking(T, 'y1'), talk: talkAt(T, 'y1'), tilt: Math.sin(T * 7) * 0.05 * (T < 25.4 ? 1 : 0.3), pose: 'sit', arms, glass: 'r', light: 'gold', sunX: 900, sunY: 300 });
  const [hx, hy] = handW(540, 760, 1.9, arms.r); steam(c, hx, hy - 110, T, 1.1, 0.8);
});
scene(26, 30, (c, t) => { // S09 Sameer close-up, sun as a halo
  const T = t + 26;
  const z = 1 + 0.06 * t; c.translate(540, 760); c.scale(z, z); c.translate(-540, -760);
  goldenSky(c, 540, 640, 230);
  c.fillStyle = 'rgba(150,80,45,0.3)'; c.fillRect(0, 1150, W, 800);
  const m = talkAt(T, 's2');
  person(c, 540, 760, 1.9, { who: 'sameer', t: T, seed: 0.4, turn: -0.12, sad: true, talk: m, pose: 'sit', arms: { l: [-70, 540], r: [70, 520] }, glass: 'r', light: 'gold', sunX: 540, sunY: 640 });
  glow(c, 540, 560, 300, '255,235,190', 0.22);
});
scene(30, 34, (c, t) => { // S10 dining room — Kabir picks the newspaper up off the table
  const T = t + 30;
  const reach = ss(31.0, 32.0, T), lift = easeOut(ss(32.1, 32.9, T));
  const pc = [lerp(660, 540, lift), lerp(1192, 1000, lift)];
  const z = 1 + 1.4 * Math.pow(ss(33.0, 34, T), 2); c.translate(pc[0], pc[1]); c.scale(z, z); c.translate(-pc[0], -pc[1]);
  c.fillStyle = vgrad(c, 0, H, [[0, '#131c32'], [1, '#0a0f1c']]); c.fillRect(0, 0, W, H);
  // wall clock + framed photo of the two friends
  c.fillStyle = '#d8d2c4'; c.beginPath(); c.arc(220, 420, 62, 0, TAU); c.fill(); c.strokeStyle = '#2a2f3a'; c.lineWidth = 8; c.stroke();
  c.strokeStyle = '#1a1d24'; c.lineWidth = 6; c.beginPath(); c.moveTo(220, 420); c.lineTo(220, 372); c.moveTo(220, 420); c.lineTo(232 + Math.sin(T * 0.2) * 2, 380); c.stroke();
  c.fillStyle = '#2a1f16'; c.fillRect(700, 430, 220, 170);
  c.fillStyle = vgrad(c, 445, 585, [[0, '#f0a35e'], [1, '#ffd9a0']]); c.fillRect(712, 442, 196, 146);
  c.fillStyle = '#5a2a18'; for (const [hx, hy] of [[780, 520], [840, 515]]) { c.beginPath(); c.arc(hx, hy, 18, 0, TAU); c.fill(); rr(c, hx - 26, hy + 18, 52, 60, 18); c.fill(); }
  // pendant lamp
  c.strokeStyle = '#05070b'; c.lineWidth = 5; c.beginPath(); c.moveTo(560, 0); c.lineTo(560, 570); c.stroke();
  c.fillStyle = 'rgba(255,200,130,0.07)'; c.beginPath(); c.moveTo(480, 640); c.lineTo(640, 640); c.lineTo(980, 1240); c.lineTo(140, 1240); c.closePath(); c.fill();
  c.fillStyle = '#0b0e15'; c.beginPath(); c.moveTo(470, 642); c.quadraticCurveTo(475, 570, 560, 565); c.quadraticCurveTo(645, 570, 650, 642); c.closePath(); c.fill();
  glow(c, 560, 648, 160, '255,215,150', 0.85);
  // Kabir behind the table
  const P = [400, 790], S = 0.95, toL = (wx, wy) => [(wx - P[0]) / S, (wy - P[1]) / S];
  const handsUp = [toL(pc[0] - 150, pc[1] + 10), toL(pc[0] + 150, pc[1] + 10)];
  const rIdle = [120, 560], rReach = toL(660, 1185);
  const r = [lerp(lerp(rIdle[0], rReach[0], reach), handsUp[1][0], lift), lerp(lerp(rIdle[1], rReach[1], reach), handsUp[1][1], lift)];
  const l = [lerp(-120, handsUp[0][0], lift), lerp(560, handsUp[0][1], lift)];
  person(c, P[0], P[1], S, { who: 'kabirAdult', t: T, seed: 2, turn: 0.25, lookX: 8, lookY: 9, pose: 'stand', arms: { l, r }, light: 'night', lampX: 560, lampY: 650 });
  // table
  glow(c, 560, 1190, 520, '255,190,110', 0.22);
  c.fillStyle = '#4a3220'; c.beginPath(); c.moveTo(120, 1150); c.lineTo(960, 1150); c.lineTo(1010, 1240); c.lineTo(70, 1240); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,200,130,0.12)'; c.beginPath(); c.ellipse(560, 1195, 330, 40, 0, 0, TAU); c.fill();
  c.fillStyle = '#2a1c12'; c.fillRect(70, 1240, 940, 34);
  c.fillStyle = '#080b14'; c.fillRect(0, 1274, W, H);
  c.fillStyle = '#1a120b'; c.fillRect(110, 1274, 30, 500); c.fillRect(940, 1274, 30, 500);
  c.fillStyle = '#9aa3ad'; c.fillRect(270, 1150, 34, 46); c.fillStyle = '#5b6470'; c.fillRect(270, 1150, 34, 6);
  c.fillStyle = '#6a4a2e'; c.beginPath(); c.ellipse(850, 1185, 70, 18, 0, 0, TAU); c.fill();
  c.fillStyle = '#c0392b'; c.beginPath(); c.arc(830, 1168, 18, 0, TAU); c.fill(); c.fillStyle = '#e0a02a'; c.beginPath(); c.arc(862, 1166, 17, 0, TAU); c.fill();
  // newspaper
  c.save(); c.translate(pc[0], pc[1]); c.rotate(lerp(0.12, -0.04, lift)); c.scale(lerp(0.2, 0.3, lift), lerp(0.07, 0.3, lift));
  c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 20; c.drawImage(paper.c, -PW / 2, -PH / 2); c.restore();
  if (lift > 0.05) { c.fillStyle = '#9c8a90'; for (const [hx, hy] of [[pc[0] - 150, pc[1] + 10], [pc[0] + 150, pc[1] + 10]]) { rr(c, hx - 28, hy - 20, 56, 44, 18); c.fill(); } }
  // foreground chair backs
  c.fillStyle = '#05070c'; rr(c, 30, 1330, 230, 700, 30); c.fill(); rr(c, 820, 1330, 230, 700, 30); c.fill();
});
