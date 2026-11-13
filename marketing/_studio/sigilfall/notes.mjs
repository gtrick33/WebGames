// What a take's log says happened and when (for choosing cut points without watching it all):  node notes.mjs <shot> [ids...]
import { readJson, FOOTAGE } from './lib.mjs';
import { join } from 'node:path';
const [shot, ...ids] = process.argv.slice(2);
const m = readJson(join(FOOTAGE, `${shot}.json`));
const quiet = new Set(['hit', 'swing', 'clash', 'enemySwing', 'enemyWindup', 'hurt', 'cast', 'bolt', 'step', 'nomana', 'crit', 'critBlade', 'bow', 'enemyBow', 'fire', 'frost', 'arcane', 'shadow', 'holy', 'nature', 'swingBig', 'heavy']);
const counts = {};
for (const s of m.sounds) if (s.id) counts[s.id] = (counts[s.id] ?? 0) + 1;
console.log(`${shot}: ${m.seconds}s`, 'marks', m.marks.map((k) => `${k.label}@${k.t}`).join(' '));
console.log('sounds', Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' '));
console.log(m.sounds.filter((s) => (s.id && (ids.length ? ids.includes(s.id) : !quiet.has(s.id) && counts[s.id] <= 6)) || s.music !== undefined || s.ambience !== undefined).map((s) => `${(s.f / 60).toFixed(1)}:${s.id ?? (s.music !== undefined ? 'music=' + s.music : 'amb=' + s.ambience)}`).join(' '));
// how busy each second is (sounds per second), as a row of digits
const per = Array(Math.ceil(m.seconds)).fill(0);
for (const s of m.sounds) if (s.id) per[Math.floor(s.f / 60)]++;
console.log('busy ', per.map((n) => Math.min(9, n)).join(''));
