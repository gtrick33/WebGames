#!/bin/bash
# Octave-band RMS of an audio file (dB), to sanity-check a mix's tonal balance without listening.
f="$1"
for c in 63 125 250 500 1000 2000 4000 8000 16000; do
  r=$(/opt/homebrew/bin/ffmpeg -hide_banner -i "$f" -af "bandpass=f=$c:width_type=o:w=1,astats=metadata=0:measure_overall=RMS_level:measure_perchannel=none" -f null - 2>&1 | grep -E "RMS level dB" | tail -1 | awk '{print $NF}')
  printf "%6s Hz %6s dB\n" "$c" "$r"
done
