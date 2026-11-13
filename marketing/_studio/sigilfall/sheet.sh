#!/bin/zsh
# A contact sheet of a take (or any film) for choosing moments: one tile every <step> seconds, left to right, top to bottom.
#   ./sheet.sh <file or shot id> [step=1] [cols=6] [from=0] [seconds=all] [tile width=480]  ->  .cache/look/sheets/<name>.jpg
here=${0:a:h}
f=$1; [[ -f $f ]] || f=$here/.cache/footage/$1.mp4
step=${2:-1}; cols=${3:-6}; from=${4:-0}; len=${5:-0}; tw=${6:-480}
total=$(/opt/homebrew/bin/ffprobe -v error -show_entries format=duration -of csv=p=0 $f)
(( len == 0 )) && len=$(( total - from ))
rows=$(( ${$(( len / step / cols ))%.*} + 1 ))
out=$here/.cache/look/sheets/${${f:t}:r}.jpg
mkdir -p ${out:h}
/opt/homebrew/bin/ffmpeg -y -loglevel error -ss $from -t $len -i $f -vf "fps=1/$step,scale=$tw:-2,tile=${cols}x${rows}" -frames:v 1 -update 1 $out && echo $out
