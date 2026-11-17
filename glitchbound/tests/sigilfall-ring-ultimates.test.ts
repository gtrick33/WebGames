/**
 * The Ring's supers, one for each way a class fights (the owner, 2026-11-14: "let's also add unique ultimates for each
 * loadout, currently every spec has the same ultimate, make every ultimate fun to use, very impactful and cool"). A
 * playstyle's super is its own, as its four abilities are (2026-11-16: "1 base spell 1 ult 3 other spells", "fixed
 * spells per playstyle"); until then a setup could pick either of its class's two.
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, barCombos, PRESETS, SUPERS, SUPERS2, ultFor, ultOf, ultsOf } from '../src/games/sigilfall/arena/abilities';
import { setsOf } from '../src/games/sigilfall/arena/ladder';
import { GATES, Match, type Fighter, type FighterSetup } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { cleanPick } from '../src/games/sigilfall/net/ringRoom';

const STEP = 1 / 30;

function fight(me: { cls: ClassId; ult?: string; bar?: string[] }, foes: { cls: ClassId; at: [number, number] }[], friends: { cls: ClassId; at: [number, number] }[] = []): Match {
  const list: FighterSetup[] = [
    // (the playstyle whose super is asked for, when no bar is)
    { team: 0, cls: me.cls, name: 'me', bar: me.bar ?? (PRESETS[me.cls].find((p) => p.ult === me.ult) ?? PRESETS[me.cls][0]!).bar, ult: me.ult },
    ...friends.map((f, i) => ({ team: 0 as const, cls: f.cls, name: `f${i}`, bar: PRESETS[f.cls][0]!.bar })),
    ...foes.map((f, i) => ({ team: 1 as const, cls: f.cls, name: `e${i}`, bar: PRESETS[f.cls][0]!.bar })),
  ];
  const m = new Match({ seed: 2, map: 'sands', fighters: list });
  m.step(GATES + 0.01, {});
  const at: [number, number][] = [[200, 125], ...friends.map((f) => f.at), ...foes.map((f) => f.at)];
  m.fighters.forEach((f, i) => {
    [f.x, f.y] = at[i]!;
    f.mods.crit = 0;
    f.target = f.team === 0 ? 1 + friends.length : 0;
    f.dirX = f.team === 0 ? 1 : -1;
    f.dirY = 0;
  });
  m.fighters[0]!.charge = 1;
  return m;
}
const wait = (m: Match, seconds: number): void => {
  for (let i = 0; i < seconds / STEP; i++) {
    m.step(STEP, {});
    m.events.length = 0;
  }
};

describe('The Ring: every way to fight has its own super', () => {
  it('two supers to a class, each its own, and the sixteen ready-made setups never share one', () => {
    for (const cls of CLASS_IDS) {
      const [a, b] = ultsOf(cls);
      expect(a).toBe(SUPERS[cls]);
      expect(b).toBe(SUPERS2[cls]);
      expect(a.id).not.toBe(b.id);
      expect(b.super && b.cls === cls && ABILITIES[b.id] === b).toBe(true);
      expect(new Set(PRESETS[cls].map((p) => p.ult)).size).toBe(2);
      // (a ready-made bar, with nothing picked, brings its own)
      for (const p of PRESETS[cls]) expect(ultFor(cls, p.bar)).toBe(p.ult);
    }
    expect(ultOf('mage', 'w-super')).toBe(SUPERS.mage);
  });

  it('a super is its playstyle’s: a setup, a room’s pick and the match all give that one and only that one', () => {
    // (a setup kept from when either could be picked: the Reaper's bar with the Hound's super gets the Reaper's back)
    const kept = setsOf({ standings: {}, sets: { warrior: { active: 0, list: [{ bar: PRESETS.warrior[0]!.bar, talents: [], ult: 'w-super2' }] } } }, 'warrior');
    expect(kept.list[0]!.ult).toBe('w-super');
    expect(setsOf({ standings: {}, sets: {} }, 'warrior').list[1]!.ult).toBe(PRESETS.warrior[1]!.ult);
    // (a room still passes on whatever it was sent, checked for shape: the match reads the bar)
    expect(cleanPick({ team: 0, cls: 'warrior', bar: ['w-hew'], oath: 'iron', talents: [], ult: 'w-super2' })?.ult).toBe('w-super2');
    const m = fight({ cls: 'warrior', bar: PRESETS.warrior[0]!.bar, ult: 'w-super2' }, [{ cls: 'mage', at: [300, 125] }]);
    expect(m.extras(m.fighters[0]!)[0]!.id).toBe('w-super');
    expect(m.press(0, 'w-super2')).toBe('You don’t have that');
    const h = fight({ cls: 'warrior', ult: 'w-super2' }, [{ cls: 'mage', at: [300, 125] }]);
    expect(h.fighters[0]!.bar).toEqual(PRESETS.warrior[1]!.bar);
    expect(h.extras(h.fighters[0]!)[0]!.id).toBe('w-super2');
    // another class's super is no pick at all
    const n = fight({ cls: 'warrior', bar: PRESETS.warrior[0]!.bar, ult: 'm-super' }, [{ cls: 'mage', at: [300, 125] }]);
    expect(n.extras(n.fighters[0]!)[0]!.id).toBe('w-super');
    // and the combos a bar shows are made with its own super
    for (const cls of CLASS_IDS) for (const p of PRESETS[cls]) expect(barCombos(cls, p.bar).every((c) => !c.from.super || c.from.id === p.ult), p.name).toBe(true);
    for (const cls of CLASS_IDS) for (const p of PRESETS[cls]) expect(barCombos(cls, p.bar).every((c) => !c.to.super || c.to.id === p.ult), p.name).toBe(true);
  });

  it('a super works with its playstyle’s combo: it lands harder on a target set up, sets one up, or spends what was built', () => {
    // (the owner, 2026-11-16: "combos to be done with your basic spell or even ur ult")
    const sets = (id: string): boolean => Object.values(ABILITIES).some((a) => !a.super && a.combo?.ab?.includes(id));
    let n = 0;
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        const ult = ABILITIES[p.ult]!;
        const holds = ult.effects.some((e) => e.k === 'cc' && p.bar.some((id) => ABILITIES[id]!.combo?.cc?.includes(e.cc)));
        if (ult.combo || ult.spend || sets(ult.id) || holds) n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(13);
  });
});

describe('The Ring: what each new super does', () => {
  it('Run Them Down: the Hound rushes in, opens a wound, and can’t be slowed or rooted while it hunts', () => {
    const m = fight({ cls: 'warrior', ult: 'w-super2' }, [{ cls: 'mage', at: [300, 125] }]);
    const [w, mage] = m.fighters as [Fighter, Fighter];
    w.auras.push({ ab: 'm-spear', kind: 'slow', src: 1, t: 4, dur: 4, harmful: true, magic: true, n: 0.4 });
    expect(m.press(0, 'w-super2')).toBeNull();
    expect(w.auras.some((a) => a.kind === 'slow')).toBe(false);
    expect(w.auras.some((a) => a.kind === 'free') && w.auras.some((a) => a.kind === 'fury')).toBe(true);
    expect(mage.auras.some((a) => a.ab === 'w-super2' && a.kind === 'dot')).toBe(true);
    wait(m, 0.5);
    expect(Math.hypot(w.x - mage.x, w.y - mage.y)).toBeLessThan(25);
  });

  it('Winter’s Grasp: everyone near frozen, a barrier of ice for the mage, and Frostfang shatters each of them', () => {
    const m = fight({ cls: 'mage', ult: 'm-super2' }, [{ cls: 'warrior', at: [240, 125] }, { cls: 'paladin', at: [230, 150] }]);
    const [mage, a, b] = m.fighters as [Fighter, Fighter, Fighter];
    expect(m.press(0, 'm-super2')).toBeNull();
    for (const t of [a, b]) expect(t.auras.some((x) => x.cc === 'root')).toBe(true);
    expect(mage.auras.some((x) => x.kind === 'absorb')).toBe(true);
    expect(m.comboReady(mage, ABILITIES['m-fang']!, a)?.name).toBe('Shatter');
    // (it never wears off with use)
    expect(a.dr.root).toBeUndefined();
  });

  it('Thicket of Snares and Voidburst land on a patch of ground; the void silences, cuts healing and wraps the priest', () => {
    const r = fight({ cls: 'ranger', ult: 'r-super2' }, [{ cls: 'warrior', at: [300, 125] }]);
    expect(r.press(0, 'r-super2', { x: 300, y: 125 })).toBeNull();
    // (it falls in 1.1 s, so that a fighter on the move can walk out of it)
    wait(r, 1.2);
    const held = r.fighters[1]!;
    expect(held.auras.some((x) => x.cc === 'root') && held.auras.some((x) => x.kind === 'dot')).toBe(true);
    const p = fight({ cls: 'priest', ult: 'p-super2' }, [{ cls: 'mage', at: [300, 125] }]);
    const [priest, mage] = p.fighters as [Fighter, Fighter];
    priest.hp = 500;
    expect(p.press(0, 'p-super2', { x: 300, y: 125 })).toBeNull();
    expect(priest.hp).toBeGreaterThan(500);
    expect(priest.auras.some((x) => x.kind === 'absorb')).toBe(true);
    wait(p, 1);
    expect(mage.auras.some((x) => x.cc === 'silence') && mage.auras.some((x) => x.kind === 'antiheal')).toBe(true);
  });

  it('Dawn’s Covenant and Heart of the Grove land on the whole side in reach, not on one', () => {
    for (const [cls, id] of [['paladin', 'd-super2'], ['druid', 'l-super2']] as const) {
      const m = fight({ cls, ult: id }, [{ cls: 'warrior', at: [320, 125] }], [{ cls: 'mage', at: [230, 140] }, { cls: 'ranger', at: [170, 125] }]);
      for (const f of m.fighters.slice(0, 3)) f.hp = Math.round(f.maxHp / 2);
      const before = m.fighters.slice(0, 3).map((f) => f.hp);
      expect(m.press(0, id), id).toBeNull();
      m.fighters.slice(0, 3).forEach((f, i) => expect(f.hp, `${id} on ${f.cls}`).toBeGreaterThan(before[i]!));
      expect(m.fighters[3]!.hp).toBe(m.fighters[3]!.maxHp);
    }
    // the covenant breaks every hold on them as well
    const c = fight({ cls: 'paladin', ult: 'd-super2' }, [{ cls: 'warrior', at: [320, 125] }], [{ cls: 'mage', at: [230, 140] }]);
    c.fighters[1]!.auras.push({ ab: 'w-hurl', kind: 'cc', cc: 'stun', src: 2, t: 2, dur: 2, harmful: true, magic: false, n: 0 });
    c.press(0, 'd-super2');
    expect(c.held(c.fighters[1]!)).toBeUndefined();
  });

  it('Grave Legion: three of the dead at once, whether or not any stood', () => {
    const m = fight({ cls: 'warlock', ult: 'k-super2' }, [{ cls: 'warrior', at: [260, 125] }]);
    expect(m.press(0, 'k-super2')).toBeNull();
    expect(m.fighters.filter((f) => f.pet && !f.dead)).toHaveLength(3);
  });

  it('Night’s Ruin: up into the dark where nothing reaches them, then down on them from above, and back in the shroud', () => {
    // (the owner, 2026-11-16: "become untargetable for 1s then land from aboce on the enemy and dmg them highly based on
    // the combo points")
    const ruin = (nicks: number): { m: Match; g: Fighter; w: Fighter; dealt: number } => {
      const m = fight({ cls: 'gloamknight', ult: 'g-super2' }, [{ cls: 'warrior', at: [300, 125] }]);
      const [g, w] = m.fighters as [Fighter, Fighter];
      Object.assign(w, { dirX: 1, dirY: 0, target: g.id });
      g.auras = [];
      g.fought = m.clock;
      g.pts = nicks;
      const hp = w.hp;
      expect(m.press(0, 'g-super2')).toBeNull();
      // up: nothing has landed, nobody can aim at them or hurt them, and they can do nothing
      expect(w.hp).toBe(hp);
      expect(m.aloft(g)).toBe(true);
      expect(m.unseen(g, w)).toBe(true);
      expect(w.target).toBeNull();
      expect(m.blocked(w, ABILITIES['w-hew']!, g)).toBe('Out of sight');
      expect(m.blocked(g, ABILITIES['g-knife']!, w)).toBe('You can’t do that now');
      expect(g.pts).toBe(0);
      wait(m, 0.5);
      expect(w.hp).toBe(hp);
      // (they walk off meanwhile: it comes down on them wherever they have gone)
      w.x += 30;
      wait(m, 0.6);
      return { m, g, w, dealt: hp - w.hp };
    };
    const { m, g, w, dealt } = ruin(0);
    expect(dealt).toBeGreaterThan(90);
    expect(m.aloft(g)).toBe(false);
    expect(m.held(w)?.cc).toBe('stun');
    expect(Math.hypot(g.x - w.x, g.y - w.y)).toBeLessThan(20);
    expect(m.behind(g, w)).toBe(true);
    expect(m.hidden(g)).toBe(true);
    expect(m.unseen(g, w)).toBe(true);
    // a quarter more for every Nick held
    expect(ABILITIES['g-super2']!.spend!.per).toBe(0.25);
    expect(ruin(4).dealt / dealt).toBeCloseTo(2, 1);
  });
});
