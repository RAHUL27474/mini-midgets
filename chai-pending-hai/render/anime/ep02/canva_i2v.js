// Animates every Canva still (ep02/canva/sNN.png) into an anime clip with Wan 2.2 i2v on Hugging Face (LTX fallback),
// using each shot's "motion" direction from ep02/shots.json. Skips clips that already exist.
// usage: node anime/ep02/canva_i2v.js [s01,s05,...]   -> ep02/canva_clips/sNN.mp4
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs'), path = require('path');

const DIR = __dirname, CLIPS = path.join(DIR, 'canva_clips'), I2V = path.join(DIR, '..', '..', 'wan_i2v.js');
const STYLE = 'anime style, 2D hand-drawn animation, cel shading, smooth natural motion, consistent character, high quality anime film. ';
const only = process.argv[2] ? process.argv[2].split(',') : null;
const shots = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8')).shots.filter(s => !only || only.includes(s.id));
fs.mkdirSync(CLIPS, { recursive: true });

for (const s of shots) {
  const out = path.join(CLIPS, `${s.id}.mp4`);
  if (fs.existsSync(out)) { console.log(s.id, 'exists'); continue; }
  const jpg = path.join(CLIPS, `${s.id}_in.jpg`);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', path.join(DIR, 'canva', `${s.id}.png`), '-q:v', '2', jpg]);
  const secs = String(Math.min(5, Math.ceil((s.dur + 0.4) * 2) / 2));
  for (const engine of ['wan', 'wan', 'ltx']) {
    try {
      console.log(s.id, engine, secs + 's');
      execFileSync('node', [I2V, jpg, out, STYLE + s.motion, secs, engine], { stdio: 'inherit', timeout: 900000 });
      if (fs.existsSync(out)) break;
    } catch (e) { console.log(s.id, engine, 'failed:', e.message.split('\n')[0]); }
  }
  if (!fs.existsSync(out)) console.log(s.id, 'NO CLIP');
}
