#!/bin/zsh
# Technical checks of a finished film: its streams, black frames, frozen stretches, loudness and true peak.
f=$1
/opt/homebrew/bin/ffprobe -v error -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,bit_rate,sample_rate,channels,color_space -show_entries format=duration,size -of default=nw=1 $f | tr '\n' ' '; echo
echo "black:"; /opt/homebrew/bin/ffmpeg -hide_banner -i $f -vf "blackdetect=d=0.08:pix_th=0.06" -an -f null - 2>&1 | grep blackdetect | sed 's/.*black_start/black_start/' | head -8
echo "frozen (over 0.7 s):"; /opt/homebrew/bin/ffmpeg -hide_banner -i $f -vf "freezedetect=n=-55dB:d=0.7" -an -f null - 2>&1 | grep "freeze_start\|freeze_duration" | sed 's/.*lavfi.freezedetect.//' | paste - - | head -12
echo "sound:"; /opt/homebrew/bin/ffmpeg -hide_banner -i $f -af ebur128=peak=true -vn -f null - 2>&1 | tail -9 | grep "I:\|LRA:\|Peak:" | tr '\n' ' '; echo
