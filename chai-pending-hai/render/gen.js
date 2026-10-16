// Generates realistic stills for the character shots (Pollinations / Flux), 2 seeds per shot.
// Usage: node gen.js            -> all shots
//        node gen.js tapri,room -> only these shots
const fs = require('fs'), path = require('path');
const { loadImage } = require('@napi-rs/canvas');

const KABIR = '26-year-old Indian man named Kabir, brown skin, short neat black hair with a side part, light stubble, slim face, tired gentle eyes, light blue cotton shirt';
const KABIR_Y = '21-year-old Indian young man, brown skin, clean-shaven, short neat black hair with a side part, slim face, grey t-shirt under a blue denim jacket';
const SAMEER = '21-year-old Indian young man, brown skin, messy wavy black hair, round face, small mole under left eye, cheerful wide grin, red hoodie';
const STYLE = 'photorealistic cinematic film still, 35mm lens, natural skin texture, realistic Indian setting, high detail, vertical composition';
const NIGHT = 'night, dim cool blue moody lighting';
const GOLD = 'warm golden hour sunlight, nostalgic soft haze';

const SHOTS = {
  room: `holding a glowing smartphone in both hands and staring at the screen, ${KABIR}, sitting alone on the edge of a bed in a small dark rented room in India, face lit only by blue smartphone light, small untouched birthday cake on a plastic chair, window with city lights, ${NIGHT}`,
  scooter: `two young Indian men riding an old blue scooter on a tree-lined Indian road, driver: ${SAMEER} laughing; passenger behind him: ${KABIR_Y} smiling, side view, wind in hair, ${GOLD}`,
  tapri: `two young Indian MEN, male college boys with short hair, no glasses, light beard stubble, two different young Indian male friends at a roadside chai tapri stall in India, the friend on the RIGHT wears a bright RED HOODIE and has messy wavy hair and is laughing, the friend on the LEFT wears a blue denim jacket over a grey t-shirt and smiles, both hold small glasses of milky tea with steam, tea stall with big aluminium kettle behind them, ${GOLD}`,
  kabirLaugh: `close-up portrait of ${KABIR_Y}, laughing and shaking his head, holding a small glass of cutting chai, roadside tea stall blurred in background, ${GOLD}`,
  sameerClose: `close-up portrait of ${SAMEER}, soft sincere smile looking at the camera, setting sun directly behind his head like a glowing halo, holding a small glass of chai, ${GOLD}`,
  dineReach: `${KABIR}, standing at a wooden dining table in a dark dining room at night, reaching down to pick up an old folded newspaper lying on the table, single warm pendant lamp above the table, ${NIGHT}`,
  dineHold: `newspaper not book, ${KABIR}, standing in a dark dining room at night holding an old yellowed newspaper with both hands and reading it, worried expression, warm pendant lamp above, ${NIGHT}`,
  realize: `extreme close-up of the face of ${KABIR}, eyes wide in shocked realization, a tear in his eye, face half lit by warm lamp light and half by blue phone light, ${NIGHT}`,
  leave: `${KABIR}, grabbing a dark jacket and rushing out through an open door toward a lit corridor, dark room, motion blur, ${NIGHT}`,
  empty: `empty small rented bedroom in India at night, smartphone glowing face-up on the bed, small untouched birthday cake on a plastic chair, ceiling fan, window with city lights and moonlight, nobody in the room, ${NIGHT}`,
};

async function fetchImg(prompt, seed, file) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', ' + STYLE)}?width=1080&height=1920&seed=${seed}&model=flux&nologo=true&enhance=false`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(240000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      const im = await loadImage(buf);
      fs.writeFileSync(file, buf);
      return `${im.width}x${im.height}`;
    } catch (e) { console.log('  retry', attempt, e.message); await new Promise(s => setTimeout(s, 20000 * attempt)); }
  }
  return 'FAILED';
}

(async () => {
  const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(SHOTS);
  const dir = path.join(__dirname, 'gen'); fs.mkdirSync(dir, { recursive: true });
  for (const k of only) for (const seed of (process.argv[3] || '101,202').split(',').map(Number)) {
    const f = path.join(dir, `${k}_${seed}.jpg`);
    if (fs.existsSync(f)) continue;
    console.log(k, seed, await fetchImg(SHOTS[k], seed, f));
    await new Promise(r => setTimeout(r, 20000));
  }
  console.log('done');
})();
