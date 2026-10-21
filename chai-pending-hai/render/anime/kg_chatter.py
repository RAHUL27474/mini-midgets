# Kaggle job (GPU or CPU): emotional Hindi dialogue with Chatterbox Multilingual, cloned from real emotional human speech
# (AI4Bharat Rasa clips, CC BY 4.0, via the sumedhu/hindi-emotion-voice-references dataset). Every take is transcribed by
# Whisper with word timestamps (pronunciation score + subtitle timing) and gets a pitch-variation score (expressiveness proxy).
# Outputs /kaggle/working/voice/<id>_<take>.wav, voice/report.json, voice/refs/*.wav
import os, sys, json, re, subprocess, time, difflib, random, urllib.request, gc
os.environ.setdefault('HF_HOME', '/tmp/hf')
os.environ['USE_TF'] = '0'
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'chatterbox-tts'], check=True)
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchvision', 'torchao', 'torchcodec'])  # chatterbox pins torch 2.6; Kaggle's newer torchvision/torchcodec then fail to load
import torch, numpy as np, soundfile as sf, librosa
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from transformers import pipeline

V = json.loads(r'''__VOICE__''')
JOB = json.loads(r'''__JOB__''')  # {"ids": [...], "seeds": [0, 1], "refs_per_line": 2, "asr": "openai/whisper-medium"}
OUT = '/kaggle/working/voice'; os.makedirs(f'{OUT}/refs', exist_ok=True)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
torch.set_num_threads(os.cpu_count())
log = lambda *a: print(time.strftime('%H:%M:%S'), *a, flush=True)

# ---------- reference clips: real emotional speech per (speaker, emotion), 5-11 s long
DS = 'https://huggingface.co/datasets/sumedhu/hindi-emotion-voice-references'
def refs_for(gender, speaker, emotion, n):
    tree = json.load(urllib.request.urlopen(f'https://huggingface.co/api/datasets/sumedhu/hindi-emotion-voice-references/tree/main/hindi/{gender}/{emotion}'))
    names = sorted(x['path'] for x in tree if x['path'].split('/')[-1].startswith(speaker + '_'))
    random.Random(f'{speaker}{emotion}').shuffle(names)
    got = []
    for p in names[:12]:
        f = f"{OUT}/refs/{p.split('/')[-1]}"
        if not os.path.exists(f): urllib.request.urlretrieve(f'{DS}/resolve/main/{p}', f)
        y, sr = librosa.load(f, sr=None)
        if 5 <= len(y) / sr <= 11 and np.abs(y).max() > 0.1: got.append(f)
        if len(got) == n: break
    return got
REFS = {}

model = ChatterboxMultilingualTTS.from_pretrained(device=dev)
asr = pipeline('automatic-speech-recognition', model=JOB.get('asr', 'openai/whisper-medium'), device=dev)
norm = lambda s: re.sub(r'[^ऀ-ॿ]', '', s).replace('़', '')
cer = lambda a, b: 1 - difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()

def pitch_var(a, sr):
    f0 = librosa.yin(librosa.resample(a, orig_sr=sr, target_sr=16000), fmin=70, fmax=400, sr=16000)
    f0 = f0[(f0 > 72) & (f0 < 395)]
    return float(np.std(12 * np.log2(f0 / np.median(f0)))) if len(f0) > 10 else 0.0  # semitones

report = {}
for L in V['lines']:
    if JOB.get('ids') and L['id'] not in JOB['ids']: continue
    key = (L.get('ref_gender', 'male'), L['ref_speaker'], L['ref_emotion'])
    if key not in REFS: REFS[key] = refs_for(*key, JOB.get('refs_per_line', 2)); log('refs', key, [os.path.basename(r) for r in REFS[key]])
    k = 0
    for ref in REFS[key]:
        for seed in JOB.get('seeds', [0, 1]):
            torch.manual_seed(1000 + seed); t = time.time()
            with torch.inference_mode():  # keep no autograd state between takes; without this the CPU kernel ran out of RAM after ~15 takes
                wav = model.generate(L['text'], language_id='hi', audio_prompt_path=ref, exaggeration=L['exag'], cfg_weight=L['cfg'], temperature=0.8)
            a = wav.squeeze().cpu().float().numpy(); sf.write(f"{OUT}/{L['id']}_{k}.wav", a, model.sr)
            r = asr({'raw': a, 'sampling_rate': model.sr}, return_timestamps='word', generate_kwargs={'language': 'hindi', 'task': 'transcribe'})
            words = [{'w': c['text'].strip(), 's': c['timestamp'][0], 'e': c['timestamp'][1]} for c in r.get('chunks', [])]
            report[f"{L['id']}_{k}"] = {'cer': round(cer(L['text'], r['text']), 3), 'dur': round(len(a) / model.sr, 2), 'pitch_st': round(pitch_var(a, model.sr), 2),
                                        'ref': os.path.basename(ref), 'seed': seed, 'heard': r['text'], 'words': words}
            log(L['id'], k, {x: report[f"{L['id']}_{k}"][x] for x in ('cer', 'dur', 'pitch_st', 'ref')}, f'{time.time() - t:.0f}s')
            json.dump(report, open(f'{OUT}/report.json', 'w'), ensure_ascii=False, indent=1)
            k += 1
            del wav, a, r; gc.collect()
log('done')
