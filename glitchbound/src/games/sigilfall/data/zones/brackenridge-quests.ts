import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Fernstead's people and Brackenridge's quests (Act I, STORY_BIBLE.md v3 §4): the first village of the Vale.
 * Kobolds digging for barrow gold broke into the Old Barrows as the Ash Crown stirred, and the dead walk. The
 * Grey Lady is the widow of Ser Edric, the eighth Sigil-warden, who held the Gloam Gate alone three hundred years
 * ago and was left out of the songs: the Ash Crown has woken her grief and feeds on it. Five beats: Fernstead's
 * candles, the barrows, the song, the Lady, the Harvest Stones; then Hollis's rangers go to the camp. Pip's boar
 * and Alsa's orchard are the hills' own small stories.
 */
export const BRACKENRIDGE_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'west-road',
    name: 'Fernstead’s Candles',
    giver: 'maren',
    text: 'Elyra carries one sigil of seven, and the Host will come back for it. Briarhollow needs scouts to see it coming. Fernstead’s rangers are the best in the Vale, but their own dead are climbing out of the old barrows. Take the west road into the Brackenridge Hills. Fernstead’s watch-lanterns have gone dark: light them as you come in, and find Warden Hollis.',
    offer: ['Elyra carries one sigil, and the Host holds none. It will come back for hers. We need scouts to see it coming.', 'Fernstead’s rangers watch the Brackenridge Hills, west of here. But a shepherd says their dead are climbing out of the barrows.', 'Go west and help Warden Hollis. If her rangers join us, they can watch our roads.'],
    // (it was a walk and a talk. The quest is named for Fernstead's candles: the watch-lanterns on the village's edge
    // have gone out, and what the hero sees lighting them is the land's trouble told before Hollis says a word)
    objective: {
      kind: 'use', region: 'brackenridge', at: 'warden-hollis', count: 3, thing: 'lantern', verb: 'Light', label: 'Light the watch-lanterns round Fernstead', secs: 0.9, spread: 10,
      notes: ['Scratches on the post, at the height of a hand.', 'Grave-earth on the road. Something walked in from the barrows.', 'Lit. From here the barrows’ fog shows grey on the hill.'],
    },
    then: [{ kind: 'talk', npc: 'warden-hollis', label: 'Talk to Warden Hollis' }],
    // the Vale after the north road is safe: dawn, then the Whisperwood and Grimtusk (the Prologue's own order)
    after: ['the-empty-tomb', 'alpha'],
    level: 5,
    reward: { xp: 55, gold: 25, text: 'Hollis agrees. Once the dead are back in the ground, she will send her best rangers to Briarhollow.' },
  },
  /* ------------------------------------------------- the kobolds' dig */
  /* ------------------------------------------------------ the barrow dead */
  {
    id: 'the-old-barrows',
    name: 'The Old Barrows',
    giver: 'warden-hollis',
    auto: true,
    text: 'About a month ago, kobolds digging for gold broke into the Old Barrows, the ancient graves south-west of Fernstead. Since then, the dead climb out at dusk and walk toward the village lights. Go to the barrows with Hollis’s rangers, put them down, and set the grave-seals back.',
    objective: { kind: 'explore', spot: 'old-barrows', label: 'Go to the Old Barrows, south-west of Fernstead' },
    then: [
      { kind: 'kill', region: 'brackenridge', count: 4, enemies: ['restless-shade', 'barrow-skeleton'], label: 'Put down the dead that rise from the barrows' },
      // (the dead put down, the graves are shut again: the seals the kobolds levered up are set back, and the largest
      // is found broken, with words cut under its carving)
      {
        kind: 'use', region: 'brackenridge', at: 'old-barrows', count: 3, thing: 'grave', verb: 'Reseal', label: 'Set the grave-seals back on the barrows', spread: 6, ambush: ['barrow-skeleton', 'restless-shade'],
        notes: ['Levered up from outside. Kobold picks did this.', 'This barrow is empty. Its dead already walked.', 'The largest seal is cracked through. Words are cut under it.'],
      },
    ],
    after: ['west-road'],
    zone: 'brackenridge',
    level: 6,
    find: {
      name: 'A Broken Grave-Seal',
      kind: 'relic',
      about: 'A piece of the stone that sealed the largest of the Old Barrows, cracked where the kobolds dug through. Under the old carving, a less steady hand has cut three more words. Mother Alsa at Fernstead’s inn knows every grave and every song in these hills.',
      body: ['Here lies Ser Edric of Fernstead, who held the gate.', 'Wait for me.'],
      step: 2,
    },
    reward: { xp: 140, gold: 50, text: 'The dead go down without a sound, like tired people lying down to sleep. Then, from the far side of the barrows, a woman begins to sing. It is a slow, sad song, and the grass over the graves shivers as she sings it.' },
  },
  {
    id: 'the-widows-song',
    name: 'The Widow’s Song',
    giver: 'warden-hollis',
    auto: true,
    text: 'Every night, a woman in grey walks the barrows singing, and the dead rise to listen. Hollis doesn’t know the song. Mother Alsa runs the inn in Fernstead and knows every old song in the hills. Ask her about this one. What she doesn’t have is cut on the Warden’s Cairn, west of the village.',
    // (it was one talk. Alsa has the tune and half the words; the rest are cut on the Warden's Cairn, Edric's own, and
    // are read there among his company's dead before she can say whose song it is)
    objective: {
      kind: 'talk', npc: 'mother-alsa', label: 'Ask Mother Alsa about the grey woman’s song',
      lines: ['Hum it for me, dear. Yes. I know that tune. My gran sang me to sleep with it.', 'But I only ever had the first verse. The rest are cut on the Warden’s Cairn, out west on the hill, where no one has gone since the dead woke.', 'Read me the verses, and I’ll tell you who she is.'],
    },
    then: [
      {
        kind: 'use', region: 'brackenridge', at: 'wardens-cairn', count: 3, thing: 'runestone', verb: 'Read', label: 'Read the song’s verses on the Warden’s Cairn', spread: 5, guards: ['barrow-skeleton'],
        notes: ['“He rode to the gate when the beacons burned.”', '“She lit a candle every night he was gone.”', '“Three hundred years, and the candle is burning still.”'],
      },
      { kind: 'talk', npc: 'mother-alsa', label: 'Tell Mother Alsa the verses' },
    ],
    after: ['the-old-barrows'],
    zone: 'brackenridge',
    reward: { xp: 120, gold: 40, text: 'The song is a lament for Ser Edric of Fernstead, the forgotten eighth warden, who held the Gloam Gate alone while the other seven rode away with the sigils. His widow sang it at his barrow every night until she died. Now she is up again, and the dead rise to hear her.' },
  },
  {
    id: 'lay-the-grey-lady',
    name: 'Lay the Grey Lady',
    giver: 'warden-hollis',
    auto: true,
    text: 'The Grey Lady is Edric’s widow. Something is feeding on her grief, and every time she sings, more dead rise. Elyra thinks the sigil’s light can break its hold on her. Light her candles again at Edric’s barrow, south-west of Fernstead. She will come to them. Then lay her to rest.',
    // (it was one kill. The song says she lit a candle every night: they are lit for her again, at Edric's barrow, and
    // she comes to them)
    objective: {
      kind: 'use', region: 'brackenridge', at: 'old-barrows', count: 3, thing: 'candle', verb: 'Light', label: 'Light the Lady’s candles at Edric’s barrow', secs: 1.2, spread: 5, ambush: ['restless-shade', 'restless-shade'],
      notes: ['A candle for the night he rode out.', 'A candle for every night she waited.', 'The last candle. The singing has stopped. She is here.'],
    },
    then: [{ kind: 'kill', region: 'brackenridge', count: 1, enemies: ['the-grey-lady'], label: 'Lay the Grey Lady to rest', lair: { at: 'old-barrows', enemies: ['the-grey-lady'] } }],
    after: ['the-widows-song'],
    zone: 'brackenridge',
    level: 7,
    find: {
      name: 'The Grey Lady’s Locket',
      kind: 'relic',
      about: 'A tarnished silver locket, left in the grass at the Old Barrows where the Grey Lady faded. Inside is a lock of a man’s dark hair. The hill songs say the words on its back were the last Edric ever sent home.',
      body: ['Till the last light. Then a little after.'],
    },
    reward: {
      xp: 450,
      gold: 120,
      item: 'widows-locket',
      text: 'The Lady says Edric’s name once more, softly, as if he were only in the next room. Before she fades, she tells you a voice from the north promised to give him back to her, if she would only sing. Then she is gone, and the barrows are quiet.',
    },
  },
  {
    id: 'fern-retaken',
    name: 'Fernstead Again',
    giver: 'mara-venn',
    text: 'The Host burned Fernstead the night the Herald took Elyra, and a small force of its soldiers still holds the village square. Mara means to take Fernstead back tonight, with Hollis’s rangers and the riders Dunmore sent. Ride west to Fernstead in the Brackenridge Hills and fight beside her.',
    objective: { kind: 'event', event: 'fern-retake', label: 'Take Fernstead back with Mara and Hollis’s rangers' },
    // (the square won, the village is still the Host's work: the people it kept for its digging are cut loose)
    then: [
      {
        kind: 'use', region: 'brackenridge', at: 'fern-e', count: 3, thing: 'captive', verb: 'Cut loose', label: 'Cut loose the people the Host kept', secs: 1, spread: 5,
        notes: ['“They kept us for the digging. Under the stones.”', '“Hollis? Is Hollis alive?”', '“There were more of us. They took the strong ones north.”'],
      },
    ],
    after: ['fall-of-fernstead'],
    zone: 'brackenridge',
    level: 40,
    // (paid in Fernstead, where it is won: Mara is there, the Regent's rider finds her there, and the road to Highwall
    // starts there; handed in at Briarhollow, the scenes of Fernstead taken back never played)
    turnIn: false,
    find: {
      name: 'The Regent’s Order',
      kind: 'orders',
      about: 'The Regent’s sealed order, brought to Fernstead by a rider while the fighting was still going on. Mara read it twice and handed it to you. Briarhollow’s village guard now commands the army sent to save Highwall.',
      body: [
        'To Mara Venn, of Briarhollow’s guard.',
        'Highwall has been under siege since midsummer, and Lord-Commander Varn cannot break it. If Highwall falls, nothing stands between the Hallow King’s Host and Aster.',
        'I give you command of the relief of Highwall. Varn and his soldiers will serve under you. Take every banner the Vale will send.',
        'You held Briarhollow’s gate when no one else would. That is why I am asking you.',
      ],
      sign: 'Elowen, Regent of Aster',
    },
    reward: { xp: 4200, gold: 900, item: { rarity: 'epic' }, text: 'Fernstead is free, but it is burned and empty, and six of Hollis’s rangers died taking it back. Hollis walks every street before she lets anyone else in. Then she raises her rangers’ banner over the square.' },
  },
  {
    id: 'camp-scouts',
    name: 'Rangers for Briarhollow',
    giver: 'warden-hollis',
    auto: true,
    text: 'The barrows are quiet, and Hollis keeps her promise. Six of Fernstead’s rangers are on the road to Briarhollow to keep watch at the camp’s gate. Meet them in Briarhollow’s square, and show them where to stand watch.',
    objective: { kind: 'event', event: 'camp-scouts', label: 'Meet Fernstead’s rangers in Briarhollow' },
    // (they came, and that was all. The rangers are strangers to the camp: the hero, who knows it, walks its edge and
    // marks where they are to stand)
    then: [{ kind: 'use', region: 'briarhollow', at: 'briar-square', count: 3, thing: 'banner', verb: 'Set a watch-post', label: 'Mark the rangers’ three watch-posts round the camp', secs: 1, spread: 12 }],
    after: ['the-harvest-stones'],
    zone: 'briarhollow',
    reward: { xp: 180, gold: 60, text: 'A watchfire burns by Briarhollow’s gate. Now the camp will see the Host coming.' },
  },
  /* -------------------------------------------------------- Pip's hides */
  {
    id: 'russet-hides',
    name: 'Russet Hides',
    giver: 'pip-tanner',
    text: 'Pip Tanner, Fernstead’s tanner, needs four russet boar hides, and one boar roped alive for his pen. The boars live on the hills around Fernstead and charge anything that moves. Step aside when one charges.',
    objective: { kind: 'loot', region: 'brackenridge', item: 'Russet Hide', from: ['russet-boar'], chance: 0.5, count: 4, label: 'Collect Russet Hides from russet boars' },
    // (it was five hides. Pip wants one boar alive as well: what is on the hides is easier to read on the beast)
    then: [{ kind: 'subdue', region: 'brackenridge', enemies: ['russet-boar'], count: 1, verb: 'Rope', label: 'Wear a boar down and rope it for Pip’s pen' }],
    after: ['west-road'],
    zone: 'brackenridge',
    level: 6,
    reward: { xp: 70, gold: 30 },
  },
  {
    id: 'tusker-gully',
    name: 'Tusker Gully',
    giver: 'pip-tanner',
    text: 'Every hide you brought has the same scar, a tusk mark the size of Pip’s hand. Old Rustback, the oldest boar in the hills, made those marks. He used to den in Tusker Gully, south of Fernstead. Pick up his sign at Wolfback Tor and follow it to see if he is still there.',
    // (it was a walk to a spot. The old boar is tracked there from the tor, and the wallow searched)
    objective: {
      kind: 'trail', region: 'brackenridge', from: 'wolfback-tor', to: 'tusker-gully', marks: 3, label: 'Follow the big boar’s sign south from Wolfback Tor',
      notes: ['Saplings snapped at the height of a man’s chest.', 'A wallow, still wet. Prints the size of plates.', 'Flakes of green bronze in the mud. Old metal, newly broken.'],
    },
    then: [
      { kind: 'explore', spot: 'tusker-gully', label: 'Find Tusker Gully' },
      { kind: 'use', region: 'brackenridge', at: 'tusker-gully', count: 1, thing: 'log', verb: 'Search', label: 'Search the wallow', secs: 1.2, spread: 3, notes: ['A snapped arrow, its fletching dyed Tanner red.'] },
    ],
    after: ['russet-hides'],
    zone: 'brackenridge',
    level: 7,
    find: {
      name: 'Grandad Tanner’s Arrow',
      kind: 'relic',
      about: 'A snapped arrow lying in the boar wallow at Tusker Gully, its fletching dyed Tanner red. Pip’s grandad shot it into Old Rustback years ago. The tracks around it are fresh. The old boar still dens here.',
    },
    reward: { xp: 80, gold: 35 },
  },
  {
    id: 'old-rustback',
    name: 'Old Rustback',
    giver: 'pip-tanner',
    text: 'Old Rustback is still in Tusker Gully, with old arrows stuck in his hide. One of them was shot by Pip’s grandad. Stake the gully mouth with Pip’s boar-spears, bring the old boar down, and cut those arrows out: Pip wants his grandad’s back. He will make you a jerkin from the hide.',
    // (it was one kill. The gully's mouth is staked first, so that his charge has somewhere to end; and what is in his
    // hide is cut out and looked at)
    objective: { kind: 'use', region: 'brackenridge', at: 'tusker-gully', count: 3, thing: 'spear', verb: 'Set the spears', label: 'Stake Pip’s boar-spears across the gully mouth', secs: 1, spread: 5 },
    then: [
      { kind: 'kill', region: 'brackenridge', count: 1, enemies: ['old-rustback'], label: 'Defeat Old Rustback', lair: { at: 'tusker-gully', enemies: ['old-rustback'] } },
      { kind: 'use', region: 'brackenridge', at: 'tusker-gully', count: 1, thing: 'bones', verb: 'Cut out the arrows', label: 'Cut the old arrows out of his hide', secs: 1.4, spread: 2, notes: ['One arrow is Tanner red. The other ten are bronze.'] },
    ],
    after: ['tusker-gully'],
    zone: 'brackenridge',
    level: 8,
    // (the side story's turn: the old boar was not what was wrong with the hills)
    find: {
      name: 'Barrow-Bronze Arrowheads',
      kind: 'relic',
      about: 'Cut out of Old Rustback’s hide in Tusker Gully. Only one arrow in him was Grandad Tanner’s. The other ten are bronze, green with age, the kind buried with the dead in the Old Barrows, and the wounds around them are new. The gully lies between the barrows and Fernstead.',
    },
    reward: { xp: 280, gold: 90, item: 'rustback-jerkin', text: 'Pip counts the arrowheads twice. Every night since the barrows woke, their dead have walked toward Fernstead’s lights, and the ones that came by way of the gully met the old boar first. Pip works all night and makes you a jerkin from the bristly hide. He sews the bronze into its collar, and says the tannery owes that boar a better name than the one it had.' },
  },
  /* ------------------------------------------------- Mother Alsa's cordial */
  {
    id: 'appleby-apples',
    name: 'Cider Apples',
    giver: 'mother-alsa',
    text: 'The Applebys fled their orchard when the kobolds came, and the last cider apples are rotting on the trees. Mother Alsa makes her harvest cordial from them every autumn. Fill a sack at Appleby Orchard, south-east of Fernstead. Watch out for kobolds there.',
    objective: { kind: 'explore', spot: 'appleby-orchard', label: 'Pick apples at Appleby Orchard' },
    // (it was a walk to a spot with kobolds standing in it: now the orchard is cleared for the Applebys to come home to)
    then: [
      // (the apples are picked by hand, tree by tree, with the kobolds coming up out of the cellar at the noise; and
      // the sack is carried home)
      { kind: 'use', region: 'brackenridge', at: 'appleby-orchard', count: 3, thing: 'barrel', verb: 'Fill', label: 'Fill the sack from the cider trees', secs: 1, spread: 5, ambush: ['ridge-kobold', 'ridge-kobold'] },
      { kind: 'kill', region: 'brackenridge', count: 3, enemies: ['ridge-kobold', 'kobold-candler'], label: 'Clear the kobolds out of the orchard', lair: { at: 'appleby-orchard', enemies: ['ridge-kobold', 'ridge-kobold', 'kobold-candler'] } },
      { kind: 'carry', region: 'brackenridge', from: 'appleby-orchard', to: 'mother-alsa', thing: 'sack', verb: 'Shoulder the sack', label: 'Carry the apples home to Mother Alsa', ambush: [['ridge-kobold', 'ridge-kobold']] },
    ],
    after: ['west-road'],
    zone: 'brackenridge',
    level: 6,
    find: {
      name: 'The Applebys’ Note',
      kind: 'note',
      about: 'Pinned to the press-house door at Appleby Orchard, left when the family fled to Fernstead. The last cider apples are still on the trees.',
      body: ['Gone to Fernstead. Kobolds in the cellar.', 'Take what apples you need. Leave the old tree for the bees.'],
      sign: 'Jem Appleby',
      step: 0,
    },
    reward: { xp: 65, gold: 30, text: 'The sack is full and the kobolds are out of the cellar. Mother Alsa sends word to the Applebys that the press-house is theirs again, and sets the first apples to steep.' },
  },
  {
    id: 'the-harvest-stones',
    name: 'The Harvest Stones',
    giver: 'mother-alsa',
    auto: true,
    text: 'The Lady is at rest, but the Harvest Stones, Fernstead’s shrine north of the village, are still grey and cold, and the dead gather there at night. Mother Alsa says candles lit at the stones will make them clean again. Carry hers up from the inn, and keep the dead away while they burn. Two of Hollis’s rangers will go with you.',
    // (the candles were already at the stones. They are Alsa's, and go up the hill in the hero's arms, with the dead
    // that gather there coming down to meet them)
    objective: { kind: 'carry', region: 'brackenridge', from: 'mother-alsa', to: 'fern-stones', thing: 'candle', verb: 'Take the candles', label: 'Carry Mother Alsa’s candles to the Harvest Stones', ambush: [['restless-shade'], ['restless-shade', 'barrow-skeleton']] },
    then: [{ kind: 'event', event: 'fern-stones', label: 'Hold the Harvest Stones while the candles burn' }],
    after: ['lay-the-grey-lady'],
    zone: 'brackenridge',
    level: 8,
    reward: { xp: 260, gold: 80, item: 'corn-dolly', text: 'The candles burn down, and the grey goes out of the stones. That night Fernstead lights its window candles as it always has, and nothing comes up the hill toward them. The first village of the Vale is free of the Host’s hold.' },
  },
];

export const BRACKENRIDGE_NPCS: Record<string, NpcDef> = {
  'warden-hollis': {
    id: 'warden-hollis',
    name: 'Warden Hollis',
    title: 'Warden of Fernstead',
    sprite: 'villager',
    talk: [
      { when: { quest: 'epilogue-the-camp-goes-home', state: 'done' }, lines: ['Fernstead is holding a harvest festival this year, the first since the barrows woke.', 'The Harvest Stones are lit, and all of my rangers are home.'] },
      {
        when: { quest: 'west-road', state: 'active' },
        lines: [
          'Maren sent you? Good. I’m Hollis, Fernstead’s warden. I command the hill rangers.',
          'About a month ago, kobolds digging for gold broke into the Old Barrows. Since then, our dead climb out every night.',
          'Help me put them back in the ground, and I’ll send my best rangers to Briarhollow.',
        ],
      },
      {
        when: { quest: 'the-old-barrows', state: 'active' },
        lines: ['The Old Barrows are south-west of the village. The dead come out of them at dusk.', 'My rangers will meet you there. Put the dead down.'],
      },
      {
        when: { quest: 'the-widows-song', state: 'active' },
        lines: ['A woman in grey walks the barrows at night, singing. The dead rise to listen.', 'Mother Alsa knows every old song in these hills. Ask her about this one. She runs the inn.'],
      },
      {
        when: { quest: 'lay-the-grey-lady', state: 'active' },
        lines: ['The Grey Lady was the widow of Ser Edric, the eighth warden. Something has woken her after three hundred years.', 'Every time she sings, more dead rise. Please, give her rest.'],
      },
      { when: { quest: 'fern-retaken', state: 'done' }, lines: ['We’re home. Half the roofs are gone, and six of my rangers are buried by the Harvest Stones.', 'You and Mara Venn took Fernstead back. We won’t forget it.'] },
      { when: { quest: 'fern-retaken', state: 'active' }, lines: ['My rangers are already on the west road. We go in with Mara at dusk.', 'The Host’s soldiers are sleeping in our houses. Not for one more night.'] },
      // (her people under canvas in Briarhollow's camp, from the Herald's ambush until Fernstead is taken back)
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['Fernstead is in the Host’s hands, and my people are sleeping in tents.', 'When Mara gives the word, my rangers will be ready to take it back.'] },
      { when: { quest: 'camp-scouts', state: 'active' }, lines: ['Six of my best rangers are on the road to Briarhollow. Tell Maren they’re hers for as long as she needs them.'] },
      {
        when: { quest: 'lay-the-grey-lady', state: 'done' },
        lines: ['The barrows are quiet now. Our dead are staying in the ground.', 'Elyra says the Hallow King promised the Lady her husband back. That frightens me more than the dead did.'],
      },
      { lines: ['I’m Hollis, the warden of Fernstead.', 'Watch out for the boars on the hills and the kobolds in their tunnels.'] },
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
          'A candle every night. Then that’s the Grey Lady’s song. She sang it for her husband, Ser Edric of Fernstead.',
          'The songs say seven wardens hid the Starlight Crown. Fernstead always said there were eight, and the eighth was ours.',
          'Edric stayed behind to hold the Gloam Gate while the other seven rode away. He held it alone until dusk, and he died there.',
          'She brought him home to the Old Barrows and sang at his grave every night until she died. Now she’s singing again, and the dead come when she calls.',
        ],
      },
      {
        when: { quest: 'the-harvest-stones', state: 'active' },
        lines: ['The Harvest Stones are our shrine, north of the village. They’ve gone grey and cold, and the dead gather around them at night.', 'Light these candles at the stones, and keep the dead away until they burn down. Then the stones will be clean.', 'My gran did it that way, and it worked.'],
      },
      {
        when: { quest: 'appleby-apples', state: 'active' },
        lines: ['The Applebys fled their orchard when the kobolds came. It’s south-east of here.', 'Will you pick me a sack of cider apples? Watch out for the kobolds. They throw things.'],
      },
      { when: { quest: 'fern-retaken', state: 'done' }, lines: ['The Host’s soldiers slept in my inn for a week. I’ve scrubbed every bed and burned their banners in the grate.', 'Sit by the fire before you go north, dear. It’s the first one we’ve lit since we came home.'] },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['We left Fernstead with what we could carry. I carried my soup pot and the inn’s sign.', 'I still make soup for anyone who needs it. Sit down, dear.'] },
      { when: { quest: 'the-harvest-stones', state: 'done' }, lines: ['I could see the stones from the inn last night, gold in the candlelight. I cried.', 'Keep that corn dolly with you. It’s a harvest charm from these hills.'] },
      { when: { quest: 'lay-the-grey-lady', state: 'done' }, lines: ['Rest, Lady. Rest, Edric.', 'Take a potion before you go. You’ve earned it.'] },
      { lines: ['Welcome to the Bracken Hearth. Potions on the shelf, soup in the pot.', 'Rest between fights, dear. You heal quickly once nothing is hitting you. Save the potions for the middle of a fight.'] },
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
        lines: ['Russet boar hides are the best in the hills. I need four.', 'And one boar alive. Wear it down until it stands, then rope it. I want to look at a hide that’s still on the beast.', 'When a boar paws the ground, it’s about to charge. Step aside.'],
      },
      {
        when: { quest: 'tusker-gully', state: 'active' },
        lines: ['Every hide you brought has the same scar, a tusk mark the size of my hand, and the one in my pen has it too, half healed. That’s Old Rustback’s mark.', 'He used to den in Tusker Gully, south of Fernstead. Go and see if he’s still there.'],
      },
      {
        when: { quest: 'old-rustback', state: 'active' },
        lines: ['He’s still there? My grandad shot him years ago, and the arrow is still in him.', 'He charges farther than the young boars and turns faster. Bring him down, and I’ll make you a jerkin from his hide.'],
      },
      { when: { quest: 'fern-retaken', state: 'done' }, lines: ['The tannery is ash, but the vats came through the fire. I can start again.', 'The first jerkin I make goes to whoever rides north with you.'] },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['My tannery burned with everything in it. My grandad’s tools, too.', 'I’m sewing jerkins out of tent canvas now. They’re better than nothing.'] },
      { when: { quest: 'old-rustback', state: 'done' }, lines: ['The jerkin suits you. Its bristles hurt anything that hits you.', 'The bronze in the collar came out of him. He stood between us and the barrows, and we never knew.'] },
      { lines: ['Leather armor and hides. Have a look.', 'I make armor from what the hills give me, and that’s mostly boars.'] },
    ],
  },
};

/** The Harvest Stones held while the candles take, and Fernstead's rangers reaching the camp. */
export const BRACKENRIDGE_EVENTS: Record<string, StoryEventDef> = {
  'fern-stones': {
    id: 'fern-stones',
    region: 'brackenridge',
    kind: 'defend',
    at: 'fern-stones',
    radius: 9,
    level: 7,
    allies: ['fern-ranger', 'fern-ranger'],
    ward: { pet: 'harvest-stone', at: 'fern-stones', name: 'The Harvest Stone' },
    start: [
      { who: 'fern-ranger', text: 'The candles are lit! Keep the dead away from the stone while they burn!' },
      { who: 'fern-ranger', text: 'Here they come!' },
    ],
    waves: [
      { enemies: ['restless-shade', 'restless-shade', 'barrow-skeleton'], from: ['fern-stones-n', 'fern-stones-w'] },
      { enemies: ['barrow-skeleton', 'barrow-skeleton', 'restless-shade', 'restless-shade'], from: ['fern-stones-e', 'fern-stones-n'], barks: [{ who: 'fern-ranger', text: 'The grey is fading from the stone! Hold on!' }] },
      { enemies: ['restless-shade', 'restless-shade', 'restless-shade', 'barrow-skeleton', 'barrow-skeleton'], from: ['fern-stones-w', 'fern-stones-e', 'fern-stones-n'], barks: [{ who: 'fern-ranger', text: 'This is the last of them! Hold!' }] },
    ],
    end: [{ who: 'fern-ranger', text: 'The stone is warm again. The shrine is clean.' }],
    retry: [{ who: 'fern-ranger', text: 'They put the candles out! Light them again!' }],
  },
  'fern-retake': {
    id: 'fern-retake',
    region: 'brackenridge',
    kind: 'raid',
    at: 'fern-square',
    radius: 14,
    level: 40,
    allies: ['mara', 'fern-ranger', 'fern-ranger', 'hearth-rider', 'hearth-rider'],
    banner: 'Fernstead!',
    start: [
      { who: 'mara', text: 'Rangers on the left, riders on the right! Take back the square!' },
      { who: 'fern-ranger', text: 'For Fernstead! For the Warden!' },
    ],
    waves: [
      { enemies: ['legion-soldier', 'legion-soldier', 'legion-crossbowman', 'ash-raider'], from: ['fern-n', 'fern-e'] },
      { enemies: ['legion-soldier', 'legion-crossbowman', 'legion-crossbowman', 'ash-archer', 'ash-raider'], from: ['fern-w', 'fern-n'], barks: [{ who: 'mara', text: 'Shields on the left! Riders, take the lane!' }] },
      { enemies: ['legion-ensign', 'legion-soldier', 'legion-soldier', 'legion-soldier', 'legion-crossbowman', 'ash-raider'], from: ['fern-n', 'fern-e', 'fern-w'], barks: [{ who: 'fern-ranger', text: 'Their banner! Bring down their banner!' }] },
    ],
    end: [{ who: 'mara', text: 'Fernstead is free! Send a rider to the camp. Hollis’s people can come home.' }],
    retry: [{ who: 'mara', text: 'Back to the ridge! Regroup! We go again!' }],
  },
  'camp-scouts': {
    id: 'camp-scouts',
    region: 'briarhollow',
    kind: 'arrival',
    at: 'briar-square',
    radius: 18,
    arrive: { pets: ['fern-ranger', 'fern-ranger', 'fern-ranger'], from: 'briar-west', to: 'briar-watchfire' },
    banner: 'Fernstead’s rangers',
    // (what is said as they come in is said in the shot of it, data/scenes.ts)
    start: [],
    waves: [],
    end: [],
  },
};
