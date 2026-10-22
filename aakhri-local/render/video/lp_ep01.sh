#!/bin/bash
# Real facial motion on the CPU with LivePortrait (open source): blinks, head motion, expressions and mouth movement are
# transferred from a driving clip onto the face in each AI still, pasted back into the full frame -> ep01/clips/<id>.mp4.
# The animatic picks up ep01/clips automatically (they replace the parallax for those shots).
# bash lp_ep01.sh [s05 s07 ...]
set -u
EP="C:/Users/Dell/Desktop/claude/aakhri-local/ep01"
LP=/d/ai/LivePortrait; PY=/d/ai/lp-env/Scripts/python.exe
FF="C:/Users/Dell/Desktop/claude/chai-pending-hai/render/node_modules/ffmpeg-static/ffmpeg.exe"
# shot  driving-clip  seconds  multiplier   (talking shots get talking drivers; listening shots get calm ones)
PLAN="s05 d11 4.4 0.8
s07 d12 5.4 0.9
s08 d18 3.4 0.9
s10 d19 3.4 1.0
s13 d3 4.4 0.9
s14 d13 5.4 0.8"
WANT="${*:-}"
mkdir -p "$EP/clips" "$EP/build/lp"
export PATH="/d/ai/ffmpeg/ffmpeg-master-latest-win64-gpl/bin:$PATH"
cd "$LP"
echo "$PLAN" | while read -r id drv secs mul; do
  [ -n "$WANT" ] && [[ " $WANT " != *" $id "* ]] && continue
  t0=$(date +%s)
  "$FF" -y -loglevel error -i "assets/examples/driving/$drv.mp4" -t "$secs" -an "$EP/build/lp/$id-drv.mp4"
  "$PY" inference.py -s "$EP/shots_ai/$id.png" -d "$EP/build/lp/$id-drv.mp4" -o "$EP/build/lp/$id" \
    --flag_force_cpu --driving_option expression-friendly --driving_multiplier "$mul" > "$EP/build/lp/$id.log" 2>&1
  out=$(ls "$EP/build/lp/$id"/*.mp4 2>/dev/null | grep -v concat | head -1)
  if [ -n "$out" ]; then cp "$out" "$EP/clips/$id.mp4"; echo "$id ok $(( $(date +%s) - t0 ))s"; else echo "$id FAILED: $(tail -2 "$EP/build/lp/$id.log" | tr '\n' ' ' | cut -c1-200)"; fi
done
