// Episode 1 "Message": dialogue timeline, score cues, per-shot clip/grade rules and the episode's own overlay graphics.
// Loaded by anime/compose.js (default episode). Shared drawing helpers arrive in `ui`.
const path = require('path');

module.exports = ({ W, H, ui }) => {
  const { ease, win, rr, shadowBox, ticks, bubble, wrap, phoneFrame, chatHeader } = ui;
  const CHAT = [
    ['Happy birthday bhai. Chai pending hai ☕', false, '12:00 AM · 2022'],
    ['Kahan hai tu? Sab theek hai? Maa ko bata de kam se kam…', true, '12:04 AM', 1],
    ['Happy birthday bhai. Chai pending hai ☕', false, '12:00 AM · 2023'],
    ['Aaj tapri gaya tha. Bhaiya ne tera poocha.', true, '12:10 AM', 1],
    ['Happy birthday bhai. Chai pending hai ☕', false, '12:00 AM · 2024'],
    ['Bas ek baar call kar le yaar.', true, '12:02 AM', 1],
    ['Happy birthday bhai. Chai pending hai ☕', false, '12:00 AM · 2025'],
  ];
  const MSG = 'Kahan hai tu? Bas ek baar bata de.';

  return {
    dir: path.join(__dirname, '..'),          // shots.json / voice.json / picks.json / build/ live in anime/
    out: 'ep01',                              // -> out/ep01_shorts_1080x1920_60fps.mp4, out/ep01_youtube_1920x1080_60fps.mp4
    // dialogue timeline: [segment id, start s (or '+gap' after the previous line), who]
    lines: [
      ['k1a', 2.3, 'kabir'], ['k1b', '+0.55', 'kabir'],
      ['s1a', 18.25, 'sameer'], ['s1b', '+0.2', 'sameer'],
      ['y1', '+0.25', 'young'],
      ['s2', 25.9, 'sameer'],
      ['k2a', 34.5, 'kabir'], ['k2b', '+0.7', 'kabir'],
      ['k3a', 48.4, 'whisper'], ['k3b', '+0.6', 'whisper'],
    ],
    echo: ['sameer', 'young'],               // flashback lines get a little room echo
    accent: { sameer: '#ffb347', young: '#8fd3ff' },
    // score: [music id, timeline start, source offset, length, fade in, fade out, gain]
    music: [
      ['m_night', 3.0, 0, 12.4, 2.5, 1.2, 0.30],
      ['m_gold', 14.8, 0, 15.6, 0.8, 1.6, 0.34],
      ['m_night', 30.4, 12, 9.6, 2.0, 0.4, 0.22],   // music drops to silence 40-45
      ['m_tense', 45.6, 0, 14.4, 2.5, 3.0, 0.34],
    ],
    subY: T => T > 7.8 && T < 11.6 ? 1560 : 1380, // below the chat phone while it is on screen
    clip(s) {
      // s13 (twist close-up) is a punched-in reuse of the end of s11's newspaper clip; the highlighted line is an overlay
      const src = s.id === 's13' ? 's11' : s.id;
      return {
        dirs: ['a', 'b', 'c', 'd', src].map(g => `cph-anim-${g}`), id: src, ss: s.id === 's13' ? 2.8 : 0,
        // AI newspaper text is gibberish: throw it out of focus behind the headline / highlighted-line cards
        pre: s.id === 's13' ? `scale=${W * 1.7}:${H * 1.7},crop=${W}:${H}:(iw-${W})/2:(ih-${H})*0.6,boxblur=12:2,` : s.id === 's11' ? `boxblur=10:2:enable='gte(t,1.8)',` : '',
      };
    },
    grade: s => s.grade === 'gold'
      ? 'eq=saturation=1.08:gamma=1.02,colorbalance=rs=0.04:bs=-0.04,noise=alls=5:allf=t,vignette=PI/5'
      : 'eq=saturation=0.92,colorbalance=bs=0.04:rs=-0.02,vignette=PI/5',
    draw(c, T) {
      // S01-S02: lock screen clock + notification
      if (T < 5.4) {
        const a = win(T, 0.5, 5.4, 0.4, 0.4);
        c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.92)'; c.shadowColor = 'rgba(80,140,255,0.8)'; c.shadowBlur = 30;
        c.font = '170px Segoe'; c.fillText(T < 1.3 ? '11:59' : '12:00', W / 2, 360);
        c.font = '40px Segoe'; c.fillText('Monday, 14 July', W / 2, 430); c.restore();
        const n = ease((T - 1.5) / 0.35);
        if (n > 0) {
          const y = 520 - (1 - n) * 60;
          shadowBox(c, 70, y, W - 140, 190, 40, 'rgba(32,38,46,0.92)', a * n);
          c.save(); c.globalAlpha = a * n; c.fillStyle = '#25d366'; rr(c, 106, y + 36, 64, 64, 16); c.fill();
          c.fillStyle = '#fff'; c.font = '30px SegoeB'; c.fillText('W', 120, y + 80);
          c.font = '36px SegoeB, Emoji'; c.fillText('Sameer 🛵', 196, y + 74); c.font = '26px Segoe'; c.fillStyle = '#aab'; c.fillText('now', W - 170, y + 74);
          c.font = '36px Segoe, Emoji'; c.fillStyle = '#e9edef'; c.fillText('Happy birthday bhai. Chai pending hai ☕', 106, y + 146); c.restore();
        }
      }
      // S04: scrolling chat history
      if (T > 8.0 && T < 11.4) {
        const a = win(T, 8.0, 11.4, 0.3, 0.3), sc = ease((T - 8.3) / 2.8);
        phoneFrame(c, W / 2, 830, 700, 1120, a, (w, h) => {
          let y = 180 - sc * 520;
          for (const [txt, mine, meta, tk] of CHAT) { const bw = 560; y += bubble(c, mine ? w - bw - 30 : 30, y, bw, txt, mine, meta, tk) + 24; }
          chatHeader(c, w);
        });
      }
      // S05: typing the reply, send, single grey tick
      if (T > 11.2 && T < 15.0) {
        const a = win(T, 11.2, 15.0, 0.3, 0.35);
        const typed = MSG.slice(0, Math.max(0, Math.min(MSG.length, Math.floor((T - 11.4) / 2.0 * MSG.length))));
        const sent = T > 13.6;
        c.save(); c.globalAlpha = a;
        if (!sent) {
          shadowBox(c, 60, 1500, W - 220, 110, 55, '#2a3942');
          c.fillStyle = '#e9edef'; c.font = '38px Segoe'; c.fillText(typed + (Math.floor(T * 2.5) % 2 ? '|' : ''), 110, 1568);
          c.beginPath(); c.arc(W - 105, 1555, 55, 0, 7); c.fillStyle = '#00a884'; c.fill();
          c.fillStyle = '#fff'; c.beginPath(); c.moveTo(W - 125, 1530); c.lineTo(W - 80, 1555); c.lineTo(W - 125, 1580); c.closePath(); c.fill();
        } else {
          const k = ease((T - 13.6) / 0.3);
          c.globalAlpha = a * k; c.translate(0, (1 - k) * 80);
          bubble(c, W - 700, 1440, 640, MSG, true, '12:01 AM', 1);
        }
        c.restore();
      }
      // S06: white light-leak flash into the flashback; S09->S10 warm-to-cold drain
      if (T > 14.6 && T < 15.6) { c.fillStyle = `rgba(255,236,200,${Math.min(ease((T - 14.6) / 0.4), ease((15.6 - T) / 0.6)) * 0.95})`; c.fillRect(0, 0, W, H); }
      if (T > 29.6 && T < 30.8) { c.fillStyle = `rgba(20,30,70,${Math.min(ease((T - 29.6) / 0.6), ease((30.8 - T) / 0.6)) * 0.9})`; c.fillRect(0, 0, W, H); }
      // S11: newspaper headline
      if (T > 35.0 && T < 40.0) {
        const a = win(T, 35.0, 40.0, 0.5, 0.4);
        c.save(); c.globalAlpha = a; c.translate(W / 2, 360); c.rotate(-0.025);
        shadowBox(c, -440, -120, 880, 270, 6, '#efe3c2');
        c.fillStyle = '#1b1712'; c.textAlign = 'center'; c.font = '62px NirmalaB'; c.fillText('युवक लापता', 0, -30);
        c.font = '44px NirmalaB'; c.fillText('नदी किनारे मिला स्कूटर', 0, 40);
        c.font = '32px Nirmala'; c.fillStyle = '#4a4030'; c.fillText('पुलिस ने फ़ोन बरामद किया', 0, 100); c.restore();
      }
      // S13: the highlighted line (bell hit at 45.0)
      if (T > 45.0 && T < 48.2) {
        const a = win(T, 45.0, 48.2, 0.08, 0.3), hl = ease((T - 45.25) / 0.9);
        c.save(); c.globalAlpha = a; c.translate(W / 2, 900);
        shadowBox(c, -470, -150, 940, 300, 6, '#efe3c2');
        c.font = '46px Nirmala'; c.textAlign = 'left';
        const L1 = 'पुलिस ने बताया कि फ़ोन युवक की', L2 = 'माँ, शांता देवी, को सौंपा गया।';
        const w2 = c.measureText(L2).width;
        c.fillStyle = 'rgba(255,214,0,0.75)'; c.fillRect(-420, 18, w2 * hl, 66);
        c.fillStyle = '#1b1712'; c.fillText(L1, -420, -20); c.fillText(L2, -420, 70); c.restore();
      }
      // S16: the reply turns "Seen"
      if (T > 57.0 && T < 59.4) {
        const a = win(T, 57.0, 59.4, 0.3, 0.25), seen = T > 58.0;
        phoneFrame(c, W / 2, 960, 760, 760, a, (w, h) => {
          chatHeader(c, w);
          const bh = bubble(c, w - 670, 330, 640, MSG, true, '12:01 AM', seen ? 3 : 1);
          if (seen) { c.globalAlpha *= ease((T - 58.0) / 0.3); c.fillStyle = '#53bdeb'; c.font = '30px SegoeB'; c.textAlign = 'right'; c.fillText('Seen', w - 34, 330 + bh + 50); }
        });
      }
      // end card
      if (T > 59.35) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '90px SegoeB'; c.globalAlpha = ease((T - 59.45) / 0.25); c.fillText('Part 2 →', W / 2, H / 2 + 30); c.globalAlpha = 1; c.textAlign = 'left'; }
    },
  };
};
