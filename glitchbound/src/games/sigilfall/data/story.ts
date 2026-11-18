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
    text: 'Dawn comes grey over Briarhollow, and half its roofs are ash. The sigil from the crypt burns inside Elyra now. You carry two things Elder Maren must see: Morgrave’s journal and the dead courier’s letter. She is waiting by the chapel.',
    objective: { kind: 'talk', npc: 'maren', label: 'Show Elder Maren the journal and the letter' },
    after: ['close-the-rift'],
    reward: { xp: 900, gold: 150, unlock: 'whisperwood', text: 'Elyra holds one sigil of seven, and the Host will come back for it with more than raiders. Briarhollow will not run. Maren will make it a camp and gather the villages of the Vale to hold it, and she will dry the courier’s letter by the fire. The work begins on Briarhollow’s own north road.' },
  },
  /* --------------------------------------------- Act I: The Villages of the Vale */
  {
    id: 'hollow-gold',
    name: 'Ash-Gold',
    giver: 'reeve-aldous',
    zone: 'thornvale',
    text: 'Harlan’s strongbox was full of grey coins that weigh nothing and are always cold. In his journal, Morgrave wrote that the Pale Herald paid him in coin like that. Take one north to Elder Maren in Briarhollow, so she knows the Herald’s money has reached Millbrook.',
    objective: { kind: 'talk', npc: 'maren', label: 'Show Harlan’s grey coin to Elder Maren in Briarhollow' },
    after: ['mill-the-bridge'],
    reward: { xp: 1500, gold: 200, text: 'Maren lays the coin on Morgrave’s journal. It is ash-gold, the same coin the Pale Herald paid the scholar with. The Herald paid the Gallows Gang to starve the Vale and to dig under its chapels for sigils. He is buying the Vale’s people one by one.' },
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
    reward: { xp: 300, gold: 80, text: 'Twelve carts of grain reach the camp, and Tobin’s hens with them. For the first time since the raid, nobody in Briarhollow goes to bed hungry. The camp has scouts and bread now, and two villages stand with it.' },
  },
  {
    id: 'the-regents-council',
    name: 'The Courier’s Letter',
    giver: 'maren',
    text: 'Fernstead’s rangers and Millbrook’s grain are in the camp now. Elder Maren has dried Oskar Fell’s letter by the fire, and the ink has come back. She wants you to hear what the courier died to tell the Regent.',
    objective: { kind: 'talk', npc: 'maren', label: 'Hear the courier’s letter from Elder Maren' },
    after: ['camp-grain'],
    find: {
      name: 'The Courier’s Letter, Dried',
      kind: 'letter',
      about: 'Oskar Fell’s letter, dried by Elder Maren’s fire until the ink came back. It is the ninth warning he wrote to the Regent. No answer ever came to any of them.',
      body: [
        'To Her Grace the Regent, at the Crown City.',
        'This is the ninth time I have written to you. The agents of one they call the Pale Herald are hunting the sigils of the Starlight Crown. They pay in grey coin that weighs nothing.',
        'They know where the wardens hid them. One lies under the bell-chapel at Briarhollow, and they are coming for it now.',
        'I have had no answer to any letter. I am bringing this one to you myself. For the love of Aster, answer me.',
      ],
      sign: 'Oskar Fell, King’s Courier',
    },
    reward: {
      xp: 2600,
      gold: 300,
      text: 'For half a year, Oskar Fell warned the Regent that the Pale Herald was hunting the sigils, and that Briarhollow’s chapel held one. Nine letters, and not one answer. Someone in the Crown City is stopping them before they reach her. Until Maren knows who, the camp will ask the city for nothing.',
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
    // (v4: it goes straight on from Corvane's death in the barrow, west to the city: no walk back up the hill first)
    auto: true,
    zone: 'ashen-barrows',
    text: 'Lord Chancellor Maelis Crane signed the order that called off the Ninefold Watch’s relief and left it to die. Crane also keeps Aster’s roads, and Vosk’s orders said the roads were paid for. Cael and Orren are coming with you. Take the King’s Road west off the downs, north of the Kings’ Mound, and put the order in Regent Elowen’s hands at the Ember Keep in Emberwick, the Crown City.',
    objective: { kind: 'talk', npc: 'regent-elowen', label: 'Give Corvane’s order to Regent Elowen at the Ember Keep in Emberwick' },
    after: ['sir-corvane'],
    reward: {
      xp: 9000,
      gold: 800,
      item: { rarity: 'rare' },
      text: 'The Regent reads the order twice, with Crane standing at her shoulder. He calls it a forgery, carried by a man who ran from his post. The order is in his handwriting, but she cannot arrest the Lord Chancellor of Aster on one old paper. She needs proof he cannot talk his way out of.',
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
      text: 'Mara sits down on a barrel and takes off her helmet, and her hands shake. “We lost two hundred and twelve. I counted them,” she says. “That was one gate.” Then she stands up. “Elyra is behind the next one. Take Nyx and her map, and bring her home.”',
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
    text: 'Elyra holds five sigils again. The Hallow King holds one, the Sigil of Stone that Vosk carried north to him. The last, the Sigil of Tides, is hidden somewhere in Vaelmoor, the kingdom that died in one night three hundred years ago. The Herald’s cells left Elyra too weak to travel, so she stays behind Lastlight’s lamps. Go north through the Gloam Gate with Cael and find Brother Orren at Candlewick, in the Weeping Woods.',
    objective: { kind: 'talk', npc: 'orren-in-vaelmoor', label: 'Find Brother Orren at Candlewick in the Weeping Woods' },
    after: ['the-gloam-gate'],
    reward: { xp: 4000, gold: 600, text: 'Candlewick is a village of living people, shut in with the dead for three hundred years. Orren has sat in its square for two days, watching them light their candles, and he has hardly spoken. The wood around the village is where Aster’s knights died fighting the Hallow King, and their dead have begun to stir.' },
  },
  {
    id: 'the-seventh-sigil',
    name: 'The Empty Scarf',
    giver: 'mara-at-the-reach',
    auto: true,
    text: 'Vosk is ash, and his saddle lies in the snow at the King’s Host where he fell. He carried the Sigil of Stone north in that saddlebag. Search it, with Elyra beside you, and see what he left in it.',
    // (v4: read where Vosk fell, with Elyra riding beside you, and on to the wall: no walk back to Dawn's Rest to show her)
    objective: { kind: 'explore', spot: 'the-kings-host', label: 'Search Vosk’s saddlebag at the King’s Host' },
    find: {
      name: 'The Empty Scarf',
      kind: 'relic',
      about: 'A child’s red wool scarf from Vosk’s saddlebag, folded small around nothing. A name is stitched in one corner: Marit, the girl you found hiding under a wagon at the broken caravan on the Amberfield. Vosk wrapped the Sigil of Stone, Hearthstead’s hearthstone, in it and carried it north. Now the Stone is set in the Ash Crown on the Hallow King’s brow.',
      body: ['Marit'],
    },
    after: ['march-vosk'],
    level: 57,
    reward: {
      xp: 16000,
      gold: 3000,
      item: { rarity: 'epic' },
      text: 'Elyra holds the empty scarf and turns north toward Duskspire. The Stone is up there, set in the Ash Crown on the Hallow King’s brow, and it is the one sigil she cannot reach. To unmake the Crown she needs all seven, so the Stone must be taken from him. Mara turns the army toward Duskspire’s outer wall.',
    },
  },
  /* --------------------------------------------- Epilogue */
  {
    id: 'epilogue-the-camp-goes-home',
    name: 'The Camp Goes Home',
    giver: 'maren',
    auto: true,
    zone: 'briarhollow',
    text: 'The Ash Crown is unmade, and the Ashen Host went with it. At Briarhollow the camp is packing up, and the people of every village you saved are going home, if they still have homes. Go home to Briarhollow and see them off from the square with Elder Maren.',
    objective: { kind: 'event', event: 'epilogue-the-camp', label: 'See the camp off from Briarhollow’s square' },
    after: ['crownfall-the-ash-crown'],
    level: 60,
    reward: { xp: 2000, gold: 1000, text: 'The last cart goes down the south road with Tobin’s hens riding on top. Maren closes the camp book and keeps it. Briarhollow is a village again, too quiet now, with empty ground where the tents stood. Someone has already started on the inn’s new roof.' },
  },
  {
    id: 'epilogue-the-bell',
    name: 'The Bell',
    giver: 'maren',
    auto: true,
    zone: 'briarhollow',
    text: 'Old Haldor stopped ringing the chapel bell the night his grandson Robin went missing. He swore he would ring it once more when the war was over. He has been waiting under the bell since dawn, and Elyra is with him. Go to the chapel and stand with them.',
    objective: { kind: 'talk', npc: 'old-haldor', label: 'Stand with Old Haldor at the chapel bell' },
    after: ['epilogue-the-camp-goes-home'],
    level: 60,
    reward: {
      xp: 3000,
      gold: 1500,
      item: { rarity: 'legendary' },
      tier: 2,
      text: 'The bell rang over the whole Vale, and people in every village stopped to listen. The sigils took a great deal from Elyra, and most of it is not coming back. The bell gave her back her mother’s song. Heroic and Mythic are now open in every land, and a few loose threads are left to follow.',
    },
  },
  /* --------------------------------------------- Postgame */
  {
    id: 'postgame-crownfall-heroic',
    name: 'Crownfall, Again',
    giver: 'maren',
    zone: 'briarhollow',
    text: 'The Ash Crown is gone, but Duskspire was its home for three hundred years, and the citadel remembers. On dark nights its halls fill with the dead again, and an echo of the King sits on the throne. Clear Duskspire on Heroic, all the way to the throne room. Hearthstead’s riders say a horse waits in its stable for whoever does.',
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
    text: 'On the darkest nights, Duskspire’s echoes grow stronger still, as strong as the Hallow King’s army would have been with all seven sigils in his crown. Clear Duskspire on Mythic.',
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
