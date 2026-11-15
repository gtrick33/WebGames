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
    text: 'It is dawn, and half of Briarhollow has burned. The sigil from the crypt is inside Elyra now, and the raiders left their mark on the crypt wall. You also have the dead courier’s letter. Go and tell Elder Maren everything.',
    objective: { kind: 'talk', npc: 'maren', label: 'Tell Elder Maren what was under the chapel' },
    after: ['close-the-rift'],
    reward: { xp: 900, gold: 150, unlock: 'whisperwood', text: 'Briarhollow will not run. Maren will ask the other villages of the Vale to stand with it against the Host, and she will dry the courier’s letter by the fire and read it. First, the north road through the Whisperwood must be made safe.' },
  },
  /* --------------------------------------------- Act I: The Villages of the Vale */
  {
    id: 'hollow-gold',
    name: 'Ash-Gold',
    giver: 'reeve-aldous',
    zone: 'thornvale',
    text: 'Harlan’s strongbox was full of strange grey coins. They weigh nothing and are always cold. Take one to Elder Maren in Briarhollow. She may know who pays in coins like these.',
    objective: { kind: 'talk', npc: 'maren', label: 'Show Harlan’s grey coins to Elder Maren in Briarhollow' },
    after: ['mill-the-bridge'],
    reward: { xp: 1500, gold: 200, text: 'Maren knows the coins from the old stories. They are ash-gold, the Ashen Host’s money. The Host paid the Gallows Gang to keep the Vale hungry and to hunt for sigils.' },
  },
  {
    id: 'camp-grain',
    name: 'Grain for Briarhollow',
    giver: 'reeve-aldous',
    auto: true,
    text: 'The mill is free, and Reeve Aldous keeps his promise. Millbrook’s grain carts are coming up the south road to Briarhollow. Meet them in the square.',
    objective: { kind: 'event', event: 'camp-grain', label: 'Meet Millbrook’s grain carts in Briarhollow' },
    after: ['hollow-gold'],
    zone: 'briarhollow',
    reward: { xp: 300, gold: 80, text: 'Twelve carts of grain reach the camp, along with Tobin’s hens. Briarhollow will have food this winter.' },
  },
  {
    id: 'the-regents-council',
    name: 'The Courier’s Letter',
    giver: 'maren',
    text: 'Fernstead’s rangers and Millbrook’s grain are in the camp now. Elder Maren has finally dried the dead courier’s letter and read it. She wants you to hear what it says.',
    objective: { kind: 'talk', npc: 'maren', label: 'Hear the courier’s letter from Elder Maren' },
    after: ['camp-grain'],
    reward: {
      xp: 2600,
      gold: 300,
      text: 'For months, the King’s couriers warned the Crown City that the sigils were being hunted. None of their letters were answered. Someone in the city is hiding them, so Maren won’t trust the city yet.',
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
    text: 'Corvane’s paper proves that Lord Chancellor Crane called off the help that could have saved the Ninefold Watch. Crane also runs Aster’s roads, and Vosk’s orders said the roads were paid for. Take the order west on the King’s Road to Emberwick, the Crown City, and give it to Regent Elowen.',
    objective: { kind: 'talk', npc: 'regent-elowen', label: 'Give Corvane’s order to Regent Elowen in Emberwick' },
    after: ['sir-corvane'],
    reward: {
      xp: 9000,
      gold: 800,
      item: { rarity: 'rare' },
      text: 'The Regent reads the order twice. It is in Crane’s handwriting, but Crane says it is a forgery. She can’t arrest the Lord Chancellor on one old paper, so she needs more proof.',
    },
  },
  /* --------------------------------------------- Act IV: War of the Three Gates */
  {
    id: 'the-long-night-ends',
    name: 'The First Gate',
    giver: 'lord-commander-varn',
    zone: 'highwall',
    text: 'General Morvain is dead, and his army is fleeing north. Highwall holds, so the first of the Three Gates is safe. Mara commanded the relief, and she should hear it from you. Go and tell her at the relief camp.',
    objective: { kind: 'talk', npc: 'captain-mara', label: 'Tell Mara that Highwall holds' },
    after: ['general-morvain'],
    reward: {
      xp: 30000,
      gold: 2400,
      item: { rarity: 'epic' },
      text: 'Mara listens with her helmet still on. Then she takes it off and sits down on a barrel for a long time. “That’s one gate,” she says. “Elyra is behind the next one. Take Nyx and her map, and go and get her.”',
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
    text: 'Two sigils are still missing: Vosk has the Sigil of Stone, and Elyra can feel the Sigil of Tides somewhere in Vaelmoor. She is too weak to travel, so she stays at Lastlight with the other five. Brother Orren went ahead through the Gloam Gate into Vaelmoor, the Hallow King’s dead kingdom, and sent word from a village called Candlewick. Go north into the Weeping Woods and find him.',
    objective: { kind: 'talk', npc: 'orren-in-vaelmoor', label: 'Find Brother Orren at Candlewick in the Weeping Woods' },
    after: ['the-gloam-gate'],
    reward: { xp: 4000, gold: 600, text: 'Candlewick is real, and its people are alive. Orren has been sitting in its square for two days, watching them light their candles.' },
  },
  {
    id: 'the-seventh-sigil',
    name: 'The Empty Scarf',
    giver: 'mara-at-the-reach',
    auto: true,
    text: 'Vosk is dead, and the scarf he carried the Sigil of Stone in is empty. With his last breath he said he took it to his king. Elyra can feel every sigil, so she will know where it is now. Bring her the scarf at Dawn’s Rest.',
    objective: { kind: 'talk', npc: 'elyra-at-the-reach', label: 'Bring Vosk’s empty scarf to Elyra at Dawn’s Rest' },
    after: ['march-vosk'],
    level: 57,
    reward: {
      xp: 16000,
      gold: 3000,
      item: { rarity: 'epic' },
      text: 'Elyra holds the empty scarf and looks north to Duskspire. “The Stone is up there, set in the Ash Crown on Vaelor’s head,” she says. “I need all seven sigils to destroy that crown. We have to take it off him.” Mara starts planning the attack on Duskspire’s outer wall.',
    },
  },
  /* --------------------------------------------- Epilogue */
  {
    id: 'epilogue-the-camp-goes-home',
    name: 'The Camp Goes Home',
    giver: 'maren',
    auto: true,
    zone: 'briarhollow',
    text: 'The Ash Crown is destroyed, and the war is over. Back home in Briarhollow, the camp is packing up, and every village you saved is going home. Go to Briarhollow and see them off from the square with Elder Maren.',
    objective: { kind: 'event', event: 'epilogue-the-camp', label: 'See the camp off from Briarhollow’s square' },
    after: ['crownfall-the-ash-crown'],
    level: 60,
    reward: { xp: 2000, gold: 1000, text: 'The last cart rolls down the south road. Briarhollow is a quiet village again. Someone has already started fixing the inn’s roof.' },
  },
  {
    id: 'epilogue-the-bell',
    name: 'The Bell',
    giver: 'maren',
    auto: true,
    zone: 'briarhollow',
    text: 'Old Haldor stopped ringing the chapel bell the night his grandson Robin went missing. He swore he would ring it again when the war was over. He has been waiting under the bell since dawn. Go and stand with him.',
    objective: { kind: 'talk', npc: 'old-haldor', label: 'Stand with Old Haldor at the chapel bell' },
    after: ['epilogue-the-camp-goes-home'],
    level: 60,
    reward: {
      xp: 3000,
      gold: 1500,
      item: { rarity: 'legendary' },
      tier: 2,
      text: 'Haldor rings the bell once for the dead and once for the living, and then he keeps ringing. All over the Vale, people stop and listen. Heroic and Mythic are now open everywhere, and there are a few loose threads left to follow.',
    },
  },
  /* --------------------------------------------- Postgame */
  {
    id: 'postgame-crownfall-heroic',
    name: 'Crownfall, Again',
    giver: 'maren',
    zone: 'briarhollow',
    text: 'The Ash Crown is gone, but Duskspire still stands, and the dead inside it still fight. Clear Duskspire on Heroic, all the way to the throne room. The camp’s riders say a horse is waiting in its stable for whoever does.',
    objective: { kind: 'clear', region: 'duskspire', tier: 1, label: 'Clear Duskspire on Heroic' },
    after: ['epilogue-the-bell'],
    level: 60,
    reward: { xp: 8000, gold: 3000, item: { rarity: 'legendary' }, text: 'In Duskspire’s stable, a black horse in starlit armor stands waiting. It is the Crownfall Destrier, Vaelor’s own warhorse, and it is yours.' },
  },
  {
    id: 'postgame-crownfall-mythic',
    name: 'The Last King’s Hardest Hour',
    giver: 'maren',
    zone: 'briarhollow',
    text: 'On Mythic, Duskspire is as strong as it would have been if you had come a year later. Clear Duskspire on Mythic.',
    objective: { kind: 'clear', region: 'duskspire', tier: 2, label: 'Clear Duskspire on Mythic' },
    after: ['postgame-crownfall-heroic'],
    level: 60,
    reward: { xp: 12000, gold: 5000, item: 'glitch-shard', keystone: 1, text: 'That night, Briarhollow’s bell rings once by itself. In the morning, a warm violet stone is tied to its rope: a Riftstone. Riftstone +1. Every dungeon in the Vale can now be run again, against the clock.' },
  },
];

// (the spine's beats in a retired land, and the camp's arrivals that came from one, are gone with it: data/retired.ts)
for (let i = STORY_QUESTS.length - 1; i >= 0; i--) {
  const q = STORY_QUESTS[i]!;
  if ((q.zone && isRetired(q.zone)) || q.id === 'camp-smiths') STORY_QUESTS.splice(i, 1);
}
