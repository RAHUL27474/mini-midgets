const { createCanvas, loadImage } = require('@napi-rs/canvas'); const fs=require('fs');
(async()=>{ const files=fs.readdirSync('gen/anime').filter(f=>/_11\.jpg$/.test(f)).sort(); const cols=4,w=240,h=427; const rows=Math.ceil(files.length/cols);
const c=createCanvas(cols*w, rows*(h+26)); const x=c.getContext('2d'); x.fillStyle='#333'; x.fillRect(0,0,c.width,c.height);
for(let i=0;i<files.length;i++){ const im=await loadImage(fs.readFileSync('gen/anime/'+files[i])); x.drawImage(im,(i%cols)*w,Math.floor(i/cols)*(h+26),w,h); x.fillStyle='#fff'; x.font='16px sans-serif'; x.fillText(files[i],(i%cols)*w+6,Math.floor(i/cols)*(h+26)+h+19);}
fs.writeFileSync('animesheet3.png', c.toBuffer('image/png')); console.log(files.length); })();


