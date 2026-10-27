// EP3 YouTube thumbnail + Instagram reel cover: node make_thumbs.js
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage, GlobalFonts } = require(path.join(__dirname, '../../chai-pending-hai/render/node_modules/@napi-rs/canvas'));

GlobalFonts.registerFromPath('C:/Windows/Fonts/NirmalaB.ttf', 'NirmalaB');
GlobalFonts.registerFromPath('C:/Windows/Fonts/seguibl.ttf', 'SegoeBlack');
const OUT = path.join(__dirname, 'out');

function cover(ctx, im, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
  const s = Math.max(w / im.width, h / im.height) * zoom;
  const dw = im.width * s, dh = im.height * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(im, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
  ctx.restore();
}

function outlined(ctx, text, x, y, fill, stroke, lw) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

function badge(ctx, x, y, h, text, font) {
  ctx.font = font;
  const w = ctx.measureText(text).width + h * 0.9;
  ctx.fillStyle = '#ffc94d';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h * 0.2); ctx.fill();
  ctx.fillStyle = '#140f3a'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(text, x + h * 0.45, y + h * 0.54);
  return w;
}

(async () => {
  const man = await loadImage(path.join(__dirname, 'shots_ai/s09.png'));
  const ticket = await loadImage(path.join(__dirname, 'shots_ai/s11.png'));
  const seat = await loadImage(path.join(__dirname, 'shots_ai/s11.png'));

  // ---- YouTube thumbnail 1280x720
  {
    const W = 1280, H = 720, c = createCanvas(W, H), x = c.getContext('2d');
    cover(x, man, 0, 0, 700, H, 0.5, 0.25, 1.15);
    // warm wash on the old man
    const wg = x.createLinearGradient(0, 0, 700, 0);
    wg.addColorStop(0, 'rgba(255,150,60,0.18)'); wg.addColorStop(1, 'rgba(255,150,60,0)');
    x.fillStyle = wg; x.fillRect(0, 0, 700, H);
    // ticket panel, angled split
    x.save();
    x.beginPath(); x.moveTo(640, 0); x.lineTo(W, 0); x.lineTo(W, H); x.lineTo(560, H); x.closePath(); x.clip();
    cover(x, ticket, 560, 0, 720, H, 0.5, 0.45, 1.2);
    x.fillStyle = 'rgba(20,40,70,0.25)'; x.fillRect(560, 0, 720, H);
    x.restore();
    x.strokeStyle = '#ffc94d'; x.lineWidth = 8;
    x.beginPath(); x.moveTo(640, 0); x.lineTo(560, H); x.stroke();
    // bottom shade for text
    const bg = x.createLinearGradient(0, H * 0.45, 0, H);
    bg.addColorStop(0, 'rgba(5,5,20,0)'); bg.addColorStop(1, 'rgba(5,5,20,0.9)');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);

    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.font = '118px NirmalaB';
    outlined(x, '1975 की आग...', 44, 640, '#ffffff', '#0a0820', 18);
    x.font = '118px NirmalaB';
    // highlight the year in gold
    outlined(x, '1975', 44, 640, '#ffc94d', '#0a0820', 18);
    badge(x, 44, 40, 64, 'AAKHRI LOCAL · EP 3', '38px SegoeBlack');
    x.font = '44px NirmalaB';
    outlined(x, '14 जुलाई', 1080, 100, '#ffffff', '#0a0820', 10);
    fs.writeFileSync(path.join(OUT, 'ep03_thumbnail_1280x720.jpg'), c.toBuffer('image/jpeg', 92));
  }

  // ---- Instagram reel cover 1080x1920 (grid shows centre 1080x1350, keep text inside)
  {
    const W = 1080, H = 1920, c = createCanvas(W, H), x = c.getContext('2d');
    cover(x, man, 0, 0, W, 1100, 0.5, 0.2, 1.0);
    const wg = x.createLinearGradient(0, 0, 0, 1100);
    wg.addColorStop(0, 'rgba(255,150,60,0.12)'); wg.addColorStop(1, 'rgba(255,150,60,0)');
    x.fillStyle = wg; x.fillRect(0, 0, W, 1100);
    cover(x, ticket, 0, 1100, W, 820, 0.5, 0.5, 1.0);
    x.fillStyle = '#ffc94d'; x.fillRect(0, 1094, W, 12);
    const bg = x.createLinearGradient(0, 700, 0, 1500);
    bg.addColorStop(0, 'rgba(5,5,20,0)'); bg.addColorStop(0.5, 'rgba(5,5,20,0.8)'); bg.addColorStop(1, 'rgba(5,5,20,0)');
    x.fillStyle = bg; x.fillRect(0, 700, W, 800);

    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = '50px SegoeBlack';
    const bw = (() => { x.font = '46px SegoeBlack'; return x.measureText('AAKHRI LOCAL · EP 3').width + 70; })();
    badge(x, (W - bw) / 2, 900, 76, 'AAKHRI LOCAL · EP 3', '46px SegoeBlack');
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = '128px NirmalaB';
    outlined(x, '1975 की आग...', W / 2, 1120, '#ffffff', '#0a0820', 20);
    x.font = '56px NirmalaB';
    outlined(x, 'और एक अनजान फ़रिश्ता', W / 2, 1220, '#ffe2a8', '#0a0820', 12);
    fs.writeFileSync(path.join(OUT, 'ep03_reel_cover_1080x1920.jpg'), c.toBuffer('image/jpeg', 92));
  }
  console.log('done');
})();
