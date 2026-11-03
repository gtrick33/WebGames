import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/games/sigilfall/data/classes';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { TALENTS } from '../src/games/sigilfall/data/talents';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { talentIcon } from '../src/games/sigilfall/render/art/gameIcons';
import { SKILL_ICON, TALENT_ICONS, VIGIL_ICON } from '../src/games/sigilfall/render/art/iconPicks';

/**
 * The skill and talent icons (Nasha's Lumenfall): every skill has its own, no tree shows the same
 * icon twice, and the atlas the game loads holds exactly what the picks name, and the pack is credited.
 */

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
const index = JSON.parse(readFileSync('public/games/sigilfall/icons/icons.json', 'utf8')) as { cell: number; cols: number; names: string[] };
const credits = readFileSync('src/games/sigilfall/ICON_CREDITS.md', 'utf8');

describe('Sigilfall: skill and talent icons', () => {
  it('every skill has an icon of its own', () => {
    const ids = Object.keys(SKILLS);
    expect(ids.filter((id) => !SKILL_ICON[id])).toEqual([]);
    const used = ids.map((id) => SKILL_ICON[id]);
    expect(used.filter((n, i) => used.indexOf(n) !== i)).toEqual([]);
    // (and nothing is picked for a skill that isn't there)
    expect(Object.keys(SKILL_ICON).filter((id) => !SKILLS[id])).toEqual([]);
  });

  it('every talent has an icon, and no tree shows the same one twice', () => {
    for (const cls of CLASS_IDS) {
      for (const tree of [0, 1, 2]) {
        const nodes = TALENTS[cls].filter((n) => n.tree === tree);
        expect(nodes.filter((n) => !TALENT_ICONS[n.icon]).map((n) => `${n.id}: ${n.icon}`)).toEqual([]);
        const icons = nodes.map((n) => talentIcon(cls, n));
        expect(icons.filter((n) => !n)).toEqual([]);
        expect(icons.filter((n, i) => icons.indexOf(n) !== i).map((n) => `${cls} tree ${tree}: ${n}`)).toEqual([]);
      }
    }
  });

  it('the atlas holds what the picks name (rebuild it with scripts/sigilfall-icons.mjs), and the pack is credited', () => {
    const picked = [...new Set([...Object.values(SKILL_ICON), ...Object.values(TALENT_ICONS).flat(), ...Object.values(VIGIL_ICON)])].sort();
    expect(index.names).toEqual(picked);
    expect(credits).toContain('Nasha');
  });
});
