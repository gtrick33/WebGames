import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Candlewick's people and the quests of the Weeping Woods, the first of Vaelmoor beyond the Gloam Gate
 * (STORY_BIBLE.md §3, Act V). Candlewick is the warden-village the Sigil-wardens left inside the Dead
 * Kingdom to keep watch over their fallen; the Gates cut it off for three hundred years, and it kept a candle
 * in every window the whole time. The wardens who fell here in the first war never left the wood, and since
 * the Ash Crown woke it has been calling them north. In the wood lies Lark's Hollow, the summer lodge where
 * Queen Ysane took her children in the plague winter, frozen in the moment it died: the first of her echoes. Candlewife Hesper keeps the candles and the Roll of the Wood, the names of the
 * dead: read a warden's name by candlelight and he lies down. The main chain runs from the restless
 * dead around Candlewick through the Wardens' Rest, where the Hallow King's call has turned the knights'
 * eyes violet, to the Weeping Tree, where Lord Edric, the Weeping Lord, still holds the wood to his
 * oath and is losing it; beaten and named, he tells how Vaelor was beaten the first time, and the road
 * goes north to Gloamhollow. Sexton Abel cuts down the hanged deserters, Chandler Miro wants the
 * candle-snuffer of the Drowned Bell Chapel hushed, and Woodward Fenn lays Edric's old hound to rest; Brother Orren, who came through the Gate
 * first, sits in Candlewick's square. Main chain first.
 */
export const WEEPING_WOODS_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-candle-road',
    name: 'The Candle Road',
    giver: 'orren-in-vaelmoor',
    auto: true,
    text: 'Candlewick is alive. Nobody in Aster knew: a village of the Sigil-wardens’ families, left inside Vaelmoor three hundred years ago to keep watch over the fallen, and shut in behind the Gates when they were built. They kept a candle in every window the whole time. Orren has been talking to their candlewife for two days. She wants to talk to you.',
    objective: { kind: 'talk', npc: 'candlewife-hesper', label: 'Talk to Candlewife Hesper in Candlewick' },
    after: ['into-vaelmoor'],
    zone: 'weeping-woods',
    level: 48,
    reward: { xp: 1750, gold: 520 },
  },
  /* ------------------------------------------------------ the Weeping Lord */
  {
    id: 'the-wardens-rest',
    name: 'The Wardens’ Rest',
    auto: true,
    giver: 'candlewife-hesper',
    text: 'Every plate you brought bears the same badge: a star over a weeping tree, the mark of Lord Edric’s own company. Edric held this wood against Vaelor in the first war, and his company garrisoned the Wardens’ Rest, the old hall in the middle of the wood, north-west of Candlewick. Those knights never left their posts in three hundred years. Hesper wants to know what has called them off. Go and look.',
    objective: { kind: 'explore', spot: 'wardens-rest', label: 'Go to the Wardens’ Rest north-west of town' },
    after: ['the-candle-road'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 1800, gold: 540, text: 'The knights at the Rest stand at their posts with their backs to the hall, facing east, toward something in the wood. Orren follows their eyes and finds a path no map has: it goes to a house in a hollow, with smoke standing over its chimney that does not move.' },
  },
  /* -------------------------------------------------- Queen Ysane's first echo */
  {
    id: 'the-frozen-hamlet',
    name: 'Lark’s Hollow',
    giver: 'orren-in-vaelmoor',
    auto: true,
    text: 'The path from the Wardens’ Rest goes east to Lark’s Hollow: a royal lodge and its hamlet in a fold of the wood, frosted over, with its bonfire burning and not burning, exactly as it was on the night Vaelmoor died. Orren will not go in alone. He says it is because of the dead. It is because of the bonfire.',
    objective: { kind: 'explore', spot: 'larks-hollow', label: 'Go into Lark’s Hollow with Orren' },
    after: ['the-wardens-rest'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 1800, gold: 540, text: 'A woman in a grey crown stands at the lodge door, calling two names into the snow, over and over, the same breath every time. She is not a ghost. She is a memory, and the Ash Crown is keeping it very carefully, the way you keep a letter you can’t read without crying.' },
  },
  {
    id: 'wood-the-children',
    name: 'Two Names in the Snow',
    giver: 'orren-in-vaelmoor',
    auto: true,
    text: 'The echo at the door is Queen Ysane, Vaelor’s wife, three hundred years dead, calling her children in. They are out in the frozen wood: two small grey shapes running from tree to tree, looking for their father, who went north to the fallen star that night and did not come back in time. The memory has been stuck at its worst moment for three centuries, and the wood’s grief has come to feed on it. Find the children and bring them home to her door.',
    objective: { kind: 'event', event: 'wood-the-children', label: 'Lead the queen’s children home through the frozen wood' },
    after: ['the-frozen-hamlet'],
    zone: 'weeping-woods',
    level: 49,
    reward: {
      xp: 2600,
      gold: 640,
      text: 'At the door Ysane kneels and holds them, and the frost goes out of the hollow all at once. “He went to get the star,” she tells you, as if you had asked. “For the fever. He said he would be back by morning. Tell him we waited. Tell him we waited and it was all right.” Then she is gone, and the bonfire is only ash. Orren sits down in the snow and doesn’t say anything for a long time.',
    },
  },
  {
    id: 'the-weeping-tree',
    name: 'The Weeping Tree',
    auto: true,
    giver: 'candlewife-hesper',
    text: 'Miro’s candle burns blue and will not go out; he tried, quite hard. Hesper would carry it herself if she were forty years younger and owned a sword. You will carry it. Find the Weeping Tree in the far north-west of the wood, where Lord Edric waits, and see how far the Hallow King’s call has got into him.',
    objective: { kind: 'explore', spot: 'the-weeping-tree', label: 'Find the Weeping Tree in the far north-west' },
    after: ['wood-the-children'],
    zone: 'weeping-woods',
    level: 50,
    reward: { xp: 1900, gold: 580 },
  },
  {
    id: 'the-weeping-lord',
    name: 'The Weeping Lord',
    auto: true,
    giver: 'candlewife-hesper',
    text: 'Under the Weeping Tree stands Lord Edric of the Sigil-wardens, who swore to hold the wood until Vaelor fell and has held it for three hundred years, with his tears frozen on his helm. The Hallow King’s violet is in his eyes now. He is fighting it, and losing, and he will not hear his name while he stands. Beat him down at the Weeping Tree in the far north-west, and let Hesper read his name over him by Miro’s candle.',
    objective: { kind: 'kill', region: 'weeping-woods', count: 1, enemies: ['the-weeping-lord'], label: 'Bring down the Weeping Lord at the Weeping Tree' },
    after: ['the-weeping-tree'],
    zone: 'weeping-woods',
    level: 50,
    reward: {
      xp: 8100,
      gold: 2000,
      item: 'the-wardens-oath',
      text: 'Edric goes down on one knee in the candlelight, and Hesper reads his name, and the violet goes out of his eyes. “We did not beat him with swords,” he says. “We beat him when the seven sigils were raised against him together. Not one. Not six. All seven.” He lays his sword under the tree, and all through the wood the dead lie down with him. Then, more quietly: “His queen is under the lake at Hollowmere. He goes there. He still goes there.” Hesper gives you his oath, engraved in a silver star.',
    },
  },
  /* ---------------------------------------------- Sexton Abel's hanged men */
  {
    id: 'the-hanging-oaks',
    name: 'The Hanging Oaks',
    giver: 'sexton-abel',
    text: 'Sexton Abel has dug every grave in Candlewick for forty years, as his father did, and his. Every grave but thirty: the deserters Lord Edric hanged from the oaks on the night before the last battle, who have hung there ever since because no sexton would cut them down. Abel would now, he says, if they’d stop kicking. Go and see the Hanging Oaks, due west of Candlewick.',
    objective: { kind: 'explore', spot: 'the-hanging-oaks', label: 'Find the Hanging Oaks west of town' },
    after: ['the-candle-road'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 800, gold: 540 },
  },
  {
    id: 'cut-them-down',
    name: 'Cut Them Down',
    giver: 'sexton-abel',
    text: 'The hanged swing down off their ropes at anyone who walks under them: thirty men who ran from the last battle and got no further than these trees. Abel has their graves dug, three hundred years late. Cut eight of them down, at the Hanging Oaks west of town or wherever they hang along the roads.',
    objective: { kind: 'kill', region: 'weeping-woods', count: 8, enemies: ['hanged-man'], label: 'Cut down hanged men' },
    after: ['the-hanging-oaks'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 800, gold: 540 },
  },
  {
    id: 'letters-never-sent',
    name: 'Letters Never Sent',
    giver: 'sexton-abel',
    text: 'In the pockets of the men you cut down, Abel found letters, never sent: to wives, to mothers, one to a dog. They ran, the letters say, because they had seen what was coming out of the north and wanted to get home and warn somebody. Abel would like the rest, so he can bury each man with his own. Five more letters, from the hanged men at the Oaks or anywhere in the wood.',
    objective: { kind: 'loot', region: 'weeping-woods', item: 'Deserter’s Letter', from: ['hanged-man'], chance: 0.4, count: 5, label: 'Take Deserter’s Letters from hanged men' },
    after: ['cut-them-down'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 1300, gold: 900, item: 'deserters-cloak', text: 'Abel buries the deserters in the churchyard with their letters in their hands and reads every one aloud, even the one to the dog. He gives you a cloak he cut down from the oaks.' },
  },
  /* ------------------------------------------- Chandler Miro's snuffed candles */
  /* ------------------------------------------------- Woodward Fenn's hounds */
  {
    id: 'hounds-of-the-wolf-barrow',
    name: 'Hounds of the Barrow',
    giver: 'woodward-fenn',
    text: 'Woodward Fenn has kept the paths of the Weeping Woods clear for thirty years, and the hounds of the Wolf Barrow were the one thing he left alone: wardens’ wolfhounds, buried with their masters, who kept to their barrow. Since Vaelor woke they hunt the roads in pairs, and Fenn’s own dog has not come home. Put down eight of them, around the Wolf Barrow north of Candlewick or wherever they run.',
    objective: { kind: 'kill', region: 'weeping-woods', count: 8, enemies: ['grave-wolf'], label: 'Put down grave wolves' },
    after: ['the-candle-road'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 850, gold: 560 },
  },
  {
    id: 'old-vigil',
    name: 'Old Vigil',
    giver: 'woodward-fenn',
    text: 'Fenn found his dog alive, up a tree, and very cross. He also found what put it there: Old Vigil, Lord Edric’s own wolfhound, as big as a pony, who has kept watch over his master’s empty grave in the Wolf Barrow for three hundred years. Edric never came home to fill it, and lately Vigil takes everyone on the road for the men who kept him away. Lay the old hound to rest at the Wolf Barrow, north of town.',
    objective: { kind: 'kill', region: 'weeping-woods', count: 1, enemies: ['old-vigil'], label: 'Lay Old Vigil to rest at the Wolf Barrow' },
    after: ['hounds-of-the-wolf-barrow'],
    zone: 'weeping-woods',
    level: 50,
    reward: { xp: 1300, gold: 920, item: 'vigils-collar', text: 'Fenn buries the old hound in his master’s empty grave, which seems fair to everyone, and gives you his collar.' },
  },
];

export const WEEPING_WOODS_NPCS: Record<string, NpcDef> = {
  'orren-in-vaelmoor': {
    id: 'orren-in-vaelmoor',
    name: 'Brother Orren',
    title: 'A long way from his chapel',
    sprite: 'villager',
    talk: [
      { when: { quest: 'into-vaelmoor', state: 'active' }, lines: ['You came. Good. Sit. Look at them.', 'A whole village, three hundred years shut in with the dead, and they kept their candles lit and their manners. I have been a priest of the Lantern for forty years and I have never seen anything so holy.'] },
      { when: { quest: 'the-frozen-hamlet', state: 'active' }, lines: ['There is a house in the wood that the knights all face. I went as far as the trees. There is a bonfire there that is burning and not burning.', 'I don’t want to go in alone. Not because of the dead. I have spent my life with the dead. Because of the fire.'] },
      { when: { quest: 'wood-the-children', state: 'active' }, lines: ['The dead must stay dead. I have said it at every graveside for forty years. Those two children aren’t dead. They’re remembered. I don’t know what we owe that.', 'Bring them to her door. That much I know.'] },
      { when: { quest: 'wood-the-children', state: 'done' }, lines: ['She said, tell him we waited and it was all right. She was talking to him. Through us.', 'He did all of this, the Host, the Crown, the Tear, to hear her say that. And she has been saying it for three hundred years in a hollow in the snow.'] },
      { when: { quest: 'the-weeping-lord', state: 'done' }, lines: ['Edric said his queen is under the lake at Hollowmere. I knew a lake like that once. Everyone has one.', 'We should go. I would rather not. We should go.'] },
      { lines: ['Candlewick has a chapel with no priest. I have been ringing its bell at dusk. They say thank you every time.', 'The dead must stay dead. I still believe it. I’d just like it to be easier to believe.'] },
    ],
  },
  'echo-of-ysane': {
    id: 'echo-of-ysane',
    name: 'Queen Ysane',
    title: 'An echo',
    sprite: 'villager',
    talk: [
      { when: { quest: 'wood-the-children', state: 'done' }, lines: ['He went to get the star. For the fever. He said he would be back by morning.', 'Tell him we waited. Tell him it was all right.'] },
      { lines: ['Aldis! Wenna! Come in now, it’s snowing. Your father will be home soon.', 'Have you seen my children? Two of them. This high. They went out to find their father.'] },
    ],
  },
  'candlewife-hesper': {
    id: 'candlewife-hesper',
    name: 'Candlewife Hesper',
    title: 'Candlewife of Candlewick',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-candle-road', state: 'active' },
        lines: ['Your priest says you’re from Aster. From outside. I’ve never met anyone from outside. I’d hoped for wings.', 'I’m Hesper. I keep the candles, and the names of the dead. Lately the dead have been keeping me.'],
      },
      {
        when: { quest: 'the-wardens-rest', state: 'active' },
        lines: ['Every plate has the same badge: a star over a weeping tree. Lord Edric’s company. They held the Wardens’ Rest, the old hall north-west of here, in the middle of the wood.', 'They never leave their posts. Something has called them off. Go and see what.'],
      },
      {
        when: { quest: 'the-weeping-tree', state: 'active' },
        lines: ['The candle burns. I’d carry it myself if I were forty years younger and owned a sword.', 'The Weeping Tree is in the far north-west of the wood. Find him. See how much of him is still ours.'],
      },
      {
        when: { quest: 'the-weeping-lord', state: 'active' },
        lines: ['He’s fighting the Hallow King’s call, and losing, and he won’t hear his name while he stands.', 'So knock him down, gently if you can, and I’ll read it over him. He has waited three hundred years for someone to tell him he can stop.'],
      },
      {
        when: { quest: 'the-dead-lake', state: 'offered' },
        lines: [
          'Seven sigils, raised together. Not one, not six. I’ve written it in the Roll, in the margin, in very large letters.',
          'And his queen under the lake at Hollowmere. The road north of the wood goes there; the Ferryman keeps the landing. Tell him Candlewick sends its love, and no candles. We need them.',
        ],
      },
      {
        when: { quest: 'the-weeping-lord', state: 'done' },
        lines: ['The wood is quiet. Properly quiet, the kind you can hear birds in. I’d forgotten there were birds.', 'I still light the candles. Habit. And it’s nice to think somebody sees them.'],
      },
      { lines: ['Candlewick. A candle in every window, a name for every grave, and nobody out after dark who wants to stay that way.', 'Keep to the roads. If a light in the wood calls your name, it isn’t a friend.'] },
    ],
  },
  'sexton-abel': {
    id: 'sexton-abel',
    name: 'Sexton Abel',
    title: 'Sexton and Innkeeper',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Lych-Gate',
    talk: [
      {
        when: { quest: 'the-hanging-oaks', state: 'active' },
        lines: ['Forty years I’ve dug Candlewick’s graves, like my father, and his. Every grave but thirty.', 'Thirty deserters, hanged from the oaks due west of town the night before the last battle. Nobody would cut them down. I would, if they’d stop kicking. Go and look.'],
      },
      {
        when: { quest: 'cut-them-down', state: 'active' },
        lines: ['They swing down at anyone who walks under them. Can’t blame them. Three hundred years on a rope would make me cross.', 'I’ve dug their graves. Cut eight of them down for me, and I’ll do the rest.'],
      },
      {
        when: { quest: 'letters-never-sent', state: 'active' },
        lines: ['Letters, in their pockets. To wives, to mothers, one to a dog. Never sent.', 'They didn’t run from the fight. They ran to warn their homes what was coming. Five more letters, from the hanged, so every man goes down with his own.'],
      },
      { when: { quest: 'letters-never-sent', state: 'done' }, lines: ['I read every letter at the graves. Even the one to the dog. Especially that one.', 'Wear the cloak. Running’s no shame if you’re running the right way.'] },
      { when: { quest: 'the-weeping-lord', state: 'done' }, lines: ['The wood’s gone quiet. For the first time in my life there’s nobody for me to dig for. I’ll find something. I always do.'] },
      { lines: ['The Lych-Gate. Beds upstairs, potions behind the bar, and the churchyard out back for those who don’t take the potions.', 'Sit by the fire. It’s the only light in Candlewick nobody’s afraid of losing.'] },
    ],
  },
  'chandler-miro': {
    id: 'chandler-miro',
    name: 'Chandler Miro',
    title: 'Chandler',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Miro’s Tallow & Wick',
    talk: [
      {
        when: { quest: 'the-weeping-tree', state: 'active' },
        lines: ['There. Willow-wax, a wick of warden’s linen and three nights’ work. It burns blue and cold and it won’t go out. I tried. I tried quite hard.', 'Take it to the Weeping Tree. Bring it back if it’s any good. Bring yourself back regardless.'],
      },
      { lines: ['Miro’s Tallow & Wick. Candles, lamps, charms, curios, and one cat, not for sale.', 'Every candle in Candlewick comes from this shop. If yours goes out in the wood, that was the wood’s fault, not mine.'] },
    ],
  },
  'woodward-fenn': {
    id: 'woodward-fenn',
    name: 'Woodward Fenn',
    title: 'Woodward of Candlewick',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'hounds-of-the-wolf-barrow', state: 'active' },
        lines: ['Thirty years I’ve kept these paths. The barrow hounds I always left alone: wardens’ dogs, buried with their masters. They kept to their barrow.', 'Now they run the roads in pairs, and my dog Bramble hasn’t come home. Put some of them down for me, round the Wolf Barrow north of town.'],
      },
      {
        when: { quest: 'old-vigil', state: 'active' },
        lines: ['Found Bramble. Up a tree, alive, and very cross with me. Found what put him there, too.', 'Old Vigil: Lord Edric’s own hound, big as a pony, keeping watch on his master’s empty grave in the barrow. Three hundred years waiting for a man who never came home. Let the old dog rest.'],
      },
      { when: { quest: 'old-vigil', state: 'done' }, lines: ['I buried him in Edric’s grave. Somebody ought to be in it, and he’d waited long enough.', 'Bramble sleeps on my feet now. He won’t say what he saw. Neither will I.'] },
      { lines: ['Woodward Fenn. I keep the paths open and the wood out of the village. Mostly.', 'If you hear a hound behind you on the road, don’t run. They like it when you run.'] },
    ],
  },
};
/** Lark's Hollow: Queen Ysane's first echo (Act V). */
export const WEEPING_WOODS_EVENTS: Record<string, StoryEventDef> = {
  'wood-the-children': {
    id: 'wood-the-children',
    region: 'weeping-woods',
    kind: 'rescue',
    at: 'hollow-wood',
    radius: 8,
    level: 49,
    allies: ['orren'],
    rescue: { pets: ['echo-child', 'echo-child'], at: 'hollow-wood', to: 'hollow-door' },
    banner: 'An echo',
    start: [
      { who: 'echo-child', text: 'Is it Papa? Papa, did you get the star? Mama says you went to get the star.' },
      { who: 'orren', text: 'They can’t hear you. Not really. Just walk, and they’ll follow the light. That’s what they’re looking for.' },
    ],
    waves: [
      { enemies: ['weeping-specter', 'weeping-specter', 'mourning-willow'], from: ['hollow-n', 'hollow-e'] },
      { enemies: ['weeping-specter', 'weeping-specter', 'weeping-specter', 'grave-wolf'], from: ['hollow-e', 'hollow-s'], barks: [{ who: 'orren', text: 'The wood’s grief. It has been eating this memory for three hundred years. It doesn’t want to stop.' }] },
    ],
    end: [
      { who: 'echo-of-ysane', text: 'There you are. There you are. Come in, come in, you’re frozen.' },
      { who: 'orren', text: 'Let them go. Please. Let them go in.' },
    ],
    retry: [{ who: 'orren', text: 'Back to the trees. They’re still out there. They’re always still out there.' }],
  },
};
