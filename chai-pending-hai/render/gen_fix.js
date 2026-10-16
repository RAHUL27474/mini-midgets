// Re-generates the three weak character layers with stronger prompts: node gen_fix.js [seed] [model]
const fs = require('fs'), path = require('path');
const ANIME = '2D anime screenshot, flat cel shaded colors, hand drawn anime, Kyoto Animation style, clean lineart, expressive anime eyes';
const GS = 'studio shot on a plain flat light grey background, no scenery, nothing else in the background';
const SHOTS = {
  friends_bench: `two different young Indian men sitting side by side on a wooden bench, each holding a small glass of steaming milky chai, LEFT boy: short neat hair, blue denim jacket over grey t-shirt, smiling; RIGHT boy: messy wavy hair, BRIGHT RED HOODIE, laughing and talking, ${GS}, ${ANIME}`,
  scooter_riders: `two young Indian men riding an old blue scooter together, side view, full scooter visible, front rider in a BRIGHT RED HOODIE with messy wavy hair laughing, rear passenger in a blue denim jacket holding on and smiling, ${GS}, ${ANIME}`,
  sameer_close: `half-body portrait of a 21-year-old Indian young man, messy wavy black hair, round face, small mole under left eye, soft sincere smile looking at the viewer, wearing a BRIGHT RED HOODIE, holding a small glass of chai, ${GS}, ${ANIME}`,
};
(async () => {
  const seed = Number(process.argv[2] || 5), model = process.argv[3] || 'turbo';
  const dir = path.join(__dirname, 'gen', 'anime');
  for (const [k, prompt] of Object.entries(SHOTS)) {
    const f = path.join(dir, `${k}_${seed}.jpg`); if (fs.existsSync(f)) continue;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1920&seed=${seed}&model=${model}&nologo=true&enhance=false`;
    for (let a = 1; a <= 5; a++) {
      try { const r = await fetch(url, { signal: AbortSignal.timeout(240000) }); if (!r.ok) throw new Error('HTTP ' + r.status); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log(k, 'ok'); break; }
      catch (e) { console.log(k, 'retry', a, e.message); await new Promise(s => setTimeout(s, 20000 * a)); }
    }
    await new Promise(s => setTimeout(s, 20000));
  }
  console.log('done');
})();
