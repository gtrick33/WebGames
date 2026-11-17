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
import { GATES, Match, type FighterSetup } from '../src/games/sigilfall/arena/sim';
import { TALENTS } from '../src/games/sigilfall/arena/talents';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { RingFx } from '../src/games/sigilfall/render/ring';
import { drawBoon, drawPoints, drawSign, hasSign, signAlone, signed, signTime, type Sign, type SignKind } from '../src/games/sigilfall/render/ringSigns';
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
    // a landing with a sign of its own is drawn in place of its school's burst (Frostfang keeps both, for Shatter)
    expect(signAlone('m-ring')).toBe(true);
    expect(signAlone('m-fang')).toBe(false);
    expect(fx.bursts).toHaveLength(1);
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
