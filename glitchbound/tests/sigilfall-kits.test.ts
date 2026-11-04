import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { PETS } from '../src/games/sigilfall/data/pets';
import { NPCS } from '../src/games/sigilfall/data/quests';
import { npcLookOf } from '../src/games/sigilfall/render/sprites';
import { armorParts } from '../src/games/sigilfall/render3d/armorKit';
import { wardrobeParts } from '../src/games/sigilfall/render3d/dress';
import { hasKit, kitOf } from '../src/games/sigilfall/render3d/kits';

describe('Sigilfall: who plays whom', () => {
  it('every creature in the data has its own model, chosen by hand', () => {
    const missing = new Set<string>();
    for (const e of Object.values(ENEMIES)) if (!hasKit(e.sprite)) missing.add(e.sprite);
    for (const b of Object.values(BOSSES)) if (!hasKit(b.sprite)) missing.add(b.sprite);
    for (const p of Object.values(PETS)) if (!p.look && !hasKit(p.sprite)) missing.add(p.sprite);
    expect([...missing]).toEqual([]);
  });

  it('every part the wardrobe names is in the built models (a wrong name draws a body with no head)', () => {
    const bytes = gunzipSync(readFileSync('public/games/sigilfall/3d/hero.pack'));
    const head = JSON.parse(bytes.subarray(4, 4 + bytes.readUInt32LE(0)).toString()) as { meshes: Record<string, unknown> };
    expect(wardrobeParts().filter((id) => !head.meshes[id])).toEqual([]);
    expect(armorParts().filter((id) => !head.meshes[id])).toEqual([]);
  });

  it('every townsperson in the story is a person', () => {
    const creatures = Object.values(NPCS).filter((n) => !npcLookOf(n.id) && !['villager', 'smith', 'elder', 'mystic'].includes(n.sprite));
    expect(creatures.map((n) => n.id)).toEqual([]);
  });

  it('the Ashen Host is the dead: skeletons, or the knights and engines of the dead', () => {
    const dead = /^(sk_|black_knight|vaelor|catapult|siege_ram|chain_post|a_horse_white|a_wolf)/;
    for (const e of Object.values(ENEMIES)) {
      if (!e.sprite.startsWith('legion-')) continue;
      expect(kitOf(e.sprite, e.id).k, e.id).toMatch(dead);
    }
  });
});
