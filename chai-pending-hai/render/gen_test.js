// Style/green-screen test: node gen_test.js  -> gen/test/*.jpg
const fs = require('fs'), path = require('path');
const SAMEER = 'Sameer, 21-year-old Indian young man, messy wavy black hair, round face, small mole under left eye, big cheerful grin, bright red hoodie, holding a small glass of chai';
const TESTS = [
  ['flux_anime_green', 'flux', `2D anime screenshot, flat cel shaded colors, hand drawn anime, Kyoto Animation style, clean lineart, half-body portrait of ${SAMEER}, soft smile, isolated on a flat solid bright green chroma key background, plain green background, no scenery`],
  ['turbo_anime_green', 'turbo', `2D anime screenshot, flat cel shaded colors, hand drawn anime, Kyoto Animation style, clean lineart, half-body portrait of ${SAMEER}, soft smile, isolated on a flat solid bright green chroma key background, plain green background, no scenery`],
  ['flux_anime_white', 'flux', `anime character design sheet, 2D anime, flat cel shading, clean lineart, half-body portrait of ${SAMEER}, soft smile, plain solid white background, no scenery`],
];
(async () => {
  const dir = path.join(__dirname, 'gen', 'test'); fs.mkdirSync(dir, { recursive: true });
  for (const [name, model, prompt] of TESTS) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1920&seed=5&model=${model}&nologo=true&enhance=false`;
    for (let a = 1; a <= 4; a++) {
      try { const r = await fetch(url, { signal: AbortSignal.timeout(240000) }); if (!r.ok) throw new Error('HTTP ' + r.status); fs.writeFileSync(path.join(dir, name + '.jpg'), Buffer.from(await r.arrayBuffer())); console.log(name, 'ok'); break; }
      catch (e) { console.log(name, 'retry', a, e.message); await new Promise(s => setTimeout(s, 20000 * a)); }
    }
    await new Promise(s => setTimeout(s, 20000));
  }
  console.log('done');
})();
