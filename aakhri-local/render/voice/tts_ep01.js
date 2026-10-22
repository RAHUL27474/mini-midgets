// Aakhri Local EP1 voices via Edge neural TTS (fast, free): one distinct voice per character.
// node tts_ep01.js  -> ep01/build/<id>.wav + ep01/build/voice.json ({id, char, text, dur})
const path = require('path');
const NM = path.join(__dirname, '..', '..', '..', 'chai-pending-hai', 'render', 'node_modules');
const { MsEdgeTTS, OUTPUT_FORMAT } = require(path.join(NM, 'msedge-tts'));
const ffmpeg = require(path.join(NM, 'ffmpeg-static'));
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os');

const OUT = path.join(__dirname, '..', '..', 'ep01', 'build');
const VOICES = {
  meera: { name: 'hi-IN-SwaraNeural', pitch: '-2Hz', rate: '-6%' },            // young, tired
  meeraShaken: { name: 'hi-IN-SwaraNeural', pitch: '+6Hz', rate: '+6%' },      // breathless
  oldman: { name: 'ur-IN-SalmanNeural', pitch: '-12Hz', rate: '-22%' },        // elderly, soft, slow (Urdu script)
  tc: { name: 'hi-IN-MadhurNeural', pitch: '-4Hz', rate: '-4%' },              // gruff
};
// script dialogue sheet (ep01/ep01_script.md); the old man's line is in Urdu script for the Urdu voice
const LINES = [
  ['e1_01', 'oldman', 'بیٹا... آپ کا ٹکٹ گر گیا۔', 'बेटा... आपका टिकट गिर गया।'],
  ['e1_02', 'meera', 'मेरा? ... शुक्रिया, अंकल।'],
  ['e1_03', 'meera', 'अंकल, ये तो उन्नीस सौ पचहत्तर का—'],
  ['e1_04', 'meeraShaken', 'वो अंकल... अभी यहीं थे...'],
  ['e1_05', 'tc', 'इस डिब्बे में आज सिर्फ़ आप थीं, मैडम।'],
];
const dur = f => parseFloat(execFileSync(ffmpeg, ['-i', f, '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).toString().match(/time=(\d+):(\d+):([\d.]+)/g)?.pop()?.split('=')[1].split(':').reduce((a, v) => a * 60 + +v, 0) || 0);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = [];
  for (const [id, who, text, shown] of LINES) {
    const v = VOICES[who], tts = new MsEdgeTTS(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'al-'));
    await tts.setMetadata(v.name, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const res = await tts.toFile(tmp, text, { pitch: v.pitch, rate: v.rate });
    const wav = path.join(OUT, `${id}.wav`);
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', res.audioFilePath, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    let d = 0;
    try { execFileSync(ffmpeg, ['-i', wav, '-f', 'null', '-'], { stdio: 'pipe' }); } catch (e) { }
    const probe = require('child_process').spawnSync(ffmpeg, ['-i', wav, '-f', 'null', '-'], { encoding: 'utf8' });
    const m = (probe.stderr || '').match(/time=(\d+):(\d+):([\d.]+)/g);
    if (m) { const [h, mi, s] = m.pop().split('=')[1].split(':').map(Number); d = h * 3600 + mi * 60 + s; }
    meta.push({ id, char: who.replace('Shaken', ''), text: shown || text, dur: +d.toFixed(2) });
    console.log(id, who, d.toFixed(2) + 's');
  }
  fs.writeFileSync(path.join(OUT, 'voice.json'), JSON.stringify(meta, null, 1));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
