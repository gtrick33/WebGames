import type { Art, Pal } from '../../artdata';
import { CREATURE_ART } from '../../artdata';
import type { ZoneArt } from '.';
import { RIFTSCAR_ART } from './riftscar';

/** One drawing in another's colors (the dungeon arts' way: recolors of the approved art). */
const recolor = (base: Art, pal: Pal): Art => ({ pal: { ...base.pal, ...pal }, frames: base.frames });

/** The finale's last shape and the postgame's Chancellor. */
export const FINALE_ART: ZoneArt = {
  foes: {
    // grey ash and borrowed summer, with seven empty points
    'the-ash-crown': recolor(RIFTSCAR_ART.foes['the-unmade']!, { p: '#e8e0c8', P: '#c8bc98', Q: '#8a8070', u: '#1a1820', n: '#3a3644', N: '#5a5664', m: '#7a7484', M: '#a8a2b0', r: '#ffe8a8', R: '#fff4d0', w: '#ffffff', c: '#ffd86a' }),
    // the Regent's oldest counsellor, ash-gold grown over his hands
    'maelis-crane': recolor(CREATURE_ART.morgrave!, { p: '#2a2430', P: '#1a1620', k: '#3a3040', e: '#e8d8a8', E: '#fff4d0', g: '#c8c4a8', w: '#e8dcc0', s: '#8a8270', o: '#c8c4a8', O: '#f0ecd8', r: '#c8a850', v: '#4a4458' }),
  },
  looks: {},
};
