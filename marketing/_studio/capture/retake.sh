#!/bin/bash
# Records a list of takes, 3 at a time, retrying any take whose marks miss what the edit needs.
#   capture/retake.sh            (all takes)
#   capture/retake.sh wing-it    (takes whose line starts with these slugs)
cd "$(dirname "$0")/.."
N=/Users/savahristov/.local/node/bin/node
LIST=$(cat <<'L'
wing-it a | takeoff biome:3 crash
wing-it b --target 32 | biome:1 crash
gloop a | drop:20
gloop b --seconds 50 | drop:10
neon-rush a | start crash
neon-rush b --seconds 40 | crash
mini-racer a | start finish
mini-racer b --track Frost | finish
color-lab a | won:2
color-lab b --size large --levels 1 | won
square-deal a | clear
square-deal b --moves 28 | clear
outta-here a | cleared:4 bump
outta-here b --levels 5 | cleared:5
star-grid a | solved
star-grid b --size 8 | solved
memory-grid a | clear:7 miss
memory-grid b --rounds 7 | miss
color-recall a | reveal:5 done
color-recall b | done
letter-pinch a | solved
letter-pinch b --opener plant | solved
crosswire a | grid mystery
crosswire b --size medium | grid
crosswire h --spooky | mystery
wait-what a | answer:6
wait-what b --mode endless --count 6 | answer:3
gut-check a | miss
gut-check b --streak 5 | miss
to-scale a | lock:5
to-scale b | lock:5
spot-the-glitch a | found:16 miss
spot-the-glitch b --pictures 3 | found:10
wheres-the-ball a | found:3 wrong
wheres-the-ball b --levels 5 | found:4
fussbox a | feed:3 handin
fussbox b --level 3 | handin
whatsit a | ask:2 pick
whatsit b --theme 7 | pick
party-impostor a | players pick pass:3 card impostor-card talk vote result
tour-home off --season off |
tour-home halloween --season halloween |
tour-home winter --season winter |
tour-home diwali --season diwali |
tour-desktop a |
L
)
one() {
  line="$1"
  cmd="${line%%|*}"; need="${line#*|}"
  set -- $cmd; slug=$1; take=$2; shift 2
  for try in 1 2 3; do
    out=$($N capture/record.mjs $slug --take $take "$@" 2>&1 | grep -E "^\[$slug\]|Error" | tail -2)
    ok=1
    for req in $need; do
      name=${req%%:*}; cnt=1; [[ $req == *:* ]] && cnt=${req#*:}
      have=$(python3 -c "import json;print(sum(1 for m in json.load(open('.cache/footage/$slug/$take.json'))['marks'] if m['name']=='$name'))" 2>/dev/null || echo 0)
      [ "$have" -lt "$cnt" ] && ok=0 && echo "  $slug/$take try $try: $name $have < $cnt"
    done
    [ $ok = 1 ] && echo "$out" && return 0
  done
  echo "FAILED $slug/$take"
}
export -f one; export N
echo "$LIST" | while read -r l; do [ -n "$1" ] && ! [[ " $* " == *" ${l%% *} "* ]] && continue; echo "$l"; done | tr '\n' '\0' | xargs -0 -P 2 -I{} bash -c 'one "$@"' _ {}
