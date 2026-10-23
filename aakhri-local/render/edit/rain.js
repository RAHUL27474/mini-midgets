// Natural rain for the Aakhri Local soundtracks (replaces the white-noise hiss): a soft pink-noise wash, low-passed and
// decorrelated left/right, slowly swelling, plus individual droplets - ringing patter outdoors, dull taps on glass indoors.
// const rain = require('./rain')(bedPrimitives); rain(t0, dur, amp, { indoor })
module.exports = function makeRain({ SR, put, rnd }) {
  const TAU = Math.PI * 2;
  function pinkSource() { // Paul Kellet's economy pink filter
    let b0 = 0, b1 = 0, b2 = 0;
    return () => { const w = rnd() * 2 - 1; b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; return (b0 + b1 + b2 + w * 0.1848) * 0.25; };
  }
  function lowpass2(fc) { // two cascaded one-pole low-passes (12 dB/oct)
    const a = 1 - Math.exp(-TAU * fc / SR); let y1 = 0, y2 = 0;
    return x => { y1 += a * (x - y1); y2 += a * (y1 - y2); return y2; };
  }
  function highpass(fc) { const a = 1 - Math.exp(-TAU * fc / SR); let lp = 0; return x => { lp += a * (x - lp); return x - lp; }; }
  return function rain(t0, dur, amp, { indoor = false } = {}) {
    const s = Math.floor(t0 * SR), n = Math.floor(dur * SR);
    const fc = indoor ? 1400 : 2600, chans = [-0.8, 0.8].map(() => ({ src: pinkSource(), lp: lowpass2(fc), hp: highpass(indoor ? 120 : 250) }));
    const ph = rnd() * 10;
    for (let i = 0; i < n; i++) {
      const t = i / SR, env = Math.min(1, t / 1.2, (dur - t) / 1.2) * (0.82 + 0.12 * Math.sin(TAU * 0.11 * t + ph) + 0.06 * Math.sin(TAU * 0.37 * t + ph * 2));
      for (const [k, c] of chans.entries()) put(s + i, c.hp(c.lp(c.src())) * amp * 2.2 * env, k ? 0.8 : -0.8);
    }
    // droplets: short damped resonances at random pitch, pan and level
    const rate = indoor ? 9 : 26;
    for (let t = 0.05; t < dur - 0.05; t += -Math.log(1 - rnd()) / rate) {
      const f = indoor ? 700 + rnd() * 1600 : 2200 + rnd() * 3800, dec = indoor ? 55 + rnd() * 40 : 120 + rnd() * 140, a = amp * (indoor ? 0.35 : 0.22) * (0.2 + rnd() ** 2);
      const env = Math.min(1, t / 1.2, (dur - t) / 1.2), pan = (rnd() - 0.5) * 1.6, st = s + Math.floor(t * SR), len = Math.floor(SR * 5 / dec);
      for (let i = 0; i < len; i++) { const q = i / SR; put(st + i, Math.sin(TAU * f * q * (1 - 0.15 * q * dec / 5)) * Math.exp(-q * dec) * a * env, pan); }
    }
  };
};
