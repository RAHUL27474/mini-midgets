# Canva-cut copy of anime/kg_ltx.py, tuned for a 16 GB T4: model CPU offload, expandable CUDA segments, cache cleared per shot.
# Kaggle job (GPU or CPU): keyframe -> LTX-Video 2B distilled (8 steps) anime clip -> Real-ESRGAN animevideov3 -> RIFE 4.7 retime to 60fps -> 1080x1920 H.264.
# Outputs /kaggle/working/clips/<id>.mp4 (final) and /kaggle/working/raw/<id>.mp4 (LTX output).
import os, sys, json, glob, math, time, subprocess, base64, io, gc, traceback
os.environ.setdefault('HF_HOME', '/tmp/hf')
os.environ['USE_TF'] = '0'
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
subprocess.run('nvidia-smi; nproc; free -g; df -h /tmp', shell=True)
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchao'])  # Kaggle's old torchao breaks importing new diffusers
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.34', 'transformers', 'accelerate', 'sentencepiece', 'imageio-ffmpeg'], check=True)
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from PIL import Image

P = json.loads(r'''__SHOTS__''')
JOB = json.loads(r'''__JOB__''')  # {"ids": [...], "picks": {id: file}, "inline": {id: base64 jpg}, "w": 512, "h": 896, "seed": 42, "max_frames": 121}
DEV = 'cuda' if torch.cuda.is_available() else 'cpu'
DT = torch.bfloat16 if DEV == 'cuda' else torch.float32
torch.set_num_threads(os.cpu_count())
W, H, FPS_SRC, FPS, OUT_W, OUT_H = JOB.get('w', 512), JOB.get('h', 896), 24, 60, 1080, 1920
for d in ('clips', 'raw'): os.makedirs(f'/kaggle/working/{d}', exist_ok=True)
import imageio_ffmpeg; FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SHOTS = [s for s in P['shots'] if s['id'] in JOB['ids']]
log = lambda *a: print(time.strftime('%H:%M:%S'), *a, flush=True)
log('device', DEV, 'shots', [s['id'] for s in SHOTS])

def keyframe(s):
    if s['id'] in JOB.get('inline', {}): im = Image.open(io.BytesIO(base64.b64decode(JOB['inline'][s['id']])))
    else: im = Image.open(glob.glob(f"/kaggle/input/**/{JOB['picks'][s['id']]}", recursive=True)[0])
    im = im.convert('RGB'); sc = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((l, t, l + W, t + H))

STYLE = 'Japanese 2D anime film, hand-drawn cel animation, clean lineart, soft cel shading, smooth natural motion, consistent character design.'

# ---------- 1. prompt embeddings with T5 (then freed, so the transformer fits in RAM)
from transformers import T5EncoderModel, T5TokenizerFast
BASE = 'Lightricks/LTX-Video-0.9.5'
tok = T5TokenizerFast.from_pretrained(BASE, subfolder='tokenizer')
te = T5EncoderModel.from_pretrained(BASE, subfolder='text_encoder', torch_dtype=torch.bfloat16).to(DEV)
EMB = {}
for s in SHOTS:
    x = tok([f"{s['motion']}. {STYLE}"], padding='max_length', max_length=128, truncation=True, add_special_tokens=True, return_tensors='pt')
    with torch.no_grad(): e = te(x.input_ids.to(DEV), attention_mask=x.attention_mask.to(DEV))[0]
    EMB[s['id']] = (e.float().cpu(), x.attention_mask)
del te; gc.collect(); torch.cuda.empty_cache()
log('embeddings ready')

# ---------- 2. LTX-Video 2B distilled
from diffusers import LTXConditionPipeline, LTXVideoTransformer3DModel, AutoencoderKLLTXVideo, FlowMatchEulerDiscreteScheduler
from diffusers.pipelines.ltx.pipeline_ltx_condition import LTXVideoCondition
pipe = None
for ck in JOB.get('ckpts', ['ltxv-2b-0.9.8-distilled.safetensors', 'ltxv-2b-0.9.6-distilled-04-25.safetensors']):
    try:
        url = f'https://huggingface.co/Lightricks/LTX-Video/blob/main/{ck}'
        tr = LTXVideoTransformer3DModel.from_single_file(url, torch_dtype=DT)
        vae = AutoencoderKLLTXVideo.from_single_file(url, torch_dtype=DT)
        pipe = LTXConditionPipeline(scheduler=FlowMatchEulerDiscreteScheduler.from_pretrained(BASE, subfolder='scheduler'), vae=vae, text_encoder=None, tokenizer=None, transformer=tr)
        pipe.enable_model_cpu_offload() if DEV == 'cuda' else pipe.to(DEV)
        log('loaded', ck); break
    except Exception:
        traceback.print_exc(); sys.stdout.flush()
pipe.vae.enable_tiling()

# ---------- 3. post: Real-ESRGAN animevideov3 x4 + RIFE 4.7
subprocess.run('git clone -q --depth 1 https://github.com/Fannovel16/ComfyUI-Frame-Interpolation /tmp/cfi', shell=True)
os.makedirs('/tmp/stub/comfy', exist_ok=True); open('/tmp/stub/comfy/__init__.py', 'w').close()
open('/tmp/stub/comfy/model_management.py', 'w').write("import torch\ndef get_torch_device(): return torch.device('cuda' if torch.cuda.is_available() else 'cpu')\ndef soft_empty_cache(*a, **k): pass\n")
sys.path[:0] = ['/tmp/stub', '/tmp/cfi/vfi_models/rife']
import rife_arch
for url, dst in [('https://huggingface.co/marduk191/rife/resolve/main/rife47.pth', '/tmp/rife47.pth'),
                 ('https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-animevideov3.pth', '/tmp/animev3.pth')]:
    if not os.path.exists(dst): subprocess.run(['wget', '-q', '-O', dst, url], check=True)

class SRVGGNetCompact(nn.Module):
    def __init__(self, nf=64, nc=16, up=4):
        super().__init__()
        self.up = up
        b = [nn.Conv2d(3, nf, 3, 1, 1), nn.PReLU(nf)]
        for _ in range(nc): b += [nn.Conv2d(nf, nf, 3, 1, 1), nn.PReLU(nf)]
        b += [nn.Conv2d(nf, 3 * up * up, 3, 1, 1)]
        self.body = nn.ModuleList(b); self.ps = nn.PixelShuffle(up)
    def forward(self, x):
        o = x
        for l in self.body: o = l(o)
        return self.ps(o) + F.interpolate(x, scale_factor=self.up, mode='nearest')
rife = rife_arch.IFNet(arch_ver='4.7'); rife.load_state_dict(torch.load('/tmp/rife47.pth', map_location='cpu', weights_only=False)); rife.eval().to(DEV)
sr = SRVGGNetCompact(); sd = torch.load('/tmp/animev3.pth', map_location='cpu'); sr.load_state_dict(sd.get('params', sd)); sr.eval().to(DEV)

@torch.no_grad()
def finish(frames, dur, out):
    """frames: float np [F,H,W,3] 0..1 at 24fps -> upscale each to 1080x1920 -> RIFE to 60fps -> mp4 of exactly dur seconds."""
    up = []
    for f in frames:
        x = torch.from_numpy(f).permute(2, 0, 1)[None].float().to(DEV)
        y = sr(x)
        up.append(F.interpolate(y, size=(OUT_H, OUT_W), mode='bicubic', antialias=True).clamp(0, 1).cpu())
    Fn, N = len(up), round(dur * FPS)
    natural = (Fn - 1) >= dur * FPS_SRC
    enc = subprocess.Popen([FFMPEG, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OUT_W}x{OUT_H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for i in range(N):
        ts = i * FPS_SRC / FPS if natural else i * (Fn - 1) / max(1, N - 1)
        a = min(int(ts), Fn - 1); fr = ts - a
        if fr < 1e-3 or a + 1 >= Fn: y = up[a]
        elif fr > 1 - 1e-3: y = up[a + 1]
        else: y = rife(up[a].to(DEV), up[a + 1].to(DEV), torch.tensor([fr], device=DEV).view(-1, 1, 1, 1), [16, 8, 4, 2], True, True)[:, :, :OUT_H, :OUT_W].clamp(0, 1).cpu()
        enc.stdin.write((y[0].permute(1, 2, 0) * 255).round().byte().numpy().tobytes())
    enc.stdin.close(); enc.wait()

from diffusers.utils import export_to_video
for s in SHOTS:
    try:
        gc.collect(); torch.cuda.empty_cache(); t0 = time.time()
        nf = min(JOB.get('max_frames', 121), 8 * math.ceil((s['dur'] * FPS_SRC + 4) / 8) + 1)
        e, m = EMB[s['id']]
        out = pipe(conditions=[LTXVideoCondition(image=keyframe(s), frame_index=0)], prompt_embeds=e.to(DEV, DT), prompt_attention_mask=m.to(DEV),
                   width=W, height=H, num_frames=nf, timesteps=[1000, 993, 987, 981, 975, 909, 725, 0.03], guidance_scale=1.0,
                   decode_timestep=0.05, decode_noise_scale=0.025, image_cond_noise_scale=0.0,
                   generator=torch.Generator('cpu').manual_seed(JOB.get('seed', 42)), output_type='np').frames[0]
        export_to_video(list(out), f"/kaggle/working/raw/{s['id']}.mp4", fps=FPS_SRC)
        t1 = time.time(); log(s['id'], f'ltx {nf} frames {t1 - t0:.0f}s')
        finish(out, s['dur'], f"/kaggle/working/clips/{s['id']}.mp4")
        log(s['id'], f'post {time.time() - t1:.0f}s')
    except Exception:
        traceback.print_exc(); sys.stdout.flush()
subprocess.run('ls -la /kaggle/working/clips /kaggle/working/raw', shell=True)
log('done')
