import type { QuestDef } from './types';

/**
 * The spine of *The Crown of Ash and Starlight* (STORY_BIBLE.md): the quests that join the villages' and
 * zones' own chains into one tale, given at its turning points. Ids are the old story's (saves keep them);
 * everything said is the new story's.
 */
export const STORY_QUESTS: QuestDef[] = [
  /* --------------------------------------------- Prologue: The Night the Bells Stopped */
  {
    id: 'the-empty-tomb',
    name: 'Dawn in Briarhollow',
    giver: 'elyra',
    auto: true,
    zone: 'briarhollow',
    text: 'Dawn over a village half burned. Elyra carries the fragment of the Starlight Crown inside her now, and the mark of the Ashen Host is painted on the crypt wall. Elder Maren must hear it all.',
    objective: { kind: 'talk', npc: 'maren', label: 'Tell Elder Maren what was under the chapel' },
    after: ['close-the-rift'],
    reward: { xp: 900, gold: 150, text: 'Briarhollow will not run. It will gather the Vale: every village that holds is one more wall.' },
  },
  /* --------------------------------------------- Act I: The Villages of the Vale */
  {
    id: 'hollow-gold',
    name: 'Ash-Gold',
    giver: 'reeve-aldous',
    zone: 'thornvale',
    text: 'Varric’s strongbox was full of coins no mint ever struck: grey, weightless, always cold, stamped with a crown of grey hands. Ash-gold: the Host pays its traitors in it. Elder Maren must see it, and Millbrook’s grain carts can follow you to Briarhollow.',
    objective: { kind: 'talk', npc: 'maren', label: 'Bring the ash-gold to Elder Maren' },
    after: ['the-bandit-king'],
    reward: { xp: 1500, gold: 200, text: 'Millbrook’s grain is on the road to Briarhollow. The camp will eat this winter.' },
  },
  {
    id: 'the-regents-council',
    name: 'The Courier’s Letter',
    giver: 'maren',
    text: 'Fernstead’s scouts and Millbrook’s grain have reached the camp, and Reedwater’s healers are on their way. Maren has dried Oskar Fell’s letter by the fire at last and wants you to hear it.',
    objective: { kind: 'talk', npc: 'maren', label: 'Hear the courier’s letter at Briarhollow' },
    after: ['hollow-gold', 'the-ghoul-mother'],
    reward: {
      xp: 2600,
      gold: 300,
      text: 'The king’s couriers have been warning the Crown City for months that the Starlight Crown is being hunted. Every letter, lost. Someone in the city is burying them.',
    },
  },
  {
    id: 'the-drowned-fleet',
    name: 'Ships Out of the Grey',
    giver: 'harbormaster-quill',
    zone: 'saltmarsh',
    text: 'Saltbeard’s grieflight powder was bound north, for ships crewed by the drowned. The Drowned Priestess was calling them up out of the cove for the Ashen Host. Gullport’s forge and Ines’s boats will go to Briarhollow; Maren must hear what they are fleeing.',
    objective: { kind: 'talk', npc: 'maren', label: 'Warn Elder Maren of the drowned fleet' },
    after: ['captain-saltbeard'],
    reward: {
      xp: 2400,
      gold: 300,
      perk: 'sigil-tides',
      text: 'Quill sent a second sliver of star-iron with you, pried from the Priestess’s altar. Elyra holds it and goes very still. Two of seven.',
    },
  },
  /* --------------------------------------------- Act II: Road to the Crown City */
  {
    id: 'the-kings-design',
    name: 'The Countermanded Order',
    giver: 'sister-maud',
    zone: 'ashen-barrows',
    text: 'Dying, Sir Corvane put a paper in Cael Varrow’s hand: the relief order for the Ninefold Watch, ten years old, countermanded in the hand of the Lord Chancellor of Aster. The King’s Road to the Crown City is open. The Regent must see it before the Starfall Festival.',
    objective: { kind: 'talk', npc: 'regent-elowen', label: 'Bring the countermanded order to the Regent in the Crown City' },
    after: ['sir-corvane'],
    reward: {
      xp: 9000,
      gold: 800,
      item: { rarity: 'rare' },
      text: 'The Regent reads it twice, folds it, and asks you to stay for the festival. The Chancellor smiles at you across the hall.',
    },
  },
  /* --------------------------------------------- Act IV: War of the Three Gates */
  {
    id: 'the-long-night-ends',
    name: 'The First Gate',
    giver: 'lord-commander-varn',
    zone: 'highwall',
    text: 'General Morvain is dead in the rubble of Highwall’s inner ward, and his half of the Ashen Host is breaking up into the snow. The first of the Three Gates is ours. The Lord-Commander wants the Regent to hear it from the one who did it.',
    objective: { kind: 'talk', npc: 'regent-elowen', label: 'Tell the Regent that Highwall holds' },
    after: ['general-morvain'],
    reward: {
      xp: 30000,
      gold: 2400,
      item: { rarity: 'epic' },
      text: 'One gate of three. Beyond the other two lies Vaelmoor, the Dead Kingdom, and its Hallow King.',
    },
  },
];
