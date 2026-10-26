import type { StoryCond } from './types';

/** Story conditions, briefly (markers' and states' `when`: STORY_BIBLE.md §4). */
export const is = (quest: string, state: 'offered' | 'active' | 'done' | 'started' | 'locked' | 'taken'): StoryCond => ({ quest, is: state });
export const not = (c: StoryCond): StoryCond => ({ not: c });
export const any = (...c: StoryCond[]): StoryCond => ({ any: c });
export const all = (...c: StoryCond[]): StoryCond => ({ all: c });
/** While any of these quests is the one being played. */
export const during = (...quests: string[]): StoryCond => any(...quests.map((q) => is(q, 'active')));
/** Once this quest is finished. */
export const after = (quest: string): StoryCond => is(quest, 'done');
/** Until this quest is finished. */
export const until = (quest: string): StoryCond => not(is(quest, 'done'));
