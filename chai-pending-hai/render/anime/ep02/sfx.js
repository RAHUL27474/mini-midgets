// Ep2 "Maa" sound-effects bed (no music, no dialogue) on the shot timings in anime/ep02/shots.json.
// node anime/ep02/sfx.js [out.wav]
const path = require('path');
const { bed } = require('../../sfxlib');
const { SR, TAU, rnd, noise, tone, fnoise, buzz, chime, thump, bell, birds, footstep, write } = bed(60);

// rain: steady hiss + scattered drops; heavy on the road, softer at the house, gone in the kitchen and at dawn
function rain(t0, dur, amp) {
  fnoise(t0, dur, 0, amp, t => Math.min(1, t / 0.8, (dur - t) / 1.2), 6000, 900);
  for (let t = t0; t < t0 + dur; t += 0.02 + rnd() * 0.05) fnoise(t, 0.015, (rnd() - 0.5) * 1.6, amp * 1.4 * rnd(), q => Math.exp(-q * 300), 9000, 2500);
}
// motorbike: pulsed low engine with harmonics; level/pan/pitch follow the given curves of t (seconds into the sound)
function engine(t0, dur, level, pan, rpm) {
  let ph = 0;
  for (const side of [-1, 1]) {
    ph = 0;
    tone(t0, dur, side, t => {
      ph += TAU * rpm(t) / SR;
      const x = Math.sin(ph) + 0.6 * Math.sin(2 * ph + 0.3) + 0.35 * Math.sin(3 * ph) + 0.2 * Math.sin(5 * ph);
      const p = pan(t), g = side < 0 ? Math.min(1, 1 - p) : Math.min(1, 1 + p);
      return level(t) * g * 0.13 * x * (0.75 + 0.25 * Math.sin(ph / 2)) + level(t) * g * 0.02 * noise();
    });
  }
}
function knock(t0) { thump(t0, 170, 0.45, 40); fnoise(t0, 0.05, 0, 0.25, t => Math.exp(-t * 80), 2500, 300); }
function creak(t0, dur) {
  tone(t0, dur, -0.2, t => {
    const f = 380 + 160 * Math.sin(TAU * 0.7 * t) + 60 * Math.sin(TAU * 7 * t);
    return 0.05 * Math.sin(TAU * f * t) * Math.sign(Math.sin(TAU * 31 * t)) * Math.sin(Math.PI * t / dur);
  });
}
function pour(t0, dur) {
  fnoise(t0, dur, 0.2, 0.16, t => Math.sin(Math.PI * t / dur) * (0.7 + 0.3 * Math.sin(TAU * 11 * t) * Math.sin(TAU * 3.7 * t)), t => 2400 + 800 * Math.sin(TAU * 0.5 * t), 500);
  for (let t = t0; t < t0 + dur; t += 0.04 + rnd() * 0.08) tone(t, 0.03, 0.2, q => 0.04 * Math.sin(TAU * (900 + 900 * rnd()) * q) * Math.exp(-q * 120)); // bubbles
}
function clink(t0) { tone(t0, 0.5, 0.2, t => 0.07 * (Math.sin(TAU * 3150 * t) + 0.6 * Math.sin(TAU * 5080 * t) + 0.3 * Math.sin(TAU * 7300 * t)) * Math.exp(-t * 22)); }

// S01-S02 (0-7): rain on the road, the bike roars past then sits close, decelerates at the lane
rain(0, 10.5, 0.06);
fnoise(0.4, 6.4, 0, 0.05, t => Math.min(1, t / 0.5) * Math.min(1, (6.4 - t) / 0.6), 1400, 200); // wet tyre hiss
engine(0, 4.0, t => 0.5 + 0.5 * Math.exp(-((t - 2) ** 2) / 0.8), t => -0.9 + 1.8 * t / 4, t => 62 + 10 * Math.exp(-((t - 2) ** 2) / 0.8) - 6 * Math.max(0, t - 2) / 2);
engine(4.0, 3.0, t => 0.75 * Math.min(1, (3 - t) / 1.4), () => 0, t => 66 - 22 * Math.max(0, t - 1.6) / 1.4);
// S03-S11 (7-44): softer rain at the house, the knock, the door
rain(10.5, 33.5, 0.025);
footstep(8.6); footstep(9.3); footstep(10.0);
knock(11.25); knock(11.6); knock(11.95);
creak(13.6, 1.1); thump(13.55, 600, 0.06, 90); // latch, then the door swings
// S08 (27-30): Sameer's reminder rings on his phone
chime(27.25); buzz(27.3);
// S10 (35): Kabir sinks onto the step
thump(35.35, 70, 0.3, 14); fnoise(35.3, 0.4, 0, 0.05, t => Math.exp(-t * 9), 1200, 100);
// S12 (44-48): kitchen, gas flame, chai poured into two glasses
fnoise(44.0, 4.0, -0.3, 0.025, t => Math.min(1, t / 0.3, (4 - t) / 0.4), 3000, 1200);
pour(44.3, 1.3); pour(45.8, 1.1); clink(47.2);
// S14-S15 (52-60): dawn birds, then the phone lights up and the signature bell lands on the message
for (let t = 52.2; t < 59.5; t += 0.5 + rnd() * 0.9) birds(t);
buzz(56.2); chime(56.25);
bell(57.2);

write(process.argv[2] || path.join(__dirname, 'build', 'sfx.wav'));
