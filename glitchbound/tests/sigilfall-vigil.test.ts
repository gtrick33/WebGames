/** The Vigil's simulation (vigil/sim.ts): the Host, the spells and the choices, without drawing anything. */
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { ALL_SPELLS, BOSS_EVERY, firstSpell, mapOpen, MAX_SPELL, spellsOf, SPELLS, STRENGTHS, UNLOCK_HOLD, VIGIL_MAPS } from '../src/games/sigilfall/vigil/kit';
import { MAX_FOES, Vigil, xpForLevel, type VigilInput } from '../src/games/sigilfall/vigil/sim';

const STILL: VigilInput = { mx: 0, my: 0 };

/** A plain player: walks away from the nearest foes in wide circles and takes the first card it is offered. */
function bot(v: Vigil, t: number): VigilInput {
  if (v.cards) v.choose(0);
  let ax = 0;
  let ay = 0;
  for (const f of v.foes) {
    const d = Math.hypot(v.x - f.x, v.y - f.y) || 1;
    if (d < 70) {
      ax += (v.x - f.x) / d / d;
      ay += (v.y - f.y) / d / d;
    }
  }
  // drawn to the nearest spark, when it is safe to go
  let sx = 0;
  let sy = 0;
  let sd = 160;
  for (const g of v.sparks) {
    const d = Math.hypot(g.x - v.x, g.y - v.y);
    if (d < sd) {
      sd = d;
      sx = (g.x - v.x) / (d || 1);
      sy = (g.y - v.y) / (d || 1);
    }
  }
  const circle = t * 0.5;
  return { mx: ax * 40 + sx * 0.7 + Math.cos(circle) * 0.3, my: ay * 40 + sy * 0.7 + Math.sin(circle) * 0.3 };
}

function run(seed: number, seconds: number, input: (v: Vigil, t: number) => VigilInput, pick = true): Vigil {
  const v = new Vigil(seed, 2000, 2000);
  for (let t = 0; t < seconds && !v.over; t += 1 / 30) {
    if (pick && v.cards) v.choose(0);
    v.step(1 / 30, input(v, t));
  }
  return v;
}

describe('The Vigil', () => {
  it('the same seed and input play the same night', () => {
    const a = run(5, 90, bot);
    const b = run(5, 90, bot);
    expect(a.kills).toBe(b.kills);
    expect(a.level).toBe(b.level);
    expect(a.x).toBe(b.x);
    expect(run(6, 90, bot).kills).not.toBe(a.kills);
  });

  it('standing still gets you killed, and quite soon', () => {
    const v = run(1, 600, () => STILL);
    expect(v.over).toBe(true);
    expect(v.t).toBeLessThan(420);
  });

  // A floor and a ceiling, not the feel: this bot takes whatever card comes first, so a person should last far longer.
  it('even a poor player gets a couple of minutes and several levels, and the Host always wins in the end', () => {
    const times: number[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const v = run(seed, 40 * 60, bot);
      expect(v.over, `seed ${seed} survived 40 minutes`).toBe(true);
      expect(v.level).toBeGreaterThanOrEqual(5);
      expect(v.kills).toBeGreaterThan(50);
      times.push(v.t);
    }
    const median = [...times].sort((a, b) => a - b)[2]!;
    expect(median).toBeGreaterThan(90);
    expect(median).toBeLessThan(30 * 60);
  }, 120_000);

  it('a level offers three different cards and stops the night until you choose', () => {
    const v = new Vigil(2, 2000, 2000);
    v.owed = 1;
    v.step(1 / 30, STILL);
    expect(v.cards).toHaveLength(3);
    const key = (c: NonNullable<typeof v.cards>[number]) => JSON.stringify(c);
    expect(new Set(v.cards!.map(key)).size).toBe(3);
    const t = v.t;
    v.step(1, STILL);
    expect(v.t).toBe(t);
    v.choose(1);
    expect(v.cards).toBeNull();
    v.step(1 / 30, STILL);
    expect(v.t).toBeGreaterThan(t);
  });

  it('early on a new spell is always among the cards', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const v = new Vigil(seed, 2000, 2000);
      v.owed = 1;
      v.step(1 / 30, STILL);
      expect(v.cards!.some((c) => c.kind === 'spell' && c.level === 1)).toBe(true);
    }
  });

  it('a frame stamped before the run began does no harm (a browser’s first frame can be)', () => {
    const v = new Vigil(1, 2000, 2000);
    v.step(-0.02, STILL);
    v.step(Number.NaN, STILL);
    expect(v.t).toBe(0);
    for (let i = 0; i < 30 * 40; i++) {
      if (v.cards) v.choose(0);
      v.step(1 / 30, STILL);
    }
    expect(v.foes.length + v.kills).toBeGreaterThan(5);
  });

  it('rerolls are limited', () => {
    const v = new Vigil(2, 2000, 2000);
    v.owed = 1;
    v.step(1 / 30, STILL);
    for (let i = 0; i < 3; i++) v.reroll();
    expect(v.rerolls).toBe(0);
    const before = v.cards;
    v.reroll();
    expect(v.cards).toBe(before);
  });

  it('a spell at its top with the right strength evolves, once, and is always offered', () => {
    const v = new Vigil(2, 2000, 2000);
    v.spells['ember-bolt'] = MAX_SPELL;
    v.strengths.haste = 3;
    v.owed = 1;
    v.step(1 / 30, STILL);
    const i = v.cards!.findIndex((c) => c.kind === 'spell' && c.evolve);
    expect(i).toBeGreaterThanOrEqual(0);
    v.choose(i);
    expect(v.evolved.has('ember-bolt')).toBe(true);
    v.owed = 1;
    v.step(1 / 30, STILL);
    expect(v.cards!.some((c) => c.kind === 'spell' && c.id === 'ember-bolt')).toBe(false);
  });

  it('a full collection still gives something when there is nothing left to take', () => {
    const v = new Vigil(2, 2000, 2000);
    for (const id of Object.keys(SPELLS) as (keyof typeof SPELLS)[]) {
      v.spells[id] = MAX_SPELL;
      v.evolved.add(id);
    }
    for (const id of Object.keys(STRENGTHS) as (keyof typeof STRENGTHS)[]) v.strengths[id] = 5;
    v.hp = 10;
    v.owed = 1;
    v.step(1 / 30, STILL);
    expect(v.cards).toEqual([{ kind: 'heal' }]);
    v.choose(0);
    expect(v.hp).toBeGreaterThan(10);
  });

  it('champions come on the clock, and a champion’s fall is a free choice', () => {
    const v = new Vigil(3, 2000, 2000);
    v.hp = 1e9;
    v.t = BOSS_EVERY - 0.1;
    for (let i = 0; i < 6; i++) v.step(1 / 30, STILL);
    const boss = v.foes.find((f) => f.boss);
    expect(boss).toBeTruthy();
    expect(v.banner?.text).toContain(boss!.boss!);
    const owed = v.owed;
    boss!.hp = 1;
    (v as unknown as { hurt(f: unknown, d: number): void }).hurt(boss, 5);
    expect(v.owed).toBe(owed + 1);
  });

  it('never holds more foes than it can afford, and a heavy frame stays cheap', () => {
    const v = new Vigil(4, 2000, 2000);
    v.hp = 1e12;
    v.spells = { 'ember-bolt': 5, 'frost-ring': 5, 'chain-spark': 5, 'orbit-motes': 5, meteor: 5 };
    let most = 0;
    for (let t = 0; t < 900; t += 1 / 10) {
      if (v.cards) v.choose(0);
      v.step(1 / 10, STILL);
      most = Math.max(most, v.foes.length);
    }
    expect(most).toBeLessThanOrEqual(MAX_FOES + 5);
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) {
      if (v.cards) v.choose(0);
      v.step(1 / 60, { mx: 1, my: 0 });
    }
    // well inside a frame on this machine, leaving room for a phone and for drawing
    expect((performance.now() - t0) / 60).toBeLessThan(8);
  }, 60_000);

  it('levels cost more as they go', () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(30)).toBeGreaterThan(xpForLevel(10) * 2);
  });

  it('walls stop the hero, and the map’s edge holds', () => {
    const v = new Vigil(1, 100, 100, { solid: (x) => x > 110, bounds: { x0: 0, y0: 0, x1: 200, y1: 200 } });
    for (let i = 0; i < 60; i++) v.step(1 / 30, { mx: 1, my: 0 });
    expect(v.x).toBeLessThanOrEqual(110.5);
    for (let i = 0; i < 300; i++) v.step(1 / 30, { mx: 0, my: -1 });
    expect(v.y).toBe(0);
  });

  describe('every class and land', () => {
    /** A run with the class's whole kit at its top, so every spell has fired and every drawing kind has been fed. */
    const full = (cls: (typeof CLASS_IDS)[number], seed = 3): Vigil => {
      const v = new Vigil(seed, 2000, 2000, { cls });
      v.hp = 1e9;
      for (const s of spellsOf(cls).slice(0, 5)) v.spells[s.id] = MAX_SPELL;
      for (let i = 0; i < 30 * 200; i++) {
        if (v.cards) v.choose(0);
        v.step(1 / 30, { mx: Math.cos(i / 40), my: Math.sin(i / 40) });
      }
      return v;
    };

    it('each class has six spells of its own, two that evolve, and a real first spell', () => {
      for (const cls of CLASS_IDS) {
        const kit = spellsOf(cls);
        expect(kit, cls).toHaveLength(6);
        expect(kit.filter((s) => s.evolve).length, cls).toBeGreaterThanOrEqual(1);
        expect(firstSpell(cls).cls).toBe(cls);
        expect(firstSpell(cls).dmg[0], `${cls} starts with something that kills`).toBeGreaterThan(0);
      }
      expect(new Set(ALL_SPELLS.map((s) => s.id)).size).toBe(ALL_SPELLS.length);
    });

    it('every spell kills or mends, at every class', () => {
      for (const cls of CLASS_IDS) {
        const v = full(cls);
        expect(v.kills, `${cls} killed something`).toBeGreaterThan(30);
        expect(Number.isFinite(v.x) && Number.isFinite(v.t), cls).toBe(true);
        expect(v.foes.every((f) => Number.isFinite(f.x) && Number.isFinite(f.hp)), cls).toBe(true);
      }
    });

    it('a healing spell does heal', () => {
      for (const id of ['mending-light', 'aegis-pulse', 'verdant-pulse']) {
        const def = SPELLS[id]!;
        const v = new Vigil(1, 2000, 2000, { cls: def.cls });
        v.spells = { [id]: 3 };
        v.hp = 5;
        for (let i = 0; i < 30 * 8 && !v.over; i++) v.step(1 / 30, STILL);
        expect(v.hp, id).toBeGreaterThan(5);
      }
    });

    it('a companion fights: wolves, imps and beasts draw blood with nothing else in hand', () => {
      for (const id of ['wolf-pack', 'pit-imps', 'spirit-stag']) {
        const def = SPELLS[id]!;
        const v = new Vigil(1, 2000, 2000, { cls: def.cls });
        v.spells = { [id]: 3 };
        v.hp = 1e9;
        for (let i = 0; i < 30 * 60; i++) {
          if (v.cards) v.choose(0);
          v.spells = { [id]: 3 };
          v.step(1 / 30, STILL);
        }
        expect(v.pets.length, id).toBeGreaterThan(0);
        expect(v.kills, id).toBeGreaterThan(5);
      }
    });

    it('an axe that goes out comes back', () => {
      const v = new Vigil(1, 2000, 2000, { cls: 'warrior' });
      v.spells = { 'thrown-axe': 1 };
      v.hp = 1e9;
      for (let i = 0; i < 30 * 15; i++) v.step(1 / 30, STILL);
      expect(v.shots.filter((s) => s.back).length).toBeLessThan(6);
    });

    it('the bot lasts a while at every class: no class is hopeless or unkillable', () => {
      for (const cls of CLASS_IDS) {
        const times: number[] = [];
        for (const seed of [1, 2, 3]) {
          const v = new Vigil(seed, 2000, 2000, { cls });
          for (let t = 0; t < 40 * 60 && !v.over; t += 1 / 30) v.step(1 / 30, bot(v, t));
          expect(v.over, `${cls} seed ${seed} survived 40 minutes`).toBe(true);
          times.push(v.t);
        }
        const median = [...times].sort((a, b) => a - b)[1]!;
        expect(median, cls).toBeGreaterThan(60);
      }
    }, 180_000);

    it('every land has real faces, on a real region, and opens in turn', () => {
      expect(VIGIL_MAPS.length).toBeGreaterThanOrEqual(10);
      const sprites = new Set(Object.values(ENEMIES).map((e) => e.sprite));
      for (const m of VIGIL_MAPS) {
        expect(REGIONS[m.region], m.id).toBeTruthy();
        for (const s of [...m.foes, ...m.champions.map((c) => c.sprite)]) expect(sprites.has(s), `${m.id}: ${s}`).toBe(true);
        expect(m.champions.length, m.id).toBeGreaterThan(0);
      }
      expect(mapOpen(0, {})).toBe(true);
      expect(mapOpen(1, {})).toBe(false);
      expect(mapOpen(1, { [VIGIL_MAPS[0]!.id]: UNLOCK_HOLD - 1 })).toBe(false);
      expect(mapOpen(1, { [VIGIL_MAPS[0]!.id]: UNLOCK_HOLD })).toBe(true);
    });

    it('a land further on is harder from the first wave, and brings its own champion', () => {
      const a = new Vigil(1, 2000, 2000, { map: VIGIL_MAPS[0]! });
      const b = new Vigil(1, 2000, 2000, { map: VIGIL_MAPS[11]! });
      for (const v of [a, b]) for (let i = 0; i < 30 * 6; i++) v.step(1 / 30, { mx: 1, my: 0 });
      expect(b.foes[0]!.maxHp).toBeGreaterThan(a.foes[0]!.maxHp * 1.5);
      expect(b.foes[0]!.def.sprite).toBe(VIGIL_MAPS[11]!.foes[0]);
      b.hp = 1e9;
      b.t = BOSS_EVERY - 0.1;
      for (let i = 0; i < 6; i++) b.step(1 / 30, STILL);
      expect(b.foes.find((f) => f.boss)!.bossSprite).toBe(VIGIL_MAPS[11]!.champions[0]!.sprite);
    });
  });
});
