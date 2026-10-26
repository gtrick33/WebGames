import type { Art, Pal } from '../../artdata';
import { CREATURE_ART } from '../../artdata';
import type { ZoneArt } from '.';
import { HIGHWALL_ART } from './highwall';
import { RIFTSCAR_ART } from './riftscar';
import { SHATTERED_VALE_ART } from './shattered-vale';

/** One drawing in another's colors: the Spire's guard in black glass and the Tear's light. */
const recolor = (base: Art, pal: Pal): Art => ({ pal: { ...base.pal, ...pal }, frames: base.frames });

const V = SHATTERED_VALE_ART.foes;

/** The Spire of the Tear: its bosses and enemies. */
export const SPIRE_OF_THE_RIFT_ART: ZoneArt = {
  foes: {
    // the Herald's guard in armor of black glass
    'spire-lancer': recolor(HIGHWALL_ART.foes['legion-soldier']!, { w: '#2a2238', W: '#3e3450', B: '#544a6a', c: '#8a6ad8', C: '#5a3e9a', D: '#2e1e52', g: '#c58cff', G: '#f4e4ff', m: '#d8d0f0', M: '#9a8ec0', n: '#5a4e80', l: '#4a3a6a', L: '#2e2248' }),
    // pale-masked singers who carry his voice
    'spire-cantor': recolor(RIFTSCAR_ART.foes['pale-acolyte']!, { w: '#f4f0fa', r: '#c58cff', R: '#e8d0ff', d: '#f0eaf8' }),
    // caught halfway through the Veil
    'spire-halfborn': recolor(V['rift-stalker']!, { g: '#ffffff', G: '#d8c8ff', H: '#8a6ad8', s: '#3a2a5a', S: '#24183e', e: '#9affff' }),
    // a spike of Veil-crystal through the floor
    'spire-anchor': recolor(V['shard-golem']!, { p: '#c8a8f0', P: '#8a62c8', Q: '#5a3a90', q: '#2a1850', c: '#ffffff', C: '#c8b0ff', r: '#9affff', R: '#e0f8ff' }),
    // a spark of the Tear
    'spire-mote': recolor(V['rift-shardling']!, { p: '#ffffff', P: '#e0f8ff', Q: '#9affff', q: '#30c8e8', c: '#f0c4ff', C: '#c27ef0', r: '#ffffff' }),
    // his shape in glass and light
    'spire-echo': recolor(V.voidcaller!, { v: '#e8e4f4', V: '#b8b0d8', X: '#7a70a8', t: '#ffffff', s: '#f0eaf8', S: '#c8c0e0', o: '#3a2a5a', O: '#c58cff', p: '#ffffff' }),
    // black glass older than the Spire, with a heart of grieflight
    'veil-sentinel': recolor(V['the-tearborn']!, { n: '#1a1428', N: '#2e2444', m: '#4a3a6a', p: '#e0d8ff', P: '#a890e0', Q: '#6a50a8', q: '#3a2870', c: '#ffffff', C: '#c8b0ff', r: '#c58cff', R: '#f0e0ff', w: '#ffffff', e: '#ffffff' }),
    // a tall man in white with nothing where his face should be
    'herald-in-the-spire': recolor(CREATURE_ART.morgrave!, { p: '#f2eefa', P: '#c8c2d8', k: '#d8d4e4', e: '#d8d4e4', E: '#f0e8ff', g: '#e8e4f0', w: '#d8d4e4', s: '#e0dcea', o: '#c58cff', O: '#f4e4ff', r: '#c58cff', v: '#e8e4f0' }),
  },
  looks: {},
};
