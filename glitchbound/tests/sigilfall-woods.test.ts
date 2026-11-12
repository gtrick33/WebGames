/**
 * The edge of a wood is walked through (sim/map.ts `openWoods`, sim/woods.ts): what stops a walker there is the trunk,
 * the bush or the rock that is drawn, not a wall of air a tile wide. It must never open a way that wasn't there, and a
 * boss's ground must be shut when its gate is (Grimtusk's den had open ground either side of its north gate).
 */
import { describe, expect, it } from 'vitest';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { THEMES } from '../src/games/sigilfall/data/themes';
import { circleHitsWall, K, parseRegion, setDoors, TILE, type TileMap } from '../src/games/sigilfall/sim/map';
import { isWoody, woodAt } from '../src/games/sigilfall/sim/woods';

const GROWS = new Set<number>([K.Wall, K.Tree, K.Bush, K.Rock]);

/** Every tile a walk from `from` reaches over open tiles; `also`: tiles that count as shut too. */
function reach(m: TileMap, from: number, shut: (i: number) => boolean = () => false): Uint8Array {
  const seen = new Uint8Array(m.w * m.h);
  if (m.solid[from] || shut(from)) return seen;
  const q = [from];
  seen[from] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % m.w;
    for (const j of [x > 0 ? i - 1 : -1, x < m.w - 1 ? i + 1 : -1, i - m.w, i + m.w]) {
      if (j < 0 || j >= m.w * m.h || seen[j] || m.solid[j] || shut(j)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

const OUTDOORS = Object.values(REGIONS).filter((r) => r.kind !== 'dungeon' && !r.interior && !THEMES[r.theme]?.indoor);

describe('the edge of a wood', () => {
  it('is walked through in the Whisperwood: a tree’s tile stops a walker at its trunk and nowhere else', () => {
    const m = parseRegion(REGIONS.whisperwood);
    let opened = 0;
    let trunks = 0;
    for (let i = 0; i < m.w * m.h; i++) {
      if (m.kind[i] !== K.Wall || m.solid[i]) continue;
      opened++;
      const x = i % m.w;
      const y = Math.floor(i / m.w);
      const wall = (tx: number, ty: number): boolean => tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || m.kind[ty * m.w + tx] === K.Wall;
      const g = woodAt(x, y, !wall(x, y + 1) || !wall(x - 1, y) || !wall(x + 1, y) || !wall(x, y - 1));
      if (g?.what !== 'tree') continue;
      trunks++;
      // on the trunk a walker is stopped; a pace clear of it, on the same tile, they are not
      expect(circleHitsWall(m, g.x * TILE, g.z * TILE, 5), `trunk at ${x},${y}`).toBe(true);
      expect(m.bodies[i]?.length ?? 0, `body at ${x},${y}`).toBeGreaterThan(0);
    }
    expect(opened).toBeGreaterThan(300);
    expect(trunks).toBeGreaterThan(100);
    // (and somewhere on those tiles there is room to stand: the wood's edge isn't a wall any more)
    let room = 0;
    for (let i = 0; i < m.w * m.h; i++) {
      if (m.kind[i] !== K.Wall || m.solid[i]) continue;
      const x = i % m.w;
      const y = Math.floor(i / m.w);
      if ([[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].some(([dx, dy]) => !circleHitsWall(m, (x + dx!) * TILE, (y + dy!) * TILE, 5))) room++;
    }
    expect(room / opened).toBeGreaterThan(0.9);
  });

  it('closes two tiles in, where every tile is drawn thick', () => {
    const m = parseRegion(REGIONS.whisperwood);
    let thick = 0;
    for (let i = 0; i < m.w * m.h; i++) {
      if (!m.thicket[i]) continue;
      thick++;
      expect(m.solid[i]).toBe(1);
      const g = woodAt(i % m.w, Math.floor(i / m.w), true, true);
      expect(g && (g.what === 'tree' || g.what === 'bush')).toBe(true);
    }
    expect(thick).toBeGreaterThan(100);
  });

  it('in every wooded land, nothing of the wood that stops a walker beside open ground is drawn thin', () => {
    let lands = 0;
    for (const def of OUTDOORS) {
      const look = THEMES[def.theme]!;
      if (!isWoody(look) || look.stone) continue;
      lands++;
      const m = parseRegion(def);
      let air = 0;
      for (let i = 0; i < m.w * m.h; i++) {
        if (m.kind[i] !== K.Wall || !m.solid[i] || m.thicket[i]) continue;
        const x = i % m.w;
        const y = Math.floor(i / m.w);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && !m.solid[ny * m.w + nx]) air++;
          }
        }
      }
      expect(air, def.id).toBe(0);
    }
    expect(lands).toBeGreaterThan(10);
  });

  it('never opens a way that wasn’t there, in any land', () => {
    for (const def of OUTDOORS) {
      const m = parseRegion(def);
      const start = m.markers.find((p) => p.marker.kind === 'start');
      if (!start) continue;
      const from = start.ty * m.w + start.tx;
      const shutWays = (i: number): boolean => m.kind[i] === K.Door || m.kind[i] === K.Cracked || m.kind[i] === K.Illusion;
      const now = reach(m, from, shutWays);
      const before = reach(m, from, (i) => shutWays(i) || GROWS.has(m.kind[i]!));
      let extra = 0;
      for (let i = 0; i < m.w * m.h; i++) if (now[i] && !before[i] && !GROWS.has(m.kind[i]!)) extra++;
      expect(extra, def.id).toBe(0);
    }
  });

  it('leaves the woods of a land without woods as they were (a desert’s cliffs, a rift’s rock)', () => {
    for (const def of OUTDOORS) {
      const look = THEMES[def.theme]!;
      if (isWoody(look) && !look.stone) continue;
      const m = parseRegion(def);
      for (let i = 0; i < m.w * m.h; i++) if (m.kind[i] === K.Wall) expect(m.solid[i], `${def.id} ${i}`).toBe(1);
    }
  });
});

describe('a boss’s ground out in the land', () => {
  it('can’t be walked into or out of while its gate is shut', () => {
    let grounds = 0;
    for (const def of OUTDOORS) {
      if (!def.encounters?.length) continue;
      const m = parseRegion(def);
      const start = m.markers.find((p) => p.marker.kind === 'start');
      if (!start) continue;
      for (let r = 0; r < m.doors.length; r++) {
        if (!m.doors[r]!.length || !m.roomTiles[r]?.length) continue;
        setDoors(m, r, true);
        const seen = reach(m, start.ty * m.w + start.tx);
        const leaked = m.roomTiles[r]!.filter((i) => seen[i]).length;
        setDoors(m, r, false);
        // (a land's start may be inside a room: then the room is the side that is shut in)
        if (m.room[start.ty * m.w + start.tx] === r + 1) continue;
        expect(leaked, `${def.id} room ${r}`).toBe(0);
        grounds++;
      }
    }
    expect(grounds).toBeGreaterThan(0);
  });
});

describe('a boss’s room in a dungeon', () => {
  it('has no way in but its doors (the Rime Wyrm’s cavern opened onto the Jarl’s hall)', () => {
    for (const def of Object.values(REGIONS)) {
      if (def.kind !== 'dungeon' || !def.encounters?.length) continue;
      const m = parseRegion(def);
      const start = m.markers.find((p) => p.marker.kind === 'start');
      if (!start) continue;
      for (let r = 0; r < m.doors.length; r++) {
        if (!m.doors[r]!.length || !m.roomTiles[r]?.length || m.room[start.ty * m.w + start.tx] === r + 1) continue;
        setDoors(m, r, true);
        const seen = reach(m, start.ty * m.w + start.tx);
        const leaked = m.roomTiles[r]!.filter((i) => seen[i]).length;
        setDoors(m, r, false);
        expect(leaked, `${def.id} room ${r}`).toBe(0);
      }
    }
  });
});

describe('standing in the edge of a wood', () => {
  it('is no safe place: what hunts a hero comes in after them', async () => {
    const { newWorld, readyHero } = await import('./sigilfall-bot');
    const { emptyInput } = await import('../src/games/sigilfall/sim/world');
    const w = newWorld('whisperwood', readyHero('mage', 3));
    const m = w.map;
    // a tile two deep in the wood with open ground a walk away, and room to stand on it
    let spot = -1;
    for (let i = 0; i < m.w * m.h && spot < 0; i++) {
      if (m.kind[i] !== K.Wall || m.solid[i] || m.clogged[i]) continue;
      const x = i % m.w;
      const y = Math.floor(i / m.w);
      const openBeside = [i - 1, i + 1, i - m.w, i + m.w].some((j) => m.kind[j] !== K.Wall);
      const openNear = !m.solid[i + m.w * 2] && m.kind[i + m.w * 2] !== K.Wall && !m.solid[i + m.w * 3] && m.kind[i + m.w * 3] !== K.Wall && !m.solid[i + m.w] && !m.clogged[i + m.w];
      if (!openBeside && openNear && !circleHitsWall(m, (x + 0.5) * TILE, (y + 0.5) * TILE, 5)) spot = i;
    }
    expect(spot).toBeGreaterThan(0);
    const x = ((spot % m.w) + 0.5) * TILE;
    const y = (Math.floor(spot / m.w) + 0.5) * TILE;
    w.enemies = [];
    w.player.x = x;
    w.player.y = y;
    const e = w.addEnemy('moss-slime', x, y + TILE * 3, 3, { room: -1, pack: 0 });
    e.state = 'chase';
    e.aggro = true;
    const hp = w.player.hp;
    for (let t = 0; t < 12 && w.player.hp === hp; t += 1 / 60) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    expect(w.player.hp).toBeLessThan(hp);
  });
});
