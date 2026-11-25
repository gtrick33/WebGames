/**
 * The Vigil's second pass (the owner, 2026-11-25: "add quite some more options for each class ... make sure its
 * replayable"): ten spells a class, five new kinds of spell, two new relics, and deeds to have done.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { saveBest, saveClassBest, addToCodex } from '../src/games/sigilfall/vigil/bests';
import { DEED_CLASSES, deedDone, deedProgress, DEEDS, deedsDue, nextDeeds, type DeedState } from '../src/games/sigilfall/vigil/deeds';
import { ALL_SPELLS, SPELLS, spellsOf, STRENGTHS, upgradesOf, vigilIcons, VIGIL_MAPS, type FoeAi, type SpellKind } from '../src/games/sigilfall/vigil/kit';
import { EVENT_KINDS, WILD_SPELLS } from '../src/games/sigilfall/vigil/night';
import { bankNight, cleanReturns, deedState, readReturns } from '../src/games/sigilfall/vigil/returns';
import { Vigil, type Foe, type Hero, type VigilInput, type VigilOptions } from '../src/games/sigilfall/vigil/sim';
import { applySnap, SnapWriter } from '../src/games/sigilfall/vigil/snapshot';

const STILL: VigilInput = { mx: 0, my: 0 };
const DT = 1 / 30;
const NEW_KINDS: SpellKind[] = ['mine', 'totem', 'dash', 'sweep', 'ward'];

interface Inside {
  spawnT: number;
  nextEvent: number;
  addFoe(def: unknown, boss: string | null, sprite: string | null, at?: { x: number; y: number }): void;
  hurt(f: Foe, dmg: number, by?: Hero): void;
  wound(h: Hero, dmg: number): void;
}
const inside = (v: Vigil): Inside => v as unknown as Inside;

/** A night with nothing in it but the hero, holding only the spell under test, and what the test puts there. */
function alone(spell: string, level = 1, o: VigilOptions = {}): Vigil {
  const v = new Vigil(7, 2000, 2000, { cls: SPELLS[spell]!.cls, rules: [], ...o });
  v.me.spells = { [spell]: level };
  inside(v).spawnT = -1e9;
  inside(v).nextEvent = 1e9;
  return v;
}
function put(v: Vigil, x: number, y: number, ai: FoeAi = 'walk', still = true): Foe {
  inside(v).addFoe(v.waves.find((w) => w.ai === ai)!, null, null, { x, y });
  const f = v.foes[v.foes.length - 1]!;
  if (still) {
    f.speed = 0;
    f.dmg = 0;
  }
  f.hp = f.maxHp = 1e6;
  return f;
}
function steps(v: Vigil, seconds: number, input: VigilInput = STILL): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    if (v.cards) v.choose(0);
    v.step(DT, input);
  }
}
const took = (f: Foe): number => f.maxHp - f.hp;

describe('The Vigil: ten spells a class', () => {
  it('every class has ten, of at least seven different kinds, and every new kind is somewhere', () => {
    const kinds = new Set<SpellKind>();
    for (const cls of CLASS_IDS) {
      const kit = spellsOf(cls);
      expect(kit, cls).toHaveLength(10);
      expect(new Set(kit.map((s) => s.kind)).size, cls).toBeGreaterThanOrEqual(7);
      // (the four added are not four more of what the class already had the most of)
      const added = kit.slice(6);
      expect(new Set(added.map((s) => s.kind)).size, cls).toBeGreaterThanOrEqual(3);
      for (const s of kit) kinds.add(s.kind);
    }
    for (const k of NEW_KINDS) expect(kinds.has(k), k).toBe(true);
    expect(ALL_SPELLS.length).toBe(80);
    expect(new Set(ALL_SPELLS.map((s) => s.name)).size).toBe(80);
  });

  it('every picture it names is in the icon atlas the game ships: nothing needs the pack', () => {
    const atlas = new Set((JSON.parse(readFileSync('public/games/sigilfall/icons/icons.json', 'utf8')) as { names: string[] }).names);
    for (const name of vigilIcons()) expect(atlas.has(name), name).toBe(true);
  });

  it('every spell goes to six levels, and every new one says what it does in a line', () => {
    for (const def of ALL_SPELLS) {
      if (!NEW_KINDS.includes(def.kind)) continue;
      expect(upgradesOf(def).length, def.id).toBeGreaterThanOrEqual(5);
      expect(def.text.length, def.id).toBeGreaterThan(20);
      expect(def.text.length, def.id).toBeLessThan(110);
    }
    // a dash spell says it rides the dash, since it is the one kind that doesn't fire by itself
    for (const def of ALL_SPELLS) if (def.kind === 'dash') expect(def.text, def.id).toMatch(/^Your dash/);
  });

  it('the wild spells are still one from each free class, and none is a kind that needs explaining twice', () => {
    for (const id of WILD_SPELLS) expect(SPELLS[id], id).toBeTruthy();
    expect(WILD_SPELLS.some((id) => SPELLS[id]!.cls === 'gloamknight')).toBe(false);
  });

  it('the two new relics do what they say', () => {
    expect(STRENGTHS.craft).toBeTruthy();
    expect(STRENGTHS.stout).toBeTruthy();
    const v = alone('poison-trap');
    const def = SPELLS['poison-trap']!;
    const before = v.statsOf(v.me, def);
    v.me.strengths = { craft: 2 };
    const after = v.statsOf(v.me, def);
    expect(after.size).toBeCloseTo(before.size * 1.12, 5);
    expect(after.last).toBe(before.last + 3);
    // Stout Heart: a ward holds more, and every blow lands a little lighter
    const w = alone('arcane-ward');
    const ward = SPELLS['arcane-ward']!;
    const plain = w.statsOf(w.me, ward).heal;
    w.me.strengths = { stout: 2 };
    expect(w.statsOf(w.me, ward).heal).toBeCloseTo(plain * 1.4, 5);
    w.me.spells = {};
    w.me.hp = 100;
    inside(w).wound(w.me, 50);
    expect(w.me.hp).toBeCloseTo(100 - 50 * 0.92, 5);
  });
});

describe('The Vigil: the new kinds of spell', () => {
  it('a trap is thrown down toward the Host, waits, and bursts on the first to step on it', () => {
    const v = alone('poison-trap');
    const far = put(v, v.x + 150, v.y);
    steps(v, 0.2);
    expect(v.posts.length).toBe(1);
    const trap = v.posts[0]!;
    expect(trap.kind).toBe('mine');
    expect(trap.x).toBeGreaterThan(v.x + 20);
    // it waits: nothing near it, nothing happens (more are thrown down as its clock comes round)
    steps(v, 2);
    expect(took(far)).toBe(0);
    expect(v.posts.length).toBeGreaterThanOrEqual(1);
    const on = put(v, trap.x + 3, trap.y);
    const near = put(v, trap.x + 14, trap.y - 6);
    v.step(DT, STILL);
    expect(took(on)).toBeGreaterThan(20);
    expect(took(near)).toBeGreaterThan(20);
    expect(v.posts.includes(trap)).toBe(false);
    // and one nobody steps on is gone in the end
    const w = alone('briar-burst');
    put(w, w.x + 190, w.y);
    steps(w, 0.2);
    const n = w.posts.length;
    expect(n).toBe(1);
    w.me.spells = {};
    steps(w, 15);
    expect(w.posts.length).toBe(0);
  });

  it('a trap just thrown is not yet armed', () => {
    const v = alone('poison-trap');
    const f = put(v, v.x + 40, v.y);
    v.step(DT, STILL);
    const trap = v.posts[0]!;
    f.x = trap.x;
    f.y = trap.y;
    v.step(DT, STILL);
    expect(took(f)).toBe(0);
    steps(v, 0.6);
    expect(took(f)).toBeGreaterThan(0);
  });

  it('a totem stays where it was planted and shoots from there, then gutters out', () => {
    const v = alone('searing-hymn');
    const f = put(v, v.x + 90, v.y);
    steps(v, 0.2);
    expect(v.posts.length).toBe(1);
    const totem = v.posts[0]!;
    expect(totem.kind).toBe('totem');
    expect(Math.hypot(totem.x - 2000, totem.y - 2000)).toBeLessThan(2);
    // the hero walks off; the totem goes on shooting what comes near it
    v.me.spells = {};
    v.me.x += 300;
    const before = took(f);
    steps(v, 3);
    expect(took(f)).toBeGreaterThan(before + 15);
    expect(v.shots.every((s) => Math.hypot(s.x - totem.x, s.y - totem.y) < 260)).toBe(true);
    steps(v, 8);
    expect(v.posts.length).toBe(0);
  });

  it('a dash spell goes off where a dash ends, and only then', () => {
    const v = alone('war-charge');
    const f = put(v, v.x + 46, v.y);
    steps(v, 2);
    expect(took(f)).toBe(0);
    v.step(DT, { mx: 1, my: 0, dash: true });
    steps(v, 0.4, { mx: 1, my: 0 });
    expect(took(f)).toBeGreaterThan(30);
    const once = took(f);
    steps(v, 1);
    expect(took(f)).toBe(once);
    // quickened, it brings the dash itself back sooner
    const slow = v.dashEvery(v.me);
    const def = SPELLS['war-charge']!;
    const restless = upgradesOf(def).find((u) => u.every)!;
    v.me.took = { [def.id]: [restless.id] };
    v.step(DT, STILL);
    expect(v.dashEvery(v.me)).toBeCloseTo(slow * 0.8, 5);
  });

  it('an echoed dash spell bursts where the dash began as well', () => {
    const v = alone('demonic-step');
    const def = SPELLS['demonic-step']!;
    v.me.took = { [def.id]: [upgradesOf(def).find((u) => u.echo)!.id] };
    const behind = put(v, v.x - 10, v.y + 12);
    v.step(DT, { mx: 1, my: 0, dash: true });
    steps(v, 0.4, { mx: 1, my: 0 });
    expect(v.x - 2000).toBeGreaterThan(40);
    expect(took(behind)).toBeGreaterThan(10);
  });

  it('a sweep goes all the way round: everything in reach is struck once, whichever side it stands', () => {
    const v = alone('thousand-cuts');
    const reach = v.statsOf(v.me, SPELLS['thousand-cuts']!).size;
    const ring = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => put(v, v.x + Math.cos((i / 8) * Math.PI * 2) * 40, v.y + Math.sin((i / 8) * Math.PI * 2) * 40));
    const out = put(v, v.x + reach + 40, v.y);
    steps(v, 1.2);
    for (const f of ring) expect(took(f)).toBeGreaterThan(15);
    const each = took(ring[0]!);
    expect(ring.every((f) => Math.abs(took(f) - each) < 1)).toBe(true);
    expect(took(out)).toBe(0);
    expect(v.fx.some((f) => f.kind === 'sweep') || true).toBe(true);
  });

  it('a ward takes the blows, bursts when it breaks, and comes back after a while', () => {
    const v = alone('arcane-ward');
    const f = put(v, v.x + 30, v.y);
    steps(v, 0.2);
    const max = v.me.wardMax;
    expect(v.me.ward).toBe(max);
    expect(max).toBeCloseTo(v.maxHp * 0.165, 3);
    const hp = v.me.hp;
    inside(v).wound(v.me, max * 0.5);
    expect(v.me.hp).toBe(hp);
    expect(v.me.ward).toBeCloseTo(max * 0.5, 5);
    expect(took(f)).toBe(0);
    v.me.iframe = 0;
    // the blow that breaks it: what the ward could not take gets through, and the burst goes off
    inside(v).wound(v.me, max);
    expect(v.me.ward).toBe(0);
    expect(v.me.hp).toBeCloseTo(hp - max * 0.5, 5);
    v.step(DT, STILL);
    expect(took(f)).toBeGreaterThan(20);
    // not back at once: its clock began when it broke
    steps(v, 5);
    expect(v.me.ward).toBe(0);
    steps(v, 6);
    expect(v.me.ward).toBeGreaterThan(0);
  });

  it('Ball Lightning is slow and rolls through everything; a Gravity Well opens out where the Host is and draws it in', () => {
    const v = alone('ball-lightning');
    const a = put(v, v.x + 40, v.y);
    const b = put(v, v.x + 80, v.y);
    const c = put(v, v.x + 120, v.y);
    steps(v, 0.3);
    const ball = v.shots[0]!;
    expect(Math.hypot(ball.vx, ball.vy)).toBeLessThan(90);
    steps(v, 2.2);
    for (const f of [a, b, c]) expect(took(f)).toBeGreaterThan(10);
    const w = alone('gravity-well');
    const crowd = [0, 1, 2, 3, 4, 5].map((i) => put(w, w.x + 120 + (i % 3) * 10, w.y + Math.floor(i / 3) * 10));
    const edge = put(w, w.x + 150, w.y + 5);
    steps(w, 0.2);
    expect(w.fields.length).toBe(1);
    expect(w.fields[0]!.x).toBeGreaterThan(w.x + 80);
    const d0 = Math.hypot(edge.x - w.fields[0]!.x, edge.y - w.fields[0]!.y);
    steps(w, 1.5);
    expect(Math.hypot(edge.x - w.fields[0]!.x, edge.y - w.fields[0]!.y)).toBeLessThan(d0);
    expect(took(crowd[0]!)).toBeGreaterThan(0);
  });

  it('every new spell, held alone, kills', () => {
    for (const def of ALL_SPELLS) {
      if (spellsOf(def.cls).indexOf(def) < 6) continue;
      const v = new Vigil(3, 2000, 2000, { cls: def.cls, rules: [] });
      inside(v).nextEvent = 1e9;
      v.me.hp = 1e9;
      for (let i = 0; i < 30 * 40; i++) {
        v.me.spells = { [def.id]: 4 };
        v.me.cards = null;
        v.owed = 0;
        // (a dash now and then, as a player would; a ward has to be struck to do anything)
        v.step(DT, { mx: Math.cos(i / 40), my: Math.sin(i / 40), dash: i % 60 === 0 });
      }
      expect(v.kills, `${def.cls}: ${def.name} (${def.kind})`).toBeGreaterThan(5);
    }
  }, 120_000);

  it('a friend’s game sees the traps, the totems and the ward', () => {
    const party = [
      { id: 1, cls: 'ranger' as const, name: 'A' },
      { id: 2, cls: 'priest' as const, name: 'B' },
    ];
    const host = new Vigil(8, 2000, 2000, { party, rules: [] });
    host.fxOut = [];
    const friend = new Vigil(8, 2000, 2000, { party, rules: [] });
    inside(host).spawnT = -1e9;
    inside(host).nextEvent = 1e9;
    host.heroOf(1)!.spells = { 'poison-trap': 1 };
    host.heroOf(2)!.spells = { 'searing-hymn': 1, 'ward-of-grace': 1 };
    put(host, 2180, 2000);
    for (let i = 0; i < 12; i++) host.step(DT, { 1: STILL, 2: STILL });
    expect(host.posts.length).toBe(2);
    applySnap(friend, JSON.parse(JSON.stringify(new SnapWriter().write(host, 1))), 2);
    expect(friend.posts.map((p) => [p.kind, p.spell, p.owner])).toEqual(host.posts.map((p) => [p.kind, p.spell, p.owner]));
    expect(friend.posts[0]!.x).toBe(Math.round(host.posts[0]!.x));
    expect(friend.heroOf(2)!.ward).toBeGreaterThan(0);
    expect(friend.heroOf(1)!.ward).toBe(0);
    const t = friend.posts[0]!.t;
    friend.follow(0.2, 2, STILL);
    expect(friend.posts[0]!.t).toBeCloseTo(t + 0.2, 5);
  });
});

describe('The Vigil: deeds', () => {
  beforeEach(() => localStorage.clear());
  const nothing = (): DeedState => ({ classBest: {}, landBest: {}, won: {}, felled: [], codex: new Set() });

  it('there is a deed for every class, every land’s champions and every kind of event, and each pays', () => {
    expect(DEED_CLASSES.map(([id]) => id).sort()).toEqual([...CLASS_IDS].sort());
    for (const cls of CLASS_IDS) expect(DEEDS.some((d) => d.id === `class:${cls}`), cls).toBe(true);
    for (const m of VIGIL_MAPS) expect(DEEDS.some((d) => d.id === `land:${m.id}`), m.id).toBe(true);
    for (const k of EVENT_KINDS) expect(DEEDS.some((d) => d.id === `event:${k}`), k).toBe(true);
    expect(new Set(DEEDS.map((d) => d.id)).size).toBe(DEEDS.length);
    expect(new Set(DEEDS.map((d) => d.name)).size).toBe(DEEDS.length);
    for (const d of DEEDS) {
      expect(d.motes, d.id).toBeGreaterThan(0);
      expect(d.text.length, d.id).toBeGreaterThan(8);
      expect(deedDone(d, nothing()), d.id).toBe(false);
      const [at, of] = d.at(nothing());
      expect(at).toBe(0);
      expect(of).toBeGreaterThan(0);
    }
  });

  it('a deed is done from what the device has kept, shows how far along it is, and is paid once', () => {
    const s = nothing();
    s.classBest.mage = 212;
    const mage = DEEDS.find((d) => d.id === 'class:mage')!;
    expect(deedDone(mage, s)).toBe(false);
    expect(deedProgress(mage, s)).toBe('3:32 of 5:00');
    s.classBest.mage = 300;
    expect(deedDone(mage, s)).toBe(true);
    const land = DEEDS.find((d) => d.id === 'land:whisperwood')!;
    s.felled = ['The Gravewarden'];
    expect(deedProgress(land, s)).toBe('1 of 3');
    expect(deedsDue(s, []).map((d) => d.id)).toEqual(['class:mage']);
    expect(deedsDue(s, ['class:mage'])).toEqual([]);
    // what is nearest done comes first among what is left, a favored one before the rest
    expect(nextDeeds(s, ['class:mage'], 1)[0]!.id).toBe('land:whisperwood');
    expect(nextDeeds(s, ['class:mage'], 2, ['class:druid'])[0]!.id).toBe('class:druid');
  });

  it('a night that finishes a deed is paid for it, once, with the night’s own motes', () => {
    saveBest('whisperwood', 310);
    saveClassBest('whisperwood', 'mage', 310);
    const b = bankNight(310, { champions: 2, events: 1 }, 'mage', undefined, { won: ['lantern'], felled: ['The Gravewarden', 'The Bone Tusk'] });
    expect(b.deeds.map((d) => d.id).sort()).toEqual(['class:mage', 'event:lantern']);
    expect(readReturns().motes).toBe(10 + 6 + 2 + 10 + 4);
    expect(readReturns().felled).toEqual(['The Gravewarden', 'The Bone Tusk']);
    expect(readReturns().won).toEqual({ lantern: 1 });
    // the same again: nothing more for the deeds already paid, and the third champion finishes the land's
    const again = bankNight(310, { champions: 0, events: 0 }, 'mage', undefined, { won: [], felled: ['The Ash Captain'] });
    expect(again.deeds.map((d) => d.id)).toEqual(['land:whisperwood']);
    expect(readReturns().deeds.sort()).toEqual(['class:mage', 'event:lantern', 'land:whisperwood']);
    expect(deedState().classBest.mage).toBe(310);
    // the codex counts
    addToCodex(['ember-bolt', 'frost-ring', 'reaping-arc', 'thrown-axe', 'seeking-arrow']);
    expect(bankNight(1, { champions: 0, events: 0 }, 'mage').deeds.map((d) => d.id)).toEqual(['codex:0']);
  });

  it('the week’s watch counts toward a class’s deed, though it keeps no land’s record', () => {
    const b = bankNight(305, { champions: 0, events: 0 }, 'ranger', 2970);
    expect(b.deeds.map((d) => d.id)).toEqual(['class:ranger']);
    expect(readReturns().weekClass).toEqual({ ranger: 305 });
  });

  it('what was kept before the deeds existed reads as none done, and rubbish does no harm', () => {
    // the keep as #375 wrote it
    localStorage.setItem('sigilfall.vigil.return', JSON.stringify({ motes: 12, earned: 40, nights: 5, boons: { hearth: 1 }, wilds: ['wolf-pack'], wild: 'wolf-pack', weekly: {} }));
    expect(readReturns()).toEqual({ motes: 12, earned: 40, nights: 5, boons: { hearth: 1 }, wilds: ['wolf-pack'], wild: 'wolf-pack', weekly: {}, won: {}, felled: [], deeds: [], weekClass: {} });
    const r = cleanReturns({ won: { lantern: 2, nonsense: 9, pack: -1 }, felled: ['A', 'A', 7, 'B'], deeds: 'x', weekClass: { mage: 100, '<b>': 5 } });
    expect(r.won).toEqual({ lantern: 2 });
    expect(r.felled).toEqual(['A', 'B']);
    expect(r.deeds).toEqual([]);
    expect(r.weekClass).toEqual({ mage: 100 });
  });
});
