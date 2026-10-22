// Kissaverse profile pictures, illustrated set: node channel/make_pfp2.js
const path = require('path');
const fs = require('fs');
const { createCanvas } = require(path.join(__dirname, '../chai-pending-hai/render/node_modules/@napi-rs/canvas'));

const S = 1080;
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

function rand(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function sky(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, S);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
}

function stars(ctx, seed, n, maxY) {
  const r = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * maxY, s = r() * 2.2 + 0.5;
    ctx.globalAlpha = (0.3 + r() * 0.7) * (1 - y / maxY * 0.7);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function sparkle(ctx, x, y, r, color, glow = 1.5) {
  ctx.save();
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = r * glow;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

function glowDisc(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', alpha)); g.addColorStop(1, color.replace('A', 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function cloud(ctx, x, y, w, color, seed) {
  const r = rand(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const cx = x + (i / 6 - 0.5) * w, rr = w * (0.10 + r() * 0.09) * (1 - Math.abs(i / 6 - 0.5));
    ctx.moveTo(cx + rr * 1.6, y);
    ctx.arc(cx, y - rr * 0.2, rr * 1.6, 0, Math.PI * 2);
  }
  ctx.rect(x - w / 2, y, w, w * 0.4);
  ctx.fill();
}

function grain(ctx, amt) {
  const d = ctx.getImageData(0, 0, S, S), p = d.data, r = rand(99);
  for (let i = 0; i < p.length; i += 4) {
    const n = (r() - 0.5) * amt;
    p[i] += n; p[i + 1] += n; p[i + 2] += n;
  }
  ctx.putImageData(d, 0, 0);
}

function vignette(ctx) {
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, 'rgba(10,6,30,0)'); g.addColorStop(1, 'rgba(10,6,30,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
}

function crescent(w, h, cx, cy, r, ox, oy, or, colors) {
  const c = createCanvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
  x.fillStyle = g;
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'destination-out';
  x.beginPath(); x.arc(ox, oy, or, 0, Math.PI * 2); x.fill();
  return c;
}

function save(c, name) {
  for (const size of [1080, 800]) {
    const o = createCanvas(size, size);
    o.getContext('2d').drawImage(c, 0, 0, size, size);
    fs.writeFileSync(path.join(OUT, `${name}_${size}.png`), o.toBuffer('image/png'));
  }
  const p = createCanvas(S, S), pc = p.getContext('2d');
  pc.fillStyle = '#0f0f0f'; pc.fillRect(0, 0, S, S);
  pc.beginPath(); pc.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); pc.clip();
  pc.drawImage(c, 0, 0);
  fs.writeFileSync(path.join(OUT, `${name}_circle_preview.png`), p.toBuffer('image/png'));
}

// ---------- 1. Chai Moon: a kulhad resting in a crescent moon, steam turning into stars
function chaiMoon() {
  const c = createCanvas(S, S), ctx = c.getContext('2d');
  sky(ctx, [[0, '#140f3a'], [0.4, '#33206a'], [0.68, '#8e4a8e'], [0.86, '#f08a7a'], [1, '#ffc996']]);
  stars(ctx, 3, 170, S * 0.7);
  glowDisc(ctx, 540, 560, 420, 'rgba(255,214,160,A)', 0.35);

  // moon bowl
  ctx.save();
  ctx.shadowColor = 'rgba(255,225,170,0.9)'; ctx.shadowBlur = 60;
  ctx.drawImage(crescent(S, S, 540, 560, 270, 585, 440, 262, ['#fff6e2', '#ffd59a']), 0, 0);
  ctx.restore();

  // kulhad sitting in the bowl
  const bx = 560, by = 702, tw = 150, bw = 100, h = 150;
  ctx.save();
  ctx.shadowColor = 'rgba(60,20,40,0.5)'; ctx.shadowBlur = 25; ctx.shadowOffsetY = 8;
  const cg = ctx.createLinearGradient(bx - tw / 2, 0, bx + tw / 2, 0);
  cg.addColorStop(0, '#9c3f22'); cg.addColorStop(0.45, '#d9733f'); cg.addColorStop(1, '#7d2f18');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(bx - tw / 2, by - h);
  ctx.quadraticCurveTo(bx - tw / 2 + 4, by - h * 0.3, bx - bw / 2, by);
  ctx.ellipse(bx, by, bw / 2, 12, 0, Math.PI, 0, true);
  ctx.quadraticCurveTo(bx + tw / 2 - 4, by - h * 0.3, bx + tw / 2, by - h);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // band and rim
  ctx.strokeStyle = 'rgba(255,190,140,0.5)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(bx, by - h * 0.42, tw * 0.44, 9, 0, 0, Math.PI); ctx.stroke();
  ctx.fillStyle = '#e8925e';
  ctx.beginPath(); ctx.ellipse(bx, by - h, tw / 2, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b3519';
  ctx.beginPath(); ctx.ellipse(bx, by - h + 2, tw / 2 - 11, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,180,0.35)';
  ctx.beginPath(); ctx.ellipse(bx - 22, by - h + 1, 20, 4, 0, 0, Math.PI * 2); ctx.fill();

  // steam curling up into stars
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,240,220,0.9)'; ctx.shadowBlur = 20;
  const steams = [
    [[bx - 25, by - h - 15], [bx - 80, by - h - 90], [bx + 30, by - h - 150], [bx - 30, by - h - 240]],
    [[bx + 18, by - h - 15], [bx + 70, by - h - 80], [bx - 10, by - h - 160], [bx + 60, by - h - 270]],
  ];
  for (const [a, b, d, e] of steams) {
    const g = ctx.createLinearGradient(0, a[1], 0, e[1]);
    g.addColorStop(0, 'rgba(255,245,230,0.85)'); g.addColorStop(1, 'rgba(255,245,230,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(...a); ctx.bezierCurveTo(...b, ...d, ...e); ctx.stroke();
  }
  ctx.restore();
  sparkle(ctx, bx - 40, by - h - 290, 26, '#ffe2a8');
  sparkle(ctx, bx + 70, by - h - 330, 18, '#fff4dc');
  sparkle(ctx, bx + 5, by - h - 380, 12, '#ffe2a8');
  sparkle(ctx, 230, 260, 16, '#fff4dc');
  sparkle(ctx, 850, 330, 22, '#ffd59a');

  // clouds
  ctx.save(); ctx.filter = 'blur(2px)';
  cloud(ctx, 220, 900, 520, 'rgba(255,190,170,0.85)', 4);
  cloud(ctx, 860, 930, 560, 'rgba(255,170,150,0.9)', 8);
  cloud(ctx, 540, 1000, 900, 'rgba(255,214,180,0.95)', 12);
  ctx.restore();

  vignette(ctx); grain(ctx, 16);
  save(c, 'kissaverse_chai_moon');
}

// ---------- 2. Aakhri Local: paper-cut city, last train crossing a giant moon
function lastLocal() {
  const c = createCanvas(S, S), ctx = c.getContext('2d');
  sky(ctx, [[0, '#0f0c33'], [0.45, '#3a1f66'], [0.72, '#a24c86'], [1, '#ff9d7e']]);
  stars(ctx, 11, 160, S * 0.6);
  glowDisc(ctx, 540, 520, 460, 'rgba(255,200,170,A)', 0.4);

  // big moon
  ctx.save();
  ctx.shadowColor = 'rgba(255,230,190,0.9)'; ctx.shadowBlur = 80;
  const mg = ctx.createRadialGradient(500, 460, 30, 540, 520, 270);
  mg.addColorStop(0, '#fffaf0'); mg.addColorStop(1, '#ffd9b0');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(540, 520, 270, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(230,170,150,0.25)';
  for (const [x, y, r] of [[460, 440, 40], [620, 580, 55], [600, 420, 22], [470, 600, 26]]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // paper-cut layers with soft shadows between them
  const layer = (color, fn) => {
    ctx.save();
    ctx.shadowColor = 'rgba(10,5,30,0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = -6;
    ctx.fillStyle = color; ctx.beginPath(); fn(); ctx.fill();
    ctx.restore();
  };
  const r = rand(21);
  // far skyline
  layer('#7a3f86', () => {
    ctx.moveTo(0, S);
    let x = 0;
    while (x < S) { const w = 40 + r() * 70, h = 640 + r() * 110; ctx.lineTo(x, h); ctx.lineTo(x + w, h); x += w; }
    ctx.lineTo(S, S);
  });
  // near skyline with lit windows
  const bld = [];
  layer('#4e2770', () => {
    ctx.moveTo(0, S);
    let x = -10;
    while (x < S) { const w = 60 + r() * 90, h = 700 + r() * 90; bld.push([x, h, w]); ctx.lineTo(x, h); ctx.lineTo(x + w, h); x += w + 6; }
    ctx.lineTo(S, S);
  });
  for (const [x, h, w] of bld) for (let yy = h + 20; yy < 800; yy += 26) for (let xx = x + 12; xx < x + w - 12; xx += 22)
    if (r() < 0.28) { ctx.fillStyle = r() < 0.5 ? '#ffc56b' : '#ff9e5e'; ctx.fillRect(xx, yy, 8, 11); }

  // bridge + train silhouetted across the moon
  const deck = 760;
  ctx.fillStyle = '#24124a';
  ctx.fillRect(0, deck, S, 16);
  for (let x = 30; x < S; x += 120) {
    ctx.beginPath(); ctx.moveTo(x, deck + 16);
    ctx.quadraticCurveTo(x + 60, deck + 80, x + 120, deck + 16); ctx.lineTo(x + 120, deck + 120);
    ctx.lineTo(x, deck + 120); ctx.closePath(); ctx.fill();
  }
  const ty = deck - 64;
  for (let i = 0; i < 4; i++) {
    const x = 170 + i * 168;
    ctx.fillStyle = '#24124a';
    ctx.beginPath(); ctx.roundRect(x, ty, 160, 62, i === 0 ? [26, 6, 6, 6] : 6); ctx.fill();
    ctx.save(); ctx.shadowColor = '#ffcf6e'; ctx.shadowBlur = 14; ctx.fillStyle = '#ffd47a';
    for (let k = 0; k < 4; k++) ctx.fillRect(x + 16 + k * 36, ty + 14, 22, 18);
    ctx.restore();
  }
  ctx.save(); ctx.shadowColor = '#fff1b8'; ctx.shadowBlur = 40; ctx.fillStyle = '#fff1b8';
  ctx.beginPath(); ctx.arc(176, ty + 40, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  // water with moon reflection
  const wg = ctx.createLinearGradient(0, deck + 120, 0, S);
  wg.addColorStop(0, '#2c1656'); wg.addColorStop(1, '#170b38');
  ctx.fillStyle = wg; ctx.fillRect(0, deck + 120, S, S);
  for (let i = 0; i < 9; i++) {
    const y = deck + 140 + i * 20, w = 220 - i * 18;
    ctx.fillStyle = `rgba(255,214,170,${0.55 - i * 0.05})`;
    ctx.fillRect(540 - w / 2 + (i % 2 ? 14 : -14), y, w, 5);
  }

  sparkle(ctx, 250, 230, 20, '#ffe2b8');
  sparkle(ctx, 860, 200, 14, '#fff4dc');
  vignette(ctx); grain(ctx, 16);
  save(c, 'kissaverse_last_local');
}

// ---------- 3. Story Book: an open book spilling a galaxy, ending in a moon
function storyBook() {
  const c = createCanvas(S, S), ctx = c.getContext('2d');
  sky(ctx, [[0, '#0d0a2c'], [0.5, '#24185a'], [1, '#4a2266']]);
  stars(ctx, 5, 200, S);
  glowDisc(ctx, 540, 640, 420, 'rgba(255,170,90,A)', 0.4);

  // star swirl rising out of the pages
  const r = rand(17);
  for (let i = 0; i < 520; i++) {
    const t = r();
    const ang = t * Math.PI * 3.4 + r() * 0.4;
    const rad = 30 + t * 230;
    const x = 540 + Math.cos(ang) * rad * 1.05 + (r() - 0.5) * 40 * t;
    const y = 700 - t * 430 + Math.sin(ang) * rad * 0.35;
    const s = (1 - t) * 3 + r() * 2.5;
    ctx.globalAlpha = 0.4 + r() * 0.6;
    ctx.fillStyle = ['#ffd27a', '#ffb070', '#ff8fb1', '#fff4dc', '#b9a6ff'][Math.floor(r() * 5)];
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = '#ffc98a'; ctx.shadowBlur = 25;
  ctx.strokeStyle = 'rgba(255,214,150,0.55)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(540, 690);
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const ang = t * Math.PI * 3.4, rad = 30 + t * 230;
    ctx.lineTo(540 + Math.cos(ang) * rad * 1.05, 700 - t * 430 + Math.sin(ang) * rad * 0.35);
  }
  ctx.stroke(); ctx.restore();

  // moon at the top of the swirl
  ctx.save(); ctx.shadowColor = 'rgba(255,225,170,0.95)'; ctx.shadowBlur = 50;
  ctx.drawImage(crescent(S, S, 540, 225, 85, 578, 196, 76, ['#fff6e2', '#ffcf8a']), 0, 0);
  ctx.restore();

  // book
  const cx = 540, top = 720, w = 330;
  const page = (dir, shade) => {
    ctx.beginPath();
    ctx.moveTo(cx, top + 30);
    ctx.bezierCurveTo(cx + dir * w * 0.3, top - 30, cx + dir * w * 0.7, top - 10, cx + dir * w, top + 10);
    ctx.lineTo(cx + dir * w, top + 170);
    ctx.bezierCurveTo(cx + dir * w * 0.7, top + 150, cx + dir * w * 0.3, top + 140, cx, top + 200);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx, 0, cx + dir * w, 0);
    g.addColorStop(0, shade); g.addColorStop(0.25, '#fff3dc'); g.addColorStop(1, '#ffe2b8');
    ctx.fillStyle = g; ctx.fill();
  };
  ctx.save(); ctx.shadowColor = 'rgba(255,170,90,0.8)'; ctx.shadowBlur = 60;
  ctx.fillStyle = '#7a2f3a';
  ctx.beginPath(); ctx.moveTo(cx - w - 18, top + 22); ctx.lineTo(cx + w + 18, top + 22);
  ctx.lineTo(cx + w + 18, top + 190); ctx.quadraticCurveTo(cx, top + 210, cx, top + 222);
  ctx.quadraticCurveTo(cx, top + 210, cx - w - 18, top + 190); ctx.closePath(); ctx.fill();
  ctx.restore();
  page(-1, '#e0b88a'); page(1, '#e0b88a');
  ctx.strokeStyle = 'rgba(150,100,70,0.35)'; ctx.lineWidth = 4;
  for (const dir of [-1, 1]) for (let k = 0; k < 5; k++) {
    const y = top + 50 + k * 22;
    ctx.beginPath(); ctx.moveTo(cx + dir * 50, y + 8 - k * 2); ctx.quadraticCurveTo(cx + dir * 160, y - 8, cx + dir * (270 - k * 8), y);
    ctx.stroke();
  }

  sparkle(ctx, 300, 330, 22, '#ffe2a8');
  sparkle(ctx, 800, 420, 16, '#fff4dc');
  sparkle(ctx, 760, 260, 10, '#ffb8c9');
  vignette(ctx); grain(ctx, 14);
  save(c, 'kissaverse_story_book');
}

chaiMoon(); lastLocal(); storyBook();
console.log('done');
