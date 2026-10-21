// Final edit for the anime episode: dialogue + MusicGen score + SFX mix, phone-UI / newspaper / subtitle overlays, 60fps masters.
// node anime/compose.js [--ep ep02] [--audio-only] [--preview]   (episode config: anime/<ep>/edit.js, default ep01)
//   in : anime/<ep>/edit.js + its shots.json, voice.json, picks.json ("voice": "<kaggle job>/<take>.wav"), build/sfx.wav; clips and takes under kaggle_out/
//   out: anime/out/<out>_shorts_1080x1920_60fps.mp4 and <out>_youtube_1920x1080_60fps.mp4 (<out> from the episode config)
const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const FF = require('ffmpeg-static');
const W = 1080, H = 1920, FPS = 60, DUR = 60, SR = 48000, N = SR * DUR;
const EP = process.argv.includes('--ep') ? process.argv[process.argv.indexOf('--ep') + 1] : 'ep01';
let E, BUILD, SHOTS, VOICE, PICKS;  // set by loadEpisode() once the drawing helpers below exist
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const PREVIEW = process.argv.includes('--preview');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);


// ---------- audio helpers: everything decoded through ffmpeg to mono f32 @48k
function decode(file, af) {
  const raw = execFileSync(FF, ['-v', 'error', '-i', file, ...(af ? ['-af', af] : []), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
function trimSilence(a, th = 0.012) {  // -> { a, off }: trimmed audio and how many seconds were cut from the front
  let s = 0, e = a.length - 1;
  while (s < e && Math.abs(a[s]) < th) s++;
  while (e > s && Math.abs(a[e]) < th) e--;
  const s0 = Math.max(0, s - Math.round(SR * 0.03));
  return { a: a.subarray(s0, Math.min(a.length, e + SR * 0.12)), off: s0 / SR };
}
// close-mic dialogue polish: rumble cut, less boxiness, a little presence, gentle levelling
const VOICE_FX = 'highpass=f=75,equalizer=f=280:t=q:w=1:g=-2.5,equalizer=f=3500:t=q:w=1.2:g=2.5,acompressor=threshold=-22dB:ratio=3:attack=4:release=90:makeup=2';

// ---------- word timing: align the script's words to Whisper's word timestamps, so subtitles follow the speech
const normW = w => w.replace(/[^\u0900-\u097F]/g, '').replace(/\u093c/g, '');
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] !== b[j - 1]));
  return d[a.length][b.length];
}
function alignWords(text, heard, off, dur) {
  const sw = text.split(/\s+/).filter(Boolean), hw = heard.filter(w => normW(w.w) && w.s != null);
  const n = sw.length, m = hw.length, sim = (i, j) => { const a = normW(sw[i]), b = normW(hw[j].w); return 1 - lev(a, b) / Math.max(a.length, b.length, 1); };
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1] + sim(i - 1, j - 1) - 0.3);
  const t = sw.map(() => null);
  for (let i = n, j = m; i > 0 && j > 0;) {
    if (dp[i][j] === dp[i - 1][j - 1] + sim(i - 1, j - 1) - 0.3 && sim(i - 1, j - 1) > 0.3) { const h = hw[j - 1]; t[i - 1] = [h.s, h.e ?? (hw[j] ? hw[j].s : h.s + 0.3)]; i--; j--; }
    else if (dp[i][j] === dp[i - 1][j]) i--; else j--;
  }
  // words Whisper missed: spread them over the gap between their matched neighbours, weighted by length
  for (let i = 0; i < n;) {
    if (t[i]) { i++; continue; }
    let k = i; while (k < n && !t[k]) k++;
    const a = i ? t[i - 1][1] : off, b = k < n ? t[k][0] : off + dur, len = sw.slice(i, k).reduce((x, w) => x + normW(w).length + 1, 0);
    let c = a; for (let q = i; q < k; q++) { const d = (b - a) * (normW(sw[q]).length + 1) / len; t[q] = [c, c + d]; c += d; }
    i = k;
  }
  return sw.map((w, i) => ({ w, s: Math.max(0, t[i][0] - off), e: Math.min(dur, Math.max(t[i][1], t[i][0] + 0.12) - off) }));
}
const peak = a => a.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);

function mixAudio() {
  const L = new Float32Array(N), R = new Float32Array(N), voiceEnv = new Float32Array(N);
  const add = (a, t0, g, pan = 0, env) => {
    const s = Math.round(t0 * SR);
    for (let i = 0; i < a.length; i++) {
      const j = s + i; if (j < 0 || j >= N) continue;
      const v = a[i] * g * (env ? env(i / SR) : 1);
      L[j] += v * Math.min(1, 1 - pan); R[j] += v * Math.min(1, 1 + pan);
    }
  };
  // dialogue
  const placed = []; let t = 0;
  for (const [id, at, who] of E.lines) {
    const [job, file] = PICKS.voice[id].split('/');  // "<kaggle job>/<take>.wav"
    const f = path.join(ROOT, 'kaggle_out', job, 'voice', file);
    const { a, off } = trimSilence(decode(f, VOICE_FX)), start = typeof at === 'string' ? t + Number(at) : at, dur = a.length / SR;
    const take = JSON.parse(fs.readFileSync(path.join(ROOT, 'kaggle_out', job, 'voice', 'report.json'), 'utf8'))[file.replace('.wav', '')];
    const text = VOICE.find(v => v.id === id).text;
    const words = alignWords(text, take.words || [], off, dur).map(w => ({ w: w.w, s: +(start + w.s).toFixed(3), e: +(start + w.e).toFixed(3) }));
    const g = (who === 'whisper' ? 0.62 : 0.8) / peak(a);
    add(a, start, g);
    if (E.echo.includes(who)) { add(a, start + 0.06, g * 0.16, -0.5); add(a, start + 0.11, g * 0.09, 0.5); } // flashback room echo
    for (let i = Math.round((start - 0.2) * SR); i < Math.round((start + dur + 0.25) * SR); i++) if (i >= 0 && i < N) voiceEnv[i] = 1;
    placed.push({ id, start: +start.toFixed(3), end: +(start + dur).toFixed(3), dur: +dur.toFixed(3), who, text, words });
    t = start + dur;
  }
  const dj = path.join(BUILD, 'dialogue.json'), dtext = JSON.stringify(placed, null, 1);
  if (!fs.existsSync(dj) || fs.readFileSync(dj, 'utf8') !== dtext) fs.writeFileSync(dj, dtext); // unchanged timing keeps the cached overlay valid
  const mus = new Float32Array(N);
  for (const [id, t0, off, len, fi, fo, g] of E.music) {
    const a = decode(path.join(ROOT, 'kaggle_out', E.musicJob || 'cph-music', 'music', PICKS.music[id])).subarray(Math.round(off * SR));
    const n = Math.min(a.length, Math.round(len * SR)), gg = g / peak(a);
    for (let i = 0; i < n; i++) {
      const tt = i / SR, env = Math.min(1, tt / fi, (n / SR - tt) / fo);
      const j = Math.round(t0 * SR) + i; if (j < N) mus[j] += a[i] * gg * Math.max(0, env);
    }
  }
  let dk = 0;
  for (let i = 0; i < N; i++) { dk += (voiceEnv[i] - dk) * (voiceEnv[i] > dk ? 0.0005 : 0.0001); L[i] += mus[i] * (1 - 0.55 * dk); R[i] += mus[i] * (1 - 0.55 * dk); }
  // sfx bed (stereo)
  const sfx = execFileSync(FF, ['-v', 'error', '-i', path.join(BUILD, 'sfx.wav'), '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const S = new Float32Array(sfx.buffer, sfx.byteOffset, sfx.length / 4);
  for (let i = 0; i < N && 2 * i + 1 < S.length; i++) { L[i] += S[2 * i] * 0.75; R[i] += S[2 * i + 1] * 0.75; }
  // master: soft clip, normalize to -1 dBFS
  let p = 0; for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.1); R[i] = Math.tanh(R[i] * 1.1); p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); }
  const g = 0.89 / p, buf = Buffer.alloc(N * 8);
  for (let i = 0; i < N; i++) { buf.writeFloatLE(L[i] * g, i * 8); buf.writeFloatLE(R[i] * g, i * 8 + 4); }
  fs.writeFileSync(path.join(BUILD, 'mix.f32'), buf);
  execFileSync(FF, ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', path.join(BUILD, 'mix.f32'), path.join(BUILD, 'mix.wav')]);
  fs.unlinkSync(path.join(BUILD, 'mix.f32'));
  log('audio mixed', placed.map(p => `${p.id}@${p.start}+${p.dur}`).join(' '));
  return placed;
}

// ---------- overlays
const FONTS = 'C:/Windows/Fonts/';
GlobalFonts.registerFromPath(FONTS + 'Nirmala.ttf', 'Nirmala'); GlobalFonts.registerFromPath(FONTS + 'NirmalaB.ttf', 'NirmalaB');
GlobalFonts.registerFromPath(FONTS + 'segoeui.ttf', 'Segoe'); GlobalFonts.registerFromPath(FONTS + 'segoeuib.ttf', 'SegoeB');
GlobalFonts.registerFromPath(FONTS + 'seguiemj.ttf', 'Emoji');
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const win = (T, a, b, fi = 0.25, fo = 0.25) => Math.min(ease((T - a) / fi), ease((b - T) / fo));
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function shadowBox(c, x, y, w, h, r, fill, a = 1) { c.save(); c.globalAlpha *= a; c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 40; c.shadowOffsetY = 12; rr(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); c.restore(); }
function ticks(c, x, y, double, blue) {
  c.save(); c.strokeStyle = blue ? '#53bdeb' : '#8696a0'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
  for (let k = 0; k < (double ? 2 : 1); k++) { c.beginPath(); c.moveTo(x + k * 12, y); c.lineTo(x + 8 + k * 12, y + 8); c.lineTo(x + 22 + k * 12, y - 8); c.stroke(); }
  c.restore();
}
function bubble(c, x, y, w, text, mine, meta, tick) {
  c.font = '34px Segoe, Emoji';
  const lines = wrap(c, text, w - 60), h = 40 + lines.length * 46 + 30;
  rr(c, x, y, w, h, 26); c.fillStyle = mine ? '#005c4b' : '#202c33'; c.fill();
  c.fillStyle = '#e9edef'; lines.forEach((l, i) => c.fillText(l, x + 28, y + 62 + i * 46));
  c.font = '24px Segoe'; c.fillStyle = '#8fa1ab'; c.textAlign = 'right'; c.fillText(meta, x + w - (tick ? 62 : 24), y + h - 18); c.textAlign = 'left';
  if (tick) ticks(c, x + w - 54, y + h - 28, tick > 1, tick > 2);
  return h;
}
function wrap(c, text, maxW) { const out = []; let cur = ''; for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; }

function phoneFrame(c, cx, cy, w, h, a, draw) {
  c.save(); c.globalAlpha = a;
  shadowBox(c, cx - w / 2 - 14, cy - h / 2 - 14, w + 28, h + 28, 70, '#0b0d10');
  rr(c, cx - w / 2, cy - h / 2, w, h, 58); c.save(); c.clip(); c.fillStyle = '#0b141a'; c.fillRect(cx - w / 2, cy - h / 2, w, h);
  c.translate(cx - w / 2, cy - h / 2); draw(w, h); c.restore();
  c.restore();
}
function chatHeader(c, w) {
  c.fillStyle = '#1f2c34'; c.fillRect(0, 0, w, 150);
  c.beginPath(); c.arc(80, 95, 36, 0, 7); c.fillStyle = '#c0392b'; c.fill();
  c.fillStyle = '#fff'; c.font = '34px SegoeB'; c.fillText('S', 69, 107);
  c.font = '36px SegoeB, Emoji'; c.fillText('Sameer 🛵', 136, 92); c.font = '24px Segoe'; c.fillStyle = '#8fa1ab'; c.fillText('last seen 5 years ago', 136, 128);
}

function overlay(c, T, dlg) {
  c.clearRect(0, 0, W, H);
  E.draw(c, T);
  // subtitles: short phrases timed to the speech, the word being spoken highlighted (lower-middle, clear of the Shorts/Reels UI)
  const y0 = E.subY(T);
  for (const g of subGroups(dlg)) {
    if (T < g.s || T > g.e) continue;
    const a = win(T, g.s, g.e, 0.08, 0.12), accent = E.accent[g.who] || '#ffd84a';
    c.save(); c.globalAlpha = a; c.font = '62px NirmalaB'; c.lineJoin = 'round'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const sp = c.measureText(' ').width, ws = g.words.map(w => c.measureText(w.w).width);
    const rows = [[]]; let rw = 0;
    g.words.forEach((w, i) => { if (rw + ws[i] > 920 && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(i); rw += ws[i] + sp; });
    rows.forEach((r, ri) => {
      const tw = r.reduce((x, i) => x + ws[i], 0) + sp * (r.length - 1);
      let x = (W - tw) / 2; const y = y0 + (ri - rows.length + 1) * 84;
      for (const i of r) {
        const w = g.words[i], on = T >= w.s && T < w.e, done = T >= w.e, k = on ? 1 + 0.08 * Math.min(1, (T - w.s) / 0.08) : 1;
        c.save(); c.translate(x + ws[i] / 2, y); c.scale(k, k);
        c.lineWidth = 13; c.strokeStyle = 'rgba(0,0,0,0.92)'; c.strokeText(w.w, -ws[i] / 2, 0);
        c.fillStyle = on ? accent : done ? '#ffffff' : 'rgba(255,255,255,0.62)'; c.fillText(w.w, -ws[i] / 2, 0);
        c.restore(); x += ws[i] + sp;
      }
    });
    c.restore();
  }
}

// phrase groups of up to 4 words, split at punctuation; each stays up until the next phrase starts
let GROUPS = null;
function subGroups(dlg) {
  if (GROUPS) return GROUPS;
  GROUPS = [];
  for (const d of dlg) {
    let cur = [];
    d.words.forEach((w, i) => { cur.push(w); if (/[,.…।!?]$/.test(w.w) || cur.length === 4 || i === d.words.length - 1) { GROUPS.push({ who: d.who, words: cur }); cur = []; } });
  }
  GROUPS.forEach((g, i) => { const nx = GROUPS[i + 1]; g.s = g.words[0].s - 0.1; g.e = Math.min(g.words[g.words.length - 1].e + 0.45, nx ? nx.words[0].s - 0.12 : 1e9); });
  return GROUPS;
}

function renderOverlay(dlg) {
  const f = path.join(BUILD, 'overlay.mov');
  const p = spawn(FF, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'qtrle', f], { stdio: ['pipe', 'inherit', 'inherit'] });
  const cv = createCanvas(W, H), c = cv.getContext('2d');
  return new Promise(async (res, rej) => {
    p.on('close', code => code ? rej(new Error('overlay ffmpeg ' + code)) : res(f));
    for (let i = 0; i < DUR * FPS; i++) {
      overlay(c, i / FPS, dlg);
      const data = cv.data ? cv.data() : c.getImageData(0, 0, W, H).data;
      if (!p.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.length))) await new Promise(r => p.stdin.once('drain', r));
      if (i % 600 === 0) log('overlay', i / FPS, 's');
    }
    p.stdin.end();
  });
}

function run(args) {
  return new Promise((res, rej) => { const p = spawn(FF, args, { stdio: ['ignore', 'inherit', 'inherit'] }); p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()); });
}

function loadEpisode() {
  E = require(path.join(__dirname, EP, 'edit.js'))({ W, H, ui: { ease, win, rr, shadowBox, ticks, bubble, wrap, phoneFrame, chatHeader } });
  BUILD = path.join(E.dir, 'build'); fs.mkdirSync(BUILD, { recursive: true });
  SHOTS = JSON.parse(fs.readFileSync(path.join(E.dir, 'shots.json'), 'utf8')).shots;
  VOICE = JSON.parse(fs.readFileSync(path.join(E.dir, 'voice.json'), 'utf8')).lines;
  PICKS = JSON.parse(fs.readFileSync(path.join(E.dir, 'picks.json'), 'utf8'));
}

(async () => {
  loadEpisode();
  const dlg = mixAudio();
  if (process.argv.includes('--audio-only')) return;
  if (PREVIEW) { // stills of the overlay at key moments, for checking layout
    const cv = createCanvas(W, H), c = cv.getContext('2d');
    for (const T of [2.5, 9.5, 12.5, 14.0, 19, 37, 46.5, 50, 58.5]) { overlay(c, T, dlg); fs.writeFileSync(path.join(BUILD, `ov_${T}.png`), cv.toBuffer('image/png')); }
    return log('preview stills written to', BUILD);
  }
  // the overlay only depends on the dialogue timing, so reuse it when it is newer than both dialogue.json and this script
  const ov = path.join(BUILD, 'overlay.mov');
  if (!fs.existsSync(ov) || fs.statSync(ov).mtimeMs < Math.max(fs.statSync(path.join(BUILD, 'dialogue.json')).mtimeMs, fs.statSync(__filename).mtimeMs, fs.statSync(path.join(__dirname, EP, 'edit.js')).mtimeMs)) await renderOverlay(dlg);
  // clips -> one 60fps track, per-shot grade, overlay, audio
  const inputs = [], parts = [];
  SHOTS.forEach((s, i) => {
    const { dirs, id, ss, pre } = E.clip(s);
    const clip = dirs.map(d => path.join(ROOT, 'kaggle_out', d, 'clips', `${id}.mp4`)).find(f => fs.existsSync(f));
    if (!clip) throw new Error('missing clip ' + s.id);
    inputs.push(...(ss ? ['-ss', String(ss)] : []), '-i', clip);
    parts.push(`[${i}:v]${pre}scale=${W}:${H},setsar=1,fps=${FPS},trim=duration=${s.dur},setpts=PTS-STARTPTS,${E.grade(s)}[v${i}]`);
  });
  const n = SHOTS.length;
  const fc = parts.join(';') + ';' + SHOTS.map((_, i) => `[v${i}]`).join('') + `concat=n=${n}:v=1:a=0[base];[base][${n}:v]overlay=format=auto[vert];` +
    '[vert]format=yuv420p[outv]';
  const vert = path.join(OUT, `${E.out}_shorts_1080x1920_60fps.mp4`);
  await run(['-v', 'error', '-stats', '-y', ...inputs, '-i', path.join(BUILD, 'overlay.mov'), '-i', path.join(BUILD, 'mix.wav'),
    '-filter_complex', fc,
    '-map', '[outv]', '-map', `${n + 1}:a`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '320k', '-t', String(DUR), '-movflags', '+faststart', vert]);
  log('wrote', vert);
  // 16:9 YouTube master: vertical frame centred over a blurred, darkened fill of itself
  const wide = path.join(OUT, `${E.out}_youtube_1920x1080_60fps.mp4`);
  await run(['-v', 'error', '-stats', '-y', '-i', vert, '-filter_complex',
    '[0:v]split[a][b];[a]scale=1920:-2,crop=1920:1080,setsar=1,gblur=sigma=40,eq=brightness=-0.12[bg];[b]scale=-2:1080,setsar=1[fg];[bg][fg]overlay=(W-w)/2:0,setsar=1,format=yuv420p[v]',
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-r', String(FPS), '-c:a', 'copy', '-movflags', '+faststart', wide]);
  log('wrote', wide);
})().catch(e => { log('ERROR', e.stack || e); process.exit(1); });
