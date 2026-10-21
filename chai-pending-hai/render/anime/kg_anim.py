# Kaggle GPU job: keyframe -> Wan 2.2 TI2V-5B anime clip (24fps, 704x1280) -> RIFE 4.7 retime to 60fps -> Real-ESRGAN animevideov3 -> 1080x1920 H.264.
# Outputs /kaggle/working/clips/<id>.mp4 (final) and /kaggle/working/raw/<id>.mp4 (Wan output).
import os, sys, json, glob, math, time, subprocess, threading, traceback
os.environ.setdefault('HF_HOME', '/tmp/hf')
os.environ['USE_TF'] = '0'
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
subprocess.run('nvidia-smi; df -h /tmp /kaggle/working; free -g; which ffmpeg', shell=True)
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchao'])  # Kaggle's old torchao breaks importing new diffusers
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.35', 'transformers', 'accelerate', 'ftfy', 'imageio-ffmpeg'], check=True)
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from PIL import Image

P = json.loads(r'''__SHOTS__''')
JOB = json.loads(r'''__JOB__''')  # {"picks": {id: "s01_3.png"}, "ids": [...], "steps": 30, "cfg": 5.0, "seed": 42}
W, H, FPS_SRC, FPS = 704, 1280, 24, 60
OUT_W, OUT_H = 1080, 1920
for d in ('clips', 'raw'): os.makedirs(f'/kaggle/working/{d}', exist_ok=True)
FFMPEG = subprocess.run('which ffmpeg', shell=True, capture_output=True, text=True).stdout.strip()
if not FFMPEG:
    import imageio_ffmpeg; FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SHOTS = [s for s in P['shots'] if s['id'] in JOB['ids']]
NG = torch.cuda.device_count()
print('gpus', NG, 'shots', [s['id'] for s in SHOTS], flush=True)

def find(name):
    hits = glob.glob(f'/kaggle/input/**/{name}', recursive=True)
    if not hits: raise FileNotFoundError(name)
    return hits[0]

def keyframe(s):
    im = Image.open(find(JOB['picks'][s['id']])).convert('RGB')
    sc = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((l, t, l + W, t + H))

def nframes(dur):  # Wan wants 4k+1 frames; cap at 121 (5s)
    return min(121, 4 * math.ceil((dur * FPS_SRC + 4) / 4) + 1)

STYLE = 'anime style, 2D hand-drawn animation, cel shading, smooth natural motion, consistent character, high quality anime film'

# ---------- 1. text embeddings once (UMT5-XXL), so each GPU only holds the transformer ----------
from transformers import AutoTokenizer, UMT5EncoderModel
REPO = 'Wan-AI/Wan2.2-TI2V-5B-Diffusers'
tok = AutoTokenizer.from_pretrained(REPO, subfolder='tokenizer')
te_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float32
te = UMT5EncoderModel.from_pretrained(REPO, subfolder='text_encoder', torch_dtype=te_dtype).to('cuda:0' if te_dtype == torch.bfloat16 else 'cpu')
def embed(text):
    ids = tok([text], padding='max_length', max_length=512, truncation=True, add_special_tokens=True, return_attention_mask=True, return_tensors='pt')
    n = int(ids.attention_mask.sum())
    with torch.no_grad():
        e = te(ids.input_ids.to(te.device), ids.attention_mask.to(te.device)).last_hidden_state[0, :n].float().cpu()
    return torch.cat([e, e.new_zeros(512 - n, e.shape[1])])[None]
neg = embed(P['motion_negative'])
EMB = {s['id']: embed(f"{s['motion']}. {STYLE}") for s in SHOTS}
del te; torch.cuda.empty_cache(); import gc; gc.collect()
print('embeddings ready', flush=True)

# ---------- 2. RIFE 4.7 + Real-ESRGAN animevideov3 ----------
subprocess.run('git clone -q --depth 1 https://github.com/Fannovel16/ComfyUI-Frame-Interpolation /tmp/cfi', shell=True)
os.makedirs('/tmp/stub/comfy', exist_ok=True)
open('/tmp/stub/comfy/__init__.py', 'w').close()
open('/tmp/stub/comfy/model_management.py', 'w').write("import torch\ndef get_torch_device(): return torch.device('cuda')\ndef soft_empty_cache(*a, **k): torch.cuda.empty_cache()\n")
sys.path[:0] = ['/tmp/stub', '/tmp/cfi/vfi_models/rife']
import rife_arch
def dl(url, dst):
    if not os.path.exists(dst): subprocess.run(['wget', '-q', '-O', dst, url], check=True)
    return dst
dl('https://huggingface.co/marduk191/rife/resolve/main/rife47.pth', '/tmp/rife47.pth')
dl('https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-animevideov3.pth', '/tmp/animev3.pth')

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

def load_post(dev):
    rife = rife_arch.IFNet(arch_ver='4.7'); rife.load_state_dict(torch.load('/tmp/rife47.pth', map_location='cpu', weights_only=False)); rife.eval().to(dev)
    sr = SRVGGNetCompact(); sd = torch.load('/tmp/animev3.pth', map_location='cpu'); sr.load_state_dict(sd.get('params', sd)); sr.eval().half().to(dev)
    return rife, sr

@torch.no_grad()
def finish(frames, dur, dev, rife, sr, out):
    """frames: float np [F,H,W,3] 0..1 at 24fps -> 60fps 1080x1920 mp4 of exactly dur seconds."""
    Fn, N = len(frames), round(dur * FPS)
    natural = (Fn - 1) >= dur * FPS_SRC
    enc = subprocess.Popen([FFMPEG, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OUT_W}x{OUT_H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    T = lambda i: torch.from_numpy(frames[i]).permute(2, 0, 1)[None].float().to(dev)
    for i in range(N):
        ts = i * FPS_SRC / FPS if natural else i * (Fn - 1) / max(1, N - 1)
        a = min(int(ts), Fn - 1); fr = ts - a
        if fr < 1e-3 or a + 1 >= Fn: x = T(a)
        elif fr > 1 - 1e-3: x = T(a + 1)
        else: x = rife(T(a), T(a + 1), torch.tensor([fr], device=dev).view(-1, 1, 1, 1), [8, 4, 2, 1], True, True)[:, :, :H, :W].clamp(0, 1)
        y = sr(x.half()).float()
        y = F.interpolate(y, size=(OUT_H, OUT_W), mode='bicubic', antialias=True).clamp(0, 1)
        enc.stdin.write((y[0].permute(1, 2, 0) * 255).round().byte().cpu().numpy().tobytes())
    enc.stdin.close(); enc.wait()

# ---------- 3. Wan 2.2 TI2V-5B on every GPU ----------
from diffusers import WanImageToVideoPipeline, AutoencoderKLWan
from diffusers.utils import export_to_video
load_lock = threading.Lock()
def worker(g):
    dev = f'cuda:{g}'
    with load_lock:
        vae = AutoencoderKLWan.from_pretrained(REPO, subfolder='vae', torch_dtype=torch.float32)
        pipe = WanImageToVideoPipeline.from_pretrained(REPO, vae=vae, text_encoder=None, tokenizer=None, torch_dtype=torch.float16).to(dev)
        pipe.vae.enable_tiling()
        rife, sr = load_post(dev)
        gc.collect()
    print(dev, 'loaded', flush=True)
    for i, s in enumerate(SHOTS):
        if i % NG != g: continue
        try:
            t0 = time.time(); nf = nframes(s['dur'])
            out = pipe(image=keyframe(s), prompt_embeds=EMB[s['id']].to(dev, torch.float16), negative_prompt_embeds=neg.to(dev, torch.float16),
                       height=H, width=W, num_frames=nf, num_inference_steps=JOB.get('steps', 30), guidance_scale=JOB.get('cfg', 5.0),
                       generator=torch.Generator(dev).manual_seed(JOB.get('seed', 42)), output_type='np').frames[0]
            if not np.isfinite(out).all() or out.max() < 0.02: print(s['id'], 'WARNING: NaN/black output', flush=True)
            export_to_video(list(out), f"/kaggle/working/raw/{s['id']}.mp4", fps=FPS_SRC)
            t1 = time.time()
            finish(out, s['dur'], dev, rife, sr, f"/kaggle/working/clips/{s['id']}.mp4")
            print(s['id'], f'frames {nf} wan {t1 - t0:.0f}s post {time.time() - t1:.0f}s', flush=True)
            torch.cuda.empty_cache()
        except Exception:
            traceback.print_exc(); sys.stdout.flush()
ths = [threading.Thread(target=worker, args=(g,)) for g in range(NG)]
for t in ths: t.start()
for t in ths: t.join()
subprocess.run('ls -la /kaggle/working/clips /kaggle/working/raw', shell=True)
print('done')
