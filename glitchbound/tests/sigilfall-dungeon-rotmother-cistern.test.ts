/**
 * The Rotmother's Cistern, played through by the bot (tests/sigilfall-bot.ts): every class clears it
 * a level above its own with the gear a player would have by then, room by room, Brother Pustule and
 * then the Rot-Mother, without getting stuck. Also: her bile stays on the floor as pools, and the
 * pools dry up when she falls.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { TILE } from '../src/games/sigilfall/sim/map';
import { EXTRA_PATTERNS } from '../src/games/sigilfall/sim/patterns';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';

const REGION = 'rotmother-cistern';
const LEVEL = REGIONS[REGION].level + 1;
const BOSS_ORDER = ['brother-pustule', 'the-rot-mother'];

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

function runDungeon(cls: ClassId) {
  const w = newWorld(REGION, readyHero(cls, LEVEL, 'uncommon'));
  const r = play(w, { seconds: 1200, done: (x) => x.cleared, goal: nextRoom });
  return { w, r };
}

describe('sigilfall: the Rotmother’s Cistern', () => {
  it('has its two bosses in order, and every attack they use exists', () => {
    const bosses = REGIONS[REGION].encounters.filter((e) => e.boss).map((e) => e.boss);
    expect(bosses).toEqual(BOSS_ORDER);
    expect(BOSSES['the-rot-mother']!.phases).toHaveLength(3);
    for (const id of BOSS_ORDER) {
      for (const ph of BOSSES[id]!.phases) {
        for (const u of [...ph.patterns, ...(ph.enter ?? [])]) if (u.id.includes(':')) expect(EXTRA_PATTERNS[u.id], u.id).toBeTruthy();
      }
    }
  });

  it('the Rot-Mother’s bile stays on the floor as pools, and they dry up when she falls', () => {
    const w = newWorld(REGION, readyHero('warrior', LEVEL, 'uncommon'));
    const pit = w.encounters.find((e) => e.def.boss === 'the-rot-mother')!;
    for (const enc of w.encounters) if (enc.index < pit.index) enc.state = 'cleared';
    // walk into the pit: she wakes
    const tiles = w.map.roomTiles[pit.index]!.filter((i) => !w.map.solid[i]);
    const t = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((t % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(t / w.map.w) + 0.5) * TILE + 60;
    w.player.iframe = 1e9;
    const boss = (): ReturnType<World['boss']> => w.boss();
    for (let i = 0; i < 10 && !boss(); i++) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    const b = boss()!;
    expect(b.def.id).toBe('the-rot-mother');
    // she spits: when the gobs land, pools stay
    b.boss!.queue = [{ id: 'rot:bile', w: 1, cd: 0, p: { count: 3, wind: 1.2, pool: 22 } }];
    b.boss!.rest = 0;
    for (let i = 0; i < 60 * 3; i++) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    const pools = (): number => w.fields.filter((f) => f.hostile && f.type === 'poison').length;
    expect(pools()).toBeGreaterThanOrEqual(1);
    // a pool hurts whoever stands in it
    const f = w.fields.find((x) => x.hostile && x.type === 'poison')!;
    w.player.iframe = 0;
    w.player.x = f.x;
    w.player.y = f.y;
    const hp = w.player.hp;
    for (let i = 0; i < 40; i++) {
      w.player.x = f.x;
      w.player.y = f.y;
      w.input = emptyInput();
      w.step(1 / 60);
    }
    expect(w.player.hp).toBeLessThan(hp);
    // she falls: the floor dries
    w.player.iframe = 1e9;
    b.hp = 1;
    b.boss!.dying = 0.01;
    for (let i = 0; i < 60 * 3; i++) {
      w.input = emptyInput();
      w.step(1 / 60);
    }
    expect(pools()).toBe(0);
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: clears it at level ${LEVEL}`, { timeout: 30_000 }, () => {
      const { w, r } = runDungeon(cls);
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(r.bossesDown).toEqual(BOSS_ORDER);
      expect(r.deaths).toBeLessThanOrEqual(2);
      // the Rot-Mother is a real fight, not a few seconds of burst
      expect(r.bossTimes['the-rot-mother']).toBeGreaterThan(20);
    });
  }
});
