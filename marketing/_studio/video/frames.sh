#!/bin/bash
# Contact sheet of chosen seconds of a rendered video: video/frames.sh file.mp4 out.png 0.5 2 4 ...
f="$1"; out="$2"; shift 2; ins=""; n=0
for t in "$@"; do /opt/homebrew/bin/ffmpeg -loglevel error -y -ss "$t" -i "$f" -frames:v 1 -vf "scale=300:-1" "/tmp/_fr_$n.png"; ins="$ins -i /tmp/_fr_$n.png"; n=$((n+1)); done
/opt/homebrew/bin/ffmpeg -loglevel error -y $ins -filter_complex "hstack=inputs=$n" "$out"; rm -f /tmp/_fr_*.png
