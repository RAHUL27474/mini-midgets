// Renders "Chai Pending Hai — Ep 1: Message" as a 60s 1080x1920 video.
// Usage: node render.js stills 1,3,10   -> PNG previews in ./stills
//        node render.js video           -> ../ep01-message/ep01_message.mp4
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const { spawn, execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const W = 1080, H = 1920, FPS = 30, DUR = 60, TAU = Math.PI * 2;
const FONTS = 'C:/Windows/Fonts/';
[['segoeui.ttf', 'UI'], ['segoeuib.ttf', 'UIB'], ['seguisb.ttf', 'UISB'], ['georgia.ttf', 'Serif'],
 ['georgiai.ttf', 'SerifI'], ['timesbd.ttf', 'Times'], ['NirmalaB.ttf', 'Deva']].forEach(([f, a]) => GlobalFonts.registerFromPath(FONTS + f, a));

// ---------- utils
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function glow(c, x, y, r, rgb, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
function vgrad(c, y0, y1, stops) { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function wrap(c, text, maxW) { const words = text.split(' '); const lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }

// ---------- precomputed assets
const cv = createCanvas(W, H), ctx = cv.getContext('2d');

const grain = [0, 1, 2].map(k => {
  const g = createCanvas(W / 2, H / 2), gc = g.getContext('2d'), id = gc.createImageData(W / 2, H / 2), r = rng(99 + k);
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  gc.putImageData(id, 0, 0); return g;
});

const city = (() => { const r = rng(4), b = []; let x = 620; while (x < 960) { const w = 30 + r() * 45, h = 110 + r() * 220, win = []; for (let wy = 840 - h + 12; wy < 830; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r() < 0.28) win.push([wx, wy, r() * TAU]); b.push({ x, w, h, win }); x += w + 2; } return b; })();
const bokeh = (() => { const r = rng(11); return Array.from({ length: 26 }, () => ({ x: r() * W, y: r() * H, r: 30 + r() * 90, a: 0.08 + r() * 0.18, p: r() * TAU })); })();

// newspaper clipping
const PW = 1000, PH = 1400;
const paper = (() => {
  const c = createCanvas(PW, PH), x = c.getContext('2d'), r = rng(21);
  const g = x.createRadialGradient(PW / 2, PH / 2, 200, PW / 2, PH / 2, 900); g.addColorStop(0, '#ecdfc2'); g.addColorStop(1, '#c9b48b');
  x.fillStyle = g; x.fillRect(0, 0, PW, PH);
  for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(90,70,40,${r() * 0.12})`; x.fillRect(r() * PW, r() * PH, 1 + r() * 2, 1 + r() * 2); }
  x.fillStyle = '#1e1a16'; x.textAlign = 'center';
  x.font = '78px Times'; x.fillText('NAGAR SAMACHAR', PW / 2, 110);
  x.fillRect(50, 132, PW - 100, 4); x.fillRect(50, 140, PW - 100, 1.5);
  x.font = '24px Serif'; x.fillText('Tuesday, 16 February 2021   •   Pune Edition   •   Rs 5', PW / 2, 175);
  x.fillRect(50, 192, PW - 100, 2);
  x.textAlign = 'left';
  const fit = (t, size, maxW) => { let s = size; do { x.font = `${s}px Times`; s -= 2; } while (x.measureText(t).width > maxW); };
  fit('NADI KINARE MILA SCOOTER', 72, PW - 100);
  x.fillText('YUVAK LAAPATA —', 50, 275); x.fillText('NADI KINARE MILA SCOOTER', 50, 350);
  x.font = '36px SerifI'; x.fillStyle = '#3a332b'; x.fillText('Police ne phone baraamad kiya', 50, 408);
  // photo
  const px = 50, py = 440, pw = 560, ph = 380;
  x.save(); x.beginPath(); x.rect(px, py, pw, ph); x.clip();
  x.fillStyle = vgrad(x, py, py + ph, [[0, '#b9b4ac'], [0.5, '#a39d93'], [1, '#6d6860']]); x.fillRect(px, py, pw, ph);
  x.fillStyle = '#8c877f'; x.fillRect(px, py + 200, pw, 70); // river
  for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(220,215,205,0.35)'; x.fillRect(px + r() * pw, py + 210 + r() * 55, 30 + r() * 60, 2); }
  x.fillStyle = '#4a4640'; x.beginPath(); x.moveTo(px, py + 270); x.quadraticCurveTo(px + 280, py + 250, px + pw, py + 280); x.lineTo(px + pw, py + ph); x.lineTo(px, py + ph); x.fill();
  x.strokeStyle = '#3a3630'; x.lineWidth = 3; for (let i = 0; i < 40; i++) { const rx = px + r() * pw; x.beginPath(); x.moveTo(rx, py + 290 + r() * 60); x.lineTo(rx + (r() - 0.5) * 20, py + 230 + r() * 40); x.stroke(); }
  scooter(x, px + 320, py + 330, 0.75, '#25221e');
  x.restore();
  x.strokeStyle = '#1e1a16'; x.lineWidth = 2; x.strokeRect(px, py, pw, ph);
  x.font = '20px SerifI'; x.fillStyle = '#3a332b'; x.fillText('Nadi kinare laawaris haalat mein mila scooter.', px, py + ph + 30);
  // body text (left column)
  x.font = '27px Serif'; x.fillStyle = '#26211c';
  let y = 905;
  for (const l of wrap(x, 'Sheher ke 21 varshiya Sameer K. pichhle teen din se laapata hain. Unka scooter Mula nadi ke kinare mila.', pw)) { x.fillText(l, px, y); y += 38; }
  y += 14;
  const keyLines = [];
  for (const l of wrap(x, 'Police ne bataya ki phone yuvak ki maa, Shanta Devi, ko saunpa gaya.', pw)) { x.fillText(l, px, y); keyLines.push({ x: px - 4, y: y - 28, w: x.measureText(l).width + 8, h: 38 }); y += 38; }
  y += 14;
  for (; y < PH - 60; y += 38) { x.fillStyle = 'rgba(40,34,28,0.55)'; x.fillRect(px, y - 18, pw * (0.75 + r() * 0.25), 12); }
  // right column fake text
  for (let yy = 455; yy < PH - 60; yy += 38) { x.fillStyle = 'rgba(40,34,28,0.55)'; x.fillRect(640, yy, 310 * (0.7 + r() * 0.3), 12); }
  x.fillStyle = 'rgba(80,60,30,0.12)'; x.fillRect(0, 700, PW, 3); // fold
  return { c, keyLines };
})();

// ---------- drawing primitives
function scooter(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
  for (const wx of [-95, 100]) { c.beginPath(); c.arc(wx, -38, 38, 0, TAU); c.fill(); }
  c.beginPath(); c.moveTo(-150, -60); c.quadraticCurveTo(-155, -135, -60, -138); c.lineTo(10, -132); c.lineTo(22, -72); c.lineTo(72, -72);
  c.lineTo(96, -152); c.lineTo(122, -152); c.lineTo(142, -62); c.quadraticCurveTo(132, -34, 100, -40); c.lineTo(-120, -40); c.closePath(); c.fill();
  rr(c, -142, -162, 142, 28, 12); c.fill();
  c.lineWidth = 12; c.beginPath(); c.moveTo(108, -150); c.lineTo(94, -232); c.stroke();
  c.beginPath(); c.moveTo(60, -238); c.lineTo(124, -230); c.stroke();
  c.beginPath(); c.arc(116, -205, 13, 0, TAU); c.fill();
  c.restore();
}
function sitter(c, hx, hy, s, col, o = {}) {
  const { face = 1, lean = 0, arm = 0, messy = false, t = 0, legs = 'down' } = o;
  c.save(); c.translate(hx, hy); c.scale(s * face, s); c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = 40; c.beginPath(); c.moveTo(0, 0); c.lineTo(88, 0); legs === 'down' ? c.lineTo(96, 115) : c.lineTo(120, 60); c.stroke();
  c.rotate(lean);
  c.beginPath(); c.moveTo(-32, 12); c.lineTo(-40, -118); c.quadraticCurveTo(-24, -152, 8, -152); c.lineTo(30, -142); c.lineTo(32, 12); c.closePath(); c.fill();
  c.lineWidth = 22; c.beginPath(); c.moveTo(-6, -160); c.lineTo(-2, -176); c.stroke();
  c.beginPath(); c.arc(0, -196, 38, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(34, -205); c.lineTo(46, -190); c.lineTo(34, -184); c.fill(); // nose
  if (messy) { c.beginPath(); for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.98 + i * 0.25; c.moveTo(Math.cos(a) * 28, -196 + Math.sin(a) * 28); c.lineTo(Math.cos(a + 0.1) * 54, -196 + Math.sin(a + 0.1) * 54 + Math.sin(t * 6 + i) * 3); c.lineTo(Math.cos(a + 0.26) * 30, -196 + Math.sin(a + 0.26) * 30); } c.fill(); }
  c.lineWidth = 24; c.beginPath(); c.moveTo(4, -128);
  const ex = 34 + Math.cos(arm) * 8, ey = -62 - arm * 30; c.lineTo(ex, ey); c.lineTo(ex + 58 * Math.cos(-arm * 0.9), ey - 58 * Math.sin(arm * 0.9) - 4); c.stroke();
  c.restore();
}
function billu(c, x, y, s, t) {
  c.save(); c.translate(x, y); c.scale(s, s); const b = 1 + Math.sin(t * 2.2) * 0.035;
  c.fillStyle = '#e0812f'; c.strokeStyle = '#e0812f'; c.lineCap = 'round';
  c.lineWidth = 15; c.beginPath(); c.moveTo(-62, 8); c.quadraticCurveTo(-40, 50, 36, 32); c.stroke();
  c.beginPath(); c.ellipse(0, 0, 72, 34 * b, 0, 0, TAU); c.fill();
  c.beginPath(); c.arc(64, -8, 31, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(42, -28); c.lineTo(44, -46); c.lineTo(50, -41); c.lineTo(53, -54); c.lineTo(64, -36); c.fill(); // torn ear
  c.beginPath(); c.moveTo(70, -36); c.lineTo(90, -54); c.lineTo(93, -24); c.fill();
  c.strokeStyle = '#b55c1b'; c.lineWidth = 7; for (const i of [-36, -14, 8]) { c.beginPath(); c.moveTo(i, -30); c.quadraticCurveTo(i + 9, -8, i, 6); c.stroke(); }
  c.strokeStyle = '#4a220a'; c.lineWidth = 3.5; for (const ex of [54, 76]) { c.beginPath(); c.arc(ex, -10, 6, 0.2, Math.PI - 0.2); c.stroke(); }
  c.restore();
}
function steam(c, x, y, t, s, a) {
  for (let i = 0; i < 16; i++) {
    const p = (t * 0.45 + i / 16) % 1;
    const px = x + Math.sin(p * 7 + i * 1.7 + t) * 18 * s * (0.4 + p), py = y - p * 220 * s, r = (8 + p * 34) * s;
    glow(c, px, py, r, '255,250,240', a * Math.sin(Math.PI * p) * 0.55);
  }
}
function ticks(c, x, y, double, blue) {
  c.save(); c.strokeStyle = blue ? '#53bdeb' : '#9aa4b2'; c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y + 4); c.lineTo(x + 11, y - 5); c.stroke();
  if (double) { c.beginPath(); c.moveTo(x + 7, y + 4); c.lineTo(x + 16, y - 5); c.stroke(); }
  c.restore();
}

// ---------- phone + screens (screens are designed in 400-unit-wide space)
function phone(c, cx, cy, w, h, rot, screen, light = 1) {
  c.save(); c.translate(cx, cy); c.rotate(rot);
  if (light > 0) glow(c, 0, 0, w * 1.5, '80,140,255', 0.28 * light);
  rr(c, -w / 2, -h / 2, w, h, w * 0.12); c.fillStyle = '#0a0c11'; c.fill(); c.strokeStyle = '#2b303b'; c.lineWidth = w * 0.012; c.stroke();
  const m = w * 0.035, sw = w - 2 * m, sh = h - 2 * m;
  c.save(); rr(c, -w / 2 + m, -h / 2 + m, sw, sh, w * 0.09); c.clip(); c.translate(-w / 2 + m, -h / 2 + m);
  const k = sw / 400; c.scale(k, k); screen(c, sh / k);
  c.restore();
  // cracked corner
  c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = Math.max(1.5, w * 0.003);
  const ox = w / 2 - m, oy = -h / 2 + m;
  [[-0.32, 0.1], [-0.2, 0.18], [-0.1, 0.07]].forEach(([dx, dy]) => { c.beginPath(); c.moveTo(ox, oy + w * 0.02); c.lineTo(ox + dx * w * 0.5, oy + dy * w * 0.6); c.lineTo(ox + dx * w * 0.8, oy + dy * w * 1.1); c.stroke(); });
  c.restore();
}
function lockScreen(time, notifA, bright) {
  return (c, h) => {
    c.fillStyle = vgrad(c, 0, h, [[0, '#1d2c4d'], [1, '#090d19']]); c.fillRect(0, 0, 400, h);
    glow(c, 300, h * 0.75, 260, '70,90,170', 0.35);
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = '19px UI'; c.fillText('Monday, 16 March', 200, 118);
    c.font = '92px UISB'; c.fillText(time, 200, 215);
    if (notifA > 0) {
      const y = 280 - (1 - notifA) * 50;
      c.globalAlpha = notifA;
      rr(c, 16, y, 368, 108, 22); c.fillStyle = 'rgba(255,255,255,0.17)'; c.fill();
      c.beginPath(); c.arc(56, y + 54, 25, 0, TAU); c.fillStyle = '#e07b39'; c.fill();
      c.fillStyle = '#fff'; c.font = '24px UIB'; c.fillText('S', 56, y + 63);
      c.textAlign = 'left'; c.font = '19px UIB'; c.fillText('Sameer', 94, y + 40);
      c.textAlign = 'right'; c.font = '15px UI'; c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillText('now', 366, y + 40);
      c.textAlign = 'left'; c.font = '17px UI'; c.fillStyle = '#fff'; c.fillText('Happy birthday bhai.', 94, y + 66); c.fillText('Chai pending hai.', 94, y + 89);
      c.globalAlpha = 1;
    }
    if (bright < 1) { c.fillStyle = `rgba(0,0,0,${1 - bright})`; c.fillRect(0, 0, 400, h); }
  };
}
const CHAT = [
  { d: '16 March 2021' }, { s: 'Happy birthday bhai. Chai pending hai.' }, { k: 'Bhai tu kahan hai?? Sab tujhe dhoondh rahe hain. Call kar please.' },
  { d: '16 March 2022' }, { s: 'Happy birthday bhai. Chai pending hai.' }, { k: 'Ek saal ho gaya yaar. Ek message toh kar.' },
  { d: '16 March 2023' }, { s: 'Happy birthday bhai. Chai pending hai.' }, { k: 'Aaj tapri gaya tha. Bhaiya ne tera poocha.' },
  { d: '16 March 2024' }, { s: 'Happy birthday bhai. Chai pending hai.' }, { k: 'Promotion mili aaj. Tu hota toh party leta.' },
  { d: '16 March 2025' }, { s: 'Happy birthday bhai. Chai pending hai.' }, { k: 'Tere bina chai achhi nahi lagti yaar.' },
  { d: 'Today' }, { s: 'Happy birthday bhai. Chai pending hai.' },
];
const NEWMSG = 'Kahan hai tu? Bas ek baar bata de.';
function layout(items) {
  ctx.save(); ctx.font = '18px UI'; let y = 0; const out = [];
  for (const m of items) {
    if (m.d) { out.push({ d: m.d, y }); y += 48; continue; }
    const lines = wrap(ctx, m.s || m.k, 250), w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 30, h = lines.length * 25 + 20 + (m.k ? 16 : 0);
    out.push({ me: !!m.k, lines, w: Math.max(w, m.k ? 110 : 0), h, y, isNew: m.isNew }); y += h + 12;
  }
  ctx.restore(); return { out, total: y };
}
const LAY0 = layout(CHAT), LAY1 = layout([...CHAT, { k: NEWMSG, isNew: true }]);
function chatScreen({ scroll = 1, typed = '', sent = false, newA = 1, seen = 0, caret = false }) {
  return (c, h) => {
    c.fillStyle = '#0e131b'; c.fillRect(0, 0, 400, h);
    const top = 96, bot = h - 76, L = sent ? LAY1 : LAY0;
    const off = Math.max(0, L.total - (bot - top - 20)) * scroll;
    c.save(); c.beginPath(); c.rect(0, top, 400, bot - top); c.clip();
    for (const it of L.out) {
      let y = top + 10 + it.y - off;
      if (it.d) { c.font = '13px UISB'; const tw = c.measureText(it.d).width + 24; rr(c, 200 - tw / 2, y + 10, tw, 26, 13); c.fillStyle = '#1d2430'; c.fill(); c.fillStyle = '#8b95a5'; c.textAlign = 'center'; c.fillText(it.d, 200, y + 28); continue; }
      c.save();
      if (it.isNew) { c.globalAlpha = newA; y += (1 - newA) * 30; }
      const x = it.me ? 400 - 14 - it.w : 14;
      rr(c, x, y, it.w, it.h, 16); c.fillStyle = it.me ? '#2b5fb8' : '#232a36'; c.fill();
      c.fillStyle = '#eef2f8'; c.font = '18px UI'; c.textAlign = 'left';
      it.lines.forEach((l, i) => c.fillText(l, x + 15, y + 30 + i * 25));
      if (it.me) {
        const blue = it.isNew ? seen > 0.5 : false, dbl = it.isNew ? seen > 0.5 : false;
        ticks(c, x + it.w - 30, y + it.h - 13, dbl, blue);
        if (it.isNew && seen > 0) { c.globalAlpha = seen * (it.isNew ? newA : 1); c.fillStyle = '#8b95a5'; c.font = '13px UISB'; c.textAlign = 'right'; c.fillText('Seen', x + it.w, y + it.h + 18); }
      }
      c.restore();
    }
    c.restore();
    // header
    c.fillStyle = '#161c27'; c.fillRect(0, 0, 400, top);
    c.strokeStyle = '#cfd6e2'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(26, 46); c.lineTo(16, 58); c.lineTo(26, 70); c.stroke();
    c.beginPath(); c.arc(62, 58, 22, 0, TAU); c.fillStyle = '#e07b39'; c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '21px UIB'; c.fillText('S', 62, 66);
    c.textAlign = 'left'; c.font = '20px UISB'; c.fillText('Sameer', 96, 54); c.font = '13px UI'; c.fillStyle = '#8b95a5'; c.fillText('last seen 14 Feb 2021', 96, 76);
    // input
    rr(c, 12, h - 62, 318, 48, 24); c.fillStyle = '#1c2330'; c.fill();
    c.font = '17px UI'; c.textAlign = 'left';
    if (typed) { c.fillStyle = '#eef2f8'; const tt = typed.length > 30 ? '…' + typed.slice(-29) : typed; c.fillText(tt, 30, h - 32); if (caret) c.fillRect(30 + c.measureText(tt).width + 2, h - 48, 2, 22); }
    else { c.fillStyle = '#5d6676'; c.fillText('Message', 30, h - 32); }
    c.beginPath(); c.arc(362, h - 38, 24, 0, TAU); c.fillStyle = '#2b5fb8'; c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(352, h - 48); c.lineTo(374, h - 38); c.lineTo(352, h - 28); c.lineTo(356, h - 38); c.closePath(); c.fill();
  };
}

// ---------- environments
function room(c, t, o = {}) {
  const { person = true, phoneOnBed = false, drift = 0 } = o;
  c.save(); c.translate(drift, 0);
  c.fillStyle = vgrad(c, 0, H, [[0, '#0e1527'], [0.7, '#0a0f1c'], [1, '#06080f']]); c.fillRect(-100, 0, W + 200, H);
  // window
  c.save(); c.beginPath(); c.rect(620, 380, 340, 460); c.clip();
  c.fillStyle = vgrad(c, 380, 840, [[0, '#101a33'], [1, '#22305a']]); c.fillRect(620, 380, 340, 460);
  glow(c, 880, 470, 120, '200,215,255', 0.25); c.beginPath(); c.arc(880, 470, 30, 0, TAU); c.fillStyle = '#dfe6f5'; c.fill();
  for (const b of city) { c.fillStyle = '#070b16'; c.fillRect(b.x, 840 - b.h, b.w, b.h); for (const [wx, wy, p] of b.win) { c.fillStyle = `rgba(255,205,120,${0.45 + 0.4 * Math.sin(t * 1.3 + p)})`; c.fillRect(wx, wy, 5, 7); } }
  c.restore();
  c.strokeStyle = '#1b2236'; c.lineWidth = 16; c.strokeRect(620, 380, 340, 460); c.lineWidth = 8; c.beginPath(); c.moveTo(790, 380); c.lineTo(790, 840); c.moveTo(620, 610); c.lineTo(960, 610); c.stroke();
  // moonlight spill
  c.fillStyle = 'rgba(120,150,230,0.05)'; c.beginPath(); c.moveTo(620, 840); c.lineTo(960, 840); c.lineTo(820, 1500); c.lineTo(380, 1500); c.closePath(); c.fill();
  // floor
  c.fillStyle = '#080b14'; c.fillRect(-100, 1420, W + 200, H);
  // bed
  c.fillStyle = '#141b2c'; rr(c, 40, 1150, 540, 120, 18); c.fill();
  c.fillStyle = '#1b2440'; rr(c, 40, 1130, 540, 70, 26); c.fill();
  c.fillStyle = '#222c4a'; rr(c, 60, 1095, 160, 60, 24); c.fill();
  c.fillStyle = '#0e1320'; c.fillRect(50, 1270, 20, 150); c.fillRect(550, 1270, 20, 150);
  // chair + cake
  c.fillStyle = '#121828'; c.fillRect(700, 1270, 190, 22); c.fillRect(712, 1292, 14, 130); c.fillRect(864, 1292, 14, 130); c.fillRect(864, 1100, 14, 172);
  c.fillStyle = '#4e4558'; rr(c, 745, 1190, 100, 80, 8); c.fill();
  c.fillStyle = '#6b6075'; c.beginPath(); c.ellipse(795, 1192, 50, 12, 0, 0, TAU); c.fill();
  c.fillStyle = '#8a7d96'; c.fillRect(792, 1150, 6, 38);
  // ceiling fan
  c.strokeStyle = '#141b2c'; c.lineWidth = 8; c.beginPath(); c.moveTo(540, 0); c.lineTo(540, 130); c.stroke();
  const a0 = t * 2.6;
  for (let i = 0; i < 3; i++) { const a = a0 + i * TAU / 3; const tx = 540 + Math.cos(a) * 230, ty = 150 + Math.sin(a) * 34; c.fillStyle = '#121a2b'; c.beginPath(); c.moveTo(540 + Math.cos(a + 0.4) * 20, 150 + Math.sin(a + 0.4) * 6); c.lineTo(tx + Math.cos(a + 1.57) * 22, ty + Math.sin(a + 1.57) * 4); c.lineTo(tx - Math.cos(a + 1.57) * 22, ty - Math.sin(a + 1.57) * 4); c.lineTo(540 + Math.cos(a - 0.4) * 20, 150 + Math.sin(a - 0.4) * 6); c.fill(); }
  c.fillStyle = '#1a2236'; c.beginPath(); c.ellipse(540, 150, 34, 14, 0, 0, TAU); c.fill();
  if (person) {
    glow(c, 410, 1150, 220, '90,150,255', 0.35);
    sitter(c, 360, 1145, 1.05, '#04060b', { face: 1, lean: 0.25, arm: 0.3 });
    c.fillStyle = '#9cc3ff'; c.save(); c.translate(452, 1118); c.rotate(-0.5); c.fillRect(-12, -20, 24, 40); c.restore();
    glow(c, 452, 1118, 90, '140,190,255', 0.5);
  }
  if (phoneOnBed) { glow(c, 330, 1150, 180, '90,150,255', 0.3 + 0.1 * Math.sin(t * 3)); c.save(); c.translate(330, 1150); c.rotate(0.3); c.fillStyle = '#9cc3ff'; c.fillRect(-16, -26, 32, 52); c.restore(); }
  c.restore();
}
function goldenSky(c, sunX, sunY, sunR) {
  c.fillStyle = vgrad(c, 0, H, [[0, '#e9894a'], [0.45, '#ffc98a'], [0.62, '#ffe2b0'], [1, '#d98a50']]); c.fillRect(0, 0, W, H);
  glow(c, sunX, sunY, sunR * 4.5, '255,236,190', 0.6); glow(c, sunX, sunY, sunR * 1.6, '255,250,225', 0.9);
  c.beginPath(); c.arc(sunX, sunY, sunR, 0, TAU); c.fillStyle = '#fff6dc'; c.fill();
}
function tree(c, x, base, s, col) {
  c.fillStyle = col; c.fillRect(x - 10 * s, base - 260 * s, 20 * s, 260 * s);
  [[0, -320, 110], [-80, -270, 80], [80, -280, 85], [-40, -390, 80], [50, -380, 75]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(x + dx * s, base + dy * s, r * s, 0, TAU); c.fill(); });
}
function lamp(c, on = 1) {
  c.fillStyle = '#05070b'; c.beginPath(); c.ellipse(200, 1010, 90, 18, 0, 0, TAU); c.fill();
  c.strokeStyle = '#05070b'; c.lineWidth = 14; c.beginPath(); c.moveTo(200, 1000); c.lineTo(250, 760); c.lineTo(370, 650); c.stroke();
  c.fillStyle = 'rgba(255,200,120,0.07)'; c.beginPath(); c.moveTo(350, 700); c.lineTo(470, 690); c.lineTo(820, 1060); c.lineTo(180, 1060); c.closePath(); c.fill();
  c.fillStyle = '#0a0d14'; c.beginPath(); c.moveTo(320, 600); c.lineTo(420, 610); c.lineTo(470, 700); c.lineTo(330, 705); c.closePath(); c.fill();
  glow(c, 400, 705, 120, '255,210,140', 0.6 * on);
}
function deskNight(c) {
  c.fillStyle = vgrad(c, 0, H, [[0, '#0b0f18'], [1, '#070910']]); c.fillRect(0, 0, W, H);
  c.fillStyle = '#3a2a1c'; c.fillRect(0, 1000, W, 80);
  c.fillStyle = '#1f150e'; c.fillRect(0, 1080, W, H);
  glow(c, 470, 1040, 420, '255,190,110', 0.28);
  lamp(c);
}
function profile(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.beginPath();
  c.moveTo(-190, 450); c.lineTo(-160, 180); c.bezierCurveTo(-260, 40, -210, -250, 0, -270);
  c.bezierCurveTo(130, -280, 200, -180, 205, -70); c.lineTo(215, -40); c.lineTo(205, 0); c.lineTo(255, 75); c.lineTo(212, 92);
  c.lineTo(222, 118); c.lineTo(204, 132); c.lineTo(214, 152); c.bezierCurveTo(200, 205, 160, 225, 100, 220); c.lineTo(60, 230);
  c.lineTo(80, 450); c.lineTo(120, 1000); c.lineTo(-260, 1000); c.closePath();
  c.restore();
}

// ---------- subtitles
const SUBS = [];
for (const l of JSON.parse(fs.readFileSync(path.join(__dirname, 'voice', 'lines.json'), 'utf8'))) {
  const parts = l.sub.split('|'), tot = parts.reduce((a, p) => a + p.length, 0); let t0 = l.start;
  parts.forEach((p, i) => { const d = l.dur * p.length / tot; SUBS.push([t0, i === parts.length - 1 ? t0 + d + 0.35 : t0 + d, p, l.who === 'sameer' || l.who === 'kabirYoung']); t0 += d; });
}
function subtitles(c, T) {
  for (const [a, b, text, warm] of SUBS) {
    if (T < a || T > b) continue;
    const al = Math.min(ss(a, a + 0.15, T), 1 - ss(b - 0.15, b, T));
    c.save(); c.globalAlpha = al; c.textAlign = 'center'; c.font = '58px Deva'; c.lineJoin = 'round';
    text.split('\n').forEach((l, i, arr) => {
      const y = 1460 - (arr.length - 1) * 38 + i * 76;
      c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineWidth = 12; c.strokeText(l, W / 2, y);
      c.fillStyle = warm ? '#ffe9c4' : '#ffffff'; c.fillText(l, W / 2, y);
    });
    c.restore();
  }
}

// ---------- scenes
const S = [];
const scene = (a, b, fn) => S.push({ a, b, fn });

scene(0, 2, (c, t) => { // S01 phone in darkness
  const z = 1 + 0.035 * t; c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2);
  c.fillStyle = '#0c0907'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#100c09' : '#0d0a08'; c.fillRect(i * 170 - 40, 0, 168, H); }
  const br = ss(0.3, 0.6, t);
  glow(c, 540, 960, 700, '70,120,255', 0.25 * br);
  phone(c, 540, 960, 430, 900, -0.12, lockScreen(t < 1.2 ? '11:59' : '12:00', 0, br), br);
});
scene(2, 5, (c, t) => { // S02 notification
  c.fillStyle = '#05070d'; c.fillRect(0, 0, W, H);
  for (const b of bokeh) glow(c, b.x, b.y, b.r, '70,110,220', b.a * 0.6);
  const y = 990 + Math.sin(t * 1.3) * 8;
  phone(c, 540, y, 760, 1600, Math.sin(t * 0.9) * 0.01, lockScreen('12:00', ss(0.2, 0.5, t), 1), 1.2);
});
scene(5, 8, (c, t) => { // S03 wide room
  room(c, t + 5, { drift: -t * 10 });
  c.save(); c.globalAlpha = ss(0.3, 0.9, t) * (1 - ss(2.4, 3, t)); c.textAlign = 'center'; c.fillStyle = '#e6ecf7';
  c.font = '30px UISB'; c.fillText('C H A I   P E N D I N G   H A I', W / 2, 250); c.font = '24px UI'; c.fillStyle = '#9fb0cc'; c.fillText('Episode 1  ·  Message', W / 2, 295); c.restore();
});
scene(8, 15, (c, t) => { // S04-S05 chat scroll + typing
  const T = t + 8;
  c.fillStyle = '#04060b'; c.fillRect(0, 0, W, H);
  for (const b of bokeh) glow(c, b.x, b.y, b.r, '60,100,210', b.a * 0.4);
  const n = Math.floor(clamp((T - 11.3) / 2.0) * NEWMSG.length);
  const sent = T >= 13.6;
  const z = 1 + 0.04 * ss(11, 15, T);
  c.translate(W / 2, 960); c.scale(z, z); c.translate(-W / 2, -960);
  phone(c, 540, 960, 820, 1700, 0, chatScreen({ scroll: easeOut(ss(8.2, 10.8, T)), typed: sent ? '' : NEWMSG.slice(0, n), caret: !sent && T > 11 && Math.floor(T * 2.5) % 2 === 0, sent, newA: ss(13.6, 13.85, T) }), 1);
});
scene(15, 18, (c, t) => { // S06 scooter ride
  goldenSky(c, 760, 1180, 120);
  c.fillStyle = 'rgba(190,110,70,0.5)'; for (let i = 0; i < 12; i++) { const bx = ((i * 140 - t * 60) % 1700 + 1700) % 1700 - 200; c.fillRect(bx, 1250 - (i * 53 % 170), 110, 300); }
  for (let i = 0; i < 8; i++) tree(c, ((i * 300 - t * 320) % 2400 + 2400) % 2400 - 300, 1520, 0.9, 'rgba(140,70,40,0.75)');
  c.fillStyle = '#6b3520'; c.fillRect(0, 1500, W, H);
  c.fillStyle = '#4a2416'; c.fillRect(0, 1600, W, H);
  c.fillStyle = 'rgba(255,220,170,0.6)'; for (let i = 0; i < 6; i++) c.fillRect(((i * 340 - t * 1400) % 2040 + 2040) % 2040 - 300, 1700, 160, 12);
  const bob = Math.sin(t * 18) * 3, sx = 470, sy = 1590 + bob;
  sitter(c, sx - 140, sy - 225, 1.15, '#22303f', { lean: -0.05, arm: 0.1, legs: 'fwd' });
  sitter(c, sx - 10, sy - 230, 1.15, '#5a1c18', { lean: -0.1, arm: 0.5, messy: true, t, legs: 'fwd' });
  scooter(c, sx, sy, 1.5, '#2a1610');
  for (let i = 0; i < 10; i++) { const p = (t * 2 + i / 10) % 1; glow(c, sx - 180 - p * 300, sy - 40 - p * 60, 20 + p * 30, '255,220,180', 0.25 * (1 - p)); }
  for (let i = 0; i < 4; i++) tree(c, ((i * 700 - t * 1100) % 2800 + 2800) % 2800 - 400, 1560, 1.8, '#2e150c');
});
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
  if (L.messy) { c.fillStyle = L.hair; c.beginPath(); for (let i = 0; i <= 18; i++) { const a = Math.PI * (0.93 + i * 1.14 / 18), r = i % 2 ? 138 + Math.sin(t * 5 + i) * 4 : 114; c.lineTo(Math.cos(a) * r, -18 + Math.sin(a) * r); } c.closePath(); c.fill(); }
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

scene(34, 40, (c, t) => { // S11 clipping
  c.fillStyle = '#0a0806'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(540, lerp(1020, 860, ss(0, 6, t))); c.rotate(-0.03); const s = 1.0 + 0.04 * t; c.scale(s, s);
  c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 40; c.drawImage(paper.c, -PW / 2, -PH / 2); c.restore();
  const g = c.createRadialGradient(470, 700, 200, 470, 900, 1200); g.addColorStop(0, 'rgba(255,190,110,0.08)'); g.addColorStop(0.6, 'rgba(10,8,20,0.25)'); g.addColorStop(1, 'rgba(5,5,15,0.8)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
});
scene(40, 45, (c, t) => { // S12 clipping + phone
  const z = 1 + 0.05 * t; c.translate(540, 960); c.scale(z, z); c.translate(-540, -960);
  c.fillStyle = '#140e0a'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#17100b' : '#130d09'; c.fillRect(0, i * 260, W, 256); }
  c.save(); c.translate(330, 820); c.rotate(-0.1); c.scale(0.55, 0.55); c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 30; c.drawImage(paper.c, -PW / 2, -PH / 2); c.restore();
  glow(c, 330, 800, 520, '255,190,110', 0.15);
  phone(c, 790, 1260, 400, 840, 0.12, chatScreen({ scroll: 1, sent: true }), 0.8 + 0.2 * Math.sin(t * 2));
  const g = c.createRadialGradient(540, 960, 350, 540, 960, 1150); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
});
scene(45, 48, (c, t) => { // S13 TWIST close-up
  const kl = paper.keyLines, cx = kl[0].x + Math.max(...kl.map(l => l.w)) / 2, cy = (kl[0].y + kl[kl.length - 1].y + 38) / 2;
  const s = lerp(2.6, 1.75, easeOut(t / 0.18)) + 0.05 * t;
  c.fillStyle = '#0a0806'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(540, 960); c.scale(s, s); c.rotate(-0.03); c.translate(-cx, -cy);
  c.drawImage(paper.c, 0, 0);
  c.globalCompositeOperation = 'multiply';
  kl.forEach((l, i) => { const p = clamp((t - 0.25 - i * 0.35) / 0.35); c.fillStyle = 'rgba(255,214,0,0.75)'; c.fillRect(l.x, l.y, l.w * p, l.h); });
  c.restore();
  const g = c.createRadialGradient(540, 960, 300, 540, 960, 1100); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = `rgba(255,250,235,${0.75 * (1 - ss(0, 0.45, t))})`; c.fillRect(0, 0, W, H);
});
scene(48, 53, (c, t) => { // S14 realisation
  const T = t + 48;
  const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#3a2412'); g.addColorStop(0.45, '#120c10'); g.addColorStop(1, '#0d1a38'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  glow(c, 0, 700, 700, '255,170,90', 0.25); glow(c, W, 1300, 800, '70,130,255', 0.3);
  const z = 1 + 0.04 * t; c.translate(400, 900); c.scale(z, z); c.translate(-400, -900);
  profile(c, 380, 860, 1.25); c.fillStyle = '#07080c'; c.fill();
  c.save(); profile(c, 380, 860, 1.25); c.clip();
  glow(c, 700, 900, 260, '90,150,255', 0.35); c.restore();
  profile(c, 380, 860, 1.25); c.save(); c.clip(); c.lineWidth = 10;
  c.strokeStyle = 'rgba(120,175,255,0.85)'; c.stroke(); c.restore();
  // eye + tear
  c.strokeStyle = 'rgba(160,200,255,0.55)'; c.lineWidth = 4; c.beginPath(); c.moveTo(560, 760); c.quadraticCurveTo(580, 752, 600, 762); c.stroke();
  const tear = ss(49.6, 50.2, T), fall = ss(51.2, 53, T);
  if (tear > 0) { glow(c, 598, 772 + fall * 120, 16, '200,225,255', 0.9 * tear); c.fillStyle = `rgba(230,240,255,${tear})`; c.beginPath(); c.arc(598, 772 + fall * 120, 4.5, 0, TAU); c.fill(); }
  phone(c, 860, 1640, 340, 720, 0.18, chatScreen({ scroll: 1, sent: true }), 1);
});
scene(53, 56, (c, t) => { // S15 leaving
  const T = t + 53;
  c.fillStyle = vgrad(c, 0, H, [[0, '#0d1424'], [1, '#070a12']]); c.fillRect(0, 0, W, H);
  c.fillStyle = '#080b14'; c.fillRect(0, 1420, W, H);
  const open = T < 55.1 ? 1 : 1 - easeOut((T - 55.1) / 0.5);
  c.fillStyle = '#05070c'; c.fillRect(700, 760, 270, 660);
  if (open > 0.01) {
    c.fillStyle = 'rgba(255,214,150,0.92)'; c.fillRect(712, 772, 246 * open, 648);
    c.fillStyle = `rgba(255,214,150,${0.18 * open})`; c.beginPath(); c.moveTo(712, 1420); c.lineTo(712 + 246 * open, 1420); c.lineTo(500 + 300 * open, 1920); c.lineTo(300, 1920); c.closePath(); c.fill();
    glow(c, 835, 1100, 500, '255,200,130', 0.25 * open);
  }
  c.fillStyle = '#1a1410'; c.fillRect(712 + 246 * open, 772, 246 * (1 - open) + 4, 648);
  c.fillStyle = '#121828'; c.fillRect(120, 1270, 190, 22); c.fillRect(132, 1292, 14, 130); c.fillRect(284, 1292, 14, 130);
  c.fillStyle = '#4e4558'; rr(c, 165, 1190, 100, 80, 8); c.fill();
  const p = ss(53.2, 55.05, T);
  if (T < 55.15) for (let k = 4; k >= 0; k--) {
    const pk = clamp(p - k * 0.025), x = lerp(220, 840, pk), ph = T * 14 - k * 0.3;
    c.save(); c.globalAlpha = k === 0 ? 1 : 0.18; c.fillStyle = '#020306'; c.strokeStyle = '#020306'; c.lineCap = 'round';
    c.beginPath(); c.arc(x + 18, 1010, 40, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(x - 30, 1060); c.lineTo(x + 40, 1060); c.lineTo(x + 20, 1230); c.lineTo(x - 40, 1230); c.closePath(); c.fill();
    c.lineWidth = 34; c.beginPath(); c.moveTo(x - 10, 1225); c.lineTo(x + Math.sin(ph) * 70, 1330); c.lineTo(x + Math.sin(ph) * 90 - 20, 1415); c.stroke();
    c.beginPath(); c.moveTo(x - 10, 1225); c.lineTo(x - Math.sin(ph) * 70, 1330); c.lineTo(x - Math.sin(ph) * 90 - 20, 1415); c.stroke();
    c.lineWidth = 24; c.beginPath(); c.moveTo(x + 10, 1080); c.lineTo(x + Math.cos(ph) * 60, 1170); c.stroke();
    c.restore();
  }
});
scene(56, 60, (c, t) => { // S16 echo
  const T = t + 56;
  if (T < 57.3) { room(c, T, { person: false, phoneOnBed: true }); return; }
  if (T < 59.2) {
    c.fillStyle = '#04060b'; c.fillRect(0, 0, W, H);
    for (const b of bokeh) glow(c, b.x, b.y, b.r, '60,100,210', b.a * 0.4);
    const z = 1 + 0.05 * ss(57.3, 59.2, T); c.translate(540, 1100); c.scale(z, z); c.translate(-540, -1100);
    phone(c, 540, 960, 820, 1700, 0, chatScreen({ scroll: 1, sent: true, seen: ss(57.95, 58.15, T) }), 1);
    return;
  }
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const a = ss(59.25, 59.5, T); c.globalAlpha = a; c.textAlign = 'center';
  c.fillStyle = '#fff'; c.font = '86px UIB'; c.fillText('Part 2  →', W / 2, 950);
  c.fillStyle = '#9fb0cc'; c.font = '28px UISB'; c.fillText('C H A I   P E N D I N G   H A I', W / 2, 1030);
  c.globalAlpha = 1;
});

// ---------- realistic photo shots (gen/pick.json maps shot -> chosen generated still).
// Registered at the front of S so they take over those time ranges from the drawn versions above.
const PICK_FILE = path.join(__dirname, 'gen', 'pick.json');
const PICK = fs.existsSync(PICK_FILE) ? JSON.parse(fs.readFileSync(PICK_FILE, 'utf8')) : null;
const IMG = {};
async function loadPhotos() { if (PICK) for (const [k, f] of Object.entries(PICK)) IMG[k] = await loadImage(fs.readFileSync(path.join(__dirname, 'gen', f))); }
// cover-fit with a slow camera move; crops the bottom 7% to remove the generator watermark
function nightGrade(c, k = 1) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'multiply'; c.globalAlpha = k; c.fillStyle = '#5d6fa8'; c.fillRect(0, 0, W, H); c.restore(); }
function photo(c, key, p, o = {}) {
  const im = IMG[key], sw = im.width, sh = im.height * 0.93;
  const s = Math.max(W / sw, H / sh) * lerp(o.z0 ?? 1.04, o.z1 ?? 1.12, p);
  c.drawImage(im, 0, 0, sw, sh, W / 2 - sw * s / 2 + lerp(o.x0 || 0, o.x1 || 0, p), H / 2 - sh * s / 2 + lerp(o.y0 || 0, o.y1 || 0, p), sw * s, sh * s);
}
if (PICK) {
  const P = [];
  const pscene = (a, b, fn) => P.push({ a, b, fn });
  pscene(5, 8, (c, t) => {
    photo(c, 'room', t / 3, { z0: 1.05, z1: 1.12, x0: 15, x1: -20 }); nightGrade(c); glow(c, 480, 1500, 300, '110,160,255', 0.25);
    c.save(); c.globalAlpha = ss(0.3, 0.9, t) * (1 - ss(2.4, 3, t)); c.textAlign = 'center'; c.fillStyle = '#e6ecf7';
    c.font = '30px UISB'; c.fillText('C H A I   P E N D I N G   H A I', W / 2, 250); c.font = '24px UI'; c.fillStyle = '#c9d4e8'; c.fillText('Episode 1  ·  Message', W / 2, 295); c.restore();
  });
  pscene(15, 18, (c, t) => photo(c, 'scooter', t / 3, { z0: 1.08, z1: 1.15, x0: 35, x1: -35, y0: Math.sin(t * 18) * 3 }));
  pscene(18, 23, (c, t) => photo(c, 'tapri', t / 5, { z0: 1.04, z1: 1.13 }));
  pscene(23, 26, (c, t) => photo(c, 'kabirLaugh', t / 3, { z0: 1.06, z1: 1.12, x0: Math.sin(t * 6) * 4, y0: Math.cos(t * 5) * 3 }));
  pscene(26, 30, (c, t) => { photo(c, 'sameerClose', t / 4, { z0: 1.04, z1: 1.15 }); glow(c, 540, 520, 520, '255,225,170', 0.12 + 0.05 * Math.sin(t * 2)); });
  pscene(30, 34, (c, t) => {
    const T = t + 30;
    photo(c, 'dineReach', clamp(t / 2.5), { z0: 1.04, z1: 1.1 });
    const x = ss(32.0, 32.6, T);
    if (x > 0) { c.globalAlpha = x; photo(c, 'dineHold', ss(32, 34, T), { z0: 1.06, z1: 1.06 + 0.9 * Math.pow(ss(33.0, 34, T), 2) }); c.globalAlpha = 1; }
    nightGrade(c, 0.8); glow(c, 300, 600, 500, '255,200,130', 0.18);
  });
  pscene(48, 53, (c, t) => { photo(c, 'realize', t / 5, { z0: 1.05, z1: 1.22 }); nightGrade(c, 0.6); });
  pscene(53, 56, (c, t) => {
    photo(c, 'leave', t / 3, { z0: 1.06, z1: 1.2, x0: -30, x1: 40 }); nightGrade(c, 0.7);
    c.fillStyle = `rgba(0,0,0,${ss(55.0, 55.6, t + 53)})`; c.fillRect(0, 0, W, H);
  });
  pscene(56, 57.3, (c, t) => { photo(c, 'empty', t / 1.3, { z0: 1.05, z1: 1.09 }); nightGrade(c, 0.7); });
  S.unshift(...P);
}

// ---------- anime layered animation (gen/anime/pick.json). Overrides the photo scenes when present.
const APICK_FILE = path.join(__dirname, 'gen', 'anime', 'pick.json');
const APICK = fs.existsSync(APICK_FILE) ? JSON.parse(fs.readFileSync(APICK_FILE, 'utf8')) : null;
const AIMG = {};
// crops the generator watermark strip; keyed layers also get the green screen removed (soft key + despill)
const { keyPlain, celShade } = require('./keylayer');
function prepLayer(im, key) {
  if (key) return celShade(keyPlain(im));
  const sw = im.width, sh = Math.floor(im.height * 0.93);
  const cv = createCanvas(sw, sh), x = cv.getContext('2d'); x.drawImage(im, 0, 0);
  return celShade(cv, { levels: 14, edge: 90, ink: 0.4, band: 0.45 });
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
  return; // drawn flaps looked heavier than the generated faces; talking is conveyed by the head motion instead
  const m = AP(key).mouth; if (!m || env <= 0) return;
  const [sx, sy] = map.toScreen([m[0], m[1]]), w = m[2] * map.s * k;
  const im = AIMG[key], px = im.getContext('2d').getImageData(Math.max(0, m[0] - Math.round(m[2] * 1.1)), m[1], 1, 1).data;
  const skin = `rgb(${px[0]},${px[1]},${px[2]})`;
  const g = c.createRadialGradient(sx, sy, w * 0.2, sx, sy, w * 0.95); g.addColorStop(0, skin); g.addColorStop(0.7, skin); g.addColorStop(1, skin.replace('rgb', 'rgba').replace(')', ',0)'));
  c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, w * 0.8, w * 0.5, 0, 0, TAU); c.fill();
  const open = Math.min(1, env * 1.1);
  c.save(); c.globalAlpha = 0.85;
  c.fillStyle = '#6b2f2b'; c.beginPath(); c.ellipse(sx, sy + w * 0.05 * open, w * (0.36 + 0.06 * open), w * (0.035 + 0.17 * open), 0, 0, TAU); c.fill();
  if (open > 0.55) { c.fillStyle = '#efe4df'; c.beginPath(); c.ellipse(sx, sy - w * 0.04, w * 0.24, w * 0.045, 0, 0, TAU); c.fill(); }
  c.strokeStyle = 'rgba(90,40,35,0.55)'; c.lineWidth = Math.max(1.5, w * 0.025); c.beginPath(); c.ellipse(sx, sy + w * 0.05 * open, w * (0.36 + 0.06 * open), w * (0.035 + 0.17 * open), 0, 0, TAU); c.stroke();
  c.restore();
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
    abg(c, 'sky_bg', { z: 1.08 + 0.03 * t, x: cx * 0.3 + 290 });
    const sun = AP('sky_bg').sun || [540, 620];
    rays(c, sun[0], sun[1], T, 0.1); glow(c, sun[0], sun[1], 520, '255,235,190', 0.3 + 0.05 * Math.sin(T * 2));
    const m = achar(c, 'sameer_close', { x: 540 + cx, y: 1060 - 10 * t, h: 1600 + 20 * t, t: T, breathe: true, sway: true, talk: env });
    mouthFlap(c, 'sameer_close', m, env);
    for (const s of AP('sameer_close').steam || []) { const [sx, sy] = m.toScreen(s); steam(c, sx, sy, T, 0.9, 0.8); }
    dust(c, T, '255,240,200', 0.4, 0.02);
  });
  ascene(30, 34, (c, t) => {
    const T = t + 30, walk = ss(30.0, 31.2, T), dip = ss(31.3, 32.4, T), dp = Math.sin(Math.PI * dip), rise = ss(32.3, 33.0, T), z = 1 + 0.9 * Math.pow(ss(33.0, 34, T), 2);
    c.translate(540, 1000); c.scale(z, z); c.translate(-540, -1000);
    abg(c, 'dining_bg', { z: 1.08, x: -walk * 20 });
    const lamp = AP('dining_bg').lamp || [540, 640]; glow(c, lamp[0], lamp[1], 220, '255,215,150', 0.6 + 0.05 * Math.sin(T * 7));
    const km = achar(c, 'kabir_news', { x: lerp(820, 540, easeOut(walk)), y: 1060 + dp * 150 + (walk < 1 ? Math.abs(Math.sin(T * 9)) * 6 : 0), h: 1500 + 60 * walk, t: T, breathe: true, rot: dp * 0.12 });
    // foreground dining table edge (hides the held paper in the layer); the clipping lies on it until he dips for it
    c.fillStyle = vgrad(c, 1150, 1920, [[0, '#4a3220'], [0.08, '#3a2616'], [1, '#160e08']]); c.beginPath(); c.moveTo(-50, 1180); c.lineTo(1130, 1150); c.lineTo(1130, 1920); c.lineTo(-50, 1920); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,200,130,0.1)'; c.beginPath(); c.ellipse(560, 1260, 420, 55, 0, 0, TAU); c.fill();
    if (dip < 0.55) { c.save(); c.translate(600, 1300); c.rotate(0.12); c.scale(0.3, 0.3 * 0.45); c.globalAlpha = 1 - ss(0.35, 0.55, dip); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 20; c.drawImage(paper.c, -PW / 2, -PH / 2); c.restore(); }
    if (rise > 0) { const [hx] = km.toScreen([212, 560]); c.save(); c.translate(hx + 20, lerp(1420, 1010, easeOut(rise))); c.rotate(-0.08 + (1 - rise) * 0.15); const ps = 330 * km.s / PW; c.scale(ps, ps); c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 25; c.drawImage(paper.c, -PW / 2, -PH / 2); c.restore(); }
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, 0, W, H); nightGrade(c, 0.35);
  });
  ascene(48, 53, (c, t) => {
    const T = t + 48, env = talkAt(T, 'k3');
    const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#3a2412'); g.addColorStop(0.45, '#120c10'); g.addColorStop(1, '#0d1a38'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    glow(c, 0, 700, 700, '255,170,90', 0.25); glow(c, W, 1300, 800, '70,130,255', 0.3 + 0.06 * Math.sin(T * 3));
    const m = achar(c, 'kabir_face', { x: 540, y: 960, h: 1800 + 200 * (t / 5), t: T, breathe: true, talk: env * 0.6 });
    mouthFlap(c, 'kabir_face', m, env, 0.9);
    c.fillStyle = vgrad(c, 1000, 1700, [[0, 'rgba(5,6,12,0)'], [1, 'rgba(5,6,12,0.97)']]); c.fillRect(0, 1000, W, H - 1000);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18; const g2 = c.createLinearGradient(0, 0, W, 0); g2.addColorStop(0, 'rgba(255,170,90,1)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(70,130,255,1)'); c.fillStyle = g2; c.fillRect(0, 0, W, H); c.restore();
  });
  ascene(53, 56, (c, t) => {
    const T = t + 53, p = ss(53.1, 55.0, T), door = AP('corridor_bg').door || [820];
    abg(c, 'corridor_bg', { z: 1.1 + 0.05 * t, x: -t * 10 });
    const ph = T * 14;
    achar(c, 'kabir_walk', { flip: true, x: lerp(160, door[0], p), y: 1150 + Math.abs(Math.sin(ph)) * 7 - p * 60, h: lerp(1450, 1150, p), t: T, rot: 0.02 * Math.sin(ph), alpha: 1 - ss(0.92, 1, p) });
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

// ---------- frame
const vig = (() => { const g = ctx.createRadialGradient(W / 2, H / 2, 520, W / 2, H / 2, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); return g; })();
const shakeR = rng(5);
function frame(T, fi) {
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  let sh = 0;
  if (T >= 45 && T < 45.5) sh = 14 * (1 - (T - 45) / 0.5);
  if (T >= 55.6 && T < 56) sh = 26 * (1 - (T - 55.6) / 0.4);
  const sc = S.find(s => T >= s.a && T < s.b) || S[S.length - 1];
  c.save(); if (sh) c.translate((shakeR() - 0.5) * sh, (shakeR() - 0.5) * sh);
  sc.fn(c, T - sc.a);
  c.restore();
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  // transitions
  if (T >= 14.75 && T < 15.7) { const a = T < 15 ? ss(14.75, 15, T) : 1 - ss(15, 15.7, T); c.fillStyle = `rgba(255,236,200,${a})`; c.fillRect(0, 0, W, H); }
  if (T >= 29.0 && T < 30) { const a = ss(29.0, 29.95, T); c.globalCompositeOperation = 'color'; c.fillStyle = `rgba(60,90,160,${a})`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; c.fillStyle = `rgba(4,6,14,${a * 0.85})`; c.fillRect(0, 0, W, H); }
  if (T >= 30 && T < 30.4) { c.fillStyle = `rgba(4,6,14,${1 - ss(30, 30.4, T)})`; c.fillRect(0, 0, W, H); }
  if (T >= 55.6 && T < 56) { c.fillStyle = `rgba(0,0,0,${0.6 * (1 - ss(55.6, 56, T))})`; c.fillRect(0, 0, W, H); }
  // flashback warmth / grain / vignette
  if (T < 59.2) {
    c.fillStyle = vig; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'overlay'; c.globalAlpha = T >= 15 && T < 30 ? 0.13 : 0.08;
    c.drawImage(grain[fi % 3], 0, 0, W, H);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  subtitles(c, T);
}

// ---------- main
(async () => {
  await loadPhotos();
  await loadAnime();
  const mode = process.argv[2] || 'video';
  if (mode === 'stills') {
    fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true });
    for (const s of (process.argv[3] || '1').split(',').map(Number)) {
      frame(s, Math.round(s * FPS));
      fs.writeFileSync(path.join(__dirname, 'stills', `t${String(s).replace('.', '_')}.png`), cv.toBuffer('image/png'));
    }
    console.log('stills done'); return;
  }
  const wav = path.join(__dirname, 'ep01_audio.wav');
  execFileSync(process.execPath, [path.join(__dirname, 'audio.js'), wav], { stdio: 'inherit' });
  const outDir = path.join(__dirname, '..', 'ep01-message'); fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'ep01_message.mp4');
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-i', wav, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = DUR * FPS, t0 = Date.now();
  for (let f = 0; f < total; f++) {
    frame(f / FPS, f);
    const data = ctx.getImageData(0, 0, W, H).data;
    if (!ff.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done ->', out);
})();
