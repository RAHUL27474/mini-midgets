// EP2 shot timings (ep02/ep02_script.md) and where each voice line starts; shared by the soundtrack and the animatic.
const SHOTS = [['s01', 4], ['s02', 3], ['s03', 4], ['s04', 4], ['s05', 5], ['s06', 4], ['s07', 4], ['s08', 4], ['s09', 4], ['s10', 5], ['s11', 3], ['s12', 3], ['s13', 4], ['s14', 4], ['s15', 5]]
  .map(([id, dur]) => ({ id, dur }));
const start = {}; let t = 0; for (const s of SHOTS) { start[s.id] = t; t += s.dur; }
const lines = { e2_01: start.s03 + 1.0, e2_02: start.s04 + 0.4, e2_03: start.s05 + 0.6, e2_04: start.s06 + 0.3, e2_05: start.s07 + 0.9, e2_06: start.s09 + 0.6, e2_07: start.s10 + 0.4, e2_08: start.s13 + 0.8 };
module.exports = { SHOTS, start, DUR: t, lines };
