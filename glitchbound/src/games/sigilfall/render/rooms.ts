import type { Theme } from '../data/types';

/**
 * The light of each deep place (render3d/toon.ts roomLight): how dim its own air is and in what color (`amb`), the
 * color its fires throw on the stone round them (`fire`), the light along the edge of whoever moves in it (`rim`), and
 * the color of the dark at the edge of the view (`edge`, as "r,g,b"). A crypt is cold and its fires pale; a forge is
 * black and its fires red; the citadel is frozen blue with grieflight burning violet.
 */
export interface RoomLight {
  amb: readonly [number, number, number];
  fire: readonly [number, number, number];
  rim: readonly [number, number, number];
  edge: string;
}

export const ROOM: Partial<Record<Theme, RoomLight>> & { default: RoomLight } = {
  default: { amb: [0.56, 0.55, 0.64], fire: [1.0, 0.66, 0.34], rim: [0.6, 0.52, 0.4], edge: '8,6,14' },
  crypt: { amb: [0.5, 0.52, 0.68], fire: [0.52, 0.74, 1.0], rim: [0.42, 0.56, 0.78], edge: '6,6,18' },
  cave: { amb: [0.54, 0.5, 0.5], fire: [1.0, 0.64, 0.3], rim: [0.62, 0.5, 0.36], edge: '10,7,5' },
  cistern: { amb: [0.48, 0.58, 0.54], fire: [0.5, 0.95, 0.72], rim: [0.4, 0.66, 0.54], edge: '4,12,10' },
  keep: { amb: [0.56, 0.54, 0.6], fire: [1.0, 0.68, 0.36], rim: [0.62, 0.54, 0.42], edge: '8,7,12' },
  icecave: { amb: [0.56, 0.64, 0.8], fire: [0.5, 0.82, 1.0], rim: [0.5, 0.68, 0.86], edge: '5,10,20' },
  temple: { amb: [0.62, 0.56, 0.46], fire: [1.0, 0.76, 0.36], rim: [0.7, 0.58, 0.36], edge: '14,9,4' },
  lavacave: { amb: [0.5, 0.42, 0.44], fire: [1.0, 0.48, 0.2], rim: [0.76, 0.42, 0.24], edge: '14,4,2' },
  citadel: { amb: [0.5, 0.56, 0.78], fire: [0.72, 0.68, 1.0], rim: [0.52, 0.6, 0.9], edge: '6,7,22' },
  roots: { amb: [0.5, 0.56, 0.46], fire: [0.74, 0.92, 0.4], rim: [0.52, 0.64, 0.36], edge: '6,10,4' },
  riftspire: { amb: [0.54, 0.48, 0.7], fire: [0.86, 0.5, 1.0], rim: [0.64, 0.46, 0.84], edge: '12,5,20' },
};
