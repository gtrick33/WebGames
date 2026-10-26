import type { StoryEventDef } from './types';
import { BRIARHOLLOW_EVENTS } from './zones/briarhollow';

/** Every story event (raids, defenses, rescues) by id: quests name them in an `event` objective. */
export const EVENTS: Record<string, StoryEventDef> = { ...BRIARHOLLOW_EVENTS };
