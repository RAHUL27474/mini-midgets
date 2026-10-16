// Draws a labelled 50px grid over a layer so coordinates can be read: node gridview.js file.jpg out.png
const { createCanvas, loadImage } = require('@napi-rs/canvas'); const fs = require('fs');
(async () => {
  const im = await loadImage(fs.readFileSync('gen/anime/' + process.argv[2]));
  const c = createCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0);
  x.strokeStyle = 'rgba(0,255,255,0.6)'; x.lineWidth = 1; x.font = '12px sans-serif';
  for (let gx = 0; gx < im.width; gx += 50) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, im.height); x.stroke(); }
  for (let gy = 0; gy < im.height; gy += 50) { x.beginPath(); x.moveTo(0, gy); x.lineTo(im.width, gy); x.stroke(); x.fillStyle = '#ff0'; x.fillText(String(gy), 2, gy - 2); }
  for (let gx = 0; gx < im.width; gx += 100) { x.fillStyle = '#ff0'; x.fillText(String(gx), gx + 2, 12); }
  fs.writeFileSync(process.argv[3], c.toBuffer('image/png'));
})();
