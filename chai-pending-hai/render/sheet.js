const { createCanvas, loadImage } = require('@napi-rs/canvas'); const fs=require('fs');
(async()=>{ const files=process.argv.slice(3); const cols=5, w=270, h=480; const rows=Math.ceil(files.length/cols);
const c=createCanvas(cols*w, rows*(h+30)); const x=c.getContext('2d'); x.fillStyle='#333'; x.fillRect(0,0,c.width,c.height);
for(let i=0;i<files.length;i++){ const im=await loadImage(fs.readFileSync('stills/'+files[i])); x.drawImage(im,(i%cols)*w,Math.floor(i/cols)*(h+30),w,h); x.fillStyle='#fff'; x.font='18px sans-serif'; x.fillText(files[i],(i%cols)*w+6,Math.floor(i/cols)*(h+30)+h+22);}
fs.writeFileSync(process.argv[2], c.toBuffer('image/png')); })();
