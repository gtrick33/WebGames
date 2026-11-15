import { describe, expect, it } from 'vitest';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import type { ClassId, SkillSpec } from '../src/games/sigilfall/data/types';
import { execute } from '../src/games/sigilfall/sim/cast';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Every class's great spells look like themselves (render/effects.ts draws the spell effects sim/cast.ts names): the
 * Mage's Flame Pillar is a column of fire out of the ground, not the Meteor's falling rock (the owner: "currently the
 * mage's flame pillar looks like the meteor, i want every class' spell to look better and unique"). Only the pictures
 * changed: the blows land when and where they did.
 */

const run = (w: World, seconds: number): void => {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
    w.input = emptyInput();
    w.player.hp = w.player.maxHp;
    w.step(1 / 60);
  }
};

/** A hero of a class with a foe in front, and the named spell effects the spell asked for, in order. */
function cast(cls: ClassId, spec: SkillSpec, seconds: number, dist = 60): { w: World; looks: string[]; hpAt: number[] } {
  const w = newWorld('whisperwood', readyHero(cls, 40));
  w.enemies.length = 0;
  w.fx.length = 0;
  const p = w.player;
  const e = w.addEnemy('hill-wolf', p.x + dist, p.y, 40, { room: -1, pack: -1, post: true });
  e.x = p.x + dist;
  e.y = p.y;
  e.hp = e.maxHp = 1e7;
  const looks: string[] = [];
  const hpAt: number[] = [];
  const seen = new Set<object>();
  const note = (): void => {
    for (const f of w.fx) {
      if (seen.has(f)) continue;
      seen.add(f);
      if (f.sprite?.includes(':')) looks.push(f.sprite);
    }
  };
  execute(w, 's1', spec, 0, e.x, e.y, spec.cast === 'mark' || spec.cast === 'chain' ? e : null);
  note();
  for (let t = 0; t < seconds; t += 1 / 60) {
    run(w, 1 / 60);
    note();
    hpAt.push(e.hp);
  }
  return { w, looks, hpAt };
}

const base = (id: string): SkillSpec => SKILLS[id]!.base;
const named = (looks: string[]): string[] => [...new Set(looks.map((l) => l.split(':')[0]!))];

describe('Sigilfall: every great spell its own look', () => {
  it('the Flame Pillar gathers on the ground and stands up as a column of fire; the Meteor falls and craters', () => {
    const pillar = cast('mage', base('flamestrike'), 1.4);
    const meteor = cast('mage', base('meteor'), 1.4);
    expect(named(pillar.looks)).toEqual(expect.arrayContaining(['pyre', 'pillar']));
    expect(named(pillar.looks)).not.toContain('meteorfall');
    expect(named(meteor.looks)).toEqual(expect.arrayContaining(['meteorfall', 'crater']));
    expect(named(meteor.looks)).not.toContain('pillar');
  });

  it('a talent that turns the Meteor to ice brings a comet of ice down; the Brimstone Golem crashes down on its sigil', () => {
    const comet = cast('mage', { ...base('meteor'), dmgType: 'frost', look: 'comet' }, 1.4);
    expect(named(comet.looks)).toEqual(expect.arrayContaining(['cometfall', 'rimecrater']));
    const golem = cast('warlock', base('summon-infernal'), 1.4);
    expect(golem.looks).toEqual(expect.arrayContaining(['golemfall:brimstone', 'golemland:brimstone']));
  });

  it('what comes down still lands when its wind-up is over, not before', () => {
    for (const id of ['flamestrike', 'meteor', 'summon-infernal']) {
      const spec = base(id);
      const cls: ClassId = id === 'summon-infernal' ? 'warlock' : 'mage';
      const { hpAt } = cast(cls, spec, spec.windup + 0.3);
      const before = Math.floor(spec.windup * 60) - 2;
      expect(hpAt[before], `${id} before its wind-up ends`).toBe(1e7);
      expect(hpAt[hpAt.length - 1]!, `${id} after`).toBeLessThan(1e7);
    }
  });

  it("the heavy blows leave their own mark where they land, in the class's own colors; the basic swings don't", () => {
    const blow = (cls: ClassId, id: string): string[] => cast(cls, base(id), 0.1, 24).looks;
    expect(blow('warrior', 'heavy-strike')).toContain('crush:steel');
    expect(blow('warrior', 'mortal-strike')).toContain('rend:blood');
    expect(blow('paladin', 'templars-verdict')).toContain('verdict:dawn');
    expect(blow('gloamknight', 'umbral-rend')).toContain('umbral:gloam');
    expect(blow('gloamknight', 'sundering-dark')).toContain('sunder:gloam');
    expect(blow('druid', 'ferocious-bite')).toContain('bite:cat');
    for (const [cls, id] of [['warrior', 'cleave'], ['paladin', 'crusader-strike'], ['gloamknight', 'gloam-cleave']] as const) {
      expect(named(blow(cls, id)).filter((n) => !['impact', 'blast'].includes(n)), id).toEqual([]);
    }
  });

  it('the big bolts burst their own way where they land', () => {
    expect(cast('mage', base('fireball'), 0.6).looks).toContain('fireburst:fire');
    expect(cast('mage', base('arcane-bolt'), 0.6).looks.some((l) => l.startsWith('fireburst'))).toBe(false);
    expect(cast('warlock', base('chaos-bolt'), 0.6).looks).toContain('ruin:ruin');
    expect(cast('warlock', base('shadow-bolt'), 0.6).looks.some((l) => l.startsWith('ruin'))).toBe(false);
    expect(cast('priest', base('holy-fire'), 0.6).looks).toContain('hymn:holy');
    expect(cast('druid', base('starsurge'), 0.6).looks).toContain('starburst:lunar');
    expect(cast('druid', base('starfire'), 0.6).looks).toContain('solar:solar');
  });

  it('the ultimates and the great novas are each their own', () => {
    const nova = (cls: ClassId, spec: SkillSpec): string[] => named(cast(cls, spec, 0.1, 20).looks);
    expect(nova('priest', base('halo'))).toContain('halo');
    expect(nova('priest', { ...base('halo'), dmgType: 'shadow', look: 'darkhalo' })).toContain('eclipse');
    expect(nova('paladin', base('avenging-wrath'))).toContain('dawn');
    expect(nova('paladin', base('divine-storm'))).toContain('sweep');
    expect(nova('gloamknight', base('duskfall'))).toContain('nightfall');
    expect(nova('warrior', base('thunder-clap'))).toContain('thunderstomp');
  });

  it("a mark lands in its own element's color, and the great ones their own way", () => {
    const line = (cls: ClassId, id: string): World['fx'] => cast(cls, base(id), 0.02).w.fx;
    const zap = (fx: World['fx']): string | undefined => fx.find((f) => f.kind === 'zap')?.color;
    expect(zap(line('druid', 'moonfire'))).not.toBe('#ffe066');
    expect(line('druid', 'moonfire').some((f) => f.sprite === 'moonbeam:moon')).toBe(true);
    expect(line('priest', 'mind-blast').some((f) => f.sprite === 'psyblast:psy')).toBe(true);
    expect(line('priest', 'smite').some((f) => f.sprite === 'smite:holy')).toBe(true);
  });

  it("a druid's Wrath is a lash of thorns, not lightning", () => {
    const { w } = cast('druid', base('wrath'), 0.02);
    expect(w.fx.find((f) => f.kind === 'zap')?.sprite).toBe('thorn');
    const { w: m } = cast('mage', base('chain-lightning'), 0.02);
    expect(m.fx.find((f) => f.kind === 'zap')?.sprite).toBeUndefined();
  });
});
