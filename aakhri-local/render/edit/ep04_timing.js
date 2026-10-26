// EP4 shot timings (ep04/ep04_script.md) and where each voice line starts; shared by the soundtrack and the animatic.
const SHOTS = [['s01', 4], ['s02', 3], ['s03', 4], ['s04', 3], ['s05', 4], ['s06', 6], ['s07', 5], ['s08', 4], ['s09', 4], ['s10', 4], ['s11', 3], ['s12', 5], ['s13', 3], ['s14', 4], ['s15', 4]]
  .map(([id, dur]) => ({ id, dur }));
const start = {}; let t = 0; for (const s of SHOTS) { start[s.id] = t; t += s.dur; }
const lines = { e4_01: start.s02 + 0.3, e4_02: start.s04 + 0.3, e4_03: start.s06 + 0.6, e4_04: start.s07 + 0.4, e4_05: start.s08 + 0.6, e4_06: start.s12 + 0.6, e4_07: start.s14 + 0.4 };
module.exports = { SHOTS, start, DUR: t, lines };
