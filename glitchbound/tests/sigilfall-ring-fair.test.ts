/**
 * The Ring, four things the owner found playing it on 2026-11-17: "1v1 if 2 rogue gloamknights fight theyre always
 * invisible, fix it", "in 1v1 healers shouldnt be allowed", "in 2v2 if both dps die, the healers take ages to kill each
 * other", and "in 2v2 i feel like healers are way too strong, if i go as double dps i still need to have slight chance".
 *
 * - Everyone left in the shroud, so that nobody can find anybody: it lifts from all of them after a moment (sim.ts DARK).
 * - No healer's playstyle enters a 1v1: not the player's, not the computer's, not through a room (ladder.ts barredFrom).
 * - Only healers left, on both sides: sudden death, healing gone and every blow harder by the second (sim.ts SUDDEN).
 * - Healing in 2v2 is as written, not 1.3 of it (sim.ts HEAL_BY_SIZE): what it did to two damage dealers' chances
 *   against a healer's side is in tests/sigilfall-ring-balance.test.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABILITIES, healerBar, PRESETS, ultOf, type Ability } from '../src/games/sigilfall/arena/abilities';
import { botThink, isHealer, newBrain } from '../src/games/sigilfall/arena/bot';
import { BARRED_WHY, barredFrom, COMPS, drawOpponents, styleFor } from '../src/games/sigilfall/arena/ladder';
import { MAP_IDS } from '../src/games/sigilfall/arena/maps';
import { DARK, GATES, HEAL_BY_SIZE, Match, SUDDEN, VEIL, type Fighter, type FighterSetup, type MoveInput } from '../src/games/sigilfall/arena/sim';
import { STYLES } from '../src/games/sigilfall/arena/styles';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { act, join, newRoom, viewFor } from '../src/games/sigilfall/net/ringRoom';
import { setupFromRoom } from '../src/games/sigilfall/ui/RingScreen';

const STEP = 1 / 30;
const read = (p: string): string => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

interface Inside {
  rand: () => number;
  clock: number;
  damage(src: Fighter, t: Fighter, amount: number, direct: boolean, ab?: Ability): number;
  heal(src: Fighter, t: Fighter, amount: number, direct?: boolean): void;
}
const inside = (m: Match): Inside => m as unknown as Inside;
const of = (team: 0 | 1, cls: ClassId, p: number, i = 0): FighterSetup => ({ team, cls, name: `${PRESETS[cls][p]!.name}${team}${i}`, bar: PRESETS[cls][p]!.bar, talents: PRESETS[cls][p]!.talents, ult: PRESETS[cls][p]!.ult });
const open = (fighters: FighterSetup[], seed = 5): Match => {
  const m = new Match({ seed, map: 'sands', fighters });
  m.step(GATES + 0.01, {});
  m.events.length = 0;
  return m;
};
/** One falls to another: a small blow on their last point of health (a great one would be shared out by a paladin beside them). */
const kill = (m: Match, by: Fighter, who: Fighter): void => {
  for (let i = 0; i < 4 && !who.dead; i++) {
    who.auras = [];
    who.hp = 1;
    inside(m).damage(by, who, 60, true, ABILITIES['w-hew']);
  }
  expect(who.dead).toBe(true);
};
const wait = (m: Match, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) m.step(STEP, {});
};
/** Plays it out between computers: who won, when, and whether it ever came to sudden death. */
function playOut(m: Match, seed: number, limit = 200): void {
  const brains = m.fighters.map((_, i) => newBrain(seed * 31 + i));
  for (let i = 0; i < 30 * limit && m.phase !== 'over'; i++) {
    const moves: Record<number, MoveInput> = {};
    for (const f of m.fighters) if (!f.pet) moves[f.id] = botThink(m, f, brains[f.id]!, 0.8, STEP);
    m.step(STEP, moves);
    m.events.length = 0;
  }
}

describe('The Ring: two in the shroud find each other', () => {
  it('two Nightblades come through the gates unseen, and the shroud lifts from both a moment later', () => {
    const m = open([of(0, 'gloamknight', 1), of(1, 'gloamknight', 1)]);
    const [a, b] = m.fighters as [Fighter, Fighter];
    expect(m.hidden(a) && m.hidden(b)).toBe(true);
    wait(m, DARK.after - 0.2);
    expect(m.hidden(a) && m.hidden(b)).toBe(true);
    wait(m, 0.3);
    expect(m.hidden(a) || m.hidden(b)).toBe(false);
    expect(m.events.filter((e) => e.k === 'word' && e.word === 'Revealed').map((e) => (e as { id: number }).id).sort()).toEqual([a.id, b.id]);
    // each can now be seen and aimed at by the other
    expect(m.unseen(a, b) || m.unseen(b, a)).toBe(false);
    // and neither slips back into it by themself for a good while, though nobody has struck anybody
    wait(m, DARK.rest - 0.5);
    expect(m.hidden(a) || m.hidden(b)).toBe(false);
    expect(DARK.rest).toBeGreaterThan(VEIL.calm);
    // (left alone that long, they do, and it lifts again: it is never a place to wait a match out)
    wait(m, 1);
    expect(m.hidden(a) && m.hidden(b)).toBe(true);
    wait(m, DARK.after + 0.1);
    expect(m.hidden(a) || m.hidden(b)).toBe(false);
  });

  it('it stays down while there is anyone to hide from: one Nightblade against a warrior keeps the shroud', () => {
    const m = open([of(0, 'gloamknight', 1), of(1, 'warrior', 0)]);
    const [a] = m.fighters as [Fighter, Fighter];
    a.x = 60;
    a.y = 60;
    m.fighters[1]!.x = 400;
    m.fighters[1]!.y = 220;
    wait(m, DARK.after + 3);
    expect(m.hidden(a)).toBe(true);
    // and in a team fight with someone in plain sight on a side, two Nightblades keep theirs
    const n = open([of(0, 'gloamknight', 1), of(0, 'priest', 0, 1), of(1, 'gloamknight', 1), of(1, 'mage', 0, 1)]);
    n.fighters.forEach((f, i) => {
      f.x = 60 + i * 110;
      f.y = i % 2 ? 60 : 220;
    });
    wait(n, DARK.after + 2);
    expect(n.hidden(n.fighters[0]!) && n.hidden(n.fighters[2]!)).toBe(true);
  });

  it('a fight between two Nightblades is fought: someone wins it, long before time is up', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const m = new Match({ seed, map: MAP_IDS[seed % MAP_IDS.length]!, fighters: [of(0, 'gloamknight', 1), of(1, 'gloamknight', 1)] });
      playOut(m, seed);
      expect(m.phase, `seed ${seed}`).toBe('over');
      expect(m.draw, `seed ${seed}`).toBe(false);
      expect(m.clock, `seed ${seed}`).toBeLessThan(120);
      // (they did find each other)
      expect(m.fighters[0]!.score.dmg + m.fighters[1]!.score.dmg, `seed ${seed}`).toBeGreaterThan(1000);
    }
  });
});

describe('The Ring: no healers in 1v1', () => {
  const HEALERS = CLASS_IDS.flatMap((cls) => PRESETS[cls].filter((p) => healerBar(p.bar)).map((p) => ({ cls, p })));

  it('there are three healers, known by their bars, and each class that has one has another playstyle to duel as', () => {
    expect(HEALERS.map((x) => x.p.name).sort()).toEqual(['Grovekeeper', 'Lifegiver', 'Oathkeeper']);
    for (const { cls, p } of HEALERS) {
      expect(p.healer, p.name).toBe(true);
      expect(isHealer({ bar: p.bar }), p.name).toBe(true);
      expect(barredFrom(1, p.bar), p.name).toBe(true);
      expect(barredFrom(2, p.bar) || barredFrom(3, p.bar), p.name).toBe(false);
      const other = styleFor(1, cls, p);
      expect(other.id, p.name).not.toBe(p.id);
      expect(healerBar(other.bar), p.name).toBe(false);
      // in a team it is left as it is
      expect(styleFor(2, cls, p)).toBe(p);
      expect(styleFor(3, cls, p)).toBe(p);
      // (and its card says where it belongs)
      expect(STYLES[cls][p.id]!.line, p.name).toMatch(/^Healer for 2v2 and 3v3\. /);
    }
    for (const cls of CLASS_IDS) for (const p of PRESETS[cls]) if (!healerBar(p.bar)) expect(barredFrom(1, p.bar), p.name).toBe(false);
  });

  it('the computer never brings one to a 1v1', () => {
    for (const comp of COMPS[1]) for (const t of comp.team) expect(healerBar(PRESETS[t.cls][t.preset]!.bar), comp.name).toBe(false);
    for (let seed = 0; seed < 40; seed++) for (const f of drawOpponents(1, seed).fighters) expect(healerBar(f.bar)).toBe(false);
  });

  it('the lobby finds no 1v1 for a healer, and says why', () => {
    const screen = read('src/games/sigilfall/ui/RingScreen.tsx');
    expect(screen).toContain('const barred = barredFrom(format, bar);');
    // neither a search for people nor a match with the computer starts
    expect(screen.match(/if \(barred\) return;/g)).toHaveLength(2);
    expect(screen).toMatch(/const findMatch = \(\): void => \{[\s\S]{0,260}if \(barred\) return;/);
    expect(screen).toMatch(/const enter = async \(\): Promise<void> => \{[\s\S]{0,260}if \(barred\) return;/);
    // (the reason is on the page for as long as it holds, and gone with another format or playstyle: under the gold
    // button, or in the layer where the fight is chosen while that is open)
    expect(screen).toContain('{(barred || seekNote) && !playOpen && (');
    expect(screen).toContain('note={barred ? BARRED_WHY : seekNote}');
    expect(screen).toContain("barred ? 'No healers in 1v1' : follower ? 'Waiting for the party leader' : `Find a ${ladder === 'guest' ? '' : 'ranked '}${fightFormat}v${fightFormat} match`");
    expect(read('src/games/sigilfall/ui/RingPlay.tsx')).toContain("props.barred ? 'No healers in 1v1'");
    expect(screen).toContain('{barred ? BARRED_WHY : seekNote}');
    expect(BARRED_WHY).toBe('Healers can’t enter 1v1. Choose a damage playstyle, or play 2v2 or 3v3.');
  });

  it('a room of friends can’t start a 1v1 with a healer seated, and its host’s match would not field one', () => {
    const screen = read('src/games/sigilfall/ui/RingScreen.tsx');
    expect(screen).toContain('const healerIn = view.seats.some((s) => s.pick && barredFrom(view.format, s.pick.bar));');
    expect(screen).toContain('disabled={!ready || !seated || healerIn}');
    // a pick from a game that doesn't know the rule: read as the class's other playstyle, with that one's own talents
    const KEYS = ['aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb'];
    const s = newRoom('ABCD', 0, 42);
    for (const [i, k] of KEYS.entries()) expect(join(s, k, `P${i}`, 0)).toBeNull();
    const pick = (team: 0 | 1, cls: ClassId, p: number) => ({ team, cls, bar: PRESETS[cls][p]!.bar, talents: PRESETS[cls][p]!.talents });
    act(s, KEYS[0]!, { t: 'setup', format: 1, map: 'sands' }, 1);
    expect(act(s, KEYS[0]!, { t: 'pick', pick: pick(0, 'priest', 0) }, 1)).toBeNull();
    expect(act(s, KEYS[1]!, { t: 'pick', pick: pick(1, 'warrior', 0) }, 1)).toBeNull();
    act(s, KEYS[0]!, { t: 'start' }, 1);
    const { setup } = setupFromRoom(viewFor(s, KEYS[0]!)!);
    expect(setup.fighters).toHaveLength(2);
    expect(setup.fighters[0]!.bar).toEqual(PRESETS.priest[1]!.bar);
    expect(setup.fighters[0]!.talents).toEqual(PRESETS.priest[1]!.talents);
    expect(setup.fighters[0]!.ult).toBe(PRESETS.priest[1]!.ult);
    expect(setupFromRoom(viewFor(s, KEYS[1]!)!).setup).toEqual(setup);
    // the same pick in a 2v2 room is the healer it was sent as
    const t = newRoom('EFGH', 0, 42);
    for (const [i, k] of KEYS.entries()) expect(join(t, k, `P${i}`, 0)).toBeNull();
    act(t, KEYS[0]!, { t: 'setup', format: 2, map: 'sands' }, 1);
    expect(act(t, KEYS[0]!, { t: 'pick', pick: pick(0, 'priest', 0) }, 1)).toBeNull();
    expect(act(t, KEYS[1]!, { t: 'pick', pick: pick(1, 'warrior', 0) }, 1)).toBeNull();
    act(t, KEYS[0]!, { t: 'start' }, 1);
    expect(setupFromRoom(viewFor(t, KEYS[0]!)!).setup.fighters[0]!.bar).toEqual(PRESETS.priest[0]!.bar);
  });
});

describe('The Ring: only healers left is sudden death', () => {
  /** A 2v2 of a healer and a damage dealer a side, the healers with a great deal of health and far apart. */
  const two = (): Match => {
    const m = open([of(0, 'priest', 0), of(0, 'warrior', 0, 1), of(1, 'druid', 0), of(1, 'mage', 0, 1)]);
    m.fighters.forEach((f, i) => {
      f.x = 80 + i * 100;
      f.y = 120;
      f.mods.crit = 0;
      f.auras = [];
    });
    inside(m).rand = () => 0.99;
    return m;
  };

  it('it begins the moment the last damage dealer falls, on both sides, and is said to both healers', () => {
    const m = two();
    const [p, w, d, mage] = m.fighters as [Fighter, Fighter, Fighter, Fighter];
    kill(m, d, w);
    m.step(STEP, {});
    // (one side still has its damage dealer: the fight goes on as it was)
    expect(m.suddenAt).toBeNull();
    expect(m.sudden).toBe(1);
    kill(m, p, mage);
    m.events.length = 0;
    m.step(STEP, {});
    expect(m.suddenAt).not.toBeNull();
    expect(m.events.filter((e) => e.k === 'word' && e.word === 'Sudden death').map((e) => (e as { id: number }).id).sort()).toEqual([p.id, d.id]);
    expect(m.phase).toBe('fight');
  });

  it('healing is gone in a few seconds, and every blow lands harder by the second', () => {
    const m = two();
    const [p, w, d, mage] = m.fighters as [Fighter, Fighter, Fighter, Fighter];
    p.hp = p.maxHp = d.hp = d.maxHp = 100000;
    kill(m, d, w);
    kill(m, p, mage);
    m.step(STEP, {});
    const first = inside(m).damage(p, d, 100, true, ABILITIES['p-smite']);
    expect(m.dampening).toBeLessThan(0.1);
    wait(m, SUDDEN.fade + 0.1);
    expect(m.dampening).toBe(1);
    const hurt = p.hp - 5000;
    p.hp = hurt;
    inside(m).heal(p, p, 500);
    expect(p.hp).toBe(hurt);
    wait(m, 4 - SUDDEN.fade - 0.1);
    const later = inside(m).damage(p, d, 100, true, ABILITIES['p-smite']);
    expect(m.sudden).toBeCloseTo(1 + SUDDEN.grow * 4, 1);
    expect(later / first).toBeGreaterThan(m.sudden - 0.2);
    expect(later / first).toBeLessThan(m.sudden + 0.2);
    // a player who joined a host's match is told when it began, and reckons the same
    const copy = open([of(0, 'priest', 0), of(0, 'warrior', 0, 1), of(1, 'druid', 0), of(1, 'mage', 0, 1)]);
    copy.restore(JSON.parse(JSON.stringify(m.snapshot())) as ReturnType<Match['snapshot']>);
    expect(copy.suddenAt).toBeCloseTo(m.suddenAt!, 1);
    expect(copy.sudden).toBeCloseTo(m.sudden, 1);
    expect(copy.dampening).toBe(1);
  });

  it('two healers left alone finish it in seconds, where they took half a minute', () => {
    let worst = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const hs: [ClassId, ClassId] = seed % 3 === 0 ? ['priest', 'paladin'] : seed % 3 === 1 ? ['druid', 'priest'] : ['paladin', 'druid'];
      const m = new Match({ seed, map: MAP_IDS[seed % MAP_IDS.length]!, fighters: [of(0, hs[0], 0), of(0, 'warrior', 0, 1), of(1, hs[1], 0), of(1, 'mage', 0, 1)] });
      m.step(GATES + 0.01, {});
      const [a, w, b, mage] = m.fighters as [Fighter, Fighter, Fighter, Fighter];
      kill(m, b, w);
      kill(m, a, mage);
      a.hp = a.maxHp;
      b.hp = b.maxHp;
      m.step(STEP, {});
      expect(m.suddenAt, `seed ${seed}`).not.toBeNull();
      playOut(m, seed, 60);
      expect(m.phase, `seed ${seed}`).toBe('over');
      expect(m.draw, `seed ${seed}`).toBe(false);
      worst = Math.max(worst, m.clock - m.suddenAt!);
    }
    // (both at full health when it began, which a real fight seldom leaves them)
    expect(worst).toBeLessThan(22);
  });

  it('the match screen says it, in place of how far healing has faded', () => {
    const match = read('src/games/sigilfall/ui/RingMatch.tsx');
    expect(match).toMatch(/\{m\.suddenAt !== null \? \([\s\S]{0,400}Sudden death: \{damp >= 100 \? 'no healing' : `healing −\$\{damp\}%`\}, damage \+\{Math\.round\(\(m\.sudden - 1\) \* 100\)\}%/);
  });

  it('a duel, or a fight with a damage dealer still standing, never comes to it', () => {
    const m = open([of(0, 'priest', 1), of(1, 'warrior', 0)]);
    wait(m, 3);
    expect(m.suddenAt).toBeNull();
    const n = two();
    wait(n, 3);
    expect(n.suddenAt).toBeNull();
  });
});

describe('The Ring: healing in 2v2 is as written', () => {
  it('a heal is worth the same in a 2v2 as in a duel, and more only in a 3v3', () => {
    expect(HEAL_BY_SIZE.slice(0, 4)).toEqual([1, 1, 1, 1.45]);
    const healed = (fighters: FighterSetup[]): number => {
      const m = open(fighters);
      const p = m.fighters[0]!;
      inside(m).rand = () => 0.99;
      p.hp = 100;
      inside(m).heal(p, p, 200, false);
      return p.hp - 100;
    };
    const duel = healed([of(0, 'priest', 0), of(1, 'warrior', 0)]);
    const pair = healed([of(0, 'priest', 0), of(0, 'mage', 0, 1), of(1, 'warrior', 0), of(1, 'ranger', 0, 1)]);
    const three = healed([of(0, 'priest', 0), of(0, 'mage', 0, 1), of(0, 'ranger', 0, 2), of(1, 'warrior', 0), of(1, 'ranger', 0, 1), of(1, 'mage', 0, 2)]);
    expect(duel).toBeGreaterThan(100);
    expect(pair).toBe(duel);
    expect(three / duel).toBeCloseTo(1.45, 1);
  });
});

describe('The Ring: a playstyle’s abilities are told apart at a glance', () => {
  // (the owner, 2026-11-17: "for the ranger, ult has the same icon as the long draw spell")
  it('no two of a playstyle’s four and its super share a picture', () => {
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        const icons = [...p.bar.map((id) => ABILITIES[id]!), ultOf(cls, p.ult)].map((a) => a.icon);
        expect(new Set(icons).size, `${p.name}: ${icons.join(', ')}`).toBe(icons.length);
      }
    }
  });
});

describe('The Ring: small things on the screen (the owner, 2026-11-17)', () => {
  it('a button glows for its combo or its boon while it is still on cooldown, on a phone as with keys', () => {
    // ("even if a spell is on cooldown let it glow if it has some specialized effect"; the touch buttons waited for the cooldown)
    const match = read('src/games/sigilfall/ui/RingMatch.tsx');
    expect(match).toContain("${comboOf(ab) && (!sup || charge >= 1) ? ' is-combo' : ''}");
    expect(match).not.toMatch(/comboOf\(ab\) && wait <= 0/);
    expect(match).toContain("const lit = !sup || charge >= 1 ? comboOf(ab) : null;");
  });

  it('the setup page has no tabs of saved setups, and its bar keeps to its own column', () => {
    // ("you can remove the setups and check on phone how the tooltip covers the ult")
    const setup = read('src/games/sigilfall/ui/RingSetup.tsx');
    expect(setup).not.toContain('rb-rs-sets');
    expect(setup).not.toMatch(/Setup \{i \+ 1\}/);
    expect(read('src/games/sigilfall/ui/RingScreen.tsx')).not.toMatch(/Setup \{sets\.active \+ 1\}/);
    const css = read('src/games/sigilfall/Game.css');
    expect(css).toMatch(/\.rb-rs-kitrow \.rb-rs-barrow \{\s*flex: 0 1 auto;\s*min-width: 0;\s*max-width: 100%;/);
  });
});
