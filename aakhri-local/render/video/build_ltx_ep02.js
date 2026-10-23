// Builds the Kaggle LTX-Video image-to-video jobs for Aakhri Local EP2 (run with chai-pending-hai/render/anime/kg_ltx.py):
// each AI still (ep02/shots_ai) becomes a real motion clip at 1080x1920/60fps -> ep02/clips/<id>.mp4 after pulling.
// node build_ltx_ep02.js  -> jobs/ltx2_shots.json + jobs/ltx2_a..e.json
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', '..', '..', 'chai-pending-hai', 'render', 'node_modules');
const { createCanvas, loadImage } = require(path.join(NM, '@napi-rs', 'canvas'));
const T = require('../edit/ep02_timing');
const SHOTS_DIR = path.join(__dirname, '..', '..', 'ep02', 'shots_ai');

const MOTION = {
  s01: 'A young nurse stands alone on an empty night platform in drizzle, holding an old ticket, looking toward the dark tunnel, the station sign flickers',
  s02: 'Close-up of a young woman as a bright train headlight sweeps across her face, she looks up and swallows nervously, rain falling',
  s03: 'An old man sitting in a night train looks up and smiles warmly as a young woman steps in through the door, the train sways',
  s04: 'A young woman sits down slowly on a train seat and grips her bag strap, tense, looking across, the train sways',
  s05: 'An old man chuckles and turns his head to look out of the rain-streaked train window at passing city lights',
  s06: 'Wrinkled old hands gently pat a small round steel tiffin box on his lap, the train sways softly',
  s07: 'A young woman laughs softly and shakes her head, eyes crinkling, city lights streak past the window behind her',
  s08: 'An old man tells a story with gentle hand gestures while a young woman leans in and nods, the train coach rocks gently',
  s09: 'A young woman tilts her head slightly and asks a question softly, the train sways, lights pass outside',
  s10: 'An old man smiles faintly and slowly raises his hand to point at the seat beside the open train door, rain blows in through the door',
  s11: 'Extreme close-up of a cracked wristwatch, the second hand ticks and stops',
  s12: 'The fluorescent lights of an empty train coach flicker rapidly and go dark',
  s13: 'A young woman jerks forward and half stands up from her seat in shock, staring at the empty seat opposite',
  s14: 'Slow push in on a small steel tiffin box alone on an empty train seat, a thin wisp of steam rises and curls',
  s15: 'Hands slowly lift the lid of a steel tiffin box revealing orange jalebis inside, faint steam rises',
};

(async () => {
  const out = path.join(__dirname, 'jobs'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'ltx2_shots.json'), JSON.stringify({ shots: T.SHOTS.map(s => ({ id: s.id, dur: s.dur + 0.4, motion: MOTION[s.id] })) }));
  const inline = {};
  for (const s of T.SHOTS) {
    if (!fs.existsSync(path.join(SHOTS_DIR, `${s.id}.png`))) continue; // not generated yet: its group is written on a later run
    const im = await loadImage(path.join(SHOTS_DIR, `${s.id}.png`)), c = createCanvas(512, 896), x = c.getContext('2d');
    const sc = Math.max(512 / im.width, 896 / im.height), w = im.width * sc, h = im.height * sc;
    x.drawImage(im, (512 - w) / 2, (896 - h) / 2, w, h);
    inline[s.id] = c.toBuffer('image/jpeg', 80).toString('base64');
  }
  const groups = { a: ['s05', 's07', 's10'], b: ['s13', 's01', 's04'], c: ['s06', 's08', 's09'], d: ['s14', 's02', 's03'], e: ['s11', 's12', 's15'] };
  for (const [k, ids] of Object.entries(groups)) if (ids.every(i => inline[i]))
    fs.writeFileSync(path.join(out, `ltx2_${k}.json`), JSON.stringify({ ids, inline: Object.fromEntries(ids.map(i => [i, inline[i]])), w: 512, h: 896, seed: 42, max_frames: 121 }));
  console.log('wrote ltx jobs', Object.keys(groups).join(' '));
})();
