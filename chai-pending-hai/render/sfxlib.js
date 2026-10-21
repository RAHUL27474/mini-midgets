// Procedural sound-effect toolkit shared by the per-episode soundtrack scripts (audio.js for Ep1, anime/ep02/sfx.js, ...).
// bed(dur) returns stereo buffers plus synth primitives that write into them, and write(file) to save a 16-bit stereo WAV.
const fs = require('fs');

function bed(DUR, SR = 44100) {
  const N = SR * DUR;
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

  // master: soft clip, normalize to 0.89 peak, 16-bit stereo WAV
  function write(out) {
    let peak = 0;
    for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.2); R[i] = Math.tanh(R[i] * 1.2); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
    const g = 0.89 / peak;
    const buf = Buffer.alloc(44 + N * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
    buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
    for (let i = 0; i < N; i++) {
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4);
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4);
    }
    fs.writeFileSync(out, buf);
    console.log('wrote', out, 'peak', peak.toFixed(3));
  }

  return { SR, DUR, N, L, R, TAU, rnd, noise, mtof, put, tone, fnoise, tick, buzz, chime, keyTap, whoosh, thump, bell, birds, footstep, write };
}

module.exports = { bed };
