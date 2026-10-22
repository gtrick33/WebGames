import type { NpcDef, QuestDef } from '../types';

/**
 * Reedwater's people and Greyfen's quests. Greyfen's dead are leaving their graves from underneath:
 * the first ghouls, herded by bog hags and called home by Mother Mire, once the midwife of the Sunken
 * Hamlet, drowned forty years ago. Her ghouls were made by a sickness that came up the river from
 * Duskfen, in the west, where something brews it (Duskfen's chain follows, from Marshwarden Tilde).
 * Nella wants her eel traps back from the striders; Old Ferris wants his lamp to stop lying. The main
 * chain comes first, so it is the quest the hero follows by default.
 */
export const GREYFEN_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-digging-dead',
    name: 'The Digging Dead',
    giver: 'maren',
    text: 'A letter from Reedwater, in Greyfen Marsh: the marsh’s graves are being emptied, and not by grave-robbers. Marshwarden Tilde asks Emberwick for someone who isn’t afraid of the dark. Take the south path out of the Brackenridge Hills, or the west road out of Thornvale, and find her in Reedwater.',
    objective: { kind: 'talk', npc: 'marshwarden-tilde', label: 'Talk to Marshwarden Tilde in Reedwater' },
    after: ['the-empty-tomb'],
    level: 11,
    reward: { xp: 220, gold: 70 },
  },
  /* ---------------------------------------------------------- the ghouls */
  {
    id: 'the-old-churchyard',
    name: 'Opened from Below',
    giver: 'marshwarden-tilde',
    text: 'The old churchyard stands on a hummock east of Reedwater, and half its graves are open. Tilde says the earth is thrown up, not down: whatever was buried there dug its own way out. She has looked. She would like someone else to have looked too.',
    objective: { kind: 'explore', spot: 'old-churchyard', label: 'Look at the graves in the Old Churchyard' },
    after: ['the-digging-dead'],
    zone: 'greyfen',
    reward: { xp: 230, gold: 80 },
  },
  {
    id: 'the-hungry-dead',
    name: 'The Hungry Dead',
    giver: 'marshwarden-tilde',
    text: 'What came out of the graves is grey, quick and hungry. Ferris calls them ghouls. They took two of Nella’s eel baskets and one of Nella’s cousins. Thin them out around Reedwater; twelve fewer would let the village sleep.',
    objective: { kind: 'kill', region: 'greyfen', count: 12, enemies: ['bog-ghoul', 'bloated-drowned'], label: 'Defeat ghouls' },
    after: ['the-old-churchyard'],
    zone: 'greyfen',
    level: 12,
    reward: { xp: 290, gold: 90 },
  },
  {
    id: 'bone-charms',
    name: 'Bone Charms',
    giver: 'marshwarden-tilde',
    text: 'The ghouls wear charms of bone and string, and the bog hags tie them: hags herding ghouls like geese. Tilde wants four of the hags’ charms, to see whose mark is on them. The hags slip away into the reeds when you close in. Corner them.',
    objective: { kind: 'loot', region: 'greyfen', item: 'Bone Charm', from: ['bog-hag'], chance: 0.5, count: 4, label: 'Take Bone Charms from bog hags' },
    after: ['the-hungry-dead'],
    zone: 'greyfen',
    level: 12,
    reward: { xp: 300, gold: 95 },
  },
  {
    id: 'ferris-remembers',
    name: 'The Midwife’s Mark',
    giver: 'marshwarden-tilde',
    text: 'Every charm carries the same mark, a small hand pressed into clay. Old Ferris has poled this marsh for fifty years and remembers everything, slowly. Ask him about the mark at his inn in Reedwater.',
    objective: { kind: 'talk', npc: 'old-ferris', label: 'Show Old Ferris the mark' },
    after: ['bone-charms'],
    zone: 'greyfen',
    level: 13,
    reward: { xp: 280, gold: 95 },
  },
  {
    id: 'the-sunken-hamlet',
    name: 'The Sunken Hamlet',
    giver: 'old-ferris',
    text: 'The mark is Mother Mire’s, midwife of the Sunken Hamlet, which drowned forty years ago with everyone in it. Ferris will pole you as far as the reeds and not a stroke further. The hamlet lies west of Reedwater, where the old roofs still break the water.',
    objective: { kind: 'explore', spot: 'sunken-hamlet', label: 'Reach the Sunken Hamlet' },
    after: ['ferris-remembers'],
    zone: 'greyfen',
    level: 13,
    reward: { xp: 340, gold: 100 },
  },
  {
    id: 'the-drowned-folk',
    name: 'The Drowned Folk',
    giver: 'marshwarden-tilde',
    text: 'The Sunken Hamlet’s people have walked up out of the water, still in their Sunday clothes, and some are swollen fit to burst. Tilde won’t have them reaching Reedwater. Put down ten of the drowned, in the hamlet west of the village and on the paths around it.',
    objective: { kind: 'kill', region: 'greyfen', count: 10, enemies: ['drowned-villager', 'bloated-drowned'], label: 'Put down the drowned' },
    after: ['the-sunken-hamlet'],
    zone: 'greyfen',
    level: 14,
    reward: { xp: 400, gold: 110 },
  },
  {
    id: 'the-ghoul-mother',
    name: 'The Ghoul Mother',
    giver: 'marshwarden-tilde',
    text: 'Mother Mire brought every child of the Sunken Hamlet into the world, and now she is calling them home, up out of the graves and the water. She waits in the middle of the drowned hamlet, west of Reedwater, with her brood around her. End her, and the ghouls lose their mother.',
    objective: { kind: 'kill', region: 'greyfen', count: 1, enemies: ['mother-mire'], label: 'Defeat Mother Mire in the Sunken Hamlet' },
    after: ['the-drowned-folk'],
    zone: 'greyfen',
    level: 15,
    reward: {
      xp: 1300,
      gold: 300,
      item: 'brood-teeth',
      text: 'Mire’s blood runs black, like the ghouls’. Not a curse: a sickness, a fever that came up the river from Duskfen, in the west. Tilde wants Emberwick to know. Someone in Duskfen is brewing it.',
    },
  },
  /* ------------------------------------------------------ Nella's traps */
  {
    id: 'strider-pools',
    name: 'Bent Traps',
    giver: 'nella',
    text: 'Nella’s eel traps at Strider Pools, south-east of Reedwater, keep coming up empty, and bent. She has an idea what is bending them, and the idea has very long legs. Go and see.',
    objective: { kind: 'explore', spot: 'strider-pools', label: 'Check Nella’s traps at Strider Pools' },
    after: ['the-digging-dead'],
    zone: 'greyfen',
    level: 12,
    reward: { xp: 260, gold: 85 },
  },
  {
    id: 'eel-thieves',
    name: 'Eel Thieves',
    giver: 'nella',
    text: 'Marsh striders spear Nella’s eels straight out of the traps with their beaks. Eight fewer striders and she can feed Reedwater again. They stalk round you, then lunge in a line: step out of the line.',
    objective: { kind: 'kill', region: 'greyfen', count: 8, enemies: ['marsh-strider'], label: 'Defeat marsh striders' },
    after: ['strider-pools'],
    zone: 'greyfen',
    level: 13,
    reward: { xp: 330, gold: 100 },
  },
  {
    id: 'longshanks',
    name: 'Longshanks',
    giver: 'nella',
    text: 'The striders’ sire is Longshanks, taller than a stilt-house, wading the deep end of Strider Pools. It lunges further than its brood, and sooner. Bring it down and Nella will make you waders from its hide.',
    objective: { kind: 'kill', region: 'greyfen', count: 1, enemies: ['longshanks'], label: 'Defeat Longshanks at Strider Pools' },
    after: ['eel-thieves'],
    zone: 'greyfen',
    level: 14,
    reward: { xp: 750, gold: 200, item: 'longshanks-waders', text: 'Nella stitches you a pair of waders. They want to take long steps.' },
  },
  {
    id: 'nellas-eels',
    name: 'Smoked Eel',
    giver: 'nella',
    text: 'Nella owes Old Ferris for a ferry ride, and a goat. She’s paying in smoked eel. Take the basket to Ferris at the inn, and don’t mention the goat.',
    objective: { kind: 'talk', npc: 'old-ferris', label: 'Bring Nella’s eels to Old Ferris' },
    after: ['the-digging-dead'],
    zone: 'greyfen',
    level: 12,
    reward: { xp: 200, gold: 50 },
  },
  /* ------------------------------------------------- Old Ferris's lantern */
  {
    id: 'heron-isle',
    name: 'The Dark Lamp',
    giver: 'old-ferris',
    text: 'Ferris keeps a lamp on Heron Isle, north-east of Reedwater, to guide the boats home. It has gone dark, and wisps dance round it instead: lights that lie, leading boats into deep water. Go and see to it.',
    objective: { kind: 'explore', spot: 'heron-isle', label: 'Reach Ferris’s lamp on Heron Isle' },
    after: ['the-digging-dead'],
    zone: 'greyfen',
    level: 12,
    reward: { xp: 260, gold: 85 },
  },
  {
    id: 'lights-that-lie',
    name: 'Lights That Lie',
    giver: 'old-ferris',
    text: 'Ferris has a plan: catch five wisp-lights and shut them in a lantern, where they will have to tell the truth for once. The wisps hang back over the water and shoot where you’re going. Jar, net or hat, whatever works.',
    objective: { kind: 'loot', region: 'greyfen', item: 'Wisp-Light', from: ['marsh-wisp'], chance: 0.5, count: 5, label: 'Catch Wisp-Lights from marsh wisps' },
    after: ['heron-isle'],
    zone: 'greyfen',
    level: 13,
    reward: { xp: 340, gold: 100 },
  },
  {
    id: 'hags-hollow',
    name: 'Hag’s Hollow',
    giver: 'old-ferris',
    text: 'The hags call the wisps, and the wisps call the boats. Hag’s Hollow, south-west of Reedwater, is where the hags boil their supper. Ferris wants their fires out: eight hags and wisps fewer, and the lantern is yours.',
    objective: { kind: 'kill', region: 'greyfen', count: 8, enemies: ['bog-hag', 'marsh-wisp'], label: 'Defeat bog hags and marsh wisps' },
    after: ['lights-that-lie'],
    zone: 'greyfen',
    level: 14,
    reward: { xp: 700, gold: 180, item: 'ferrymans-lantern', text: 'Ferris hands you the lantern. Its light doesn’t lie; it gets between you and harm.' },
  },
];

export const GREYFEN_NPCS: Record<string, NpcDef> = {
  'marshwarden-tilde': {
    id: 'marshwarden-tilde',
    name: 'Marshwarden Tilde',
    title: 'Marshwarden of Reedwater',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-digging-dead', state: 'active' },
        lines: [
          'From Emberwick? Maren got my letter, then. I’m Tilde. I watch the water, and lately the water’s been watching back.',
          'Our dead are leaving their graves. Not dug up. Dug out, from underneath.',
        ],
      },
      {
        when: { quest: 'the-old-churchyard', state: 'active' },
        lines: ['The old churchyard is on the hummock east of here. Half the graves are open, and the earth is thrown up, not down.', 'Go and look. I’ve looked. I’d like someone else to have looked too.'],
      },
      {
        when: { quest: 'the-hungry-dead', state: 'active' },
        lines: ['Ferris calls them ghouls. Grey, quick, hungry. They come at you from the side while their friends hold your eye.', 'Twelve fewer would let us sleep. Eleven, I’d take.'],
      },
      {
        when: { quest: 'bone-charms', state: 'active' },
        lines: ['The ghouls wear charms, bone on string, and the bog hags tie them. Hags herding ghouls like geese.', 'Bring me four charms. The hags won’t stand still for it; they slip into the reeds. Corner them against the water.'],
      },
      {
        when: { quest: 'ferris-remembers', state: 'active' },
        lines: ['A little hand pressed into clay, on every charm. Somebody’s mark.', 'Ferris will know. Ferris knows everything in this marsh. Getting it out of him takes a while.'],
      },
      {
        when: { quest: 'the-drowned-folk', state: 'active' },
        lines: ['The Sunken Hamlet is walking. The drowned, in their Sunday clothes. Some of them are swollen fit to burst, and they do.', 'Keep them off Reedwater. Pop the bloated ones from a distance if you can.'],
      },
      {
        when: { quest: 'the-ghoul-mother', state: 'active' },
        lines: ['Mother Mire brought half this marsh into the world. Now she’s calling it all home.', 'She calls her brood out of the mud when she’s pressed. Kill the brood fast, or ignore it and kill her faster.'],
      },
      {
        when: { quest: 'the-sick-villages', state: 'active' },
        lines: ['The causeway west runs to Duskfen and Stilt Hollow. Healer Osk keeps the sick there, if there are any left to keep.', 'Find her. Find out who’s brewing this fever. And come back; I’d like one thing in this marsh to come back the way it went out.'],
      },
      {
        when: { quest: 'the-ghoul-mother', state: 'done' },
        lines: ['Not a curse, then. A sickness. It came up the river from Duskfen, in the west, and it made Mire what she was.', 'Something out there is brewing it. Tell Emberwick. Then, if you’ve the stomach for it, go west.'],
      },
      { lines: ['Reedwater. We live on stilts so the marsh can’t get us. The marsh is patient.', 'Keep to the boardwalks. And don’t follow any light you didn’t light yourself.'] },
    ],
  },
  'old-ferris': {
    id: 'old-ferris',
    name: 'Old Ferris',
    title: 'Ferryman and innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Ferryman’s Rest',
    talk: [
      {
        when: { quest: 'ferris-remembers', state: 'active' },
        lines: [
          'The little hand? I know it. That’s Mother Mire’s mark. She was the midwife in the Sunken Hamlet, back when it was a hamlet and not a pond.',
          'Every child in that hamlet came into the world through her hands. She pressed her mark into a charm for each one, for luck.',
          'Forty years ago the flood came, and she went down with them. Now she’s back, and calling them home. The hamlet’s west of here. I’ll pole you to the reeds. Not a stroke further.',
        ],
      },
      {
        when: { quest: 'nellas-eels', state: 'active' },
        lines: ['Smoked eel? From Nella? Paying her ferry debts at last.', 'Tell her she still owes me for the goat. What goat? She knows what goat.'],
      },
      {
        when: { quest: 'heron-isle', state: 'active' },
        lines: ['My lamp on Heron Isle, north-east of here, has gone dark, and the wisps dance round it instead.', 'Lights that lie. A boat follows them and ends up in the deep water, and then I’ve one less customer.'],
      },
      { when: { quest: 'lights-that-lie', state: 'active' }, lines: ['Catch me five wisp-lights. Shut in a lantern, they’ll have to tell the truth for once.', 'They hang back and shoot where you’re going. So don’t go where they think.'] },
      {
        when: { quest: 'hags-hollow', state: 'active' },
        lines: ['The hags call the wisps, and the wisps call the boats. Hag’s Hollow, south-west of here, is where the hags boil their supper.', 'Put their fires out. I’ll finish the lantern while you’re at it.'],
      },
      { when: { quest: 'the-sunken-hamlet', state: 'active' }, lines: ['West, past the reeds, where the old roofs break the water. That’s the hamlet.', 'I said I’d take you to the reeds. I’m old, not brave.'] },
      { when: { quest: 'hags-hollow', state: 'done' }, lines: ['Hold that lantern up when something hits you. The light gets in between. Mostly.'] },
      { lines: ['The Ferryman’s Rest. A bed, a potion, and a bowl of eel stew whether you want one or not.', 'Fifty years on this water. It’s had my boat twice and my hat four times.'] },
    ],
  },
  nella: {
    id: 'nella',
    name: 'Nella',
    title: 'Eel-fisher',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Nella’s Eel & Oddment',
    talk: [
      {
        when: { quest: 'strider-pools', state: 'active' },
        lines: ['My eel traps at Strider Pools, south-east of here, come up empty. Empty and bent.', 'I’ve an idea what’s bending them. The idea has very long legs.'],
      },
      { when: { quest: 'eel-thieves', state: 'active' }, lines: ['Striders! They spear my eels right out of the traps.', 'Eight fewer, please. They dance round you, then lunge in a line. Step out of the line.'] },
      {
        when: { quest: 'longshanks', state: 'active' },
        lines: ['The big one’s Longshanks. Taller than my house, and my house is on stilts.', 'Bring it down and I’ll make you waders from it. Best waders in Greyfen. Only waders in Greyfen, but still.'],
      },
      { when: { quest: 'nellas-eels', state: 'active' }, lines: ['Take this basket to Old Ferris at the inn. Smoked eel. I owe him for a ferry ride.', 'If he mentions a goat, you never met me.'] },
      { when: { quest: 'longshanks', state: 'done' }, lines: ['Traps full again. Eel for breakfast, eel for supper. Lovely. Help.'] },
      { lines: ['Charms carved from eel bone, rings from river pearls. Luck for sale, cheap, mostly works.', 'I fish eels. Some days the eels fish me.'] },
    ],
  },
};
