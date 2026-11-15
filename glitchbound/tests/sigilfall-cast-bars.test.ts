import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOUNT_DEFS } from '../src/games/sigilfall/data/mounts';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { SKILL_SLOTS, type ClassId, type SlotKey } from '../src/games/sigilfall/data/types';
import { ABILITIES } from '../src/games/sigilfall/arena/abilities';
import { SPELLS } from '../src/games/sigilfall/vigil/kit';
import { CoopSession } from '../src/games/sigilfall/net/coop';
import { setSkill } from '../src/games/sigilfall/progress/character';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { hurtPlayer } from '../src/games/sigilfall/sim/combat';
import { emptyInput, World, type InputFrame } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The casters' cast bars (campaign only): their heaviest spells take a moment to cast, standing still, and hit
 * harder for it. Kept here: what each would deal going off at once (and the wind-up it had then), at today's
 * numbers. Since the combat rebalance (skills hit harder on longer cooldowns) each caster's signature spell of its
 * specialization has a cast bar too, the one its talents make instant now and then: the Stormcaller's Ball Lightning
 * and the Cryomancer's Ice Storm.
 */
const BEFORE: Record<string, { damage: number; windup: number }> = {
  meteor: { damage: 146, windup: 0.75 },
  flamestrike: { damage: 81, windup: 0.55 },
  'starfall-lance': { damage: 85, windup: 0 },
  'summon-infernal': { damage: 92, windup: 0.6 },
  'chaos-bolt': { damage: 118, windup: 0.4 },
  'rain-of-fire': { damage: 12, windup: 0 },
  halo: { damage: 112, windup: 0 },
  starfall: { damage: 13, windup: 0 },
  'ball-lightning': { damage: 25, windup: 0 },
  blizzard: { damage: 12, windup: 0 },
};

/** Every cast-time spell in this world as it was before the cast bars: at once, at its old damage. */
function atOnce(w: World): void {
  for (const [id, old] of Object.entries(BEFORE)) {
    const s = w.build.skills[id]?.spec;
    if (!s) continue;
    s.damage *= old.damage / SKILLS[id]!.base.damage;
    s.windup = old.windup;
    s.castTime = 0;
  }
}

/** A caster's bar for the fight: their damage spells, the cast-time ones among them. */
const BARS: Record<string, string[]> = {
  'mage:0': ['flamestrike', 'starfall-lance', 'fireball', 'chain-lightning'],
  'warlock:2': ['chaos-bolt', 'rain-of-fire', 'corruption', 'drain-life'],
  'priest:1': ['holy-fire', 'mind-blast', 'shadow-word-pain', 'holy-nova'],
  'druid:0': ['starsurge', 'starfire', 'moonfire', 'entangling-roots'],
};

/**
 * All the damage a hero does in `seconds`, standing and casting everything ready (the ultimate first, then the
 * longest cooldown first, as the play-bot does) at three tough enemies that do no harm.
 */
function output(cls: ClassId, spec: 0 | 1 | 2, level: number, seconds: number, before: boolean, seed: number): number {
  const c = readyHero(cls, level, 'rare', seed, spec);
  (BARS[`${cls}:${spec}`] ?? []).forEach((id, i) => setSkill(c, i as 0 | 1 | 2 | 3, id));
  const w = newWorld('whisperwood', c, seed);
  w.enemies = [];
  if (before) atOnce(w);
  const p = w.player;
  const foes = [
    [58, 0],
    [66, 20],
    [66, -20],
  ].map(([dx, dy]) => {
    const e = w.addEnemy('moss-slime', p.x + dx!, p.y + dy!, level, { room: -1, pack: 0 });
    e.hp = e.maxHp = 1e8;
    e.dmg = 0;
    e.state = 'chase';
    e.aggro = true;
    return e;
  });
  const cdOf = (slot: SlotKey): number => {
    const s = w.build.skills[w.build.bar[slot] ?? '']?.spec;
    return !s ? 0 : s.cast === 'channel' || s.cast === 'drain' ? -1 : s.cooldown;
  };
  const order = [...SKILL_SLOTS].sort((a, b) => cdOf(b) - cdOf(a));
  for (let t = 0; t < seconds; t += 1 / 60) {
    const f = emptyInput();
    const e = foes.reduce((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) <= Math.hypot(b.x - p.x, b.y - p.y) ? a : b));
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    f.aim = a;
    f.aimX = e.x;
    f.aimY = e.y;
    f.holdBasic = { slot: 'basic', angle: a, dist: null, assist: 0 };
    if (!p.casting) {
      if (p.ult >= 100) f.casts.push({ slot: 'ult', angle: a, dist: null, assist: 0 });
      for (const slot of order) {
        const s = w.build.skills[w.build.bar[slot] ?? '']?.spec;
        if (s && p.cds[slot].charges > 0 && s.cast !== 'blink' && s.cast !== 'form' && s.cast !== 'dash') f.casts.push({ slot, angle: a, dist: null, assist: 0 });
      }
    }
    w.input = f;
    w.step(1 / 60);
    p.hp = p.maxHp;
  }
  return foes.reduce((n, x) => n + (x.maxHp - x.hp), 0);
}

const CASTERS: [ClassId, 0 | 1 | 2][] = [
  ['mage', 0],
  ['warlock', 2],
  ['priest', 1],
  ['druid', 0],
];

/* --------------------------------------------------------------- casting */

const step = (w: World, seconds: number, input?: Partial<InputFrame>): void => {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
    w.input = { ...emptyInput(), ...input };
    w.step(1 / 60);
  }
};

/** A level 50 hero with `skill` in the first slot (or as the ultimate), an enemy in front, and nobody else about. */
function caster(cls: ClassId, skill: string) {
  const c = readyHero(cls, 50, 'rare', 7, cls === 'warlock' ? 2 : 0);
  if (SKILLS[skill]!.kind === 'skill') expect(setSkill(c, 0, skill), skill).toBe(true);
  const w = newWorld('whisperwood', c);
  w.enemies = [];
  const p = w.player;
  p.mana = p.maxMana;
  const e = w.addEnemy('moss-slime', p.x + 60, p.y, 30, { room: -1, pack: 0 });
  e.hp = e.maxHp = 1e6;
  e.dmg = 0;
  e.state = 'chase';
  e.aggro = true;
  return { w, p, e, slot: (SKILLS[skill]!.kind === 'ultimate' ? 'ult' : 's1') as SlotKey };
}

const press = (w: World, slot: SlotKey): boolean => tryCast(w, { slot, angle: 0, dist: 0.5, assist: 0 });

describe('Sigilfall cast bars', () => {
  it('the casters’ heaviest spells have a cast time of 1 to 2 seconds; nobody else’s do', () => {
    const cast = Object.values(SKILLS).filter((s) => (s.base.castTime ?? 0) > 0);
    expect(cast.map((s) => s.id).sort()).toEqual(Object.keys(BEFORE).sort());
    for (const s of cast) {
      expect(['mage', 'warlock', 'priest', 'druid'], s.id).toContain(s.cls);
      expect(s.base.castTime, s.id).toBeGreaterThanOrEqual(1);
      expect(s.base.castTime, s.id).toBeLessThanOrEqual(2);
      // they hit harder for the wait, and the old wind-up before a bolt is gone (the cast is the wind-up now)
      expect(s.base.damage, s.id).toBeGreaterThan(BEFORE[s.id]!.damage);
      if (s.base.cast !== 'ground') expect(s.base.windup, s.id).toBe(0);
    }
  });

  it('a cast fills, then the spell goes off: only then is it paid for and its cooldown started', () => {
    const { w, p, e, slot } = caster('mage', 'starfall-lance');
    const mana = p.mana;
    expect(press(w, slot)).toBe(true);
    expect(p.casting?.spec.id).toBe('starfall-lance');
    step(w, 1);
    expect(p.casting!.t).toBeGreaterThan(0.9);
    expect(p.mana).toBeGreaterThanOrEqual(mana);
    expect(p.cds.s1.charges).toBe(1);
    expect(e.hp).toBe(e.maxHp);
    step(w, 0.5);
    expect(p.casting).toBeNull();
    expect(w.castEnd?.fired).toBe(true);
    expect(p.cds.s1.charges).toBe(0);
    expect(p.cds.s1.t).toBeGreaterThan(0);
    expect(p.mana).toBeLessThan(mana);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('the ultimate keeps its charge through the cast and spends it when it goes', () => {
    const { w, p, slot } = caster('druid', 'starfall');
    p.ult = 100;
    expect(press(w, slot)).toBe(true);
    step(w, 1);
    expect(p.ult).toBe(100);
    step(w, 0.6);
    expect(p.casting).toBeNull();
    expect(p.ult).toBeLessThan(5);
    expect(w.fields.length).toBeGreaterThan(0);
  });

  it('moving stops a cast, with nothing spent and no cooldown', () => {
    for (const [cls, skill] of [
      ['warlock', 'chaos-bolt'],
      ['priest', 'halo'],
    ] as const) {
      const { w, p, e, slot } = caster(cls, skill);
      p.ult = 100;
      const mana = p.mana;
      expect(press(w, slot), skill).toBe(true);
      step(w, 0.5);
      step(w, 0.1, { mx: 1 });
      expect(p.casting, skill).toBeNull();
      expect(w.castEnd?.fired, skill).toBe(false);
      step(w, 2);
      expect(p.ult, skill).toBe(100);
      expect(p.cds.s1.charges, skill).toBe(p.cds.s1.max);
      expect(p.mana, skill).toBeGreaterThanOrEqual(mana);
      expect(e.hp, skill).toBe(e.maxHp);
    }
  });

  it('being hurt doesn’t stop a cast; a stun, another skill or a dodge does', () => {
    const hurt = caster('warlock', 'chaos-bolt');
    expect(press(hurt.w, hurt.slot)).toBe(true);
    // (three blows inside Ruin Bolt's 1.1 s)
    for (let i = 0; i < 3; i++) {
      step(hurt.w, 0.3);
      hurt.p.iframe = 0;
      const hp = hurt.p.hp + hurt.p.shield;
      hurtPlayer(hurt.w, 5, { fromX: hurt.p.x + 20, fromY: hurt.p.y, knock: 40 });
      expect(hurt.p.hp + hurt.p.shield, `hit ${i}`).toBeLessThan(hp);
      expect(hurt.p.casting, `hit ${i}`).not.toBeNull();
    }
    step(hurt.w, 0.5);
    expect(hurt.w.castEnd?.fired).toBe(true);

    const stun = caster('warlock', 'chaos-bolt');
    press(stun.w, stun.slot);
    step(stun.w, 0.3);
    stun.p.statuses.push({ id: 'stun', t: 1, power: 1, tick: 0 });
    step(stun.w, 1 / 60);
    expect(stun.p.casting).toBeNull();

    const other = caster('warlock', 'chaos-bolt');
    press(other.w, other.slot);
    step(other.w, 0.3);
    // the basic attack waits for the cast; the same skill again does nothing
    expect(press(other.w, 'basic')).toBe(false);
    expect(press(other.w, other.slot)).toBe(false);
    expect(other.p.casting).not.toBeNull();
    other.w.build.bar.s2 = 'corruption';
    expect(press(other.w, 's2')).toBe(true);
    expect(other.p.casting).toBeNull();
    expect(other.p.cds.s1.charges).toBe(1);

    const dodge = caster('warlock', 'chaos-bolt');
    press(dodge.w, dodge.slot);
    step(dodge.w, 0.3);
    step(dodge.w, 1 / 60, { casts: [{ slot: 'dodge', angle: 1, dist: null, assist: 0 }] });
    expect(dodge.p.casting).toBeNull();
    expect(dodge.p.cds.s1.charges).toBe(1);
  });

  it('a cast pressed with other skills keeps the frame; on a mount, the hero gets down to cast', () => {
    const { w, p } = caster('mage', 'flamestrike');
    w.build.bar.s2 = 'fireball';
    step(w, 1 / 60, { casts: ['s1', 's2'].map((slot) => ({ slot: slot as SlotKey, angle: 0, dist: 0.5, assist: 0 })) });
    expect(p.casting?.spec.id).toBe('flamestrike');
    const ride = caster('mage', 'flamestrike');
    ride.p.riding = Object.keys(MOUNT_DEFS)[0]!;
    step(ride.w, 1 / 60, { casts: [{ slot: 's1', angle: 0, dist: 0.5, assist: 0 }] });
    expect(ride.p.riding).toBeNull();
    expect(ride.p.casting?.spec.id).toBe('flamestrike');
  });

  it('a co-op ally’s cast is sent and shown on their hero, and nonsense is not', () => {
    const sent: { t?: string; c?: unknown }[] = [];
    const guest = new World({ region: 'crypt', tier: 0, mods: [], hero: readyHero('mage', 50), settings: { ...DEFAULT_SETTINGS }, seed: 7, handIns: false, coop: 'guest' });
    const gs = new CoopSession('guest', 2, 1, (d) => sent.push(d as { t?: string }));
    const cards = [
      { n: 1, card: { name: 'Ash', cls: 'warrior' as const, level: 50, para: 0, keystone: 0, story: 0, look: {}, weapon: {} } },
      { n: 2, card: { name: 'Bea', cls: 'mage' as const, level: 50, para: 0, keystone: 0, story: 0, look: {}, weapon: {} } },
    ];
    gs.setMembers(cards);
    gs.attach(guest);
    guest.player.ult = 100;
    expect(tryCast(guest, { slot: 'ult', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    guest.step(1 / 60);
    gs.frame(100);
    const msg = sent.filter((m) => m.t === 'p').pop();
    expect(msg?.c).toEqual(['meteor', expect.any(Number), expect.any(Number)]);

    const host = new World({ region: 'crypt', tier: 0, mods: [], hero: readyHero('warrior', 50), settings: { ...DEFAULT_SETTINGS }, seed: 7, handIns: false, coop: 'host' });
    const hs = new CoopSession('host', 1, 1, () => undefined);
    hs.setMembers(cards);
    hs.attach(host);
    const hero = { t: 'p', x: host.player.x, y: host.player.y, vx: 0, vy: 0, dir: 0, hp: 10, mh: 10, dead: 0, u: 0, sh: [] };
    hs.receive(2, { ...hero, c: ['meteor', 0.5, 1] });
    const ally = host.coop!.ghosts.find((g) => g.n === 2)!;
    expect(ally.cast).toEqual({ id: 'meteor', k: 0.5, angle: 1 });
    // not a spell, another class's, or out of range: nothing (or kept in range)
    hs.receive(2, { ...hero, c: ['no-such-spell', 0.5, 1] });
    expect(ally.cast).toBeNull();
    hs.receive(2, { ...hero, c: ['halo', 0.5, 1] });
    expect(ally.cast).toBeNull();
    hs.receive(2, { ...hero, c: ['meteor', 9, 1] });
    expect(ally.cast?.k).toBe(1);
    hs.receive(2, hero);
    expect(ally.cast).toBeNull();
  });

  it('the Vigil and the Ring keep their own kits: no cast bars, and none of the campaign’s casting', () => {
    for (const s of Object.values(SPELLS)) expect(s, s.id).not.toHaveProperty('castTime');
    for (const a of Object.values(ABILITIES)) expect(a, a.id).not.toHaveProperty('castTime');
    for (const file of ['vigil/sim.ts', 'vigil/kit.ts', 'arena/sim.ts', 'arena/abilities.ts', 'arena/bot.ts']) {
      const src = readFileSync(`src/games/sigilfall/${file}`, 'utf8');
      expect(src, file).not.toMatch(/from '\.\.\/(sim\/cast|sim\/world|data\/skills|data\/kits)|castTime/);
    }
  });

  it('each caster’s damage stays in line with what it was when every spell went off at once', () => {
    // two seeds, three minutes each, standing and casting at three tough enemies (the bar a player would build)
    for (const [cls, spec] of CASTERS) {
      for (const level of [30, 50]) {
        const was = output(cls, spec, level, 180, true, 7) + output(cls, spec, level, 180, true, 3);
        const now = output(cls, spec, level, 180, false, 7) + output(cls, spec, level, 180, false, 3);
        expect(now / was, `${cls} at ${level}`).toBeGreaterThan(0.93);
        // (a little over, for the warlock: its rot goes on working while a cast fills, and casting at once runs it dry
        // sooner; and the Doomcaller's two talents that make a cast instant, Backlash and Hail of Brimstone, save a
        // whole cast bar each time only when there is one to save)
        expect(now / was, `${cls} at ${level}`).toBeLessThan(cls === 'warlock' ? 1.22 : 1.12);
      }
    }
  }, 60_000);
});
