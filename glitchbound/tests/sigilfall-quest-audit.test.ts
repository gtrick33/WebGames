import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { QUEST_DEFS, QUESTS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { TALL, WIDE } from '../src/games/sigilfall/data/zonegen';
import { questRegion } from '../src/games/sigilfall/progress/character';
import { questSteps, turnInNpc } from '../src/games/sigilfall/progress/handin';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import { npcRegion } from '../src/games/sigilfall/sim/routes';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { heroAtEvent, newWorld, readyHero } from './sigilfall-bot';

/**
 * Every quest, step by step, for the faults the owner found in the Prologue (2026-10-29: "check every other
 * existing quest for such abnormalities and fix them"): whoever a step needs is there, on open ground the hero
 * can walk to; and in every story event the people and things it puts down (the led, the arriving, a wagon's
 * walkers, a ward) stand where they can be reached, and the ones who walk get where they are going. Duskfen's
 * caravan once set its four refugees down inside the house by the causeway, to stand there for good.
 */

const DT = 1 / 30;

/** A hero at a step of a quest, everything before it done, every land open. */
function heroAt(qid: string, step: number, state: 'active' | 'ready') {
  const q = QUEST_DEFS[qid]!;
  const c = readyHero('warrior', Math.max(2, q.level ?? 10));
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  for (const a of q.after ?? []) done(a);
  c.quests[qid] = { state, n: 0, ...(step ? { step } : {}) };
  for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
}

/** The tiles the hero can walk to from (x, y). */
function reach(w: World, x0: number, y0: number): Uint8Array {
  const m = w.map;
  const seen = new Uint8Array(m.w * m.h);
  const start = Math.floor(y0 / TILE) * m.w + Math.floor(x0 / TILE);
  const q = [start];
  seen[start] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % m.w;
    const y = Math.floor(i / m.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const j = ny * m.w + nx;
      if (seen[j] || m.solid[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

/** Whether a point is on, or beside, ground the hero can walk to. */
function within(w: World, ok: Uint8Array, x: number, y: number): boolean {
  const i = Math.floor(y / TILE) * w.map.w + Math.floor(x / TILE);
  return [i, i - 1, i + 1, i - w.map.w, i + w.map.w].some((j) => ok[j]);
}

const tile = (x: number, y: number): string => `${Math.floor(x / TILE)},${Math.floor(y / TILE)}`;

/**
 * The people of a world: none in a wall, none out of the hero's reach, none hidden behind a stall, a tent or a
 * statue standing in front of them, and the one a step needs among them.
 */
function people(w: World, why: string, need?: string): string[] {
  const out: string[] = [];
  const ok = reach(w, w.player.x, w.player.y);
  if (need && !w.npcs.some((n) => n.id === need)) out.push(`${why}: ${need} is not in ${w.region.id}`);
  for (const n of w.npcs) {
    if (w.map.solid[Math.floor(n.y / TILE) * w.map.w + Math.floor(n.x / TILE)]) out.push(`${why}: ${n.id} stands in a wall at ${tile(n.x, n.y)}`);
    else if (!within(w, ok, n.x, n.y)) out.push(`${why}: ${n.id} can't be reached at ${tile(n.x, n.y)}`);
    const tx = Math.floor(n.x / TILE);
    const ty = Math.floor(n.y / TILE);
    for (const pm of w.map.markers) {
      if (pm.marker.kind !== 'prop' || pm.ty !== ty + 1 || !w.isShown(pm)) continue;
      if ((pm.tx === tx && TALL.has(pm.marker.prop)) || (Math.abs(pm.tx - tx) === 1 && WIDE.has(pm.marker.prop))) out.push(`${why}: ${n.id} is hidden behind a ${pm.marker.prop} at ${tile(n.x, n.y)}`);
    }
  }
  return out;
}

describe('Sigilfall: every quest, step by step', () => {
  it('whoever a step needs is there, and everyone stands where the hero can reach them', { timeout: 120_000 }, () => {
    const found = new Set<string>();
    let n = 0;
    for (const q of QUESTS) {
      const steps = questSteps(q);
      for (const [s, o] of steps.entries()) {
        if (o.kind === 'talk') {
          const r = npcRegion(o.npc);
          if (!r) continue;
          for (const p of people(newWorld(r, heroAt(q.id, s, 'active')), `${q.id} step ${s}`, o.npc)) found.add(p);
        } else if (o.kind === 'event') {
          const ev = EVENTS[o.event];
          if (!ev) continue;
          const w = newWorld(ev.region, heroAt(q.id, s, 'active'));
          for (const p of people(w, `${q.id} step ${s}`)) found.add(p);
          const at = w.places[ev.at] ?? w.spots.find((x) => x.id === ev.at);
          if (!at) found.add(`${ev.id}: no place ${ev.at} in ${ev.region}`);
          else if (!within(w, reach(w, w.player.x, w.player.y), at.x, at.y)) found.add(`${ev.id}: ${ev.at} can't be reached`);
        } else {
          const r = questRegion(q);
          if (!r || !REGIONS[r]) continue;
          for (const p of people(newWorld(r, heroAt(q.id, s, 'active')), `${q.id} step ${s}`)) found.add(p);
        }
        n++;
      }
      // handed in: the one who takes it back is there
      const who = turnInNpc(q);
      const r = who ? npcRegion(who) : undefined;
      if (who && r) {
        for (const p of people(newWorld(r, heroAt(q.id, 0, 'ready')), `${q.id} handed in`, who)) found.add(p);
        n++;
      }
    }
    expect(n).toBeGreaterThan(250);
    expect([...found]).toEqual([]);
  });

  it('every story event puts its people and its ward where they can be reached, and its walkers get there', { timeout: 120_000 }, () => {
    const found: string[] = [];
    for (const ev of Object.values(EVENTS)) {
      const c = heroAtEvent(ev.id);
      // (the camp's arrivals wait for the first dawn's scene in the square to be over)
      c.opened.push('scene:briar-dawn');
      const w = newWorld(ev.region, c);
      const spot = (id: string) => w.places[id] ?? w.spots.find((s) => s.id === id) ?? null;
      const at = spot(ev.at)!;
      w.enemies = w.enemies.filter((e) => e.room >= 0);
      w.player.x = at.x;
      w.player.y = at.y;
      for (let t = 0; t < 10 && !w.story.run; t += DT) {
        w.input = emptyInput();
        w.step(DT);
      }
      const run = w.story.run;
      if (!run) {
        found.push(`${ev.id}: never starts`);
        continue;
      }
      const ok = reach(w, w.player.x, w.player.y);
      for (const p of run.pets) {
        // (a boat is moored in the water, beside the bank)
        if (w.map.solid[Math.floor(p.y / TILE) * w.map.w + Math.floor(p.x / TILE)] && p.def.look !== 'boat') found.push(`${ev.id}: ${p.def.id} put down in a wall at ${tile(p.x, p.y)}`);
        else if (!within(w, ok, p.x, p.y)) found.push(`${ev.id}: ${p.def.id} can't be reached at ${tile(p.x, p.y)}`);
      }
      const spots = [ev.rescue?.at, ev.rescue?.to, ev.rescue?.into, ev.arrive?.from, ev.arrive?.to, ev.escort?.from, ev.escort?.to, ev.enter, ...ev.waves.flatMap((x) => x.from)];
      for (const id of spots) {
        if (!id) continue;
        const s = spot(id);
        if (!s) found.push(`${ev.id}: no spot ${id}`);
        else if (!within(w, ok, s.x, s.y)) found.push(`${ev.id}: ${id} can't be reached`);
      }
      // those who walk in, or beside a wagon, walk all the way
      if (ev.arrive || ev.escort) {
        const from = run.pets.map((p) => ({ x: p.x, y: p.y }));
        for (let t = 0; t < 150 && w.story.run; t += DT) {
          w.input = emptyInput();
          w.player.hp = w.player.maxHp;
          for (const e of w.enemies) if (!e.dead && !e.held && e.state !== 'spawn') hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
          if (ev.escort && run.ward) {
            w.player.x = run.ward.x;
            w.player.y = run.ward.y + 20;
          }
          w.step(DT);
        }
        if (w.story.run) found.push(`${ev.id}: not over after two and a half minutes`);
        for (const [i, p] of run.pets.entries()) if (Math.hypot(p.x - from[i]!.x, p.y - from[i]!.y) < TILE) found.push(`${ev.id}: ${p.def.id} never moved from ${tile(from[i]!.x, from[i]!.y)}`);
      }
    }
    expect(found).toEqual([]);
  });
});
