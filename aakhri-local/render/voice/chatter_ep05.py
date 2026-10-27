# Aakhri Local EP5 voices on the local CPU: Chatterbox Multilingual cloned from real emotional Hindi/Urdu speech
# (AI4Bharat Rasa clips, CC BY 4.0, via sumedhu/hindi-emotion-voice-references). Two takes per line; the take whose length is
# closest to the expected delivery wins. Overwrites ep05/build/<id>.wav and ep05/build/voice.json.
# D:\ai\tts-env\Scripts\python.exe chatter_ep05.py
import json, os, sys, time, urllib.request
import numpy as np, soundfile as sf, torch
import perth
if perth.PerthImplicitWatermarker is None:  # its native extension doesn't load on this Windows setup; the watermark is optional
    perth.PerthImplicitWatermarker = perth.DummyWatermarker
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

B = os.path.join(os.path.dirname(__file__), "..", "..", "ep05", "build")
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
SUDHA_REF = r"D:\ai\voice_refs\SUDHA_REF.wav"
LINES = [
    ("e5_01", "oldman", "इतनी बड़ी हो गई...", ("male", "sad", "URD_M", 2), 0.6, 0.35, 2.0),
    ("e5_02", "oldman", "जीती रहो, बेटा।", ("male", "sad", "URD_M", 2), 0.45, 0.4, 1.6),
    ("e5_03", "meera", "अब तो नाम बता दीजिए।", ("female", "sad", "URD_F", 3), 0.55, 0.45, 2.0),
    ("e5_04", "oldman", "रघुनाथ जोशी। मास्टर था... बच्चों को पढ़ाता था।", ("male", "sad", "URD_M", 2), 0.45, 0.4, 3.6),
    ("e5_05", "meera", "शुक्रिया, रघुनाथ जी... माँ के लिए, मेरे लिए।", ("female", "sad", "URD_F", 3), 0.65, 0.4, 3.4),
    ("e5_06", "oldman", "अब घर जा सकता हूँ।", ("male", "sad", "URD_M", 2), 0.4, 0.4, 2.0),
]
only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
torch.set_num_threads(os.cpu_count())
t = time.time(); model = ChatterboxMultilingualTTS.from_pretrained(device="cpu"); log("model loaded", f"{time.time() - t:.0f}s")
meta = {m["id"]: m for m in json.load(open(os.path.join(B, "voice.json"), encoding="utf-8"))} if os.path.exists(os.path.join(B, "voice.json")) else {}
for lid, char, text, r, exag, cfg, exp in LINES:
    if only and lid not in only: continue
    rp = r if isinstance(r, str) else ref(*r); best = None
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
