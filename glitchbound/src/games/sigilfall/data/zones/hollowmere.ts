import { after, all, is, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * Hollowmere (53-56), Act V: the dead lake at the heart of Vaelmoor, black water so still it mirrors a sky that
 * isn't there. Drowned towns lie under it, the dead walk its shores, and on an island in the middle the
 * Lich of Hollowmere keeps a necropolis where Vaelor's dead are made. The Ferryman, who has rowed the
 * lake longer than anyone remembers, keeps a landing on the southern shore.
 *
 * What changes: the lake lies in gloom and the necropolis glows until the Lich falls; Ysane's echo sits behind
 * his throne until she is let go; after, lanterns on the causeway and the hill of new graves above the landing.
 */
export const HOLLOWMERE = wildRegion(
  {
    id: 'hollowmere',
    name: 'Hollowmere',
    subtitle: 'The dead lake',
    theme: 'deadlake',
    levels: [53, 56],
    at: [72, -54],
    dark: false,
    safe: false,
    music: 'hollowmere',
    blurb: 'A black, still lake at the heart of the Dead Kingdom, with a necropolis on an island in its middle, where the Hallow King’s dead are made.',
    states: [{ id: 'lich-holds', when: until('the-necropolis'), gloom: true }],
  },
  {
    w: 160,
    h: 104,
    seed: 82671,
    levels: [53, 56],
    from: [0.3, 0.92],
    forest: 0.2,
    scatter: { trees: 1.2, bushes: 1, rocks: 1.4, flowers: 0.6 },
    water: { kind: 'lakes', amount: 0.85 },
    hubs: [{ at: [0.3, 0.84], npcs: ['the-ferryman', 'old-nan', 'pilgrim-tobiah', 'digger-mott'], houses: 4 }],
    exits: [
      { side: 's', at: 0.4, to: 'weeping-woods', label: 'South road to the Weeping Woods' },
      { side: 'e', at: 0.7, to: 'emberdeep', label: 'East road to Emberdeep Caldera' },
      // the Last March (Act VI): north to the Pale Reach once all seven sigils are won
      { side: 'n', at: 0.5, to: 'pale-reach', label: 'North road to the Pale Reach', minLevel: 56, needs: 'the-seventh-sigil' },
    ],
    pois: [
      // the necropolis on the water, where the Lich makes the Hallow King's dead
      { at: [0.6, 0.3], r: 14, kind: 'ruin', level: 55, packs: [['necropolis-guard', 'necropolis-guard', 'lich-acolyte'], ['bone-weaver', 'necropolis-guard'], ['lich-acolyte', 'lich-acolyte', 'drowned-dead']], rare: 'the-lich-of-hollowmere', spot: { id: 'the-necropolis', name: 'The Necropolis' }, landmark: { style: 'temple', w: 8, h: 6, name: 'The Necropolis' }, chest: 'epic' },
      // the drowned town, its bell tower still standing in the water
      { at: [0.18, 0.4], r: 11, kind: 'ruin', level: 54, packs: [['drowned-dead', 'drowned-dead', 'lake-wraith'], ['lake-wraith', 'lake-wraith', 'drowned-dead'], ['mere-serpent', 'drowned-dead']], elite: true, rare: 'the-bell-ringer', spot: { id: 'drowned-town', name: 'Drowned Elsmere' }, landmark: { style: 'tower', w: 4, h: 5, name: 'Elsmere Bell Tower' }, chest: 'rare' },
      // where the black barges land the dead for the weavers
      { at: [0.84, 0.5], r: 10, kind: 'camp', level: 54, packs: [['bone-weaver', 'drowned-dead', 'drowned-dead'], ['bone-weaver', 'necropolis-guard'], ['lich-acolyte', 'necropolis-guard', 'drowned-dead']], spot: { id: 'corpse-landing', name: 'The Corpse Landing' } },
      { at: [0.5, 0.72], r: 10, kind: 'nest', level: 53, packs: [['mere-serpent', 'mere-serpent'], ['mere-serpent', 'lake-wraith'], ['mere-serpent', 'drowned-dead', 'drowned-dead']], spot: { id: 'serpent-shallows', name: 'The Serpent Shallows' }, chest: 'common' },
      { at: [0.76, 0.84], r: 9, kind: 'grove', level: 53, packs: [['lake-wraith', 'lake-wraith'], ['lake-wraith', 'drowned-dead', 'drowned-dead'], ['lake-wraith', 'lake-wraith', 'lake-wraith']], spot: { id: 'mourners-shore', name: 'Mourners’ Shore' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['drowned-dead', 'drowned-dead', 'drowned-dead'], ['lake-wraith', 'lake-wraith'], ['mere-serpent', 'drowned-dead'], ['lake-wraith', 'drowned-dead', 'drowned-dead'], ['mere-serpent', 'mere-serpent']] },
      { band: [0.35, 0.7], packs: [['necropolis-guard', 'drowned-dead', 'drowned-dead'], ['lich-acolyte', 'lake-wraith', 'drowned-dead'], ['mere-serpent', 'mere-serpent'], ['bone-weaver', 'drowned-dead', 'drowned-dead'], ['necropolis-guard', 'lich-acolyte']] },
      { band: [0.65, 1], packs: [['necropolis-guard', 'necropolis-guard', 'lich-acolyte'], ['bone-weaver', 'necropolis-guard'], ['lich-acolyte', 'lich-acolyte', 'lake-wraith'], ['mere-serpent', 'necropolis-guard'], ['bone-weaver', 'lake-wraith', 'drowned-dead']] },
    ],
    story: [
      // Orren at the landing from the day he comes down to the water
      { near: 'hub', dx: 4, dy: 2, marker: { kind: 'npc', npc: 'orren-at-the-mere' }, when: after('the-dead-lake') },
      // Mourners' Shore: where the lake answers him
      { near: 'mourners-shore', dx: -2, dy: 2, marker: { kind: 'place', id: 'mourners-edge' } },
      { near: 'mourners-shore', dx: 0, dy: -10, marker: { kind: 'place', id: 'mourners-water' } },
      { near: 'mourners-shore', dx: -12, dy: 0, marker: { kind: 'place', id: 'mourners-reeds' } },
      { near: 'mourners-shore', dx: 10, dy: -2, marker: { kind: 'place', id: 'mourners-east' } },
      // the necropolis glows until the Lich falls; Ysane behind his throne until she is let go
      { near: 'the-necropolis', dx: 0, dy: -2, marker: { kind: 'wisp', color: '#8ad0c8', size: 3 }, when: until('the-necropolis') },
      { near: 'the-necropolis', dx: 0, dy: -4, marker: { kind: 'npc', npc: 'echo-of-ysane-mere' }, when: all(is('the-necropolis', 'done'), until('ysanes-last-echo')) },
      // after: lanterns along the old causeway, and the hill of new graves above the landing
      ...[6, 12, 18].map((dy) => ({ near: 'the-necropolis', dx: -4, dy, marker: { kind: 'prop' as const, prop: 'lantern' }, when: after('the-necropolis') })),
      { near: 'hub', dx: -6, dy: -5, marker: { kind: 'prop', prop: 'coffin' }, when: after('old-customers') },
      { near: 'hub', dx: -8, dy: -4, marker: { kind: 'prop', prop: 'iron-torch' }, when: after('the-bell-of-elsmere') },
    ],
    wildCount: 52,
  },
);
