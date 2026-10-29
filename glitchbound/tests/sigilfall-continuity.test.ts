import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { questSteps } from '../src/games/sigilfall/progress/handin';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { STORY_FADE } from '../src/games/sigilfall/sim/pets';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { NpcActor, Pet } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { heroAtEvent, newWorld } from './sigilfall-bot';

/**
 * Nobody pops in or out (the owner: "check every quest for teleportation bugs, disappearing and etc."): every
 * story event in the game, played from its start to its end, frame by frame. The story's people come in with a
 * fade (or are the person who stood there), go with a fade (or become the person who stands where they stopped),
 * and walk every step between; the people of a place who leave as the story turns fade out where they stood.
 */

const DT = 1 / 60;
const sameNpc = (a: NpcActor, b: NpcActor): boolean => a.id === b.id && a.x === b.x && a.y === b.y;

const cases = Object.values(EVENTS).filter((ev) => Object.values(QUEST_DEFS).some((d) => questSteps(d).some((o) => o.kind === 'event' && o.event === ev.id)));

describe('Sigilfall: nobody pops in or out', () => {
  it('every story event has a quest that plays it', () => {
    expect(cases.length).toBeGreaterThan(30);
  });

  for (const ev of cases) {
    it(`${ev.id} (${ev.region})`, () => {
      const w: World = newWorld(ev.region, heroAtEvent(ev.id));
      const at = w.places[ev.at] ?? w.spots.find((s) => s.id === ev.at);
      expect(at, `${ev.at} is a place in ${ev.region}`).toBeTruthy();
      w.player.x = at!.x;
      w.player.y = at!.y + 8;
      let pets = new Map<Pet, { x: number; y: number }>();
      let npcs: NpcActor[] = [...w.npcs];
      const problems: string[] = [];
      const near = (x: number, y: number): boolean => Math.hypot(x - w.player.x, y - w.player.y) < 15 * TILE;
      let started = false;
      for (let f = 0; f < 120 / DT; f++) {
        w.player.hp = w.player.maxHp;
        // (the hero is not the point: what they fight falls, once a shot of it has shown it)
        if (f % 120 === 60) for (const e of w.enemies) if (!e.dead && !e.held && e.state !== 'spawn') hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
        // a rescue's people go where they are led: the hero takes them there
        if (ev.rescue && w.story.run && w.story.run.t > 3) {
          const to = w.places[ev.rescue.to];
          if (to && f % 30 === 0) {
            w.player.x += (to.x - w.player.x) * 0.08;
            w.player.y += (to.y - w.player.y) * 0.08;
          }
        }
        // an escort's wagon is walked beside
        if (ev.escort && w.story.run?.ward) {
          w.player.x = w.story.run.ward.x + 10;
          w.player.y = w.story.run.ward.y + 6;
        }
        w.step(DT);
        if (w.story.run?.def.id === ev.id) started = true;
        // the story's people as they are now, against a frame ago
        const now = new Map(w.pets.filter((p) => p.story).map((p) => [p, { x: p.x, y: p.y }] as const));
        for (const [p, was] of pets) {
          const here = now.get(p);
          if (here) {
            // walking, never jumping (a companion far behind catches up out of sight, with a fade)
            if (Math.hypot(here.x - was.x, here.y - was.y) > 8 && !(p.born === w.time)) problems.push(`${p.def.id} jumped ${Math.round(Math.hypot(here.x - was.x, here.y - was.y))} px`);
            continue;
          }
          // gone: faded out, or the person who now stands where they stopped
          const faded = p.dead && p.deathT >= STORY_FADE - 1e-6;
          const handed = w.npcs.some((n) => n.id === p.def.look && Math.hypot(n.x - was.x, n.y - was.y) < 1.5 * TILE && n.since === undefined);
          if (!faded && !handed && near(was.x, was.y)) problems.push(`${p.def.id} vanished`);
        }
        for (const [p, here] of now) {
          if (pets.has(p)) continue;
          // come: with a fade, or the person who stood there a moment ago
          const stood = p.born === undefined && npcs.some((n) => n.id === p.def.look && Math.hypot(n.x - here.x, n.y - here.y) < 2);
          if (p.born !== w.time && !stood && near(here.x, here.y)) problems.push(`${p.def.id} popped in`);
        }
        for (const n of npcs) {
          if (w.npcs.some((m) => sameNpc(m, n))) continue;
          // the people of the place who leave fade out where they stood, or step out to fight
          const fading = w.leftNpcs.some((m) => sameNpc(m, n));
          const steppedOut = w.pets.some((p) => p.def.look === n.id && Math.hypot(p.x - n.x, p.y - n.y) < 2);
          if (!fading && !steppedOut && near(n.x, n.y)) problems.push(`npc ${n.id} vanished`);
        }
        for (const n of w.npcs) {
          if (npcs.some((m) => sameNpc(m, n)) || n.since !== undefined || !near(n.x, n.y)) continue;
          // (come without a fade only as the story's person who just walked up to that spot)
          const walkedUp = [...pets].some(([p, was]) => !now.has(p) && p.def.look === n.id && Math.hypot(n.x - was.x, n.y - was.y) < 1.5 * TILE);
          if (!walkedUp) problems.push(`npc ${n.id} popped in`);
        }
        pets = now;
        npcs = [...w.npcs];
        if (started && !w.story.run && !w.pets.some((p) => p.story)) break;
      }
      expect(started, `${ev.id} started`).toBe(true);
      expect([...new Set(problems)]).toEqual([]);
    });
  }
});
