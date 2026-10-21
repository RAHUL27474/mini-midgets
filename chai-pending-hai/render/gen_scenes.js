// Start frames (full anime scenes) for the image-to-video shots. node gen_scenes.js [seed] [model] [keys]
const fs = require('fs'), path = require('path');
const ANIME = '2D anime screenshot, flat cel shaded colors, hand drawn anime, Makoto Shinkai style, clean lineart, expressive anime eyes, detailed background';
const KABIR = 'Kabir, 26-year-old Indian man, short neat black hair with side part, light stubble, slim face, light blue cotton shirt';
const KABIR_Y = 'Kabir, 21-year-old Indian young man, clean-shaven, short neat black hair, slim face, blue denim jacket over grey t-shirt';
const SAMEER = 'Sameer, 21-year-old Indian young man, messy wavy black hair, round face, small mole under left eye, bright red hoodie';
const GOLD = 'warm golden hour sunset light, orange and gold tones';
const NIGHT = 'night, dim cool blue moonlight';
const SHOTS = {
  typing_close: `close-up of a young man's hands holding a smartphone and typing a message with his thumb, dark bedroom, blue screen glow on the hands, ${NIGHT}, ${ANIME}`,
  scooter_scene: `two young Indian men riding an old blue scooter along a tree-lined Indian road, side view, front rider ${SAMEER} laughing with wind in his hair, passenger behind him ${KABIR_Y} holding on and smiling, ${GOLD}, ${ANIME}`,
  tapri_scene: `two friends sitting side by side on a wooden bench at a roadside chai tapri tea stall in India, each holding a small glass of steaming milky chai, left: ${KABIR_Y} smiling, right: ${SAMEER} talking and laughing with one hand raised, tea cart with big kettle behind them, ${GOLD}, ${ANIME}`,
  laugh_scene: `medium close-up of ${KABIR_Y} laughing and shaking his head, holding a small glass of chai, roadside tea stall softly blurred behind him, ${GOLD}, ${ANIME}`,
  sameer_scene: `close-up of ${SAMEER}, soft sincere smile looking at the viewer, the setting sun directly behind his head glowing like a halo, holding a small glass of chai, ${GOLD}, ${ANIME}`,
  dining_scene: `${KABIR} standing behind a wooden dining table in a dark dining room at night, an old folded yellowed newspaper lying on the table in front of him, he looks down at it, single warm pendant lamp above the table, ${NIGHT}, ${ANIME}`,
  freeze_scene: `${KABIR} sitting at a small desk at night, holding an old yellowed newspaper clipping in one hand and a glowing smartphone in the other, stunned frozen expression, warm desk lamp, ${NIGHT}, ${ANIME}`,
  realize_scene: `extreme close-up of the face of ${KABIR} at night, eyes wide in shocked realization, a tear forming in his eye, face half lit by warm lamp light and half by blue phone light, ${NIGHT}, ${ANIME}`,
  leave_scene: `${KABIR} grabbing a dark jacket from a wall hook and rushing toward the open door of a dark room, bright corridor light through the door, ${NIGHT}, ${ANIME}`,
};
(async () => {
  const seed = Number(process.argv[2] || 5), model = process.argv[3] || 'turbo';
  const only = process.argv[4] ? process.argv[4].split(',') : Object.keys(SHOTS);
  const dir = path.join(__dirname, 'gen', 'scenes'); fs.mkdirSync(dir, { recursive: true });
  for (const k of only) {
    const f = path.join(dir, `${k}_${seed}.jpg`); if (fs.existsSync(f)) continue;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(SHOTS[k])}?width=1080&height=1920&seed=${seed}&model=${model}&nologo=true&enhance=false`;
    for (let a = 1; a <= 5; a++) {
      try { const r = await fetch(url, { signal: AbortSignal.timeout(240000) }); if (!r.ok) throw new Error('HTTP ' + r.status); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log(k, 'ok'); break; }
      catch (e) { console.log(k, 'retry', a, e.message); await new Promise(s => setTimeout(s, 20000 * a)); }
    }
    await new Promise(s => setTimeout(s, 20000));
  }
  console.log('done');
})();
