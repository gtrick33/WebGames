import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { kitOf } from '../src/games/sigilfall/render3d/kits';
import { builtProp } from '../src/games/sigilfall/render3d/propsBuilt';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { QUEST_DEFS, QUESTS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { isRetired } from '../src/games/sigilfall/data/retired';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { questRegion } from '../src/games/sigilfall/progress/character';
import { questSteps } from '../src/games/sigilfall/progress/handin';
import { applyPreset, PRESETS } from '../src/games/sigilfall/progress/presets';
import { K, TERRAIN, TILE } from '../src/games/sigilfall/sim/map';
import { npcRegion } from '../src/games/sigilfall/sim/routes';
import { holds } from '../src/games/sigilfall/sim/story';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The polish pass (the owner, 2026-11-10: "choppy transitions and character misplacement, issues with spawns,
 * enemies, friendly npcs, visual incoherence"): at every step of every quest, the people of the land where it is
 * played stand apart from each other, on dry ground and clear of what stands there, and no enemy waits among them;
 * every story fight's foes come in from open ground the fight can reach; and every vision's people stand on open
 * ground. tests/sigilfall-quest-audit.test.ts keeps them out of walls and in the hero's reach.
 */

/** A hero at a step of a quest, everything before it done, every land open. */
function heroAt(qid: string, step: number) {
  const q = QUEST_DEFS[qid]!;
  const c = readyHero('warrior', Math.max(2, q.level ?? 10));
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  for (const a of q.after ?? []) done(a);
  c.quests[qid] = { state: 'active', n: 0, ...(step ? { step } : {}) };
  for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
}

const tileOf = (w: World, x: number, y: number): number => Math.floor(y / TILE) * w.map.w + Math.floor(x / TILE);
const at = (x: number, y: number): string => `${Math.floor(x / TILE)},${Math.floor(y / TILE)}`;
/** Whether a point stands inside the body of something there (a prop, a yard's statue). */
function inBody(w: World, x: number, y: number): boolean {
  return (w.map.bodies[tileOf(w, x, y)] ?? []).some((b) => !b.off && x > b.x0 + 2 && x < b.x1 - 2 && y > b.y0 + 2 && y < b.y1 - 2);
}
/** Whether a point is on dry, open, walkable ground. */
const open = (w: World, x: number, y: number): boolean => {
  const i = tileOf(w, x, y);
  return i >= 0 && i < w.map.solid.length && !w.map.solid[i] && w.map.kind[i] !== K.Water && !inBody(w, x, y);
};

/** The faults of a land's people as a step of a quest finds them. */
function peopleFaults(w: World, why: string): string[] {
  const out: string[] = [];
  const live = w.npcs.filter((n) => !n.ghost);
  for (const [i, n] of live.entries()) {
    const k = w.map.kind[tileOf(w, n.x, n.y)];
    if (k === K.Water) out.push(`${why}: ${n.id} stands in the water at ${at(n.x, n.y)}`);
    if (inBody(w, n.x, n.y)) out.push(`${why}: ${n.id} stands inside something at ${at(n.x, n.y)}`);
    for (const m of live.slice(i + 1)) if (m.id !== n.id && Math.hypot(m.x - n.x, m.y - n.y) < 0.75 * TILE) out.push(`${why}: ${n.id} and ${m.id} stand on each other at ${at(n.x, n.y)}`);
    // no enemy waits among the people (a pack on a quest-giver's doorstep, a raider in the square)
    const foe = w.enemies.find((e) => !e.dead && !e.dummy && !e.boss && Math.hypot(e.x - n.x, e.y - n.y) < 4 * TILE);
    if (foe && w.region.kind !== 'dungeon' && !w.story.run) out.push(`${why}: a ${foe.def.id} waits by ${n.id} at ${at(n.x, n.y)}`);
  }
  for (const p of w.pets) if (!p.dead && !open(w, p.x, p.y) && w.map.solid[tileOf(w, p.x, p.y)]) out.push(`${why}: ${p.def.id} is set down in a wall at ${at(p.x, p.y)}`);
  return out;
}

/** The land a step of a quest is played in. */
function stepRegion(qid: string, step: number): RegionId | undefined {
  const q = QUEST_DEFS[qid]!;
  const o = questSteps(q)[step]!;
  if (o.kind === 'talk') return npcRegion(o.npc);
  if (o.kind === 'event') return EVENTS[o.event]?.region;
  if (o.kind === 'kill' || o.kind === 'loot' || o.kind === 'clear') return o.region;
  return questRegion(q) ?? q.zone;
}

describe('Sigilfall: the polish pass', () => {
  it('at every step of every quest, the people of its land stand apart, on dry open ground, with no enemy among them', { timeout: 300_000 }, () => {
    const faults = new Set<string>();
    let worlds = 0;
    for (const q of QUESTS) {
      questSteps(q).forEach((_, s) => {
        const r = stepRegion(q.id, s);
        if (!r || !REGIONS[r] || isRetired(r)) return;
        const w = newWorld(r, heroAt(q.id, s));
        worlds++;
        for (const f of peopleFaults(w, `${q.id} step ${s} (${r})`)) faults.add(f);
      });
    }
    expect(worlds).toBeGreaterThan(200);
    expect([...faults]).toEqual([]);
  });

  it('every story fight’s foes come in from open ground that the fight can reach, apart from where it is held', () => {
    const faults: string[] = [];
    for (const ev of Object.values(EVENTS)) {
      if (isRetired(ev.region) || !ev.waves.length) continue;
      const q = QUESTS.find((x) => questSteps(x).some((o) => o.kind === 'event' && o.event === ev.id));
      if (!q) continue;
      const step = questSteps(q).findIndex((o) => o.kind === 'event' && o.event === ev.id);
      const w = newWorld(ev.region, heroAt(q.id, step));
      const centre = w.places[ev.at] ?? w.spots.find((x) => x.id === ev.at);
      if (!centre) continue;
      for (const from of new Set(ev.waves.flatMap((v) => v.from))) {
        const p = w.places[from] ?? w.spots.find((x) => x.id === from);
        if (!p) faults.push(`${ev.id}: no place ${from}`);
        else if (!open(w, p.x, p.y)) faults.push(`${ev.id}: foes come in from ${from}, which is not open ground (${at(p.x, p.y)})`);
      }
    }
    expect(faults).toEqual([]);
  });

  it('what rises behind a dungeon boss’s wall stands in the rock, never in another room in front of a fight', () => {
    const faults: string[] = [];
    for (const r of Object.values(REGIONS)) {
      if (r.kind !== 'dungeon' || isRetired(r.id)) continue;
      const w = newWorld(r.id, readyHero('warrior', 60));
      for (const p of w.props) {
        if (!p.prop.startsWith('great:')) continue;
        const tx = Math.floor(p.x / TILE);
        const ty = Math.floor(p.y / TILE);
        let open = 0;
        // (from two rows behind the wall, where it rises)
        for (let y = ty - 11; y <= ty - 2; y++) for (let x = tx - 6; x <= tx + 6; x++) if (y >= 0 && x >= 0 && x < w.map.w && !w.map.solid[y * w.map.w + x]) open++;
        if (open) faults.push(`${r.id}: ${p.prop} at ${tx},${ty} rises over ${open} open tiles`);
      }
    }
    expect(faults).toEqual([]);
  });

  it('a dungeon’s marker letters never stand for ground as well (a cracked wall, a door), and each boss is placed once', () => {
    const faults: string[] = [];
    for (const r of Object.values(REGIONS)) {
      if (r.kind !== 'dungeon' || isRetired(r.id)) continue;
      const counts = new Map<string, number>();
      for (const row of r.map) for (const c of row) counts.set(c, (counts.get(c) ?? 0) + 1);
      for (const [c, m] of Object.entries(r.markers)) {
        // (a marker wins over the ground its letter would be: a cracked wall drawn with it is gone)
        if (TERRAIN[c] !== undefined) faults.push(`${r.id}: the marker '${c}' is also ground`);
        if (m.kind === 'boss' && counts.get(c) !== 1) faults.push(`${r.id}: ${m.boss} is placed ${counts.get(c) ?? 0} times`);
      }
    }
    expect(faults).toEqual([]);
  });

  it('every boss fight’s things (a coffin, a candle, a cage) and every beast’s gear are drawn with a model that exists', () => {
    // the models the 3D cast draws a fight's things from: the art packs it loads, and the ones built in code
    const names = new Set<string>();
    for (const pack of ['indoor', 'town', 'nature', 'hero']) {
      const bytes = gunzipSync(readFileSync(`public/games/sigilfall/3d/${pack}.pack`));
      const len = bytes.readUInt32LE(0);
      for (const id of Object.keys((JSON.parse(bytes.subarray(4, 4 + len).toString('utf8')) as { meshes: Record<string, unknown> }).meshes)) names.add(id);
    }
    const exists = (m: string): boolean => names.has(m) || (m.startsWith('built_') && !!builtProp(m));
    const missing = Object.values(ENEMIES).filter((e) => e.prop && !exists(e.prop.m));
    expect(missing.map((e) => `${e.id}: ${e.prop!.m}`)).toEqual([]);
    // and what a great beast wears (Kit.gear: Gnasher's barding, Clatterclaw's bones)
    const worn = [...Object.values(BOSSES).map((b) => b.sprite), ...Object.values(ENEMIES).map((e) => e.sprite)].flatMap((sp) => (kitOf(sp).gear ?? []).filter((g) => !exists(g.m)).map((g) => `${sp}: ${g.m}`));
    expect([...new Set(worn)]).toEqual([]);
    expect(kitOf('gnasher').gear?.length).toBeGreaterThan(3);
  });

  it('every vision’s people, and every effect, stand on open ground', () => {
    const faults: string[] = [];
    for (const def of SCENES) {
      if (!def.when || isRetired(def.region)) continue;
      const preset = PRESETS.find((p) => {
        if (!p.label.includes('(scene)') || p.region !== def.region) return false;
        const c = readyHero('mage', 2);
        applyPreset(c, p);
        return holds(c, def.when!);
      });
      if (!preset) continue;
      const c = readyHero('mage', preset.level);
      applyPreset(c, preset);
      const w = newWorld(def.region, c);
      for (const s of def.steps) {
        if (!('ghost' in s) || s.at === 'hero') continue;
        const p = w.places[s.at] ?? w.spots.find((x) => x.id === s.at) ?? w.npcs.find((n) => n.id === s.at);
        if (!p) continue;
        const x = p.x + (s.dx ?? 0) * TILE;
        const y = p.y + (s.dy ?? 0) * TILE;
        if (!open(w, x, y)) faults.push(`${def.id}: ${s.ghost} stands in a wall, the water or a prop at ${at(x, y)}`);
        const other = w.npcs.find((n) => !n.ghost && Math.hypot(n.x - x, n.y - y) < 0.75 * TILE);
        if (other) faults.push(`${def.id}: ${s.ghost} stands on ${other.id} at ${at(x, y)}`);
      }
    }
    expect(faults).toEqual([]);
  });
});
