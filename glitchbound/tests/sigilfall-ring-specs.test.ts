/**
 * The Ring's Gloamknight as two specs, and the warlock's dead, after the owner's friend: "just make the gloamknight have 2
 * specs, typical dk and a shadow rogue, leave summons for a necro warlock spec and other affliction one". The death
 * knight is the Bloodsworn, with a chain that brings them to the blade; the shadow one is the Nightblade, who hides as
 * the classic arena's rogue does (the rules are that game's, the names ours); and the ashbound dead are the warlock's
 * Gravecaller's now.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, barCombos, kitOf, PRESETS, type Ability } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { GATES, Match, VEIL, type Fighter, type FighterSetup, type MatchEvent, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { RingFx, ringSpells } from '../src/games/sigilfall/render/ring';
import { FX, type Fx3D, type FxQuad } from '../src/games/sigilfall/render3d/fx3d';
import type { ClassId } from '../src/games/sigilfall/data/types';

const STEP = 1 / 30;
const NIGHTBLADE = PRESETS.gloamknight[1]!;
const BLOODSWORN = PRESETS.gloamknight[0]!;

/** What the tests reach into: a hit put straight on someone, and how fast someone walks. */
interface Inside {
  damage(src: Fighter, t: Fighter, amount: number, direct: boolean, ab?: Ability): number;
  speedOf(f: Fighter): number;
}
const inside = (m: Match): Inside => m as unknown as Inside;

interface Side {
  cls: ClassId;
  bar: string[];
  at?: [number, number];
}

/** Two fighters through the gates, placed, facing each other. */
function duel(a: Side, b: Side): Match {
  const side = (w: Side, team: 0 | 1): FighterSetup => ({ team, cls: w.cls, name: w.cls, bar: w.bar, talents: [] });
  const m = new Match({ seed: 4, map: 'sands', fighters: [side(a, 0), side(b, 1)] });
  m.step(GATES + 0.01, {});
  m.events.length = 0;
  const [f, g] = m.fighters as [Fighter, Fighter];
  [f.x, f.y] = a.at ?? [200, 125];
  [g.x, g.y] = b.at ?? [222, 125];
  f.mods.crit = 0;
  g.mods.crit = 0;
  Object.assign(f, { dirX: 1, dirY: 0, target: g.id });
  Object.assign(g, { dirX: -1, dirY: 0 });
  return m;
}
const wait = (m: Match, seconds: number, seen?: MatchEvent[]): void => {
  for (let i = 0; i < seconds / STEP; i++) {
    m.step(STEP, {});
    seen?.push(...m.events);
    m.events.length = 0;
  }
};
const nightblade = (foe: ClassId, foeBar: string[], at?: [number, number]): Match => duel({ cls: 'gloamknight', bar: NIGHTBLADE.bar }, { cls: foe, bar: foeBar, at });

describe('The Ring: the Gloamknight is a death knight or a blade in the dark', () => {
  it('two ready-made setups, the Bloodsworn and the Nightblade, out of twelve: no more of the dead, no more curses', () => {
    expect(PRESETS.gloamknight.map((p) => p.name)).toEqual(['Bloodsworn', 'Nightblade']);
    const kit = kitOf('gloamknight').map((a) => a.id);
    expect(kit).toHaveLength(12);
    for (const id of ['g-veil', 'g-ambush', 'g-knife', 'g-walk', 'g-chain']) expect(kit).toContain(id);
    expect(kitOf('gloamknight').some((a) => a.role === 'summon' || a.effects.some((e) => e.k === 'dot'))).toBe(false);
    // the Nightblade's bar: a step to their back, an ambush out of it, a knife that cuts deeper there
    expect(barCombos('gloamknight', NIGHTBLADE.bar).map((c) => [c.from.id, c.to.id])).toEqual([
      ['g-walk', 'g-ambush'],
      ['g-ambush', 'g-knife'],
    ]);
    // the dead are the warlock's: a Gravecaller beside the Hexer
    expect(PRESETS.warlock.map((p) => p.name)).toEqual(['Hexer', 'Gravecaller']);
    expect(kitOf('warlock').some((a) => a.effects.some((e) => e.k === 'raise'))).toBe(true);
  });

  it('the Nightblade comes through the gates in the shroud, and nobody can choose or aim at them', () => {
    const m = nightblade('warrior', ['w-hew', 'w-hurl']);
    const [g, w] = m.fighters as [Fighter, Fighter];
    expect(m.hidden(g)).toBe(true);
    expect(m.unseen(g, w)).toBe(true);
    expect(m.unseen(g, g)).toBe(false);
    m.setTarget(w.id, g.id);
    expect(w.target).toBeNull();
    expect(m.aimOf(w, ABILITIES['w-hurl']!)).toBeNull();
    expect(m.press(w.id, 'w-hurl')).toBe('Nobody to aim at');
    // (chosen before they slipped away, they are still not there to be struck)
    w.target = g.id;
    expect(m.blocked(w, ABILITIES['w-hew']!, g)).toBe('Out of sight');
    // the Bloodsworn has no shroud and comes through as anyone does
    const b = duel({ cls: 'gloamknight', bar: BLOODSWORN.bar }, { cls: 'warrior', bar: ['w-hew'] });
    expect(b.hidden(b.fighters[0]!)).toBe(false);
  });

  it('the shroud is a careful step: a little slower than walking in the open', () => {
    const m = nightblade('warrior', ['w-hew']);
    const g = m.fighters[0]!;
    const slow = inside(m).speedOf(g);
    g.auras = [];
    expect(slow / inside(m).speedOf(g)).toBeCloseTo(1 - VEIL.slow, 5);
  });

  it('Dusk Ambush only from the shroud: the blow brings them out of it, and the knife after it cuts deeper', () => {
    const m = nightblade('warrior', ['w-hew']);
    const [g, w] = m.fighters as [Fighter, Fighter];
    const hp = w.hp;
    expect(m.press(g.id, 'g-ambush')).toBeNull();
    expect(w.hp).toBeLessThan(hp);
    expect(m.held(w)?.cc).toBe('stun');
    expect(m.hidden(g)).toBe(false);
    // out of it, the ambush waits for the next time
    g.gcd = 0;
    expect(m.press(g.id, 'g-ambush')).toBe('Only from the shroud');
    // the knife on a target its ambush has stunned: Unseen Edge
    expect(m.comboReady(g, ABILITIES['g-knife']!, w)?.name).toBe('Unseen Edge');
  });

  it('what the other side lands on them brings them out: a blow, and what falls on everyone near', () => {
    const m = nightblade('warrior', ['w-hew', 'w-shout']);
    const [g, w] = m.fighters as [Fighter, Fighter];
    const seen: MatchEvent[] = [];
    // (the warrior can't choose them, but a shout takes everyone near)
    expect(m.press(w.id, 'w-shout')).toBeNull();
    seen.push(...m.events);
    expect(m.hidden(g)).toBe(false);
    expect(seen.some((e) => e.k === 'word' && e.id === g.id && e.word === 'Revealed')).toBe(true);
    expect(g.auras.some((a) => a.cc === 'fear')).toBe(true);
    // and a straight hit does the same
    const n = nightblade('warrior', ['w-hew']);
    inside(n).damage(n.fighters[1]!, n.fighters[0]!, 20, true, ABILITIES['w-hew']);
    expect(n.hidden(n.fighters[0]!)).toBe(false);
  });

  it('taken in a fight it sheds roots and slows, holds through a moment of hurt, and is long coming back; out of one it is back at once', () => {
    const m = nightblade('warrior', ['w-hew', 'w-hamstring'], [222, 125]);
    const [g, w] = m.fighters as [Fighter, Fighter];
    expect(m.press(g.id, 'g-knife')).toBeNull();
    expect(m.hidden(g)).toBe(false);
    w.target = g.id;
    expect(m.press(w.id, 'w-hamstring')).toBeNull();
    expect(g.auras.some((a) => a.kind === 'slow')).toBe(true);
    expect(m.calm(g)).toBe(false);
    expect(m.press(g.id, 'g-veil')).toBeNull();
    expect(m.hidden(g)).toBe(true);
    expect(g.auras.some((a) => a.kind === 'slow')).toBe(false);
    expect(g.cds['g-veil']).toBeCloseTo(30, 0);
    expect(w.target).toBeNull();
    // a blow straight after doesn't break it; one after the moment is past does
    inside(m).damage(w, g, 10, true, ABILITIES['w-hew']);
    expect(m.hidden(g)).toBe(true);
    wait(m, VEIL.grace + 0.1);
    inside(m).damage(w, g, 10, true, ABILITIES['w-hew']);
    expect(m.hidden(g)).toBe(false);
    // out of the fight for a while, it is back in moments
    g.cds = {};
    wait(m, VEIL.calm + 0.1);
    expect(m.calm(g)).toBe(true);
    expect(m.press(g.id, 'g-veil')).toBeNull();
    expect(g.cds['g-veil']).toBeCloseTo(VEIL.rest, 1);
  });

  it('slipping into it loses whoever was casting at them, and what was flying at them goes astray', () => {
    const m = nightblade('mage', ['m-lash', 'm-spear'], [330, 125]);
    const [g, mage] = m.fighters as [Fighter, Fighter];
    g.auras = [];
    g.fought = m.clock;
    mage.target = g.id;
    expect(m.press(mage.id, 'm-lash')).toBeNull();
    expect(mage.cast).not.toBeNull();
    const seen: MatchEvent[] = [];
    expect(m.press(g.id, 'g-veil')).toBeNull();
    seen.push(...m.events);
    expect(mage.cast).toBeNull();
    expect(seen.some((e) => e.k === 'word' && e.id === mage.id && e.word === 'Lost sight')).toBe(true);
    // a bolt already thrown misses
    const n = nightblade('mage', ['m-lash'], [330, 125]);
    const [h, mage2] = n.fighters as [Fighter, Fighter];
    h.auras = [];
    // (in the fight, so the shroud doesn't come back of itself)
    h.fought = n.clock;
    mage2.target = h.id;
    n.press(mage2.id, 'm-lash');
    // (the cast ends and the bolt is on its way)
    for (let i = 0; i < 60 && !n.bolts.length; i++) wait(n, STEP);
    expect(n.bolts.length).toBe(1);
    const hp = h.hp;
    n.press(h.id, 'g-veil');
    wait(n, 1);
    expect(n.bolts.length).toBe(0);
    expect(h.hp).toBe(hp);
  });

  it('Shade Walk: out of the dark at their back, still in the shroud, and the knife cuts deeper from there', () => {
    const m = nightblade('warrior', ['w-hew'], [300, 125]);
    const [g, w] = m.fighters as [Fighter, Fighter];
    // (the warrior faces away, toward the east wall)
    Object.assign(w, { dirX: 1, dirY: 0 });
    expect(m.press(g.id, 'g-walk')).toBeNull();
    expect(g.x).toBeLessThan(w.x);
    expect(Math.hypot(g.x - w.x, g.y - w.y)).toBeLessThan(20);
    expect(m.hidden(g)).toBe(true);
    expect(m.behind(g, w)).toBe(true);
    expect(w.auras.some((a) => a.ab === 'g-walk' && a.kind === 'slow')).toBe(true);
    expect(m.comboReady(g, ABILITIES['g-ambush']!, w)?.name).toBe('Out of Nowhere');
    expect(m.comboReady(g, ABILITIES['g-knife']!, w)?.name).toBe('Unseen Edge');
    // face to face, the knife is only a knife
    Object.assign(w, { dirX: -1, dirY: 0 });
    w.auras = [];
    expect(m.comboReady(g, ABILITIES['g-knife']!, w)).toBeNull();
  });

  it('Grave Chain: the death knight drags them in, cuts off what they were casting, and slows them', () => {
    const m = duel({ cls: 'gloamknight', bar: ['g-chain', 'g-cleave'] }, { cls: 'mage', bar: ['m-lash'], at: [300, 125] });
    const [g, mage] = m.fighters as [Fighter, Fighter];
    mage.target = g.id;
    m.press(mage.id, 'm-lash');
    expect(mage.cast).not.toBeNull();
    expect(m.press(g.id, 'g-chain')).toBeNull();
    expect(mage.cast).toBeNull();
    wait(m, 0.5);
    expect(Math.hypot(mage.x - g.x, mage.y - g.y)).toBeLessThan(20);
    expect(mage.auras.some((a) => a.ab === 'g-chain' && a.kind === 'slow')).toBe(true);
    expect(m.comboReady(g, ABILITIES['g-reap']!, mage)?.name).toBe('Harvest');
  });

  it('the computer plays the Nightblade from the shroud, and plays against it without seeing it', () => {
    let ambushes = 0;
    let unseenTargets = 0;
    for (const seed of [1, 2, 3, 4]) {
      const foe = (['warrior', 'mage', 'priest', 'ranger'] as const)[seed - 1]!;
      const m = new Match({ seed, map: MAP_IDS[seed % 3]!, fighters: [{ team: 0, cls: 'gloamknight', name: 'g', bar: NIGHTBLADE.bar, talents: NIGHTBLADE.talents }, { team: 1, cls: foe, name: 'f', bar: PRESETS[foe][0]!.bar }] });
      const brains = m.fighters.map((_, i) => newBrain(seed * 31 + i));
      for (let i = 0; i < 30 * 300 && m.phase !== 'over'; i++) {
        const moves: Record<number, MoveInput> = {};
        for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0.8, STEP);
        // (the other side never has them chosen while they are hidden)
        if (m.hidden(m.fighters[0]!) && m.fighters[1]!.target === 0) unseenTargets++;
        m.step(STEP, moves);
        for (const e of m.events) if (e.k === 'ab' && e.ab === 'g-ambush') ambushes++;
        m.events.length = 0;
      }
      expect(m.phase).toBe('over');
    }
    expect(ambushes).toBeGreaterThanOrEqual(4);
    expect(unseenTargets).toBe(0);
  }, 60_000);

  it('a player’s own copy knows who is in the shroud, as the host does', () => {
    const m = nightblade('warrior', ['w-hew']);
    const copy = new Match({ seed: 4, map: 'sands', fighters: [{ team: 0, cls: 'gloamknight', name: 'g', bar: NIGHTBLADE.bar }, { team: 1, cls: 'warrior', name: 'w', bar: ['w-hew'] }] });
    copy.restore(JSON.parse(JSON.stringify(m.snapshot())) as ReturnType<Match['snapshot']>, 1);
    expect(copy.hidden(copy.fighters[0]!)).toBe(true);
    expect(copy.unseen(copy.fighters[0]!, copy.fighters[1]!)).toBe(true);
    expect(copy.aimOf(copy.fighters[1]!, ABILITIES['w-hew']!)).toBeNull();
  });

  it('on the screen: the other side sees nothing of them, not even a number; their own side sees them', () => {
    const m = nightblade('warrior', ['w-hew']);
    const g = m.fighters[0]!;
    const air = { flames: [], smokes: [], glints: [], embers: [] };
    const marks = (myId: number): FxQuad[] => {
      const puts: FxQuad[] = [];
      const q = { put: (x: FxQuad) => puts.push(x) } as unknown as Fx3D;
      g.cast = null;
      g.dash = { x: g.x + 30, y: g.y, speed: 300 };
      ringSpells(q, m, new RingFx(), myId, 1, air);
      g.dash = null;
      return puts.filter((p) => p.kind === FX.spark && Math.abs(p.x - g.x) < 30 && Math.abs(p.y - g.y) < 4);
    };
    // (a step's streak behind them: theirs to see, not the warrior's)
    expect(marks(0).length).toBeGreaterThan(0);
    expect(marks(1)).toHaveLength(0);
    const popped = (myId: number): number => {
      const fx = new RingFx();
      m.events.push({ k: 'num', id: g.id, n: 12, kind: 'dmg', crit: false }, { k: 'word', id: g.id, word: 'Something' });
      fx.take(m, () => undefined, myId);
      m.events.length = 0;
      return fx.pops.length;
    };
    expect(popped(0)).toBe(2);
    expect(popped(1)).toBe(0);
  });
});

describe('The Ring: the Gravecaller rouses her dead', () => {
  it('Grave Hunger: only while some stand, and then they hit harder and run faster', () => {
    const m = duel({ cls: 'warlock', bar: ['k-raise', 'k-frenzy'] }, { cls: 'warrior', bar: ['w-hew'], at: [260, 125] });
    const k = m.fighters[0]!;
    expect(m.press(k.id, 'k-frenzy')).toBe('None of your dead stand');
    expect(m.press(k.id, 'k-raise')).toBeNull();
    k.gcd = 0;
    expect(m.press(k.id, 'k-frenzy')).toBeNull();
    const dead = m.fighters.filter((f) => f.pet);
    expect(dead).toHaveLength(2);
    for (const d of dead) {
      // (as strong as Grave Hunger says: 40% since tests/sigilfall-ring-balance.test.ts's measure of 2026-11-15, 45% before)
      expect(d.auras.find((a) => a.kind === 'fury')?.n).toBeCloseTo((ABILITIES['k-frenzy']!.effects[0] as { pct: number }).pct / 100, 5);
      expect(d.auras.some((a) => a.kind === 'speed')).toBe(true);
    }
    expect(k.auras.some((a) => a.kind === 'fury')).toBe(false);
  });
});
