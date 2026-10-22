import type { Art } from '../../artdata';
import type { HeroLook } from '../hero';

/**
 * Each zone's art: its enemies (text art, like the creatures) and how its townsfolk dress. Adding a
 * zone's art is a file in this folder and a line here.
 */
export interface ZoneArt {
  foes: Record<string, Art>;
  looks: Record<string, HeroLook>;
}

export const ZONE_ART: ZoneArt[] = [];
