// Generates anime-style layers for Ep1: backgrounds (no people) and characters on green screen.
// Usage: node gen_anime.js [key1,key2] [seed]
const fs = require('fs'), path = require('path');
const { loadImage } = require('@napi-rs/canvas');

const KABIR = 'Kabir, 26-year-old Indian man, short neat black hair with side part, light stubble, slim face, tired gentle eyes, light blue cotton shirt';
const KABIR_Y = 'Kabir, 21-year-old Indian young man, clean-shaven, short neat black hair with side part, slim face, grey t-shirt under a blue denim jacket';
const SAMEER = 'Sameer, 21-year-old Indian young man, messy wavy black hair, round face, small mole under left eye, big cheerful grin, bright red hoodie';
const ANIME = '2D anime screenshot, flat cel shaded colors, hand drawn anime, Kyoto Animation style, clean lineart, expressive anime eyes';
const GS = 'plain flat light grey studio background, no scenery, nothing else in the background, full character visible';
const GOLD = 'warm golden hour sunset light, orange and gold tones, nostalgic haze';
const NIGHT = 'night, dim cool blue moonlight';

const SHOTS = {
  // backgrounds (no people)
  bedroom_bg: `anime background art, small rented bedroom in an Indian city at night, single bed, plastic chair with a small untouched birthday cake, window with city lights and moon, ceiling fan, empty room, nobody, ${NIGHT}`,
  road_bg: `anime background art, tree-lined Indian road at sunset, trees and old buildings along the road, empty road, no people, no vehicles, ${GOLD}`,
  tapri_bg: `anime background art, roadside chai tapri tea stall in India, wooden cart with big aluminium kettle and glasses, city buildings behind, empty ground in the foreground, no people, no bench, ${GOLD}`,
  blur_bg: `anime background art, blurred bokeh of a street tea stall at sunset, soft out of focus warm lights, no people, ${GOLD}`,
  sky_bg: `anime background art, huge glowing setting sun low in the sky over a city skyline, dramatic orange sky with soft clouds, no people, ${GOLD}`,
  dining_bg: `anime background art, dark dining room in an Indian home at night, wooden dining table in the foreground, single warm pendant lamp hanging above the table, wall clock, framed photo on the wall, no people, ${NIGHT}`,
  corridor_bg: `anime background art, dark small room at night with an open door leading to a brightly lit corridor, wall hook, no people, ${NIGHT}`,
  // full scenes
  room_full: `${KABIR}, sitting alone on the edge of a bed in a small dark rented room, holding a glowing smartphone, face lit by blue phone light, sad, plastic chair with a small untouched birthday cake, window with city lights, ${NIGHT}, ${ANIME}`,
  // characters on green screen
  scooter_riders: `two young Indian men riding an old blue scooter, side view, driver: ${SAMEER} laughing with wind in his hair, passenger behind him: ${KABIR_Y} holding on and smiling, ${GS}, ${ANIME}`,
  friends_bench: `two young Indian men sitting side by side on a wooden bench, both holding small glasses of steaming milky chai, left: ${KABIR_Y} smiling, right: ${SAMEER} laughing and talking, ${GS}, ${ANIME}`,
  kabir_young_laugh: `half-body portrait of ${KABIR_Y}, laughing with eyes closed and head tilted, holding a small glass of chai, ${GS}, ${ANIME}`,
  sameer_close: `half-body portrait of ${SAMEER}, soft sincere smile, looking at the viewer, holding a small glass of chai, ${GS}, ${ANIME}`,
  kabir_news: `half-body of ${KABIR}, standing, holding an old folded newspaper with both hands and reading it with a worried expression, ${GS}, ${ANIME}`,
  kabir_face: `extreme close-up of the face of ${KABIR}, eyes wide in shocked realization, a single tear, lips slightly parted, ${GS}, ${ANIME}`,
  kabir_walk: `full body of ${KABIR}, side view, walking fast to the right while pulling on a dark jacket, determined expression, ${GS}, ${ANIME}`,
};
const MODEL = process.argv[4] || 'flux';
const bgs = new Set(['bedroom_bg', 'road_bg', 'tapri_bg', 'blur_bg', 'sky_bg', 'dining_bg', 'corridor_bg']);

async function fetchImg(prompt, seed, file) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1920&seed=${seed}&model=${MODEL}&nologo=true&enhance=false`;
  for (let attempt = 1; attempt <= 5; attempt++) {
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
  const seed = Number(process.argv[3] || 7);
  const dir = path.join(__dirname, 'gen', 'anime'); fs.mkdirSync(dir, { recursive: true });
  for (const k of only) {
    const f = path.join(dir, `${k}_${seed}.jpg`);
    if (fs.existsSync(f)) continue;
    const prompt = bgs.has(k) ? `${SHOTS[k]}, ${ANIME}, no characters` : SHOTS[k];
    console.log(k, seed, await fetchImg(prompt, seed, f));
    await new Promise(r => setTimeout(r, 20000));
  }
  console.log('done');
})();
