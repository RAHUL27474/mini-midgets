// Builds the Kaggle LTX-Video image-to-video jobs for Aakhri Local EP4 (run with chai-pending-hai/render/anime/kg_ltx.py):
// each AI still (ep04/shots_ai) becomes a real motion clip at 1080x1920/60fps -> ep04/clips/<id>.mp4 after pulling.
// node build_ltx_ep04.js  -> jobs/ltx4_shots.json + jobs/ltx4_a..e.json
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', '..', '..', 'chai-pending-hai', 'render', 'node_modules');
const { createCanvas, loadImage } = require(path.join(NM, '@napi-rs', 'canvas'));
const T = require('../edit/ep04_timing');
const SHOTS_DIR = path.join(__dirname, '..', '..', 'ep04', 'shots_ai');

const MOTION = {
  s01: 'A young woman climbs the outside wooden stairs of an old building at night in the rain, clothes on the lines sway',
  s02: 'A middle-aged woman pours hot tea from a pan into two small glasses, steam rises',
  s03: 'A hand sets an old folded newspaper down on a small table beside two glasses of tea, steam drifts',
  s04: 'A young woman with wet eyes speaks, her lips trembling, a tear forms',
  s05: 'A middle-aged woman freezes with a glass of tea halfway to her lips and slowly lowers it',
  s06: 'A middle-aged woman sitting on a bed looks out of the window at distant city lights, a distant train passes',
  s07: 'A middle-aged woman with tears in her eyes, a tear rolls down her cheek, she presses her lips together',
  s08: 'A woman reaches up and lifts down an old round tin from the top of a steel cupboard',
  s09: 'The lid lifts away from an old tin revealing a faded baby shawl and half a burnt ticket, light falls on them',
  s10: 'A young hand slides an old ticket into place beside a half-burnt identical ticket on a table',
  s11: 'Slow push in on two old tickets lined up edge to edge, light glints across them',
  s12: 'A mother and daughter look at each other across a small table, the mother lips tremble',
  s13: 'Slow push in on a paper calendar with the date 14 circled in red',
  s14: 'A young woman squeezes her mother hand across a table and looks up with determination',
  s15: 'Through a rainy window, lights of a passing train streak across the glass while two women sit at a table inside',
};

(async () => {
  const out = path.join(__dirname, 'jobs'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'ltx4_shots.json'), JSON.stringify({ shots: T.SHOTS.map(s => ({ id: s.id, dur: s.dur + 0.4, motion: MOTION[s.id] })) }));
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
    fs.writeFileSync(path.join(out, `ltx4_${k}.json`), JSON.stringify({ ids, inline: Object.fromEntries(ids.map(i => [i, inline[i]])), w: 512, h: 896, seed: 42, max_frames: 121 }));
  console.log('wrote ltx jobs', Object.keys(groups).join(' '));
})();
