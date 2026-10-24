#!/bin/bash
# Aakhri Local EP3 end to end, unattended: stills (Kaggle + local) -> Kaggle LTX motion clips (each group launched as soon as
# its stills exist), while voices, MusicGen score and mix run locally -> final render. Re-runnable: every step skips finished work.
# bash ep03_pipeline.sh > ep03_pipeline.log 2>&1
set -u
R="C:/Users/Dell/Desktop/claude/aakhri-local/render"; EP="C:/Users/Dell/Desktop/claude/aakhri-local/ep03"
CPH="C:/Users/Dell/Desktop/claude/chai-pending-hai/render"; K="$CPH/kaggle_out"
log() { echo "$(date +%H:%M:%S) $*"; }
mkdir -p "$EP/shots_ai" "$EP/clips" "$EP/build"
kstatus() { (cd "$CPH" && timeout 90 node kaggle.js status "$1" 2>&1 | grep -o "status: '[a-z]*'" | cut -d"'" -f2); }
kpull() { (cd "$CPH" && timeout 900 node kaggle.js pull "$1" > /dev/null 2>&1) && log "pulled $1"; }

# 1+2. stills (10 from Kaggle al-ep03-k1..k5, 5 local) and, as soon as a group of 3 stills exists, its Kaggle LTX job
launched() { [ -f "$R/video/jobs/ltx3_$1.launched" ]; }
until launched a && launched b && launched c && launched d && launched e; do
  for k in k1 k2 k3 k4 k5; do [ -d "$K/al-ep03-$k/shots" ] || { [ "$(kstatus al-ep03-$k)" = complete ] && kpull al-ep03-$k; }; done
  cp -n "$K"/al-ep03-k*/shots/*.png "$EP/shots_ai/" 2>/dev/null
  node "$R/video/build_ltx_ep03.js" > /dev/null
  for k in a b c d e; do
    if [ -f "$R/video/jobs/ltx3_$k.json" ] && ! launched $k; then
      (cd "$CPH" && SHOTS="$R/video/jobs/ltx3_shots.json" bash anime/launch.sh anime/kg_ltx.py "al-ep03-ltx-$k" "$R/video/jobs/ltx3_$k.json" > /dev/null 2>&1 &)
      touch "$R/video/jobs/ltx3_$k.launched"; log "LTX job $k launched"; sleep 5
    fi
  done
  launched e || sleep 120
done
log "stills: $(ls "$EP/shots_ai"/*.png | wc -l)/15, all LTX jobs launched"

# 3. local audio while Kaggle works: cloned voices -> MusicGen score -> SFX + mix
export HF_HOME=/d/ai/hf PYTHONUNBUFFERED=1
MISSING=$(for id in e3_01 e3_02 e3_03 e3_04 e3_05; do [ -f "$EP/build/$id.raw.wav" ] || printf "%s," $id; done)
[ -z "$MISSING" ] || HF_HUB_OFFLINE=1 /d/ai/tts-env/Scripts/python.exe -u "$R/voice/chatter_ep03.py" "${MISSING%,}" 2>&1 | grep -E "^[0-9]{2}:"
[ -f "$EP/build/music_b.wav" ] || /d/ai/fastsdcpu/env/Scripts/python.exe -u "$R/voice/music_ep03.py" 2>&1 | grep -E "music_"
node "$R/edit/ep03_audio.js" && log "audio mixed"

# 4. wait for the clips; pull finished LTX jobs ourselves too (launch.sh's own wait can die on a network blip)
until [ $(ls "$EP/clips"/*.mp4 2>/dev/null | wc -l) -ge 15 ]; do
  for k in a b c d e; do [ -d "$K/al-ep03-ltx-$k/clips" ] || { [ "$(kstatus al-ep03-ltx-$k)" = complete ] && kpull al-ep03-ltx-$k; }; done
  cp -n "$K"/al-ep03-ltx-*/clips/*.mp4 "$EP/clips/" 2>/dev/null
  [ $(ls "$EP/clips"/*.mp4 2>/dev/null | wc -l) -ge 15 ] || sleep 300
done
log "clips: 15/15"
node "$R/edit/ep03_animatic.js" 60 2>&1 | grep -v "^frame"
log "EP3 DONE"
