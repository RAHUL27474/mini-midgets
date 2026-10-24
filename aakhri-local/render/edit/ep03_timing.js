// EP3 shot timings (ep03/ep03_script.md) and where each voice line starts; shared by the soundtrack and the animatic.
const SHOTS = [['s01', 4], ['s02', 3], ['s03', 4], ['s04', 4], ['s05', 4], ['s06', 4], ['s07', 4], ['s08', 4], ['s09', 4], ['s10', 4], ['s11', 4], ['s12', 4], ['s13', 4], ['s14', 4], ['s15', 5]]
  .map(([id, dur]) => ({ id, dur }));
const start = {}; let t = 0; for (const s of SHOTS) { start[s.id] = t; t += s.dur; }
const lines = { e3_01: start.s04 + 0.5, e3_02: start.s05 + 0.5, e3_05: start.s10 + 2.2, e3_03: start.s11 + 1.2, e3_04: start.s14 + 1.0 };
module.exports = { SHOTS, start, DUR: t, lines };
