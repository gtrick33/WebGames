import { after, all, is, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * Highwall March (40-46): the war-torn country before the great fortress-city of Highwall, which
 * guards the road north into the Hallow King's own lands. General Morvain's Ashen Host has it under
 * siege: trenches and bone catapults in the west, the Breach smashed in the walls north-west, burned
 * villages, trampled fields and the knights' old chapel with its graves dug open. Lord-Commander Varn
 * holds the relief camp in the east, where the road comes in from Sablewind Canyon.
 *
 * The representative siege of the Three Gates (blueprint Prompt 10): Highwall is **besieged** (smoke over
 * the walls, the Host's banners on its lines) until the Siege-Breaker falls, **breached** (the walls burn
 * while the fight goes on inside) until Morvain falls, and **liberated** after (the Crown's banners on the
 * Breach, the garrison's tents in the camp). Each state is chosen from quest progress alone, so a reload
 * mid-siege comes back to the same state, and no wave or reward can run twice.
 */
/** Highwall under siege, then breached: the city's two states before it is relieved. */
const BESIEGED = until('the-siege-breaker');
const BREACHED = all(after('the-siege-breaker'), until('general-morvain'));

export const HIGHWALL = wildRegion(
  {
    id: 'highwall',
    name: 'Highwall March',
    subtitle: 'The siege of Highwall',
    theme: 'warfront',
    levels: [40, 46],
    at: [78, 4],
    dark: false,
    safe: false,
    music: 'highwall',
    blurb: 'Trenches, smoke and the great fortress of Highwall under siege by the Ashen Host.',
    states: [
      { id: 'besieged', when: BESIEGED, smoke: true },
      { id: 'breached', when: BREACHED, burning: true },
    ],
  },
  {
    w: 160,
    h: 104,
    seed: 63301,
    levels: [40, 46],
    from: [0.96, 0.6],
    forest: 0.2,
    scatter: { trees: 1, bushes: 1, rocks: 2, flowers: 0.5 },
    water: { kind: 'river', from: 'n', to: 's' },
    hubs: [{ at: [0.75, 0.65], plan: 'court', npcs: ['lord-commander-varn', 'quartermaster-bess', 'chaplain-ottis'], houses: 6 }],
    exits: [
      { side: 'e', at: 0.6, to: 'sablewind', label: 'East road to Sablewind Canyon' },
      { side: 'w', at: 0.5, to: 'shattered-vale', label: 'West road to the Shattered Vale' },
      // the third Gate: open once the second is taken (Act IV)
      { side: 'n', at: 0.8, to: 'bonefields', label: 'North road to the Bonefields and the Muster Hall', minLevel: 46, needs: 'the-gloam-gate' },
    ],
    pois: [
      // the way into besieged Highwall: the hole the Siege-Breaker smashed in its walls
      { at: [0.35, 0.3], r: 12, kind: 'cave', level: 44, packs: [['death-knight-initiate', 'legion-soldier'], ['legion-crossbowman', 'legion-soldier', 'legion-soldier'], ['bone-catapult', 'legion-ensign', 'legion-soldier']], entrance: { to: 'siege-of-highwall', label: 'The Breach: into besieged Highwall', minLevel: 42 }, spot: { id: 'the-breach', name: 'The Breach' }, landmark: { style: 'keep', w: 10, h: 5, name: 'Highwall' } },
      { at: [0.16, 0.66], r: 11, kind: 'camp', level: 43, packs: [['legion-soldier', 'legion-soldier', 'legion-crossbowman'], ['bone-catapult', 'legion-soldier'], ['legion-ensign', 'legion-soldier', 'legion-soldier']], elite: true, rare: 'captain-hollowbane', spot: { id: 'legion-lines', name: 'The Host Lines' }, chest: 'rare' },
      { at: [0.42, 0.58], r: 10, kind: 'camp', level: 42, packs: [['bone-catapult', 'legion-crossbowman'], ['bone-catapult', 'legion-soldier', 'legion-soldier']], spot: { id: 'bone-batteries', name: 'The Bone Batteries' }, chest: 'common' },
      { at: [0.56, 0.84], r: 10, kind: 'ruin', level: 41, packs: [['ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm'], ['ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm']], spot: { id: 'burned-village', name: 'Burned Ashby' } },
      { at: [0.62, 0.22], r: 9, kind: 'farm', level: 42, packs: [['legion-crossbowman', 'legion-crossbowman'], ['legion-crossbowman', 'legion-soldier', 'legion-soldier']], spot: { id: 'trampled-fields', name: 'The Trampled Fields' } },
      { at: [0.9, 0.28], r: 10, kind: 'ruin', level: 42, packs: [['death-knight-initiate', 'ghoul-swarm', 'ghoul-swarm'], ['death-knight-initiate', 'legion-ensign']], spot: { id: 'knights-chapel', name: 'The Knights’ Chapel' }, landmark: { style: 'temple', w: 5, h: 4, name: 'The Knights’ Chapel' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['legion-soldier', 'legion-soldier', 'legion-soldier'], ['ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm'], ['legion-crossbowman', 'legion-soldier', 'legion-soldier'], ['grave-hound', 'grave-hound', 'legion-soldier', 'legion-soldier'], ['legion-soldier', 'legion-soldier', 'ghoul-swarm', 'ghoul-swarm'], ['legion-crossbowman', 'legion-crossbowman', 'legion-soldier'], ['bone-catapult', 'legion-soldier', 'legion-soldier'], ['legion-ensign', 'legion-soldier', 'legion-soldier']] },
      { band: [0.35, 0.7], packs: [['legion-soldier', 'legion-soldier', 'legion-crossbowman', 'legion-crossbowman'], ['bone-catapult', 'legion-soldier', 'legion-soldier'], ['death-knight-initiate', 'ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm'], ['legion-ensign', 'legion-soldier', 'legion-soldier', 'legion-crossbowman'], ['legion-crossbowman', 'legion-crossbowman', 'legion-soldier']] },
      { band: [0.65, 1], packs: [['death-knight-initiate', 'legion-soldier', 'legion-soldier'], ['bone-catapult', 'legion-crossbowman', 'legion-soldier', 'legion-soldier'], ['legion-ensign', 'death-knight-initiate', 'legion-soldier'], ['legion-soldier', 'legion-soldier', 'legion-soldier', 'legion-crossbowman']] },
    ],
    wildCount: 56,
    story: [
      // the ground before the Breach where Cael's riders go in
      { near: 'the-breach', dx: 6, dy: 10, marker: { kind: 'place', id: 'sortie-ground' } },
      { near: 'the-breach', dx: 2, dy: 2, marker: { kind: 'place', id: 'sortie-n' } },
      { near: 'the-breach', dx: -6, dy: 12, marker: { kind: 'place', id: 'sortie-w' } },
      { near: 'the-breach', dx: 16, dy: 8, marker: { kind: 'place', id: 'sortie-e' } },
      // Mara at the relief camp from the day she takes command until the second Gate is taken
      { near: 'hub', dx: 3, dy: -4, marker: { kind: 'npc', npc: 'captain-mara' }, when: all(is('the-wall-burns', 'done'), until('the-gloam-gate')) },
      // besieged and breached: the Host's banners on its lines, smoke and fire on the walls by the Breach
      { near: 'legion-lines', dx: 0, dy: -3, marker: { kind: 'prop', prop: 'skull-banner' }, when: until('general-morvain') },
      { near: 'bone-batteries', dx: 2, dy: -2, marker: { kind: 'prop', prop: 'skull-banner' }, when: until('general-morvain') },
      ...[-6, -2, 3, 7].map((dx, i) => ({ near: 'the-breach', dx, dy: -6 + (i % 2), marker: { kind: 'fire' as const, size: 2 + (i % 2) }, when: BREACHED })),
      { near: 'the-breach', dx: -3, dy: -2, marker: { kind: 'wisp', color: '#8a8a9a', size: 2 }, when: BESIEGED },
      { near: 'the-breach', dx: 4, dy: -3, marker: { kind: 'wisp', color: '#7a7a8a', size: 2 }, when: BESIEGED },
      // liberated: the Crown's banners on the Breach and the garrison camped beside the relief
      { near: 'the-breach', dx: -2, dy: 3, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('general-morvain') },
      { near: 'the-breach', dx: 3, dy: 3, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('general-morvain') },
      { near: 'hub', dx: -7, dy: 3, marker: { kind: 'prop', prop: 'tent' }, when: after('general-morvain') },
      { near: 'hub', dx: -9, dy: -1, marker: { kind: 'prop', prop: 'tent' }, when: after('general-morvain') },
      // Nyx walks back into the camp under a white rag (Act IV), and stays until the second Gate
      { near: 'hub', marker: { kind: 'place', id: 'relief-camp' } },
      { near: 'hub', dx: 18, dy: 2, marker: { kind: 'place', id: 'relief-road' } },
      { near: 'hub', dx: -2, dy: 4, marker: { kind: 'place', id: 'relief-tents' } },
      { near: 'hub', dx: -3, dy: 4, marker: { kind: 'npc', npc: 'nyx-returned' }, when: all(is('gate-nyx-returns', 'done'), until('gloam-the-lamp-road')) },
      // relieved: the Ninefold flag and the Crown's banners over the camp
      { near: 'hub', dx: -3, dy: -5, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('general-morvain') },
      { near: 'hub', dx: 3, dy: -5, marker: { kind: 'prop', prop: 'flag' }, when: after('general-morvain') },
      { near: 'hub', dx: 0, dy: -6, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('cael-the-sortie') },
    ],
  },
);
