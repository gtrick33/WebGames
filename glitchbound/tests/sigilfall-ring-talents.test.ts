/**
 * The Ring's talents after the owner's note of 2026-11-13: "currently most of the talents in the ring are the same as
 * the oath talents, please make them very unique". None of them is an oath's number again, no two classes share one,
 * and each does what it says in a match: one test a talent, by class.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, DASH, PRESETS, type Ability, type CcKind } from '../src/games/sigilfall/arena/abilities';
import { lookOf } from '../src/games/sigilfall/arena/look';
import { ARM, NEAR, TALENT_BY_ID, TALENTS, type Doing, type Talent } from '../src/games/sigilfall/arena/talents';
import { GATES, HERO_R, Match, ORB_HEAL, type Fighter, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';

const STEP = 1 / 30;

/** What the tests reach into: a hit, a heal or a hold put straight on someone, as an ability would. */
interface Inside {
  damage(src: Fighter, t: Fighter, amount: number, direct: boolean, ab?: Ability): number;
  heal(src: Fighter, t: Fighter, amount: number, direct?: boolean): void;
  crowd(f: Fighter, ab: Ability, t: Fighter, cc: CcKind, dur: number): boolean;
  speedOf(f: Fighter): number;
}
const inside = (m: Match): Inside => m as unknown as Inside;

interface Who {
  team: 0 | 1;
  cls: ClassId;
  talents?: string[];
  bar?: string[];
  at?: [number, number];
  ult?: string;
}
/**
 * A fight with its gates open, no critical hits (so numbers can be compared), each standing where told (or the first
 * of each side face to face down the middle of the sands), the first of each side aiming at the other's first.
 */
function fight(list: Who[], map = 'sands'): Match {
  const m = new Match({ seed: 5, map, fighters: list.map((w) => ({ team: w.team, cls: w.cls, name: w.cls, bar: w.bar ?? PRESETS[w.cls][0]!.bar, talents: w.talents ?? [], ult: w.ult })) });
  m.step(GATES + 0.01, {});
  const firsts = [m.fighters.find((f) => f.team === 0)!, m.fighters.find((f) => f.team === 1)!];
  m.fighters.forEach((f, i) => {
    const w = list[i]!;
    const [x, y] = w.at ?? (f === firsts[0] ? [200, 125] : f === firsts[1] ? [215, 125] : [200 + (f.team ? 40 : -40), 150]);
    f.x = x;
    f.y = y;
    f.mods.crit = 0;
    f.target = firsts[f.team ? 0 : 1]!.id;
  });
  return m;
}
const wait = (m: Match, seconds: number, moves: Record<number, MoveInput> = {}): void => {
  for (let i = 0; i < seconds / STEP; i++) m.step(STEP, moves);
};
const has = (f: Fighter, ab: string, kind?: string): boolean => f.auras.some((a) => a.ab === ab && (!kind || a.kind === kind));
const AB = (id: string): Ability => ABILITIES[id]!;
/** A talent's doing and its numbers, read from the talent (so that tuning a number never breaks what is tested). */
function doing<K extends Doing['k']>(id: string, k: K): Extract<Doing, { k: K }> {
  const d = TALENT_BY_ID[id]!.does!;
  expect(d.k, id).toBe(k);
  return d as Extract<Doing, { k: K }>;
}

describe('The Ring: talents are their own', () => {
  it('none is an oath again: no talent is only more health, damage, healing, speed, shorter holds or shorter cooldowns', () => {
    for (const t of Object.values(TALENT_BY_ID)) {
      const loose = t as Talent & Record<string, unknown>;
      for (const key of ['hp', 'dmg', 'heal', 'speed', 'tenacity', 'cool', 'regen', 'leech', 'charge', 'crit']) expect(loose[key], `${t.id} ${key}`).toBeUndefined();
      // (and none says what an oath said, when there were oaths: until 2026-11-15)
      for (const said of ['+12% health', '+8% damage', '+15% healing', '+10% move speed', 'held 25% shorter', 'cooldowns 12% shorter']) expect(t.text.toLowerCase(), t.id).not.toBe(said);
      // (nor of the Unbinding Charm, taken out with them)
      expect(t.text, t.id).not.toMatch(/charm/i);
    }
  });

  it('no two classes share a talent: not a name, not a doing, not a number of the old kind', () => {
    const all = Object.values(TALENT_BY_ID);
    expect(new Set(all.map((t) => t.name)).size).toBe(all.length);
    // each doing is one class's
    const doings = all.flatMap((t) => (t.does ? [t.does.k] : []));
    expect(new Set(doings).size).toBe(doings.length);
    // and what is left of the old shared kinds (a slow on every hit, a stun now and then, a snare, a second wind, longer
    // holds, the low marked) is one class's each
    for (const key of ['slow', 'stun', 'snare', 'rally', 'hold', 'exec'] as const) expect(new Set(all.filter((t) => t[key]).map((t) => t.cls)).size, key).toBeLessThanOrEqual(1);
    // every class has its own super talent, that changes what the super does rather than only its numbers
    for (const cls of CLASS_IDS) {
      // (and works on either of the class's supers: whichever its hero carries)
      const tune = TALENTS[cls].find((t) => t.tune?.super)?.tune?.super;
      expect(tune && (tune.pull || tune.extra || tune.line || tune.spread || tune.bounce || tune.drink || tune.self || tune.friends || tune.foes), cls).toBeTruthy();
    }
  });

  it('what a talent puts on someone is shown with the talent’s own icon and name', () => {
    for (const t of Object.values(TALENT_BY_ID)) {
      const look = lookOf(t.id)!;
      expect(look.name).toBe(t.name);
      expect(look.icon).toBeTruthy();
    }
  });
});

describe('The Ring talents: the warrior', () => {
  it('Grudge: each blow in a row on one enemy hits harder, up to its most; another enemy starts it over', () => {
    const m = fight([{ team: 0, cls: 'warrior', talents: ['w-1a'], bar: ['w-hew'] }, { team: 1, cls: 'paladin' }, { team: 1, cls: 'paladin', at: [205, 140] }]);
    const [w, a, b] = m.fighters as [Fighter, Fighter, Fighter];
    const blow = (t: Fighter): number => {
      w.gcd = 0;
      w.target = t.id;
      const hp = t.hp;
      expect(m.press(0, 'w-hew')).toBeNull();
      return hp - t.hp;
    };
    const g = doing('w-1a', 'grudge');
    const hits = Array.from({ length: g.max + 2 }, () => blow(a));
    // (each at least as hard as the last: a blow is a whole number, so two small steps can round alike)
    for (let i = 1; i < hits.length; i++) expect(hits[i]).toBeGreaterThanOrEqual(hits[i - 1]!);
    expect(hits[2]).toBeGreaterThan(hits[0]!);
    expect(hits[g.max]).toBeCloseTo(hits[0]! * (1 + g.step * g.max), -0.5);
    expect(hits[g.max + 1]).toBe(hits[g.max]);
    expect(blow(b)).toBe(hits[0]);
  });

  it('Warpath: either super hits harder and leaves the warrior unstoppable and quick', () => {
    for (const ult of ['w-super', 'w-super2']) {
      const m = fight([{ team: 0, cls: 'warrior', talents: ['w-1c'], ult }, { team: 1, cls: 'mage', at: [240, 125] }]);
      const w = m.fighters[0]!;
      w.charge = 1;
      w.auras.push({ ab: 'm-spear', kind: 'slow', src: 1, t: 4, dur: 4, harmful: true, magic: true, n: 0.4 });
      expect(m.press(0, ult), ult).toBeNull();
      expect(w.auras.some((a) => a.kind === 'slow'), ult).toBe(false);
      expect(w.auras.some((a) => a.kind === 'free') && w.auras.some((a) => a.kind === 'speed'), ult).toBe(true);
    }
  });

  it('Shoulder Check: a Swift Step that ends beside an enemy stuns them, and not again for a while', () => {
    const m = fight([{ team: 0, cls: 'warrior', talents: ['w-2c'], bar: ['w-hew'] }, { team: 1, cls: 'mage', at: [270, 125] }]);
    const [w, mage] = m.fighters as [Fighter, Fighter];
    w.dirX = 1;
    w.dirY = 0;
    expect(m.press(0, DASH.id)).toBeNull();
    wait(m, 0.4);
    expect(m.held(mage)?.cc).toBe('stun');
    wait(m, 5);
    w.x = mage.x - 62 - doing('w-2c', 'check').reach / 2;
    expect(m.press(0, DASH.id)).toBeNull();
    wait(m, 0.4);
    expect(m.held(mage)).toBeUndefined();
  });

  it('Scar Tissue: every blow taken hardens them a little, up to 10% less', () => {
    const m = fight([{ team: 0, cls: 'warrior', talents: ['w-3a'] }, { team: 1, cls: 'warrior', bar: ['w-hew'] }]);
    const [w, foe] = m.fighters as [Fighter, Fighter];
    const blow = (): number => {
      foe.gcd = 0;
      const hp = w.hp;
      m.press(1, 'w-hew');
      return hp - w.hp;
    };
    const first = blow();
    for (let i = 0; i < 6; i++) blow();
    expect(w.auras.find((a) => a.ab === 'w-3a')?.n).toBeCloseTo(0.1);
    expect(blow()).toBeCloseTo(first * 0.9, -0.5);
  });

  it('Break Loose: when a hold ends, they run faster', () => {
    const m = fight([{ team: 0, cls: 'warrior', talents: ['w-3b'] }, { team: 1, cls: 'warrior' }]);
    const [w, foe] = m.fighters as [Fighter, Fighter];
    inside(m).crowd(foe, AB('w-hurl'), w, 'stun', 1);
    wait(m, 0.5);
    expect(has(w, 'w-3b', 'speed')).toBe(false);
    wait(m, 0.7);
    expect(w.auras.find((a) => a.ab === 'w-3b' && a.kind === 'speed')?.n).toBeCloseTo(0.5);
  });
});

describe('The Ring talents: the mage', () => {
  it('Wildfire: a critical hit sets them burning', () => {
    const m = fight([{ team: 0, cls: 'mage', talents: ['m-1a'] }, { team: 1, cls: 'warrior' }]);
    const [mage, foe] = m.fighters as [Fighter, Fighter];
    inside(m).damage(mage, foe, 50, true, AB('m-burn'));
    expect(has(foe, 'm-1a', 'dot')).toBe(false);
    mage.mods.crit = 1;
    inside(m).damage(mage, foe, 50, true, AB('m-burn'));
    expect(has(foe, 'm-1a', 'dot')).toBe(true);
    const hp = foe.hp;
    wait(m, 4.1);
    expect(foe.hp).toBeLessThan(hp);
  });

  it('Brimming Power: spells hit harder while mana is high', () => {
    const m = fight([{ team: 0, cls: 'mage', talents: ['m-1b'] }, { team: 1, cls: 'warrior' }]);
    const [mage, foe] = m.fighters as [Fighter, Fighter];
    const full = inside(m).damage(mage, foe, 100, true, AB('m-burn'));
    mage.mana = 30;
    const low = inside(m).damage(mage, foe, 100, true, AB('m-burn'));
    expect(full).toBeCloseTo(low * 1.12, -0.5);
  });

  it('Comet Caller: Cinder Comet leaves them burning', () => {
    for (const talents of [['m-1c'], []]) {
      const m = fight([{ team: 0, cls: 'mage', talents }, { team: 1, cls: 'warrior', at: [260, 125] }]);
      m.fighters[0]!.charge = 1;
      expect(m.press(0, 'm-super', { x: 260, y: 125 })).toBeNull();
      wait(m, 1);
      expect(has(m.fighters[1]!, 'm-super', 'dot')).toBe(talents.length > 0);
    }
  });

  it('Fold Space: the Swift Step is a blink, half again as far, even out of roots, and slower to come back', () => {
    const m = fight([{ team: 0, cls: 'mage', talents: ['m-2b'] }, { team: 1, cls: 'druid' }]);
    const [mage, foe] = m.fighters as [Fighter, Fighter];
    inside(m).crowd(foe, AB('l-roots'), mage, 'root', 3);
    expect(m.rooted(mage)).toBe(true);
    mage.dirX = 1;
    mage.dirY = 0;
    expect(m.press(0, DASH.id)).toBeNull();
    // (at once: a blink, not a slide)
    expect(mage.x).toBeCloseTo(200 + 62 * doing('m-2b', 'fold').far, 0);
    expect(m.rooted(mage)).toBe(false);
    expect(mage.cds[DASH.id]).toBeCloseTo(DASH.cd * TALENT_BY_ID['m-2b']!.tune!.dash!.cd!);
    // without it, the roots hold
    const n = fight([{ team: 0, cls: 'mage' }, { team: 1, cls: 'druid' }]);
    inside(n).crowd(n.fighters[1]!, AB('l-roots'), n.fighters[0]!, 'root', 3);
    expect(n.press(0, DASH.id)).toBe('Rooted');
  });

  it('Third Chill: the third hit on one enemy in a few seconds freezes them to the ground', () => {
    const m = fight([{ team: 0, cls: 'mage', talents: ['m-2c'] }, { team: 1, cls: 'warrior' }]);
    const [mage, foe] = m.fighters as [Fighter, Fighter];
    inside(m).damage(mage, foe, 10, true, AB('m-burn'));
    inside(m).damage(mage, foe, 10, true, AB('m-burn'));
    expect(m.rooted(foe)).toBe(false);
    inside(m).damage(mage, foe, 10, true, AB('m-burn'));
    expect(m.rooted(foe)).toBe(true);
  });

  it('Mana Skin: while there is mana to spare, some of what they take is paid in mana', () => {
    const taken = (talents: string[], mana: number): [number, number] => {
      const m = fight([{ team: 0, cls: 'mage', talents }, { team: 1, cls: 'warrior' }]);
      const mage = m.fighters[0]!;
      mage.mana = mana;
      inside(m).damage(m.fighters[1]!, mage, 100, true, AB('w-hew'));
      return [mage.maxHp - mage.hp, mage.mana];
    };
    const d = doing('m-3a', 'manaskin');
    const [plain] = taken([], 100);
    const [skin, left] = taken(['m-3a'], 100);
    expect(skin).toBeCloseTo(plain * (1 - d.share), -0.5);
    expect(left).toBeLessThan(100);
    // (never below its line: what mana there is left is for casting)
    expect(taken(['m-3a'], 100 * d.above)[0]).toBe(plain);
  });

  it('Rewind: a Swift Step gives back half of what was taken in the last few seconds, once in a while', () => {
    const m = fight([{ team: 0, cls: 'mage', talents: ['m-3b'] }, { team: 1, cls: 'warrior' }]);
    const [mage, foe] = m.fighters as [Fighter, Fighter];
    inside(m).damage(foe, mage, 200, true, AB('w-hew'));
    const lost = mage.maxHp - mage.hp;
    m.press(0, DASH.id);
    expect(mage.maxHp - mage.hp).toBeCloseTo(lost / 2, -0.5);
    wait(m, 5.1);
    inside(m).damage(foe, mage, 200, true, AB('w-hew'));
    const hp = mage.hp;
    m.press(0, DASH.id);
    expect(mage.hp).toBe(hp);
  });

  it('Vanishing Point: falling low, they vanish away from the nearest enemy', () => {
    const m = fight([{ team: 0, cls: 'mage', talents: ['m-3c'] }, { team: 1, cls: 'warrior' }]);
    const [mage, foe] = m.fighters as [Fighter, Fighter];
    mage.hp = Math.round(mage.maxHp * 0.4);
    inside(m).damage(foe, mage, 100, true, AB('w-hew'));
    expect(mage.x).toBeCloseTo(200 - 100, 0);
  });
});

describe('The Ring talents: the ranger', () => {
  it('Quarry: their hit marks one enemy, and their whole side hits it harder', () => {
    const m = fight([{ team: 0, cls: 'ranger', talents: ['r-1a'] }, { team: 1, cls: 'paladin' }, { team: 0, cls: 'warrior' }, { team: 1, cls: 'mage' }]);
    const [r, pal, w, mage] = m.fighters as [Fighter, Fighter, Fighter, Fighter];
    const before = inside(m).damage(w, pal, 100, true, AB('w-hew'));
    inside(m).damage(r, pal, 10, true, AB('r-swift'));
    expect(has(pal, 'r-1a', 'mark')).toBe(true);
    expect(inside(m).damage(w, pal, 100, true, AB('w-hew'))).toBeCloseTo(before * (1 + doing('r-1a', 'quarry').pct), -0.5);
    // one quarry at a time
    inside(m).damage(r, mage, 10, true, AB('r-swift'));
    expect(has(pal, 'r-1a')).toBe(false);
    expect(has(mage, 'r-1a', 'mark')).toBe(true);
  });

  it('Long Shot: a hit from farther than half its reach hits harder', () => {
    const m = fight([{ team: 0, cls: 'ranger', talents: ['r-1b'] }, { team: 1, cls: 'warrior' }]);
    const [r, foe] = m.fighters as [Fighter, Fighter];
    const near = inside(m).damage(r, foe, 100, true, AB('r-swift'));
    foe.x = r.x + 150;
    expect(inside(m).damage(r, foe, 100, true, AB('r-swift'))).toBeCloseTo(near * (1 + doing('r-1b', 'far').pct), -0.5);
  });

  it('Doomed Prey: whoever either super hits takes more from the whole side', () => {
    for (const ult of ['r-super', 'r-super2']) {
      const m = fight([{ team: 0, cls: 'ranger', talents: ['r-1c'], ult }, { team: 1, cls: 'warrior', at: [300, 125] }]);
      m.fighters[0]!.charge = 1;
      expect(m.press(0, ult, { x: 300, y: 125 }), ult).toBeNull();
      wait(m, 1);
      expect(m.fighters[1]!.auras.find((a) => a.kind === 'mark' && a.src === 0)?.n, ult).toBeCloseTo(0.15, 5);
    }
  });

  it('Pinning Shot: a critical hit pins them, and not again for a while', () => {
    const m = fight([{ team: 0, cls: 'ranger', talents: ['r-2a'] }, { team: 1, cls: 'warrior' }]);
    const [r, foe] = m.fighters as [Fighter, Fighter];
    r.mods.crit = 1;
    inside(m).damage(r, foe, 1, true, AB('r-swift'));
    expect(m.rooted(foe)).toBe(true);
    foe.auras = [];
    inside(m).damage(r, foe, 1, true, AB('r-swift'));
    expect(m.rooted(foe)).toBe(false);
  });

  it('Hawk’s Cry: hitting someone mid-cast cuts it off and locks its school', () => {
    const m = fight([{ team: 0, cls: 'ranger', talents: ['r-2c'] }, { team: 1, cls: 'mage', bar: ['m-pyre'], at: [300, 125] }]);
    const [r, mage] = m.fighters as [Fighter, Fighter];
    expect(m.press(1, 'm-pyre', { x: 200, y: 125 })).toBeNull();
    expect(mage.cast).not.toBeNull();
    inside(m).damage(r, mage, 5, true, AB('r-swift'));
    expect(mage.cast).toBeNull();
    expect(mage.locks.fire).toBeGreaterThan(1.5);
  });

  it('Cover: out of every enemy’s sight for a while, they heal', () => {
    // (the sands' pillar at 176-206 across, 70-96 down, between them)
    const m = fight([{ team: 0, cls: 'ranger', talents: ['r-3a'], at: [160, 83] }, { team: 1, cls: 'warrior', at: [225, 83] }]);
    const r = m.fighters[0]!;
    expect(m.sees(m.fighters[1]!, r)).toBe(false);
    r.hp = Math.round(r.maxHp / 2);
    const hp = r.hp;
    wait(m, 1.5);
    expect(r.hp).toBe(hp);
    wait(m, 2.6);
    expect(r.hp).toBeGreaterThan(hp + r.maxHp * 0.05);
  });

  it('Forager: a healing sphere heals more and quickens', () => {
    const sphere = (talents: string[]): [number, boolean] => {
      const m = fight([{ team: 0, cls: 'ranger', talents }, { team: 1, cls: 'warrior', at: [600, 125] }]);
      const r = m.fighters[0]!;
      const o = m.orbs[0]!;
      o.at = 0;
      [r.x, r.y] = [o.x, o.y];
      r.hp = Math.round(r.maxHp / 2);
      const hp = r.hp;
      m.step(STEP, {});
      return [r.hp - hp, has(r, 'r-3b', 'speed')];
    };
    const [plain] = sphere([]);
    expect(plain).toBeCloseTo(1260 * ORB_HEAL, -0.5);
    expect(sphere(['r-3b'])).toEqual([Math.round(1260 * ORB_HEAL * (1 + doing('r-3b', 'forage').more)), true]);
  });

  it('Antivenom: what burns over time hurts less', () => {
    const m = fight([{ team: 0, cls: 'ranger', talents: ['r-3c'] }, { team: 1, cls: 'warlock' }]);
    const n = fight([{ team: 0, cls: 'ranger' }, { team: 1, cls: 'warlock' }]);
    const burn = (x: Match): number => inside(x).damage(x.fighters[1]!, x.fighters[0]!, 100, false, AB('k-agony'));
    expect(burn(m)).toBeCloseTo(burn(n) * (1 - doing('r-3c', 'antivenom').pct), -0.5);
    // (a blow lands as hard as ever)
    expect(inside(m).damage(m.fighters[1]!, m.fighters[0]!, 100, true, AB('k-bolt'))).toBe(inside(n).damage(n.fighters[1]!, n.fighters[0]!, 100, true, AB('k-bolt')));
  });
});

describe('The Ring talents: the priest', () => {
  it('Light Returned: damage dealt heals the friend most hurt', () => {
    const m = fight([{ team: 0, cls: 'priest', talents: ['p-1a'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'warrior' }]);
    const [p, foe, friend] = m.fighters as [Fighter, Fighter, Fighter];
    friend.hp = Math.round(friend.maxHp / 2);
    const hp = friend.hp;
    inside(m).damage(p, foe, 200, true, AB('p-smite'));
    expect(friend.hp).toBeGreaterThan(hp);
    expect(p.hp).toBe(p.maxHp);
  });

  it('Bright Wings: either super heals every friend in reach and frees them of a curse', () => {
    for (const ult of ['p-super', 'p-super2']) {
      const m = fight([{ team: 0, cls: 'priest', talents: ['p-1b'], ult }, { team: 0, cls: 'warrior', at: [230, 140] }, { team: 1, cls: 'mage', at: [320, 125] }]);
      const [p, w] = m.fighters as [Fighter, Fighter];
      p.charge = 1;
      w.hp = 500;
      w.auras.push({ ab: 'k-agony', kind: 'dot', src: 2, t: 6, dur: 6, harmful: true, magic: true, n: 1, next: 1 });
      expect(m.press(0, ult, { x: 320, y: 125 }), ult).toBeNull();
      expect(w.hp, ult).toBeGreaterThan(500);
      expect(w.auras.some((a) => a.ab === 'k-agony'), ult).toBe(false);
    }
  });

  it('Brimming Grace: healing past full stays on as a shield, to a cap', () => {
    const m = fight([{ team: 0, cls: 'priest', talents: ['p-1c'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'warrior' }]);
    const [p, , friend] = m.fighters as [Fighter, Fighter, Fighter];
    inside(m).heal(p, friend, 50);
    const shield = friend.auras.find((a) => a.ab === 'p-1c' && a.kind === 'absorb')!;
    expect(shield.n).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) inside(m).heal(p, friend, 200);
    expect(friend.auras.find((a) => a.ab === 'p-1c')!.n).toBeCloseTo(friend.maxHp * doing('p-1c', 'overflow').cap, 0);
  });

  it('Guardian Leap: the Swift Step goes farther, and to a chosen friend’s side', () => {
    const m = fight([{ team: 0, cls: 'priest', talents: ['p-2a'] }, { team: 1, cls: 'warrior', at: [500, 200] }, { team: 0, cls: 'warrior', at: [340, 125] }]);
    const [p, , friend] = m.fighters as [Fighter, Fighter, Fighter];
    p.friend = friend.id;
    expect(m.press(0, DASH.id)).toBeNull();
    wait(m, 0.5);
    expect(Math.hypot(p.x - friend.x, p.y - friend.y)).toBeLessThan(HERO_R * 3);
    // with nobody chosen, a longer step the way they face
    const n = fight([{ team: 0, cls: 'priest', talents: ['p-2a'] }, { team: 1, cls: 'warrior', at: [500, 200] }]);
    Object.assign(n.fighters[0]!, { dirX: -1, dirY: 0 });
    n.press(0, DASH.id);
    wait(n, 0.5);
    expect(200 - n.fighters[0]!.x).toBeCloseTo(62 * doing('p-2a', 'leap').far, 0);
  });

  it('Sapping Word: who they hurt is healed less', () => {
    const m = fight([{ team: 0, cls: 'priest', talents: ['p-2b'] }, { team: 1, cls: 'warrior' }]);
    inside(m).damage(m.fighters[0]!, m.fighters[1]!, 10, true, AB('p-smite'));
    expect(m.fighters[1]!.auras.find((a) => a.ab === 'p-2b')).toMatchObject({ kind: 'antiheal', n: doing('p-2b', 'sap').pct / 100, magic: true });
  });

  it('Halo of Dread: the next enemy to hit them flees, once in a while', () => {
    const m = fight([{ team: 0, cls: 'priest', talents: ['p-2c'] }, { team: 1, cls: 'warrior', bar: ['w-hew'] }]);
    const foe = m.fighters[1]!;
    m.press(1, 'w-hew');
    expect(m.held(foe)?.cc).toBe('fear');
    foe.auras = [];
    foe.gcd = 0;
    m.press(1, 'w-hew');
    expect(m.held(foe)).toBeUndefined();
  });

  it('Lingering Spirit: falling, they linger on untouchable for a while, then fall', () => {
    const m = fight([{ team: 0, cls: 'priest', talents: ['p-3a'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'warrior', at: [100, 200] }]);
    const [p, foe] = m.fighters as [Fighter, Fighter];
    inside(m).damage(foe, p, 5000, true, AB('w-hew'));
    expect(p.dead).toBe(false);
    expect(p.hp).toBe(1);
    expect(has(p, 'p-3a', 'spirit')).toBe(true);
    inside(m).damage(foe, p, 5000, true, AB('w-hew'));
    expect(p.dead).toBe(false);
    // (nothing heals a spirit)
    inside(m).heal(m.fighters[2]!, p, 300);
    expect(p.hp).toBe(1);
    // (and they can still act)
    expect(m.blocked(p, AB('p-smite'))).toBeNull();
    wait(m, doing('p-3a', 'spirit').dur + 0.1);
    expect(p.dead).toBe(true);
    // once a match
    expect(m.fighters[0]!.tal.spent).toContain('spirit');
  });

  it('Morning Ward: a ward forms on them now and again', () => {
    const m = fight([{ team: 0, cls: 'priest', talents: ['p-3b'] }, { team: 1, cls: 'warrior' }]);
    const p = m.fighters[0]!;
    m.step(STEP, {});
    const d = doing('p-3b', 'ward');
    expect(p.auras.find((a) => a.ab === 'p-3b')).toMatchObject({ kind: 'absorb', n: Math.round(p.maxHp * d.pct) });
    p.auras = [];
    wait(m, d.every - 1);
    expect(has(p, 'p-3b')).toBe(false);
    wait(m, 1.1);
    expect(has(p, 'p-3b')).toBe(true);
  });

  it('Open Heart: healing given to them is stronger', () => {
    const m = fight([{ team: 0, cls: 'priest', talents: ['p-3c'] }, { team: 1, cls: 'warrior', at: [600, 125] }]);
    const p = m.fighters[0]!;
    const o = m.orbs[0]!;
    o.at = 0;
    [p.x, p.y] = [o.x, o.y];
    p.hp = Math.round(p.maxHp / 2);
    const hp = p.hp;
    m.step(STEP, {});
    expect(p.hp - hp).toBe(Math.round(p.maxHp * ORB_HEAL * (1 + doing('p-3c', 'open').pct)));
  });
});

describe('The Ring talents: the paladin', () => {
  it('Verdict of Light: every fifth hit calls down light, more damage and a heal', () => {
    const m = fight([{ team: 0, cls: 'paladin', talents: ['d-1a'] }, { team: 1, cls: 'warrior' }]);
    const [pal, foe] = m.fighters as [Fighter, Fighter];
    pal.hp = Math.round(pal.maxHp / 2);
    const every = doing('d-1a', 'verdict').every;
    const hits: number[] = [];
    for (let i = 0; i < every; i++) {
      const hp = foe.hp;
      inside(m).damage(pal, foe, 30, true, AB('d-blow'));
      hits.push(hp - foe.hp);
    }
    expect(hits[every - 1]).toBeGreaterThan(hits[every - 2]! + 8);
    expect(pal.hp).toBeGreaterThan(pal.maxHp / 2);
    expect(m.events.some((e) => e.k === 'streak' && e.ab === 'd-1a')).toBe(true);
  });

  it('Aura of Wrath: friends near the paladin hit harder', () => {
    const m = fight([{ team: 0, cls: 'paladin', talents: ['d-1b'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'warrior', at: [190, 140] }]);
    const [pal, foe, w] = m.fighters as [Fighter, Fighter, Fighter];
    const near = inside(m).damage(w, foe, 100, true, AB('w-hew'));
    pal.x = w.x - NEAR - 30;
    const far = inside(m).damage(w, foe, 100, true, AB('w-hew'));
    expect(near).toBeCloseTo(far * (1 + doing('d-1b', 'wrath').pct), -0.5);
  });

  it('Blinding Dawn: either super dazes every enemy near the paladin', () => {
    for (const ult of ['d-super', 'd-super2']) {
      const m = fight([{ team: 0, cls: 'paladin', talents: ['d-1c'], ult }, { team: 1, cls: 'warrior', at: [230, 125] }, { team: 1, cls: 'mage', at: [225, 145] }]);
      m.fighters[0]!.charge = 1;
      expect(m.press(0, ult), ult).toBeNull();
      // (Sunhammer's own blow lands on the warrior and breaks his daze: the mage beside him stays dazed)
      expect(m.held(m.fighters[2]!)?.cc, ult).toBe('incap');
    }
  });

  it('Aura of Resolve: holds on friends near the paladin are shorter', () => {
    const m = fight([{ team: 0, cls: 'paladin', talents: ['d-2a'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'mage', at: [190, 140] }, { team: 0, cls: 'priest', at: [60, 260] }]);
    const [, foe, near, far] = m.fighters as [Fighter, Fighter, Fighter, Fighter];
    inside(m).crowd(foe, AB('w-hurl'), near, 'stun', 2);
    inside(m).crowd(foe, AB('w-hurl'), far, 'stun', 2);
    expect(m.held(near)!.t).toBeCloseTo(2 * (1 - doing('d-2a', 'resolve').pct));
    expect(m.held(far)!.t).toBeCloseTo(2);
  });

  it('Hand of Freedom: a root or slow on a friend near is shaken off, once in a while', () => {
    const m = fight([{ team: 0, cls: 'paladin', talents: ['d-2b'] }, { team: 1, cls: 'druid' }, { team: 0, cls: 'mage', at: [190, 140] }]);
    const [, foe, friend] = m.fighters as [Fighter, Fighter, Fighter];
    expect(inside(m).crowd(foe, AB('l-roots'), friend, 'root', 2)).toBe(false);
    expect(m.rooted(friend)).toBe(false);
    expect(inside(m).crowd(foe, AB('l-roots'), friend, 'root', 2)).toBe(true);
    expect(m.rooted(friend)).toBe(true);
  });

  it('Stern Blows: their hits knock a cast back far, as often as they land', () => {
    const pushed = (talents: string[]): number => {
      const m = fight([{ team: 0, cls: 'paladin', talents }, { team: 1, cls: 'priest', bar: ['p-greater'] }]);
      const [pal, p] = m.fighters as [Fighter, Fighter];
      p.target = p.id;
      p.friend = p.id;
      p.hp -= 100;
      expect(m.press(1, 'p-greater')).toBeNull();
      wait(m, 1);
      for (let i = 0; i < 3; i++) inside(m).damage(pal, p, 1, true, AB('d-blow'));
      return p.cast!.t;
    };
    expect(pushed([])).toBeCloseTo(0.5, 1);
    expect(pushed(['d-2c'])).toBe(0);
  });

  it('Shared Burden: a share of what friends near take is the paladin’s', () => {
    const took = (talents: string[]): [number, number] => {
      const m = fight([{ team: 0, cls: 'paladin', talents }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'mage', at: [190, 140] }]);
      const [pal, foe, friend] = m.fighters as [Fighter, Fighter, Fighter];
      inside(m).damage(foe, friend, 200, true, AB('w-hew'));
      return [friend.maxHp - friend.hp, pal.maxHp - pal.hp];
    };
    const [plain] = took([]);
    const [friend, pal] = took(['d-3a']);
    const share = doing('d-3a', 'burden').share;
    expect(friend).toBeCloseTo(plain * (1 - share), -0.5);
    expect(pal).toBeGreaterThan(0);
    expect(pal).toBeLessThan(plain * share);
  });

  it('Plate and Prayer: blows hurt less, spells don’t', () => {
    const m = fight([{ team: 0, cls: 'paladin', talents: ['d-3b'] }, { team: 1, cls: 'warrior' }]);
    const n = fight([{ team: 0, cls: 'paladin' }, { team: 1, cls: 'warrior' }]);
    const hit = (x: Match, ab: string): number => inside(x).damage(x.fighters[1]!, x.fighters[0]!, 100, true, AB(ab));
    expect(hit(m, 'w-hew')).toBeCloseTo(hit(n, 'w-hew') * (1 - doing('d-3b', 'plate').pct), -0.5);
    expect(hit(m, 'm-burn')).toBe(hit(n, 'm-burn'));
  });

  it('Unbroken Vow: the first fall under a fifth of their health makes them untouchable, once a match', () => {
    const m = fight([{ team: 0, cls: 'paladin', talents: ['d-3c'] }, { team: 1, cls: 'warrior' }]);
    const [pal, foe] = m.fighters as [Fighter, Fighter];
    pal.hp = Math.round(pal.maxHp * 0.25);
    inside(m).damage(foe, pal, 100, true, AB('w-hew'));
    expect(has(pal, 'd-3c', 'immune')).toBe(true);
    const hp = pal.hp;
    inside(m).damage(foe, pal, 100, true, AB('w-hew'));
    expect(pal.hp).toBe(hp);
    wait(m, doing('d-3c', 'vow').dur + 0.1);
    pal.hp = Math.round(pal.maxHp * 0.25);
    inside(m).damage(foe, pal, 100, true, AB('w-hew'));
    expect(has(pal, 'd-3c')).toBe(false);
  });
});

describe('The Ring talents: the warlock', () => {
  it('Pit Imp: an imp spits at their enemy every few seconds, of itself', () => {
    const m = fight([{ team: 0, cls: 'warlock', talents: ['k-1a'] }, { team: 1, cls: 'warrior', at: [330, 125] }]);
    const foe = m.fighters[1]!;
    wait(m, doing('k-1a', 'imp').every + 0.2);
    expect(m.events.filter((e) => e.k === 'streak' && e.ab === 'k-1a')).toHaveLength(2);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    // (out of its reach, nothing)
    const n = fight([{ team: 0, cls: 'warlock', talents: ['k-1a'] }, { team: 1, cls: 'warrior', at: [600, 125] }]);
    wait(n, 2);
    expect(n.fighters[1]!.hp).toBe(n.fighters[1]!.maxHp);
  });

  it('Black Desperation: the lower their health, the harder they hit', () => {
    const m = fight([{ team: 0, cls: 'warlock', talents: ['k-1b'] }, { team: 1, cls: 'warrior' }]);
    const [k, foe] = m.fighters as [Fighter, Fighter];
    const full = inside(m).damage(k, foe, 100, true, AB('k-bolt'));
    k.hp = Math.round(k.maxHp * 0.2);
    expect(inside(m).damage(k, foe, 100, true, AB('k-bolt'))).toBeCloseTo(full * (1 + doing('k-1b', 'desperate').pct * 0.8), -0.5);
  });

  it('Doom’s Herald: either super curses every enemy near the warlock', () => {
    for (const ult of ['k-super', 'k-super2']) {
      const m = fight([{ team: 0, cls: 'warlock', talents: ['k-1c'], ult }, { team: 1, cls: 'warrior', at: [240, 125] }]);
      m.fighters[0]!.charge = 1;
      expect(m.press(0, ult, { x: 240, y: 125 }), ult).toBeNull();
      expect(m.fighters[1]!.auras.some((a) => a.kind === 'dot' && a.src === 0), ult).toBe(true);
    }
  });

  it('Enfeeble: who they hurt hits softer for a while', () => {
    const m = fight([{ team: 0, cls: 'warlock', talents: ['k-2a'] }, { team: 1, cls: 'warrior' }]);
    const [k, foe] = m.fighters as [Fighter, Fighter];
    const before = inside(m).damage(foe, k, 100, true, AB('w-hew'));
    inside(m).damage(k, foe, 10, true, AB('k-bolt'));
    expect(inside(m).damage(foe, k, 100, true, AB('w-hew'))).toBeCloseTo(before * (1 - doing('k-2a', 'enfeeble').pct / 100), -0.5);
  });

  it('Way Back: the next Swift Step soon after one goes back to where it began', () => {
    const m = fight([{ team: 0, cls: 'warlock', talents: ['k-2b'] }, { team: 1, cls: 'warrior', at: [600, 200] }]);
    const k = m.fighters[0]!;
    Object.assign(k, { dirX: 1, dirY: 0 });
    m.press(0, DASH.id);
    wait(m, 5.1);
    expect(k.x).toBeGreaterThan(250);
    expect(m.press(0, DASH.id)).toBeNull();
    expect([k.x, k.y]).toEqual([200, 125]);
  });

  it('Mirror Curse: the first hold on them now and then goes back on whoever put it', () => {
    const m = fight([{ team: 0, cls: 'warlock', talents: ['k-2c'] }, { team: 1, cls: 'warrior' }]);
    const [k, foe] = m.fighters as [Fighter, Fighter];
    expect(inside(m).crowd(foe, AB('w-hurl'), k, 'stun', 2)).toBe(false);
    expect(m.held(k)).toBeUndefined();
    expect(m.held(foe)).toMatchObject({ cc: 'stun', t: 2 * doing('k-2c', 'mirror').share });
    expect(inside(m).crowd(foe, AB('w-hurl'), k, 'stun', 2)).toBe(true);
  });

  it('Hollow Pact: falling low, their mana becomes health', () => {
    const m = fight([{ team: 0, cls: 'warlock', talents: ['k-3a'] }, { team: 1, cls: 'warrior' }]);
    const [k, foe] = m.fighters as [Fighter, Fighter];
    k.hp = Math.round(k.maxHp * 0.4);
    inside(m).damage(foe, k, 100, true, AB('w-hew'));
    expect(k.mana).toBe(0);
    expect(k.hp).toBeGreaterThan(k.maxHp * 0.4);
  });

  it('Unholy Bargain: less hurt, less healed', () => {
    const m = fight([{ team: 0, cls: 'warlock', talents: ['k-3b'] }, { team: 1, cls: 'warrior', at: [600, 125] }]);
    const n = fight([{ team: 0, cls: 'warlock' }, { team: 1, cls: 'warrior', at: [600, 125] }]);
    const hit = (x: Match): number => inside(x).damage(x.fighters[1]!, x.fighters[0]!, 100, true, AB('w-hew'));
    expect(hit(m)).toBeCloseTo(hit(n) * (1 - TALENT_BY_ID['k-3b']!.guard!), -0.5);
    const k = m.fighters[0]!;
    const o = m.orbs[0]!;
    o.at = 0;
    [k.x, k.y] = [o.x, o.y];
    k.hp = Math.round(k.maxHp / 2);
    const hp = k.hp;
    m.step(STEP, {});
    expect(k.hp - hp).toBe(Math.round(k.maxHp * ORB_HEAL * (1 - doing('k-3b', 'bargain').pct)));
  });

  it('Soul Shield: dealing damage wards them, a little at a time, to a cap', () => {
    const m = fight([{ team: 0, cls: 'warlock', talents: ['k-3c'] }, { team: 1, cls: 'warrior' }]);
    const [k, foe] = m.fighters as [Fighter, Fighter];
    const d = doing('k-3c', 'soulward');
    const ward = (): number => k.auras.find((a) => a.ab === 'k-3c')?.n ?? 0;
    inside(m).damage(k, foe, 10, false, AB('k-agony'));
    inside(m).damage(k, foe, 10, false, AB('k-agony'));
    expect(ward()).toBe(Math.round(k.maxHp * d.pct));
    for (let i = 0; i < 10; i++) {
      wait(m, d.every);
      inside(m).damage(k, foe, 10, true, AB('k-bolt'));
    }
    expect(ward()).toBe(Math.round(k.maxHp * d.max));
  });
});

describe('The Ring talents: the druid', () => {
  it('Sun and Moon: a hit makes the next heal stronger, and a heal the next hit', () => {
    const m = fight([{ team: 0, cls: 'druid', talents: ['l-1a'] }, { team: 1, cls: 'warrior' }]);
    const [d, foe] = m.fighters as [Fighter, Fighter];
    const plain = inside(m).damage(d, foe, 100, true, AB('l-lash'));
    expect(d.tal.heal).toBe(true);
    d.hp -= 300;
    inside(m).heal(d, d, 50);
    expect(d.tal.heal).toBe(false);
    expect(inside(m).damage(d, foe, 100, true, AB('l-lash'))).toBeCloseTo(plain * (1 + doing('l-1a', 'tides').pct), -0.5);
    expect(inside(m).damage(d, foe, 100, true, AB('l-lash'))).toBe(plain);
  });

  it('Grove’s Bloom: either super makes every friend in reach bloom and quicken', () => {
    for (const ult of ['l-super', 'l-super2']) {
      const m = fight([{ team: 0, cls: 'druid', talents: ['l-1b'], ult }, { team: 0, cls: 'warrior', at: [230, 140] }, { team: 1, cls: 'mage', at: [320, 125] }]);
      m.fighters[0]!.charge = 1;
      expect(m.press(0, ult, { x: 320, y: 125 }), ult).toBeNull();
      const w = m.fighters[1]!;
      expect(w.auras.some((a) => a.kind === 'hot' && a.src === 0) && w.auras.some((a) => a.kind === 'speed'), ult).toBe(true);
    }
  });

  it('Long Seasons: their burns and heals over time last longer', () => {
    const m = fight([{ team: 0, cls: 'druid', talents: ['l-1c'], bar: ['l-moon'] }, { team: 1, cls: 'warrior' }]);
    expect(m.press(0, 'l-moon')).toBeNull();
    expect(m.fighters[1]!.auras.find((a) => a.ab === 'l-moon')?.dur).toBeCloseTo(10 * (1 + doing('l-1c', 'seasons').pct));
  });

  it('Stag Form: the Swift Step makes them a stag, faster and free, even from roots', () => {
    const m = fight([{ team: 0, cls: 'druid', talents: ['l-2a'] }, { team: 1, cls: 'druid' }]);
    const [d, foe] = m.fighters as [Fighter, Fighter];
    inside(m).crowd(foe, AB('l-roots'), d, 'root', 3);
    expect(m.press(0, DASH.id)).toBeNull();
    expect(m.rooted(d)).toBe(false);
    expect(has(d, 'l-2a', 'speed') && has(d, 'l-2a', 'free')).toBe(true);
  });

  it('Bramble Hide: whoever strikes them with a blow is hurt and slowed', () => {
    const m = fight([{ team: 0, cls: 'druid', talents: ['l-2b'] }, { team: 1, cls: 'warrior', bar: ['w-hew'] }]);
    const foe = m.fighters[1]!;
    m.press(1, 'w-hew');
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(has(foe, 'l-2b', 'slow')).toBe(true);
    // (a spell from afar is not a blow)
    const n = fight([{ team: 0, cls: 'druid', talents: ['l-2b'] }, { team: 1, cls: 'mage' }]);
    inside(n).damage(n.fighters[1]!, n.fighters[0]!, 50, true, AB('m-burn'));
    expect(n.fighters[1]!.hp).toBe(n.fighters[1]!.maxHp);
  });

  it('Gale Ward: an enemy within arm’s reach is thrown back, once in a while', () => {
    const m = fight([{ team: 0, cls: 'druid', talents: ['l-2c'] }, { team: 1, cls: 'warrior' }]);
    const foe = m.fighters[1]!;
    expect(foe.x - 200).toBeLessThan(ARM);
    wait(m, 0.5);
    expect(foe.x - 200).toBeGreaterThan(60);
    foe.x = 215;
    wait(m, 0.5);
    expect(foe.x).toBe(215);
  });

  it('Heartwood: falling low, they take root as an oak, hard to hurt and mending', () => {
    const m = fight([{ team: 0, cls: 'druid', talents: ['l-3a'] }, { team: 1, cls: 'warrior' }]);
    const [d, foe] = m.fighters as [Fighter, Fighter];
    d.hp = Math.round(d.maxHp * 0.4);
    inside(m).damage(foe, d, 100, true, AB('w-hew'));
    expect(has(d, 'l-3a', 'oak')).toBe(true);
    expect(m.rooted(d)).toBe(true);
    const hp = d.hp;
    wait(m, 2.2, { 0: { mx: -1, my: 0 } });
    expect(d.x).toBe(200);
    expect(d.hp).toBeGreaterThan(hp + d.maxHp * 0.06);
  });

  it('Wild Vigor: they heal a little every few seconds', () => {
    const m = fight([{ team: 0, cls: 'druid', talents: ['l-3b'] }, { team: 1, cls: 'warrior', at: [600, 125] }]);
    const d = m.fighters[0]!;
    const v = doing('l-3b', 'vigor');
    d.hp = Math.round(d.maxHp / 2);
    const hp = d.hp;
    wait(m, v.every - 0.2);
    expect(d.hp).toBe(hp);
    wait(m, 0.4);
    expect(d.hp).toBe(hp + Math.round(d.maxHp * v.pct));
  });

  it('Shed Skin: the Swift Step sheds a curse, and mends a little', () => {
    const m = fight([{ team: 0, cls: 'druid', talents: ['l-3c'] }, { team: 1, cls: 'warlock', bar: ['k-agony'] }]);
    const d = m.fighters[0]!;
    expect(m.press(1, 'k-agony')).toBeNull();
    expect(has(d, 'k-agony', 'dot')).toBe(true);
    d.hp = Math.round(d.maxHp / 2);
    const hp = d.hp;
    m.press(0, DASH.id);
    expect(has(d, 'k-agony')).toBe(false);
    expect(d.hp).toBe(hp + Math.round(d.maxHp * doing('l-3c', 'shed').heal));
  });
});

describe('The Ring talents: the Gloamknight', () => {
  it('Blood Price: each attack costs a little life and hits harder', () => {
    const m = fight([{ team: 0, cls: 'gloamknight', talents: ['g-1a'], bar: ['g-cleave'] }, { team: 1, cls: 'warrior' }]);
    const n = fight([{ team: 0, cls: 'gloamknight', bar: ['g-cleave'] }, { team: 1, cls: 'warrior' }]);
    const hit = (x: Match): number => inside(x).damage(x.fighters[0]!, x.fighters[1]!, 100, true, AB('g-cleave'));
    expect(hit(m)).toBeCloseTo(hit(n) * (1 + doing('g-1a', 'price').pct), -0.5);
    const g = m.fighters[0]!;
    m.press(0, 'g-cleave');
    expect(g.hp).toBeLessThan(g.maxHp - g.maxHp * 0.005);
  });

  it('Night’s Embrace: hidden, full speed, and the first blow out of the shroud hits harder', () => {
    const NB = PRESETS.gloamknight[1]!.bar;
    const out = (talents: string[]): { speed: number; dealt: number } => {
      const m = fight([{ team: 0, cls: 'gloamknight', talents, bar: NB }, { team: 1, cls: 'warrior', at: [222, 125] }]);
      const [g, foe] = m.fighters as [Fighter, Fighter];
      expect(m.hidden(g)).toBe(true);
      const speed = inside(m).speedOf(g);
      const hp = foe.hp;
      expect(m.press(0, 'g-ambush')).toBeNull();
      expect(m.hidden(g)).toBe(false);
      return { speed, dealt: hp - foe.hp };
    };
    const plain = out([]);
    const held = out(['g-1b']);
    expect(held.speed / plain.speed).toBeCloseTo(1 / 0.85, 2);
    expect(held.dealt / plain.dealt).toBeCloseTo(1.3, 1);
    expect(doing('g-1b', 'shade').pct).toBe(0.3);
  });

  it('Eclipse Hunger: Eclipse Reaping drinks a share of all it deals', () => {
    const drank = (talents: string[]): number => {
      const m = fight([{ team: 0, cls: 'gloamknight', talents }, { team: 1, cls: 'warrior', at: [300, 125] }]);
      const g = m.fighters[0]!;
      g.charge = 1;
      g.hp = Math.round(g.maxHp / 3);
      const hp = g.hp;
      expect(m.press(0, 'g-super')).toBeNull();
      return g.hp - hp;
    };
    const plain = drank([]);
    expect(plain).toBeLessThan(110);
    expect(drank(['g-1c'])).toBeGreaterThan(plain * 1.5);
  });

  it('Drag Below: a Swift Step toward an enemy in reach drags them along to where it ends, slowed', () => {
    const m = fight([{ team: 0, cls: 'gloamknight', talents: ['g-2a'] }, { team: 1, cls: 'mage', at: [300, 125] }]);
    const [g, mage] = m.fighters as [Fighter, Fighter];
    Object.assign(g, { dirX: 1, dirY: 0 });
    expect(m.press(0, DASH.id)).toBeNull();
    wait(m, 0.5);
    expect(g.x).toBeCloseTo(200 + 62, 0);
    expect(Math.abs(mage.x - g.x)).toBeLessThan(HERO_R * 3);
    expect(mage.auras.find((a) => a.ab === 'g-2a')).toMatchObject({ kind: 'slow', n: doing('g-2a', 'drag').pct / 100 });
    // (a step away is only a step)
    const n = fight([{ team: 0, cls: 'gloamknight', talents: ['g-2a'] }, { team: 1, cls: 'mage', at: [300, 125] }]);
    Object.assign(n.fighters[0]!, { dirX: -1, dirY: 0 });
    n.press(0, DASH.id);
    wait(n, 0.5);
    expect(n.fighters[0]!.x).toBeLessThan(150);
  });

  it('Dusk Mantle: enemies close by move slower', () => {
    const walked = (talents: string[]): number => {
      const m = fight([{ team: 0, cls: 'gloamknight', talents }, { team: 1, cls: 'mage' }]);
      m.step(0.1, { 1: { mx: 0, my: 1 } });
      return m.fighters[1]!.y - 125;
    };
    expect(walked(['g-2b'])).toBeCloseTo(walked([]) * (1 - doing('g-2b', 'mantle').pct), 1);
  });

  it('Death Knell: enemies under a third of their health near them are healed less', () => {
    const healed = (talents: string[]): number => {
      const m = fight([{ team: 0, cls: 'gloamknight', talents, at: [130, 156] }, { team: 1, cls: 'warrior' }]);
      const foe = m.fighters[1]!;
      const o = m.orbs[0]!;
      o.at = 0;
      [foe.x, foe.y] = [o.x, o.y];
      foe.hp = Math.round(foe.maxHp * 0.3);
      const hp = foe.hp;
      m.step(STEP, {});
      return foe.hp - hp;
    };
    expect(healed(['g-2c'])).toBe(Math.round(healed([]) * (1 - doing('g-2c', 'knell').pct)));
  });

  it('Unquiet Grave: a killing blow leaves a revenant, who lives if they drink enough', () => {
    const m = fight([{ team: 0, cls: 'gloamknight', talents: ['g-3a'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'priest', at: [150, 160] }]);
    const [g, foe, p] = m.fighters as [Fighter, Fighter, Fighter];
    inside(m).damage(foe, g, 9999, true, AB('w-hew'));
    expect(g.dead).toBe(false);
    expect(has(g, 'g-3a', 'revenant')).toBe(true);
    // nobody else heals a revenant; what they deal, they drink
    inside(m).heal(p, g, 300);
    expect(g.hp).toBe(1);
    inside(m).damage(g, foe, 400, true, AB('g-cleave'));
    expect(g.hp).toBeGreaterThan(g.maxHp * 0.25);
    wait(m, 5.1);
    expect(g.dead).toBe(false);
    // and once a match only
    inside(m).damage(foe, g, 9999, true, AB('w-hew'));
    expect(g.dead).toBe(true);

    // without drinking enough, the grave takes them
    const n = fight([{ team: 0, cls: 'gloamknight', talents: ['g-3a'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'priest', at: [150, 160] }]);
    inside(n).damage(n.fighters[1]!, n.fighters[0]!, 9999, true, AB('w-hew'));
    wait(n, 5.1);
    expect(n.fighters[0]!.dead).toBe(true);
  });

  it('Thirst of Dusk: friends near them drink of what they deal', () => {
    const m = fight([{ team: 0, cls: 'gloamknight', talents: ['g-3b'] }, { team: 1, cls: 'warrior' }, { team: 0, cls: 'warrior', at: [190, 140] }]);
    const [, foe, w] = m.fighters as [Fighter, Fighter, Fighter];
    w.hp = Math.round(w.maxHp / 2);
    const hp = w.hp;
    const n = inside(m).damage(w, foe, 100, true, AB('w-hew'));
    expect(w.hp - hp).toBe(Math.round(n * doing('g-3b', 'thirst').pct));
  });

  it('Bone Shield: three plates each take some off a hit; one grows back in a while', () => {
    const m = fight([{ team: 0, cls: 'gloamknight', talents: ['g-3c'] }, { team: 1, cls: 'warrior', at: [600, 125] }]);
    const n = fight([{ team: 0, cls: 'gloamknight' }, { team: 1, cls: 'warrior', at: [600, 125] }]);
    const hit = (x: Match): number => inside(x).damage(x.fighters[1]!, x.fighters[0]!, 100, true, AB('w-hew'));
    const d = doing('g-3c', 'bones');
    const plain = hit(n);
    for (let i = 0; i < d.n; i++) expect(hit(m)).toBeCloseTo(plain * (1 - d.pct), -0.5);
    expect(hit(m)).toBe(plain);
    wait(m, d.every + 0.1);
    expect(hit(m)).toBeCloseTo(plain * (1 - d.pct), -0.5);
  });
});
