// Aakhri Local EP3 soundtrack: procedural SFX + piano/drone score (music plan in ep03/ep03_script.md), then the voice lines on top.
// node ep03_audio.js  -> ep03/build/bed.wav, ep03/build/mix.wav, ep03/build/dialogue.json
const path = require('path'), fs = require('fs');
const CPH = path.join(__dirname, '..', '..', '..', 'chai-pending-hai', 'render');
const { bed } = require(path.join(CPH, 'sfxlib'));
const ffmpeg = require(path.join(CPH, 'node_modules', 'ffmpeg-static'));
const { execFileSync } = require('child_process');
const B = path.join(__dirname, '..', '..', 'ep03', 'build');
const T = require('./ep03_timing');
const { SR, TAU, rnd, mtof, put, tone, fnoise: fnoiseRaw, tick, whoosh, thump, write } = bed(T.DUR);
// no hissing noise beds (the user heard them as noise): long filtered-noise layers - train rumble, crowd, fire hiss, wind,
// brake hiss - are dropped; short noise transients (ticks, pages, crackles, clicks) and every tonal sound stay
const fnoise = (t0, dur, ...rest) => (dur > 0.8 ? undefined : fnoiseRaw(t0, dur, ...rest));

// ---------- SFX
// rain sound is off at the user's request (visual rain stays); rain.js has a natural-sounding rain if it's ever wanted back
const rain = () => {};
function trainRhythm(t0, dur, amp, rate = 1) { // "ta-dak ta-dak": paired wheel thumps over a low rumble
  fnoise(t0, dur, 0, amp * 0.7, t => Math.min(1, t / 1, (dur - t) / 1), 260, 30);
  for (let t = t0 + 0.2; t < t0 + dur - 0.2; t += 0.9 / rate) { thump(t, 70, amp * 1.6, 22); thump(t + 0.16 / rate, 64, amp * 1.3, 24); fnoise(t, 0.05, -0.3, amp * 0.5, q => Math.exp(-q * 60), 3000, 600); }
}
function horn(t0, dur, amp) {
  for (const f of [233, 294, 349]) tone(t0, dur, 0, (t, i) => Math.sin(TAU * f * t) * amp * Math.min(1, t / 0.25, (dur - t) / 0.4) * (0.7 + 0.3 * Math.sin(TAU * 5 * t)));
}
function brakes(t0, dur, amp) { tone(t0, dur, 0.2, t => Math.sin(TAU * (2600 - t * 500) * t) * amp * Math.min(1, t / 0.2, (dur - t) / 0.3) * (0.6 + 0.4 * Math.sin(TAU * 23 * t))); fnoise(t0, dur, 0, amp * 0.6, t => Math.min(1, (dur - t) / 0.3), 5000, 1500); }
function doorHiss(t0) { fnoise(t0, 0.9, 0.4, 0.22, t => Math.min(1, t / 0.05) * Math.exp(-t * 3), 7000, 1200); thump(t0 + 0.85, 90, 0.4, 30); }
function tubeBuzz(t0, dur, amp, flick = []) {
  amp *= 0.45; // the hum stays, but quietly
  tone(t0, dur, -0.2, t => (Math.sin(TAU * 100 * t) + 0.5 * Math.sin(TAU * 200 * t)) * amp * Math.min(1, t / 0.3, (dur - t) / 0.3));
  for (const f of flick) fnoise(f, 0.12, -0.2, amp * 6, q => (Math.sin(q * 160) > 0 ? 1 : 0.2), 4000, 800);
}
function steps(t0, dur, rate, amp) { for (let t = t0; t < t0 + dur; t += 1 / rate) { thump(t, 120, amp, 35); fnoise(t, 0.06, (rnd() - 0.5), amp * 0.5, q => Math.exp(-q * 60), 2500, 400); } }
function siren(t0, dur, amp) { tone(t0, dur, -0.6, t => Math.sin(TAU * (700 + 180 * Math.sin(TAU * 0.6 * t)) * t) * amp * Math.min(t / 0.5, 1, (dur - t) / dur)); }
function pa(t0) { for (const [k, f] of [[0, 784], [0.35, 659]]) tone(t0 + k, 0.6, 0, t => Math.sin(TAU * f * t) * 0.12 * Math.exp(-t * 4)); }

// ---------- score: piano (decaying harmonics), tanpura drone, held violin, reverse swell
function piano(t0, midi, amp, dur = 3.5) { const f = mtof(midi); tone(t0, dur, (midi - 60) / 40, t => (Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * 2 * f * t) + 0.15 * Math.sin(TAU * 3 * f * t)) * amp * Math.exp(-t * 1.3) * Math.min(1, t / 0.005)); }
function chord(t0, notes, amp, dur) { notes.forEach((n, i) => piano(t0 + i * 0.03, n, amp, dur)); }
function drone(t0, dur, midi, amp) { const f = mtof(midi); for (const [m, a] of [[1, 1], [1.5, 0.5], [2, 0.6], [3, 0.25]]) tone(t0, dur, m === 1.5 ? 0.3 : -0.3, t => Math.sin(TAU * f * m * t + Math.sin(TAU * 0.2 * t)) * amp * a * Math.min(1, t / 2, (dur - t) / 2)); }
function violin(t0, dur, midi, amp) { const f = mtof(midi); tone(t0, dur, 0.1, t => { const v = f * (1 + 0.004 * Math.sin(TAU * 5.5 * t)); let s = 0; for (let h = 1; h < 7; h++) s += Math.sin(TAU * v * h * t) / h; return s * amp * Math.min(1, t / 1.5, (dur - t) / 1.2); }); }
function swell(t0, dur, amp) { fnoise(t0, dur, 0, amp, t => Math.pow(t / dur, 3), 12000, 2000); }

const S = T.start; // shot start times
function crowd(t0, dur, amp) { fnoise(t0, dur, 0, amp, t => Math.min(1, t / 0.6, (dur - t) / 0.6) * (0.8 + 0.2 * Math.sin(t * 2.3)), 1800, 250); }
function wings(t0) { for (let k = 0; k < 9; k++) fnoise(t0 + k * 0.06, 0.04, (rnd() - 0.5) * 1.4, 0.06, q => Math.exp(-q * 60), 3000, 500); }
function creak(t0, dur) { tone(t0, dur, 0.2, t => Math.sin(TAU * (180 + 90 * Math.sin(t * 9)) * t) * 0.05 * Math.min(1, t / 0.1, (dur - t) / 0.2) * (0.6 + 0.4 * Math.sin(t * 61))); }
function fan(t0, dur, amp, slowTo = 1) { tone(t0, dur, -0.3, t => { const r = 1 - (1 - slowTo) * (t / dur); return (Math.sin(TAU * 55 * r * t) * 0.6 + Math.sin(TAU * 110 * r * t) * 0.3) * amp * Math.min(1, t / 0.5, (dur - t) / 0.5) * (0.7 + 0.3 * Math.sin(TAU * 2.2 * r * t)); }); }
function typewriter(t0, dur) { for (let t = t0; t < t0 + dur; t += 0.09 + rnd() * 0.25) { thump(t, 1400, 0.05, 120); fnoise(t, 0.02, 0.5, 0.06, q => Math.exp(-q * 200), 7000, 2000); } }
function pages(t0, n) { for (let k = 0; k < n; k++) fnoise(t0 + k * 0.28, 0.22, (rnd() - 0.5), 0.09, q => Math.sin(Math.PI * q / 0.22), 6000, 1500); }
function fire(t0, dur, amp) { // crackle + a soft low rumble (tonal), no hiss
  tone(t0, dur, 0, t => (Math.sin(TAU * 48 * t) * 0.6 + Math.sin(TAU * 71 * t) * 0.4) * amp * 0.9 * Math.min(1, t / 0.8, (dur - t) / 0.8) * (0.7 + 0.3 * Math.sin(t * 3.3))); fnoise(t0, dur, 0, amp, t => Math.min(1, t / 0.8, (dur - t) / 0.8) * (0.7 + 0.3 * Math.sin(t * 5.1) * Math.sin(t * 1.7)), 500, 40); for (let t = t0; t < t0 + dur; t += 0.05 + rnd() * 0.2) fnoise(t, 0.03, (rnd() - 0.5), amp * 0.8 * rnd(), q => Math.exp(-q * 90), 1200, 200); }
function babyCry(t0, dur, amp) { tone(t0, dur, 0.1, t => { const f = 420 + 60 * Math.sin(TAU * 5 * t) + 120 * Math.sin(TAU * 0.7 * t); return (Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * 2 * f * t)) * amp * Math.min(1, t / 0.2, (dur - t) / 0.3) * (Math.sin(TAU * 0.9 * t) > -0.3 ? 1 : 0.1); }); }
function ringtone(t0, dur) { const notes = [76, 79, 84, 79]; for (let t = t0, i = 0; t < t0 + dur; t += 0.22, i++) tone(t, 0.25, 0, q => Math.sin(TAU * mtof(notes[i % 4]) * q) * 0.08 * Math.exp(-q * 9)); for (let t = t0; t < t0 + dur; t += 1.2) fnoise(t, 0.5, 0, 0.05, q => Math.sin(q * 600) > 0 ? 1 : 0.3, 180, 60); }
// s01 station morning: crowd, pigeons, PA chime, a taxi horn
crowd(0, S.s03, 0.06); wings(0.4); wings(1.1); pa(1.6); horn(2.8, 0.4, 0.02);
creak(S.s02 + 0.9, 1.1);                                                                   // the heavy teak door
fan(S.s03, S.s14 + 2 - S.s03, 0.02); typewriter(S.s03 + 0.4, 3.0);                         // archive: fans, a typewriter somewhere
thump(S.s05 + 0.15, 70, 0.4, 14); pages(S.s05 + 0.6, 3);                                   // register lands, pages flip
pages(S.s06 + 0.5, 2);                                                                     // brittle newspaper unfolds
// 1975 flashback: music and the mother's muffled cry only (fire crackle, rumble and the synthetic baby cry read as noise)
fan(S.s14, 3.5, 0.03, 0.2);                                                                // the fan winds down
ringtone(S.s15 + 0.4, T.DUR - S.s15 - 0.8);                                                // Ma calling
// music: the MusicGen score (music_a / music_b) when present, else the procedural piano/drone plan; the end chord + swell always
const AI_MUSIC = fs.existsSync(path.join(B, 'music_a.wav')) && fs.existsSync(path.join(B, 'music_b.wav'));
if (!AI_MUSIC) {
  for (const [k, n] of [[0, 57], [1.4, 60], [2.6, 64], [4.2, 62], [5.6, 57], [7.6, 55], [9.0, 57]]) piano(0.4 + k, n, 0.07);
  drone(S.s04, S.s07 + 5 - S.s04, 45, 0.035);
  for (const [k, n] of [[0, 64], [1.5, 67], [3.0, 69], [5.0, 67], [7, 64], [9, 62], [11, 60]]) piano(S.s05 + k, n, 0.06);
  violin(S.s09, S.s11 + 1 - S.s09, 81, 0.012);
}
chord(T.DUR - 4.8, [33, 45, 52, 57], 0.12, 4.6); swell(T.DUR - 3.2, 2.9, 0.12);
write(path.join(B, 'bed.wav'));

// ---------- voices: cleaned (high-pass, presence EQ, gentle compression) + small train-cabin room; Chatterbox takes when present
const V = JSON.parse(fs.readFileSync(path.join(B, 'voice.json'), 'utf8'));
const dlg = V.map(v => ({ ...v, start: T.lines[v.id], end: +(T.lines[v.id] + v.dur).toFixed(2) }));
fs.writeFileSync(path.join(B, 'dialogue.json'), JSON.stringify(dlg, null, 1));
const AGE = { oldman: 'asetrate=44100*0.94,aresample=44100,atempo=1.0638,', meera: '', tc: '', clerk: 'asetrate=44100*0.96,aresample=44100,atempo=1.0417,', woman: 'lowpass=f=1500,volume=0.55,aecho=0.8:0.6:120:0.4,' }; // old man: a touch deeper
const ins = ['-i', path.join(B, 'bed.wav')], fl = [];
dlg.forEach((d, i) => {
  const raw = path.join(B, `${d.id}.raw.wav`);
  ins.push('-i', fs.existsSync(raw) ? raw : path.join(B, `${d.id}.wav`));
  fl.push(`[${i + 1}:a]aresample=44100,${AGE[d.char] || ''}highpass=f=80,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1.2:g=3,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=3,` +
    `aformat=channel_layouts=stereo,aecho=0.85:0.45:28|53:0.16|0.09,adelay=${Math.round(d.start * 1000)}|${Math.round(d.start * 1000)},apad=whole_dur=${T.DUR}[v${i}]`);
});
fl.push(`${dlg.map((_, i) => `[v${i}]`).join('')}amix=inputs=${dlg.length}:normalize=0${AI_MUSIC ? ',asplit[vo][sc]' : '[vo]'}`);
let nIn = dlg.length + 1;
if (AI_MUSIC) { // the two cues crossfaded as the 1975 flashback begins (s08), ducked under dialogue
  ins.push('-i', path.join(B, 'music_a.wav'), '-i', path.join(B, 'music_b.wav'));
  const xa = S.s08 - 0.5;
  fl.push(`[${nIn}:a]aresample=44100,aformat=channel_layouts=stereo,atrim=0:${xa + 2},afade=t=in:d=1.5,afade=t=out:st=${xa}:d=2[ma]`,
    `[${nIn + 1}:a]aresample=44100,aformat=channel_layouts=stereo,atrim=0:${T.DUR - xa},afade=t=in:d=2,afade=t=out:st=${T.DUR - xa - 5}:d=4,adelay=${xa * 1000}|${xa * 1000}[mb]`,
    `[ma][mb]amix=inputs=2:normalize=0,volume=0.55[mus]`, `[mus][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[mduck]`,
    `[0:a]volume=0.85[b]`);
  nIn += 2;
} else fl.push(`[0:a]volume=0.9[b]`);
// realistic ambience from Stable Audio Open Small (build/sfx, made by voice/sfx_gen.py): [file, start, seconds, volume, lowpass Hz]
// the 1975 flashback layers are low-passed so they sit behind the music like a memory
const SFX = [['station', 0, S.s03 + 0.3, 0.32, 0], ['archive', S.s03, 10.5, 0.22, 0], ['archive', S.s03 + 10, S.s08 - S.s03 - 10 + 0.5, 0.22, 0],
  ['fire', S.s08 - 0.3, S.s11 - S.s08 + 0.6, 0.30, 2600], ['crowd', S.s08, 7, 0.18, 2200], ['baby', S.s09 + 0.3, 5.5, 0.20, 3000],
  ['archive', S.s11, 10.5, 0.22, 0], ['archive', S.s11 + 10, S.s15 - S.s11 - 10, 0.18, 0]]
  .filter(([f]) => fs.existsSync(path.join(B, 'sfx', `${f}.wav`)));
const sx = SFX.map(([f, st, dur, vol, lp], k) => {
  ins.push('-i', path.join(B, 'sfx', `${f}.wav`));
  fl.push(`[${nIn + k}:a]aresample=44100,aformat=channel_layouts=stereo,atrim=0:${dur.toFixed(2)},${lp ? `lowpass=f=${lp},` : ''}volume=${vol},` +
    `afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, dur - 0.8).toFixed(2)}:d=0.8,adelay=${Math.round(st * 1000)}|${Math.round(st * 1000)}[x${k}]`);
  return `[x${k}]`;
});
fl.push(`[b]${AI_MUSIC ? '[mduck]' : ''}[vo]${sx.join('')}amix=inputs=${2 + (AI_MUSIC ? 1 : 0) + sx.length}:normalize=0[pre]`);
fl.push(`[pre]loudnorm=I=-14:TP=-1.5:LRA=11[out]`);
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...ins, '-filter_complex', fl.join(';'), '-map', '[out]', '-ar', '48000', path.join(B, 'mix.wav')]);
console.log('wrote mix.wav,', dlg.length, 'lines', AI_MUSIC ? '+ MusicGen score' : '+ procedural score', '| -14 LUFS');
