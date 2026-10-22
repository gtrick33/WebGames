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
    id: 'the-regents-council',
    name: 'The Regent’s Council',
    giver: 'maren',
    text: 'Hollow gold in a bandit’s strongbox, ghouls made in a marsh, an empty tomb under the Whisperwood: Elder Maren has heard enough. The Regent has called her council to the keep, and she wants you there to tell it what you have seen.',
    objective: { kind: 'talk', npc: 'regent-elowen', label: 'Go to Regent Elowen in the keep' },
    after: ['hollow-gold', 'the-ghoul-mother'],
    reward: {
      xp: 2600,
      gold: 300,
      perk: 'sigil-embers',
      text: 'The Regent names the enemy: Vaelor, the Hollow King, raising a Legion of the dead to take back his kingdom. She gives you the Sigil of Embers from the temple vault. Six more are out in the world, and he wants them all.',
    },
  },
  {
    id: 'the-drowned-fleet',
    name: 'The Drowned Fleet',
    giver: 'harbormaster-quill',
    zone: 'saltmarsh',
    text: 'Saltbeard’s powder was bound north, for ships that sail with drowned crews. The Drowned Priestess was raising them for the Hollow King. Quill wants Emberwick to know: the Legion has a fleet.',
    objective: { kind: 'talk', npc: 'maren', label: 'Warn Elder Maren of the drowned fleet' },
    after: ['captain-saltbeard'],
    reward: {
      xp: 2400,
      gold: 300,
      perk: 'sigil-tides',
      text: 'Maren unwraps what Quill sent with you: the Sigil of Tides, pulled from the Priestess’s altar. The Legion is gathering on land and sea. The war has begun, whether the kingdoms know it or not.',
    },
  },
  /* --------------------------------------------------- Act II: The Tide of Bones */
  {
    id: 'the-kings-design',
    name: 'The King’s Design',
    giver: 'regent-elowen',
    text: 'Sir Corvane carried a map under his breastplate, drawn in a hand three hundred years old: seven marks across the world, and beside each the name of a sigil. The Hollow King is not only raising an army. He is hunting the sigils. The Regent must see it.',
    objective: { kind: 'talk', npc: 'regent-elowen', label: 'Bring Corvane’s map to the Regent' },
    after: ['sir-corvane'],
    reward: {
      xp: 9000,
      gold: 800,
      item: { rarity: 'rare' },
      text: 'The Regent spreads the map on her council table. Three marks are already in your hands. Four are not, and the Legion is marching on every one of them.',
    },
  },
];
