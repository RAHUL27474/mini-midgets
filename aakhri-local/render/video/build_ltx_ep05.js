// Builds the Kaggle LTX-Video image-to-video jobs for Aakhri Local EP5 (run with chai-pending-hai/render/anime/kg_ltx.py):
// each AI still (ep05/shots_ai) becomes a real motion clip at 1080x1920/60fps -> ep05/clips/<id>.mp4 after pulling.
// node build_ltx_ep05.js  -> jobs/ltx5_shots.json + jobs/ltx5_a..e.json
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', '..', '..', 'chai-pending-hai', 'render', 'node_modules');
const { createCanvas, loadImage } = require(path.join(NM, '@napi-rs', 'canvas'));
const T = require('../edit/ep05_timing');
const SHOTS_DIR = path.join(__dirname, '..', '..', 'ep05', 'shots_ai');

const MOTION = {
  s01: 'Two women stand still on an empty night platform in light drizzle, the minute hand of a big clock moves, the mother clutches a tin',
  s02: 'A local train glides into a night platform and slows to a stop, its headlight glowing, light rain',
  s03: 'Camera pans to an old man sitting by the open train door, warm light pulses softly around him, he looks up',
  s04: 'An old man slowly takes off his round glasses, eyes filling with tears, a tear rolls down his cheek',
  s05: 'A woman kneels slowly and touches the feet of a seated old man, her shoulders shaking with emotion',
  s06: 'An old wrinkled hand lowers gently onto the head of a kneeling woman in blessing, warm light glows',
  s07: 'A young woman with tears on her face steps forward and smiles, wiping a tear',
  s08: 'An old man puts his glasses back on and chuckles softly, hand on his chest',
  s09: 'A young woman speaks through tears to an old man by the train door, he nods slowly, warm light',
  s10: 'Wind stirs an old man white hair as he looks out of the open train door into the dawn sky and closes his eyes peacefully',
  s11: 'A train bursts out of a tunnel into golden sunrise, warm light floods through the windows and blooms',
  s12: 'Golden light settles on an empty train seat with a small tiffin and a jasmine flower, a petal stirs in the breeze',
  s13: 'Slow push in on a brass memorial plaque on a railway pillar, a marigold garland sways gently, commuters blur past',
  s14: 'A hand touches a brass plaque, the wristwatch second hand starts moving again',
  s15: 'A crowded morning local train rushes past in a blur while two women stand still together on the platform, slow pull back',
};

(async () => {
  const out = path.join(__dirname, 'jobs'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'ltx5_shots.json'), JSON.stringify({ shots: T.SHOTS.map(s => ({ id: s.id, dur: s.dur + 0.4, motion: MOTION[s.id] })) }));
  const inline = {};
  for (const s of T.SHOTS) {
    if (!fs.existsSync(path.join(SHOTS_DIR, `${s.id}.png`))) continue; // not generated yet: its group is written on a later run
    const im = await loadImage(path.join(SHOTS_DIR, `${s.id}.png`)), c = createCanvas(512, 896), x = c.getContext('2d');
    const sc = Math.max(512 / im.width, 896 / im.height), w = im.width * sc, h = im.height * sc;
    x.drawImage(im, (512 - w) / 2, (896 - h) / 2, w, h);
    inline[s.id] = c.toBuffer('image/jpeg', 80).toString('base64');
  }
  const groups = { a: ['s01', 's02', 's03'], b: ['s04', 's05', 's06'], c: ['s07', 's08', 's09'], d: ['s10', 's11', 's12'], e: ['s13', 's14', 's15'] };
  for (const [k, ids] of Object.entries(groups)) if (ids.every(i => inline[i]))
    fs.writeFileSync(path.join(out, `ltx5_${k}.json`), JSON.stringify({ ids, inline: Object.fromEntries(ids.map(i => [i, inline[i]])), w: 512, h: 896, seed: 42, max_frames: 121 }));
  console.log('wrote ltx jobs', Object.keys(groups).join(' '));
})();
