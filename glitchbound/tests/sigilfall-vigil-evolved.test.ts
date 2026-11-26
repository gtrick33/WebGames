/**
 * The Vigil's evolutions, bolder (the owner, 2026-11-26: "Yes, bolder evolutions"): each of the 32 has a form of its
 * own, not its spell's form in other colors, and what it lands is layered and leaves a mark on the ground.
 */
import { describe, expect, it } from 'vitest';
import type { Cast } from '../src/games/sigilfall/render3d/cast';
import { FX, type Fx3D } from '../src/games/sigilfall/render3d/fx3d';
import { drawScar, EVO_FORM, evolvedAura, evolvedEffect, evolvedOrbit, evolvedOverHero, evolvedPet, evolvedPetLook, evolvedPost, evolvedShot, evolvedWard, impactLayers, scarOf, type Scene } from '../src/games/sigilfall/render/vigilEvolved';
import { flyer, lookOf } from '../src/games/sigilfall/render/vigilLooks';
import { ALL_SPELLS, SPELLS } from '../src/games/sigilfall/vigil/kit';
import type { Fx } from '../src/games/sigilfall/vigil/sim';

interface Seen {
  sc: Scene;
  kinds: Set<number>;
  sizes: { kind: number; w: number }[];
  models: string[];
}
function recorder(time = 1.3): Seen {
  const kinds = new Set<number>();
  const sizes: { kind: number; w: number }[] = [];
  const models: string[] = [];
  const fx = {
    put: (q: { kind: number; w?: number }) => {
      kinds.add(q.kind);
      sizes.push({ kind: q.kind, w: q.w ?? 0 });
    },
  } as unknown as Fx3D;
  const cast = { thrown: (id: string) => models.push(id), creature: (id: string) => models.push(id) } as unknown as Cast;
  return { sc: { fx, cast, time }, kinds, sizes, models };
}
const effect = (kind: Fx['kind'], spell: string, extra: Partial<Fx> = {}): Fx => ({ kind, spell, evo: true, x: 0, y: 0, t: 0.2, dur: 0.6, el: SPELLS[spell]!.el, color: '#ffffff', r: 40, a: 0, len: 200, w: 8, arc: 1.9, at: 0.1, ...extra });

/** Draws an evolution in whatever form it has; returns what it drew, or null if nothing claimed it. */
function drawEvolved(id: string): Seen | null {
  const look = lookOf(id, true);
  const def = SPELLS[id]!;
  const tries: (() => [boolean, Seen])[] = [
    () => {
      const s = recorder();
      return [evolvedShot(s.sc, id, look, 0, 0, 200, 0, 4, 1, 3), s];
    },
    () => {
      const s = recorder();
      return [evolvedOrbit(s.sc, id, look, 0, 0, 30, 0, 8, 3), s];
    },
    () => {
      const s = recorder();
      return [evolvedPet(s.sc, id, look, 0, 0, 3), s];
    },
    () => {
      const s = recorder();
      return [evolvedPost(s.sc, id, look, 0, 0, 1, true, 3), s];
    },
    () => {
      const s = recorder();
      return [evolvedWard(s.sc, id, look, 0, 0, 1, 3), s];
    },
    () => {
      const s = recorder();
      return [evolvedAura(s.sc, id, look, 0, 0, 40, 3), s];
    },
    () => {
      const s = recorder();
      return [evolvedOverHero(s.sc, id, look, 0, 0), s];
    },
    ...(['nova', 'beam', 'cone', 'sweep', 'strike', 'drop', 'heal', 'burst'] as Fx['kind'][]).map((k) => () => {
      const s = recorder();
      return [evolvedEffect(s.sc, effect(k, id, k === 'drop' ? { t: 0.4 } : {}), look, 0.3, 3, 0, 0), s] as [boolean, Seen];
    }),
  ];
  void def;
  for (const t of tries) {
    const [hit, seen] = t();
    if (hit) return seen;
  }
  return null;
}

describe('The Vigil: every evolution has a form of its own', () => {
  it('all 32, each told in words, no two alike', () => {
    const evolving = ALL_SPELLS.filter((s) => s.evolve).map((s) => s.id);
    expect(evolving.length).toBe(32);
    expect(Object.keys(EVO_FORM).sort()).toEqual([...evolving].sort());
    expect(new Set(Object.values(EVO_FORM)).size).toBe(32);
  });

  it('every evolution is drawn by a form of its own, not by its spell’s drawing in other colors', () => {
    for (const s of ALL_SPELLS.filter((x) => x.evolve)) {
      const seen = drawEvolved(s.id);
      expect(seen, `${s.id} (${s.kind}) has no form of its own`).not.toBeNull();
      expect(seen!.sizes.length + seen!.models.length, s.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('an evolved shot is made of other things than its spell’s shot', () => {
    for (const id of ['ember-bolt', 'ball-lightning', 'seeking-arrow', 'thought-lash', 'soulfire', 'thorn-volley', 'thrown-axe', 'thrown-hammer']) {
      const base = recorder();
      flyer(base.sc.fx, base.sc.cast, lookOf(id), 0, 0, 200, 0, 4, 1, 1.3, 3);
      const evo = recorder();
      expect(evolvedShot(evo.sc, id, lookOf(id, true), 0, 0, 200, 0, 4, 1, 3), id).toBe(true);
      const fresh = [...evo.kinds].filter((k) => !base.kinds.has(k));
      const models = evo.models.filter((m) => !base.models.includes(m));
      expect(fresh.length + models.length + (evo.models.length !== base.models.length ? 1 : 0), `${id}: nothing new in its form`).toBeGreaterThan(0);
    }
    // the clearest: Ceaseless Volley is light, not a wooden arrow; Thunderhead is a cloud that strikes
    const volley = recorder();
    evolvedShot(volley.sc, 'seeking-arrow', lookOf('seeking-arrow', true), 0, 0, 200, 0, 4, 0, 3);
    expect(volley.models).not.toContain('w_arrow_A');
    const storm = recorder();
    evolvedShot(storm.sc, 'ball-lightning', lookOf('ball-lightning', true), 0, 0, 70, 0, 7, 0, 3);
    expect(storm.kinds.has(FX.smoke)).toBe(true);
  });

  it('what flies stays small, evolved or not', () => {
    for (const id of ['ember-bolt', 'ball-lightning', 'seeking-arrow', 'thought-lash', 'soulfire', 'thorn-volley']) {
      const r = id === 'ball-lightning' ? 7 : 4;
      const s = recorder();
      evolvedShot(s.sc, id, lookOf(id, true), 0, 0, 200, 0, r, 0, 3);
      const body = s.sizes.filter((p) => p.kind !== FX.trail && p.kind !== FX.glow);
      for (const p of body) expect(p.w, id).toBeLessThanOrEqual(Math.max(7, r * 2.6) * 2.5);
    }
  });

  it('companions evolved are their kind made spectral or burning, not just more of them', () => {
    expect(evolvedPetLook('wolf-pack')?.alpha).toBeLessThan(1);
    expect(evolvedPetLook('pit-imps')?.tint[0]).toBeGreaterThan(1.5);
    const howl = recorder(0.2);
    evolvedPet(howl.sc, 'wolf-pack', lookOf('wolf-pack', true), 0, 0, 0);
    expect(howl.kinds.has(FX.shock), 'a howl’s shockwave').toBe(true);
  });

  it('what an evolution lands is layered: a flash, a shockwave, a kick for the biggest, and a mark that lingers', () => {
    const s = recorder();
    const strike = effect('strike', 'blast-arrow', { t: 0.15, at: 0.1, dur: 0.7, r: 40 });
    const kick = impactLayers(s.sc, strike, lookOf('blast-arrow', true), 0.1, 3);
    expect(kick).toBeGreaterThan(0);
    expect(s.kinds.has(FX.shock)).toBe(true);
    expect(s.kinds.has(FX.glow)).toBe(true);
    // (not before it has landed)
    const early = recorder();
    expect(impactLayers(early.sc, { ...strike, t: 0.05 }, lookOf('blast-arrow', true), 0.05, 3)).toBe(0);
    expect(early.sizes.length).toBe(0);
    for (const kind of ['burst', 'nova', 'strike', 'drop', 'beam', 'cone', 'heal'] as Fx['kind'][]) expect(scarOf(effect(kind, 'frost-ring'), lookOf('frost-ring', true)), kind).not.toBeNull();
    expect(scarOf(effect('hit', 'frost-ring'), lookOf('frost-ring', true))).toBeNull();
    // a mark fades and is drawn as ground with something drifting off it
    const mark = scarOf(effect('beam', 'ice-javelin'), lookOf('ice-javelin', true))!;
    mark.t = 0.5;
    const g = recorder();
    drawScar(g.sc, mark, 1);
    expect(g.kinds.has(FX.field)).toBe(true);
    expect(g.sizes.filter((p) => p.kind === FX.field).length).toBeGreaterThan(2);
  });
});
