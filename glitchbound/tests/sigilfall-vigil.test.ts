/** The Vigil's simulation (vigil/sim.ts): the Host, the spells and the choices, without drawing anything. */
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import * as room from '../src/games/sigilfall/net/vigilRoom';
import { maxMessage } from '../src/games/sigilfall/net/vigilRoom';
import { ALL_SPELLS, BOSS_EVERY, firstSpell, mapOpen, MAX_SPELL, partyScale, spellsOf, SPELLS, STRENGTHS, UNLOCK_HOLD, upgradesOf, VIGIL_MAPS } from '../src/games/sigilfall/vigil/kit';
import { EVOLVE_AT, MAX_FOES, MAX_FOES_PARTY, topLevel, Vigil, xpForLevel, type Foe, type VigilInput } from '../src/games/sigilfall/vigil/sim';
import { applySnap, SnapWriter } from '../src/games/sigilfall/vigil/snapshot';

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
    v.strengths.haste = EVOLVE_AT;
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

  it('with nothing left to take, a level heals and the night doesn’t stop for it', () => {
    const v = new Vigil(2, 2000, 2000);
    for (const id of Object.keys(SPELLS) as (keyof typeof SPELLS)[]) {
      v.spells[id] = MAX_SPELL;
      v.evolved.add(id);
    }
    for (const id of Object.keys(STRENGTHS) as (keyof typeof STRENGTHS)[]) v.strengths[id] = 5;
    v.hp = 10;
    v.owed = 1;
    v.step(1 / 30, STILL);
    expect(v.cards).toBeNull();
    expect(v.owed).toBe(0);
    expect(v.hp).toBeGreaterThan(10);
  });

  it('champions come on the clock, and a champion leaves a chest that gives everyone a choice', () => {
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
    const chest = v.pickups.find((p) => p.kind === 'chest');
    expect(chest).toBeTruthy();
    chest!.x = v.x;
    chest!.y = v.y;
    const rerolls = v.rerolls;
    v.step(1 / 30, STILL);
    expect(v.owed).toBeGreaterThanOrEqual(owed + 1);
    expect(v.rerolls).toBe(rerolls + 1);
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
    expect(most).toBeLessThanOrEqual(MAX_FOES + 8);
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

  it('a level isn’t stopping the night every few seconds, even a long way in', () => {
    const v = run(2, 8 * 60, bot, true);
    // (a level every 12 seconds or so at the very worst)
    expect(v.level).toBeLessThan(v.t / 7);
  }, 60_000);

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

    it('each class has ten spells of its own, several that evolve, and a real first spell', () => {
      for (const cls of CLASS_IDS) {
        const kit = spellsOf(cls);
        expect(kit, cls).toHaveLength(10);
        expect(kit.filter((s) => s.evolve).length, cls).toBeGreaterThanOrEqual(3);
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

    it('every spell has its own upgrades, one of them its alone, and each does something', () => {
      const names = new Set<string>();
      for (const def of ALL_SPELLS) {
        const ups = upgradesOf(def);
        expect(ups.length, def.id).toBeGreaterThanOrEqual(4);
        for (const u of ups) {
          const { id, name, text, ...mod } = u;
          expect(id, def.id).toContain(def.id);
          expect(name.length, def.id).toBeGreaterThan(2);
          expect(text.length, def.id).toBeGreaterThan(5);
          expect(Object.keys(mod).length, `${def.id}: ${name} changes nothing`).toBeGreaterThan(0);
        }
        names.add(def.sig.name);
      }
      // one spell's own upgrade isn't another's
      expect(names.size).toBeGreaterThan(ALL_SPELLS.length * 0.85);
    });

    it('an upgrade taken changes the spell, and is never offered twice', () => {
      const v = new Vigil(9, 2000, 2000);
      const def = firstSpell('mage');
      v.hp = 1e9;
      const before = v.statsOf(v.me, def);
      const seen = new Set<string>();
      for (let i = 0; i < 400 && v.spells[def.id]! < topLevel(def); i++) {
        v.owed = 1;
        v.step(1 / 30, STILL);
        const at = v.cards!.findIndex((c) => c.kind === 'up' && c.id === def.id);
        if (at < 0) {
          v.choose(0);
          continue;
        }
        const c = v.cards![at]!;
        if (c.kind === 'up') {
          expect(seen.has(c.up), c.up).toBe(false);
          seen.add(c.up);
        }
        v.choose(at);
      }
      expect(seen.size).toBeGreaterThan(0);
      expect(JSON.stringify(v.statsOf(v.me, def))).not.toBe(JSON.stringify(before));
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

    it('the trees are solid: the hero stops at one, and the Host goes around it', () => {
      const tree = { x: 2030, y: 2000, r: 8 };
      const v = new Vigil(1, 2000, 2000, { obstacles: [tree] });
      v.hp = 1e9;
      for (let i = 0; i < 30; i++) {
        v.step(1 / 30, { mx: 1, my: 0 });
        expect(Math.hypot(v.x - tree.x, v.y - tree.y)).toBeGreaterThanOrEqual(tree.r);
      }
      expect(v.x).toBeLessThan(tree.x);
      // whoever comes from behind the tree gets past it without walking through
      const w = new Vigil(2, 2000, 2000, { obstacles: [tree] });
      w.hp = 1e9;
      for (let t = 0; t < 40; t += 1 / 30) {
        if (w.cards) w.choose(0);
        w.step(1 / 30, STILL);
        for (const f of w.foes) expect(Math.hypot(f.x - tree.x, f.y - tree.y), `foe ${f.id}`).toBeGreaterThanOrEqual(f.r * 0.6);
      }
      const stuck = new Vigil(3, 2000, 2000, { obstacles: [tree] });
      stuck.hp = 1e9;
      stuck.spells = {};
      const foe = (at: number): Foe => {
        stuck.step(1 / 30, STILL);
        const f = stuck.foes[0]!;
        f.x = at;
        f.y = 2000;
        return f;
      };
      for (let i = 0; i < 40 && !stuck.foes.length; i++) stuck.step(1 / 30, STILL);
      const f = foe(2100);
      for (let i = 0; i < 30 * 5; i++) stuck.step(1 / 30, STILL);
      expect(f.x, 'it came past the tree').toBeLessThan(tree.x);
    });

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

  describe('the things that make a night more than walking', () => {
    const near = (v: Vigil, f: Foe, d = 40): void => {
      f.x = v.x + d;
      f.y = v.y;
    };

    it('a dash is quick, can’t be struck, and has to come back', () => {
      const v = new Vigil(1, 2000, 2000);
      v.step(1 / 30, { mx: 1, my: 0 });
      const x = v.x;
      v.step(1 / 30, { mx: 1, my: 0, dash: true });
      expect(v.x - x).toBeGreaterThan(5);
      expect(v.me.iframe).toBeGreaterThan(0);
      const cd = v.me.dashCd;
      expect(cd).toBeGreaterThan(1);
      const y = v.x;
      for (let i = 0; i < 10; i++) v.step(1 / 30, { mx: 0, my: 0, dash: true });
      expect(v.me.dashCd).toBeLessThan(cd);
      expect(v.x - y, "one dash, not ten").toBeLessThan(46);
    });

    it('kills fill the frenzy meter, and a frenzy ends', () => {
      const v = new Vigil(1, 2000, 2000);
      v.hp = 1e9;
      const kill = (v as unknown as { kill(f: unknown, h: unknown): void }).kill.bind(v);
      for (let i = 0; i < 200 && v.me.frenzyT <= 0; i++) kill({ x: 0, y: 0, r: 5, xp: 0, maxHp: 1, boss: null, elite: false, dead: false }, v.me);
      expect(v.me.frenzyT).toBeGreaterThan(0);
      for (let i = 0; i < 30 * 8; i++) {
        if (v.cards) v.choose(0);
        v.step(1 / 30, STILL);
      }
      expect(v.me.frenzyT).toBeLessThan(6);
    });

    it('foes that shoot stand off and throw things slow enough to dodge', () => {
      const v = new Vigil(4, 2000, 2000);
      v.hp = 1e9;
      v.spells = {};
      v.t = 100;
      for (let i = 0; i < 30 * 25; i++) {
        if (v.cards) v.choose(0);
        v.spells = {};
        v.step(1 / 30, STILL);
        if (v.foeShots.length) break;
      }
      expect(v.foeShots.length).toBeGreaterThan(0);
      expect(Math.hypot(v.foeShots[0]!.vx, v.foeShots[0]!.vy)).toBeLessThan(100);
    });

    it('chargers wind up where it shows, then come fast', () => {
      const v = new Vigil(5, 2000, 2000);
      v.hp = 1e9;
      v.spells = {};
      v.t = 180;
      let wound = false;
      let charged = false;
      for (let i = 0; i < 30 * 40 && !charged; i++) {
        if (v.cards) v.choose(0);
        v.spells = {};
        v.step(1 / 30, STILL);
        if (v.foes.some((f) => f.mode === 1)) wound = true;
        if (wound && v.foes.some((f) => f.mode === 2)) charged = true;
      }
      expect(wound).toBe(true);
      expect(charged).toBe(true);
    });

    it('a champion’s slam shows first, and stepping out of it is enough', () => {
      const v = new Vigil(6, 2000, 2000);
      v.hp = 1000;
      v.slams.push({ x: v.x + 200, y: v.y, r: 40, dmg: 50, t: 0, dur: 0.2 });
      for (let i = 0; i < 9; i++) v.step(1 / 30, STILL);
      expect(v.slams.length).toBe(0);
      expect(v.hp).toBe(1000);
      v.slams.push({ x: v.x, y: v.y, r: 40, dmg: 50, t: 0.45, dur: 0.5 });
      v.step(0.1, STILL);
      expect(v.hp).toBe(950);
    });

    it('pickups: meat heals, a bomb clears, a magnet brings the sparks', () => {
      const v = new Vigil(7, 2000, 2000);
      v.hp = 10;
      v.pickups.push({ kind: 'meat', x: v.x, y: v.y, t: 0, dead: false });
      v.step(1 / 30, STILL);
      expect(v.hp).toBeGreaterThan(10);
      v.hp = 1e9;
      for (let i = 0; i < 30 * 12; i++) {
        if (v.cards) v.choose(0);
        v.spells = {};
        v.step(1 / 30, STILL);
      }
      const had = v.foes.length;
      expect(had).toBeGreaterThan(3);
      v.foes.forEach((f) => near(v, f, 60));
      v.pickups.push({ kind: 'bomb', x: v.x, y: v.y, t: 0, dead: false });
      v.step(1 / 30, STILL);
      v.step(1 / 30, STILL);
      expect(v.foes.length).toBeLessThan(had);
      v.sparks.push({ x: v.x + 300, y: v.y, xp: 1, pulled: false, dead: false });
      v.pickups.push({ kind: 'magnet', x: v.x, y: v.y, t: 0, dead: false });
      v.step(1 / 30, STILL);
      expect(v.sparks.every((g) => g.pulled)).toBe(true);
    });

    it('Second Wind gets you up once, and only once', () => {
      const v = new Vigil(8, 2000, 2000);
      const wound = (v as unknown as { wound(h: unknown, d: number): void }).wound.bind(v);
      v.strengths.wind = 1;
      v.hp = 1;
      wound(v.me, 50);
      expect(v.over).toBe(false);
      expect(v.me.down).toBe(false);
      expect(v.hp).toBeGreaterThan(1);
      v.me.iframe = 0;
      v.hp = 1;
      wound(v.me, 50);
      expect(v.me.down).toBe(true);
      v.step(1 / 30, STILL);
      expect(v.over).toBe(true);
    });

    it('relics do what they say: glass trades health for damage', () => {
      const v = new Vigil(9, 2000, 2000);
      const hp = v.maxHp;
      const dmg = v.statsOf(v.me, firstSpell('mage')).dmg;
      v.strengths.glass = 1;
      expect(v.maxHp).toBeCloseTo(hp * 0.75);
      expect(v.statsOf(v.me, firstSpell('mage')).dmg).toBeCloseTo(dmg * 1.4);
    });
  });

  describe('a party', () => {
    const party = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, cls: (['mage', 'warrior', 'priest', 'ranger'] as const)[i]!, name: `P${i + 1}` }));
    const all = (v: Vigil, input: VigilInput): Record<number, VigilInput> => Object.fromEntries(v.heroes.map((h) => [h.id, input]));

    it('gets harder with each hero, and it shows in the night', () => {
      expect(partyScale(1)).toEqual({ count: 1, hp: 1, dmg: 1, boss: 1, xp: 1 });
      for (let n = 2; n <= 4; n++) {
        const a = partyScale(n - 1);
        const b = partyScale(n);
        expect(b.count).toBeGreaterThan(a.count);
        expect(b.hp).toBeGreaterThan(a.hp);
      }
      const count = (n: number): number => {
        const v = new Vigil(3, 2000, 2000, { party: party(n) });
        for (const h of v.heroes) {
          h.hp = 1e9;
          h.spells = {};
        }
        for (let i = 0; i < 30 * 20; i++) v.step(1 / 30, all(v, STILL));
        return v.foes.length;
      };
      expect(count(4)).toBeGreaterThan(count(1) * 1.5);
    });

    it('everyone chooses before the night goes on, and nobody can hold it up for long', () => {
      const v = new Vigil(4, 2000, 2000, { party: party(3) });
      for (const h of v.heroes) h.owed = 1;
      v.step(1 / 30, all(v, STILL));
      expect(v.heroes.every((h) => h.cards)).toBe(true);
      const t = v.t;
      v.choose(0, 1);
      v.step(1, all(v, STILL));
      expect(v.t).toBe(t);
      v.choose(0, 2);
      // the third has gone to make tea
      for (let i = 0; i < 14; i++) v.step(1, all(v, STILL));
      expect(v.heroes[2]!.cards).toBeNull();
      v.step(1 / 30, all(v, STILL));
      expect(v.t).toBeGreaterThan(t);
    });

    it('one level gives everyone a choice', () => {
      const v = new Vigil(5, 2000, 2000, { party: party(2) });
      (v as unknown as { gain(xp: number, h: unknown): void }).gain(1000, v.heroes[0]);
      expect(v.heroes[0]!.owed).toBe(v.heroes[1]!.owed);
      expect(v.heroes[0]!.owed).toBeGreaterThan(0);
    });

    it('a downed hero is got up by a friend, and the night ends only when all are down', () => {
      const v = new Vigil(6, 2000, 2000, { party: party(2) });
      const wound = (v as unknown as { wound(h: unknown, d: number): void }).wound.bind(v);
      const a = v.heroes[0]!;
      const b = v.heroes[1]!;
      a.hp = 1;
      wound(a, 50);
      expect(a.down).toBe(true);
      expect(v.over).toBe(false);
      b.hp = 1e9;
      b.x = a.x + 500;
      for (let i = 0; i < 30; i++) v.step(1 / 30, all(v, STILL));
      expect(a.down).toBe(true);
      b.x = a.x + 10;
      b.y = a.y;
      for (let i = 0; i < 30 * 4; i++) {
        for (const h of v.heroes) if (h.cards) v.choose(0, h.id);
        v.step(1 / 30, all(v, STILL));
      }
      expect(a.down).toBe(false);
      expect(a.hp).toBeGreaterThan(1);
      a.hp = 1;
      a.iframe = 0;
      b.hp = 1;
      b.iframe = 0;
      wound(a, 50);
      wound(b, 50);
      v.step(1 / 30, all(v, STILL));
      expect(v.over).toBe(true);
    });

    it('a party holds fewer foes, and its reports fit through the room', () => {
      const v = new Vigil(7, 2000, 2000, { party: party(4) });
      v.fxOut = [];
      const w = new SnapWriter();
      for (const h of v.heroes) {
        h.hp = 1e12;
        h.spells = { [spellsOf(h.cls)[0]!.id]: 6, [spellsOf(h.cls)[1]!.id]: 6, [spellsOf(h.cls)[2]!.id]: 6 };
      }
      let longest = 0;
      let most = 0;
      for (let t = 0; t < 600; t += 1 / 10) {
        for (const h of v.heroes) if (h.cards) v.choose(0, h.id);
        v.step(1 / 10, all(v, { mx: 0.3, my: 0.1 }));
        most = Math.max(most, v.foes.length);
        if (Math.floor(t * 10) % 20 === 0) longest = Math.max(longest, JSON.stringify(w.write(v, 2)).length);
      }
      expect(most).toBeLessThanOrEqual(MAX_FOES_PARTY + 8);
      expect(longest).toBeLessThan(maxMessage);
    }, 60_000);

    it('a friend’s game shows what the host’s game says', () => {
      const host = new Vigil(8, 2000, 2000, { party: party(2) });
      host.fxOut = [];
      const friend = new Vigil(8, 2000, 2000, { party: party(2) });
      const w = new SnapWriter();
      for (const h of host.heroes) h.hp = 1e9;
      for (let i = 0; i < 30 * 40; i++) {
        for (const h of host.heroes) if (h.cards) host.choose(0, h.id);
        host.step(1 / 30, all(host, { mx: 0.5, my: 0 }));
      }
      for (const h of host.heroes) if (h.cards) host.choose(0, h.id);
      applySnap(friend, JSON.parse(JSON.stringify(w.write(host, 1))), 2);
      expect(friend.t).toBeCloseTo(host.t, 0);
      expect(friend.foes.length).toBe(host.foes.length);
      expect(friend.level).toBe(host.level);
      expect(friend.kills).toBe(host.kills);
      expect(friend.heroes[0]!.spells).toEqual(host.heroes[0]!.spells);
      expect(friend.heroes[1]!.cards).toEqual(host.heroes[1]!.cards);
      // and in between, everything slides to where it was said to be
      friend.heroes[1]!.cards = null;
      friend.heroes[0]!.cards = null;
      const f0 = friend.foes[0]!;
      for (let i = 0; i < 40; i++) friend.follow(1 / 30, 2, { mx: 0, my: 0 });
      expect(f0.x).toBeCloseTo(f0.tx, 0);
      // the friend's own hero moves at once
      const me = friend.heroes[1]!;
      const before = me.x;
      friend.follow(1 / 30, 2, { mx: 1, my: 0 });
      expect(me.x).toBeGreaterThan(before);
    });

    it('the room seats four, takes a land from its host only, and passes the night along', () => {
      const s = room.newRoom('ABCDE', 1, 7);
      for (const [i, key] of ['aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'cccccccccccc', 'dddddddddddd'].entries()) expect(room.join(s, key, `P${i}`, 1)).toBeNull();
      expect(room.join(s, 'eeeeeeeeeeee', 'P5', 1)).toBeTruthy();
      expect(room.act(s, 'bbbbbbbbbbbb', { t: 'land', map: 'thornvale' }, 2)).toBe('not_host');
      expect(room.act(s, 'aaaaaaaaaaaa', { t: 'land', map: 'thornvale' }, 2)).toBeNull();
      expect(s.map).toBe('thornvale');
      expect(room.act(s, 'aaaaaaaaaaaa', { t: 'start' }, 3)).toBe('no_pick');
      expect(room.act(s, 'aaaaaaaaaaaa', { t: 'pick', pick: { cls: 'mage', body: 'f', face: { skin: 1, hair: 2, style: 'long', beard: false } } }, 3)).toBeNull();
      expect(room.act(s, 'bbbbbbbbbbbb', { t: 'pick', pick: { cls: '<script>', body: 'm', face: null } }, 3)).toBe('bad_pick');
      expect(room.act(s, 'aaaaaaaaaaaa', { t: 'start' }, 4)).toBeNull();
      expect(s.phase).toBe('run');
      expect(room.relay(s, 'bbbbbbbbbbbb', { t: 'r', d: { i: [1, 0, 0] } })?.others).toBeTruthy();
      expect(room.viewFor(s, 'bbbbbbbbbbbb')?.seats).toHaveLength(4);
    });
  });
});

describe('Sigilfall Vigil: what a night leaves behind', () => {
  it('keeps each class’s longest night per land, a codex of evolutions found, and titles at 5, 10 and 15 minutes', async () => {
    const { readClassBests, saveClassBest, readCodex, addToCodex, saveBest, VIGIL_TITLES, vigilTaught, markVigilTaught } = await import('../src/games/sigilfall/vigil/bests');
    const { TITLES } = await import('../src/games/sigilfall/progress/titles');
    const { newCharacter } = await import('../src/games/sigilfall/progress/character');
    localStorage.clear();
    saveClassBest('whisperwood', 'mage', 80.6);
    saveClassBest('whisperwood', 'mage', 40);
    saveClassBest('whisperwood', 'warrior', 120);
    expect(readClassBests().whisperwood).toEqual({ mage: 80, warrior: 120 });
    expect(addToCodex(['ember-bolt'])).toEqual(['ember-bolt']);
    expect(addToCodex(['ember-bolt', 'frost-ring'])).toEqual(['frost-ring']);
    expect([...readCodex()].sort()).toEqual(['ember-bolt', 'frost-ring']);
    expect(vigilTaught()).toBe(false);
    markVigilTaught();
    expect(vigilTaught()).toBe(true);
    // the titles: earned by the longest night on this device, worn by any hero
    const hero = newCharacter('mage', 'V', 'v', 0);
    const titles = VIGIL_TITLES.map((t) => TITLES.find((x) => x.id === t.id)!);
    expect(titles.every((t) => !t.earned(hero))).toBe(true);
    saveBest('thornvale', 610);
    expect(titles.map((t) => t.earned(hero))).toEqual([true, true, false]);
    localStorage.clear();
  });
});
