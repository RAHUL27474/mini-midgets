# Depth maps for the 2.5D parallax pass: Depth Anything V2 Small on CPU, one 16-bit PNG per shot (white = near).
# python depth.py <shots_dir> <out_dir>
import os, sys, time
import numpy as np, torch
from PIL import Image
from transformers import pipeline

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
torch.set_num_threads(os.cpu_count())
pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device="cpu")
for f in sorted(os.listdir(src)):
    if not f.endswith(".png"): continue
    t = time.time()
    im = Image.open(os.path.join(src, f)).convert("RGB")
    d = np.array(pipe(im)["predicted_depth"].squeeze().float().numpy(), dtype=np.float32)
    d = (d - d.min()) / max(1e-6, d.max() - d.min())
    Image.fromarray((d * 65535).astype(np.uint16)).resize(im.size, Image.BICUBIC).save(os.path.join(out, f))
    print(f, f"{time.time() - t:.1f}s", flush=True)
