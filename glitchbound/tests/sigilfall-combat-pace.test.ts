/**
 * The combat rebalance (the owner: "the ultimate fills fast as heck, and the combat seems repetitive a bit, cooldowns
 * are short and makes me feel like fireball for example is not that great and different than the basic attack ...
 * more dmg but extra cd, make sure all classes benefit from that"; and "refactor some talents for instant procs, e.g.
 * burning enemies have small chance of making flame pillar instant cast ... apply this where needed for any other
 * talent tree of any other specialization, add more diversity").
 *
 * - Haste speeds a skill's cooldown by half of itself, never more than 50% (the dodge keeps all of it).
 * - The ultimate's floor is 40 s at level 3, 60 s at 30 and 70 s from 50, and everything that charges it draws on it.
 * - A class's big skills hit four to nine times harder than its basic attack, on cooldowns of seconds, not fractions of one.
 * - Every specialization has two new talents: a proc that makes a skill instant, ready, free or stronger, or a state
 *   that stacks; each of them fires on the simulation, and an instant one really skips the cast bar.
 * - The phone's thumbs are gathered as the Ring's, the potion and the mount apart from them; a boss's shout is in the
 *   middle of a phone's screen.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS, CLASSES, KITS } from '../src/games/sigilfall/data/classes';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { TALENTS } from '../src/games/sigilfall/data/talents';
import type { ClassId, Effect, ProcDef, SkillOp } from '../src/games/sigilfall/data/types';
import { buildHero } from '../src/games/sigilfall/progress/build';
import { setSkill, type Character } from '../src/games/sigilfall/progress/character';
import { migrate, SAVE_VERSION } from '../src/games/sigilfall/progress/save';
import { tryCast } from '../src/games/sigilfall/sim/cast';
import { applyStatus, runProcs } from '../src/games/sigilfall/sim/combat';
import { BASIC_HASTE, emptyInput, skillHaste, slotHaste, ULT_BANK, ultFloor, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const step = (w: World, seconds: number): void => {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

/** A level 60 hero of a specialization with its whole tree learned, alone, mana full, past the grace of arriving. */
function hero(cls: ClassId, spec: 0 | 1 | 2, bar: string[] = []): World {
  const c: Character = readyHero(cls, 60, 'rare', 7, spec);
  bar.forEach((id, i) => expect(setSkill(c, i as 0 | 1 | 2 | 3, id), id).toBe(true));
  const w = newWorld('whisperwood', c);
  w.enemies = [];
  step(w, 0.8);
  w.enemies = [];
  w.player.mana = w.player.maxMana;
  return w;
}

function foe(w: World, dx = 40, hp = 1e7) {
  const e = w.addEnemy('moss-slime', w.player.x + dx, w.player.y, 60, { room: -1, pack: 0 });
  e.hp = e.maxHp = hp;
  e.dmg = 0;
  e.state = 'chase';
  e.aggro = true;
  return e;
}

/** The new talents, by class and tree: the instant/ready/free/stronger procs and the stacking states. */
const NEW: Record<ClassId, [string, string][]> = {
  warrior: [['red-mist', 'blood-for-blood'], ['sword-and-board', 'rolling-thunder'], ['find-the-opening', 'whirling-steel']].map((x) => x as [string, string]),
  mage: [['pillar-of-embers', 'stoke-the-flames'], ['eye-of-the-storm', 'overcharge'], ['frostbitten', 'winters-grasp']].map((x) => x as [string, string]),
  ranger: [['steady-breath', 'lock-on'], ['quick-set', 'venom-burst'], ['wild-call', 'feeding-frenzy']].map((x) => x as [string, string]),
  paladin: [['morning-light', 'dawns-answer'], ['shield-of-dawn', 'aegis-light'], ['blade-of-dawn', 'zealous-pace']].map((x) => x as [string, string]),
  priest: [['grace-under-fire', 'bright-ward'], ['swift-hymn', 'answered-prayer'], ['surge-of-shadow', 'insanity']].map((x) => x as [string, string]),
  warlock: [['dark-harvest', 'agony'], ['hellfire-core', 'pit-frenzy'], ['backlash', 'hail-of-brimstone']].map((x) => x as [string, string]),
  druid: [['lunar-surge', 'eclipse'], ['predatory-swiftness', 'bloodied-fury'], ['moonlit-hide', 'bristling-fur']].map((x) => x as [string, string]),
  gloamknight: [['blood-answers', 'gorged'], ['ruinous-edge', 'dusk-momentum'], ['dread-surge', 'tolling-dark']].map((x) => x as [string, string]),
};

/** What a proc's effect leaves behind that can be checked: a buff by id, a summoned pet, cooldowns taken off. */
function lands(w: World, e: Effect, before: { pets: number; cd: number }): boolean {
  if (e.kind === 'buff') return w.player.buffs.some((b) => b.def.id === e.buff.id);
  if (e.kind === 'summon') return w.pets.length > before.pets;
  if (e.kind === 'cdr') return w.player.cds.s1.t < before.cd;
  return false;
}

describe('Sigilfall: the pace of a fight', () => {
  it('haste speeds a skill’s cooldown by half of itself, at most 50% faster; the attack and the dodge keep their own rules', () => {
    expect(skillHaste(0)).toBe(1);
    expect(skillHaste(40)).toBeCloseTo(1.2);
    expect(skillHaste(86)).toBeCloseTo(1.43);
    expect(skillHaste(158)).toBeCloseTo(1.5);
    expect(slotHaste('s2', 158)).toBeCloseTo(1.5);
    expect(slotHaste('basic', 158)).toBeCloseTo(1 + BASIC_HASTE / 100);
    // (the dodge, with all of it: every boss's dance was set against it)
    expect(slotHaste('dodge', 158)).toBeCloseTo(2.58);
    // a level 60 mage in full gear: Fireball takes its cooldown over 1.5 to come round, whatever the haste (counted in
    // full, the 160% of haste a hero has at the top took its 7 s down to under 3)
    const w = hero('mage', 1, ['fireball']);
    expect(w.build.stats.haste).toBeGreaterThan(100);
    const cd = w.build.skills.fireball!.spec.cooldown;
    expect(cd).toBeGreaterThan(5);
    const e = foe(w);
    expect(tryCast(w, { slot: 's1', angle: 0, dist: null, assist: 0 })).toBe(true);
    step(w, cd / 1.5 - 0.2);
    expect(w.player.cds.s1.charges).toBe(0);
    step(w, 0.4);
    expect(w.player.cds.s1.charges).toBe(1);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('the ultimate: a lull banks a third of a bar, and the trickle in a fight draws on the floor’s budget', () => {
    expect(ULT_BANK).toBe(35);
    expect(ultFloor(30)).toBe(60);
    const w = hero('warrior', 0);
    const p = w.player;
    p.ult = 0;
    p.ultBudget = 0;
    // fighting, hitting nothing: only the budget's refill comes through, never more than a bar per floor
    for (let t = 0; t < 30; t += 1 / 60) {
      p.calm = 0;
      w.input = emptyInput();
      w.step(1 / 60);
    }
    expect(p.ult).toBeLessThanOrEqual((30 / ultFloor(60)) * 100 + 0.01);
    expect(p.ult).toBeGreaterThan(5);
  });

  it('every class’s heaviest skill hits at least four times as hard as its basic attack, on a cooldown of 7 s or more', () => {
    for (const cls of CLASS_IDS) {
      const def = CLASSES[cls];
      const basic = SKILLS[def.basic]!.base.damage;
      const pool = [...def.skills, ...def.trees.map((t) => t.skill)].map((id) => SKILLS[id]!.base).filter((s) => s.damage > 0 && !s.duration && !s.tick);
      const heaviest = pool.reduce((a, b) => (b.damage > a.damage ? b : a));
      expect(heaviest.damage / basic, `${cls}: ${heaviest.id}`).toBeGreaterThanOrEqual(4);
      expect(heaviest.cooldown, `${cls}: ${heaviest.id}`).toBeGreaterThanOrEqual(7);
    }
    // the owner's own example: a Fireball is worth near eight Arcane Bolts now (it was three)
    expect(SKILLS.fireball!.base.damage / SKILLS['arcane-bolt']!.base.damage).toBeGreaterThan(7);
    expect(SKILLS.fireball!.base.cooldown).toBeGreaterThanOrEqual(7);
  });
});

describe('Sigilfall: the new talents', () => {
  it('every specialization has its two, in place of plain numbers, each tree adding up to what it did', () => {
    for (const cls of CLASS_IDS) {
      for (const tree of [0, 1, 2] as const) {
        const nodes = TALENTS[cls].filter((n) => n.tree === tree);
        for (const id of NEW[cls][tree]!) expect(nodes.some((n) => n.id === id), `${cls} ${tree} ${id}`).toBe(true);
        // (the capstone is still in reach: 30 points below it, and the specialization's 31 to spend)
        expect(nodes.filter((n) => n.row < 6).reduce((a, n) => a + n.ranks, 0), `${cls} ${tree}`).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('a chance that grows with the rank grows; what the proc does stays as it is', () => {
    const c = readyHero('mage', 60, 'rare', 7, 0);
    expect(c.talents['pillar-of-embers']).toBe(3);
    const p = buildHero(c).procs.find((x) => x.id === 'pillar-of-embers')!;
    expect(p.chance).toBeCloseTo(0.06);
    expect(p.effect.kind === 'buff' && p.effect.buff.empower).toEqual({ skill: 'flamestrike', instant: true, ready: true });
    // and a next cast made stronger, a rank at a time: Whirling Steel's 8% is 24% at three ranks
    const w = readyHero('warrior', 60, 'rare', 7, 2);
    const ops = buildHero(w).skills['mortal-strike']!.spec.onCast;
    const buff = ops.find((e) => e.kind === 'buff' && e.buff.id === 'combo-whirling-steel');
    expect(buff?.kind === 'buff' && buff.buff.empower?.pct).toBe(24);
  });

  it('each proc fires on the simulation when what it waits for happens', () => {
    for (const cls of CLASS_IDS) {
      for (const tree of [0, 1, 2] as const) {
        const w = hero(cls, tree);
        for (const id of NEW[cls][tree]!) {
          const proc = w.build.procs.find((x) => x.id === id);
          if (!proc) continue;
          const sure: ProcDef = { ...proc, chance: 1, icd: 0 };
          w.build.procs = [sure];
          const e = foe(w);
          if (proc.status) applyStatus(w, e, { status: proc.status, dur: 6, power: proc.status === 'freeze' ? 1 : 0.3 }, 50);
          // (a cooldown running, for one that takes time off them)
          w.player.cds.s1.charges = 0;
          w.player.cds.s1.t = 5;
          const before = { pets: w.pets.length, cd: w.player.cds.s1.t };
          const type = proc.dmgType ?? (proc.skill ? SKILLS[proc.skill]!.base.dmgType : 'physical');
          runProcs(w, proc.on, { x: e.x, y: e.y, target: e, base: 50, type, depth: 0, hitDmg: 50, skill: proc.skill, ...(proc.on === 'kill' ? { statuses: e.statuses.map((s) => s.id), killType: type } : {}) });
          expect(lands(w, proc.effect, before), `${cls} ${id}`).toBe(true);
          w.player.buffs = [];
        }
      }
    }
  });

  it('each one that rides on a skill comes with that skill', () => {
    for (const cls of CLASS_IDS) {
      for (const tree of [0, 1, 2] as const) {
        for (const id of NEW[cls][tree]!) {
          const node = TALENTS[cls].find((n) => n.id === id)!;
          for (const m of node.mods) {
            if (m.t !== 'skill') continue;
            expect(SKILLS[m.skill], `${cls} ${id}: ${m.skill}`).toBeTruthy();
            const op = m.op as SkillOp;
            if (op.op === 'onCast' && op.effect.kind === 'buff' && op.effect.buff.empower) expect(SKILLS[op.effect.buff.empower.skill], `${id}`).toBeTruthy();
            // (and the skill belongs to the class)
            const ids = [CLASSES[cls].basic, ...CLASSES[cls].skills, ...CLASSES[cls].trees.map((t) => t.skill), CLASSES[cls].ult, CLASSES[cls].dodge, ...(KITS[cls].def.forms ?? []).flatMap((f) => [f.basic, ...f.skills, f.dodge])];
            expect(ids, `${cls} ${id}`).toContain(m.skill);
          }
          for (const m of node.mods) if (m.t === 'proc' && m.proc.effect.kind === 'buff' && m.proc.effect.buff.empower) expect(SKILLS[m.proc.effect.buff.empower.skill], id).toBeTruthy();
        }
      }
    }
  });

  it('an instant proc really skips the cast bar: Flame Pillar, Ball Lightning, Ice Storm, Ruin Bolt and Rain of Fire', () => {
    const cases: [ClassId, 0 | 1 | 2, string, string][] = [
      ['mage', 0, 'flamestrike', 'pillar-of-embers'],
      ['mage', 1, 'ball-lightning', 'eye-of-the-storm'],
      ['mage', 2, 'blizzard', 'winters-grasp'],
      ['warlock', 2, 'chaos-bolt', 'backlash'],
      ['warlock', 2, 'rain-of-fire', 'hail-of-brimstone'],
    ];
    for (const [cls, tree, skill, talent] of cases) {
      const w = hero(cls, tree, [skill]);
      foe(w, 50);
      const p = w.player;
      // without it: a cast bar
      expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 }), skill).toBe(true);
      expect(p.casting?.spec.id, skill).toBe(skill);
      p.casting = null;
      // with it: it goes at once, and the proc is spent
      const node = TALENTS[cls].find((n) => n.id === talent)!;
      const m = node.mods[0]!;
      const eff = m.t === 'proc' ? m.proc.effect : m.t === 'skill' && (m.op.op === 'onCast' || m.op.op === 'onHit') ? m.op.effect : null;
      expect(eff?.kind, talent).toBe('buff');
      if (eff?.kind !== 'buff') continue;
      p.buffs.push({ def: eff.buff, t: eff.buff.dur, n: 1 });
      p.cds.s1.charges = p.cds.s1.max;
      p.mana = p.maxMana;
      expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.5, assist: 0 }), skill).toBe(true);
      expect(p.casting, `${skill} with ${talent}`).toBeNull();
      expect(p.buffs.some((b) => b.def.id === eff.buff.id), talent).toBe(false);
    }
  });

  it('Pillar of Embers, in play: a hit on a Burning enemy readies an instant Flame Pillar, which lands where it was aimed', () => {
    const w = hero('mage', 0, ['flamestrike', 'fireball']);
    const e = foe(w, 50);
    const p = w.player;
    w.build.procs = w.build.procs.map((x) => (x.id === 'pillar-of-embers' ? { ...x, chance: 1 } : x));
    // the pillar spent, its cooldown running
    p.cds.s1.charges = 0;
    p.cds.s1.t = 10;
    applyStatus(w, e, { status: 'burn', dur: 6, power: 0.2 }, 50);
    runProcs(w, 'hit', { x: e.x, y: e.y, target: e, base: 20, type: 'arcane', depth: 0, hitDmg: 20, skill: 'arcane-bolt' });
    expect(p.buffs.some((b) => b.def.id === 'combo-pillar-of-embers')).toBe(true);
    expect(p.cds.s1.charges).toBe(1);
    const hp = e.hp;
    expect(tryCast(w, { slot: 's1', angle: 0, dist: 0.4, assist: 0 })).toBe(true);
    expect(p.casting).toBeNull();
    step(w, 1);
    expect(e.hp).toBeLessThan(hp);
  });
});

describe('Sigilfall: what changed for saves and screens', () => {
  it('a save from before the rework gives every hero who had spent points a free respec', () => {
    expect(SAVE_VERSION).toBe(14);
    const c = readyHero('mage', 30, 'rare', 7, 0);
    const fresh = readyHero('warrior', 5);
    const save = migrate(JSON.parse(JSON.stringify({ v: 13, heroes: [c, fresh], last: 0, settings: {}, saved: 0 })))!;
    expect(save.heroes[0]!.freeRespec).toBe(true);
    expect(save.heroes[1]!.freeRespec).toBeUndefined();
  });

  it('the phone’s thumbs are gathered as the Ring’s, and a boss’s shout is in the middle of a phone’s screen', () => {
    const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
    const rule = (sel: string): string => {
      const at = css.lastIndexOf(`\n${sel} {`);
      return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
    };
    const n = (r: string, k: string): number => Number(new RegExp(`${k}: (?:calc\\()?(\\d+)px`).exec(r)?.[1]);
    expect(rule('.rb-cluster')).toContain('width: 220px');
    expect(rule('.rb-cluster')).toContain('height: 182px');
    expect(rule('.rb-cluster .rb-sb-basic')).toContain('width: 74px');
    for (const s of ['s1', 's2', 's3', 's4']) expect(rule(`.rb-cluster .rb-sb-${s}`), s).toContain('width: 52px');
    // (every skill inside the cluster's box)
    for (const s of ['basic', 's1', 's2', 's3', 's4', 'ult', 'dodge']) {
      const r = rule(`.rb-cluster .rb-sb-${s}`);
      expect(n(r, 'right') + n(r, 'width'), s).toBeLessThanOrEqual(220);
      expect(n(r, 'bottom') + n(r, 'height'), s).toBeLessThanOrEqual(182);
    }
    // the potion and the mount apart from them (the owner: "potion should be somewhere accessible, mount should be
    // somewhere visible"): the potion at the foot of the screen beside the skills, a thumb's gap from the dodge, and
    // big; the mount under the map
    expect(rule('.rb-cluster .rb-sb-potion')).toBe('');
    expect(rule('.rb-cluster .rb-sb-mount')).toBe('');
    const dock = rule('.rb-potion-dock');
    expect(n(dock, 'right')).toBeGreaterThanOrEqual(6 + 220 + 12);
    expect(n(dock, 'bottom')).toBeLessThanOrEqual(20);
    expect(n(dock, 'width')).toBeGreaterThanOrEqual(52);
    // (its place: the first rule for it; a later one gives it, with the potion, the cluster's rim)
    const at = css.indexOf('\n.rb-ui.is-touch > .rb-sb-mount {');
    const mount = css.slice(at, css.indexOf('}', at));
    const map = rule('.is-touch .rb-minimap-hud');
    expect(n(mount, 'top')).toBeGreaterThanOrEqual(n(map, 'top') + 84);
    const shout = rule('.rb-ui.is-boss.is-touch .rb-announce');
    expect(shout).toContain('top: 50%');
    expect(shout).toContain('left: 50%');
    expect(shout).toContain('translate(-50%, -50%)');
    expect(rule('.rb-ui.is-boss.is-touch .rb-announce > .rb-banner strong')).toContain('white-space: normal');
  });
});
