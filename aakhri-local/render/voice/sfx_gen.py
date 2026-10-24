# Realistic sound effects with Stable Audio Open Small (Stability AI Community License) on the CPU.
# python sfx_gen.py <ep> <name> "<prompt>" [seconds=10] [seed=1]  -> <ep>/build/sfx/<name>.wav
# Several names at once: python sfx_gen.py ep03 --batch sfx_ep03.json  ([{name, prompt, seconds, seed}])
import json, os, sys, time
import torch, soundfile as sf
from stable_audio_tools import get_pretrained_model
from stable_audio_tools.inference.generation import generate_diffusion_cond

ep = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "..", ep, "build", "sfx"); os.makedirs(OUT, exist_ok=True)
if sys.argv[2] == "--batch": jobs = json.load(open(sys.argv[3], encoding="utf-8"))
else: jobs = [{"name": sys.argv[2], "prompt": sys.argv[3], "seconds": float(sys.argv[4]) if len(sys.argv) > 4 else 10, "seed": int(sys.argv[5]) if len(sys.argv) > 5 else 1}]

torch.set_num_threads(os.cpu_count())
model, cfg = get_pretrained_model("stabilityai/stable-audio-open-small")
sr, size = cfg["sample_rate"], cfg["sample_size"]
for j in jobs:
    out = os.path.join(OUT, f"{j['name']}.wav")
    if os.path.exists(out) and not j.get("force"): print("skip", j["name"]); continue
    t = time.time()
    audio = generate_diffusion_cond(model, steps=8, cfg_scale=1.0, sampler_type="pingpong", sample_size=size, seed=j.get("seed", 1), device="cpu",
                                    conditioning=[{"prompt": j["prompt"], "seconds_total": j.get("seconds", 10)}])
    a = audio[0].float().clamp(-1, 1).numpy().T[: int(j.get("seconds", 10) * sr)]
    a = a / max(1e-6, abs(a).max()) * 0.9
    sf.write(out, a, sr)
    print(j["name"], f"{len(a) / sr:.1f}s", f"({time.time() - t:.0f}s)", flush=True)
