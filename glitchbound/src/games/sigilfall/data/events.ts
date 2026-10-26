import type { StoryEventDef } from './types';
import { AMBERFIELD_EVENTS } from './zones/amberfield-quests';
import { BRACKENRIDGE_EVENTS } from './zones/brackenridge-quests';
import { BRIARHOLLOW_EVENTS } from './zones/briarhollow';
import { GREYFEN_EVENTS } from './zones/greyfen-quests';
import { SALTMARSH_EVENTS } from './zones/saltmarsh-quests';
import { THORNVALE_EVENTS } from './zones/thornvale-quests';

/** Every story event (raids, defenses, rescues, arrivals) by id: quests name them in an `event` objective. */
export const EVENTS: Record<string, StoryEventDef> = {
  ...BRIARHOLLOW_EVENTS,
  ...BRACKENRIDGE_EVENTS,
  ...THORNVALE_EVENTS,
  ...GREYFEN_EVENTS,
  ...SALTMARSH_EVENTS,
  ...AMBERFIELD_EVENTS,
};
