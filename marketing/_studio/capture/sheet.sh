#!/bin/bash
# Contact sheet of a take: capture/sheet.sh <slug> <take> [frames=10] -> scratch png path printed
f=".cache/footage/$1/$2.mp4"; n=${3:-10}
d=$(/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
out="${SHEET_DIR:-/private/tmp/claude-501/-Users-savahristov-Desktop-WebGames-1/ddb73eb8-ef0d-4002-a111-b3a2c66554bd/scratchpad}/sheet-$1-$2.png"
/opt/homebrew/bin/ffmpeg -loglevel error -y -i "$f" -vf "fps=$n/$d,scale=216:-1,tile=${n}x1" -frames:v 1 "$out"
echo "$out ($d s)"
