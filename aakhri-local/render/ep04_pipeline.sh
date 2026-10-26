#!/bin/bash
# Aakhri Local EP4 end to end, unattended: stills (Kaggle + local) -> Kaggle LTX motion clips (each group launched as soon as
# its stills exist), while voices, MusicGen score and mix run locally -> final render. Re-runnable: every step skips finished work.
# bash ep04_pipeline.sh > ep04_pipeline.log 2>&1
set -u
R="C:/Users/Dell/Desktop/claude/aakhri-local/render"; EP="C:/Users/Dell/Desktop/claude/aakhri-local/ep04"
CPH="C:/Users/Dell/Desktop/claude/chai-pending-hai/render"; K="$CPH/kaggle_out"
log() { echo "$(date +%H:%M:%S) $*"; }
mkdir -p "$EP/shots_ai" "$EP/clips" "$EP/build"
kstatus() { (cd "$CPH" && timeout 90 node kaggle.js status "$1" 2>&1 | grep -o "status: '[a-z]*'" | cut -d"'" -f2); }
kpull() { (cd "$CPH" && timeout 900 node kaggle.js pull "$1" > /dev/null 2>&1) && log "pulled $1"; }

# 1+2. stills (10 from Kaggle al-ep04-k1..k5, 5 local) and, as soon as a group of 3 stills exists, its Kaggle LTX job
launched() { [ -f "$R/video/jobs/ltx4_$1.launched" ]; }
until launched a && launched b && launched c && launched d && launched e; do
  for k in k1 k2 k3 k4 k5; do [ -d "$K/al-ep04-$k/shots" ] || { [ "$(kstatus al-ep04-$k)" = complete ] && kpull al-ep04-$k; }; done
  cp -n "$K"/al-ep04-k*/shots/*.png "$EP/shots_ai/" 2>/dev/null
  node "$R/video/build_ltx_ep04.js" > /dev/null
  for k in a b c d e; do
    if [ -f "$R/video/jobs/ltx4_$k.json" ] && ! launched $k; then
      (cd "$CPH" && SHOTS="$R/video/jobs/ltx4_shots.json" bash anime/launch.sh anime/kg_ltx.py "al-ep04-ltx-$k" "$R/video/jobs/ltx4_$k.json" > /dev/null 2>&1 &)
      touch "$R/video/jobs/ltx4_$k.launched"; log "LTX job $k launched"; sleep 5
    fi
  done
  launched e || sleep 120
done
log "stills: $(ls "$EP/shots_ai"/*.png | wc -l)/15, all LTX jobs launched"

# 3. local audio while Kaggle works: cloned voices -> MusicGen score -> SFX + mix
export HF_HOME=/d/ai/hf PYTHONUNBUFFERED=1
MISSING=$(for id in e4_01 e4_02 e4_03 e4_04 e4_05 e4_06 e4_07; do [ -f "$EP/build/$id.raw.wav" ] || printf "%s," $id; done)
[ -z "$MISSING" ] || HF_HUB_OFFLINE=1 /d/ai/tts-env/Scripts/python.exe -u "$R/voice/chatter_ep04.py" "${MISSING%,}" 2>&1 | grep -E "^[0-9]{2}:"
[ -f "$EP/build/music_a.wav" ] || /d/ai/fastsdcpu/env/Scripts/python.exe -u "$R/voice/music_regen.py" ep04 music_a "warm gentle Indian family drama film score, soft acoustic guitar and tender piano, rainy evening at home, nostalgic, clean studio recording" 1,2 2>&1 | grep -E "seed|kept"
[ -f "$EP/build/music_b.wav" ] || /d/ai/fastsdcpu/env/Scripts/python.exe -u "$R/voice/music_regen.py" ep04 music_b "emotional Indian film score, mournful bowed strings and soft piano, a mother remembering, grief and love, slowly swelling, clean studio recording" 1,2 2>&1 | grep -E "seed|kept"
HF_TOKEN=$(cat ~/.cache/huggingface/token) /d/ai/sa-env/Scripts/python.exe -u "$R/voice/sfx_gen.py" ep04 --batch "$R/voice/sfx_ep04.json" 2>&1 | grep -E "^(cooker|pour|tin|room|train|skip)"
node "$R/edit/ep04_audio.js" && log "audio mixed"

# 4. wait for the clips; pull finished LTX jobs ourselves too (launch.sh's own wait can die on a network blip)
until [ $(ls "$EP/clips"/*.mp4 2>/dev/null | wc -l) -ge 15 ]; do
  for k in a b c d e; do [ -d "$K/al-ep04-ltx-$k/clips" ] || { [ "$(kstatus al-ep04-ltx-$k)" = complete ] && kpull al-ep04-ltx-$k; }; done
  cp -n "$K"/al-ep04-ltx-*/clips/*.mp4 "$EP/clips/" 2>/dev/null
  [ $(ls "$EP/clips"/*.mp4 2>/dev/null | wc -l) -ge 15 ] || sleep 300
done
log "clips: 15/15"
node "$R/edit/ep04_animatic.js" 60 2>&1 | grep -v "^frame"
log "EP4 DONE"
