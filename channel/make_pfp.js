// Kissaverse profile picture: node channel/make_pfp.js
const path = require('path');
const fs = require('fs');
const { createCanvas, GlobalFonts } = require(path.join(__dirname, '../chai-pending-hai/render/node_modules/@napi-rs/canvas'));

GlobalFonts.registerFromPath('C:/Windows/Fonts/seguibl.ttf', 'SegoeBlack');
GlobalFonts.registerFromPath('C:/Windows/Fonts/NirmalaB.ttf', 'NirmalaB');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const SAFFRON = '#ff9a2e', GOLD = '#ffc94d', CREAM = '#fff4dc';

function rand(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function sparkle(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = r * 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

function ring(ctx, S, front) {
  // tilted orbit; draw back half or front half
  ctx.save();
  ctx.translate(S / 2, S * 0.52);
  ctx.rotate(-0.38);
  ctx.lineWidth = S * 0.028;
  ctx.lineCap = 'butt';
  const g = ctx.createLinearGradient(-S * 0.42, 0, S * 0.42, 0);
  g.addColorStop(0, SAFFRON); g.addColorStop(0.5, GOLD); g.addColorStop(1, SAFFRON);
  ctx.strokeStyle = g;
  ctx.shadowColor = SAFFRON; ctx.shadowBlur = S * 0.03;
  ctx.beginPath();
  if (front) ctx.ellipse(0, 0, S * 0.40, S * 0.12, 0, -0.02 * Math.PI, 1.02 * Math.PI);
  else ctx.ellipse(0, 0, S * 0.40, S * 0.12, 0, Math.PI, 2 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function render(glyph, font, yNudge, name) {
  const S = 1080;
  const c = createCanvas(S, S);
  const ctx = c.getContext('2d');

  // night sky
  const bg = ctx.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.75);
  bg.addColorStop(0, '#3a2a8a'); bg.addColorStop(0.55, '#1c1650'); bg.addColorStop(1, '#0a0820');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);

  // warm glow behind the letter
  const glow = ctx.createRadialGradient(S / 2, S * 0.5, 0, S / 2, S * 0.5, S * 0.36);
  glow.addColorStop(0, 'rgba(255,154,46,0.45)'); glow.addColorStop(1, 'rgba(255,154,46,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);

  // stars
  const r = rand(7);
  for (let i = 0; i < 140; i++) {
    const x = r() * S, y = r() * S, s = r() * 2.4 + 0.6;
    ctx.globalAlpha = 0.35 + r() * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ring(ctx, S, false);

  // the letter
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${font.size}px ${font.family}`;
  ctx.fillStyle = '#c4561a';
  ctx.fillText(glyph, S / 2 + S * 0.012, S * 0.5 + yNudge + S * 0.014);
  const lg = ctx.createLinearGradient(0, S * 0.25, 0, S * 0.75);
  lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, CREAM);
  ctx.fillStyle = lg;
  ctx.shadowColor = 'rgba(255,190,90,0.6)'; ctx.shadowBlur = S * 0.03;
  ctx.fillText(glyph, S / 2, S * 0.5 + yNudge);
  ctx.shadowBlur = 0;

  ring(ctx, S, true);

  sparkle(ctx, S * 0.74, S * 0.27, S * 0.045, GOLD);
  sparkle(ctx, S * 0.27, S * 0.74, S * 0.028, CREAM);
  sparkle(ctx, S * 0.30, S * 0.28, S * 0.018, CREAM);

  for (const size of [1080, 800]) {
    const o = createCanvas(size, size);
    o.getContext('2d').drawImage(c, 0, 0, size, size);
    fs.writeFileSync(path.join(OUT, `${name}_${size}.png`), o.toBuffer('image/png'));
  }

  // circle preview (how YouTube/Instagram crop it)
  const p = createCanvas(S, S), pc = p.getContext('2d');
  pc.fillStyle = '#0f0f0f'; pc.fillRect(0, 0, S, S);
  pc.beginPath(); pc.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); pc.clip();
  pc.drawImage(c, 0, 0);
  fs.writeFileSync(path.join(OUT, `${name}_circle_preview.png`), p.toBuffer('image/png'));
}

render('K', { family: 'SegoeBlack', size: 560 }, 10, 'kissaverse_pfp_K');
render('क', { family: 'NirmalaB', size: 600 }, -20, 'kissaverse_pfp_ka');
console.log('done', fs.readdirSync(OUT));
