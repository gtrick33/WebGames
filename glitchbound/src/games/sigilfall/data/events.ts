import type { StoryEventDef } from './types';
import { AMBERFIELD_EVENTS } from './zones/amberfield-quests';
import { ASHEN_BARROWS_EVENTS } from './zones/ashen-barrows-quests';
import { BRACKENRIDGE_EVENTS } from './zones/brackenridge-quests';
import { BRIARHOLLOW_EVENTS } from './zones/briarhollow';
import { DUSKFEN_EVENTS } from './zones/duskfen-quests';
import { EMBERWICK_EVENTS } from './zones/emberwick-story';
import { GREYFEN_EVENTS } from './zones/greyfen-quests';
import { IRONPEAK_EVENTS } from './zones/ironpeak-quests';
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
  ...DUSKFEN_EVENTS,
  ...IRONPEAK_EVENTS,
  ...ASHEN_BARROWS_EVENTS,
  ...EMBERWICK_EVENTS,
};
