import type { MountDef } from '../data/mounts';
import { hexRgb } from './kits';

/** Mount animals by body: a pale coat takes the mount's own color. */
export function mountSprite(m: MountDef): string {
  return m.body === 'horse' ? 'mount-horse' : m.body === 'deer' ? 'mount-deer' : m.body === 'boar' ? 'mount-boar' : 'mount-drake';
}

/** How tall each body stands, in world pixels. */
export const MOUNT_H: Record<string, number> = { horse: 46, deer: 46, boar: 34, drake: 56 };

/** How high the saddle is, in world pixels. */
export const SEAT: Record<string, number> = { horse: 27.5, deer: 26.5, boar: 21, drake: 30 };

/** A coat as a tint: light enough that a dark one still shows its shape. */
export const coatTint = (hex: string): [number, number, number] => {
  const [r, g, b] = hexRgb(hex);
  return [r * 0.82 + 0.18, g * 0.82 + 0.18, b * 0.82 + 0.18];
};
