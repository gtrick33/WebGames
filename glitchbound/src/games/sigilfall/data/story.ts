import { isRetired } from './retired';
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
    text: 'Dawn over a village half burned. Elyra carries the fragment of the Starlight Crown inside her now, the mark of the Ashen Host is painted on the crypt wall, and you still carry a dead courier’s broken seal. Elder Maren must hear it all.',
    objective: { kind: 'talk', npc: 'maren', label: 'Tell Elder Maren what was under the chapel' },
    after: ['close-the-rift'],
    reward: { xp: 900, gold: 150, unlock: 'whisperwood', text: 'Briarhollow will not run. It will gather the Vale: every village that holds is one more wall. The north road into the Whisperwood is open.' },
  },
  /* --------------------------------------------- Act I: The Villages of the Vale */
  {
    id: 'hollow-gold',
    name: 'Ash-Gold',
    giver: 'reeve-aldous',
    zone: 'thornvale',
    text: 'Harlan’s strongbox was full of coins no mint ever struck: grey, weightless, always cold, stamped with an empty crown. Ash-gold: the Host pays its traitors in it. Elder Maren must see it, and Millbrook’s grain carts can follow you to Briarhollow.',
    objective: { kind: 'talk', npc: 'maren', label: 'Bring the ash-gold to Elder Maren' },
    after: ['mill-the-bridge'],
    reward: { xp: 1500, gold: 200, text: 'Maren weighs a coin on her palm: nothing. “The Host buys traitors with this,” she says. “Then it has been buying them here.”' },
  },
  {
    id: 'camp-grain',
    name: 'Grain for Briarhollow',
    giver: 'reeve-aldous',
    auto: true,
    text: 'The mill road is free and Reeve Aldous keeps his promise: Millbrook’s grain carts are coming up the south road to Briarhollow. Meet them in the square.',
    objective: { kind: 'event', event: 'camp-grain', label: 'Meet Millbrook’s grain carts in Briarhollow' },
    after: ['hollow-gold'],
    zone: 'briarhollow',
    reward: { xp: 300, gold: 80, text: 'Twelve carts of grain in the camp, and Tobin’s hens. Briarhollow will eat this winter.' },
  },
  {
    id: 'the-regents-council',
    name: 'The Courier’s Letter',
    giver: 'maren',
    text: 'Fernstead’s rangers and Millbrook’s grain have reached the camp, and the square is full of people who were strangers a month ago. Maren has dried Oskar Fell’s letter by the fire at last and wants you to hear it.',
    objective: { kind: 'talk', npc: 'maren', label: 'Hear the courier’s letter at Briarhollow' },
    after: ['camp-grain'],
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
    text: 'Saltbeard’s grieflight powder was bound north, for ships crewed by the drowned: the Drowned Priestess was calling them up out of the cove for the Ashen Host, and the tide you held was only their first try. Gullport’s forge will go to Briarhollow; Maren must hear what is coming by sea.',
    objective: { kind: 'talk', npc: 'maren', label: 'Warn Elder Maren of the drowned fleet' },
    after: ['gull-the-slip'],
    reward: {
      xp: 2400,
      gold: 300,
      perk: 'sigil-tides',
      text: 'Quill sent a second sliver of star-iron with you, pried from the Priestess’s altar. Elyra holds it and goes very still. Two of seven.',
    },
  },
  {
    id: 'camp-smiths',
    name: 'A Forge for Briarhollow',
    giver: 'harbormaster-quill',
    auto: true,
    text: 'Gullport sends what it has: a smith, her apprentices, her forge on a cart, and a second cart of powder kegs that everyone walks around. Meet them in Briarhollow.',
    objective: { kind: 'event', event: 'camp-smiths', label: 'Meet Gullport’s smiths in Briarhollow' },
    after: ['the-drowned-fleet'],
    zone: 'briarhollow',
    reward: { xp: 400, gold: 100, text: 'Two forges ring in Briarhollow now. The camp is starting to sound like an army.' },
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
    text: 'General Morvain is dead in the rubble of Highwall’s inner ward, and his half of the Ashen Host is breaking up into the snow. The first of the Three Gates is ours. Mara commanded the relief. She should hear it from you.',
    objective: { kind: 'talk', npc: 'captain-mara', label: 'Tell Mara that Highwall holds' },
    after: ['general-morvain'],
    reward: {
      xp: 30000,
      gold: 2400,
      item: { rarity: 'epic' },
      text: 'Mara hears it with her helmet still on, and then takes it off and sits down on a barrel for a long time. “One gate,” she says. “Nyx’s map says Elyra is behind the next. Go and get her.”',
    },
  },
  {
    id: 'the-third-gate',
    name: 'The Third Gate',
    giver: 'mara-at-the-muster',
    auto: true,
    zone: 'bonefields',
    text: 'The Bone Colossus is a field of bones, the Muster Hall is burning, and the army that meant to march behind it is scattered over the plain. Highwall, the Gloam Gate, the Muster Hall: the three fortresses the Sigil-wardens buried the road under are the Crown’s again. Mara wants the Regent to hear it from you, and she wants to be standing next to you when she does.',
    objective: { kind: 'talk', npc: 'regent-elowen', label: 'Tell the Regent that the Three Gates are taken' },
    after: ['the-bone-colossus'],
    level: 50,
    reward: {
      xp: 12000,
      gold: 2600,
      item: { rarity: 'epic' },
      text: 'The Regent hears it standing, in the market that is a muster ground now, with smiths working behind her through the night. “Three gates,” she says. “And past them his country, and in it the last two sigils, and him.” She looks at Mara, and then at you. “Go and get them before he does.”',
    },
  },
  /* --------------------------------------------- Act V: The Dead Kingdom */
  {
    id: 'into-vaelmoor',
    name: 'Into Vaelmoor',
    giver: 'elyra-lastlight',
    auto: true,
    text: 'North of the Gloam Gate the road goes on into Vaelmoor, the Dead Kingdom, where no living person has walked in three hundred years. Brother Orren went through the Gate the morning it was taken, alone, with his lantern; he left a note for you with Brin at Lastlight that says only “Candlewick. Come and see.” The road through the Gate to the Weeping Woods is open.',
    objective: { kind: 'talk', npc: 'orren-in-vaelmoor', label: 'Find Brother Orren at Candlewick in the Weeping Woods' },
    after: ['the-gloam-gate'],
    reward: { xp: 4000, gold: 600, text: 'Candlewick is a village of Vaelmoor that died three hundred years ago in the middle of an ordinary evening. Nobody told it. Orren has been sitting in its square for two days, watching it not know.' },
  },
  {
    id: 'the-seventh-sigil',
    name: 'The Empty Scarf',
    giver: 'mara-at-the-reach',
    auto: true,
    text: 'Vosk is dust in the snow, and in his saddlebag, folded small in a refugee child’s scarf, there is nothing at all. The Sigil of Stone he took from the shrine by Hearthstead’s well the night the ram burned went north long ago, to the king he served. Six sigils came north with Elyra. She will know where the seventh is. Bring her the scarf.',
    objective: { kind: 'talk', npc: 'elyra-at-the-reach', label: 'Bring Vosk’s empty scarf to Elyra at Dawn’s Rest' },
    after: ['march-vosk'],
    level: 57,
    reward: {
      xp: 16000,
      gold: 3000,
      item: { rarity: 'epic' },
      text: 'Elyra holds the empty scarf a long time. Then she turns and looks north, up the long white slope to Duskspire, as if she can see through its walls. “It’s up there. On his brow,” she says. “He set it in the Crown: one star of seven, lit. I can feel it from here, cold as a well in winter.” She folds the scarf and puts it inside her coat. “Six, then. We go up, and we take the seventh off his head.”',
    },
  },
  /* --------------------------------------------- Epilogue */
  {
    id: 'epilogue-the-camp-goes-home',
    name: 'The Camp Goes Home',
    giver: 'maren',
    auto: true,
    zone: 'briarhollow',
    text: 'It is over. The portal out of the Crown’s memory set you down at Briarhollow’s gate at dawn, and the camp is already taking itself apart: Hollis’s rangers rolling tents, Millbrook’s carts loaded for the south road, Dunmore’s riders saddling for the steppe, and Fernstead’s people already arguing about whose orchard is whose. Every village the hero saved is going home. Stand in the square and see them off.',
    objective: { kind: 'event', event: 'epilogue-the-camp', label: 'See the camp off from Briarhollow’s square' },
    after: ['crownfall-the-ash-crown'],
    level: 60,
    reward: { xp: 2000, gold: 1000, text: 'The last cart goes down the south road with Tobin’s hens on top of it, complaining. Briarhollow is a village again. It is very quiet. Somebody has already started mending the inn’s roof.' },
  },
  {
    id: 'epilogue-the-bell',
    name: 'The Bell',
    giver: 'maren',
    auto: true,
    zone: 'briarhollow',
    text: 'Old Haldor has been standing under the chapel bell since dawn with his hand on the rope. The bell stopped the night his grandson vanished, months ago, and he swore he would ring it himself when it was over. It is over. Go and stand with him.',
    objective: { kind: 'talk', npc: 'old-haldor', label: 'Stand with Old Haldor at the chapel bell' },
    after: ['epilogue-the-camp-goes-home'],
    level: 60,
    reward: {
      xp: 3000,
      gold: 1500,
      item: { rarity: 'legendary' },
      tier: 2,
      text: 'Haldor rings it. Once for the dead, once for the living, and then he keeps on ringing because his arms remember how. All over the Vale people stop what they are doing and look up. Heroic and Mythic are open everywhere now, and the realm has a few loose threads left for whoever wants them.',
    },
  },
  /* --------------------------------------------- Postgame */
  {
    id: 'postgame-crownfall-heroic',
    name: 'Crownfall, Again',
    giver: 'maren',
    zone: 'briarhollow',
    text: 'The Ash Crown is broken, but grief does not keep to the rules of a story: Duskspire stands, colder and stronger, and what is left of its guard has not heard the news. Clear Duskspire on Heroic, the Hallow King and all, and the camp’s riders say a horse is waiting for you in his own stable.',
    objective: { kind: 'clear', region: 'duskspire', tier: 1, label: 'Clear Duskspire on Heroic' },
    after: ['epilogue-the-bell'],
    level: 60,
    reward: { xp: 8000, gold: 3000, item: { rarity: 'legendary' }, text: 'In Duskspire’s stable a black horse in starlit barding stands waiting, as if it had been told. The Crownfall Destrier is yours once the memory is cleared on Heroic too.' },
  },
  {
    id: 'postgame-crownfall-mythic',
    name: 'The Last King’s Hardest Hour',
    giver: 'maren',
    zone: 'briarhollow',
    text: 'At Mythic, Duskspire is what it would have been if the hero had come a year later. Clear it there. Nobody will ever ask you to, which is exactly why some people will.',
    objective: { kind: 'clear', region: 'duskspire', tier: 2, label: 'Clear Duskspire on Mythic' },
    after: ['postgame-crownfall-heroic'],
    level: 60,
    reward: { xp: 12000, gold: 5000, item: 'glitch-shard', keystone: 1, text: 'The bell in Briarhollow rings on its own that night, once. Haldor says it was the wind. Haldor is lying. In the morning there is a stone on its rope, warm as a hand, with the Tear still turning in it: a Riftstone. Riftstone +1, and every dungeon in the Vale again, against the clock.' },
  },
];

// (the spine's beats in a retired land, and the camp's arrivals that came from one, are gone with it: data/retired.ts)
for (let i = STORY_QUESTS.length - 1; i >= 0; i--) {
  const q = STORY_QUESTS[i]!;
  if ((q.zone && isRetired(q.zone)) || q.id === 'camp-smiths') STORY_QUESTS.splice(i, 1);
}
