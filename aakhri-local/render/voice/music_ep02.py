# Aakhri Local EP2 score with MusicGen (facebook/musicgen-small) on CPU: two ~32 s cues following the script's music plan.
# python music_ep02.py  -> ep02/build/music_a.wav (0-32 s, warm friendship), music_b.wav (32-60 s, eerie)
import os, sys, time
import numpy as np, soundfile as sf, torch
from transformers import AutoProcessor, MusicgenForConditionalGeneration

B = os.path.join(os.path.dirname(__file__), "..", "..", "ep02", "build")
CUES = {
    "music_a": "warm gentle Indian anime film score, soft bansuri flute melody over tender piano, rainy night friendship, nostalgic and heartwarming, slow tempo, cinematic",
    "music_b": "eerie suspenseful anime film score, low dark drone, ticking clock, sudden silence then a soft temple bell, haunting mysterious strings, slow, cinematic",
}
torch.set_num_threads(os.cpu_count())
proc = AutoProcessor.from_pretrained("facebook/musicgen-small")
model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")
for name, prompt in CUES.items():
    if os.path.exists(os.path.join(B, f"{name}.wav")) and "--force" not in sys.argv: continue
    t = time.time(); torch.manual_seed(3)
    x = proc(text=[prompt], padding=True, return_tensors="pt")
    with torch.no_grad(): a = model.generate(**x, do_sample=True, guidance_scale=3.0, max_new_tokens=1600)  # ~32 s at 50 tokens/s
    a = a[0, 0].cpu().numpy(); a = a / max(1e-6, np.abs(a).max()) * 0.8
    sf.write(os.path.join(B, f"{name}.wav"), a, model.config.audio_encoder.sampling_rate)
    print(name, f"{len(a) / model.config.audio_encoder.sampling_rate:.1f}s audio in {time.time() - t:.0f}s", flush=True)
