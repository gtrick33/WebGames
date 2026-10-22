import type { NpcDef, QuestDef } from '../types';

/**
 * Fernstead's people and Brackenridge's quests. Kobolds tunnelling the ridge for barrow gold broke
 * into the Old Barrows just as the Hollow King woke, and now the barrow dead walk at night. The Grey
 * Lady, widow of the Sigil-warden Edric who held these hills against the King three hundred years
 * ago, has risen and calls the dead to her. Pip Tanner wants the old boar of the hills; Mother Alsa
 * wants her harvest cordial made the old way. The main chain comes first, so it is the quest the
 * hero follows by default.
 */
export const BRACKENRIDGE_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'west-road',
    name: 'The West Road',
    giver: 'maren',
    text: 'A shepherd from Fernstead came to the west gate with a story nobody believed: lights moving on the hills at night, and graves that won’t stay shut. Elder Maren believes him. Take the west road out of Emberwick into the Brackenridge Hills and find Warden Hollis in Fernstead.',
    objective: { kind: 'talk', npc: 'warden-hollis', label: 'Talk to Warden Hollis in Fernstead' },
    after: ['alpha'],
    level: 5,
    reward: { xp: 55, gold: 25 },
  },
  /* ------------------------------------------------- the kobolds' dig */
  {
    id: 'lights-on-the-ridge',
    name: 'Lights on the Ridge',
    giver: 'warden-hollis',
    text: 'Every night for a month, lights have crawled over the ridge north-west of Fernstead, and every morning something is missing: a spade, a lamp, a sheep. Warden Hollis thinks it’s kobolds. Go and look at the diggings on the ridge.',
    objective: { kind: 'explore', spot: 'kobold-diggings', label: 'Look over the Kobold Diggings' },
    after: ['west-road'],
    zone: 'brackenridge',
    reward: { xp: 60, gold: 30 },
  },
  {
    id: 'snuff-the-candles',
    name: 'Snuff the Candles',
    giver: 'warden-hollis',
    text: 'Kobolds, dozens of them, dug into the ridge like ticks. The candlers, the ones with a candle on their heads, keep the diggers digging and patch them up when you hit them. Hollis wants the diggings thinned out, candlers first.',
    objective: { kind: 'kill', region: 'brackenridge', count: 10, enemies: ['ridge-kobold', 'kobold-candler'], label: 'Defeat kobolds' },
    after: ['lights-on-the-ridge'],
    zone: 'brackenridge',
    level: 6,
    reward: { xp: 75, gold: 35 },
  },
  {
    id: 'barrow-gold',
    name: 'Barrow Gold',
    giver: 'warden-hollis',
    text: 'Fernstead’s children have been finding coins in the kobolds’ spoil heaps: thin gold stamped with a sigil. Funeral coins, Hollis says, the kind laid on a dead man’s eyes. She wants more of them, from the kobolds themselves, to know whose eyes they came off.',
    objective: { kind: 'loot', region: 'brackenridge', item: 'Barrow Coin', from: ['ridge-kobold', 'kobold-candler'], chance: 0.5, count: 5, label: 'Take Barrow Coins from kobolds' },
    after: ['snuff-the-candles'],
    zone: 'brackenridge',
    level: 6,
    reward: { xp: 80, gold: 35 },
  },
  {
    id: 'king-snagtooth',
    name: 'King Snagtooth',
    giver: 'warden-hollis',
    text: 'Barrow coin, every one: the kobolds have tunnelled into the Old Barrows. Their chief calls himself King Snagtooth now, and wears a dead king’s crown and a breastplate three sizes too big. He holds court in the Kobold Diggings, north-west of Fernstead. Hollis wants him off his throne.',
    objective: { kind: 'kill', region: 'brackenridge', count: 1, enemies: ['king-snagtooth'], label: 'Defeat King Snagtooth in the Kobold Diggings' },
    after: ['barrow-gold'],
    zone: 'brackenridge',
    level: 7,
    reward: { xp: 120, gold: 50, item: 'snagtooths-crown', text: 'Snagtooth’s crown rolls to your feet. Hollis says it suits you better.' },
  },
  /* ------------------------------------------------------ the barrow dead */
  {
    id: 'the-old-barrows',
    name: 'The Old Barrows',
    giver: 'warden-hollis',
    text: 'Snagtooth’s tunnels run south-west, under the Old Barrows. Since the kobolds broke in, Fernstead’s dogs howl all night at nothing anyone can see. Go to the barrows, south-west of the hamlet, and see what the kobolds let out.',
    objective: { kind: 'explore', spot: 'old-barrows', label: 'Go to the Old Barrows' },
    after: ['king-snagtooth'],
    zone: 'brackenridge',
    level: 7,
    reward: { xp: 90, gold: 40 },
  },
  {
    id: 'restless-dead',
    name: 'The Restless Dead',
    giver: 'warden-hollis',
    text: 'The barrow dead are walking: grey shades that slip away from a blade, and skeletons that put themselves back together. Hollis’s grandmother is buried up there. She was a terror alive, and Hollis would like her to stay where they put her. Lay the dead down again.',
    objective: { kind: 'kill', region: 'brackenridge', count: 10, enemies: ['restless-shade', 'barrow-skeleton'], label: 'Lay restless dead to rest' },
    after: ['the-old-barrows'],
    zone: 'brackenridge',
    level: 8,
    reward: { xp: 105, gold: 45 },
  },
  {
    id: 'the-widows-song',
    name: 'The Widow’s Song',
    giver: 'warden-hollis',
    text: 'Every night a woman in grey walks the barrows, singing, and the dead get up to listen. Hollis doesn’t know the song. Mother Alsa, at the inn in Fernstead, knows every song in the hills. Ask her about this one.',
    objective: { kind: 'talk', npc: 'mother-alsa', label: 'Ask Mother Alsa about the song' },
    after: ['restless-dead'],
    zone: 'brackenridge',
    reward: { xp: 100, gold: 40 },
  },
  {
    id: 'lay-the-grey-lady',
    name: 'Lay the Grey Lady',
    giver: 'warden-hollis',
    text: 'The song is a lament for Sigil-warden Edric, who held these hills against the Hollow King’s army three hundred years ago. His widow sang it by his mound until she died, and they buried her beside him. Something has woken the Grey Lady, and she is calling the dead to her. Find her in the Old Barrows, south-west of Fernstead, and give her rest.',
    objective: { kind: 'kill', region: 'brackenridge', count: 1, enemies: ['the-grey-lady'], label: 'Lay the Grey Lady to rest in the Old Barrows' },
    after: ['the-widows-song'],
    zone: 'brackenridge',
    level: 9,
    reward: {
      xp: 450,
      gold: 120,
      item: 'widows-locket',
      text: 'As she fades she whispers: “He calls them all. He calls, and they go.” Her locket stays behind in the grass.',
    },
  },
  /* -------------------------------------------------------- Pip's hides */
  {
    id: 'russet-hides',
    name: 'Russet Hides',
    giver: 'pip-tanner',
    text: 'Pip Tanner wants russet boar hides, the autumn coats, red as the bracken. The boars root on the hills all round Fernstead and charge anything that moves. Pip says to step sideways. He says it with feeling.',
    objective: { kind: 'loot', region: 'brackenridge', item: 'Russet Hide', from: ['russet-boar'], chance: 0.5, count: 5, label: 'Collect Russet Hides from russet boars' },
    after: ['west-road'],
    zone: 'brackenridge',
    level: 6,
    reward: { xp: 70, gold: 30 },
  },
  {
    id: 'tusker-gully',
    name: 'Tusker Gully',
    giver: 'pip-tanner',
    text: 'Every hide you brought has the same scar, a tusk-mark the size of Pip’s hand. That is Old Rustback’s mark: he sires every boar in the hills, and dens in Tusker Gully, south of Fernstead. Pip wants to know if the old boar is still there.',
    objective: { kind: 'explore', spot: 'tusker-gully', label: 'Find Tusker Gully' },
    after: ['russet-hides'],
    zone: 'brackenridge',
    level: 7,
    reward: { xp: 80, gold: 35 },
  },
  {
    id: 'old-rustback',
    name: 'Old Rustback',
    giver: 'pip-tanner',
    text: 'Old Rustback is still there, and half the arrows in Brackenridge are still in him, Pip’s grandad’s among them. Bring the old boar down in Tusker Gully, and Pip will make you a coat from his hide, bristles and all.',
    objective: { kind: 'kill', region: 'brackenridge', count: 1, enemies: ['old-rustback'], label: 'Defeat Old Rustback in Tusker Gully' },
    after: ['tusker-gully'],
    zone: 'brackenridge',
    level: 8,
    reward: { xp: 280, gold: 90, item: 'rustback-jerkin', text: 'Pip works all night. The jerkin still bristles.' },
  },
  /* ------------------------------------------------- Mother Alsa's cordial */
  {
    id: 'appleby-apples',
    name: 'Cider Apples',
    giver: 'mother-alsa',
    text: 'The Applebys left their orchard when the kobolds came, and the last cider apples are rotting on the trees. Mother Alsa makes her harvest cordial from them every autumn. Fill a sack at Appleby Orchard, south-east of Fernstead. Mind the kobolds; they don’t eat apples, but they throw them.',
    objective: { kind: 'explore', spot: 'appleby-orchard', label: 'Pick apples at Appleby Orchard' },
    after: ['west-road'],
    zone: 'brackenridge',
    level: 6,
    reward: { xp: 65, gold: 30 },
  },
  {
    id: 'stolen-light',
    name: 'Stolen Light',
    giver: 'mother-alsa',
    text: 'The candlers on the ridge wear candles from Fernstead’s chapel: good beeswax, the only kind Alsa will use to seal her cordial. She wants four of them back, preferably blown out.',
    objective: { kind: 'loot', region: 'brackenridge', item: 'Chapel Candle', from: ['kobold-candler'], chance: 0.5, count: 4, label: 'Take Chapel Candles from kobold candlers' },
    after: ['appleby-apples'],
    zone: 'brackenridge',
    level: 7,
    reward: { xp: 85, gold: 35 },
  },
  {
    id: 'the-harvest-stones',
    name: 'The Harvest Stones',
    giver: 'mother-alsa',
    text: 'One thing left, and it’s the old way: light the chapel candles at the Harvest Stones, north of Fernstead, and pour a cup of cordial for the hills. Alsa’s knees won’t take her up there this year. Yours will.',
    objective: { kind: 'explore', spot: 'harvest-stones', label: 'Light the candles at the Harvest Stones' },
    after: ['stolen-light'],
    zone: 'brackenridge',
    level: 7,
    reward: { xp: 190, gold: 70, item: 'corn-dolly', text: 'Alsa ties you a corn dolly from the last sheaf of the harvest.' },
  },
];

export const BRACKENRIDGE_NPCS: Record<string, NpcDef> = {
  'warden-hollis': {
    id: 'warden-hollis',
    name: 'Warden Hollis',
    title: 'Warden of Fernstead',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'west-road', state: 'active' },
        lines: [
          'Emberwick sent someone? Good. I asked for a company. You’ll do.',
          'Every night there are lights on the ridge, and every morning something’s gone: a spade, a lamp, a sheep. Yesterday, my lamp. I liked that lamp.',
        ],
      },
      {
        when: { quest: 'lights-on-the-ridge', state: 'active' },
        lines: ['The lights come from the ridge, north-west of Fernstead. Kobolds, I’d bet my pension.', 'I don’t have a pension. That’s how sure I am.'],
      },
      {
        when: { quest: 'snuff-the-candles', state: 'active' },
        lines: ['Kobolds, then. Dozens. The ones with candles on their heads keep the rest digging, and patch them up when you hit them.', 'Snuff the candles first. The diggers swing high and slow; step out from under the pick.'],
      },
      {
        when: { quest: 'barrow-gold', state: 'active' },
        lines: ['The children found these in the kobolds’ spoil heaps. Thin gold, a sigil on it. Funeral coin: you lay one on a dead man’s eyes so he stays put.', 'Bring me more, off the kobolds. I want to know whose eyes they came off.'],
      },
      {
        when: { quest: 'king-snagtooth', state: 'active' },
        lines: ['Barrow coin, every one. They’ve dug into the Old Barrows. Their chief calls himself King Snagtooth now, and wears a dead king’s crown.', 'He’s in the diggings. His armor turns a blade; break it, or cook him in it.'],
      },
      {
        when: { quest: 'the-old-barrows', state: 'active' },
        lines: ['Snagtooth’s tunnels run south-west, under the Old Barrows. Since they broke in, the dogs howl all night at nothing.', 'Go and see what they let out. Take a light. Not my lamp. They have my lamp.'],
      },
      {
        when: { quest: 'restless-dead', state: 'active' },
        lines: ['The dead are walking. My gran is up there. She was a terror alive. I’d rather she stayed where we put her.', 'The shades slip away from a blade. The skeletons put themselves back together if you dawdle. Don’t dawdle.'],
      },
      {
        when: { quest: 'the-widows-song', state: 'active' },
        lines: ['There’s a woman in grey walking the barrows at night, singing. The dead get up to listen.', 'I don’t know the song. Mother Alsa knows every song in the hills. She’s at the inn.'],
      },
      {
        when: { quest: 'lay-the-grey-lady', state: 'active' },
        lines: ['A Sigil-warden’s widow. Three hundred years she waited by his mound, and something woke her.', 'Give her rest. She’s earned it. So have we.'],
      },
      {
        when: { quest: 'lay-the-grey-lady', state: 'done' },
        lines: ['The barrows are quiet. The dogs sleep. So did I, for once.', '“He calls them all,” she said. I keep turning that over. Who calls? And who answers next?'],
      },
      { lines: ['Fernstead. Twelve houses, one inn, one warden. That’s me.', 'Mind the boars on the hills, the kobolds in them, and the barrows, full stop.'] },
    ],
  },
  'mother-alsa': {
    id: 'mother-alsa',
    name: 'Mother Alsa',
    title: 'Herbwife and innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Bracken Hearth',
    talk: [
      {
        when: { quest: 'the-widows-song', state: 'active' },
        lines: [
          'The woman in grey? Oh, child. That’s the Grey Lady. My gran sang about her, and her gran before.',
          'Her husband was Edric, a Sigil-warden. He held these hills against the Hollow King’s army, three hundred years gone, and they buried him in the Old Barrows with his shield.',
          'She sat by his mound and sang until she died, and they laid her beside him. Now she’s up and singing again, and the dead come when she calls. Something woke her, something old.',
        ],
      },
      {
        when: { quest: 'appleby-apples', state: 'active' },
        lines: ['The Applebys left their orchard when the kobolds came, south-east of here. The last cider apples are rotting on the trees.', 'Fill me a sack? Kobolds don’t eat apples. They throw them. Duck.'],
      },
      { when: { quest: 'stolen-light', state: 'active' }, lines: ['Those candlers wear my chapel candles on their heads. Good beeswax, wasted on kobolds.', 'Four, please. Blow them out first.'] },
      {
        when: { quest: 'the-harvest-stones', state: 'active' },
        lines: ['Apples, candles… and the old way. Light the candles at the Harvest Stones, north of Fernstead, and pour a cup for the hills.', 'Silly? Maybe. The hills have been kind to us a long time. It costs nothing to say thank you.'],
      },
      { when: { quest: 'lay-the-grey-lady', state: 'done' }, lines: ['Rest, Lady. Rest, Edric.', 'You’ll want a potion. Everyone wants a potion after a funeral.'] },
      { when: { quest: 'the-harvest-stones', state: 'done' }, lines: ['Keep that dolly by you. It’s never brought anyone luck. It’s never let anyone down, either.'] },
      { lines: ['The Bracken Hearth. Potions on the shelf, soup in the pot, gossip by the fire.', 'Rest between fights, dear. You heal quick once nothing’s hitting you. Potions are for when something is.'] },
    ],
  },
  'pip-tanner': {
    id: 'pip-tanner',
    name: 'Pip Tanner',
    title: 'Tanner',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'Pip’s Hides',
    talk: [
      {
        when: { quest: 'russet-hides', state: 'active' },
        lines: ['Russet boar! Best hides in the hills, red as bracken in October. I need five.', 'When one paws the ground, step sideways. Trust me. Look at my trousers. No, don’t.'],
      },
      {
        when: { quest: 'tusker-gully', state: 'active' },
        lines: ['Every hide you brought has the same scar. A tusk-mark the size of my hand. That’s Old Rustback.', 'He dens in Tusker Gully, south of Fernstead. Go and see if he’s still there. Quietly.'],
      },
      {
        when: { quest: 'old-rustback', state: 'active' },
        lines: ['He’s there? Of course he is. Half the arrows in Brackenridge are stuck in him. My grandad’s is in there somewhere.', 'He charges further than the young ones and turns quicker. Bring him down and I’ll make you a coat from him. Bristles and all.'],
      },
      { when: { quest: 'old-rustback', state: 'done' }, lines: ['The jerkin suits you. The bristles bite back if anything gets too close. Like Grandad.'] },
      { lines: ['Leather, hides, and hats that were mostly a boar once. Have a look.', 'I make armor from what the hills give me. The hills mostly give me boars.'] },
    ],
  },
};
