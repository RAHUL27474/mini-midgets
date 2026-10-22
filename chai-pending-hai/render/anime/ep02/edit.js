// Episode 2 "Maa": dialogue timeline, score cues (the series score from Ep1), per-shot clip/grade rules and overlay graphics.
// node anime/compose.js --ep ep02
module.exports = ({ W, H, ui }) => {
  const { ease, win, rr, shadowBox } = ui;

  function card(c, x, y, w, h, a, icon, iconBg, title, lines, meta) {
    shadowBox(c, x, y, w, h, 40, 'rgba(32,38,46,0.94)', a);
    c.save(); c.globalAlpha *= a;
    c.fillStyle = iconBg; rr(c, x + 36, y + 34, 70, 70, 18); c.fill();
    c.font = '40px Emoji'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(icon, x + 71, y + 84); c.textAlign = 'left';
    c.font = '38px SegoeB, Emoji'; c.fillStyle = '#fff'; c.fillText(title, x + 130, y + 80);
    if (meta) { c.font = '28px Segoe'; c.fillStyle = '#aab4bb'; c.textAlign = 'right'; c.fillText(meta, x + w - 36, y + 80); c.textAlign = 'left'; }
    lines.forEach(([text, font, color], i) => { c.font = font; c.fillStyle = color; c.fillText(text, x + 40, y + 160 + i * 58); });
    c.restore();
  }

  return {
    dir: __dirname,
    out: 'ep02_kaggle',
    lines: [
      ['k1', 17.4, 'kabir'],
      ['sh1', 22.0, 'shanta'], ['sh2', '+0.5', 'shanta'],
      ['sh3', 30.6, 'shanta'],
      ['sh4', 39.6, 'shanta'],
      ['k2', 48.6, 'kabir'],
    ],
    echo: [],
    accent: { shanta: '#ffa3c4' },
    // score: [music id, timeline start, source offset, length, fade in, fade out, gain] — tense ride, soft piano at the door, warm theme for the chai; silent for the final message
    music: [
      ['m_tense', 0.0, 0, 10.5, 1.5, 2.0, 0.30],
      ['m_night', 14.0, 0, 21.0, 2.5, 1.5, 0.26],
      ['m_gold', 39.5, 0, 16.0, 2.0, 1.5, 0.32],
    ],
    subY: () => 1380,
    clip: s => ({ dirs: [...['a', 'b', 'c', 'd'].map(g => `cph2c-anim-${g}`), ...['a', 'b', 'c', 'd', 'e'].map(g => `cph2-anim-${g}`)], id: s.id, ss: 0, pre: '' }),  // Canva-cast clips first
    grade: s => s.grade === 'dawn' ? 'eq=saturation=1.06:gamma=1.03,colorbalance=rs=0.03:bs=-0.02,vignette=PI/6'
      : s.grade === 'home' ? 'eq=saturation=1.0,colorbalance=rs=0.02:bs=0.02,vignette=PI/5'
      : 'eq=saturation=0.92,colorbalance=bs=0.05:rs=-0.02,vignette=PI/5',
    draw(c, T) {
      // opening title
      if (T > 0.3 && T < 3.4) {
        const a = win(T, 0.3, 3.4, 0.5, 0.6);
        c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.lineJoin = 'round';
        c.font = '44px SegoeB'; c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText('CHAI PENDING HAI', W / 2, 300); c.fillStyle = '#ffd84a'; c.fillText('CHAI PENDING HAI', W / 2, 300);
        c.font = '84px NirmalaB'; c.lineWidth = 12; c.strokeText('एपिसोड 2 · माँ', W / 2, 400); c.fillStyle = '#fff'; c.fillText('एपिसोड 2 · माँ', W / 2, 400);
        c.restore();
      }
      // S08: Sameer's yearly reminder on his old phone
      if (T > 26.8 && T < 30.3) {
        const a = win(T, 26.8, 30.3, 0.3, 0.35), k = 0.92 + 0.08 * ease((T - 26.8) / 0.4);
        c.save(); c.translate(W / 2, 700); c.scale(k, k); c.translate(-W / 2, -700);
        card(c, 80, 520, W - 160, 360, a, '⏰', '#f39c12', 'Reminder', [
          ['Kabir ka birthday 🎂', '50px SegoeB, Emoji', '#ffffff'],
          ['Chai pending hai ☕  — Sameer', '38px Segoe, Emoji', '#e9edef'],
          ['Repeats every year · 12:00 AM', '30px Segoe', '#8fa1ab'],
        ], '12:00 AM');
        c.restore();
      }
      // S15: the message from an unknown number, signature bell at 57.2
      if (T > 56.0 && T < 59.4) {
        const a = win(T, 56.0, 59.4, 0.3, 0.25), y = 560 - (1 - ease((T - 56.0) / 0.35)) * 80;
        card(c, 70, y, W - 140, 250, a, '💬', '#25d366', 'Unknown number', [['Kabir pahunch gaya? — S', '46px SegoeB, Emoji', '#ffffff']], 'now');
        if (T > 57.2 && T < 57.7) { c.fillStyle = `rgba(255,255,255,${0.35 * (1 - (T - 57.2) / 0.5)})`; c.fillRect(0, 0, W, H); }
      }
      // end card
      if (T > 59.35) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '90px SegoeB'; c.globalAlpha = ease((T - 59.45) / 0.25); c.fillText('Part 3 →', W / 2, H / 2 + 30); c.globalAlpha = 1; c.textAlign = 'left'; }
    },
  };
};
