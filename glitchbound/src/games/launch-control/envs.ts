/** The four strips: colors and what grows beside the track. Used by the 3D world and the style shop. */
export interface EnvDef {
  id: string;
  /** Sky at the top and at the horizon. */
  sky: [string, string];
  sun: { x: number; y: number; z: number; color: string; r: number } | null;
  far: 'mountains' | 'skyline' | 'peaks' | 'tents';
  farColor: string;
  farColor2: string;
  mid: 'cactus' | 'palm' | 'pine' | 'lantern';
  ground: string;
  verge: string;
  track: string;
  line: string;
  stand: string;
  /** Hemisphere light: sky and ground tints. */
  light: [string, string];
}

export const ENV_DEFS: Record<string, EnvDef> = {
  'e-desert': { id: 'e-desert', sky: ['#ff8c42', '#ffd166'], sun: { x: 260, y: 90, z: -200, color: '#fff3b0', r: 22 }, far: 'mountains', farColor: '#c4467a', farColor2: '#9a3a6a', mid: 'cactus', ground: '#f4a261', verge: '#e9c46a', track: '#4a4e69', line: '#ffffff', stand: '#ff6b6b', light: ['#fff1d6', '#e8a060'] },
  'e-harbor': { id: 'e-harbor', sky: ['#48cae4', '#caf0f8'], sun: { x: -120, y: 120, z: 240, color: '#ffffff', r: 16 }, far: 'skyline', farColor: '#5e60ce', farColor2: '#7678ed', mid: 'palm', ground: '#90e0ef', verge: '#f1d6a0', track: '#555b6e', line: '#ffffff', stand: '#ffb703', light: ['#ffffff', '#8ec5d6'] },
  'e-alpine': { id: 'e-alpine', sky: ['#3a86ff', '#bde0fe'], sun: { x: 220, y: 140, z: 180, color: '#ffffff', r: 16 }, far: 'peaks', farColor: '#8d99ae', farColor2: '#6c757d', mid: 'pine', ground: '#80b918', verge: '#55a630', track: '#3d405b', line: '#ffffff', stand: '#e63946', light: ['#ffffff', '#7fb069'] },
  'e-fair': { id: 'e-fair', sky: ['#5f0f40', '#ff8fab'], sun: { x: -180, y: 70, z: -220, color: '#fff1e6', r: 14 }, far: 'tents', farColor: '#9a031e', farColor2: '#f4a261', mid: 'lantern', ground: '#6a4c93', verge: '#9d4edd', track: '#3c2a4d', line: '#ffd6ff', stand: '#fb8500', light: ['#ffd0e0', '#7a4a9a'] },
};
