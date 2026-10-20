#!/bin/bash
# Re-records single takes with retries until their marks are there: capture/redo.sh "slug take args | needs" ...
cd "$(dirname "$0")/.."
N=/Users/savahristov/.local/node/bin/node
for line in "$@"; do
  cmd="${line%%|*}"; need="${line#*|}"
  set -- $cmd; slug=$1; take=$2; shift 2
  for try in 1 2 3 4; do
    out=$($N capture/record.mjs $slug --take $take "$@" 2>&1 | grep -E "^\[$slug\]|Error" | tail -2)
    ok=1
    for req in $need; do
      name=${req%%:*}; cnt=1; [[ $req == *:* ]] && cnt=${req#*:}
      have=$(python3 -c "import json;print(sum(1 for m in json.load(open('.cache/footage/$slug/$take.json'))['marks'] if m['name']=='$name'))" 2>/dev/null || echo 0)
      [ "$have" -lt "$cnt" ] && ok=0 && echo "  $slug/$take try $try: $name $have < $cnt"
    done
    [ $ok = 1 ] && echo "$out" && break
    [ $try = 4 ] && echo "FAILED $slug/$take"
  done
done
