/** The four strips: all daylight under blue skies. Used by the 3D world and the style shop. */
export type Scenery = 'bay' | 'canyon' | 'alpine' | 'city';

export interface EnvDef {
  id: string;
  name: string;
  scenery: Scenery;
  /** Sky at the top and at the horizon. */
  sky: [string, string];
  sun: { x: number; y: number; z: number };
  ground: string;
  verge: string;
  track: string;
  line: string;
  stands: [string, string];
  far: string;
  far2: string;
  /** Hemisphere light: sky and ground tints. */
  light: [string, string];
  fog: string;
}

export const ENV_DEFS: Record<string, EnvDef> = {
  'e-bay': { id: 'e-bay', name: 'Palm Bay', scenery: 'bay', sky: ['#2f8dff', '#d6f1ff'], sun: { x: 180, y: 140, z: -120 }, ground: '#8fd16f', verge: '#b8e08a', track: '#4b4b55', line: '#ffffff', stands: ['#ff5a6c', '#3d5bff'], far: '#6aa0d8', far2: '#8fbfe8', light: ['#ffffff', '#9ec7a0'], fog: '#cfe9ff' },
  'e-canyon': { id: 'e-canyon', name: 'Red Canyon', scenery: 'canyon', sky: ['#3a8dff', '#e8f4ff'], sun: { x: 220, y: 130, z: 160 }, ground: '#e9b872', verge: '#d9a861', track: '#4e4a4f', line: '#ffffff', stands: ['#ff6a1a', '#12c6b3'], far: '#c8582a', far2: '#e07a3f', light: ['#ffffff', '#d9a56a'], fog: '#e8f0ff' },
  'e-alpine': { id: 'e-alpine', name: 'Alpine Pass', scenery: 'alpine', sky: ['#2b7fff', '#e3f2ff'], sun: { x: -160, y: 150, z: 140 }, ground: '#79c050', verge: '#5fae3a', track: '#454552', line: '#ffffff', stands: ['#e63946', '#ffd12e'], far: '#7a8aa6', far2: '#a5b4c9', light: ['#ffffff', '#86b86a'], fog: '#e3f2ff' },
  'e-city': { id: 'e-city', name: 'Downtown Mile', scenery: 'city', sky: ['#3f93ff', '#d9ecff'], sun: { x: 120, y: 160, z: 200 }, ground: '#8d93a3', verge: '#b7bcc8', track: '#45454e', line: '#ffffff', stands: ['#7b4dff', '#22e4ff'], far: '#5a6c9e', far2: '#7d8fc0', light: ['#ffffff', '#9aa0b3'], fog: '#dbe9ff' },
};
