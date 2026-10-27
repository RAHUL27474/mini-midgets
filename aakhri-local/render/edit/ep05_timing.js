// EP5 shot timings (ep05/ep05_script.md) and where each voice line starts; shared by the soundtrack and the animatic.
const SHOTS = [['s01', 4], ['s02', 3], ['s03', 4], ['s04', 4], ['s05', 4], ['s06', 4], ['s07', 4], ['s08', 5], ['s09', 5], ['s10', 4], ['s11', 4], ['s12', 4], ['s13', 4], ['s14', 4], ['s15', 3]]
  .map(([id, dur]) => ({ id, dur }));
const start = {}; let t = 0; for (const s of SHOTS) { start[s.id] = t; t += s.dur; }
const lines = { e5_01: start.s04 + 0.6, e5_02: start.s06 + 0.8, e5_03: start.s07 + 0.6, e5_04: start.s08 + 0.5, e5_05: start.s09 + 0.4, e5_06: start.s10 + 1.5 };
module.exports = { SHOTS, start, DUR: t, lines };
