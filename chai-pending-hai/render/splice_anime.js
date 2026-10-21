// One-off: insert anime_scenes.js into render.js before the frame section and load the layers at startup.
const fs = require('fs');
let r = fs.readFileSync('render.js', 'utf8');
if (r.includes('anime layered animation')) { console.log('already spliced'); process.exit(0); }
const i = r.indexOf('// ---------- frame');
if (i < 0) throw new Error('frame marker not found');
r = r.slice(0, i) + fs.readFileSync('anime_scenes.js', 'utf8') + r.slice(i);
r = r.replace('  await loadPhotos();', '  await loadPhotos();\n  await loadAnime();');
fs.writeFileSync('render.js', r);
console.log('spliced');
