const { createCanvas, loadImage } = require('@napi-rs/canvas'); const fs = require('fs');
const { keyPlain, celShade } = require('./keylayer');
(async () => {
  const items = process.argv.slice(2), w = 300, h = 500;
  const c = createCanvas(items.length * w, h), x = c.getContext('2d');
  for (let i = 0; i < items.length; i++) {
    const [file, mode] = items[i].split(':'); const im = await loadImage(fs.readFileSync('gen/anime/' + file));
    let k; if (mode === 'bg') { k = createCanvas(im.width, Math.floor(im.height*0.93)); k.getContext('2d').drawImage(im,0,0); celShade(k); } else { k = celShade(keyPlain(im)); }
    x.fillStyle = '#ff00ff'; x.fillRect(i * w, 0, w, h);
    const s = Math.min(w / k.width, h / k.height); x.drawImage(k, i * w + (w - k.width * s) / 2, 0, k.width * s, k.height * s);
  }
  fs.writeFileSync('keytest.png', c.toBuffer('image/png')); console.log('ok');
})();
