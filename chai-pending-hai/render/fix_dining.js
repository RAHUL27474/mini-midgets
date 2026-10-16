// One-off: replace the dining scene with the foreground-table version.
const fs = require('fs');
let r = fs.readFileSync('render.js', 'utf8');
const a = r.indexOf("  ascene(30, 34, (c, t) => {"), b = r.indexOf("  ascene(48, 53, (c, t) => {");
if (a < 0 || b < 0) throw new Error('markers');
const scene = `  ascene(30, 34, (c, t) => {
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
`;
r = r.slice(0, a) + scene + r.slice(b);
fs.writeFileSync('render.js', r); console.log('dining scene replaced');
