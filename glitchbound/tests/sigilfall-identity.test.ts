/**
 * Every class is its own. The four casters used to share one basic attack in four colors, all eight classes one
 * dodge, and the Gloamknight the warrior's kit number for number. These hold what was done about it: a basic attack
 * and a dodge that no other class has, the Gloamknight's guard, and talents that are about them.
 */
import { describe, expect, it } from 'vitest';
import { CLASS_IDS, CLASSES } from '../src/games/sigilfall/data/classes';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { TALENTS } from '../src/games/sigilfall/data/talents';
import type { ClassId, SkillSpec } from '../src/games/sigilfall/data/types';
import { setSkill, type Character } from '../src/games/sigilfall/progress/character';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { hurtPlayer } from '../src/games/sigilfall/sim/combat';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const step = (w: World, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

function hero(cls: ClassId, level = 50, spec: 0 | 1 | 2 = 0, slot1?: string): World {
  const c: Character = readyHero(cls, level, 'uncommon', 7, spec);
  if (slot1) expect(setSkill(c, 0, slot1), slot1).toBe(true);
  const w = newWorld('whisperwood', c);
  w.enemies = [];
  step(w, 0.8);
  w.enemies = [];
  w.pets.length = 0;
  w.player.mana = w.player.maxMana;
  w.build.stats.crit = 0;
  return w;
}

function target(w: World, dx: number, dy = 0, hp = 1e6) {
  const e = w.addEnemy('moss-slime', w.player.x + dx, w.player.y + dy, 30, { room: -1, pack: 0 });
  e.hp = e.maxHp = hp;
  e.state = 'idle';
  e.aggro = false;
  return e;
}

const basic = (w: World): boolean => tryCast(w, { slot: 'basic', angle: 0, dist: 0.5, assist: 0 });
const dodge = (w: World): boolean => tryCast(w, { slot: 'dodge', angle: 0, dist: null, assist: 0 });
/** What a skill is, apart from its name and its numbers' fine tuning: how it is cast and everything it does. */
const shape = (s: SkillSpec): string => JSON.stringify([s.cast, s.damage > 0, s.range === 0, Math.round(s.duration * 10), s.charges, s.onCast, s.onHit, s.afterDodge ?? null, Object.keys(s.extra).sort()]);

describe('Sigilfall: no two classes share a basic attack or a dodge', () => {
  it('every dodge is a different thing', () => {
    const shapes = CLASS_IDS.map((cls) => shape(SKILLS[CLASSES[cls].dodge]!.base));
    expect(new Set(shapes).size, shapes.join('\n')).toBe(CLASS_IDS.length);
  });

  it('every basic attack is a different thing', () => {
    const shapes = CLASS_IDS.map((cls) => shape(SKILLS[CLASSES[cls].basic]!.base));
    expect(new Set(shapes).size, shapes.join('\n')).toBe(CLASS_IDS.length);
  });

  it('every dodge and basic says in its own words what it does', () => {
    const words = CLASS_IDS.flatMap((cls) => [SKILLS[CLASSES[cls].dodge]!.blurb, SKILLS[CLASSES[cls].basic]!.blurb]);
    expect(new Set(words).size).toBe(words.length);
    for (const b of words) expect(b.length).toBeGreaterThan(30);
  });
});

describe('Sigilfall: the basics in play', () => {
  it('mage: every fourth Arcane Bolt in a row is a lance, harder and through everything', () => {
    const w = hero('mage');
    const front = target(w, 50);
    const behind = target(w, 80);
    const hits: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = front.hp;
      w.player.cds.basic.t = 0;
      w.player.cds.basic.charges = 1;
      expect(basic(w)).toBe(true);
      step(w, 0.5);
      hits.push(before - front.hp);
    }
    expect(hits[3]! / hits[0]!).toBeGreaterThan(1.4);
    // (only the lance goes on through to the one behind)
    expect(behind.hp).toBeLessThan(1e6);
    expect(w.player.actBig).toBe(false);
  });

  it('priest: Smite lands at once, with nothing in the air', () => {
    const w = hero('priest');
    const e = target(w, 90);
    expect(basic(w)).toBe(true);
    expect(e.hp).toBeLessThan(1e6);
    expect(w.projectiles.filter((p) => !p.hostile).length).toBe(0);
  });

  it('warlock: Shadow Bolt leaves rot that goes on hurting', () => {
    const w = hero('warlock');
    const e = target(w, 60);
    expect(basic(w)).toBe(true);
    step(w, 0.6);
    expect(e.statuses.some((s) => s.id === 'curse')).toBe(true);
    const after = e.hp;
    step(w, 2);
    expect(e.hp).toBeLessThan(after);
  });

  it('druid: Wrath strikes at once and leaps to a second enemy', () => {
    const w = hero('druid');
    const a = target(w, 60);
    const b = target(w, 90, 20);
    expect(basic(w)).toBe(true);
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
    expect(1e6 - b.hp).toBeLessThan(1e6 - a.hp);
  });

  it('ranger: the Arrow out of a Tumble hits harder', () => {
    const shot = (roll: boolean): number => {
      const w = hero('ranger');
      const e = target(w, 70);
      if (roll) {
        w.input = { ...emptyInput(), mx: -1, my: 0 };
        expect(tryCast(w, { slot: 'dodge', angle: Math.PI, dist: null, assist: 0 })).toBe(true);
        step(w, 0.4);
      }
      const before = e.hp;
      expect(basic(w)).toBe(true);
      step(w, 0.8);
      return before - e.hp;
    };
    const plain = shot(false);
    const rolled = shot(true);
    expect(rolled / plain).toBeGreaterThan(1.4);
  });
});

describe('Sigilfall: the dodges in play', () => {
  it('warrior: Shoulder Barge goes through them, hurts them and feeds Rage', () => {
    const w = hero('warrior');
    const e = target(w, 22);
    w.player.mana = 0;
    expect(dodge(w)).toBe(true);
    step(w, 0.3);
    expect(e.hp).toBeLessThan(1e6);
    expect(w.player.mana).toBeGreaterThan(0);
  });

  it('mage: Phase Step is over almost before it starts, and goes further than a dash', () => {
    const w = hero('mage');
    const x = w.player.x;
    expect(dodge(w)).toBe(true);
    step(w, 0.12);
    expect(w.player.dash).toBeNull();
    expect(w.player.x - x).toBeGreaterThan(60);
    // (still safe a moment after arriving)
    expect(w.player.iframe).toBeGreaterThan(0);
  });

  it('paladin: Sunlit Charge sets you down behind a ward', () => {
    const w = hero('paladin');
    expect(w.player.shield).toBe(0);
    expect(dodge(w)).toBe(true);
    expect(w.player.shield).toBeGreaterThan(0);
  });

  it('priest: Swift Feather is a slow drift, safe the whole way', () => {
    const w = hero('priest');
    expect(dodge(w)).toBe(true);
    step(w, 0.4);
    expect(w.player.dash).not.toBeNull();
    expect(hurtPlayer(w, 50, {})).toBe(false);
  });

  it('warlock: Demonic Step leaves a shade behind for the enemy to go for', () => {
    const w = hero('warlock');
    expect(dodge(w)).toBe(true);
    expect(w.pets.some((p) => p.def.id === 'shade-decoy')).toBe(true);
    step(w, 3.2);
    expect(w.pets.some((p) => p.def.id === 'shade-decoy' && !p.dead)).toBe(false);
  });

  it('druid: Wild Dash leaves roots that hold what was chasing', () => {
    const w = hero('druid');
    const e = target(w, 16);
    expect(dodge(w)).toBe(true);
    expect(e.statuses.some((s) => s.id === 'root')).toBe(true);
  });

  it('gloamknight: Stand Fast does not move, lets nothing through, pays it back and gives Umbra', () => {
    const w = hero('gloamknight');
    const e = target(w, 24);
    const { x, y } = w.player;
    w.player.mana = 0;
    expect(dodge(w)).toBe(true);
    step(w, 0.2);
    expect(Math.hypot(w.player.x - x, w.player.y - y)).toBeLessThan(1);
    const hp = w.player.hp;
    expect(hurtPlayer(w, 80, { fromX: e.x, fromY: e.y, source: e })).toBe(false);
    expect(w.player.hp).toBe(hp);
    expect(e.hp).toBeLessThan(1e6);
    expect(w.player.mana).toBeGreaterThan(0);
    // and it ends: the next blow lands
    step(w, 0.6);
    expect(w.player.guard).toBe(0);
    expect(hurtPlayer(w, 80, { fromX: e.x, fromY: e.y, source: e })).toBe(true);
  });
});

describe('Sigilfall: the Gloamknight is not a second warrior', () => {
  const kind = (id: string): string => SKILLS[id]!.base.cast;

  it('its skills of the same levels are other kinds of skill', () => {
    // level 9: a hook that drags in, against a binding where it stands
    expect(kind('hookchain')).not.toBe(kind('night-tether'));
    // level 28: a leap at them, against the dark dragging them to you
    expect(kind('ground-breaker')).not.toBe(kind('dread-leap'));
    // level 36: a blow up close, against a thrown blade
    expect(kind('last-word')).not.toBe(kind('evenfall'));
  });

  it('Night Tether binds: slowed, and hurt more by everything', () => {
    const w = hero('gloamknight', 50, 0, 'night-tether');
    const e = target(w, 80);
    const x = e.x;
    expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    expect(e.statuses.some((s) => s.id === 'mark')).toBe(true);
    expect(e.statuses.some((s) => s.id === 'chill')).toBe(true);
    step(w, 0.3);
    expect(Math.abs(e.x - x)).toBeLessThan(6);
  });

  it('Undertow drags them in to the knight’s feet', () => {
    const w = hero('gloamknight', 50, 0, 'dread-leap');
    const e = target(w, 70);
    const before = Math.abs(e.x - w.player.x);
    expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    step(w, 1.4);
    expect(Math.abs(e.x - w.player.x)).toBeLessThan(before - 20);
  });

  it('Evenfall flies through a line of them', () => {
    const w = hero('gloamknight', 50, 0, 'evenfall');
    const a = target(w, 50);
    const b = target(w, 90);
    expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 })).toBe(true);
    step(w, 0.8);
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
  });
});

describe('Sigilfall: talents about what only that class has', () => {
  it('every class has talents for its own basic attack and its own dodge', () => {
    for (const cls of CLASS_IDS) {
      const def = CLASSES[cls];
      const forms = (def.forms ?? []).flatMap((f) => [f.basic, f.dodge]);
      const own = new Set([def.basic, def.dodge, ...forms]);
      const about = TALENTS[cls].filter((n) => n.mods.some((m) => (m.t === 'skill' && own.has(m.skill)) || (m.t === 'proc' && (m.proc.on === 'block' || (!!m.proc.skill && own.has(m.proc.skill))))));
      expect(about.length, `${cls}: ${about.map((n) => n.name).join(', ')}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('a third of the plain "+N% damage" kind are gone', () => {
    const plain = CLASS_IDS.flatMap((cls) => TALENTS[cls]).filter((n) => /^\+\d+% (damage|critical hit chance|haste|critical damage) per rank\.$/.test(n.text));
    expect(plain.length).toBeLessThan(50);
  });
});
