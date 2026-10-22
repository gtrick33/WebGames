/**
 * The Barrow of Kings (levels 28-31), played through by the bot (tests/sigilfall-bot.ts): every class
 * clears it a level above the dungeon's with the gear a player would have by then, King Hrodric first
 * and Sir Corvane last, without getting stuck. And Corvane's own mechanics: he goes on foot with a
 * chilling aura, his doom raises the dead from the graves it falls on (and from none when carried away),
 * and what his fight leaves on the floor goes with him.
 */
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';

const LEVEL = 30;

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('sigilfall: the Barrow of Kings', () => {
  for (const cls of CLASS_IDS) {
    it(`${cls}: clears the Barrow of Kings at level ${LEVEL}`, { timeout: 30_000 }, () => {
      const w = newWorld('barrow-of-kings', readyHero(cls as ClassId, LEVEL, 'uncommon'));
      const r = play(w, { seconds: 1200, done: (x) => x.cleared, goal: nextRoom });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(['king-hrodric', 'sir-corvane']);
      expect(r.deaths).toBeLessThanOrEqual(2);
      // the act's last fight is a real one, three phases long
      expect(r.bossTimes['sir-corvane']).toBeGreaterThan(20);
    });
  }

  /** Into the chapel: Corvane rises, the hero can't be hurt, and he does only what he is told. */
  function chapel(): { w: World; boss: Enemy; hold: () => void } {
    const w = newWorld('barrow-of-kings', readyHero('warrior', LEVEL, 'uncommon'));
    const enc = w.encounters.findIndex((e) => e.def.id === 'chapel');
    const tile = w.map.roomTiles[enc]!.find((i) => !w.map.solid[i])!;
    w.player.x = ((tile % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(tile / w.map.w) + 0.5) * TILE;
    w.step(1 / 60);
    const boss = w.boss()!;
    expect(boss.def.id).toBe('sir-corvane');
    const hold = (): void => {
      w.player.iframe = 99;
      if (!boss.boss!.pattern && !boss.boss!.queue.length) boss.boss!.rest = 99;
    };
    return { w, boss, hold };
  }
  const run = (w: World, s: number, each: () => void): void => {
    for (let i = 0; i < s * 60; i++) {
      each();
      w.step(1 / 60);
    }
  };
  const graves = (w: World) => w.props.filter((p) => p.prop === 'bones' && w.map.room[Math.floor(p.y / TILE) * w.map.w + Math.floor(p.x / TILE)] === w.boss()!.room + 1);

  it('Corvane’s doom raises the dead from a grave it falls on, and from none when carried away', () => {
    for (const onGrave of [true, false]) {
      const { w, boss, hold } = chapel();
      const g = graves(w);
      expect(g.length).toBeGreaterThanOrEqual(4);
      // stand on a grave, or in the middle of the chapel, far from all of them
      const at = onGrave ? g[0]! : { x: boss.boss!.cx, y: boss.boss!.cy - 40 };
      expect(g.every((x) => Math.hypot(x.x - at.x, x.y - at.y) > 60) || onGrave).toBe(true);
      boss.boss!.queue = [{ id: 'barrow:doom', w: 1, cd: 0, p: { carry: 2, r: 46, fall: 0.8, mul: 1.6 } }];
      boss.boss!.rest = 0;
      run(w, 4, () => {
        hold();
        w.player.x = at.x;
        w.player.y = at.y;
      });
      const risen = w.enemies.filter((e) => !e.dead && e.def.id === 'oathsworn-guard');
      expect(risen.length).toBe(onGrave ? 1 : 0);
      // the doom leaves ice where it fell
      expect(w.fields.some((f) => f.hostile && Math.hypot(f.x - at.x, f.y - at.y) < 4)).toBe(true);
    }
  });

  it('Corvane goes on foot with a chilling aura, and his ice and aura go with him', () => {
    const { w, boss, hold } = chapel();
    boss.hp = boss.maxHp * 0.6;
    run(w, 3, hold);
    expect(boss.boss!.phase).toBe(1);
    expect(boss.def.sprite).toBe('sir-corvane-foot');
    const aura = () => w.fields.find((f) => f.hostile && f.r >= 40 && Math.hypot(f.x - boss.x, f.y - boss.y) < 1);
    expect(aura()).toBeTruthy();
    // the runeblade in the floor: patches of ice that spread
    boss.boss!.queue = [{ id: 'barrow:rime', w: 1, cd: 0, p: { count: 3, r: 22, wind: 0.8, grow: 6, max: 36, life: 12 } }];
    boss.boss!.rest = 0;
    run(w, 1.2, hold);
    const ice = w.fields.filter((f) => f.hostile && f !== aura());
    expect(ice.length).toBeGreaterThan(0);
    const r0 = Math.max(...ice.map((f) => f.r));
    run(w, 2, hold);
    expect(Math.max(...ice.map((f) => f.r))).toBeGreaterThan(r0);
    // he falls: nothing of his stays on the floor
    hitEnemy(w, boss, boss.hp * 100, 'physical', { depth: 1 });
    run(w, 0.5, () => (w.player.iframe = 99));
    expect(w.fields.filter((f) => f.hostile)).toHaveLength(0);
  });
});
