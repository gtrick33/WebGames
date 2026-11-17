/**
 * The Ring after the owner's notes on its classes: "rethink talent options overall ... they should be general for the
 * class", "warriors have too much cc", "mages cast time should definitely be reduced by at least 25%", "gloamknight's
 * idea is to summon undeads", "gloamknight's orb effect around the character jitters when moving vs another player".
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, fullBar, kitOf, PRESETS, SLOTS, type Effect } from '../src/games/sigilfall/arena/abilities';
import { botThink, newBrain } from '../src/games/sigilfall/arena/bot';
import { setsOf } from '../src/games/sigilfall/arena/ladder';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { TALENTS } from '../src/games/sigilfall/arena/talents';
import { GATES, Match, THRALL, type Fighter, type FighterSetup, type MatchEvent, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { RingFx, ringSpells } from '../src/games/sigilfall/render/ring';
import { FX, type Fx3D, type FxQuad } from '../src/games/sigilfall/render3d/fx3d';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';

const STEP = 1 / 30;
const fighter = (team: 0 | 1, cls: ClassId, bar?: string[], talents?: string[]): FighterSetup => ({ team, cls, name: cls, bar: bar ?? PRESETS[cls][0]!.bar, talents });
const wait = (m: Match, seconds: number, moves: Record<number, MoveInput> = {}, seen?: MatchEvent[]): void => {
  for (let i = 0; i < seconds / STEP; i++) {
    m.step(STEP, moves);
    seen?.push(...m.events);
    m.events.length = 0;
  }
};
/** A warlock and a warrior, gates open, a little apart on open ground. */
function face(bar = ['k-raise', 'k-bolt'], foe: ClassId = 'warrior', cls: ClassId = 'warlock'): Match {
  const m = new Match({ seed: 3, map: 'sands', fighters: [fighter(0, cls, bar), fighter(1, foe, ['w-hew'])] });
  m.step(GATES + 0.01, {});
  Object.assign(m.fighters[0]!, { x: 160, y: 125, dirX: 1, dirY: 0, target: 1 });
  Object.assign(m.fighters[1]!, { x: 230, y: 125 });
  return m;
}
const thralls = (m: Match): Fighter[] => m.fighters.filter((f) => f.pet);
const RAISE = ABILITIES['k-raise']!.effects.find((e) => e.k === 'raise') as Extract<Effect, { k: 'raise' }>;

describe('The Ring: the Gravecaller calls the ashbound dead (the Gloamknight’s, until the owner’s friend: "leave summons for a necro warlock spec")', () => {
  it('two rise beside her, go for his target and strike it, and crumble when their time is up', () => {
    const m = face();
    const foe = m.fighters[1]!;
    expect(m.press(0, 'k-raise')).toBeNull();
    const raised = thralls(m);
    expect(raised).toHaveLength(RAISE.n);
    for (const t of raised) {
      expect(t.team).toBe(0);
      expect(t.pet!.owner).toBe(0);
      expect(t.hp).toBe(RAISE.hp);
      expect(Math.hypot(t.x - 160, t.y - 125)).toBeLessThan(30);
    }
    const seen: MatchEvent[] = [];
    const before = foe.hp;
    wait(m, 5, {}, seen);
    // they walked to him and clawed him: damage that is their master's, and the slow their claws leave
    expect(seen.filter((e) => e.k === 'claw' && e.to === 1).length).toBeGreaterThanOrEqual(4);
    expect(foe.hp).toBeLessThan(before);
    expect(m.fighters[0]!.score.dmg).toBe(before - foe.hp);
    expect(foe.auras.some((a) => a.ab === 'k-raise' && a.kind === 'slow' && a.src === 0)).toBe(true);
    // … and her Gloom Bolt on someone they are clawing is Gloomfire
    expect(m.comboReady(m.fighters[0]!, ABILITIES['k-bolt']!, foe)?.name).toBe('Gloomfire');
    wait(m, RAISE.life - 5 + 0.3, {}, seen);
    expect(thralls(m).every((t) => t.dead)).toBe(true);
    expect(seen.filter((e) => e.k === 'death').map((e) => (e as { id: number }).id).sort()).toEqual(raised.map((t) => t.id).sort());
    // the match is between the heroes: it goes on, and the dead stand for nobody
    expect(m.phase).toBe('fight');
  });

  it('they can be chosen, struck and killed like anyone, and what hits everyone near hits them too', () => {
    const m = face();
    m.press(0, 'k-raise');
    const [a, b] = thralls(m);
    // the warrior chooses one and hews it down
    const w = m.fighters[1]!;
    Object.assign(w, { x: a!.x + 12, y: a!.y });
    m.setTarget(1, a!.id);
    expect(w.target).toBe(a!.id);
    for (let i = 0; i < 12 && !a!.dead; i++) {
      w.gcd = 0;
      m.press(1, 'w-hew');
      m.step(STEP, {});
    }
    expect(a!.dead).toBe(true);
    // (nobody chose the other: an ability that finds its own target goes for a hero before somebody's dead)
    w.target = null;
    expect(m.aimOf(w, ABILITIES['w-hew']!)!.id).toBe(0);
    expect(b!.dead).toBe(false);
  });

  it('they fall with their master, and are gone from the match once it is over', () => {
    const m = face();
    m.press(0, 'k-raise');
    m.fighters[0]!.hp = 1;
    m.fighters[1]!.target = 0;
    m.fighters[1]!.x = 172;
    m.press(1, 'w-hew');
    expect(m.fighters[0]!.dead).toBe(true);
    m.step(STEP, {});
    // (one side has no hero standing: over, and only heroes are left to read)
    expect(m.phase).toBe('over');
    expect(m.winner).toBe(1);
    expect(m.fighters).toHaveLength(2);
    expect(m.fighters.every((f) => !f.pet)).toBe(true);
  });

  it('a player’s own copy raises them as the host does, and lets them go when the host does', () => {
    const m = face();
    const copy = new Match({ seed: 3, map: 'sands', fighters: [fighter(0, 'warlock', ['k-raise', 'k-bolt']), fighter(1, 'warrior', ['w-hew'])] });
    m.press(0, 'k-raise');
    wait(m, 1);
    copy.restore(JSON.parse(JSON.stringify(m.snapshot())) as ReturnType<Match['snapshot']>, 1);
    expect(copy.fighters).toHaveLength(4);
    expect(copy.fighters[2]!.pet).toMatchObject({ owner: 0, max: RAISE.life, hits: m.fighters[2]!.pet!.hits });
    expect(copy.fighters[2]!.x).toBeCloseTo(m.fighters[2]!.x, 0);
    // (between the host's words, they walk on and their time runs down)
    const life = copy.fighters[2]!.pet!.life;
    copy.coast(0.5, 1, null);
    expect(copy.fighters[2]!.pet!.life).toBeCloseTo(life - 0.5, 5);
    // the host's match ends: so do they, on the copy too
    m.fighters[0]!.hp = 1;
    m.fighters[1]!.x = 172;
    m.fighters[1]!.target = 0;
    m.press(1, 'w-hew');
    m.step(STEP, {});
    copy.restore(JSON.parse(JSON.stringify(m.snapshot())) as ReturnType<Match['snapshot']>, 1);
    expect(copy.phase).toBe('over');
    expect(copy.fighters).toHaveLength(2);
  });

  it('the computer calls them as the fight is joined, and the other side strikes them', () => {
    let raised = 0;
    let clawed = 0;
    let struck = 0;
    for (const seed of [1, 2, 3, 4]) {
      const foe = (['warrior', 'mage', 'paladin', 'ranger'] as const)[seed - 1]!;
      const m = new Match({ seed, map: MAP_IDS[seed % 3]!, fighters: [fighter(0, 'warlock', PRESETS.warlock[1]!.bar, PRESETS.warlock[1]!.talents), fighter(1, foe, PRESETS[foe][PRESETS[foe].length - 1]!.bar)] });
      const brains = m.fighters.map((_, i) => newBrain(seed * 31 + i));
      for (let i = 0; i < 30 * 200 && m.phase !== 'over'; i++) {
        const moves: Record<number, MoveInput> = {};
        for (const f of m.fighters) moves[f.id] = botThink(m, f, brains[f.id]!, 0.8, STEP);
        m.step(STEP, moves);
        for (const e of m.events) {
          if (e.k === 'ab' && e.ab === 'k-raise') raised++;
          if (e.k === 'claw') clawed++;
          if (e.k === 'num' && e.kind === 'dmg' && m.fighters[e.id]?.pet) struck++;
        }
        m.events.length = 0;
        // (nothing about them is ever not a number, and they never leave the ground)
        for (const f of m.fighters) expect(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.hp)).toBe(true);
      }
      expect(m.phase).toBe('over');
    }
    expect(raised).toBeGreaterThanOrEqual(4);
    expect(clawed).toBeGreaterThan(20);
    expect(struck).toBeGreaterThan(0);
  }, 60_000);

  it('the computer keeps its hardest for a hero, and puts down one of the dead that is clawing at it once it is worn', () => {
    const m = face();
    m.press(0, 'k-raise');
    const w = m.fighters[1]!;
    const [a] = thralls(m);
    Object.assign(a!, { x: w.x - 12, y: w.y, target: w.id });
    m.fighters[0]!.hp = m.fighters[0]!.maxHp * 0.8;
    botThink(m, w, newBrain(1), 0.8, STEP);
    expect(w.target).toBe(0);
    a!.hp = a!.maxHp * 0.3;
    botThink(m, w, newBrain(2), 0.8, STEP);
    expect(w.target).toBe(a!.id);
  });
});

describe('The Ring: a mage casts quicker', () => {
  it('every mage cast is at least a quarter shorter than it was', () => {
    // (what they were before the owner's "mages cast time should definitely be reduced by at least 25%")
    // (Great Pyre, the fourth of them, went when a playstyle's abilities became its own, 2026-11-16)
    // (Frostclasp, the Rime's stun of 2026-11-17, is new and has no cast from before to be shorter than)
    const was: Record<string, number> = { 'm-lash': 1.1, 'm-spear': 0.9, 'm-toad': 0.9 };
    const casts = kitOf('mage').filter((a) => a.cast > 0 && a.id !== 'm-ring');
    expect(casts.map((a) => a.id).sort()).toEqual(Object.keys(was).sort());
    for (const a of casts) expect(a.cast, a.id).toBeLessThanOrEqual(was[a.id]! * 0.75);
    // and none of them lands so much harder for it that a mage casting all the time deals more than a sixth again (a
    // cast is followed no sooner than the global cooldown lets it be)
    const rate = (id: string, dmg?: number, cast?: number): number => (dmg ?? (ABILITIES[id]!.effects.find((e) => e.k === 'dmg') as { n: number }).n) / Math.max(cast ?? ABILITIES[id]!.cast, 0.75);
    expect(rate('m-lash') / rate('m-lash', 92, 1.1)).toBeLessThan(1.17);
    expect(rate('m-spear') / rate('m-spear', 86, 0.9)).toBeLessThan(1.17);
  });
});

describe('The Ring: a warrior holds less', () => {
  it('no hold on the rush, and one short stun to a playstyle, long between', () => {
    // (the owner, 2026-11-13: "warriors have too much cc". Each playstyle has one hold now, as every playstyle does)
    expect(ABILITIES['w-rush']!.effects.some((e) => e.k === 'cc')).toBe(false);
    for (const p of PRESETS.warrior) {
      const holds = p.bar.map((id) => ABILITIES[id]!).flatMap((a) => a.effects.filter((e): e is Extract<typeof e, { k: 'cc' }> => e.k === 'cc').map((e) => ({ id: a.id, cc: e.cc, dur: e.dur, cd: a.cd })));
      expect(holds, p.name).toHaveLength(1);
      expect(holds[0]!.cc).toBe('stun');
      expect(holds[0]!.dur).toBeLessThanOrEqual(1.5);
      // (seconds of holds its bar can put out in a minute: under 7, where the root, stun and fear a warrior had came to 17)
      expect((holds[0]!.dur * 60) / holds[0]!.cd, p.name).toBeLessThan(7);
    }
  });
});

describe('The Ring: talents are a playstyle’s own, and the third row the class’s', () => {
  it('the class’s row does the same on either playstyle; a playstyle’s talent is not the other’s to take', () => {
    for (const cls of CLASS_IDS) {
      const [a, b] = PRESETS[cls];
      for (const t of TALENTS[cls]) {
        const own = PRESETS[cls].find((p) => p.id === (t.spec ?? a!.id))!;
        const other = own === a ? b! : a!;
        const x = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, cls, own.bar), fighter(1, 'warrior')] });
        x.equip(0, { bar: own.bar, talents: [t.id] });
        expect(x.fighters[0]!.talents, t.id).toContain(t.id);
        const y = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, cls, other.bar), fighter(1, 'warrior')] });
        y.equip(0, { bar: other.bar, talents: [t.id] });
        // (the class's own: taken on both, and the same on both; a playstyle's own: not the other's)
        expect(y.fighters[0]!.talents.includes(t.id), t.id).toBe(!t.spec);
        if (!t.spec) {
          expect(x.fighters[0]!.perks.does[t.does?.k ?? 'scar'], t.id).toEqual(y.fighters[0]!.perks.does[t.does?.k ?? 'scar']);
          expect(x.fighters[0]!.mods.guard, t.id).toBe(y.fighters[0]!.mods.guard);
        }
        // (and it does something: a number of its class's, a doing, a change to an ability, or points)
        expect(!!t.does || !!t.tune || !!t.guard || !!t.hold || !!t.exec || !!t.rally, t.id).toBe(true);
      }
    }
  });
});

describe('The Ring: what older games kept still fights', () => {
  it('a bar with an ability taken out of the game, or another class’s, is read as the playstyle nearest it', () => {
    const bar = fullBar('gloamknight', ['g-price', 'g-cleave', 'w-hew', 'g-cleave', 7, 'g-super']);
    expect(bar).toEqual(PRESETS.gloamknight[0]!.bar);
    expect(bar).toHaveLength(SLOTS);
    for (const id of bar) expect(ABILITIES[id]?.cls).toBe('gloamknight');
    expect(fullBar('mage', undefined)).toEqual(PRESETS.mage[0]!.bar);
    expect(fullBar('gloamknight', ['g-veil', 'g-knife', 'g-walk'])).toEqual(PRESETS.gloamknight[1]!.bar);
    // a setup saved with Blood Price in it, and one its player had only begun, both come back whole
    const kept = setsOf({ standings: {}, sets: { gloamknight: { active: 0, list: [{ bar: ['g-cleave', 'g-price', 'g-reap', 'g-hand'], talents: ['g-1a', 'g-9z'] }, { bar: ['g-knife'], talents: [] }] } } }, 'gloamknight');
    expect(kept.list[0]!.bar).toEqual(PRESETS.gloamknight[0]!.bar);
    expect(kept.list[1]!.bar).toEqual(PRESETS.gloamknight[1]!.bar);
    // (talents that are gone give way to the playstyle's own, in every row)
    expect(kept.list[0]!.talents).toEqual(PRESETS.gloamknight[0]!.talents);
    const m = new Match({ seed: 1, map: 'sands', fighters: [{ ...fighter(0, 'gloamknight', ['g-cleave', 'g-price']), talents: ['g-1a', 'g-3a'] }, fighter(1, 'warrior')] });
    expect(m.fighters[0]!.bar).toEqual(PRESETS.gloamknight[0]!.bar);
    // (the match itself takes only what is still a talent: the rest was filled in where the setup is kept)
    expect(m.fighters[0]!.talents).toEqual(['g-3a']);
  });
});

describe('The Ring: what goes about a fighter goes with the body', () => {
  it('the Gloamknight’s gloam is drawn where his body is drawn, carried into a blow and back', () => {
    const m = face(['g-cleave'], 'warrior', 'gloamknight');
    const knight = m.fighters[0]!;
    const puts: FxQuad[] = [];
    const q = { put: (x: FxQuad) => puts.push(x) } as unknown as Fx3D;
    const air = { flames: [], smokes: [], glints: [], embers: [] };
    // (the body a step into a blow, off its spot)
    const body = { x: knight.x + 12, y: knight.y + 3 };
    ringSpells(q, m, new RingFx(), 0, 1, air, (f) => (f.id === knight.id ? body : f));
    const glow = puts.find((p) => p.kind === FX.glow && p.a === '#7a3cff' && p.w === 34);
    expect(glow).toMatchObject({ x: body.x, y: body.y });
    // and the dark rising off him rises round the body, not the spot it left
    const motes = puts.filter((p) => p.kind === FX.shadow && p.a === '#9a6ae0');
    expect(motes.length).toBeGreaterThanOrEqual(4);
    for (const p of motes) expect(Math.hypot(p.x - body.x, p.y - body.y)).toBeLessThan(10);
    void THRALL;
  });
});
