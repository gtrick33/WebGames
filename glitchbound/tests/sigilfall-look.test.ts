/**
 * Every worn piece shows on the hero: the look follows the gear (style, material, color, rarity);
 * generated armor is dyed per piece; the legs slot rolls, sells and saves like the others.
 */
import { describe, expect, it } from 'vitest';
import { BASES, ITEM_DEFS, SLOT_STATS } from '../src/games/sigilfall/data/items';
import type { ClassId, Item, SlotId } from '../src/games/sigilfall/data/types';
import { rng } from '../src/games/sigilfall/core/math';
import { emptySave, loadSave, writeSave } from '../src/games/sigilfall/progress/save';
import { itemMat, itemSlot, itemTint, makeItem, rollGear } from '../src/games/sigilfall/progress/items';
import { stockFor } from '../src/games/sigilfall/progress/shop';
import { scale2x } from '../src/games/sigilfall/render/pixel';
import { heroLook } from '../src/games/sigilfall/render/sprites';
import { readyHero } from './sigilfall-bot';

const gen = (base: string, r: Item['r'] = 'uncommon', uid = 'u1'): Item => ({ uid, base, r, il: 5, st: [] });

describe('sigilfall hero looks', () => {
  it('bare slots show the class outfit', () => {
    expect(heroLook('mage').head?.style).toBe('wizard');
    expect(heroLook('mage').chest.style).toBe('robe');
    expect(heroLook('warrior').head).toBeNull();
    expect(heroLook('ranger').quiver).not.toBeNull();
  });

  it('each armor piece changes the look, in its own style and color', () => {
    const cases: [SlotId, string, (l: ReturnType<typeof heroLook>) => unknown, unknown][] = [
      ['head', 'cloth-hood', (l) => l.head?.style, 'hood'],
      ['head', 'iron-helm', (l) => l.head?.style, 'helm'],
      ['head', 'leather-cap', (l) => l.head?.style, 'cap'],
      ['chest', 'silk-robe', (l) => l.chest.style, 'robe'],
      ['chest', 'chain-vest', (l) => [l.chest.style, l.chest.mat], ['plate', 'mail']],
      ['chest', 'leather-jerkin', (l) => [l.chest.style, l.chest.mat], ['tunic', 'leather']],
      ['legs', 'trousers', (l) => [l.legs.style, l.legs.mat], ['trousers', 'cloth']],
      ['legs', 'legguards', (l) => [l.legs.style, l.legs.mat], ['greaves', 'mail']],
      ['hands', 'gauntlets', (l) => l.hands?.style, 'gauntlets'],
      ['hands', 'gloves', (l) => l.hands?.style, 'gloves'],
      ['feet', 'sabatons', (l) => l.feet.style, 'sabatons'],
      ['feet', 'slippers', (l) => l.feet.style, 'shoes'],
      ['feet', 'boots', (l) => l.feet.style, 'boots'],
    ];
    for (const [slot, base, pick, want] of cases) {
      const it = gen(base);
      const look = heroLook('warrior', { [slot]: it });
      expect(pick(look), base).toEqual(want);
      expect(JSON.stringify(look)).toContain(itemTint(it));
    }
    // a hand-made piece keeps its own color and material
    const crown = { uid: 'c', base: 'crown-of-the-hollow-king', r: 'legendary', il: 9, st: [] } as Item;
    expect(heroLook('mage', { head: crown }).head).toMatchObject({ style: 'crown', mat: 'gold', tint: ITEM_DEFS['crown-of-the-hollow-king']!.tint, r: 'legendary' });
  });

  it('a quiver goes on the back, and epic or better armor comes with a cape', () => {
    expect(heroLook('ranger', { offhand: gen('quiver') }).quiver).toBe(itemTint(gen('quiver')));
    expect(heroLook('warrior', { chest: gen('chain-vest', 'rare') }).cape).toBeNull();
    expect(heroLook('warrior', { chest: gen('chain-vest', 'epic') }).cape).not.toBeNull();
    expect(heroLook('mage', { chest: gen('silk-robe', 'epic') }).cape).toBeNull();
  });

  it('generated armor is dyed per piece; weapons and hand-made items keep their color', () => {
    const tints = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const robe = gen('silk-robe', 'common', `r${i}`);
      expect(itemTint(robe)).toBe(itemTint({ ...robe }));
      tints.add(itemTint(robe));
    }
    expect(tints.size).toBeGreaterThan(4);
    expect(itemTint(gen('iron-sword', 'common', 'a'))).toBe(itemTint(gen('iron-sword', 'common', 'b')));
    const def = makeItem('thornmail', 8, rng(1))!;
    expect(itemTint(def)).toBe(ITEM_DEFS.thornmail!.tint);
    expect(itemMat(def)).toBe('mail');
  });
});

describe('sigilfall legs slot', () => {
  it('rolls legwear with legwear stats, for every class', () => {
    for (const cls of ['mage', 'warrior', 'ranger'] as ClassId[]) {
      const r = rng(3);
      for (let i = 0; i < 10; i++) {
        const it = rollGear(cls, 6, 'rare', r, 'legs');
        expect(itemSlot(it)).toBe('legs');
        for (const [k] of it.st) expect(SLOT_STATS.legs).toContain(k);
      }
    }
    expect(BASES.filter((b) => b.slot === 'legs').length).toBeGreaterThanOrEqual(3);
  });

  it('the armory sells it, and it is saved', () => {
    const h = readyHero('warrior', 6);
    const slots = new Set<SlotId>();
    for (let n = 0; n < 12; n++) {
      h.restock = n;
      for (const s of stockFor(h, 'armor')) slots.add(itemSlot(s.item));
    }
    expect(slots.has('legs')).toBe(true);
    const save = emptySave();
    save.heroes[0] = h;
    writeSave(save);
    expect(loadSave().save.heroes[0]!.equip.legs?.uid).toBe(h.equip.legs!.uid);
  });
});

describe('sigilfall pixel scaling', () => {
  it('Scale2x doubles art and rounds off staircases', () => {
    const out = scale2x(['#.', '.#']);
    expect(out).toHaveLength(4);
    expect(out.every((r) => r.length === 4)).toBe(true);
    // the empty corners between the two diagonal pixels stay empty, the inner corners fill
    expect(out[0]).toBe('##..');
    expect(out[1]![2]).toBe('#');
    expect(out[3]).toBe('..##');
  });
});
