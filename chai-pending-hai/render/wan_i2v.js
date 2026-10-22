// Image-to-video sample via Hugging Face Space (Wan 2.2 fast, LTX fallback).
// node wan_i2v.js <image> <out.mp4> "<prompt>" [seconds] [wan|ltx]
const { Client, handle_file } = require('@gradio/client');
const fs = require('fs');
const [img, out, prompt, secs = '4', engine = 'wan'] = process.argv.slice(2);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const OPTS = process.env.HF_TOKEN ? { token: process.env.HF_TOKEN } : {}; // a token lifts the anonymous ZeroGPU run limit
async function download(res) {
  const flat = JSON.stringify(res.data);
  const m = flat.match(/"url":"(https?:[^"]+)"/); if (!m) throw new Error('no url in result: ' + flat.slice(0, 400));
  const r = await fetch(m[1]); fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); log('saved', out, fs.statSync(out).size, 'bytes');
}
(async () => {
  const blob = new Blob([fs.readFileSync(img)], { type: 'image/jpeg' });
  const neg = 'blurry, distorted, extra limbs, deformed hands, text, watermark, low quality, static, still image';
  if (engine === 'wan') {
    const app = await Client.connect('zerogpu-aoti/wan2-2-fp8da-aoti-faster', OPTS);
    log('connected wan');
    const job = app.submit('/generate_video', { input_image: handle_file(blob), prompt, steps: 6, negative_prompt: neg, duration_seconds: Number(secs), guidance_scale: 1, guidance_scale_2: 1, seed: 42, randomize_seed: false });
    for await (const msg of job) {
      if (msg.type === 'status') log('status', msg.stage, msg.queue ? `queue pos ${msg.position}/${msg.size}` : '', msg.eta ? `eta ${Math.round(msg.eta)}s` : '', msg.message || '');
      if (msg.type === 'data') { log('data'); await download(msg); process.exit(0); }
    }
  } else {
    const app = await Client.connect('Lightricks/ltx-video-distilled', OPTS);
    log('connected ltx');
    const job = app.submit('/image_to_video', { prompt, negative_prompt: neg, input_image_filepath: handle_file(blob), input_video_filepath: '', height_ui: 1024, width_ui: 576, mode: 'image-to-video', duration_ui: Number(secs), ui_frames_to_use: 9, seed_ui: 42, randomize_seed: false, ui_guidance_scale: 1, improve_texture_flag: true });
    for await (const msg of job) {
      if (msg.type === 'status') log('status', msg.stage, msg.queue ? `queue pos ${msg.position}/${msg.size}` : '', msg.eta ? `eta ${Math.round(msg.eta)}s` : '', msg.message || '');
      if (msg.type === 'data') { log('data'); await download(msg); process.exit(0); }
    }
  }
  log('ended without data'); process.exit(1);
})().catch(e => { log('ERROR', e.message || e); process.exit(1); });
