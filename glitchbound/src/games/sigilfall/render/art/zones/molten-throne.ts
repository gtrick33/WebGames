import type { Art, Pal } from '../../artdata';
import type { ZoneArt } from '.';
import { DEEPFORGE_HALLS_ART } from './deepforge-halls';
import { EMBERDEEP_ART } from './emberdeep';
import { SHATTERED_VALE_ART } from './shattered-vale';
import { TOMB_OF_THE_SUN_KING_ART } from './tomb-of-the-sun-king';

/** One drawing in another's colors: the Throne's halls are the caldera's own, chained and branded. */
const recolor = (base: Art, pal: Pal): Art => ({ pal: { ...base.pal, ...pal }, frames: base.frames });

const E = EMBERDEEP_ART.foes;

/** The Molten Throne: its bosses and enemies. */
export const MOLTEN_THRONE_ART: ZoneArt = {
  foes: {
    // a dead slave-driver in a bone-steel mask
    'legion-overseer': recolor(E['legion-flamecaller']!, { c: '#4a4044', C: '#342c30', D: '#221c20', g: '#ff9a3d', G: '#ffd84d', p: '#6a6a76', P: '#44444e' }),
    // Ashkar's fire-folk, collared and mad with his pain
    'chained-emberkin': recolor(E['cinder-imp']!, { h: '#7a6a64', a: '#4a3a38', o: '#ff7a1e', F: '#ffcf4a' }),
    // a sorcerer drawing pale fire out of the chained lord
    'legion-pyrebinder': recolor(E['legion-flamecaller']!, { f: '#f4e8ff', F: '#d8c8ff', o: '#b890ff', O: '#8a5ad8', R: '#5a3a9a' }),
    // fire with a body and a spear
    'ashkar-cinderguard': recolor(E['fire-elemental']!, { f: '#ffe0a0', F: '#ffb04d', o: '#e8741e', O: '#b8401a', R: '#7a2010', k: '#2a0a04' }),
    // molten stone in a frame of bone-steel
    'magma-sentry': recolor(SHATTERED_VALE_ART.foes['shard-golem']!, { p: '#ffcf4a', P: '#ff7a1e', Q: '#b8361a', q: '#5a2a1a', c: '#ffe8a0', C: '#e8a040', r: '#fff4b0', R: '#ffd24a', e: '#ffffff' }),
    // a staple of bone-steel holding one of the chains
    'throne-chain': recolor(SHATTERED_VALE_ART.foes['rift-shardling']!, { p: '#a8acb8', P: '#7a7e8a', Q: '#545866', q: '#2e3240', c: '#ff9a3d', C: '#e8541e', r: '#ffd84d' }),
    // the setting for the seven sigils, burning pale on the anvil
    'the-pale-crown': recolor(SHATTERED_VALE_ART.foes['rift-shardling']!, { p: '#f4f0fa', P: '#d8d0e8', Q: '#a89cc0', q: '#6a5a8a', c: '#ffffff', C: '#e0d8ff', r: '#c8a0ff' }),
    // bone-steel for a frame and the mountain's fire for a heart
    'magma-warden': recolor(DEEPFORGE_HALLS_ART.foes['slag-colossus']!, { s: '#3a2a2a', S: '#5a3e30', l: '#8a6a52', r: '#e8541e', o: '#ff9a3d', y: '#fff2a0', b: '#d8d0c0', i: '#9a7a6a' }),
    // the Host's founder: bone-white, the anvil on her back, her hammer and crucible white-hot
    'ossa-the-founder': recolor(DEEPFORGE_HALLS_ART.foes['the-runewarden']!, { a: '#e8dcc8', A: '#fff8e8', S: '#d8ccb4', s: '#8a8070', e: '#ff9a3d', g: '#5a5660', G: '#8a8690', r: '#ffb060', u: '#ff7a2a' }),
    // the fire lord on his own throne, in chains
    'ashkar-the-bound': recolor(TOMB_OF_THE_SUN_KING_ART.foes['the-sun-king']!, { y: '#ff9a3d', Y: '#e8541e', z: '#8a2a12', h: '#fff2a0', l: '#3a2a2a', L: '#241a1a', e: '#fff4b0', w: '#e8c8a0', W: '#b88a60', V: '#7a5a3a', r: '#ff7a1e', R: '#b8361a', c: '#5a2a1a', C: '#3a1a10', o: '#ffd84d', s: '#c87a3a' }),
  },
  looks: {},
};
