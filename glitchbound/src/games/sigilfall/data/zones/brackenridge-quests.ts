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
    text: 'A shepherd from Fernstead came to Briarhollow’s gate with a story nobody would have believed a month ago: graves on the hills that won’t stay shut, and a woman in grey who sings on the barrows at night. Take the west road into the Brackenridge Hills and find Warden Hollis in Fernstead before dark. If her rangers join the camp, Briarhollow will see the Host coming.',
    offer: ['Fernstead’s shepherd says their dead have started singing. Before last night I’d have laughed at him.', 'Go west, to Warden Hollis. Be there before they light the candles.'],
    objective: { kind: 'talk', npc: 'warden-hollis', label: 'Find Warden Hollis in Fernstead before dark' },
    // the Vale after the north road is safe: dawn, then the Whisperwood and Grimtusk (the Prologue's own order)
    after: ['the-empty-tomb', 'alpha'],
    level: 5,
    reward: { xp: 55, gold: 25, text: 'Every window in Fernstead has a candle in it. Hollis says they light them so the taken can find their way home. Lately, she says, they’ve been finding it.' },
  },
  /* ------------------------------------------------- the kobolds' dig */
  /* ------------------------------------------------------ the barrow dead */
  {
    id: 'the-old-barrows',
    name: 'The Old Barrows',
    giver: 'warden-hollis',
    auto: true,
    text: 'The kobolds of the ridge dug for barrow gold and broke into the Old Barrows, south-west of Fernstead, the week the bell stopped in Briarhollow. Since then the dead get up at dusk and walk toward the lights. Go to the barrows with Hollis’s rangers and put down what has climbed out.',
    objective: { kind: 'explore', spot: 'old-barrows', label: 'Go to the Old Barrows, south-west of Fernstead' },
    then: [{ kind: 'kill', region: 'brackenridge', count: 6, enemies: ['restless-shade', 'barrow-skeleton'], label: 'Put down the dead that rise from the barrows' }],
    after: ['west-road'],
    zone: 'brackenridge',
    level: 6,
    reward: { xp: 140, gold: 50, text: 'They go down easily. Too easily: each one turns its head to the north-west as it falls, as if someone had called its name.' },
  },
  {
    id: 'the-widows-song',
    name: 'The Widow’s Song',
    giver: 'warden-hollis',
    auto: true,
    text: 'Every night a woman in grey walks the barrows singing, and the dead get up to listen. Hollis doesn’t know the song. Mother Alsa, at the inn in Fernstead, knows every song in the hills. Ask her about this one.',
    objective: { kind: 'talk', npc: 'mother-alsa', label: 'Ask Mother Alsa about the grey woman’s song' },
    after: ['the-old-barrows'],
    zone: 'brackenridge',
    reward: { xp: 120, gold: 40, text: 'It is a lament for Ser Edric of these hills, who went north three hundred years ago to hold “a gate in the dark” and came home on a cart. His widow sang it at his barrow every night until she died. Somebody has woken her.' },
  },
  {
    id: 'lay-the-grey-lady',
    name: 'Lay the Grey Lady',
    giver: 'warden-hollis',
    auto: true,
    text: 'The Grey Lady is Edric’s widow, three hundred years dead, and something is feeding on her grief: every note of her song pulls the dead out of the ground. Elyra thinks the warm iron in her can break whatever has hold of the Lady. Find her at the Old Barrows, south-west of Fernstead, and give her rest.',
    objective: { kind: 'kill', region: 'brackenridge', count: 1, enemies: ['the-grey-lady'], label: 'Lay the Grey Lady to rest in the Old Barrows' },
    after: ['the-widows-song'],
    zone: 'brackenridge',
    level: 8,
    reward: {
      xp: 450,
      gold: 120,
      item: 'widows-locket',
      text: 'As she fades she says her husband’s name, once, the way you say it to someone in the next room. “He calls them all,” she says. “He calls, and they go. He promised me Edric.” Her locket stays behind in the grass.',
    },
  },
  {
    id: 'fern-retaken',
    name: 'Fernstead Again',
    giver: 'mara-venn',
    text: 'Mara has had enough of counting tents. Hollis’s rangers know every ditch in the Brackenridge Hills, Dunmore has sent riders, and the Host left a garrison in Fernstead square that thinks it has already won. Mara means to take Fernstead back, and she wants you at the front.',
    objective: { kind: 'event', event: 'fern-retake', label: 'Take Fernstead back with Mara and Hollis' },
    after: ['fall-of-fernstead'],
    zone: 'brackenridge',
    level: 40,
    reward: { xp: 4200, gold: 900, item: { rarity: 'epic' }, text: 'Fernstead is yours again: burned, empty and yours. Hollis walks every street of it before she lets anyone else in, and puts her rangers’ banners up over the square herself.' },
  },
  {
    id: 'camp-scouts',
    name: 'Rangers for Briarhollow',
    giver: 'warden-hollis',
    auto: true,
    text: 'The barrows are quiet, and Hollis keeps her word: six of Fernstead’s rangers are on the road to Briarhollow, to keep a watchfire at the camp’s gate. Meet them in Briarhollow.',
    objective: { kind: 'event', event: 'camp-scouts', label: 'Meet Fernstead’s rangers in Briarhollow' },
    after: ['the-harvest-stones'],
    zone: 'briarhollow',
    reward: { xp: 180, gold: 60, text: 'A watchfire burns by Briarhollow’s gate. The camp will see the Host coming now.' },
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
    id: 'the-harvest-stones',
    name: 'The Harvest Stones',
    giver: 'mother-alsa',
    auto: true,
    text: 'The Lady is at rest, but the Harvest Stones north of Fernstead are still grey, violet light creeping in their cracks, and the dead gather round them at night like moths at a lamp. Alsa’s old way still works, she says: light the chapel candles at the stones and keep the dead off them while the light takes. Hollis will send two rangers. Alsa’s knees won’t take her up there this year. Yours will.',
    objective: { kind: 'event', event: 'fern-stones', label: 'Hold the Harvest Stones while the candles burn' },
    after: ['lay-the-grey-lady'],
    zone: 'brackenridge',
    level: 8,
    reward: { xp: 260, gold: 80, item: 'corn-dolly', text: 'The grey goes out of the stones like frost off a window. Hollis keeps her word: six of her rangers are on the road to Briarhollow tonight.' },
  },
];

export const BRACKENRIDGE_NPCS: Record<string, NpcDef> = {
  'warden-hollis': {
    id: 'warden-hollis',
    name: 'Warden Hollis',
    title: 'Warden of Fernstead',
    sprite: 'villager',
    talk: [
      { when: { quest: 'epilogue-the-camp-goes-home', state: 'done' }, lines: ['Fernstead has a harvest festival this year. The first since the barrows woke. The Stones are lit, and every ranger I have is home.', 'We heard Briarhollow’s bell. I sent a rider to ask what was wrong. Nothing, he said. That’s what it means now.'] },
      {
        when: { quest: 'west-road', state: 'active' },
        lines: [
          'Briarhollow sent someone? Good. I asked Maren for a company. You’ll do.',
          'Every night there are lights on the ridge, and every morning something’s gone: a spade, a lamp, a sheep. Yesterday, my lamp. I liked that lamp.',
        ],
      },
      {
        when: { quest: 'the-old-barrows', state: 'active' },
        lines: ['Snagtooth’s tunnels run south-west, under the Old Barrows. Since they broke in, the dogs howl all night at nothing.', 'Go and see what they let out. Take a light. Not my lamp. They have my lamp.'],
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
      { when: { quest: 'fern-retaken', state: 'done' }, lines: ['Home. Half the roofs, none of the doors, all of the people. We’ll build doors.', 'You and Mara Venn came over that hill like the end of the world. I’ve decided I like the end of the world, when it’s on my side.'] },
      { when: { quest: 'camp-scouts', state: 'active' }, lines: ['Six rangers, my best, on the road to Briarhollow. Tell Maren they’re on loan. Tell her I’ll want them back. Tell her I won’t, really.'] },
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
          'Her husband was Edric, a Sigil-warden. He held these hills against the grey army out of the north, three hundred years gone, and they buried him in the Old Barrows with his shield.',
          'She sat by his mound and sang until she died, and they laid her beside him. Now she’s up and singing again, and the dead come when she calls. Something woke her, something old.',
        ],
      },
      {
        when: { quest: 'appleby-apples', state: 'active' },
        lines: ['The Applebys left their orchard when the kobolds came, south-east of here. The last cider apples are rotting on the trees.', 'Fill me a sack? Kobolds don’t eat apples. They throw them. Duck.'],
      },
      {
        when: { quest: 'the-harvest-stones', state: 'active' },
        lines: ['Apples, candles… and the old way. Light the candles at the Harvest Stones, north of Fernstead, and pour a cup for the hills.', 'They’ve gone grey, the stones. Grey and cold, with a light in them like a bruise. The dead sit round them at night.', 'Light the candles and keep the dead off till the wax takes. Silly? Maybe. It worked for my gran.'],
      },
      { when: { quest: 'lay-the-grey-lady', state: 'done' }, lines: ['Rest, Lady. Rest, Edric.', 'You’ll want a potion. Everyone wants a potion after a funeral.'] },
      { when: { quest: 'the-harvest-stones', state: 'done' }, lines: ['I could see the stones from the inn last night. Warm again, gold in the candlelight. I cried into the soup. Don’t tell anyone.', 'Keep that dolly by you. It’s never brought anyone luck. It’s never let anyone down, either.'] },
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
      { who: 'fern-ranger', text: 'Candles lit! Now keep them off the stone till the wax takes!' },
      { who: 'fern-ranger', text: 'Here they come. They hate the light, poor things.' },
    ],
    waves: [
      { enemies: ['restless-shade', 'restless-shade', 'barrow-skeleton'], from: ['fern-stones-n', 'fern-stones-w'] },
      { enemies: ['barrow-skeleton', 'barrow-skeleton', 'restless-shade', 'restless-shade'], from: ['fern-stones-e', 'fern-stones-n'], barks: [{ who: 'fern-ranger', text: 'The grey’s going out of it! Hold!' }] },
      { enemies: ['restless-shade', 'restless-shade', 'restless-shade', 'barrow-skeleton', 'barrow-skeleton'], from: ['fern-stones-w', 'fern-stones-e', 'fern-stones-n'], barks: [{ who: 'fern-ranger', text: 'Last of them! Then it’s ours again!' }] },
    ],
    end: [{ who: 'fern-ranger', text: 'Look at that. Warm as bread. Alsa will cry. She’ll say it’s the smoke.' }],
    retry: [{ who: 'fern-ranger', text: 'They put the candles out! Light them again — again!' }],
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
      { who: 'mara', text: 'They think we’re still counting tents. Let’s show them what we were counting for.' },
      { who: 'fern-ranger', text: 'For Fernstead! For the Warden!' },
    ],
    waves: [
      { enemies: ['legion-soldier', 'legion-soldier', 'legion-crossbowman', 'ash-raider'], from: ['fern-n', 'fern-e'] },
      { enemies: ['legion-soldier', 'legion-crossbowman', 'legion-crossbowman', 'ash-archer', 'ash-raider'], from: ['fern-w', 'fern-n'], barks: [{ who: 'mara', text: 'Shields on the left! Riders, take the lane!' }] },
      { enemies: ['legion-ensign', 'legion-soldier', 'legion-soldier', 'legion-soldier', 'legion-crossbowman', 'ash-raider'], from: ['fern-n', 'fern-e', 'fern-w'], barks: [{ who: 'fern-ranger', text: 'Their banner! Bring down their banner!' }] },
    ],
    end: [{ who: 'mara', text: 'That’s Fernstead. Somebody go and tell Hollis she can come home.' }],
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
    start: [{ who: 'fern-ranger', text: 'Rangers of Fernstead, for the camp! Where’s this watchfire we’re keeping?' }],
    waves: [],
    end: [{ who: 'mara-venn', text: 'By the gate. You can see the north road from there. Welcome to Briarhollow.' }],
  },
};
