// Text-to-image via FLUX.1-schnell, or image edit via FLUX.1-Kontext (keeps a character's face from a reference image).
// node flux.js <out.png> "<prompt>" [seed] [width] [height]
// node flux.js <out.png> "<edit instruction>" [seed] --ref <image>
const { Client, handle_file } = require('@gradio/client');
const fs = require('fs');
const args = process.argv.slice(2);
const ri = args.indexOf('--ref'), ref = ri >= 0 ? args.splice(ri, 2)[1] : null;
const [out, prompt, seed = '7', w = '768', h = '1344'] = args;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  let job;
  if (ref) {
    const app = await Client.connect('black-forest-labs/FLUX.1-Kontext-Dev');
    job = app.submit('/infer', { input_image: handle_file(new Blob([fs.readFileSync(ref)])), prompt, seed: Number(seed), randomize_seed: false, guidance_scale: 2.5, steps: 28 });
  } else {
    const app = await Client.connect('black-forest-labs/FLUX.1-schnell');
    job = app.submit('/infer', { prompt, seed: Number(seed), randomize_seed: false, width: Number(w), height: Number(h), num_inference_steps: 4 });
  }
  for await (const msg of job) {
    if (msg.type === 'status' && msg.stage === 'error') throw new Error(msg.message || 'space error');
    if (msg.type === 'data') {
      const flat = JSON.stringify(msg.data), m = flat.match(/"url":"(https?:[^"]+)"/); if (!m) throw new Error('no url: ' + flat.slice(0, 300));
      const r = await fetch(m[1]); fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); log('saved', out); process.exit(0);
    }
  }
  process.exit(1);
})().catch(e => { log('ERROR', e.message || e); process.exit(1); });
