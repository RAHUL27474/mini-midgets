# Kaggle CPU kernel: same FLUX.2-klein 4B int4 OpenVINO model and prompts as gen_klein.py, so Kaggle sessions can render
# Aakhri Local shots in parallel with the local PC. Outputs /kaggle/working/shots/<id>.png
import json, os, subprocess, sys, time
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "openvino==2026.2.0", "optimum-intel==2.0.0", "diffusers==0.37.0",
                "transformers==5.0.0", "accelerate==1.14.0", "peft==0.19.1", "huggingface_hub", "hf_xet"], check=True)
subprocess.run(["git", "clone", "-q", "--depth", "1", "https://github.com/rupeshs/fastsdcpu.git", "/tmp/fastsdcpu"], check=True)
from huggingface_hub import snapshot_download
model = snapshot_download("rupeshs/flux2-klein-4b-int4-ov", local_dir="/tmp/klein")
log("model ready")
sys.path.insert(0, "/tmp/fastsdcpu/src")
import torch
from backend.openvino.ov_flux2klein_pipeline import OVFlux2KleinPipeline

JOB = json.loads(r'''__JOB__''')
OUT = "/kaggle/working/shots"; os.makedirs(OUT, exist_ok=True)
torch.set_num_threads(os.cpu_count())
pipe = OVFlux2KleinPipeline.from_pretrained(model, local_files_only=True, ov_config={"CACHE_DIR": "/tmp/ovcache"}, device="CPU")
log("loaded")
for it in JOB["items"]:
    t = time.time()
    img = pipe(prompt=it["prompt"], num_inference_steps=JOB.get("steps", 4), guidance_scale=1.0, width=JOB.get("width", 576), height=JOB.get("height", 1024),
               generator=torch.Generator("cpu").manual_seed(it.get("seed", 1))).images[0]
    img.save(f"{OUT}/{it['id']}.png")
    log(it["id"], f"{time.time() - t:.0f}s")
log("done")
