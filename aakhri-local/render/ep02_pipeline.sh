#!/bin/bash
# Aakhri Local EP2 end to end, unattended: stills (Kaggle + local) -> Kaggle LTX motion clips, while voices, MusicGen score and
# mix run locally -> final render. Re-runnable: every step skips work that is already done.
# bash ep02_pipeline.sh > ep02_pipeline.log 2>&1
set -u
R="C:/Users/Dell/Desktop/claude/aakhri-local/render"; EP="C:/Users/Dell/Desktop/claude/aakhri-local/ep02"
CPH="C:/Users/Dell/Desktop/claude/chai-pending-hai/render"; K="$CPH/kaggle_out"
log() { echo "$(date +%H:%M:%S) $*"; }
mkdir -p "$EP/shots_ai" "$EP/clips" "$EP/build"

# 1+2. stills (10 from Kaggle al-ep02-k1..k5, 5 local) and, as soon as a group of 3 stills exists, its Kaggle LTX motion job
launched() { [ -f "$R/video/jobs/ltx2_$1.launched" ]; }
until launched a && launched b && launched c && launched d && launched e; do
  cp -n "$K"/al-ep02-k*/shots/*.png "$EP/shots_ai/" 2>/dev/null
  node "$R/video/build_ltx_ep02.js" > /dev/null
  for k in a b c d e; do
    if [ -f "$R/video/jobs/ltx2_$k.json" ] && ! launched $k; then
      (cd "$CPH" && SHOTS="$R/video/jobs/ltx2_shots.json" bash anime/launch.sh anime/kg_ltx.py "al-ep02-ltx-$k" "$R/video/jobs/ltx2_$k.json" > /dev/null 2>&1 &)
      touch "$R/video/jobs/ltx2_$k.launched"; log "LTX job $k launched"; sleep 5
    fi
  done
  launched e || sleep 60
done
log "stills: $(ls "$EP/shots_ai"/*.png | wc -l)/15, all LTX jobs launched"

# 3. local audio while Kaggle works: cloned voices -> MusicGen score -> SFX + mix
export HF_HOME=/d/ai/hf PYTHONUNBUFFERED=1
[ -f "$EP/build/e2_08.raw.wav" ] || HF_HUB_OFFLINE=1 /d/ai/tts-env/Scripts/python.exe -u "$R/voice/chatter_ep02.py" 2>&1 | grep -E "^[0-9]{2}:"
[ -f "$EP/build/music_b.wav" ] || /d/ai/fastsdcpu/env/Scripts/python.exe -u "$R/voice/music_ep02.py" 2>&1 | grep -E "music_"
node "$R/edit/ep02_audio.js" && log "audio mixed"

# 4. wait for the clips, then render
until [ $(ls "$EP/clips"/*.mp4 2>/dev/null | wc -l) -ge 15 ]; do
  cp -n "$K"/al-ep02-ltx-*/clips/*.mp4 "$EP/clips/" 2>/dev/null
  sleep 120
done
log "clips: 15/15"
node "$R/edit/ep02_animatic.js" 60 2>&1 | grep -v "^frame"
log "EP2 DONE"
