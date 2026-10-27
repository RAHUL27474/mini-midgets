# Per-second noise / silence check for a mix: the user hears broadband hiss as "noise" and notices silent gaps.
# python noise_check.py <mix.wav> [more.wav ...]  -> prints the seconds that fail (spectral flatness > 0.1 or level < -45 dB)
import sys
import numpy as np, soundfile as sf

for f in sys.argv[1:]:
    a, sr = sf.read(f); a = a.mean(1) if a.ndim > 1 else a
    bad = []
    for t0 in range(int(len(a) / sr)):
        x = a[t0 * sr:(t0 + 1) * sr]
        rms = 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)
        fr = [np.abs(np.fft.rfft(x[i:i + 2048] * np.hanning(2048))) + 1e-9 for i in range(0, len(x) - 2048, 2048)]
        flat = float(np.mean([np.exp(np.log(q).mean()) / q.mean() for q in fr])) if fr else 1.0
        if rms < -45 or flat > 0.1: bad.append(f"{t0}s ({'silent' if rms < -45 else f'flat {flat:.2f}'})")
    print(f, "->", "CLEAN" if not bad else "problem seconds: " + ", ".join(bad))
