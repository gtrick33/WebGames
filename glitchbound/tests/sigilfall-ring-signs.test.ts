/**
 * The Ring's looks, after the owner's note of 2026-11-16: "go over every passive, every active spell and make sure the
 * animations, the effects and the visuals are mesmerizing, unique, there's no jiterring of effects on spells and
 * characters (mostly thinking about the jittery rogue gloamknight while moving), whether everything has its purpose".
 * Every ability has a sign of its own (render/ringSigns.ts), what a fighter carries of their combo is drawn on them,
 * and the two things that made a figure jitter are gone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABILITIES, BOONS, PRESETS, ultOf } from '../src/games/sigilfall/arena/abilities';
import { flightTime, GATES, Match, type Fighter, type FighterSetup } from '../src/games/sigilfall/arena/sim';
import { TALENTS } from '../src/games/sigilfall/arena/talents';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { flyEase, RingFx } from '../src/games/sigilfall/render/ring';
import { drawBoon, drawFade, drawFlight, drawGlobe, drawPoints, drawShatter, drawSign, hasFlight, hasSign, SHATTER_HOLD, SHATTER_T, signAlone, signed, signTime, type Sign, type SignKind } from '../src/games/sigilfall/render/ringSigns';
import { FX, type Fx3D } from '../src/games/sigilfall/render3d/fx3d';

const read = (p: string): string => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
type Quad = Parameters<Fx3D['put']>[0];
/** Something to draw on that only keeps what it was given. */
const sheet = (): { q: Fx3D; quads: Quad[] } => {
  const quads: Quad[] = [];
  return { q: { put: (x: Quad) => void quads.push(x) } as unknown as Fx3D, quads };
};
const KINDS: SignKind[] = ['cast', 'land', 'zone'];
const drawn = (ab: string, k: SignKind, u: number): Quad[] => {
  const s = sheet();
  const sign: Sign = { ab, k, x: 100, y: 100, a: 0.3, t: signTime(ab, k) * u, dur: signTime(ab, k), seed: 1.3, r: 44 };
  drawSign(s.q, sign, 100, 100, 2);
  return s.quads;
};
/** What a sign is made of, a third of the way through: its shapes and colors, in order. */
const print = (ab: string, k: SignKind): string => drawn(ab, k, 0.35).map((x) => `${x.kind}:${x.a}:${Math.round(x.w)}`).join('|');
/** Drawn in their own way elsewhere in render/ring.ts: a stream of life, the dead clawing up, a hand of shadow. */
const ELSEWHERE = ['k-drain', 'k-raise', 'g-hand'];

describe('The Ring: every ability has a look of its own', () => {
  it('each of a playstyle’s four and its super is signed, or drawn in its own way elsewhere', () => {
    let n = 0;
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        for (const id of [...p.bar, p.ult]) {
          n++;
          const ab = id === p.ult ? ultOf(cls, p.ult) : ABILITIES[id]!;
          expect(KINDS.some((k) => hasSign(ab.id, k)) || ELSEWHERE.includes(ab.id), `${p.name}: ${ab.name}`).toBe(true);
          // what is placed on the ground is signed where it comes down; what lands on someone, on them
          if (ab.aim === 'ground' && !ab.field) expect(hasSign(ab.id, 'zone'), ab.name).toBe(true);
        }
      }
    }
    expect(n).toBe(80);
    // (and nothing is signed that isn't an ability of the Ring)
    for (const id of signed()) expect(ABILITIES[id] ?? CLASS_IDS.map((c) => PRESETS[c].map((p) => ultOf(c, p.ult))).flat().find((a) => a.id === id), id).toBeTruthy();
  });

  it('a sign is drawn from its first moment to its last, in shapes the game has, and is gone when its time is up', () => {
    const kinds = new Set<number>(Object.values(FX));
    for (const id of signed()) {
      for (const k of KINDS) {
        if (!hasSign(id, k)) continue;
        expect(signTime(id, k), id).toBeGreaterThanOrEqual(0.4);
        expect(signTime(id, k), id).toBeLessThanOrEqual(1.2);
        let most = 0;
        for (const u of [0, 0.15, 0.35, 0.6, 0.85, 0.99]) {
          const quads = drawn(id, k, u);
          most = Math.max(most, quads.length);
          for (const x of quads) {
            expect(kinds.has(x.kind), `${id} ${k}`).toBe(true);
            for (const v of [x.x, x.y, x.w, x.up ?? 0, x.h ?? 0, x.rot ?? 0, x.alpha ?? 1, x.t ?? 0]) expect(Number.isFinite(v), `${id} ${k} at ${u}`).toBe(true);
            expect(x.a, id).toMatch(/^#[0-9a-f]{6}$/i);
            // (nothing so large it hides the fight: a super's own patch is the largest thing there is)
            expect(x.w, `${id} ${k}`).toBeLessThanOrEqual(190);
          }
          // (and never so many shapes that a fight of six would run out of them: fx3d's 1,400 a frame)
          expect(quads.length, `${id} ${k}`).toBeLessThanOrEqual(60);
        }
        expect(most, `${id} ${k} draws something`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('no two abilities share a look: every sign is made of its own shapes, colors and sizes', () => {
    const seen = new Map<string, string>();
    for (const id of signed()) {
      for (const k of KINDS) {
        if (!hasSign(id, k)) continue;
        const key = print(id, k);
        expect(seen.get(key), `${id} ${k} looks like ${seen.get(key)}`).toBeUndefined();
        seen.set(key, `${id} ${k}`);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(80);
    // (within a playstyle, the abilities that land on someone are told apart by shape, not only by color)
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        const shapes = [...p.bar, p.ult].filter((id) => hasSign(id, 'land')).map((id) => drawn(id, 'land', 0.35).map((x) => x.kind).join(','));
        expect(new Set(shapes).size, p.name).toBe(shapes.length);
      }
    }
  });

  it('a sign says what the ability does: a stun rings, a bleed is red, a root comes up out of the ground, a heal rises', () => {
    const has = (id: string, k: SignKind, kind: number): boolean => [0.2, 0.5, 0.8].some((u) => drawn(id, k, u).some((x) => x.kind === kind));
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        for (const id of p.bar) {
          const ab = ABILITIES[id]!;
          if (!hasSign(id, 'land')) continue;
          // what stuns one enemy ends in a ring of force or a knock of light
          if (ab.aim === 'enemy' && ab.effects.some((e) => e.k === 'cc' && e.cc === 'stun')) expect(has(id, 'land', FX.shock) || has(id, 'land', FX.impact), ab.name).toBe(true);
          // what heals a friend goes up: a shaft, or motes wound upward
          if (ab.aim === 'friend' && ab.effects.some((e) => e.k === 'heal')) expect(has(id, 'land', FX.shaft) || drawn(id, 'land', 0.5).some((x) => (x.up ?? 0) > 20), ab.name).toBe(true);
        }
      }
    }
    // (a bleed throws red; a root stands up out of the ground; what is crossed out is a silence)
    for (const id of ['w-gash', 'w-bleed']) expect(drawn(id, 'land', 0.4).some((x) => x.a === '#d0283c'), id).toBe(true);
    expect(drawn('l-roots', 'land', 0.5).filter((x) => x.kind === FX.frost && Math.abs((x.rot ?? 0) - Math.PI / 2) < 0.5).length).toBeGreaterThanOrEqual(5);
    expect(drawn('p-hush', 'land', 0.5).filter((x) => x.kind === FX.slash)).toHaveLength(2);
    // a combo's payoff is a bigger thing than its setup
    const size = (id: string): number => Math.max(...drawn(id, 'land', 0.4).map((x) => x.w));
    expect(size('m-burn')).toBeGreaterThan(size('m-lash'));
    expect(size('g-cut')).toBeGreaterThan(size('g-knife'));
    expect(size('d-fall')).toBeGreaterThan(size('d-blow'));
  });

  it('the match’s events bring them up: on its user as it is used, on whoever it lands on, on its patch', () => {
    const fighter = (team: 0 | 1, cls: (typeof CLASS_IDS)[number], i = 0): FighterSetup => ({ team, cls, name: cls, bar: [...PRESETS[cls][i]!.bar], talents: [], ult: PRESETS[cls][i]!.ult });
    const m = new Match({ seed: 3, map: 'sands', fighters: [fighter(0, 'mage', 1), fighter(1, 'warrior')] });
    m.step(GATES + 0.01, {});
    const fx = new RingFx();
    const [me, foe] = m.fighters as [Match['fighters'][0], Match['fighters'][0]];
    m.events = [
      { k: 'ab', id: me.id, ab: 'm-ring' },
      { k: 'land', id: foe.id, ab: 'm-ring' },
      { k: 'land', id: foe.id, ab: 'm-fang' },
      { k: 'zone', x: 50, y: 60, r: 40, ab: 'm-super' },
    ];
    fx.take(m, () => {}, me.id);
    expect(fx.signs.map((s) => `${s.ab} ${s.k}`)).toEqual(['m-ring cast', 'm-ring land', 'm-fang land', 'm-super zone']);
    // (on a fighter it goes with them; a patch stays where it is)
    expect(fx.signs.map((s) => s.on)).toEqual([me.id, foe.id, foe.id, undefined]);
    expect(fx.signs[3]).toMatchObject({ x: 50, y: 60, r: 40 });
    // a landing with a sign of its own is drawn in place of its school's burst (Frostfang's bite too: its Shatter is
    // drawn by itself, render/ringSigns.ts drawShatter)
    expect(signAlone('m-ring')).toBe(true);
    expect(signAlone('m-fang')).toBe(true);
    expect(fx.bursts).toHaveLength(0);
    // and they run their time and are gone
    fx.age(0.5);
    expect(fx.signs.length).toBeGreaterThan(0);
    fx.age(1.2);
    expect(fx.signs).toHaveLength(0);
  });
});

describe('The Ring: what a fighter carries of their combo is drawn on them', () => {
  it('points: as many as are held, each kind in a shape of its own, and a ring when no more can be', () => {
    const names = [...new Set([...CLASS_IDS.flatMap((c) => PRESETS[c].flatMap((p) => (p.points ? [p.points.name] : []))), ...CLASS_IDS.flatMap((c) => TALENTS[c].flatMap((t) => (t.points ? [t.points.name] : [])))])];
    expect(names.length).toBeGreaterThanOrEqual(14);
    const looks = new Set<string>();
    for (const name of names) {
      const a = sheet();
      drawPoints(a.q, 10, 10, name, 2, 5, '#ff00ff', 1, 0);
      expect(a.quads, name).toHaveLength(2);
      const b = sheet();
      drawPoints(b.q, 10, 10, name, 5, 5, '#ff00ff', 1, 0);
      expect(b.quads, name).toHaveLength(6);
      expect(b.quads.at(-1)!.kind).toBe(FX.ring);
      looks.add(`${a.quads[0]!.kind}:${Math.round(a.quads[0]!.w)}:${a.quads[0]!.h ?? 0}:${a.quads[0]!.up !== undefined && a.quads[0]!.up > 20 ? 'crown' : a.quads[0]!.up !== undefined && a.quads[0]!.up < 6 ? 'feet' : 'orbit'}`);
    }
    // (every kind of points has a look of its own: none falls back on a plain mote)
    expect(looks.size).toBe(names.length);
    const none = sheet();
    drawPoints(none.q, 10, 10, 'Nicks', 0, 5, '#ff00ff', 1, 0);
    expect(none.quads).toHaveLength(0);
  });

  it('a boon: a mark of its color at their feet and motes going up, for the other side to read too', () => {
    const one = sheet();
    drawBoon(one.q, 10, 10, BOONS.hoar!.color, 1, 1, 0);
    expect(one.quads[0]).toMatchObject({ kind: FX.mark, a: BOONS.hoar!.color, flat: true });
    const two = sheet();
    drawBoon(two.q, 10, 10, BOONS.hoar!.color, 2, 1, 0);
    expect(two.quads.length).toBeGreaterThan(one.quads.length);
    // (drawn for every fighter who is seen, by the match's own screen)
    const ring = read('src/games/sigilfall/render/ring.ts');
    expect(ring).toContain('if (f.points && f.pts > 0) drawPoints(q, p.x, p.y, f.points.name, f.pts, f.points.max, f.points.color, time, f.id * 1.9);');
    expect(ring).toMatch(/if \(def && !def\.quiet && b\.n > 0\) drawBoon\(/);
  });

  it('a life drunk is a stream, a chain is links, and whoever is up in the dark is seen coming down', () => {
    const ring = read('src/games/sigilfall/render/ring.ts');
    expect(ring).toMatch(/if \(!f\.cast\?\.channel \|\| f\.dead \|\| unseen\(f\)\) continue;/);
    expect(ring).toMatch(/if \(ab\.id === 'g-chain'\) \{[\s\S]{0,200}this\.lines\.push/);
    expect(ring).toMatch(/if \(!f\.dive\) continue;[\s\S]{0,900}kind: FX\.column[\s\S]{0,900}kind: FX\.shadow, x: p\.x, y: p\.y, up: 2, flat: true/);
  });
});

describe('The Ring: what a mage throws is told apart in the air', () => {
  // (the owner, 2026-11-17: "make the visual cue better for the different spells". A Rime Spear and a Frostfang flew as
  // the same shard of frost, an Ember Lash and a Flashburn as the same ball of fire.)
  const THROWN = ['m-lash', 'm-burn', 'm-toad', 'm-spear', 'm-fang'];
  const flight = (ab: string, strong = false, time = 2): Quad[] => {
    const s = sheet();
    expect(drawFlight(s.q, ab, 100, 100, 0.8, 0.6, time, 1.3, 40, strong, 0.5), ab).toBe(true);
    return s.quads;
  };
  const shape = (quads: Quad[]): string => quads.map((x) => `${x.kind}:${x.a}:${Math.round(x.w)}`).join('|');

  it('each of a mage’s thrown abilities has a shape of its own on the way', () => {
    for (const p of PRESETS.mage) {
      for (const id of p.bar) {
        const ab = ABILITIES[id]!;
        // (what flies to someone: a bolt, or what lands at once and is seen crossing)
        if (ab.aim === 'enemy') expect(hasFlight(id), ab.name).toBe(true);
      }
    }
    const shapes = THROWN.map((id) => shape(flight(id)));
    expect(new Set(shapes).size).toBe(THROWN.length);
    for (const id of THROWN) {
      const quads = flight(id);
      expect(quads.length, id).toBeGreaterThanOrEqual(3);
      for (const x of quads) {
        expect(Number.isFinite(x.x) && Number.isFinite(x.y) && Number.isFinite(x.w), id).toBe(true);
        expect(x.w, id).toBeGreaterThan(0);
      }
    }
    // (anything not named flies as its school does)
    expect(drawFlight(sheet().q, 'k-dart', 100, 100, 1, 0, 2, 1)).toBe(false);
  });

  it('a Rime Spear thrown while the globe is out is seen to be the stronger one', () => {
    const plain = flight('m-spear');
    const strong = flight('m-spear', true);
    expect(strong.length).toBeGreaterThan(plain.length);
    expect(strong.filter((x) => x.kind === FX.frost)).toHaveLength(2);
    expect(strong.some((x) => x.kind === FX.ring)).toBe(true);
    const ring = read('src/games/sigilfall/render/ring.ts');
    expect(ring).toContain('(b.p?.k ?? 1) > 1.3;');
  });

  it('nothing about a shot flickers: where its parts sit does not depend on where it is', () => {
    // (a seed taken from its place changed every frame as it flew)
    const ring = read('src/games/sigilfall/render/ring.ts');
    expect(ring).toContain('drawFlight(q, b.ab, b.x, b.y, Math.cos(a), Math.sin(a), time, b.src * 1.7 + b.tgt,');
  });

  it('a globe of rime shows where it lands, when it lands, and that it is on its way to someone', () => {
    const at = (vx: number, since: number): Quad[] => {
      const s = sheet();
      drawGlobe(s.q, 200, 120, 41, vx, 0, since, 1, 2);
      return s.quads;
    };
    const still = at(0, 0.8);
    // its reach on the ground, exactly as wide as it lands
    expect(still.filter((x) => x.flat && x.w === 82).map((x) => x.kind).sort()).toEqual([FX.field, FX.ring].sort());
    // a ring thrown out as it lands, and gone by the time it next does
    expect(at(0, 0.1).some((x) => x.kind === FX.shock)).toBe(true);
    expect(still.some((x) => x.kind === FX.shock)).toBe(false);
    // going after someone, what it sheds lies behind it
    const flakes = at(59, 0.8).filter((x) => x.kind === FX.flake);
    expect(flakes.length).toBeGreaterThan(3);
    for (const x of flakes) expect(x.x).toBeLessThan(200);
    expect(read('src/games/sigilfall/render/ring.ts')).toMatch(/if \(ab\.field\?\.seek\) \{\s*drawGlobe\(/);
  });

  it('fading from sight leaves a puff where they stood, for both sides', () => {
    const s = sheet();
    drawFade(s.q, 150, 150, 0.3, 1);
    expect(s.quads.length).toBeGreaterThan(8);
    expect(s.quads.some((x) => x.kind === FX.smoke)).toBe(true);
    for (const x of s.quads) expect(Number.isFinite(x.x) && Number.isFinite(x.y) && x.w > 0).toBe(true);
    // the event is taken even by whoever can no longer see them, and the puff ages out
    const m = new Match({ seed: 5, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'a', bar: PRESETS.mage[0]!.bar, talents: ['m-3c'] }, { team: 1, cls: 'warrior', name: 'b', bar: PRESETS.warrior[0]!.bar, talents: [] }] });
    m.step(GATES + 0.01, {});
    const [mage, foe] = m.fighters as [Fighter, Fighter];
    mage.hp = Math.round(mage.maxHp * 0.4);
    (m as unknown as { damage(src: Fighter, t: Fighter, n: number, direct: boolean): number }).damage(foe, mage, 100, true);
    expect(m.unseen(mage, foe)).toBe(true);
    const fx = new RingFx();
    fx.take(m, () => {}, foe.id);
    expect(fx.fades).toHaveLength(1);
    expect([fx.fades[0]!.x, fx.fades[0]!.y]).toEqual([mage.x, mage.y]);
    fx.age(1);
    expect(fx.fades).toHaveLength(0);
  });
});

describe('The Ring: Frostfang is watched, and lands as it is seen to', () => {
  // (the owner, 2026-11-17: "please add way better anims for frostfang, we need not such a fast bolt, make it fitting
  // and animated"; and later that day, "frostfang animation looks bad imo, i want better animation for that, also idk if
  // the dmg and the spell cast is desynced BUT, casting the spell with shatter doesnt feel like im hitting anything,
  // make it impactful". It was desynced: what it did landed as it left the hand, its picture a third of a second later.)
  const thrown = (): { m: Match; me: Fighter; foe: Fighter } => {
    const m = new Match({ seed: 3, map: 'sands', fighters: [{ team: 0, cls: 'mage', name: 'a', bar: PRESETS.mage[1]!.bar, talents: [] }, { team: 1, cls: 'warrior', name: 'b', bar: PRESETS.warrior[0]!.bar, talents: [] }] });
    m.step(GATES + 0.01, {});
    const [me, foe] = m.fighters as [Fighter, Fighter];
    me.x = 100;
    me.y = 120;
    foe.x = 220;
    foe.y = 120;
    me.target = foe.id;
    foe.hp = foe.maxHp = 50000;
    m.events.length = 0;
    return { m, me, foe };
  };

  it('it takes a third of a second or so to cross, however near or far, where the rest that land at once take a blink', () => {
    const fang = ABILITIES['m-fang']!;
    expect(flightTime(fang, 30)).toBe(fang.flight!.least);
    expect(flightTime(fang, 120)).toBeCloseTo(120 / fang.flight!.per, 5);
    expect(flightTime(fang, 400)).toBe(fang.flight!.most);
    expect(fang.flight!.least).toBeGreaterThanOrEqual(0.25);
    expect(fang.flight!.most).toBeLessThanOrEqual(0.45);
    expect(flightTime(ABILITIES['m-burn']!, 120)).toBe(0);
  });

  it('nothing of it lands until the fang gets there: the hurt, the number, the bite and its sound all come together', () => {
    const { m, me, foe } = thrown();
    expect(m.press(me.id, 'm-fang')).toBeNull();
    const fx = new RingFx();
    const heard: string[] = [];
    fx.take(m, (id) => void heard.push(id), me.id);
    expect(foe.hp).toBe(50000);
    expect(fx.pops).toHaveLength(0);
    expect(fx.signs.some((s) => s.ab === 'm-fang' && s.k === 'land')).toBe(false);
    // (thrown with a whistle, not the crunch of its landing)
    expect(heard).toEqual(['spear']);
    const dur = m.bolts[0]!.dur!;
    expect(dur).toBeCloseTo(flightTime(ABILITIES['m-fang']!, 120), 5);
    let t = 0;
    while (m.bolts.length && t < 1) {
      m.step(1 / 60, {});
      t += 1 / 60;
    }
    expect(t).toBeCloseTo(dur, 1);
    heard.length = 0;
    fx.take(m, (id) => void heard.push(id), me.id);
    expect(foe.hp).toBeLessThan(50000);
    expect(fx.pops).toHaveLength(1);
    expect(fx.signs.find((s) => s.ab === 'm-fang' && s.k === 'land')!.t).toBe(0);
    // (ice breaking, not a ball of fire going off)
    expect(heard).toContain('freeze');
    expect(heard).not.toContain('explode');
  });

  it('it goes after whoever it was thrown at, and a root that wears off while it crosses doesn’t take its Shatter back', () => {
    const { m, me, foe } = thrown();
    foe.auras.push({ ab: 'l-roots', kind: 'cc', cc: 'root', src: 1, t: 0.05, dur: 2, harmful: true, magic: true, n: 0, took: 0 });
    expect(m.press(me.id, 'm-fang')).toBeNull();
    expect(m.bolts[0]!.p?.combo).toBe(true);
    // (they walk off and the root runs out while it is on its way)
    for (let i = 0; i < 40 && m.bolts.length; i++) m.step(1 / 60, { [foe.id]: { mx: 0, my: 1 } });
    expect(foe.auras.some((a) => a.cc === 'root')).toBe(false);
    expect(foe.y).toBeGreaterThan(121);
    expect(m.events.some((e) => e.k === 'word' && e.word === 'Shatter')).toBe(true);
  });

  it('in the air: it forms at the hand, goes point first with splinters wound round it, quicker and quicker', () => {
    const at = (u: number, strong = false): Quad[] => {
      const s = sheet();
      drawFlight(s.q, 'm-fang', 100, 100, 1, 0, 2, 1.3, 120 * flyEase(u), strong, u);
      return s.quads;
    };
    const fangs = (u: number, strong = false): Quad[] => at(u, strong).filter((x) => x.kind === FX.frost);
    // (a knot of cold at the hand first, and the fang grows out of it)
    expect(at(0.05).some((x) => x.kind === FX.gather)).toBe(true);
    expect(at(0.6).some((x) => x.kind === FX.gather)).toBe(false);
    expect(fangs(0.05)[0]!.w).toBeLessThan(fangs(0.5)[0]!.w);
    // (its point is turned off its root: a hooked tooth, not a straight spear)
    const [root, tip] = fangs(0.5);
    expect(Math.abs((tip!.rot ?? 0) - (root!.rot ?? 0))).toBeGreaterThan(0.2);
    // (two splinters wind round it: where they are changes as it goes)
    const ys = (u: number): number[] => fangs(u).slice(2).map((x) => Math.round(x.y));
    expect(fangs(0.5)).toHaveLength(4);
    expect(ys(0.4)).not.toEqual(ys(0.6));
    // (slow off the hand, fast into them)
    expect(flyEase(0.5)).toBeLessThan(0.35);
    expect(flyEase(1) - flyEase(0.9)).toBeGreaterThan(2 * (flyEase(0.1) - flyEase(0)));
    // one that will Shatter is bigger, and crackles
    expect(fangs(0.5, true)[0]!.w).toBeGreaterThan(fangs(0.5)[0]!.w);
    expect(at(0.5, true).some((x) => x.kind === FX.ring)).toBe(true);
    expect(at(0.5).some((x) => x.kind === FX.ring)).toBe(false);
    // (drawn where the rules have it and where its target's body is, from the hand on)
    expect(read('src/games/sigilfall/render/ring.ts')).toContain('const end = to && !to.dead ? at(to) : { x: b.x, y: b.y + 8 };');
  });

  it('a Shatter: held in the ice, then it breaks, the shards thrown up and out and falling back, gone when its time is up', () => {
    const at = (u: number): Quad[] => {
      const s = sheet();
      drawShatter(s.q, 100, 100, u, 0, 1.1);
      return s.quads;
    };
    const hold = SHATTER_HOLD / SHATTER_T;
    // (held: the ice over them, nothing thrown yet)
    expect(at(hold * 0.5).some((x) => x.kind === FX.bubble)).toBe(true);
    expect(at(hold * 0.5).some((x) => x.kind === FX.impact)).toBe(false);
    // (it breaks: a flash, a ring of cold out over the ground, the ground cracked, shards out)
    const broke = at(0.3);
    for (const k of [FX.impact, FX.shock, FX.crack]) expect(broke.some((x) => x.kind === k), String(k)).toBe(true);
    const shards = (u: number): Quad[] => at(u).filter((x) => x.kind === FX.frost);
    expect(shards(0.3).length).toBeGreaterThanOrEqual(10);
    const spread = (u: number): number => Math.max(...shards(u).map((x) => Math.hypot(x.x - 100, (x.y - 100) / 0.6)));
    expect(spread(0.5)).toBeGreaterThan(spread(0.2));
    // (they come back down: fewer in the air at the end than at the height of it)
    expect(shards(0.98).length).toBeLessThan(shards(0.3).length);
    for (const u of [0, 0.05, 0.2, 0.5, 0.8, 0.99]) {
      const q = at(u);
      expect(q.length).toBeLessThanOrEqual(60);
      for (const x of q) for (const v of [x.x, x.y, x.w, x.up ?? 0, x.alpha ?? 1, x.t ?? 0, x.rot ?? 0]) expect(Number.isFinite(v)).toBe(true);
    }
    // (nothing so large it hides the fight)
    for (const u of [0.15, 0.3, 0.6]) expect(Math.max(...at(u).map((x) => x.w))).toBeLessThanOrEqual(120);
  });

  it('a Shatter is felt: the burst on them, its own crunch, a number thrown up icy and big, and the body held a moment', () => {
    const { m, me, foe } = thrown();
    foe.auras.push({ ab: 'l-roots', kind: 'cc', cc: 'root', src: 1, t: 5, dur: 5, harmful: true, magic: true, n: 0, took: 0 });
    expect(m.press(me.id, 'm-fang')).toBeNull();
    const fx = new RingFx();
    fx.take(m, () => {}, me.id);
    for (let i = 0; i < 40 && m.bolts.length; i++) m.step(1 / 60, {});
    const heard: string[] = [];
    fx.take(m, (id) => void heard.push(id), me.id);
    expect(fx.shatters).toHaveLength(1);
    expect(fx.shatters[0]).toMatchObject({ on: foe.id });
    expect(heard).toContain('shatter');
    const n = fx.pops.find((p) => !p.word)!;
    expect(n).toMatchObject({ punch: true, big: true });
    fx.age(SHATTER_T + 0.01);
    expect(fx.shatters).toHaveLength(0);
    // (the body is held still in the ice and flinches as it breaks; never the camera: render3d/ring3d.ts shatter)
    const view = read('src/games/sigilfall/render3d/ring3d.ts');
    expect(view).toMatch(/shatter\(id: number\): void \{[\s\S]{0,200}s\.stop = this\.still \? 0 : SHATTER_HOLD;/);
    expect(view).not.toMatch(/shatter\(id: number\): void \{[^}]*this\.quake/);
    expect(read('src/games/sigilfall/ui/RingMatch.tsx')).toContain("else if (e.k === 'word' && e.combo && e.word === 'Shatter') view.shatter(e.id);");
  });
});

describe('The Ring: nothing jitters', () => {
  it('a figure thinned away (the Nightblade in the shroud) carries its pattern with it', () => {
    const toon = read('src/games/sigilfall/render3d/toon.ts');
    // (laid from where the figure stands in the picture, not on the screen itself: a figure walking through a pattern
    // fixed to the screen shimmered, every point of it flickering as it crossed)
    expect(toon).toContain('vec2 cell = floor(gl_FragCoord.xy - vRoot);');
    expect(toon).not.toMatch(/float dx = mod\(gl_FragCoord\.x, 4\.0\);\s*float dy = mod\(gl_FragCoord\.y, 4\.0\);\s*float th = [^\n]*\n\s*if \(vAlpha < th\) discard;/);
    expect(toon.match(/\$\{ROOT_VERT\}/g)).toHaveLength(2);
    expect(read('src/games/sigilfall/render3d/stage.ts')).toContain('this.gl.getDrawingBufferSize(LIGHT.uRes.value);');
  });

  it('a blow struck on the run does not throw the body forward and back, and its pose is short', () => {
    const ring3d = read('src/games/sigilfall/render3d/ring3d.ts');
    expect(ring3d).toContain('s.stand = (s.stand ?? 1) + ((moving ? 0 : 1) - (s.stand ?? 1)) * (1 - Math.exp(-dt * 10));');
    expect(ring3d).toMatch(/const reach = [^\n]*\* stand : 0;/);
    expect(ring3d).toMatch(/const rock = [^\n]*\* stand : 0;/);
    expect(ring3d).toContain('else if (s.swing > (moving && !s.fresh ? s.time * 0.5 : 0)) {');
  });
});
