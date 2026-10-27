import { describe, expect, it } from 'vitest';
import { INTERIOR_DOORS, INTERIORS } from '../src/games/sigilfall/data/interiors';
import { NPCS, QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { grantMounts } from '../src/games/sigilfall/progress/wardrobe';
import { flowField, TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { TOWNSFOLK_LOOKS } from '../src/games/sigilfall/render/art/townsfolk';
import { isFurniture } from '../src/games/sigilfall/render/art/furniture';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Interiors (blueprint Prompts 2 and 12): every door that looks like a door leads in, and out again where
 * you came in; the rooms are furnished without walling anyone off; the doors are barred while the story
 * says so; nobody rides indoors.
 */

const DT = 1 / 60;
/** A hero with Briarhollow's Prologue behind them (the doors are open again from dawn). */
function dawnHero() {
  const c = readyHero('ranger', 12);
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  done('the-empty-tomb');
  for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  return c;
}
/** Walks up (or down) onto the nearest door to `to` and says where it would take the hero. */
function walkInto(w: World, to: RegionId, dir: 1 | -1): string | undefined {
  const d = w.exits.find((x) => x.to === to)!;
  w.player.x = d.x;
  w.player.y = d.y - dir * 30;
  for (let i = 0; i < 60 && !w.pendingExit; i++) {
    w.input = { ...emptyInput(), my: dir };
    w.step(DT);
  }
  return w.pendingExit?.kind === 'exit' ? w.pendingExit.to : undefined;
}

describe('Sigilfall: interiors', () => {
  it('are rooms of their towns: safe, off the world map, each with its door back out and a door in', () => {
    for (const z of INTERIORS) {
      const r = z.region;
      expect(r.interior, r.id).toBe(true);
      expect(r.safe).toBe(true);
      expect(REGION_IDS).not.toContain(r.id);
      const out = r.placed!.filter((p) => p.marker.kind === 'exit');
      expect(out.length, r.id).toBe(1);
      const back = out[0]!.marker.kind === 'exit' ? out[0]!.marker.to : null;
      expect(INTERIOR_DOORS.some((d) => d.to === r.id && d.town === back), r.id).toBe(true);
      for (const id of Object.keys(z.npcs)) {
        expect(NPCS[id], id).toBeDefined();
        expect(TOWNSFOLK_LOOKS[id], `${id} has a look`).toBeDefined();
      }
    }
  });

  it('every piece of furniture named in a room has a picture', () => {
    for (const z of INTERIORS)
      for (const p of z.region.placed!) {
        if (p.marker.kind !== 'prop' || p.marker.prop === 'block') continue;
        const known = ['crate', 'barrel', 'anvil', 'lamp', 'well', 'tent', 'campfire'].includes(p.marker.prop) || isFurniture(p.marker.prop);
        expect(known, `${z.region.id}: ${p.marker.prop}`).toBe(true);
      }
  });

  it('from the door, everyone in the room can be walked to', () => {
    const c = dawnHero();
    for (const z of INTERIORS) {
      const w = newWorld(z.region.id, c);
      const door = w.exits[0]!;
      const f = flowField(w.map, Math.floor(door.x / TILE), Math.floor(door.y / TILE), 400);
      for (const n of w.npcs) {
        const tx = Math.floor(n.x / TILE);
        const ty = Math.floor(n.y / TILE);
        const near = [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => f[(ty + dy!) * w.map.w + tx + dx!]! >= 0);
        expect(near, `${z.region.id}: ${n.id}`).toBe(true);
      }
    }
  });

  it('a door is walked through, in and out, and the hero comes out in front of it', () => {
    const c = dawnHero();
    for (const d of INTERIOR_DOORS) {
      const town = newWorld(d.town, c);
      expect(walkInto(town, d.to, -1), `${d.town} → ${d.to}`).toBe(d.to);
      const inside = newWorld(d.to, c, 1, 0, d.town);
      expect(walkInto(inside, d.town, 1), `${d.to} → ${d.town}`).toBe(d.town);
      const back = newWorld(d.town, c, 1, 0, d.to);
      // just below the door (where the town's plan put it: Briarhollow is laid out spread), not inside the
      // house and not on the door again
      const door = back.exits.find((x) => x.to === d.to)!;
      expect(back.player.y).toBeGreaterThan(door.y + 8);
      expect(Math.abs(back.player.x - door.x)).toBeLessThan(TILE);
      expect(back.map.solid[Math.floor(back.player.y / TILE) * back.map.w + Math.floor(back.player.x / TILE)]).toBe(0);
    }
  });

  it('Briarhollow’s doors are barred on the night of the raid', () => {
    const c = readyHero('mage', 3);
    c.quests['briar-dusk'] = { state: 'done', n: 1 };
    c.quests['briar-the-seal'] = { state: 'done', n: 1 };
    c.quests['briar-nightfall'] = { state: 'active', n: 0 };
    const w = newWorld('briarhollow', c);
    expect(w.exits.some((x) => x.door)).toBe(false);
    const day = newWorld('briarhollow', dawnHero());
    expect(day.exits.filter((x) => x.door).map((x) => x.to).sort()).toEqual(['bramble-and-barrel', 'chapel-of-the-bell', 'elders-hall']);
  });

  it('the camp shows indoors: banners for the villages that came, cots for the people with no roof', () => {
    const c = dawnHero();
    const hall = newWorld('elders-hall', c);
    const banners = (w: World) => w.map.markers.filter((m) => m.marker.kind === 'prop' && m.marker.prop.startsWith('banner:') && w.isShown(m)).length;
    expect(banners(hall)).toBe(0);
    c.quests['camp-scouts'] = { state: 'done', n: 1 };
    c.quests['camp-riders'] = { state: 'done', n: 1 };
    expect(banners(newWorld('elders-hall', c))).toBe(2);
  });

  it('nobody rides indoors', () => {
    const c = dawnHero();
    c.perks.push('mount');
    grantMounts(c);
    const w = newWorld('bramble-and-barrel', c);
    w.player.calm = 10;
    expect(w.mountRefusal()).toBe('Not indoors.');
  });
});
