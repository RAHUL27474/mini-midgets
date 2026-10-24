// Builds the Kaggle LTX-Video image-to-video jobs for Aakhri Local EP3 (run with chai-pending-hai/render/anime/kg_ltx.py):
// each AI still (ep03/shots_ai) becomes a real motion clip at 1080x1920/60fps -> ep03/clips/<id>.mp4 after pulling.
// node build_ltx_ep03.js  -> jobs/ltx3_shots.json + jobs/ltx3_a..e.json
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', '..', '..', 'chai-pending-hai', 'render', 'node_modules');
const { createCanvas, loadImage } = require(path.join(NM, '@napi-rs', 'canvas'));
const T = require('../edit/ep03_timing');
const SHOTS_DIR = path.join(__dirname, '..', '..', 'ep03', 'shots_ai');

const MOTION = {
  s01: 'Pigeons take off from a gothic railway station building while commuters hurry past and a young woman walks against the crowd',
  s02: 'A young woman pushes open a heavy wooden door, it creaks open slowly, dust drifts in the light',
  s03: 'Ceiling fans turn slowly in a huge archive room, dust floats in light shafts, a young woman walks down the aisle between tall shelves',
  s04: 'An old clerk turns an old ticket over in his fingers and raises an eyebrow, peering over his spectacles',
  s05: 'An old finger slides down a handwritten ledger page and stops on one line, dust floats in the air',
  s06: 'A young woman carefully unfolds a large brittle old newspaper at a long table under a green lamp',
  s07: 'Slow push in on an old newspaper front page and its grainy photograph',
  s08: 'Flames flicker and thick smoke billows from a burning train coach at night while silhouettes run on the platform, sepia film grain',
  s09: 'An old man steps out of thick smoke from a burning train door cradling a crying baby, smoke swirls around him, sepia',
  s10: 'An old man hands a baby to a railway porter, then turns and walks back into the smoke toward the fire, sepia',
  s11: 'A tear forms in a young woman eye as her fingertip trembles on an old newspaper photo',
  s12: 'A young woman leans in closer over an old newspaper, focus shifts to a small photo',
  s13: 'Slow push in on an old newspaper caption under a grainy baby photo',
  s14: 'A young woman stares in shock, frozen, as a ceiling fan slows to a stop behind her',
  s15: 'A smartphone vibrates and lights up with an incoming call in a trembling hand',
};

(async () => {
  const out = path.join(__dirname, 'jobs'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'ltx3_shots.json'), JSON.stringify({ shots: T.SHOTS.map(s => ({ id: s.id, dur: s.dur + 0.4, motion: MOTION[s.id] })) }));
  const inline = {};
  for (const s of T.SHOTS) {
    if (!fs.existsSync(path.join(SHOTS_DIR, `${s.id}.png`))) continue; // not generated yet: its group is written on a later run
    const im = await loadImage(path.join(SHOTS_DIR, `${s.id}.png`)), c = createCanvas(512, 896), x = c.getContext('2d');
    const sc = Math.max(512 / im.width, 896 / im.height), w = im.width * sc, h = im.height * sc;
    x.drawImage(im, (512 - w) / 2, (896 - h) / 2, w, h);
    inline[s.id] = c.toBuffer('image/jpeg', 80).toString('base64');
  }
  const groups = { a: ['s01', 's02', 's03'], b: ['s04', 's05', 's07'], c: ['s08', 's09', 's10'], d: ['s13', 's11', 's14'], e: ['s06', 's12', 's15'] };
  for (const [k, ids] of Object.entries(groups)) if (ids.every(i => inline[i]))
    fs.writeFileSync(path.join(out, `ltx3_${k}.json`), JSON.stringify({ ids, inline: Object.fromEntries(ids.map(i => [i, inline[i]])), w: 512, h: 896, seed: 42, max_frames: 121 }));
  console.log('wrote ltx jobs', Object.keys(groups).join(' '));
})();
