// Writes ep01_subtitles.srt from the voice-timed Hindi lines (same cue logic as the burned-in subtitles).
const fs = require('fs'), path = require('path');
const VL = JSON.parse(fs.readFileSync(path.join(__dirname, 'voice', 'lines.json'), 'utf8'));
const ts = s => { const ms = Math.round(s * 1000); return new Date(ms).toISOString().substr(11, 12).replace('.', ','); };
const cues = [];
for (const l of VL) {
  const parts = l.sub.split('|'), tot = parts.reduce((a, p) => a + p.length, 0); let t0 = l.start;
  parts.forEach((p, i) => { const d = l.dur * p.length / tot; cues.push([t0, i === parts.length - 1 ? t0 + d + 0.35 : t0 + d, p]); t0 += d; });
}
fs.writeFileSync(path.join(__dirname, '..', 'ep01-message', 'ep01_subtitles.srt'),
  cues.map(([a, b, t], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${t}\n`).join('\n'), 'utf8');
console.log(cues.length, 'cues');
