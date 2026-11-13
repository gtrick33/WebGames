import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASS_IDS, MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { SLOTS } from '../src/games/sigilfall/data/types';
import { freePoints, newCharacter } from '../src/games/sigilfall/progress/character';
import { emptySave, migrate, saveText } from '../src/games/sigilfall/progress/save';
import { trialHero, trialsOpen, trialStone, TRIALS_OPEN_AT } from '../src/games/sigilfall/progress/trial';
import { campaignDone } from '../src/games/sigilfall/progress/wardrobe';

describe('Sigilfall: the Rift Trials are played with ready heroes', () => {
  it('every calling has one for each of its three paths: top level, a full set of epic gear, every talent spent', () => {
    for (const cls of CLASS_IDS) {
      for (const spec of [0, 1, 2] as const) {
        const c = trialHero(cls, spec, 4);
        expect(c.cls).toBe(cls);
        expect(c.level, cls).toBe(MAX_LEVEL);
        expect(c.spec, cls).toBe(spec);
        expect(freePoints(c), cls).toBe(0);
        for (const slot of SLOTS) expect(c.equip[slot]?.r, `${cls} ${slot}`).toBe('epic');
        expect(c.keystone).toBe(4);
        // (a stone rises without the cap it has for a hero who hasn't finished the story)
        expect(campaignDone(c)).toBe(true);
      }
    }
  });

  it('it is the same hero for everyone: made twice, it is made alike', () => {
    const gear = (c: ReturnType<typeof trialHero>): string => JSON.stringify(SLOTS.map((s) => [c.equip[s]?.base, c.equip[s]?.il, c.equip[s]?.st]));
    expect(gear(trialHero('mage', 1, 1))).toBe(gear(trialHero('mage', 1, 9)));
    expect(gear(trialHero('mage', 1, 1))).not.toBe(gear(trialHero('mage', 2, 1)));
  });

  it('they open once some hero of the account has reached level 20', () => {
    const save = emptySave();
    expect(trialsOpen(save)).toBe(false);
    const young = newCharacter('warrior', 'A', 'a', 0);
    save.heroes[0] = young;
    expect(trialsOpen(save)).toBe(false);
    young.level = TRIALS_OPEN_AT;
    expect(trialsOpen(save)).toBe(true);
    expect(TRIALS_OPEN_AT).toBe(20);
  });

  it('each calling keeps its own stone on the account: the first until raised, and kept through a save', () => {
    const save = emptySave();
    expect(trialStone(save, 'mage')).toBe(1);
    save.rift = { mage: 7, ranger: 3 };
    expect(trialStone(save, 'mage')).toBe(7);
    expect(trialStone(save, 'warrior')).toBe(1);
    const back = migrate(JSON.parse(saveText(save)));
    expect(back?.rift).toEqual({ mage: 7, ranger: 3 });
    // a save from before the Trials had their own heroes
    const old = JSON.parse(saveText(save)) as Record<string, unknown>;
    delete old.rift;
    expect(migrate(old)?.rift).toEqual({});
    // nonsense is not a stone
    expect(migrate({ ...(JSON.parse(saveText(save)) as Record<string, unknown>), rift: { mage: 'x', nobody: 9, ranger: -4 } })?.rift).toEqual({ ranger: 1 });
  });

  it('the engine plays a Trial as that hero, keeps only the stone, and sends them back to the title', () => {
    const engine = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
    expect(engine).toContain('this.hero = trialHero(cls, spec, top);');
    expect(engine).toContain('this.save.rift = { ...this.save.rift, [this.trial]: Math.max(trialStone(this.save, this.trial), this.hero.keystone) };');
    expect(engine).toContain('if (this.trial && !key) {');
  });
});

describe('Sigilfall: Mythic and the Riftstones are for heroes at the top level', () => {
  const engine = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
  const panels = readFileSync('src/games/sigilfall/ui/Panels.tsx', 'utf8');

  it('a story hero below it can start neither: the road refuses a stone and gives Heroic for Mythic', () => {
    expect(engine).toContain('if (key > 0 && h.level < MAX_LEVEL) {');
    expect(engine).toContain('if (tier >= 2 && h.level < MAX_LEVEL) tier = Math.min(tier, 1);');
  });

  it('the map offers neither below it', () => {
    expect(panels).toContain('const keyed = top && h.keystone >= KEY_MIN && r.kind === \'dungeon\';');
    expect(panels).toContain('TIERS.slice(0, Math.min(h.tier, top ? 2 : 1) + 1)');
  });

  it('the quest that asks for a Mythic clear is offered at the top level, not at 17', () => {
    expect(QUEST_DEFS.mythic!.level).toBe(MAX_LEVEL);
    for (const q of Object.values(QUEST_DEFS)) {
      for (const o of [q.objective, ...(q.then ?? [])]) if (o.kind === 'clear' && o.tier >= 2) expect(q.level ?? MAX_LEVEL, q.id).toBeGreaterThanOrEqual(MAX_LEVEL);
    }
  });
});
