# Kaggle job (GPU or CPU): character-consistent anime keyframes. Animagine XL 4.0 + IP-Adapter (SDXL, ViT-H) conditioned on a
# reference image per item, so a character's face and the series art style carry across shots and episodes.
# Outputs /kaggle/working/keys/<id>_<seed>.png
import os, sys, json, subprocess, time, base64, io
os.environ.setdefault('HF_HOME', '/tmp/hf')
os.environ['USE_TF'] = '0'
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchao'])  # Kaggle's old torchao breaks importing new diffusers
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.32', 'accelerate', 'transformers'], check=True)
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline, AutoencoderKL, EulerAncestralDiscreteScheduler
from transformers import CLIPVisionModelWithProjection

JOB = json.loads(r'''__JOB__''')
# {"refs": {name: base64 jpg}, "negative": "...", "steps": 24,
#  "items": [{"id": "s02", "prompt": "...", "face": "kabir", "face_scale": 0.6, "style": "night", "style_scale": 0.4, "seeds": [1, 2]}]}
# face = identity reference (plus-face adapter), style = art-style/lighting reference (plus adapter); either may be omitted.
# Legacy items {"ref", "adapter": "face" | "style", "scale"} still work.
OUT = '/kaggle/working/keys'; os.makedirs(OUT, exist_ok=True)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
DT = torch.float16 if dev == 'cuda' else torch.float32
torch.set_num_threads(os.cpu_count())
log = lambda *a: print(time.strftime('%H:%M:%S'), *a, flush=True)
REFS = {k: Image.open(io.BytesIO(base64.b64decode(v))).convert('RGB') for k, v in JOB['refs'].items()}

enc = CLIPVisionModelWithProjection.from_pretrained('h94/IP-Adapter', subfolder='models/image_encoder', torch_dtype=DT)
pipe = StableDiffusionXLPipeline.from_pretrained('cagliostrolab/animagine-xl-4.0', image_encoder=enc, torch_dtype=DT, use_safetensors=True, add_watermarker=False,
                                                 vae=AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=DT))
pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
# "face" copies identity (plus-face), "style" copies the overall look (plus); both ViT-H, loaded once, one active per item
pipe.load_ip_adapter('h94/IP-Adapter', subfolder='sdxl_models', weight_name=['ip-adapter-plus-face_sdxl_vit-h.safetensors', 'ip-adapter-plus_sdxl_vit-h.safetensors'], image_encoder_folder=None)
pipe.to(dev)
log('loaded on', dev)

for it in JOB['items']:
    if 'ref' in it: it = {**it, it.get('adapter', 'face'): it['ref'], it.get('adapter', 'face') + '_scale': it.get('scale', 0.6)}
    face, style = REFS.get(it.get('face')), REFS.get(it.get('style'))
    pipe.set_ip_adapter_scale([it.get('face_scale', 0.6) if face else 0.0, it.get('style_scale', 0.4) if style else 0.0])
    imgs = [face or style, style or face]
    for seed in it.get('seeds', [1, 2]):
        t = time.time()
        img = pipe(prompt=it['prompt'], negative_prompt=JOB['negative'], ip_adapter_image=imgs, width=768, height=1344, guidance_scale=5,
                   num_inference_steps=JOB.get('steps', 24), generator=torch.Generator('cpu').manual_seed(seed)).images[0]
        img.save(f"{OUT}/{it['id']}_{seed}.png")
        log(it['id'], seed, f'{time.time() - t:.0f}s')
log('done')
