import type { StoryEventDef } from './types';
import { AMBERFIELD_EVENTS } from './zones/amberfield-quests';
import { ASHEN_BARROWS_EVENTS } from './zones/ashen-barrows-quests';
import { BRACKENRIDGE_EVENTS } from './zones/brackenridge-quests';
import { BONEFIELDS_EVENTS } from './zones/bonefields-quests';
import { BRIARHOLLOW_EVENTS } from './zones/briarhollow';
import { DUSKFEN_EVENTS } from './zones/duskfen-quests';
import { EMBERWICK_EVENTS } from './zones/emberwick-story';
import { GLIMMERWOOD_EVENTS } from './zones/glimmerwood-quests';
import { GLOAMHOLLOW_EVENTS } from './zones/gloamhollow-quests';
import { GREYFEN_EVENTS } from './zones/greyfen-quests';
import { HIGHWALL_EVENTS } from './zones/highwall-quests';
import { HOLLOWMERE_EVENTS } from './zones/hollowmere-quests';
import { PALE_REACH_EVENTS } from './zones/pale-reach-quests';
import { IRONPEAK_EVENTS } from './zones/ironpeak-quests';
import { RIMEHELD_EVENTS } from './zones/rimeheld-quests';
import { SALTMARSH_EVENTS } from './zones/saltmarsh-quests';
import { SHATTERED_VALE_EVENTS } from './zones/shattered-vale-quests';
import { SUNKEN_REACHES_EVENTS } from './zones/sunken-reaches-quests';
import { THORNVALE_EVENTS } from './zones/thornvale-quests';
import { WEEPING_WOODS_EVENTS } from './zones/weeping-woods-quests';

/** Every story event (raids, defenses, rescues, arrivals) by id: quests name them in an `event` objective. */
export const EVENTS: Record<string, StoryEventDef> = {
  ...BRIARHOLLOW_EVENTS,
  ...BRACKENRIDGE_EVENTS,
  ...THORNVALE_EVENTS,
  ...GREYFEN_EVENTS,
  ...SALTMARSH_EVENTS,
  ...RIMEHELD_EVENTS,
  ...AMBERFIELD_EVENTS,
  ...DUSKFEN_EVENTS,
  ...IRONPEAK_EVENTS,
  ...ASHEN_BARROWS_EVENTS,
  ...EMBERWICK_EVENTS,
  ...GLIMMERWOOD_EVENTS,
  ...SHATTERED_VALE_EVENTS,
  ...HIGHWALL_EVENTS,
  ...GLOAMHOLLOW_EVENTS,
  ...BONEFIELDS_EVENTS,
  ...WEEPING_WOODS_EVENTS,
  ...SUNKEN_REACHES_EVENTS,
  ...HOLLOWMERE_EVENTS,
  ...PALE_REACH_EVENTS,
};
