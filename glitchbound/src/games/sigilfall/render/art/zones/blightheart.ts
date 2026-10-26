import type { Art, Pal } from '../../artdata';
import { COMPANION_ART } from '../companions';
import type { ZoneArt } from '.';
import { BLIGHTWOOD_ART } from './blightwood';
import { DEEPFORGE_HALLS_ART } from './deepforge-halls';
import { GLIMMERWOOD_ART } from './glimmerwood';
import { ROTMOTHER_CISTERN_ART } from './rotmother-cistern';
import { SHATTERED_VALE_ART } from './shattered-vale';
import { WEEPING_WOODS_ART } from './weeping-woods';

/** One drawing in another's colors: the Blightheart's court is the Blightwood's own, gone further. */
const recolor = (base: Art, pal: Pal): Art => ({ pal: { ...base.pal, ...pal }, frames: base.frames });

const ROTWOOD: Pal = { s: '#4a3a2a', S: '#6a5236', l: '#8a7050', r: '#5a8a2a', o: '#8ac040', y: '#d8ff8a', b: '#c8b890', B: '#8a7a5a', i: '#6a8a4a', I: '#3e5a2e', e: '#ff6ac8', k: '#1e180e' };
const QUEEN: Pal = { s: '#c8a0c0', S: '#9a7090', D: '#6a4a66', l: '#f0d8ec', h: '#5a3a5a', H: '#3a2238', e: '#ff6ac8', g: '#b6e36b', G: '#7ab83a', y: '#e0ffa0', t: '#c83a8a', m: '#5a1a3a', b: '#ff9ad8', B: '#c84a8a', w: '#e8d8e0', o: '#8a6a4a', O: '#5a4630', k: '#3a5a1e' };

/** Blightheart: its bosses and enemies, drawn from the wood's own art in the colors of the rot. */
export const BLIGHTHEART_ART: ZoneArt = {
  foes: {
    // bark and rot, still walking
    'heartrot-treant': recolor(BLIGHTWOOD_ART.foes['blight-treant']!, { t: '#8a6a4a', T: '#5e4630', U: '#3a2a1e', u: '#22180e', g: '#b6e36b', e: '#ff6ac8' }),
    // the Queen's knights: bark-plate grown over with briar
    'thorn-court-knight': recolor(WEEPING_WOODS_ART.foes['revenant-knight']!, { m: '#7a8a4a', M: '#5a6a3a', n: '#3a4426', s: '#6a4a2a', S: '#4a3420', T: '#2e2014', w: '#c8d89a', g: '#ff6ac8', G: '#ffd0f0', x: '#9aa86a', X: '#6a7a46' }),
    // a fey of the court, gone the pink of the blight
    'thorn-court-sprite': recolor(GLIMMERWOOD_ART.foes.thornling!, { t: '#ff6ac8', T: '#c83a8a', U: '#7a2050', g: '#ffe0f4', G: '#ff9ad8', w: '#fff0fa', W: '#e8b0d8', p: '#ffc0e8' }),
    // a knot of briar rooted in the floor
    'briar-lasher': recolor(COMPANION_ART.treant!, { l: '#6a8a3a', L: '#4a6a2a', h: '#b6e36b', D: '#2e4a1e', b: '#5a4a2a', B: '#3a2e1a', c: '#8a6a3a', e: '#ff6ac8', f: '#ff9ad8' }),
    // a dryad the blight made into a garden
    'rotbloom-matron': recolor(GLIMMERWOOD_ART.foes['blighted-dryad']!, { l: '#c84a8a', L: '#8a2a5e', p: '#ff8ac8', g: '#ffd0e8', G: '#e87ab0', b: '#d8c8a0' }),
    'rotwood-pod': recolor(SHATTERED_VALE_ART.foes['rift-shardling']!, { p: '#d8ff8a', P: '#a8d860', Q: '#6a9a3a', q: '#3a5a1e', c: '#ff9ad8', C: '#e86ab0', r: '#ffe066' }),
    // a hill of heartwood that walks
    'rotwood-colossus': recolor(DEEPFORGE_HALLS_ART.foes['slag-colossus']!, ROTWOOD),
    // the Green Lady on her throne of thorns, and withered when the winter takes her
    'the-withered-queen': recolor(ROTMOTHER_CISTERN_ART.foes['the-rot-mother']!, QUEEN),
    'the-withered-queen-withered': recolor(ROTMOTHER_CISTERN_ART.foes['the-rot-mother']!, { ...QUEEN, s: '#8a8088', S: '#6a6068', D: '#4a4248', l: '#b8b0b4', e: '#a87a9a', g: '#8a9a6a', G: '#5a6a44', y: '#b0b89a', b: '#a89aa4', B: '#7a6a76', t: '#7a5a6a' }),
  },
  looks: {},
};
