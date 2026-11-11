import { after, all, any, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * The Pale Reach (56-59), Act VI, the Last March: the Hallow King's own land north of Hollowmere, a frozen
 * waste of grey snow under a violet sky, where the dead stand in ranks waiting for their king's word. The
 * coalition camps at Dawn's Rest, a ruined waystation in the south; Duskspire, Vaelor's citadel, rises in the
 * north behind an outer wall older than Aster, and its last door opens only for one who carries all seven
 * sigils (sim/world.ts exitLock).
 *
 * What changes: the banners of every faction the hero helped stand over Dawn's Rest; the Host waits in a
 * cold gloom until the wall is breached, and the wall burns while the coalition goes through; once Vaelor
 * falls a tear opens over Duskspire into the Crown's memory of Vaelmoor (the finale), and once the Crown is
 * broken the sun comes up over the Reach.
 */
/** The wall breached, Duskspire not yet fallen. */
const STORMING = all(after('march-the-breach'), until('the-hollow-king'));

export const PALE_REACH = wildRegion(
  {
    id: 'pale-reach',
    name: 'The Pale Reach',
    subtitle: 'The Last March',
    theme: 'pale',
    levels: [56, 59],
    at: [56, -66],
    dark: false,
    safe: false,
    music: 'pale-reach',
    blurb: 'The Hallow King’s frozen land, where the dead stand in ranks and Duskspire rises in the north.',
    states: [
      { id: 'host-waits', when: until('march-the-breach'), gloom: true },
      { id: 'storming', when: STORMING, burning: true },
    ],
  },
  {
    w: 160,
    h: 110,
    seed: 10601,
    levels: [56, 59],
    from: [0.5, 0.95],
    forest: 0.26,
    scatter: { trees: 1, bushes: 0.6, rocks: 2, flowers: 0.4 },
    water: { kind: 'lakes', amount: 0.25 },
    hubs: [{ at: [0.5, 0.76], plan: 'ranks', npcs: ['mara-at-the-reach', 'orren-at-the-reach', 'quartermaster-holt', 'outrider-maeve'], houses: 4 }],
    exits: [{ side: 's', at: 0.5, to: 'hollowmere', label: 'South road to Hollowmere' }],
    pois: [
      // the King's citadel: the way in needs all seven sigils (sim/world.ts exitLock)
      { at: [0.5, 0.1], r: 12, kind: 'cave', level: 59, packs: [['pale-knight', 'hollow-legionnaire', 'soul-reaver'], ['hollow-legionnaire', 'hollow-legionnaire', 'hollow-legionnaire']], entrance: { to: 'duskspire', label: 'The Duskspire Gate', minLevel: 59 }, spot: { id: 'duskspire-gate', name: 'The Duskspire Gate' }, landmark: { style: 'keep', w: 12, h: 6, name: 'Duskspire' }, when: until('march-the-breach') },
      // the outer wall before the gate, which the siege mages bring down
      { at: [0.5, 0.32], r: 10, kind: 'ruin', level: 58, packs: [['hollow-legionnaire', 'hollow-legionnaire', 'pale-knight'], ['soul-reaver', 'hollow-legionnaire']], spot: { id: 'outer-wall', name: 'Duskspire’s Outer Wall' }, landmark: { style: 'tower', w: 4, h: 5, name: 'The Outer Wall' }, when: until('march-vosk') },
      // the Host in its ranks, under the Pale Standard
      { at: [0.18, 0.4], r: 12, kind: 'camp', level: 57, packs: [['hollow-legionnaire', 'hollow-legionnaire', 'soul-reaver'], ['pale-knight', 'hollow-legionnaire'], ['hollow-legionnaire', 'hollow-legionnaire', 'hollow-legionnaire']], elite: true, rare: 'the-pale-standard', spot: { id: 'the-kings-host', name: 'The King’s Host' }, chest: 'rare' },
      { at: [0.82, 0.36], r: 11, kind: 'nest', level: 57, packs: [['bone-drake', 'frost-wraith'], ['bone-drake', 'pale-hound', 'pale-hound'], ['bone-drake', 'bone-drake']], spot: { id: 'drake-graves', name: 'The Drake Graves' } },
      { at: [0.3, 0.66], r: 10, kind: 'ruin', level: 57, packs: [['frost-wraith', 'frost-wraith', 'soul-reaver'], ['hollow-legionnaire', 'frost-wraith'], ['frost-wraith', 'frost-wraith', 'frost-wraith']], spot: { id: 'frozen-village', name: 'Old Wintersend' }, landmark: { style: 'hall', w: 6, h: 4, name: 'Wintersend Hall' }, chest: 'common' },
      { at: [0.74, 0.66], r: 10, kind: 'den', level: 56, packs: [['pale-hound', 'pale-hound', 'pale-hound'], ['pale-hound', 'pale-hound', 'frost-wraith']], rare: 'gravejaw', spot: { id: 'hound-kennels', name: 'The King’s Kennels' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['pale-hound', 'pale-hound', 'pale-hound'], ['frost-wraith', 'frost-wraith'], ['hollow-legionnaire', 'hollow-legionnaire'], ['pale-hound', 'frost-wraith']] },
      { band: [0.35, 0.7], packs: [['hollow-legionnaire', 'hollow-legionnaire', 'soul-reaver'], ['bone-drake', 'pale-hound'], ['pale-knight', 'hollow-legionnaire'], ['frost-wraith', 'soul-reaver']] },
      { band: [0.65, 1], packs: [['pale-knight', 'pale-knight'], ['hollow-legionnaire', 'hollow-legionnaire', 'hollow-legionnaire'], ['soul-reaver', 'soul-reaver', 'frost-wraith'], ['bone-drake', 'hollow-legionnaire']] },
    ],
    wildCount: 52,
    story: [
      // Dawn's Rest: where the coalition comes in, and its companions by the fire
      { near: 'hub', marker: { kind: 'place', id: 'reach-camp' } },
      { near: 'hub', dy: 14, marker: { kind: 'place', id: 'reach-road' } },
      { near: 'hub', dx: -5, dy: 2, marker: { kind: 'place', id: 'reach-tents' } },
      { near: 'hub', dx: 5, dy: 3, marker: { kind: 'npc', npc: 'cael-at-the-reach' }, when: after('the-last-march') },
      // (a step from the armory's front, where the quartermaster stands now that the stall is a stall's size)
      { near: 'hub', dx: -2, dy: 5, marker: { kind: 'npc', npc: 'nyx-at-the-reach' }, when: after('the-last-march') },
      { near: 'hub', dx: 1, dy: 5, marker: { kind: 'npc', npc: 'elyra-at-the-reach' }, when: after('the-last-march') },
      { near: 'hub', dx: 0, dy: 3, marker: { kind: 'prop', prop: 'campfire' } },
      // the banners that came: three standards behind the hall, each raised by either of two who answered (eight in an
      // arc, one a faction, stood shoulder to shoulder with the camp's own)
      { near: 'hub', dx: -6, dy: -5, marker: { kind: 'prop', prop: 'flag' }, when: all(after('the-last-road'), any(after('fern-retaken'), after('camp-riders'))) },
      { near: 'hub', dx: 0, dy: -7, marker: { kind: 'prop', prop: 'blue-banner' }, when: all(after('the-last-road'), any(after('break-the-chains'), after('the-clans-decide'))) },
      { near: 'hub', dx: 6, dy: -5, marker: { kind: 'prop', prop: 'red-banner' }, when: all(after('the-last-road'), any(after('the-vault-of-rime'), after('the-sun-king'))) },
      ...[-10, -7, 7, 10].map((dx, i) => ({ near: 'hub', dx, dy: 2 + (i % 2) * 3, marker: { kind: 'prop' as const, prop: 'tent' }, when: after('the-last-road') })),
      // the champions the Crown kept: Vosk at the head of the Host, the Herald's voice in the gate
      { near: 'the-kings-host', dx: 5, dy: 2, marker: { kind: 'pack', enemies: ['vosk-the-hollowed'], level: 58, rare: true }, when: all(after('the-last-road'), until('march-vosk')) },
      { near: 'duskspire-gate', dy: 5, marker: { kind: 'pack', enemies: ['the-heralds-voice'], level: 59, rare: true }, when: all(after('march-the-breach'), until('march-the-voice')) },
      // the field before the outer wall, where the mages sing; the breach after
      { near: 'outer-wall', dy: 12, marker: { kind: 'place', id: 'wall-field' } },
      { near: 'outer-wall', dy: 2, marker: { kind: 'place', id: 'wall-n' } },
      { near: 'outer-wall', dx: -15, dy: 9, marker: { kind: 'place', id: 'wall-w' } },
      { near: 'outer-wall', dx: 15, dy: 9, marker: { kind: 'place', id: 'wall-e' } },
      { near: 'outer-wall', dy: 0, marker: { kind: 'place', id: 'wall-breach' } },
      { near: 'outer-wall', dy: -9, marker: { kind: 'place', id: 'breach-n' } },
      { near: 'outer-wall', dx: -12, dy: -4, marker: { kind: 'place', id: 'breach-w' } },
      { near: 'outer-wall', dx: 12, dy: -4, marker: { kind: 'place', id: 'breach-e' } },
      { near: 'outer-wall', dx: 0, dy: -2, marker: { kind: 'wisp', color: '#a89ac8', size: 3 }, when: until('march-the-siege-mages') },
      ...[-6, -2, 2, 6].map((dx, i) => ({ near: 'outer-wall', dx, dy: -1 + (i % 2), marker: { kind: 'fire' as const, size: 3 } })),
      { near: 'outer-wall', dx: -3, dy: 1, marker: { kind: 'prop', prop: 'rubble' }, when: after('march-the-siege-mages') },
      { near: 'outer-wall', dx: 3, dy: 1, marker: { kind: 'prop', prop: 'rubble' }, when: after('march-the-siege-mages') },
      // Vaelor fallen: a tear over Duskspire into the Crown's memory of Vaelmoor
      { near: 'duskspire-gate', dx: 9, dy: 3, marker: { kind: 'exit', to: 'vaelmoor-remembered', label: 'Through the tear over Duskspire: Vaelmoor as it was', needs: 'the-hollow-king' }, when: all(after('the-hollow-king'), until('crownfall-the-ash-crown')) },
      { near: 'duskspire-gate', dx: 9, dy: 2, marker: { kind: 'wisp', color: '#ffe8a8', size: 3 }, when: all(after('the-hollow-king'), until('crownfall-the-ash-crown')) },
      // dawn over the Reach: the coalition's banners on Duskspire's step
      { near: 'duskspire-gate', dx: -3, dy: 4, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('crownfall-the-ash-crown') },
      { near: 'duskspire-gate', dx: 3, dy: 4, marker: { kind: 'prop', prop: 'flag' }, when: after('crownfall-the-ash-crown') },
    ],
  },
);
