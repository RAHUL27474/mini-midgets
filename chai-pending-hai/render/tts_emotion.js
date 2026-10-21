// Emotional Hindi TTS via Chatterbox Multilingual (HF Space): clones a reference voice, with an emotion exaggeration control.
// node tts_emotion.js <out.wav> <refVoice.wav> <exaggeration 0-1> <cfg 0-1> "<hindi text>"
const { Client, handle_file } = require('@gradio/client');
const fs = require('fs');
const [out, ref, exag = '0.5', cfg = '0.5', text] = process.argv.slice(2);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  const app = await Client.connect('ResembleAI/Chatterbox-Multilingual-TTS');
  log('connected');
  const job = app.submit('/generate_tts_audio', { text_input: text, language_id: 'hi', audio_prompt_path_input: handle_file(new Blob([fs.readFileSync(ref)], { type: 'audio/wav' })), exaggeration_input: Number(exag), temperature_input: 0.8, seed_num_input: 7, cfgw_input: Number(cfg) });
  for await (const msg of job) {
    if (msg.type === 'status') log('status', msg.stage, msg.queue ? `queue ${msg.position}/${msg.size}` : '', msg.eta ? `eta ${Math.round(msg.eta)}s` : '', msg.message || '');
    if (msg.type === 'data') {
      const flat = JSON.stringify(msg.data), m = flat.match(/"url":"(https?:[^"]+)"/); if (!m) throw new Error('no url: ' + flat.slice(0, 300));
      const r = await fetch(m[1]); fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); log('saved', out, fs.statSync(out).size); process.exit(0);
    }
  }
  process.exit(1);
})().catch(e => { log('ERROR', e.message || e); process.exit(1); });
