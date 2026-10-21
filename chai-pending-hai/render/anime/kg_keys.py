# Kaggle GPU job: anime keyframes for every shot with Animagine XL 4.0 (SDXL). Outputs /kaggle/working/keys/<id>_<seed>.png
import os, sys, json, subprocess, time
os.environ.setdefault('HF_HOME', '/tmp/hf')
os.environ['USE_TF'] = '0'
subprocess.run('nvidia-smi; df -h /tmp /kaggle/working', shell=True)
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchao'])  # Kaggle's old torchao breaks importing new diffusers
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.32', 'accelerate'], check=True)
import torch
from diffusers import StableDiffusionXLPipeline, AutoencoderKL, EulerAncestralDiscreteScheduler

P = json.loads(r'''__SHOTS__''')
JOB = json.loads(r'''__JOB__''')  # {"ids": [...] or [], "seeds": [...], "extra": {id: "extra tags"}}
OUT = '/kaggle/working/keys'; os.makedirs(OUT, exist_ok=True)

def prompt(s):
    p = s['img']
    for k, v in P['chars'].items(): p = p.replace('{' + k + '}', v)
    extra = JOB.get('extra', {}).get(s['id'], '')
    return ', '.join(x for x in [p, extra, P['grades'][s['grade']], P['style']] if x)

# runs on every GPU if there are any, otherwise on CPU (Kaggle CPU sessions start without a GPU queue)
DEVS = [f'cuda:{g}' for g in range(torch.cuda.device_count())] or ['cpu']
DT = torch.float16 if DEVS[0] != 'cpu' else torch.float32
torch.set_num_threads(os.cpu_count())
pipes = []
for dev in DEVS:
    pipe = StableDiffusionXLPipeline.from_pretrained('cagliostrolab/animagine-xl-4.0', vae=AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=DT),
                                                     torch_dtype=DT, use_safetensors=True, custom_pipeline='lpw_stable_diffusion_xl', add_watermarker=False)
    pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
    pipes.append(pipe.to(dev))
print('gpus', len(pipes), flush=True)

work = [(s, seed) for s in P['shots'] if not JOB.get('ids') or s['id'] in JOB['ids'] for seed in JOB['seeds']]
from concurrent.futures import ThreadPoolExecutor
def run(gi):
    pipe = pipes[gi]
    for i, (s, seed) in enumerate(work):
        if i % len(pipes) != gi: continue
        t = time.time()
        img = pipe(prompt=prompt(s), negative_prompt=P['negative'], width=768, height=1344, guidance_scale=5, num_inference_steps=JOB.get('steps', 28),
                   generator=torch.Generator('cpu').manual_seed(seed)).images[0]
        img.save(f"{OUT}/{s['id']}_{seed}.png")
        print(s['id'], seed, f'{time.time() - t:.1f}s', flush=True)
with ThreadPoolExecutor(len(pipes)) as ex: list(ex.map(run, range(len(pipes))))
json.dump({s['id']: prompt(s) for s in P['shots']}, open(f'{OUT}/prompts.json', 'w'), indent=1)
print('done')
