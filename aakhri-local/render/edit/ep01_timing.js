// EP1 shot timings (ep01/ep01_script.md) and where each voice line starts; shared by the soundtrack and the animatic.
const SHOTS = [['s01', 4], ['s02', 3], ['s03', 4], ['s04', 4], ['s05', 4], ['s06', 4], ['s07', 5], ['s08', 3], ['s09', 4], ['s10', 3], ['s11', 4], ['s12', 4], ['s13', 4], ['s14', 5], ['s15', 5]]
  .map(([id, dur]) => ({ id, dur }));
const start = {}; let t = 0; for (const s of SHOTS) { start[s.id] = t; t += s.dur; }
const lines = { e1_01: start.s07 + 0.6, e1_02: start.s08 + 0.2, e1_03: start.s10 + 0.2, e1_04: start.s13 + 0.5, e1_05: start.s14 + 0.9 };
module.exports = { SHOTS, start, DUR: t, lines };
