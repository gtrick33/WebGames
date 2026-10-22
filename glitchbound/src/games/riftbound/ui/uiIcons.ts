import { paint, scaled } from '../render/pixel';

/** Pixel glyphs for the HUD buttons (bag, talents, quests, map, pause, gear, potion). */
const PAL = { k: '#1b1428', w: '#ffffff', y: '#ffcf5a', Y: '#b08a2a', b: '#a8784a', B: '#6a4424', r: '#ff5a7a', R: '#b8304a', p: '#d2a8ff', c: '#9be7ff', g: '#8be36b', s: '#ece6d4', S: '#b8b09a' };

const ART: Record<string, string[]> = {
  bag: ['....BB....', '...B..B...', '..bbbbbb..', '.bbbbbbbb.', '.bbyyyybb.', '.bbbybbbb.', '.bbbbbbbb.', '.bbbbbbbb.', '..BBBBBB..'],
  star: ['....y.....', '....y.....', '...yyy....', 'yyyyyyyyy.', '.yyyyyyy..', '..yyyyy...', '..yy.yy...', '.yy...yy..', '.y.....y..'],
  scroll: ['.ssssssss.', 'sSssssssS.', '.sSSSSSs..', '.sssssss..', '.sSSSSSs..', '.sssssss..', '.sSSSs.s..', 'Sssssssss.', '.SSSSSSSS.'],
  map: ['sss.sss.ss', 'sgs.ssy.ss', 'sgg.sSs.ss', 'sSs.sss.rs', 'sss.sSs.ss', 'sgs.sss.ss', 'sss.ss..ss'],
  pause: ['ww..ww', 'ww..ww', 'ww..ww', 'ww..ww', 'ww..ww', 'ww..ww', 'ww..ww'],
  gear: ['...ww...', '.w.ww.w.', '..wwww..', 'www..www', 'www..www', '..wwww..', '.w.ww.w.', '...ww...'],
  potion: ['..kkk..', '..sws..', '..sws..', '.swwws.', 'srrrrrs', 'srwrrrs', 'srrrrrs', 'srrrrrs', '.sssss.'],
  skills: ['pp...pp', 'pccpccp', '.pcccp.', '..pcp..', '.pcccp.', 'pccpccp', 'pp...pp'],
  hand: ['..ww....', '..ww....', '..wwww..', '..wwwwww', 'wwwwwwww', 'wwwwwww.', '.wwwwww.', '..wwww..'],
};

const cache = new Map<string, string>();

export function uiIcon(name: keyof typeof ART | string, scale = 3): string {
  const key = `${name}:${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = scaled(paint(ART[name] ?? ART.gear!, PAL), scale).toDataURL();
  cache.set(key, url);
  return url;
}
