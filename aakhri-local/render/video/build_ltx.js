// Builds the Kaggle LTX-Video image-to-video jobs for Aakhri Local EP1 (run with chai-pending-hai/render/anime/kg_ltx.py):
// each AI still (ep01/shots_ai) becomes a real motion clip at 1080x1920/60fps -> ep01/clips/<id>.mp4 after pulling.
// node build_ltx.js  -> jobs/ltx_shots.json + jobs/ltx_a.json, ltx_b.json, ltx_c.json
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', '..', '..', 'chai-pending-hai', 'render', 'node_modules');
const { createCanvas, loadImage } = require(path.join(NM, '@napi-rs', 'canvas'));
const T = require('../edit/ep01_timing');
const SHOTS_DIR = path.join(__dirname, '..', '..', 'ep01', 'shots_ai');

const MOTION = {
  s01: 'A young nurse steps out of glowing hospital doors into heavy rain, lowers her wrist after checking her watch and starts walking, rain falling, red sign glowing',
  s02: 'A young woman runs down wet station stairs toward the camera, braid swinging, tote bag bouncing, rain dripping',
  s03: 'A local train approaches through heavy rain with its headlight blooming, slowing to a stop at the platform, rain streaks lit by the headlight',
  s04: 'A tired young nurse sitting in a swaying night train, head resting on the window, eyes slowly closing, city lights streaking past outside, tube light flickering',
  s05: 'An old man sitting on a train seat looks up and smiles gently, blinks slowly, the train sways softly, warm light on him, city lights streaking past',
  s06: 'A young woman leans her head on the train window, blinks slowly, colored city lights sweep across her face, rain drops on the glass',
  s07: 'An old man leans forward and holds out an old ticket toward the young woman, speaking kindly, the train sways',
  s08: 'A young woman takes a ticket from an old hand, looks down at it with a puzzled polite smile, the train sways',
  s09: 'A trembling hand holds an old burnt train ticket, light flickers across it, slow push in',
  s10: 'A young woman looks up from the ticket and starts to speak with an amused half laugh, the train sways, lights pass outside',
  s11: 'An empty green train seat, rain streams down the window behind it, fluorescent light flickers, city lights streak past, eerie',
  s12: 'A young woman stands in the empty train aisle and turns her head left and right anxiously, grab handles swing, the train sways',
  s13: 'A ticket checker punches the young woman’s pass while she points at an empty seat in alarm, the train sways',
  s14: 'A ticket checker frowns and glances around the empty train coach, uneasy, flickering light above',
  s15: 'A trembling hand holds an old ticket, the wristwatch second hand stops, slow push in, dark train background',
};

(async () => {
  const out = path.join(__dirname, 'jobs'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'ltx_shots.json'), JSON.stringify({ shots: T.SHOTS.map(s => ({ id: s.id, dur: s.dur + 0.4, motion: MOTION[s.id] })) }));
  const inline = {};
  for (const s of T.SHOTS) {
    const im = await loadImage(path.join(SHOTS_DIR, `${s.id}.png`)), c = createCanvas(512, 896), x = c.getContext('2d');
    const sc = Math.max(512 / im.width, 896 / im.height), w = im.width * sc, h = im.height * sc;
    x.drawImage(im, (512 - w) / 2, (896 - h) / 2, w, h);
    inline[s.id] = c.toBuffer('image/jpeg', 80).toString('base64');
  }
  const groups = { a: ['s05', 's07', 's10'], b: ['s13', 's01', 's04'], c: ['s06', 's08', 's12'], d: ['s14', 's02', 's03'], e: ['s09', 's11', 's15'] };
  for (const [k, ids] of Object.entries(groups))
    fs.writeFileSync(path.join(out, `ltx_${k}.json`), JSON.stringify({ ids, inline: Object.fromEntries(ids.map(i => [i, inline[i]])), w: 512, h: 896, seed: 42, max_frames: 121 }));
  console.log('wrote ltx jobs', Object.keys(groups).join(' '));
})();
