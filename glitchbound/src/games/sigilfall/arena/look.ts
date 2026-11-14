import { ABILITIES, superOf, type School } from './abilities';
import { TALENT_BY_ID } from './talents';

/** How something on a fighter, or crossing to one, is shown: its name, icon, color and school. */
export interface Look {
  name: string;
  icon: string;
  color: string;
  school: School;
}

/**
 * What an ability's or a talent's id looks like on screen. What a talent puts on someone (a quarry's mark, a scar, a
 * ward of morning, a wildfire) wears the talent's own icon in its class's colors (its super's), and an imp's spit is
 * drawn in them too.
 */
export function lookOf(id: string): Look | null {
  const ab = ABILITIES[id];
  if (ab) return ab;
  const t = TALENT_BY_ID[id];
  if (!t) return null;
  const sup = superOf(t.cls);
  return { name: t.name, icon: t.icon ?? sup.icon, color: sup.color, school: sup.school };
}
