import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/games/sigilfall/data/classes';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { Motion, type Cast } from '../src/games/sigilfall/render3d/cast';
import { chained, MOVE_CLIPS, MOVE_SKILLS, moveOf } from '../src/games/sigilfall/render3d/moves';
import { strikeOf, type Strike } from '../src/games/sigilfall/render3d/strike';
import { rigAnimOf } from '../src/games/sigilfall/render3d/toon';
import { WorldCast } from '../src/games/sigilfall/render3d/worldCast';
import { CoopSession } from '../src/games/sigilfall/net/coop';
import type { Card } from '../src/games/sigilfall/net/room';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';
import { readPack } from './sigilfall-packs';

/**
 * How bodies move in a fight. The attack clips all open with a slow lift, and they used to be played from their
 * start for a fifth of a second: no hero and no enemy was ever seen landing a blow. These hold the fix in place:
 * the blow is found in each clip, the hero's skills each have a move, and whoever attacks is drawn striking as the
 * rules strike.
 */

const medium = rigAnimOf(readPack('rigs'), 'medium');
const FIGHTERS: ClassId[] = ['warrior', 'paladin', 'gloamknight'];
const CASTERS: ClassId[] = ['mage', 'priest', 'warlock', 'druid'];

describe('Sigilfall: where the blow is in a clip', () => {
  it('finds the blow after the lift, not at the start of the clip', () => {
    // (measured on the rig: the overhead chop lifts for half a second, the big one for longer still)
    const chop = strikeOf(medium, 'chop');
    expect(chop.from).toBeGreaterThan(0.4);
    expect(chop.from).toBeLessThan(0.65);
    const big = strikeOf(medium, 'chop2');
    expect(big.from).toBeGreaterThan(0.5);
    const slice = strikeOf(medium, 'slice');
    expect(slice.from).toBeGreaterThan(0.1);
    expect(slice.from).toBeLessThan(0.35);
  });

  it('starts a shot and a cast at once: their clips open with the release', () => {
    expect(strikeOf(medium, 'bow').from).toBe(0);
    expect(strikeOf(medium, 'cast').from).toBeLessThan(0.08);
  });

  it('gives every blow a lift before it, a landing after it and a follow-through after that', () => {
    for (const clip of MOVE_CLIPS) {
      const s = strikeOf(medium, clip);
      expect(s.lift, clip).toBeLessThanOrEqual(s.from);
      expect(s.hit, clip).toBeGreaterThan(s.from);
      expect(s.to, clip).toBeGreaterThanOrEqual(s.hit);
      expect(s.to, clip).toBeLessThanOrEqual(medium.length(clip) + 1e-6);
    }
  });

  it('says so of a clip it cannot measure, rather than guessing a frame', () => {
    const s = strikeOf(null, 'chop');
    expect(s.from).toBeGreaterThan(0);
    expect(strikeOf(medium, 'no-such-clip')).toBe(s);
  });
});

describe('Sigilfall: the hero’s moves', () => {
  it('names only real skills and clips the rig has', () => {
    for (const id of MOVE_SKILLS) expect(SKILLS[id], id).toBeTruthy();
    for (const clip of MOVE_CLIPS) expect(medium.has(clip), clip).toBe(true);
  });

  it('makes a fighter’s basic swing three different cuts, the rules’ own third the last', () => {
    for (const cls of FIGHTERS) {
      const basic = Object.values(SKILLS).find((s) => s.cls === cls && s.kind === 'basic')!;
      expect(chained(basic.id), cls).toBe(true);
      const clips = [0, 1, 2].map((step) => moveOf(cls, basic.id, 'swing', step, false).clip);
      expect(new Set(clips).size, `${cls}: ${clips.join(' ')}`).toBe(3);
      expect(moveOf(cls, basic.id, 'swing', 0, true).clip, cls).toBe(clips[2]);
    }
  });

  it('lands a fighter’s basic cuts within a fifth of a second of the button', () => {
    for (const cls of FIGHTERS) {
      const basic = Object.values(SKILLS).find((s) => s.cls === cls && s.kind === 'basic')!;
      for (const step of [0, 1, 2]) {
        const move = moveOf(cls, basic.id, 'swing', step, false);
        const s = strikeOf(medium, move.clip);
        expect((s.hit - s.from) / (move.rate ?? 1), `${cls} step ${step} (${move.clip})`).toBeLessThan(move.clip === 'spin' ? 0.4 : 0.22);
      }
    }
  });

  it('never has a staff or a bow chop: what a caster or an archer does with no move of its own is a cast or a shot', () => {
    for (const cls of [...CASTERS, 'ranger' as ClassId]) {
      expect(['cast', 'bow']).toContain(moveOf(cls, 'no-such-skill', 'swing', 0, false).clip);
      expect(['cast', 'bow']).toContain(moveOf(cls, 'no-such-skill', 'heavy', 0, false).clip);
    }
  });

  it('gives every class a spread of moves, not one clip for its whole kit', () => {
    for (const cls of Object.keys(CLASSES) as ClassId[]) {
      const clips = new Set<string>();
      for (const s of Object.values(SKILLS)) {
        if (s.cls !== cls || s.kind === 'dodge' || s.base.cast === 'form' || s.base.tags.includes('cat') || s.base.tags.includes('bear')) continue;
        const kind = s.base.cast === 'melee' ? (s.base.windup > 0 ? 'heavy' : 'swing') : s.kind === 'basic' && cls === 'ranger' ? 'shoot' : s.base.cast === 'channel' ? 'spin' : 'cast';
        clips.add(moveOf(cls, s.id, kind, 0, false).clip);
      }
      expect(clips.size, `${cls}: ${[...clips].join(' ')}`).toBeGreaterThanOrEqual(cls === 'ranger' ? 3 : 4);
    }
  });
});

describe('Sigilfall: the rules say which skill was made', () => {
  const cast = (w: World, slot: 'basic' | 'dodge'): boolean => tryCast(w, { slot, angle: 0, dist: null, assist: 0 });

  it('counts each skill and names it', () => {
    const w = newWorld('briarhollow', readyHero('warrior', 20, 'rare', 5), 5);
    const before = w.player.actN;
    expect(cast(w, 'basic')).toBe(true);
    expect(w.player.actN).toBe(before + 1);
    expect(w.player.actSkill).toBe('cleave');
    expect(w.player.actKind).toBe('swing');
  });

  it('leaves no move standing when the next skill has none of its own (a dodge is the dodge)', () => {
    const w = newWorld('briarhollow', readyHero('warrior', 20, 'rare', 5), 5);
    cast(w, 'basic');
    expect(w.player.actKind).toBe('swing');
    expect(cast(w, 'dodge')).toBe(true);
    expect(w.player.actKind).toBeNull();
  });
});

/** Stands in for the 3D cast: takes every call, and keeps what the hero and each creature were drawn doing. */
function fakeCast(blow: Strike): { cast: Cast; hero: { clip: string; t: number; x: number; lift: number }[]; foes: { clip: string; t: number }[] } {
  const hero: { clip: string; t: number; x: number; lift: number }[] = [];
  const foes: { clip: string; t: number }[] = [];
  const own: Record<string, unknown> = {
    wardrobe: { medium },
    strike: () => blow,
    rigOf: () => null,
    mountReady: () => false,
    person: (_look: unknown, _held: unknown, _shield: unknown, x: number, _y: number, _rot: number, m: Motion | { clip: string; t: number }, o?: { lift?: number; xray?: boolean }) => {
      if (o?.xray) hero.push({ clip: m.clip, t: m.t, x, lift: o.lift ?? 0 });
    },
    creature: (_sprite: string, _x: number, _y: number, _rot: number, _h: number, clip: string, t: number) => {
      foes.push({ clip, t });
      return {};
    },
  };
  const cast = new Proxy(own, { get: (o, k: string) => (k in o ? o[k] : () => undefined) }) as unknown as Cast;
  return { cast, hero, foes };
}

describe('Sigilfall: who is drawn striking', () => {
  const blow: Strike = { lift: 0.1, from: 0.5, hit: 0.6, to: 1 };
  const draw = { look: {} as never, weapon: { kind: 'sword' } as never, folk: 0, landOnly: false };

  it('shows the hero’s blow from where it starts in its clip, stepping into it', () => {
    const w = newWorld('briarhollow', readyHero('warrior', 20, 'rare', 5), 5);
    const wc = new WorldCast();
    const f = fakeCast(blow);
    wc.sync(f.cast, w, 1 / 60, 0, draw);
    tryCast(w, { slot: 'basic', angle: 0, dist: null, assist: 0 });
    const x0 = w.player.x;
    f.hero.length = 0;
    for (let i = 1; i <= 6; i++) wc.sync(f.cast, w, 1 / 60, i / 60, draw);
    const first = f.hero[0]!;
    const cut = strikeOf(medium, first.clip);
    // (the first cut of a warrior's chain, starting at its blow and not at 0)
    expect(first.clip).toBe(moveOf('warrior', 'cleave', 'swing', 0, false).clip);
    expect(first.t).toBeGreaterThanOrEqual(cut.from);
    expect(first.t).toBeLessThan(cut.from + 0.06);
    expect(Math.max(...f.hero.map((h) => h.x))).toBeGreaterThan(x0 + 1);
  });

  it('walks a fighter’s basic swings through the chain', () => {
    const w = newWorld('briarhollow', readyHero('paladin', 20, 'rare', 5), 5);
    const wc = new WorldCast();
    const f = fakeCast(blow);
    const seen: string[] = [];
    let time = 0;
    for (let n = 0; n < 3; n++) {
      w.player.cds.basic.t = 0;
      w.player.cds.basic.charges = 1;
      tryCast(w, { slot: 'basic', angle: 0, dist: null, assist: 0 });
      f.hero.length = 0;
      wc.sync(f.cast, w, 1 / 60, (time += 0.3), draw);
      seen.push(f.hero[0]!.clip);
    }
    expect(new Set(seen).size, seen.join(' ')).toBe(3);
  });

  it('lifts an enemy’s weapon over its wind-up and brings it down as the hit lands', () => {
    const w = newWorld('briarhollow', readyHero('warrior', 20, 'rare', 5), 5);
    w.enemies.length = 0;
    const e = w.addEnemy('skeleton', w.player.x + 30, w.player.y, 5, { room: -1, pack: -1 });
    const wc = new WorldCast();
    const f = fakeCast(blow);
    const at = (state: 'windup' | 'recover', left: number, time: number): { clip: string; t: number } => {
      e.state = state;
      e.t = left;
      f.foes.length = 0;
      wc.sync(f.cast, w, 1 / 60, time, draw);
      return f.foes[f.foes.length - 1]!;
    };
    e.state = 'chase';
    wc.sync(f.cast, w, 1 / 60, 0, draw);
    // winding up: from the lift toward the top of it, never past
    const early = at('windup', 0.5, 0.01);
    const late = at('windup', 0.02, 0.49);
    expect(early.t).toBeGreaterThanOrEqual(blow.lift);
    expect(late.t).toBeGreaterThan(early.t);
    expect(late.t).toBeLessThanOrEqual(blow.from);
    // the hit lands (the rules go to 'recover'): the blow starts at once, then its follow-through
    const landed = at('recover', 0.6, 0.5);
    expect(landed.t).toBeGreaterThanOrEqual(blow.from);
    expect(landed.t).toBeLessThan(blow.from + 0.05);
    const after = at('recover', 0.5, 0.6);
    expect(after.t).toBeGreaterThan(blow.hit);
    expect(after.clip).toBe(landed.clip);
  });
});

describe('Sigilfall: a party sees each other strike', () => {
  const card = (name: string, cls: ClassId): Card => ({ name, cls, level: 60, para: 0, keystone: 5, story: 200, look: { any: true }, weapon: { kind: 'sword' } });
  /** A host's and a guest's game in one run, joined as the room's relay joins them. */
  function pair() {
    const world = (cls: ClassId, coop: 'host' | 'guest'): World => new World({ region: 'crypt', tier: 2, mods: [], hero: readyHero(cls, 60, 'epic'), settings: { ...DEFAULT_SETTINGS }, seed: 7, key: 2, affixes: [], handIns: false, coop });
    const hw = world('warrior', 'host');
    const gw = world('mage', 'guest');
    const queue: { to: CoopSession; n: number; d: unknown }[] = [];
    const to: { hs?: CoopSession; gs?: CoopSession } = {};
    const hs = new CoopSession('host', 1, 1, (d) => queue.push({ to: to.gs!, n: 1, d: JSON.parse(JSON.stringify(d)) }));
    const gs = new CoopSession('guest', 2, 1, (d) => queue.push({ to: to.hs!, n: 2, d: JSON.parse(JSON.stringify(d)) }));
    to.hs = hs;
    to.gs = gs;
    for (const s of [hs, gs]) s.setMembers([{ n: 1, card: card('Ash', 'warrior') }, { n: 2, card: card('Bea', 'mage') }]);
    hs.attach(hw);
    gs.attach(gw);
    const step = (frames: number): void => {
      for (let i = 0; i < frames; i++) {
        hw.step(1 / 60);
        gw.step(1 / 60);
        hs.frame(1000 / 60);
        gs.frame(1000 / 60);
        while (queue.length) {
          const m = queue.shift()!;
          m.to.receive(m.n, m.d);
        }
      }
    };
    return { hw, gw, gs, step };
  }

  it('sends the skill a hero made, and the other game draws them making it', () => {
    const { hw, gw, step } = pair();
    step(12);
    const ghost = gw.coop!.ghosts.find((g) => g.n === 1)!;
    const before = ghost.act?.n ?? -1;
    tryCast(hw, { slot: 'basic', angle: 0, dist: null, assist: 0 });
    step(12);
    expect(ghost.act?.skill).toBe('cleave');
    expect(ghost.act!.kind).toBe('swing');
    expect(ghost.act!.n).not.toBe(before);
    // the picture: the same cut the warrior's own game shows
    const wc = new WorldCast();
    const f = fakeCast({ lift: 0.1, from: 0.5, hit: 0.6, to: 1 });
    const seen: string[] = [];
    (f.cast as unknown as { person: (...a: unknown[]) => void }).person = (_l, _h, _s, _x, _y, _r, m) => void seen.push((m as Motion).clip);
    wc.sync(f.cast, gw, 1 / 60, 0, { look: {} as never, weapon: { kind: 'staff' } as never, folk: 0, landOnly: false });
    hw.player.mana = hw.player.maxMana;
    expect(tryCast(hw, { slot: 's1', angle: 0, dist: null, assist: 0 })).toBe(true);
    step(30);
    seen.length = 0;
    wc.sync(f.cast, gw, 1 / 60, 0.5, { look: {} as never, weapon: { kind: 'staff' } as never, folk: 0, landOnly: false });
    expect(seen).toContain(moveOf('warrior', 'heavy-strike', 'heavy', 0, false).clip);
  });

  it('drops a skill that isn’t the sender’s class’s, or isn’t a skill at all', () => {
    const { gw, gs, step } = pair();
    step(12);
    const ghost = gw.coop!.ghosts.find((g) => g.n === 1)!;
    const p = { t: 'p', x: ghost.x, y: ghost.y, vx: 0, vy: 0, dir: 0, hp: 10, mh: 10, dead: 0, u: 0, sh: [] };
    const was = JSON.stringify(ghost.act);
    gs.receive(1, { ...p, a: [99, 'fireball', 0, 'cast', 0] });
    gs.receive(1, { ...p, a: [99, 'no-such-skill', 0, 'swing', 0] });
    gs.receive(1, { ...p, a: [99, 'cleave', 0, 'dance', 0] });
    gs.receive(1, { ...p, a: 'nonsense' });
    expect(JSON.stringify(ghost.act)).toBe(was);
    gs.receive(1, { ...p, a: [99, 'cleave', 0.5, 'swing', 1] });
    expect(ghost.act).toEqual({ n: 99, skill: 'cleave', angle: 0.5, kind: 'swing', big: true });
  });
});
