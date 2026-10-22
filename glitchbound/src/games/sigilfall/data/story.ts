import type { QuestDef } from './types';

/**
 * The main story: the hunt for Vaelor, the Hollow King (see WORLD.md). These are the spine quests that
 * join the zones' own chains into one tale, given at the story's turning points. Each zone's main chain
 * ends by handing on to the next part of it.
 */
export const STORY_QUESTS: QuestDef[] = [
  /* --------------------------------------------------- Act I: The King Stirs */
  {
    id: 'the-empty-tomb',
    name: 'The Empty Tomb',
    giver: 'maren',
    text: 'Morgrave’s last words were not a curse. “Too late,” he said. “The King’s bed is empty.” Behind the sanctum you saw it: an open sarcophagus, and the dust of something that walked out of it. Tell Elder Maren.',
    objective: { kind: 'talk', npc: 'maren', label: 'Tell Elder Maren what you saw' },
    after: ['close-the-rift'],
    reward: { xp: 900, gold: 150, text: 'Maren speaks a name she hoped never to say: Vaelor, the Hollow King.' },
  },
  {
    id: 'hollow-gold',
    name: 'Hollow Gold',
    giver: 'reeve-aldous',
    zone: 'thornvale',
    text: 'Varric’s strongbox was full of coins no mint ever struck: grey, cold, stamped with an empty crown. His orders were signed by someone called the Pale Herald. Elder Maren will know what that crown means.',
    objective: { kind: 'talk', npc: 'maren', label: 'Show Varric’s gold to Elder Maren' },
    after: ['the-bandit-king'],
    reward: { xp: 1500, gold: 200, text: 'The Hollow King is buying the living. The Pale Herald pays his bills.' },
  },
  {
    id: 'the-drowned-fleet',
    name: 'The Drowned Fleet',
    giver: 'harbormaster-quill',
    zone: 'saltmarsh',
    text: 'Saltbeard’s powder was bound north, for ships that sail with drowned crews. The Drowned Priestess was raising them for the Hollow King. Quill wants Emberwick to know: the Legion has a fleet.',
    objective: { kind: 'talk', npc: 'maren', label: 'Warn Elder Maren of the drowned fleet' },
    after: ['captain-saltbeard'],
    reward: { xp: 2400, gold: 300, text: 'The Legion is gathering on land and sea. The war has begun, whether the kingdoms know it or not.' },
  },
];
