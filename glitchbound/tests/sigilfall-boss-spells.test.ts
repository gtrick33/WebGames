/**
 * Every boss its own spells (sim/patterns/spells.ts): each spell, cast by a boss in its room, threatens the hero (ground
 * marked, or shots in the air, or the boss somewhere new) and ends; no boss after Morgrave casts his spells; and no two
 * bosses cast the same spell in the same colors. A boss's shot with bounces left glances off a wall.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES, type PatternUse } from '../src/games/sigilfall/data/bosses';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { isRetired } from '../src/games/sigilfall/data/retired';
import { TILE } from '../src/games/sigilfall/sim/map';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
// (after the patterns' index: a boss's own file imported first would meet itself half-loaded through combat)
import { SPELL_PATTERNS } from '../src/games/sigilfall/sim/patterns/spells';
import { endScene } from '../src/games/sigilfall/sim/scene';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/** Morgrave's own: the Crypt's first great caster, and nobody else's. */
const MORGRAVES = ['soulVolley', 'graveGrasp', 'riftSpiral', 'riftBeams', 'riftNova', 'collapse', 'teleport'];

function liveBosses(): string[] {
  const out = new Set<string>();
  for (const r of Object.values(REGIONS)) if (!isRetired(r.id)) for (const e of r.encounters) if (e.boss) out.add(e.boss);
  return [...out];
}
const usesOf = (id: string): PatternUse[] => BOSSES[id]!.phases.flatMap((ph) => [...ph.patterns, ...(ph.enter ?? [])]);

/** Hallvor's crypt: a big room, its boss doing only what it is told. */
function arena(): { w: World; b: Enemy } {
  const w = newWorld('rimeheld-vault', readyHero('warrior', 40, 'uncommon'));
  const enc = w.encounters.find((e) => e.def.boss === 'hallvor-the-unthawed')!;
  for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
  const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((i % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE + 50;
  for (let k = 0; k < 5; k++) w.step(1 / 60);
  if (w.scene) endScene(w, true);
  const b = w.boss()!;
  b.boss!.queue = [];
  b.boss!.pattern = null;
  return { w, b };
}

describe('Sigilfall: every boss its own spells', () => {
  for (const id of Object.keys(SPELL_PATTERNS)) {
    it(`${id} threatens the hero and ends`, () => {
      const { w, b } = arena();
      const from = { x: b.x, y: b.y };
      b.boss!.queue = [{ id: id as PatternUse['id'], w: 1, cd: 0, p: { color: '#ff00ff' } }];
      b.boss!.rest = 0;
      let threat = false;
      let started = false;
      let ended = false;
      // (some strike late: a mine waits for its fuse)
      for (let k = 0; k < 9 * 60; k++) {
        w.player.iframe = 99;
        w.step(1 / 60);
        if (b.boss!.pattern?.use.id === id) started = true;
        else if (started) ended = true;
        threat ||= w.telegraphs.some((t) => t.owner === -1 && t.dmg > 0) || w.projectiles.some((q) => q.hostile && !q.dead) || Math.hypot(b.x - from.x, b.y - from.y) > 20;
        if (!b.boss!.pattern && !b.boss!.queue.length) b.boss!.rest = 99;
      }
      expect(started).toBe(true);
      expect(threat).toBe(true);
      expect(ended).toBe(true);
    });
  }

  it('no boss after Morgrave casts his spells, and every boss’s spells exist', () => {
    const faults: string[] = [];
    for (const id of liveBosses()) {
      for (const u of usesOf(id)) {
        if (id !== 'morgrave' && MORGRAVES.includes(u.id)) faults.push(`${id}: ${u.id}`);
        if (u.id.includes(':') && !EXTRA_PATTERNS[u.id]) faults.push(`${id}: ${u.id} is no attack`);
      }
    }
    expect(faults).toEqual([]);
  });

  it('no two bosses cast the same spell in the same colors', () => {
    const seen = new Map<string, string>();
    const faults: string[] = [];
    for (const id of liveBosses()) {
      const mine = new Set<string>();
      for (const u of usesOf(id)) {
        if (!u.id.startsWith('spell:')) continue;
        const key = `${u.id} ${String(u.p?.look ?? '')} ${String(u.p?.color ?? '')}`;
        if (mine.has(key)) continue;
        mine.add(key);
        const other = seen.get(key);
        if (other && other !== id) faults.push(`${id} and ${other}: ${key}`);
        seen.set(key, id);
      }
    }
    expect(faults).toEqual([]);
  });

  it('a boss’s shot with bounces left glances off a wall', () => {
    const { w, b } = arena();
    b.boss!.rest = 99;
    // straight at the nearest wall to the west
    let x = w.player.x;
    while (!w.map.solid[Math.floor(w.player.y / TILE) * w.map.w + Math.floor((x - 6) / TILE)]) x -= 6;
    w.spawnProjectile({ x: x + 20, y: w.player.y - 30, vx: -150, vy: 0, r: 4, life: 600, dmg: 1, type: 'arcane', spec: null, depth: 0, pierce: 0, bounce: 1, hit: [], look: 'ball', color: '#ffffff', hostile: true, homing: 0, child: false, knock: 0 });
    const q = w.projectiles[w.projectiles.length - 1]!;
    for (let k = 0; k < 30; k++) w.step(1 / 60);
    expect(q.dead).toBe(false);
    expect(q.vx).toBeGreaterThan(0);
    expect(q.bounce).toBe(0);
  });
});
