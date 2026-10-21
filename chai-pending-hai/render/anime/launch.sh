#!/bin/bash
# Runs one Kaggle CPU job, retrying while the account is at its concurrent-session limit; progress lines go to anime/build/cpu_runs.log.
# usage: [SHOTS=anime/epNN/shots.json VOICE=anime/epNN/voice.json] anime/launch.sh <script.py> <slug> <job.json> [extra --sub args]
cd "$(dirname "$0")/.."
script=$1 slug=$2 job=$3; shift 3
export KAGGLE_GPU=${KAGGLE_GPU:-none}
L=anime/build/cpu_runs.log T=anime/build/$slug.try
while :; do
  node kaggle.js run "$script" "$slug" --sub SHOTS=${SHOTS:-anime/shots.json} --sub VOICE=${VOICE:-anime/voice.json} --sub JOB="$job" "$@" > "$T" 2>&1
  rc=$?
  grep -q "session count" "$T" && { sleep 90; continue; }
  sed "s/^/[$slug] /" "$T" >> "$L"; exit $rc
done
