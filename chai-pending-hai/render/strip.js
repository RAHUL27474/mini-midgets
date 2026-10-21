const { createCanvas, loadImage } = require('@napi-rs/canvas'); const fs=require('fs');
(async()=>{ const files=process.argv.slice(3); const im0=await loadImage(fs.readFileSync('stills/'+files[0])); const w=Math.round(500*im0.width/im0.height), h=500;
const c=createCanvas(files.length*w, h); const x=c.getContext('2d');
for(let i=0;i<files.length;i++){ const im=await loadImage(fs.readFileSync('stills/'+files[i])); x.drawImage(im,i*w,0,w,h);} fs.writeFileSync(process.argv[2], c.toBuffer('image/png')); })();
