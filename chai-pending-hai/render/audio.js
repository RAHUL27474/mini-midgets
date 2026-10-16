// Synthesizes the full 60s soundtrack (score + SFX) for Ep1 and writes a 16-bit stereo WAV.
const fs = require('fs');

const SR = 44100, DUR = 60, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
const TAU = Math.PI * 2;
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const noise = () => rnd() * 2 - 1;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function put(i, v, pan) {
  if (i < 0 || i >= N) return;
  L[i] += v * Math.min(1, 1 - pan);
  R[i] += v * Math.min(1, 1 + pan);
}
function tone(t0, dur, pan, fn) {
  const s = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  for (let i = 0; i < n; i++) put(s + i, fn(i / SR, i), pan);
}
// one-pole filtered noise; lp/hp may be numbers or functions of t
function fnoise(t0, dur, pan, amp, env, lp = 20000, hp = 0) {
  let y1 = 0, y2 = 0;
  tone(t0, dur, pan, t => {
    const flp = typeof lp === 'function' ? lp(t) : lp;
    const fhp = typeof hp === 'function' ? hp(t) : hp;
    const a1 = 1 - Math.exp(-TAU * flp / SR), a2 = 1 - Math.exp(-TAU * Math.max(fhp, 1) / SR);
    y1 += a1 * (noise() - y1);
    y2 += a2 * (y1 - y2);
    const v = fhp > 0 ? y1 - y2 : y1;
    return v * amp * env(t);
  });
}

// ---------- instruments
function piano(t0, m, amp, dur = 4, pan = 0) {
  const f = mtof(m);
  tone(t0, dur, pan, t => {
    let s = 0;
    for (let h = 1; h <= 6; h++) s += Math.sin(TAU * f * h * (1 + 0.0004 * h * h) * t) * Math.exp(-t * (1.2 + h * 0.7)) / Math.pow(h, 1.4);
    const rel = Math.min(1, (dur - t) / 0.3);
    return amp * s * (1 - Math.exp(-t * 300)) * rel;
  });
}
function pad(t0, dur, ms, amp, pan = 0) {
  for (const m of ms) {
    const f = mtof(m);
    tone(t0, dur, pan + (rnd() - 0.5) * 0.6, t => {
      const env = Math.min(1, t / 1.4) * Math.min(1, Math.max(0, (dur - t) / 1.6));
      const v = 1 + 0.003 * Math.sin(TAU * 4.8 * t);
      return amp * env * (Math.sin(TAU * f * v * t) + 0.5 * Math.sin(TAU * f * 1.004 * t) + 0.2 * Math.sin(TAU * 2 * f * t));
    });
  }
}
function cello(t0, dur, m, amp, pan = 0) {
  const f = mtof(m);
  tone(t0, dur, pan, t => {
    const vib = 1 + 0.004 * Math.sin(TAU * 5.3 * t) * Math.min(1, t / 0.8);
    let s = 0;
    for (let h = 1; h <= 8; h++) s += Math.sin(TAU * f * h * vib * t) / (h * h * 0.6 + 0.4);
    const env = Math.pow(Math.min(1, t / dur), 1.3) * Math.min(1, (dur - t) / 0.4);
    return amp * s * env;
  });
}

// ---------- SFX
function tick(t0, amp = 0.25) {
  tone(t0, 0.04, 0.1, t => amp * Math.sin(TAU * 1700 * t) * Math.exp(-t * 180));
  fnoise(t0, 0.02, 0.1, amp * 0.6, t => Math.exp(-t * 300), 9000, 2000);
}
function buzz(t0) {
  for (const o of [0, 0.42]) tone(t0 + o, 0.3, 0, t => {
    const env = Math.min(1, t / 0.02) * Math.min(1, (0.3 - t) / 0.03);
    const x = TAU * 158 * t;
    return 0.32 * env * (Math.sin(x) + 0.45 * Math.sin(3 * x) + 0.2 * Math.sin(5 * x)) * (0.75 + 0.25 * Math.sin(TAU * 31 * t));
  });
}
function chime(t0) {
  [[88, 0], [95, 0.13]].forEach(([m, o]) => tone(t0 + o, 1.2, 0, t =>
    0.12 * (Math.sin(TAU * mtof(m) * t) + 0.2 * Math.sin(TAU * mtof(m) * 2 * t)) * Math.exp(-t * 4.5) * (1 - Math.exp(-t * 400))));
}
function keyTap(t0) { fnoise(t0, 0.03, (rnd() - 0.5) * 0.3, 0.16, t => Math.exp(-t * 160), 7000, 1800); }
function whoosh(t0, dur, amp, f0, f1) {
  fnoise(t0, dur, 0, amp, t => Math.sin(Math.PI * t / dur) ** 2, t => f0 + (f1 - f0) * t / dur, 200);
}
function thump(t0, f, amp, dec) {
  tone(t0, 1.2, 0, t => amp * Math.sin(TAU * f * t * (1 + 0.6 * Math.exp(-t * 30))) * Math.exp(-t * dec));
}
function bell(t0) {
  // signature ghungroo "chhan": cluster of tiny bells + one shimmering bell + sub impact
  for (let i = 0; i < 9; i++) {
    const o = rnd() * 0.07, f = 2600 + rnd() * 1500, p = (rnd() - 0.5) * 1.2;
    tone(t0 + o, 1.2, p, t => 0.06 * (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 2.76 * t) + 0.25 * Math.sin(TAU * f * 5.4 * t)) * Math.exp(-t * (5 + rnd() * 0.001)));
  }
  tone(t0, 3, 0, t => 0.16 * [1, 2.0, 3.01, 4.17].reduce((s, h, k) => s + Math.sin(TAU * 1480 * h * t) * Math.exp(-t * (1.8 + k)) / (k + 1), 0) * (1 + 0.15 * Math.sin(TAU * 6 * t)));
  thump(t0, 52, 0.7, 6);
  fnoise(t0, 0.5, 0, 0.18, t => Math.exp(-t * 14), 12000, 4000);
}
function birds(t0) {
  for (let k = 0; k < 3; k++) tone(t0 + k * 0.11, 0.08, 0.5, t => 0.05 * Math.sin(TAU * (3600 + 18000 * t) * t) * Math.sin(Math.PI * t / 0.08));
}
function footstep(t0) { thump(t0, 85, 0.35, 28); fnoise(t0, 0.08, 0, 0.12, t => Math.exp(-t * 50), 900); }

// ---------- SCORE & SFX TIMELINE
// S01-S02: clock + phone
tick(0.2, 0.18); tick(1.2, 0.22); buzz(1.25); chime(2.2);

// room tone (fan hum) for present-day sections
const hum = (a, b, amp) => {
  fnoise(a, b - a, 0, amp, t => Math.min(1, t / 0.4) * Math.min(1, (b - a - t) / 0.4), 220);
  tone(a, b - a, 0, t => amp * 0.25 * Math.sin(TAU * 50 * t) * Math.min(1, t / 0.4) * Math.min(1, (b - a - t) / 0.4));
};
hum(2.5, 15, 0.05); hum(30, 56, 0.06); hum(56, 59.3, 0.05);

// present-day piano 5-14
[[5.0, 69, 45], [6.3, 76], [7.6, 72], [8.8, 71, 41], [10.1, 69], [11.3, 64, 43], [12.5, 67]].forEach(([t, m, b]) => {
  piano(t, m, 0.16, 3.5, 0.15);
  if (b) piano(t, b, 0.12, 4, -0.2);
});
pad(5.0, 4.0, [57, 60, 64], 0.018);
pad(8.8, 4.8, [53, 57, 60], 0.018);

// typing 11.3-13.3 (34 chars) + send
const msg = 'Kahan hai tu? Bas ek baar bata de.';
for (let i = 0; i < msg.length; i++) if (msg[i] !== ' ' || i % 3 === 0) keyTap(11.3 + i * (2.0 / msg.length) + rnd() * 0.02);
whoosh(13.6, 0.3, 0.25, 600, 5000);

// FLASHBACK 15-30: light leak whoosh, scooter, birds, street, tea
whoosh(14.75, 0.6, 0.35, 300, 9000);
tone(15.0, 3.5, -0.1, (t) => { // scooter putter
  const env = Math.min(1, t / 0.2) * Math.min(1, (3.5 - t) / 0.6);
  const pulse = Math.pow(Math.max(0, Math.sin(TAU * 27 * t)), 6);
  return env * 0.22 * pulse * (Math.sin(TAU * 72 * t) + 0.5 * noise());
});
fnoise(15.0, 3.5, 0.2, 0.05, t => Math.min(1, t / 0.2) * Math.min(1, (3.5 - t) / 0.6), 3000, 600); // wind
fnoise(18.0, 12, 0, 0.035, t => Math.min(1, t / 1) * Math.min(1, (12 - t) / 1.5), 600, 120); // street murmur
[15.6, 16.6, 19.2, 21.4, 24.3, 27.2].forEach(birds);
fnoise(18.6, 1.3, 0.3, 0.1, t => Math.sin(Math.PI * t / 1.3) * (0.8 + 0.2 * Math.sin(TAU * 9 * t)), 3200, 700); // tea pour
tone(19.95, 0.5, 0.2, t => 0.07 * (Math.sin(TAU * 3150 * t) + 0.6 * Math.sin(TAU * 5080 * t) + 0.3 * Math.sin(TAU * 7300 * t)) * Math.exp(-t * 22)); // glass clink

// flashback score: C - G - Am - F
const chords = [[48, 55, 64], [43, 55, 62], [45, 57, 64], [41, 57, 65]];
chords.forEach((c, k) => {
  const t = 15.2 + k * 3.6;
  pad(t, k === 3 ? 4.4 : 3.9, c, 0.03);
  piano(t, c[0], 0.1, 3.6, -0.3);
  for (let a = 0; a < 6; a++) {
    const tt = t + a * 0.6;
    if (tt > 27.6) break;
    piano(tt, c[a % 3] + 12 + (a >= 3 ? 12 : 0) - (a >= 3 && c[a % 3] + 24 > 84 ? 12 : 0), 0.045, 1.8, 0.35);
  }
});
[[15.6, 76], [17.4, 79], [18.9, 76], [20.3, 74], [22.0, 72], [23.6, 76], [25.2, 69], [26.6, 72]].forEach(([t, m]) => piano(t, m, 0.13, 3, 0));
piano(28.0, 67, 0.14, 2.0, 0); // held note, fades into the colour drain

// PRESENT 30-40
whoosh(29.4, 0.9, 0.12, 2000, 200);
[[30.6, 45], [30.6, 52], [33.0, 60], [35.0, 59], [37.0, 57], [37.0, 41], [39.0, 52]].forEach(([t, m]) => piano(t, m, 0.1, 3, -0.1));
fnoise(30.4, 1.0, -0.2, 0.18, t => Math.sin(Math.PI * t) * (0.7 + 0.3 * Math.sin(TAU * 23 * t)), 1300, 150); // drawer slide
for (let k = 0; k < 9; k++) fnoise(32.4 + k * 0.12 + rnd() * 0.05, 0.09, 0.2, 0.12, t => Math.sin(Math.PI * t / 0.09), 8000, 2500); // paper rustle
// 40-45: silence except the fan hum

// 45: TWIST
bell(45.0);

// 48-56: cello swell + heartbeat
cello(48.0, 4.2, 45, 0.11, -0.15);
cello(48.0, 4.2, 52, 0.06, 0.15);
cello(52.0, 4.0, 41, 0.13, -0.15);
cello(52.0, 4.0, 48, 0.07, 0.15);
pad(49.0, 7.0, [76, 81], 0.008);
for (let t = 48.3; t < 53; t += 0.85) { thump(t, 55, 0.28, 18); thump(t + 0.22, 52, 0.18, 20); }

// 53-56: leaving
whoosh(53.0, 0.4, 0.3, 800, 4000);
[53.25, 53.6, 53.95, 54.3, 54.65, 55.0].forEach(footstep);
thump(55.6, 60, 0.95, 6); fnoise(55.6, 0.6, 0, 0.45, t => Math.exp(-t * 12), 1800);
tone(55.62, 0.4, 0.2, t => 0.08 * Math.sin(TAU * 410 * t) * Math.exp(-t * 18) * Math.sin(TAU * 37 * t)); // door rattle

// 56-60: echo
tick(58.0, 0.14); chime(58.0);
[57, 60, 64].forEach((m, k) => piano(58.6 + k * 0.05, m, 0.07, 1.4, 0));

// ---------- voices: music/SFX bed normalized, ducked under dialogue, then each character's line added
const path = require('path');
const VL = JSON.parse(fs.readFileSync(path.join(__dirname, 'voice', 'lines.json'), 'utf8'));
let bedPeak = 0; for (let i = 0; i < N; i++) bedPeak = Math.max(bedPeak, Math.abs(L[i]), Math.abs(R[i]));
const bedGain = 0.5 / bedPeak;
const duck = new Float32Array(N);
for (const ln of VL) { const s = Math.floor((ln.start - 0.25) * SR), e = Math.floor((ln.start + ln.dur + 0.3) * SR); for (let i = Math.max(0, s); i < Math.min(N, e); i++) duck[i] = 1; }
let dk = 0;
for (let i = 0; i < N; i++) { dk += (duck[i] - dk) * (duck[i] > dk ? 0.0006 : 0.00012); const g = bedGain * (1 - 0.5 * dk); L[i] *= g; R[i] *= g; }
for (const ln of VL) {
  const pcm = fs.readFileSync(ln.file).subarray(44), n = pcm.length / 2, s = Math.floor(ln.start * SR);
  let vp = 0; for (let i = 0; i < n; i++) vp = Math.max(vp, Math.abs(pcm.readInt16LE(i * 2)));
  const vg = (ln.who === 'kabirWhisper' ? 0.62 : 0.85) / (vp / 32768);
  const flash = ln.who === 'sameer' || ln.who === 'kabirYoung'; // flashback lines get a little room echo
  for (let i = 0; i < n; i++) {
    const v = pcm.readInt16LE(i * 2) / 32768 * vg;
    put(s + i, v, 0);
    if (flash) { put(s + i + Math.floor(0.07 * SR), v * 0.18, -0.4); put(s + i + Math.floor(0.13 * SR), v * 0.1, 0.4); }
  }
}

// ---------- master: soft clip + normalize, write WAV
let peak = 0;
for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.2); R[i] = Math.tanh(R[i] * 1.2); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const g = 0.89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4);
}
const out = process.argv[2] || 'ep01_audio.wav';
fs.writeFileSync(out, buf);
console.log('wrote', out, 'peak', peak.toFixed(3));
