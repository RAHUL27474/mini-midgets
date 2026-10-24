# Aakhri Local EP3 voices on the local CPU: Chatterbox Multilingual cloned from real emotional Hindi/Urdu speech
# (AI4Bharat Rasa clips, CC BY 4.0, via sumedhu/hindi-emotion-voice-references). Two takes per line; the take whose length is
# closest to the expected delivery wins. Overwrites ep03/build/<id>.wav and ep03/build/voice.json.
# D:\ai\tts-env\Scripts\python.exe chatter_ep03.py
import json, os, sys, time, urllib.request
import numpy as np, soundfile as sf, torch
import perth
if perth.PerthImplicitWatermarker is None:  # its native extension doesn't load on this Windows setup; the watermark is optional
    perth.PerthImplicitWatermarker = perth.DummyWatermarker
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

B = os.path.join(os.path.dirname(__file__), "..", "..", "ep03", "build")
REFDIR = r"D:\ai\voice_refs"; os.makedirs(REFDIR, exist_ok=True)
DS = "https://huggingface.co/datasets/sumedhu/hindi-emotion-voice-references"
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)

def ref(gender, emotion, prefix, n=0):
    tree = json.load(urllib.request.urlopen(f"https://huggingface.co/api/datasets/sumedhu/hindi-emotion-voice-references/tree/main/hindi/{gender}/{emotion}"))
    names = sorted(x["path"] for x in tree if os.path.basename(x["path"]).startswith(prefix) and 600_000 < x.get("size", 0) < 1_500_000)
    p = names[n]; out = os.path.join(REFDIR, os.path.basename(p))
    if not os.path.exists(out): urllib.request.urlretrieve(f"{DS}/resolve/main/{p}", out)
    return out

# id, char, text, (gender, emotion, speaker prefix, ref index), exaggeration, cfg, expected seconds
LINES = [
    ("e3_01", "clerk", "पचहत्तर? इतना पुराना कौन माँगता है...", ("male", "anger", "HIN_M", 5), 0.35, 0.5, 2.6),
    ("e3_02", "clerk", "चौदह जुलाई... आख़िरी लोकल। आग लगी थी।", ("male", "sad", "HIN_M", 4), 0.45, 0.4, 3.0),
    ("e3_05", "woman", "सुधा...!", ("female", "fear", "URD_F", 6), 0.8, 0.4, 0.9),
    ("e3_03", "meera", "ये... वही हैं।", ("female", "sad", "URD_F", 3), 0.55, 0.45, 1.6),
    ("e3_04", "meera", "सुधा कुलकर्णी... माँ?", ("female", "surprise", "URD_F", 1), 0.6, 0.45, 2.2),
]
only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
torch.set_num_threads(os.cpu_count())
t = time.time(); model = ChatterboxMultilingualTTS.from_pretrained(device="cpu"); log("model loaded", f"{time.time() - t:.0f}s")
meta = {m["id"]: m for m in json.load(open(os.path.join(B, "voice.json"), encoding="utf-8"))} if os.path.exists(os.path.join(B, "voice.json")) else {}
for lid, char, text, r, exag, cfg, exp in LINES:
    if only and lid not in only: continue
    rp = ref(*r); best = None
    for seed in ([int(x) for x in os.environ["SEEDS"].split(",")] if os.environ.get("SEEDS") else (1, 2, 3) if exp < 1.5 else (1, 2)):  # SEEDS=3,4,5 for fresh takes
        torch.manual_seed(seed); t = time.time()
        wav = model.generate(text, language_id="hi", audio_prompt_path=rp, exaggeration=exag, cfg_weight=cfg, temperature=0.8)
        a = wav.squeeze().cpu().numpy(); dur = len(a) / model.sr
        log(lid, "take", seed, f"{dur:.2f}s", f"(gen {time.time() - t:.0f}s)")
        if best is None or abs(dur - exp) < abs(best[1] - exp): best = (a, dur)  # closest to the expected delivery
    a = best[0] / max(1e-6, np.abs(best[0]).max()) * 0.9
    sf.write(os.path.join(B, f"{lid}.raw.wav"), a, model.sr)
    meta[lid] = {"id": lid, "char": char, "text": text, "dur": round(best[1], 2), "ref": os.path.basename(rp)}
json.dump(list(meta.values()), open(os.path.join(B, "voice.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
log("done")
