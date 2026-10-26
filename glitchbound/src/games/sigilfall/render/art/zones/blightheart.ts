import type { ZoneArt } from '.';

const BOX = (w: number, h: number): string[] => Array.from({ length: h }, () => 'a'.repeat(w));

/** Blightheart: its bosses and enemies. */
export const BLIGHTHEART_ART: ZoneArt = {
  foes: {
    'heartrot-treant': { pal: { a: '#6a4a2a' }, frames: [BOX(16, 18), BOX(16, 18)] },
    'thorn-court-knight': { pal: { a: '#5a6a3a' }, frames: [BOX(15, 16), BOX(15, 16)] },
    'thorn-court-sprite': { pal: { a: '#ff6ac8' }, frames: [BOX(13, 13), BOX(13, 13)] },
    'briar-lasher': { pal: { a: '#8ac04a' }, frames: [BOX(15, 15), BOX(15, 15)] },
    'rotbloom-matron': { pal: { a: '#c84a8a' }, frames: [BOX(14, 17), BOX(14, 17)] },
    'rotwood-pod': { pal: { a: '#b6e36b' }, frames: [BOX(11, 11), BOX(11, 11)] },
    'rotwood-colossus': { pal: { a: '#6a4a2a' }, frames: [BOX(30, 28), BOX(30, 28)] },
    'the-withered-queen': { pal: { a: '#e86ab0' }, frames: [BOX(24, 28), BOX(24, 28)] },
    'the-withered-queen-withered': { pal: { a: '#8a6a7a' }, frames: [BOX(24, 28), BOX(24, 28)] },
  },
  looks: {},
};
