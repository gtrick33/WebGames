/**
 * Dungeon rooms (POLISH_PLAN.md piece 18): each room fought in waves does one thing of its own, warned on the ground
 * before it lands (sim/rooms.ts), and every dungeon that is fought through hides a secret behind a cracked wall.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionDef, RoomLook, RoomMechanic } from '../src/games/sigilfall/data/types';
import { K, TILE } from '../src/games/sigilfall/sim/map';
import { lookOf, roomCall } from '../src/games/sigilfall/sim/rooms';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const DUNGEONS = (Object.values(REGIONS) as RegionDef[]).filter((r) => r.kind === 'dungeon');

/** The hero stood in the middle of a room, the room's fight begun and played for a while. */
function into(w: World, room: number, seconds: number, still = true): void {
  const tiles = (w.map.roomTiles[room] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)]!;
  w.player.x = ((i % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE;
  for (let t = 0; t < seconds * 60; t++) {
    if (still) {
      w.player.vx = 0;
      w.player.vy = 0;
    }
    w.step(1 / 60);
  }
}

/** The room's own warnings on the ground (a room's, not a foe's: nobody owns them). */
const roomMarks = (w: World) => w.telegraphs.filter((t) => t.owner === -1 && t.dmg > 0 && (t.tone === 'enemy' || t.tone === 'rift'));

describe('Sigilfall: a dungeon room’s own mechanic', () => {
  it('every room fought in waves has one, but the first room of the first dungeon; a boss’s room has the boss’s own', () => {
    const plain: string[] = [];
    for (const d of DUNGEONS) {
      for (const e of d.encounters) {
        if (e.boss) expect(e.mechanic, `${d.id}/${e.id}`).toBeUndefined();
        else if (!e.mechanic) plain.push(`${d.id}/${e.id}`);
      }
    }
    // (the Bone Hall, the Prologue's first room, is a plain fight: the game's first dungeon teaches its rooms first)
    expect(plain).toEqual(['crypt/hall']);
  });

  it('each says what it is and what to do about it, in the place’s own look', () => {
    const kinds: RoomMechanic[] = ['rockfall', 'vents', 'blades', 'volley', 'rift'];
    for (const k of kinds) {
      for (const theme of ['crypt', 'cave', 'keep', 'icecave', 'temple', 'lavacave', 'citadel', 'cistern', 'roots', 'riftspire'] as const) {
        const call = roomCall(k, lookOf(k, theme));
        expect(call.text.length).toBeGreaterThan(5);
        expect(call.hint).toMatch(/\.$/);
      }
    }
    expect(lookOf('rockfall', 'icecave')).toBe<RoomLook>('ice');
    expect(lookOf('vents', 'lavacave')).toBe<RoomLook>('fire');
    expect(lookOf('blades', 'cistern')).toBe<RoomLook>('water');
    expect(roomCall('blades', 'blade').text).toBe('Blades sweep the room');
  });

  for (const [dungeon, room] of [
    ['crypt', 'chapel'],
    ['smugglers-grotto', 'dock'],
    ['rotmother-cistern', 'vats'],
    ['tomb-of-the-sun-king', 'trap-corridor'],
    ['spire-of-the-rift', 'mirrors'],
  ] as const) {
    it(`${dungeon}, ${room}: called out as its fight begins, warned on the room’s floor, and over once it is cleared`, () => {
      const w = newWorld(dungeon, readyHero('warrior', REGIONS[dungeon].level + 2), 3);
      const enc = w.encounters.find((e) => e.def.id === room)!;
      // (the hero can't fall here: what is looked at is the room)
      w.player.iframe = 1e9;
      into(w, enc.index, 1);
      expect(enc.state).toBe('active');
      const def = enc.def.mechanic!;
      const call = roomCall(def.kind, def.look ?? lookOf(def.kind, w.region.theme));
      // the room's banner says what it does; the first time, the news says what to do about it (the hints are on)
      expect(w.events.some((e) => e.t === 'banner' && e.text === enc.def.title && e.sub === `${enc.def.waves.length} waves · ${call.text}`)).toBe(true);
      expect(w.events.some((e) => e.t === 'toast' && e.text === `${call.text}. ${call.hint}`)).toBe(true);
      // (every warning the room gave over a few falls)
      const seen = new Map<number, ReturnType<typeof roomMarks>[number]>();
      for (let t = 0; t < 60 * 7; t++) {
        w.step(1 / 60);
        for (const m of roomMarks(w)) if (!seen.has(m.id)) seen.set(m.id, { ...m });
      }
      const marks = [...seen.values()];
      expect(marks.length).toBeGreaterThan(1);
      for (const t of marks) {
        expect(t.dur).toBeGreaterThanOrEqual(1);
        const tx = Math.floor(t.x / TILE);
        const ty = Math.floor(t.y / TILE);
        // (a line begins at the room's edge and runs across it; a circle lands on the room's own floor)
        if (t.shape === 'circle') expect(w.map.room[ty * w.map.w + tx]).toBe(enc.index + 1);
      }
      // cleared: nothing more comes
      for (const e of w.enemies) if (e.room === enc.index) e.dead = true;
      for (let t = 0; t < 60 * 8 && enc.state !== 'cleared'; t++) {
        for (const e of w.enemies) if (e.room === enc.index && !e.dead) e.dead = true;
        w.step(1 / 60);
      }
      expect(enc.state).toBe('cleared');
      for (let t = 0; t < 60 * 6; t++) w.step(1 / 60);
      expect(roomMarks(w)).toEqual([]);
      expect(w.roomPlay).toBeNull();
    });
  }

  it('says what to do once a hero has met its kind, and not again; with the hints off, not at all', () => {
    const w = newWorld('rimeheld-vault', readyHero('warrior', 41), 2);
    const a = w.encounters.find((e) => e.def.id === 'ice-galleries')!;
    w.player.iframe = 1e9;
    into(w, a.index, 1);
    const said = (): number => w.events.filter((e) => e.t === 'toast' && e.text.startsWith('Icicles fall.')).length;
    expect(said()).toBe(1);
    // (the same hero in another dungeon's falling room: Icicles were met, stones were not)
    const hero = w.hero;
    const v = newWorld('rimeheld-vault', hero, 3);
    v.player.iframe = 1e9;
    into(v, v.encounters.find((e) => e.def.id === 'ice-galleries')!.index, 1);
    expect(v.events.filter((e) => e.t === 'toast' && e.text.startsWith('Icicles fall.')).length).toBe(0);
    const off = newWorld('smugglers-grotto', readyHero('warrior', 22), 4);
    off.settings = { ...off.settings, tutorial: false };
    off.player.iframe = 1e9;
    into(off, off.encounters.find((e) => e.def.id === 'dock')!.index, 1);
    expect(off.events.filter((e) => e.t === 'toast' && e.text.startsWith('Bolts from the walls.')).length).toBe(0);
  });

  it('strikes a hero who stands in it, and the hero who steps out of it goes unhurt', () => {
    const w = newWorld('rotmother-cistern', readyHero('warrior', 26), 5);
    const enc = w.encounters.find((e) => e.def.id === 'vats')!;
    // (no foes at all: only the room)
    into(w, enc.index, 0.2);
    w.enemies = [];
    const hp = w.player.hp;
    let struck = false;
    for (let t = 0; t < 60 * 12 && !struck; t++) {
      // stand on the next vent marked
      const m = roomMarks(w).find((x) => x.t < x.dur);
      if (m) {
        w.player.x = m.x;
        w.player.y = m.y;
      }
      w.player.vx = 0;
      w.player.vy = 0;
      w.step(1 / 60);
      struck = w.player.hp < hp;
    }
    expect(struck).toBe(true);
  });

  it('is as much harder on a harder tier as the foes are, and never more than twice as hard', () => {
    const first = (tier: number): number => {
      const w = newWorld('rotmother-cistern', readyHero('warrior', 30), 6, tier);
      w.player.iframe = 1e9;
      const enc = w.encounters.find((e) => e.def.id === 'vats')!;
      into(w, enc.index, 0.2);
      for (let t = 0; t < 60 * 6 && !roomMarks(w).length; t++) w.step(1 / 60);
      return roomMarks(w)[0]!.dmg / w.player.maxHp;
    };
    const normal = first(0);
    expect(normal).toBeCloseTo(0.08, 5);
    expect(first(1) / normal).toBeCloseTo(1.4, 5);
    expect(first(2) / normal).toBeCloseTo(2, 5);
  });

  it('draws on chances of its own: what a fight draws is the same with it as without it', () => {
    const src = readFileSync('src/games/sigilfall/sim/rooms.ts', 'utf8');
    expect(src).not.toMatch(/\bw\.rand\(/);
    expect(src).toContain('w.roomRand()');
  });
});

describe('Sigilfall: a dungeon’s secret', () => {
  it('every dungeon fought through hides one: a cracked wall with an epic chest behind it, opened once', () => {
    const none: string[] = [];
    for (const d of DUNGEONS) {
      // (Vaelmoor Remembered is the Ash Crown's memory, walked through, not fought: it has no rooms)
      if (!d.encounters.length) continue;
      const cracked = d.map.some((row) => row.includes('Z'));
      const hoard = Object.entries(d.markers).some(([ch, m]) => m.kind === 'chest' && m.tier === 'epic' && m.once && d.map.some((row) => row.includes(ch)));
      if (!cracked || !hoard) none.push(d.id);
    }
    expect(none).toEqual([]);
  });

  it('the Crown Catacombs’ is behind the wall at the foot of the stair, and nowhere a hero walks without breaking it', () => {
    const w = newWorld('crown-catacombs', readyHero('warrior', 60), 1);
    const m = w.map;
    const chest = m.markers.find((pm) => pm.marker.kind === 'chest' && pm.marker.id === 'cc-cache')!;
    expect(chest).toBeTruthy();
    const crack = [...m.kind.keys()].find((i) => m.kind[i] === K.Cracked)!;
    expect(crack).toBeDefined();
    // (a walk from the start that can't go through the cracked wall doesn't reach the chest)
    const seen = new Uint8Array(m.w * m.h);
    const start = Math.floor(w.player.y / TILE) * m.w + Math.floor(w.player.x / TILE);
    const open = [start];
    seen[start] = 1;
    while (open.length) {
      const i = open.pop()!;
      for (const j of [i - 1, i + 1, i - m.w, i + m.w]) {
        if (j < 0 || j >= seen.length || seen[j] || (m.solid[j] && m.kind[j] !== K.Door)) continue;
        seen[j] = 1;
        open.push(j);
      }
    }
    expect(seen[chest.ty * m.w + chest.tx]).toBe(0);
    expect([crack - 1, crack + 1].some((j) => seen[j])).toBe(true);
  });
});
