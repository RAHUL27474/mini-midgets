// Generates the Hindi voice lines for Ep1 (one distinct voice per character) and
// writes voice/lines.json with timings, durations and a per-frame loudness envelope for lip-sync.
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const VOICES = {
  kabir: { name: 'hi-IN-MadhurNeural', pitch: '-6Hz', rate: '-8%' },           // adult: low, quiet, heavy
  kabirYoung: { name: 'hi-IN-MadhurNeural', pitch: '+10Hz', rate: '+4%' },     // same person, 5 years younger, lighter
  kabirWhisper: { name: 'hi-IN-MadhurNeural', pitch: '-10Hz', rate: '-18%', volume: '-30%' },
  sameer: { name: 'en-US-BrianMultilingualNeural', pitch: '+8Hz', rate: '+6%' }, // different voice: bright, teasing
};
// start = when the line begins in the episode (seconds); sub = subtitle text (Devanagari)
const LINES = [
  { id: 'k1', who: 'kabir', start: 2.2, text: 'पाँच साल पहले मेरा सबसे अच्छा दोस्त गायब हो गया... और आज भी, वो मुझे जन्मदिन की बधाई देता है।', sub: 'पाँच साल पहले मेरा सबसे अच्छा\nदोस्त गायब हो गया…|और आज भी, वो मुझे\nजन्मदिन की बधाई देता है।' },
  { id: 's1', who: 'sameer', start: 18.1, text: 'अगले जन्मदिन पर पूरी चाय, पक्का वादा! पैसे तू देगा, पगले।', sub: 'अगले जन्मदिन पर पूरी चाय,\nपक्का वादा!|पैसे तू देगा, पगले।' },
  { id: 'y1', who: 'kabirYoung', start: 23.5, text: 'हर बार मैं ही क्यों?', sub: 'हर बार मैं ही क्यों?' },
  { id: 's2', who: 'sameer', start: 26.5, text: 'क्योंकि तू कभी छोड़कर नहीं जाता।', sub: 'क्योंकि तू कभी\nछोड़कर नहीं जाता।' },
  { id: 'k2', who: 'kabir', start: 34.3, text: 'उसका फ़ोन पुलिस को मिला था... और उन्होंने वो उसकी माँ को दे दिया था।', sub: 'उसका फ़ोन पुलिस को मिला था…|और उन्होंने वो\nउसकी माँ को दे दिया था।' },
  { id: 'k3', who: 'kabirWhisper', start: 48.2, text: 'मतलब ये मैसेज... समीर के घर से आ रहा है।', sub: 'मतलब ये मैसेज…|समीर के घर से\nआ रहा है।' },
];

const ssml = (v, text) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="hi-IN"><voice name="${v.name}"><lang xml:lang="hi-IN"><prosody pitch="${v.pitch}" rate="${v.rate}" volume="${v.volume || '+0%'}">${text}</prosody></lang></voice></speak>`;

(async () => {
  const dir = path.join(__dirname, 'voice'); fs.mkdirSync(dir, { recursive: true });
  const out = [];
  for (const ln of LINES) {
    const v = VOICES[ln.who];
    const tts = new MsEdgeTTS();
    await tts.setMetadata(v.name, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const tmp = fs.mkdtempSync(path.join(dir, 'tmp-'));
    const res = await tts.toFile(tmp, ln.text, { pitch: v.pitch, rate: v.rate, volume: v.volume || '+0%' });
    tts.close?.();
    const wav = path.join(dir, ln.id + '.wav');
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', res.audioFilePath, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    fs.rmSync(tmp, { recursive: true, force: true });
    const pcm = fs.readFileSync(wav).subarray(44), n = pcm.length / 2, dur = n / 44100;
    const env = [];
    for (let f = 0; f < Math.ceil(dur * 30); f++) {
      let s = 0, k = 0; for (let i = Math.floor(f * 44100 / 30); i < Math.min(n, Math.floor((f + 1) * 44100 / 30)); i++) { const x = pcm.readInt16LE(i * 2) / 32768; s += x * x; k++; }
      env.push(+Math.sqrt(s / Math.max(k, 1)).toFixed(4));
    }
    const mx = Math.max(...env);
    out.push({ ...ln, voice: v.name, file: wav, dur: +dur.toFixed(3), env: env.map(e => +(e / mx).toFixed(3)) });
    console.log(ln.id, v.name, dur.toFixed(2) + 's');
  }
  fs.writeFileSync(path.join(dir, 'lines.json'), JSON.stringify(out, null, 1));
  process.exit(0);
})();

