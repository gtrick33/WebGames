#!/bin/zsh
# Rows of stills, one row per "<shot>:<in>:<dur>", six tiles a row: a close look at chosen moments.
#   ./strips.sh <out name> shot:in:dur [shot:in:dur ...]
here=${0:a:h}; out=$here/.cache/look/sheets/$1.jpg; shift
ins=(); n=0
for spec in "$@"; do
  s=${spec%%:*}; rest=${spec#*:}; a=${rest%%:*}; d=${rest#*:}
  /opt/homebrew/bin/ffmpeg -y -loglevel error -ss $a -t $d -i $here/.cache/footage/$s.mp4 -vf "fps=6/$d,scale=400:-2,tile=6x1" -frames:v 1 -update 1 /tmp/strip_$n.jpg
  ins+=(-i /tmp/strip_$n.jpg); n=$((n+1))
done
/opt/homebrew/bin/ffmpeg -y -loglevel error $ins -filter_complex "vstack=inputs=$n" -update 1 $out && echo $out
