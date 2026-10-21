# Kaggle GPU job: emotional Hindi dialogue with Indic Parler-TTS (several takes per line, each checked by Whisper) + MusicGen score.
# Outputs /kaggle/working/voice/<id>_<take>.wav, /kaggle/working/voice/report.json, /kaggle/working/music/<id>_<take>.wav
import os, sys, json, re, subprocess, time, difflib
os.environ.setdefault('HF_HOME', '/tmp/hf')
os.environ['USE_TF'] = '0'  # parler-tts downgrades protobuf, which breaks the preinstalled TensorFlow that transformers would import
subprocess.run('nvidia-smi', shell=True)
JOB = json.loads(r'''__JOB__''')  # {"takes": 4, "ids": [], "music_takes": 2, "skip_music": false, "music_only": false}
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'soundfile'] + ([] if JOB.get('music_only') else ['git+https://github.com/huggingface/parler-tts.git']), check=True)
import numpy as np, torch, soundfile as sf
from transformers import AutoTokenizer, pipeline

V = json.loads(r'''__VOICE__''')
os.makedirs('/kaggle/working/voice', exist_ok=True); os.makedirs('/kaggle/working/music', exist_ok=True)
dev = 'cuda:0' if torch.cuda.is_available() else 'cpu'
torch.set_num_threads(os.cpu_count())

if not JOB.get('music_only'): from parler_tts import ParlerTTSForConditionalGeneration
model = None if JOB.get('music_only') else ParlerTTSForConditionalGeneration.from_pretrained('ai4bharat/indic-parler-tts').to(dev)
if model is not None:
    tok = AutoTokenizer.from_pretrained('ai4bharat/indic-parler-tts')
    dtok = AutoTokenizer.from_pretrained('google/flan-t5-large')
SR = 44100

asr = None if JOB.get('music_only') else pipeline('automatic-speech-recognition', model=JOB.get('asr', 'openai/whisper-large-v3'), torch_dtype=torch.float16 if dev != 'cpu' else torch.float32, device='cuda:1' if torch.cuda.device_count() > 1 else dev)
norm = lambda s: re.sub(r'[^ऀ-ॿ]', '', s).replace('़', '')
def cer(a, b):
    a, b = norm(a), norm(b)
    return 1 - difflib.SequenceMatcher(None, a, b).ratio() if b else 1.0

report = {}
for L in ([] if JOB.get('music_only') else V['lines']):
    if JOB.get('ids') and L['id'] not in JOB['ids']: continue
    desc = f"{L['desc']} {V['clear']}"
    d = dtok(desc, return_tensors='pt').to(dev); p = tok(L['text'], return_tensors='pt').to(dev)
    for k in range(JOB.get('takes', 4)):
        torch.manual_seed(1000 + k)
        t = time.time()
        with torch.no_grad():
            a = model.generate(input_ids=d.input_ids, attention_mask=d.attention_mask, prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask,
                               do_sample=True, temperature=1.0).cpu().float().numpy().squeeze()
        f = f"/kaggle/working/voice/{L['id']}_{k}.wav"; sf.write(f, a, SR)
        heard = asr(f, generate_kwargs={'language': 'hindi', 'task': 'transcribe'})['text']
        report[f"{L['id']}_{k}"] = {'cer': round(cer(L['text'], heard), 3), 'dur': round(len(a) / SR, 2), 'heard': heard, 'peak': round(float(np.abs(a).max()), 3)}
        print(L['id'], k, report[f"{L['id']}_{k}"], f'{time.time() - t:.0f}s', flush=True)
if report: json.dump(report, open('/kaggle/working/voice/report.json', 'w'), ensure_ascii=False, indent=1)
del model; torch.cuda.empty_cache()

if not JOB.get('skip_music'):
    from transformers import MusicgenForConditionalGeneration, AutoProcessor
    proc = AutoProcessor.from_pretrained('facebook/musicgen-medium')
    mg = MusicgenForConditionalGeneration.from_pretrained('facebook/musicgen-medium', torch_dtype=torch.float16 if dev != 'cpu' else torch.float32).to(dev)
    msr = mg.config.audio_encoder.sampling_rate
    for M in [m for m in V['music'] if not JOB.get('music_ids') or m['id'] in JOB['music_ids']]:
        for k in range(JOB.get('music_takes', 2)):
            torch.manual_seed(2000 + k)
            x = proc(text=[M['prompt']], padding=True, return_tensors='pt').to(dev)
            with torch.no_grad():
                a = mg.generate(**x, do_sample=True, guidance_scale=3.0, max_new_tokens=int(M['secs'] * 50) + 10)
            sf.write(f"/kaggle/working/music/{M['id']}_{k}.wav", a[0, 0].float().cpu().numpy(), msr)
            print('music', M['id'], k, flush=True)
print('done')
