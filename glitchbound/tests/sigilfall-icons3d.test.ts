/**
 * Icons and the map in the world's own hand (POLISH_PLAN.md piece 11): what is carried or worn is pictured from its
 * 3D model (render3d/portrait.ts gearPicture; the pictures themselves need a graphics card, and are seen in the
 * browser), what has no model keeps its painted icon, and the minimap is painted as the full map is.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ItemIcon } from '../src/games/sigilfall/data/types';
import { hasGearModel } from '../src/games/sigilfall/render3d/portrait';

const ICONS: ItemIcon[] = ['staff', 'wand', 'sword', 'axe', 'hammer', 'bow', 'orb', 'tome', 'shield', 'quiver', 'hood', 'helm', 'cap', 'crown', 'robe', 'plate', 'jerkin', 'legs', 'gloves', 'boots', 'amulet', 'ring', 'relic', 'shard', 'potion'];
/** What has no model of its own in the wardrobe: it keeps its painted icon. */
const PAINTED: ItemIcon[] = ['orb', 'tome', 'amulet', 'ring', 'relic', 'shard', 'potion'];

describe('Sigilfall: items pictured from their own models', () => {
  it('every weapon, shield, quiver and piece of armor is pictured from a model; the trinkets keep their painted icons', () => {
    for (const icon of ICONS) expect(hasGearModel(icon), icon).toBe(!PAINTED.includes(icon));
  });

  it('the menus show the picture smooth and the painted icon crisp', () => {
    const common = readFileSync('src/games/sigilfall/ui/common.tsx', 'utf8');
    const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
    expect(common).toContain("const pic = itemPicture(item);");
    expect(common).toContain("className={pic.smooth ? 'is-smooth' : undefined}");
    expect(css).toMatch(/\.rb-itemicon img\.is-smooth \{\n\s+image-rendering: auto;/);
  });
});

describe('Sigilfall: the minimap is painted as the full map is', () => {
  it('draws the full map’s painted ground, smooth', () => {
    const mini = readFileSync('src/games/sigilfall/ui/Minimap.tsx', 'utf8');
    expect(mini).toContain('g.drawImage(groundOf(w.map, w.region.theme), ox * MAP_PX, oy * MAP_PX, SPAN * MAP_PX, SPAN * MAP_PX, 0, 0, S, S);');
    expect(mini).not.toContain('function baseLayer(');
  });
});
