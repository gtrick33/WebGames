/**
 * The Whatsit bank: 14 themes of 16 things. The daily goes through the themes in this order, one a day,
 * so neighboring days never share a theme. Add new themes at the end.
 */
import { ANIMALS, BUGS, PLANTS, SEA, SPACE, WEATHER } from './nature';
import { CLOTHES, FOOD, GADGETS, INSTRUMENTS, KITCHEN, SPORTS, TOYS, VEHICLES } from './things';
import { toTheme, type Theme, type Thing } from './types';

export type { Question, Theme, Thing } from './types';

export const THEMES: Theme[] = [INSTRUMENTS, SEA, FOOD, SPACE, TOYS, ANIMALS, KITCHEN, WEATHER, SPORTS, BUGS, GADGETS, PLANTS, CLOTHES, VEHICLES].map(toTheme);

const BY_THEME = new Map(THEMES.map((t) => [t.id, t]));
const BY_THING = new Map(THEMES.flatMap((t) => t.things.map((x) => [x.id, x] as const)));

export const themeById = (id: string): Theme | undefined => BY_THEME.get(id);
export const thingById = (id: string): Thing | undefined => BY_THING.get(id);
