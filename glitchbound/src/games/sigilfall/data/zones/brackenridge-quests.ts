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
    text: 'The Ashen Host will come back for the sigil inside Elyra, and Briarhollow needs scouts to see it coming. Fernstead’s rangers are the best scouts in the Vale, but their village is in trouble: its dead are climbing out of the old barrows. Take the west road into the Brackenridge Hills and find Warden Hollis in Fernstead.',
    offer: ['The Host will come back for the sigil inside Elyra. We need scouts to see it coming.', 'Fernstead’s rangers watch the Brackenridge Hills, west of here. But a shepherd says their dead are climbing out of the barrows.', 'Go west and help Warden Hollis. If her rangers join us, they can watch our roads.'],
    objective: { kind: 'talk', npc: 'warden-hollis', label: 'Talk to Warden Hollis in Fernstead' },
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
    text: 'About a month ago, kobolds digging for gold broke into the Old Barrows, the ancient graves south-west of Fernstead. Since then, the dead climb out at dusk and walk toward the village lights. Go to the barrows with Hollis’s rangers and put them down.',
    objective: { kind: 'explore', spot: 'old-barrows', label: 'Go to the Old Barrows, south-west of Fernstead' },
    then: [{ kind: 'kill', region: 'brackenridge', count: 6, enemies: ['restless-shade', 'barrow-skeleton'], label: 'Put down the dead that rise from the barrows' }],
    after: ['west-road'],
    zone: 'brackenridge',
    level: 6,
    reward: { xp: 140, gold: 50, text: 'The dead go down easily. As the last one falls, you hear a woman singing somewhere among the barrows.' },
  },
  {
    id: 'the-widows-song',
    name: 'The Widow’s Song',
    giver: 'warden-hollis',
    auto: true,
    text: 'Every night, a woman in grey walks the barrows singing, and the dead rise to listen. Hollis doesn’t know the song. Mother Alsa runs the inn in Fernstead and knows every old song in the hills. Ask her about this one.',
    objective: { kind: 'talk', npc: 'mother-alsa', label: 'Ask Mother Alsa about the grey woman’s song' },
    after: ['the-old-barrows'],
    zone: 'brackenridge',
    reward: { xp: 120, gold: 40, text: 'The song is about Ser Edric of Fernstead, a Sigil-warden who died holding a gate in the north three hundred years ago. His widow sang it at his grave every night until she died. Now she is up and singing again.' },
  },
  {
    id: 'lay-the-grey-lady',
    name: 'Lay the Grey Lady',
    giver: 'warden-hollis',
    auto: true,
    text: 'The Grey Lady is Edric’s widow. Something is using her grief, and every time she sings, more dead rise. Elyra thinks the sigil’s light can break its hold on her. Find the Lady at the Old Barrows, south-west of Fernstead, and lay her to rest.',
    objective: { kind: 'kill', region: 'brackenridge', count: 1, enemies: ['the-grey-lady'], label: 'Lay the Grey Lady to rest in the Old Barrows' },
    after: ['the-widows-song'],
    zone: 'brackenridge',
    level: 8,
    reward: {
      xp: 450,
      gold: 120,
      item: 'widows-locket',
      text: 'As she fades, the Lady says her husband’s name. Then she says a voice from the north calls the dead, and they go to it. It promised her Edric back. Her locket stays behind in the grass.',
    },
  },
  {
    id: 'fern-retaken',
    name: 'Fernstead Again',
    giver: 'mara-venn',
    text: 'The Host left a small force in Fernstead’s square, and Mara means to take the village back. Hollis’s rangers know every ditch in the Brackenridge Hills, and Dunmore has sent riders. Mara wants you at the front.',
    objective: { kind: 'event', event: 'fern-retake', label: 'Take Fernstead back with Mara and Hollis’s rangers' },
    after: ['fall-of-fernstead'],
    zone: 'brackenridge',
    level: 40,
    reward: { xp: 4200, gold: 900, item: { rarity: 'epic' }, text: 'Fernstead is free again, though it is burned and empty. Hollis walks every street before she lets anyone else in. Then she raises her rangers’ banner over the square.' },
  },
  {
    id: 'camp-scouts',
    name: 'Rangers for Briarhollow',
    giver: 'warden-hollis',
    auto: true,
    text: 'The barrows are quiet, and Hollis keeps her promise. Six of Fernstead’s rangers are on the road to Briarhollow to keep watch at the camp’s gate. Meet them in Briarhollow’s square.',
    objective: { kind: 'event', event: 'camp-scouts', label: 'Meet Fernstead’s rangers in Briarhollow' },
    after: ['the-harvest-stones'],
    zone: 'briarhollow',
    reward: { xp: 180, gold: 60, text: 'A watchfire burns by Briarhollow’s gate. Now the camp will see the Host coming.' },
  },
  /* -------------------------------------------------------- Pip's hides */
  {
    id: 'russet-hides',
    name: 'Russet Hides',
    giver: 'pip-tanner',
    text: 'Pip Tanner, Fernstead’s tanner, needs five russet boar hides. The boars live on the hills around Fernstead and charge anything that moves. Step aside when one charges.',
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
    text: 'Every hide you brought has the same scar, a tusk mark the size of Pip’s hand. Old Rustback, the oldest boar in the hills, made those marks. He used to den in Tusker Gully, south of Fernstead. Go and see if he is still there.',
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
    text: 'Old Rustback is still in Tusker Gully, with old arrows stuck in his hide. One of them was shot by Pip’s grandad. Bring the old boar down, and Pip will make you a jerkin from his hide.',
    objective: { kind: 'kill', region: 'brackenridge', count: 1, enemies: ['old-rustback'], label: 'Defeat Old Rustback in Tusker Gully' },
    after: ['tusker-gully'],
    zone: 'brackenridge',
    level: 8,
    reward: { xp: 280, gold: 90, item: 'rustback-jerkin', text: 'Pip works all night and makes you a jerkin from Old Rustback’s bristly hide.' },
  },
  /* ------------------------------------------------- Mother Alsa's cordial */
  {
    id: 'appleby-apples',
    name: 'Cider Apples',
    giver: 'mother-alsa',
    text: 'The Applebys fled their orchard when the kobolds came, and the last cider apples are rotting on the trees. Mother Alsa makes her harvest cordial from them every autumn. Fill a sack at Appleby Orchard, south-east of Fernstead. Watch out for kobolds there.',
    objective: { kind: 'explore', spot: 'appleby-orchard', label: 'Pick apples at Appleby Orchard' },
    after: ['west-road'],
    zone: 'brackenridge',
    level: 6,
    reward: { xp: 65, gold: 30 },
  },
  {
    id: 'the-harvest-stones',
    name: 'The Harvest Stones',
    giver: 'mother-alsa',
    auto: true,
    text: 'The Lady is at rest, but the Harvest Stones, Fernstead’s shrine north of the village, are still grey and cold, and the dead gather there at night. Mother Alsa says candles lit at the stones will make them clean again. Keep the dead away while the candles burn. Two of Hollis’s rangers will go with you.',
    objective: { kind: 'event', event: 'fern-stones', label: 'Hold the Harvest Stones while the candles burn' },
    after: ['lay-the-grey-lady'],
    zone: 'brackenridge',
    level: 8,
    reward: { xp: 260, gold: 80, item: 'corn-dolly', text: 'The grey fades from the stones, and they are warm again. Hollis keeps her promise: six of her rangers leave for Briarhollow tonight.' },
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
        lines: ['The Grey Lady was the widow of Ser Edric, a Sigil-warden. Something has woken her after three hundred years.', 'Every time she sings, more dead rise. Please, give her rest.'],
      },
      { when: { quest: 'fern-retaken', state: 'done' }, lines: ['We’re home. Half the roofs are gone, but all of our people are here. We’ll rebuild.', 'You and Mara Venn took Fernstead back. We won’t forget it.'] },
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
          'She sang it for her husband, Ser Edric of Fernstead. He was a Sigil-warden.',
          'Three hundred years ago, he went north to hold a gate against an army of the dead. He died there.',
          'They brought him home and buried him in the Old Barrows. She sang at his grave every night until she died.',
          'Now she’s singing again, and the dead come when she calls.',
        ],
      },
      {
        when: { quest: 'appleby-apples', state: 'active' },
        lines: ['The Applebys fled their orchard when the kobolds came. It’s south-east of here.', 'Will you pick me a sack of cider apples? Watch out for the kobolds. They throw things.'],
      },
      {
        when: { quest: 'the-harvest-stones', state: 'active' },
        lines: ['The Harvest Stones are our shrine, north of the village. They’ve gone grey and cold, and the dead gather around them at night.', 'Light these candles at the stones, and keep the dead away until they burn down. Then the stones will be clean.', 'My gran did it that way, and it worked.'],
      },
      { when: { quest: 'the-heralds-ambush', state: 'done' }, lines: ['We left Fernstead with only what we could carry. I still make soup for anyone who needs it.'] },
      { when: { quest: 'the-harvest-stones', state: 'done' }, lines: ['I could see the stones from the inn last night, gold in the candlelight. I cried.', 'Keep that corn dolly with you. It’s a harvest charm from these hills.'] },
      { when: { quest: 'lay-the-grey-lady', state: 'done' }, lines: ['Rest, Lady. Rest, Edric.', 'Take a potion before you go. You’ve earned it.'] },
      { lines: ['Welcome to the Bracken Hearth. Potions on the shelf, soup in the pot.', 'Rest between fights, dear. You heal quickly once nothing is hitting you. Potions are for when something is.'] },
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
        lines: ['Russet boar hides are the best in the hills. I need five.', 'When a boar paws the ground, it’s about to charge. Step aside.'],
      },
      {
        when: { quest: 'tusker-gully', state: 'active' },
        lines: ['Every hide you brought has the same scar, a tusk mark the size of my hand. That’s Old Rustback’s mark.', 'He used to den in Tusker Gully, south of Fernstead. Go and see if he’s still there.'],
      },
      {
        when: { quest: 'old-rustback', state: 'active' },
        lines: ['He’s still there? My grandad shot him years ago, and the arrow is still in him.', 'He charges farther than the young boars and turns faster. Bring him down, and I’ll make you a jerkin from his hide.'],
      },
      { when: { quest: 'old-rustback', state: 'done' }, lines: ['The jerkin suits you. Its bristles hurt anything that hits you.'] },
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
      { who: 'mara', text: 'Fernstead is ours! Take it back!' },
      { who: 'fern-ranger', text: 'For Fernstead! For the Warden!' },
    ],
    waves: [
      { enemies: ['legion-soldier', 'legion-soldier', 'legion-crossbowman', 'ash-raider'], from: ['fern-n', 'fern-e'] },
      { enemies: ['legion-soldier', 'legion-crossbowman', 'legion-crossbowman', 'ash-archer', 'ash-raider'], from: ['fern-w', 'fern-n'], barks: [{ who: 'mara', text: 'Shields on the left! Riders, take the lane!' }] },
      { enemies: ['legion-ensign', 'legion-soldier', 'legion-soldier', 'legion-soldier', 'legion-crossbowman', 'ash-raider'], from: ['fern-n', 'fern-e', 'fern-w'], barks: [{ who: 'fern-ranger', text: 'Their banner! Bring down their banner!' }] },
    ],
    end: [{ who: 'mara', text: 'Fernstead is free. Tell Hollis her people can come home.' }],
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
