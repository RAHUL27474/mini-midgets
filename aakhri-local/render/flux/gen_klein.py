# Local CPU image generation for Aakhri Local with FLUX.2-klein 4B (int4 OpenVINO, via FastSD CPU's pipeline class).
# python gen_klein.py <job.json> [id1,id2]
# job: {"model": dir, "width": 576, "height": 1024, "steps": 4,
#       "items": [{"id": "s01", "prompt": "...", "seed": 1, "refs": ["path.png"], "out": "path.png"}]}
# "refs" are reference images (character portraits) the model conditions on, which keeps faces consistent.
# The PC has ~6 GB free RAM, so the text encoder and the transformer never sit in memory together:
# all prompts are encoded first, the encoder is freed, then images are denoised one by one.
import gc, json, os, sys, time
sys.path.insert(0, r"D:\ai\fastsdcpu\src")
from PIL import Image
import torch
from backend.openvino.ov_flux2klein_pipeline import OVFlux2KleinPipeline

job = json.load(open(sys.argv[1], encoding="utf-8"))
only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)
items = [it for it in job["items"] if (not only or it["id"] in only) and (it.get("force") or not os.path.exists(it["out"]))]
if not items:
    log("nothing to do"); sys.exit(0)

t = time.time()
pipe = OVFlux2KleinPipeline.from_pretrained(job["model"], local_files_only=True, compile=False, ov_config={"CACHE_DIR": r"D:\ai\ovcache"}, device="CPU")
log("loaded", f"{time.time() - t:.0f}s")

embeds = {}
for it in items:
    t = time.time()
    with torch.no_grad():
        e = pipe.encode_prompt(prompt=it["prompt"], device=torch.device("cpu"))
    embeds[it["id"]] = e[0] if isinstance(e, tuple) else e
    log("encoded", it["id"], f"{time.time() - t:.0f}s")
for name in ("text_encoder",):
    part = getattr(pipe, name, None)
    if part is not None:
        for attr in ("request", "model"):
            if hasattr(part, attr):
                setattr(part, attr, None)
gc.collect()
log("text encoder freed")

W, H, STEPS = job.get("width", 576), job.get("height", 1024), job.get("steps", 4)
for it in items:
    os.makedirs(os.path.dirname(it["out"]), exist_ok=True)
    kw = dict(prompt_embeds=embeds[it["id"]], num_inference_steps=it.get("steps", STEPS), guidance_scale=1.0,
              width=it.get("width", W), height=it.get("height", H), generator=torch.Generator("cpu").manual_seed(it.get("seed", 1)))
    refs = [Image.open(r).convert("RGB") for r in it.get("refs", []) if os.path.exists(r)]
    if refs:
        kw["image"] = refs
    t = time.time()
    img = pipe(**kw).images[0]
    img.save(it["out"])
    log(it["id"], f"{time.time() - t:.0f}s", "refs" if refs else "", it["out"])
    gc.collect()
log("done")
