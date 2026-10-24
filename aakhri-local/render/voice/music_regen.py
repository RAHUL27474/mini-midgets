# Regenerate one MusicGen cue with a quality gate: several seeds, keep the take with the lowest spectral flatness
# (hiss scores high, clean tonal music low) and enough level. Overwrites epNN/build/<cue>.wav.
# python music_regen.py ep03 music_b "<prompt>" [seeds=3,4,5]
import os, sys, time
import numpy as np, soundfile as sf, torch
from transformers import AutoProcessor, MusicgenForConditionalGeneration

ep, cue, prompt = sys.argv[1], sys.argv[2], sys.argv[3]
seeds = [int(s) for s in (sys.argv[4] if len(sys.argv) > 4 else "3,4,5").split(",")]
B = os.path.join(os.path.dirname(__file__), "..", "..", ep, "build")

def score(a):
    fr = [np.abs(np.fft.rfft(a[i:i + 2048] * np.hanning(2048))) + 1e-9 for i in range(0, len(a) - 2048, 2048)]
    flat = float(np.mean([np.exp(np.log(x).mean()) / x.mean() for x in fr]))
    rms = 20 * np.log10(np.sqrt((a ** 2).mean()) + 1e-9)
    return flat, rms

torch.set_num_threads(os.cpu_count())
proc = AutoProcessor.from_pretrained("facebook/musicgen-small")
model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")
sr = model.config.audio_encoder.sampling_rate
best = None
for seed in seeds:
    t = time.time(); torch.manual_seed(seed)
    x = proc(text=[prompt], padding=True, return_tensors="pt")
    with torch.no_grad(): a = model.generate(**x, do_sample=True, guidance_scale=3.5, max_new_tokens=1600)[0, 0].cpu().numpy()
    flat, rms = score(a)
    print(f"seed {seed}: flatness {flat:.3f}  rms {rms:.1f} dB  ({time.time() - t:.0f}s)", flush=True)
    if rms > -40 and (best is None or flat < best[0]): best = (flat, a, seed)
    if flat < 0.03: break  # clean enough, stop early
a = best[1] / max(1e-6, np.abs(best[1]).max()) * 0.8
sf.write(os.path.join(B, f"{cue}.wav"), a, sr)
print(f"kept seed {best[2]} (flatness {best[0]:.3f}) -> {cue}.wav", flush=True)
