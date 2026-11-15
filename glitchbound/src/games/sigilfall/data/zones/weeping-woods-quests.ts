import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * Candlewick's people and the quests of the Weeping Woods, the first of Vaelmoor beyond the Gloam Gate
 * (STORY_BIBLE.md §3, Act V). Candlewick was settled by the families of Aster's knights who died holding this
 * wood against the Hallow King three hundred years ago; the Gates cut it off from Aster, and it kept a candle
 * in every window the whole time. Lord Halvard's knights never left the wood, and now the Hallow King's call
 * is turning their eyes violet. In the wood lies Lark's Hollow, the lodge where Queen Ysane took her children
 * the winter the plague came, frozen in the night the fever came: the first of her echoes. Candlewife Hesper
 * keeps the candles and the Roll, the names of the dead: read a dead knight's name by candlelight and he lies
 * down. The main chain runs from Candlewick through the Wardens' Rest and Lark's Hollow to the Weeping Tree,
 * where Lord Halvard, the Weeping Lord, is losing to the call; beaten and named, he says only all seven sigils
 * together can end the Hallow King, and that the last hidden one is under the lake at Hollowmere. Sexton Abel
 * cuts down the hanged deserters, Chandler Miro makes the candle, and Woodward Fenn lays Halvard's old hound
 * to rest; Brother Orren, who came through the Gate first, sits in Candlewick's square. Main chain first.
 * Written to DIALOGUE_STYLE.md (plain, direct, no punchlines).
 */
export const WEEPING_WOODS_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-candle-road',
    name: 'The Candle Road',
    giver: 'orren-in-vaelmoor',
    auto: true,
    text: 'Candlewick’s people are descended from Aster’s knights who died fighting in this wood three hundred years ago. Their families stayed to tend the graves, and the Gates cut them off from Aster. Hesper, the candlewife, keeps the names of the dead. She wants to meet you.',
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
    text: 'Lord Halvard’s knights died defending this wood, and their ghosts have guarded it ever since. Now their eyes glow violet, and they attack anyone on the roads. Hesper fears the Hallow King is calling them to join his Host. Go to their hall, the Wardens’ Rest, north-west of Candlewick.',
    objective: { kind: 'explore', spot: 'wardens-rest', label: 'Go to the Wardens’ Rest north-west of Candlewick' },
    after: ['the-candle-road'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 1800, gold: 540, text: 'The knights at the Rest are fighting the Hallow King’s call, and losing. Every one of them faces the same way: toward Lark’s Hollow, an old royal lodge south-east of the hall. Whatever is pulling at them is there.' },
  },
  /* -------------------------------------------------- Queen Ysane's first echo */
  {
    id: 'the-frozen-hamlet',
    name: 'Lark’s Hollow',
    giver: 'orren-in-vaelmoor',
    auto: true,
    text: 'Lark’s Hollow is the lodge where Queen Ysane, the Hallow King’s wife, took her children the winter the plague came. Orren went as far as the trees and heard children’s voices inside. He won’t go in alone, so he is coming with you. Go to Lark’s Hollow, south-east of the Wardens’ Rest.',
    objective: { kind: 'explore', spot: 'larks-hollow', label: 'Go to Lark’s Hollow south-east of the Wardens’ Rest' },
    after: ['the-wardens-rest'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 1800, gold: 540, text: 'A woman in a grey crown stands at the lodge door, calling two names into the snow. She is an echo of Queen Ysane, a memory the Ash Crown has kept for three hundred years. Her children, Lark and Edda, are out in the frozen wood.' },
  },
  {
    id: 'wood-the-children',
    name: 'Two Names in the Snow',
    giver: 'orren-in-vaelmoor',
    auto: true,
    text: 'The night the fever came, Lark and Edda ran out into the snow to look for their father. Their echoes are still out there. The Hallow King is calling them to him, and the wood’s dead are coming to take them. Lead the children back to their mother’s door.',
    objective: { kind: 'event', event: 'wood-the-children', label: 'Lead Lark and Edda to the lodge door' },
    after: ['the-frozen-hamlet'],
    zone: 'weeping-woods',
    level: 49,
    reward: {
      xp: 2600,
      gold: 640,
      text: 'At the door, Ysane kneels and holds her children, and the frost leaves the hollow. “He rode for the physicians,” she says. “He was back by morning, and he sat between our beds all winter. Tell him we know he tried. Tell him it was all right.” Then the echoes are gone. Orren sits down in the snow and doesn’t speak for a long time.',
    },
  },
  {
    id: 'the-weeping-tree',
    name: 'The Weeping Tree',
    auto: true,
    giver: 'candlewife-hesper',
    text: 'Lord Halvard still fights the Hallow King’s call, but he is losing. If he gives in, his knights will follow him north to join the Host. A dead knight rests when his name is read to him by candlelight, and Chandler Miro has made a candle that stays lit even near Halvard. Take it to the Weeping Tree in the far north-west of the wood.',
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
    text: 'Halvard stands under the Weeping Tree with violet in his eyes. He can’t hear his own name while he is still fighting. Beat him down, then read him his name by the light of Miro’s candle. Hesper has written it out for you.',
    objective: { kind: 'kill', region: 'weeping-woods', count: 1, enemies: ['the-weeping-lord'], label: 'Defeat the Weeping Lord at the Weeping Tree' },
    after: ['the-weeping-tree'],
    zone: 'weeping-woods',
    level: 50,
    reward: {
      xp: 8100,
      gold: 2000,
      item: 'the-wardens-oath',
      text: 'Halvard falls to one knee. You read him his name by candlelight, and the violet leaves his eyes. “We never beat him. We sealed him away,” he says. “Only all seven sigils together can end the Hallow King. One of them, the Sigil of Tides, never left Vaelmoor. It is under the lake at Hollowmere, where his queen is buried.” Then he lays down his sword, and every dead knight in the wood lies down with him. Hesper gives you his silver oath-star.',
    },
  },
  /* ---------------------------------------------- Sexton Abel's hanged men */
  {
    id: 'the-hanging-oaks',
    name: 'The Hanging Oaks',
    giver: 'sexton-abel',
    text: 'Sexton Abel has dug Candlewick’s graves for forty years. Thirty graves still wait for their dead: deserters Lord Halvard hanged from the oaks before his last battle. They are still on their ropes, and they attack anyone who comes near. Go to the Hanging Oaks, west of Candlewick, and look.',
    objective: { kind: 'explore', spot: 'the-hanging-oaks', label: 'Find the Hanging Oaks west of Candlewick' },
    after: ['the-candle-road'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 800, gold: 540 },
  },
  {
    id: 'cut-them-down',
    name: 'Cut Them Down',
    giver: 'sexton-abel',
    text: 'The hanged men swing down at anyone who walks under them. Abel has their graves ready. Cut down eight of them, at the Hanging Oaks or on the roads.',
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
    text: 'Abel found letters in the dead men’s pockets, to wives, to mothers and one to a dog. None were ever sent. The men ran because they had seen the Host coming and wanted to warn their families. Bring Abel five more letters from the hanged men, so he can bury each man with his own.',
    objective: { kind: 'loot', region: 'weeping-woods', item: 'Deserter’s Letter', from: ['hanged-man'], chance: 0.4, count: 5, label: 'Take Deserter’s Letters from hanged men' },
    after: ['cut-them-down'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 1300, gold: 900, item: 'deserters-cloak', text: 'Abel buries the deserters in the churchyard with their letters in their hands. He reads every letter aloud, even the one to the dog. He gives you a cloak he took down from the oaks.' },
  },
  /* ------------------------------------------- Chandler Miro's snuffed candles */
  /* ------------------------------------------------- Woodward Fenn's hounds */
  {
    id: 'hounds-of-the-wolf-barrow',
    name: 'Hounds of the Barrow',
    giver: 'woodward-fenn',
    text: 'The knights’ wolfhounds were buried with them in the Wolf Barrow, north of Candlewick, and they always stayed there. Now they hunt the roads in pairs, and Woodward Fenn’s own dog hasn’t come home. Put down eight grave wolves.',
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
    text: 'Fenn found his dog alive, stuck up a tree. He also saw what chased it there: Old Vigil, Lord Halvard’s wolfhound, who guards his master’s empty grave in the Wolf Barrow. Halvard never came home to fill it, and now Vigil attacks everyone who passes. Lay the old hound to rest at the Wolf Barrow, north of Candlewick.',
    objective: { kind: 'kill', region: 'weeping-woods', count: 1, enemies: ['old-vigil'], label: 'Lay Old Vigil to rest at the Wolf Barrow' },
    after: ['hounds-of-the-wolf-barrow'],
    zone: 'weeping-woods',
    level: 50,
    reward: { xp: 1300, gold: 920, item: 'vigils-collar', text: 'Fenn buries the old hound in his master’s empty grave and gives you his collar.' },
  },
];

export const WEEPING_WOODS_NPCS: Record<string, NpcDef> = {
  'orren-in-vaelmoor': {
    id: 'orren-in-vaelmoor',
    name: 'Brother Orren',
    title: 'A long way from his chapel',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'into-vaelmoor', state: 'active' },
        lines: [
          'You came. This is Candlewick, a village of living people in the middle of the dead kingdom.',
          'They’ve been shut in with the dead for three hundred years, and they kept a candle in every window.',
          'I’ve been a priest for forty years, and I’ve never seen faith like this.',
        ],
      },
      {
        when: { quest: 'the-frozen-hamlet', state: 'active' },
        lines: [
          'The knights all face Lark’s Hollow. It’s the lodge where the queen took her children the winter the plague came.',
          'I went as far as the trees. I could hear children in there, playing in the snow.',
          'I had a little brother once. I don’t want to go in alone.',
        ],
      },
      { when: { quest: 'wood-the-children', state: 'active' }, lines: ['For forty years I’ve said the dead must stay dead. Those children aren’t dead, though. They’re memories.', 'I don’t know what we owe a memory. But we can bring them to their mother’s door.'] },
      { when: { quest: 'the-weeping-lord', state: 'done' }, lines: ['Halvard said the Sigil of Tides is hidden under the lake at Hollowmere.', 'I’m afraid of deep water. I’ll come anyway.'] },
      { when: { quest: 'wood-the-children', state: 'done' }, lines: ['Ysane wanted her husband to know he did everything he could. She was talking to him, through us.', 'He built the whole Host to get his family back. And all she wanted was to tell him it wasn’t his fault.'] },
      { lines: ['Candlewick’s chapel has no priest, so I ring its bell at dusk. People thank me every time.', 'I still believe the dead must stay dead. This place makes it harder to believe.'] },
    ],
  },
  'echo-of-ysane': {
    id: 'echo-of-ysane',
    name: 'Queen Ysane',
    title: 'An echo',
    sprite: 'villager',
    talk: [
      { when: { quest: 'wood-the-children', state: 'done' }, lines: ['He rode for the physicians. He was back by morning, and he sat between our beds all winter.', 'Tell him we know he tried. Tell him it was all right.'] },
      { lines: ['Lark! Edda! Come inside, it’s snowing. Your father will be home soon.', 'Have you seen my children? They went out to look for their father.'] },
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
        lines: [
          'Your priest says you came from Aster. Nobody from outside has come up the road in three hundred years.',
          'I’m Hesper. I keep the candles, and the Roll, our book of the names of the dead.',
          'When I read a dead knight’s name by candlelight, he lies down and rests. Lately there are too many of them.',
        ],
      },
      {
        when: { quest: 'the-wardens-rest', state: 'active' },
        lines: [
          'Lord Halvard’s knights have guarded this wood since they died here. They never hurt any of us.',
          'Now their eyes glow violet, and they attack anyone on the roads. I think the Hallow King is calling them.',
          'Their hall is the Wardens’ Rest, north-west of here. Please find out what’s happening.',
        ],
      },
      {
        when: { quest: 'the-weeping-tree', state: 'active' },
        lines: ['Miro has made a candle that won’t go out, even next to Halvard. Take it, and this paper with his name on it.', 'Find him at the Weeping Tree, in the far north-west of the wood.'],
      },
      {
        when: { quest: 'the-weeping-lord', state: 'active' },
        lines: ['Halvard can’t hear his name while he’s still fighting.', 'Beat him down, as gently as you can. Then read him his name. He has waited three hundred years to be told he can rest.'],
      },
      {
        when: { quest: 'the-dead-lake', state: 'offered' },
        lines: ['Halvard said the Sigil of Tides is hidden under the lake at Hollowmere. I’ve written it in the Roll.', 'The north road out of the wood goes there. The Ferryman keeps a landing on the lake’s south shore.'],
      },
      {
        when: { quest: 'the-weeping-lord', state: 'done' },
        lines: ['The wood is quiet now. I can hear birds again. I’d forgotten there were birds.', 'I still light the candles every night. It’s a habit, and I like to think someone sees them.'],
      },
      { lines: ['This is Candlewick. We keep a candle in every window, and a name for every grave.', 'Stay on the roads after dark. If a light in the wood calls your name, don’t follow it.'] },
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
        lines: ['I’ve dug Candlewick’s graves for forty years, like my father and his father. Thirty graves have always stood empty.', 'They’re for the deserters Halvard hanged from the oaks west of town. They’re still on their ropes, and they fight anyone who comes near.'],
      },
      {
        when: { quest: 'cut-them-down', state: 'active' },
        lines: ['They swing down at anyone who walks under them. Three hundred years on a rope would make anyone angry.', 'Their graves are dug. Cut eight of them down, and I’ll do the rest.'],
      },
      {
        when: { quest: 'letters-never-sent', state: 'active' },
        lines: ['I found letters in their pockets. To wives, to mothers, one to a dog. None of them were ever sent.', 'They didn’t run from the fight. They ran home to warn their families. Bring me five more letters, so every man is buried with his own.'],
      },
      { when: { quest: 'letters-never-sent', state: 'done' }, lines: ['I read every letter at the graves, even the one to the dog.', 'Keep the cloak. Those men weren’t cowards. They were trying to save their families.'] },
      { when: { quest: 'the-weeping-lord', state: 'done' }, lines: ['The dead in the wood have all lain down. For the first time in my life, there’s nobody left to bury.'] },
      { lines: ['This is the Lych-Gate. Beds upstairs, potions behind the bar.', 'Sit by the fire and warm up. It’s the safest light in Candlewick.'] },
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
        lines: ['Here’s the candle. Willow wax, and a wick spun from a knight’s linen. It burns blue, and it won’t go out. I tried.', 'Take it to the Weeping Tree. And come back safe.'],
      },
      { lines: ['This is Miro’s Tallow & Wick. Candles, lamps, charms and curios.', 'Every candle in Candlewick comes from this shop. Buy a spare before you go into the wood.'] },
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
        lines: ['I’ve kept these paths for thirty years. The barrow hounds were the knights’ dogs, buried with their masters. They always stayed in their barrow.', 'Now they hunt the roads in pairs, and my dog Bramble hasn’t come home. Put some of them down, around the Wolf Barrow north of town.'],
      },
      {
        when: { quest: 'old-vigil', state: 'active' },
        lines: ['I found Bramble. He was up a tree, alive and shaking. I saw what chased him there.', 'It was Old Vigil, Lord Halvard’s own wolfhound. He’s guarded his master’s empty grave in the barrow for three hundred years. Please let the old dog rest.'],
      },
      { when: { quest: 'old-vigil', state: 'done' }, lines: ['I buried Vigil in Halvard’s grave. He waited long enough for his master.', 'Bramble sleeps on my feet now. He won’t leave my side.'] },
      { lines: ['I’m Fenn. I keep the paths open and the wood out of the village.', 'If you hear a hound behind you on the road, don’t run. Turn and face it.'] },
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
    banner: 'The Queen’s Children',
    start: [
      { who: 'echo-child', text: 'Papa? Is that you? Did you bring the doctors?' },
      { who: 'orren', text: 'They can’t really hear us. They’re looking for a light. Walk, and they’ll follow you.' },
    ],
    waves: [
      { enemies: ['weeping-specter', 'weeping-specter', 'mourning-willow'], from: ['hollow-n', 'hollow-e'] },
      { enemies: ['weeping-specter', 'weeping-specter', 'weeping-specter', 'grave-wolf'], from: ['hollow-e', 'hollow-s'], barks: [{ who: 'orren', text: 'More dead, coming for the children! Keep them away!' }] },
    ],
    end: [
      { who: 'echo-of-ysane', text: 'There you are. Come inside, you’re frozen.' },
      { who: 'orren', text: 'Go in, little ones. Go in and rest.' },
    ],
    retry: [{ who: 'orren', text: 'We lost them! Back to the trees, they’re still out there!' }],
  },
};
