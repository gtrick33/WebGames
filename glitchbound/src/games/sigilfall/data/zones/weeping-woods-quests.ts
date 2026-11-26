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
    text: 'Candlewick’s people are the families of Aster’s knights, who died holding this wood against the Hallow King three hundred years ago. The families stayed to tend the graves, and the Gates shut them in. Candlewife Hesper keeps the candles and the names of the dead. She wants to meet you in Candlewick’s square.',
    // (it was a walk and a talk. She keeps a candle for every name: a guest lights three, and reads who they were)
    objective: {
      kind: 'use', region: 'weeping-woods', at: 'candlewife-hesper', count: 3, thing: 'candle', verb: 'Light a candle', label: 'Light three candles at Hesper’s wall of names', secs: 1, spread: 5,
      notes: ['“Ser Aldric of the Vale. He held the east road.”', '“Dame Ysolt. She sent her squire home first.”', 'A blank candle. For whoever comes next, Hesper says.'],
    },
    then: [{ kind: 'talk', npc: 'candlewife-hesper', label: 'Talk to Candlewife Hesper in Candlewick' }],
    after: ['into-vaelmoor'],
    zone: 'weeping-woods',
    level: 48,
    reward: { xp: 1750, gold: 520, text: 'Hesper keeps the Roll, the book of every name Candlewick has buried. When she reads a dead knight his name by candlelight, he lies down and rests. For three hundred years the knights of the wood never needed it. This month they have started to turn.' },
  },
  /* ------------------------------------------------------ the Weeping Lord */
  {
    id: 'the-wardens-rest',
    name: 'The Wardens’ Rest',
    auto: true,
    giver: 'candlewife-hesper',
    text: 'Lord Halvard’s knights died holding this wood for Aster, and their ghosts have guarded Candlewick ever since. This month their eyes turned violet, and now they attack anyone on the roads. Hesper fears the Hallow King is calling them north to join his Host. Go to their hall, the Wardens’ Rest, north-west of Candlewick, and find out.',
    objective: { kind: 'explore', spot: 'wardens-rest', label: 'Find the Wardens’ Rest, north-west of Candlewick' },
    // (it was a walk to the hall. Whether its knights have gone over is read inside it, with them still walking its floor)
    then: [
      {
        kind: 'use', region: 'weeping-woods', at: 'wardens-rest', count: 3, thing: 'banner', verb: 'Look closer', label: 'Look round the knights’ hall', secs: 1, spread: 6, guards: ['revenant-knight'],
        notes: ['The hall’s banners still hang. Not one is the Host’s.', 'A table laid for forty. The dust is not disturbed.', 'Cut over the hearth: an oath, and a name under it.'],
      },
    ],
    find: {
      step: 1,
      name: 'Lord Halvard’s Oath',
      kind: 'page',
      about: 'The first page of the Watch’s muster book, still open on the table in the Wardens’ Rest. Lord Halvard wrote his oath to Aster’s queen at the top, the year the Hallow King rose. Forty knights signed under it.',
      body: ['I, Halvard, Warden of the Watch, swear to the Queen of Aster:', 'I will hold this wood until the Hallow King is ended.', 'I will not kneel to the Ash Crown, alive or dead.', 'If no one comes to relieve us, we will hold it anyway.'],
      sign: 'Halvard, and forty names under his',
    },
    after: ['the-candle-road'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 1800, gold: 540, text: 'Halvard’s knights still stand at their posts in the Rest, fighting the Hallow King’s call and losing. Every one of them faces the same way, south-east toward Lark’s Hollow, an old royal lodge. Whatever is pulling at them comes from there.' },
  },
  /* -------------------------------------------------- Queen Ysane's first echo */
  {
    id: 'the-frozen-hamlet',
    name: 'Lark’s Hollow',
    giver: 'orren-in-vaelmoor',
    auto: true,
    text: 'Lark’s Hollow is the royal lodge where Queen Ysane, the Hallow King’s wife, took their children, Lark and Edda, the winter the plague came. Orren went as far as the trees around it and heard children playing in the snow. He won’t go in alone, so he is coming with you. Go to Lark’s Hollow, south-east of the Wardens’ Rest.',
    // (Orren heard children playing in the snow. Their footprints are there to follow)
    objective: {
      kind: 'trail', region: 'weeping-woods', from: 'wardens-rest', to: 'larks-hollow', marks: 3, label: 'Follow the children’s footprints in the snow',
      notes: ['Small footprints. Two children, running.', 'A lantern, child-sized, frozen where it fell.', 'Laughter, ahead, behind the trees.'],
    },
    then: [{ kind: 'explore', spot: 'larks-hollow', label: 'Find Lark’s Hollow' }],
    find: {
      name: 'A Letter to Papa',
      kind: 'letter',
      about: 'Found on the lodge’s windowsill, under a lamp that has been burning for three hundred years. Princess Lark wrote it the night the fever came, while her father, King Vaelor, rode through the snow for the physicians.',
      body: ['Papa,', 'Mama says you rode to fetch the doctors and you will be back by morning.', 'Edda is hot and she keeps crying for you. I gave her my blanket. I am being brave.', 'I will leave the lamp in the window so you can find the way home.', 'If you are not back when the candle is short, we will come out and find you.'],
      sign: 'Lark',
    },
    after: ['the-wardens-rest'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 1800, gold: 540, text: 'The lodge is frozen in the night the fever came. A woman in a grey crown stands at its door, calling two names into the snow. She is an echo of Queen Ysane, a memory the Ash Crown has kept for three hundred years. Her children are still out in the frozen wood, looking for their father.' },
  },
  {
    id: 'wood-the-children',
    name: 'Two Names in the Snow',
    giver: 'orren-in-vaelmoor',
    auto: true,
    text: 'The night the fever came, Lark and Edda ran out into the snow to look for their father. Their echoes are still out there with their lanterns. The Hallow King is calling them home to him, and the wood’s dead are coming to carry them north. Lead the children back to their mother’s door.',
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
    text: 'Lord Halvard still holds out against the Hallow King’s call at the Weeping Tree, in the far north-west of the wood. If he gives in, every dead knight in the wood will follow him north to the Host. Orren is carrying Chandler Miro’s candle, the one flame that stays lit near Halvard, and the paper where Hesper wrote out Halvard’s name. Take them to the Weeping Tree.',
    // (Orren carried the candle. The hero does: the one flame that stays lit near Halvard goes up through his wood in
    // their hands)
    objective: { kind: 'carry', region: 'weeping-woods', from: 'chandler-miro', to: 'the-weeping-tree', thing: 'candle', verb: 'Take Miro’s candle', label: 'Carry Miro’s candle to the Weeping Tree', ambush: [['weeping-specter'], ['revenant-knight', 'candle-wraith']] },
    then: [{ kind: 'use', region: 'weeping-woods', at: 'the-weeping-tree', count: 1, thing: 'herb', verb: 'Untie a ribbon', label: 'Take a ribbon from the Weeping Tree', secs: 1.3, spread: 3, notes: ['A ribbon for everyone who waited. You untie one.'] }],
    find: {
      step: 1,
      name: 'A Ribbon from the Weeping Tree',
      kind: 'relic',
      about: 'The Weeping Tree is hung with hundreds of faded ribbons. The knights’ wives tied them there, one for each man who did not come home. This one has Halvard’s name stitched on it.',
      body: ['Halvard.', 'Come home when it is done.', 'I will keep the candle lit.'],
      sign: 'Hild',
    },
    after: ['wood-the-children'],
    zone: 'weeping-woods',
    level: 50,
    reward: { xp: 1900, gold: 580, text: 'Miro’s candle burns blue as you come under the willow. Halvard stands beneath it in grey plate, with frozen tears on his helm and violet in his eyes. He is still fighting the call, but only just. In Candlewick, the candle his wife Hild lit for him has been kept burning for three hundred years.' },
  },
  {
    id: 'the-weeping-lord',
    name: 'The Weeping Lord',
    auto: true,
    giver: 'candlewife-hesper',
    text: 'Halvard is the Weeping Lord now, and he will fight anyone who comes near his tree. He can’t hear his own name while he is still fighting. Beat him down, then read him his name by the light of Miro’s candle, at the Weeping Tree.',
    // (it was a kill, with the reading in a line of talk. The candles are set round his tree; he is beaten down, not
    // killed; and his name is read to him by the hero)
    objective: { kind: 'use', region: 'weeping-woods', at: 'the-weeping-tree', count: 3, thing: 'candle', verb: 'Set a candle', label: 'Set Miro’s candles round the Weeping Tree', secs: 1.1, spread: 5, ambush: ['revenant-knight'] },
    then: [{ kind: 'subdue', region: 'weeping-woods', enemies: ['the-weeping-lord'], count: 1, verb: 'Read him his name', label: 'Beat the Weeping Lord down, and read him his name', lair: { at: 'the-weeping-tree', enemies: ['the-weeping-lord'] } }],
    find: {
      name: 'The Herald’s Forge-Order',
      kind: 'orders',
      about: 'Pinned to Halvard’s sword-belt, in the Pale Herald’s grey ink. A month ago his knights ambushed a Host ore column on the Emberdeep road. He kept its orders for someone from Aster to find.',
      body: ['To the forge-masters at Emberdeep.', 'Ore, bone-steel and slaves will come to you over the north rim. Chain the fire lord to his anvil, and work him until it is done.', 'Make the crown as drawn: seven settings, and the hollow at its heart. Leave the settings empty. They will be filled.', 'The King wants it by midwinter.'],
      sign: 'The Pale Herald',
    },
    after: ['the-weeping-tree'],
    zone: 'weeping-woods',
    level: 50,
    reward: {
      xp: 8100,
      gold: 2000,
      item: 'the-wardens-oath',
      text: 'Halvard falls to one knee. You read him his name by candlelight, and the violet leaves his eyes. “We never beat him. We only shut him in,” he says. “Only the seven sigils together can end him. The Sigil of Tides never left Vaelmoor. The wardens hid it under Hollowmere, at his queen’s grave, and tore that place off their map.” He presses his silver oath-star into your hand and lays down his sword, and every dead knight in the wood lies down with him.',
    },
  },
  /* ---------------------------------------------- Sexton Abel's hanged men */
  {
    id: 'the-hanging-oaks',
    name: 'The Hanging Oaks',
    giver: 'sexton-abel',
    text: 'Sexton Abel has dug Candlewick’s graves for forty years. Thirty graves still wait for their dead, the deserters Lord Halvard hanged from the oaks before his last battle. They are still on their ropes, and they attack anyone who comes near. Go to the Hanging Oaks, west of Candlewick, and see.',
    objective: { kind: 'explore', spot: 'the-hanging-oaks', label: 'Find the Hanging Oaks, west of Candlewick' },
    // (it was a walk to see. What was done here, and why, is read under the ropes)
    then: [
      {
        kind: 'use', region: 'weeping-woods', at: 'the-hanging-oaks', count: 3, thing: 'gibbet', verb: 'Look closer', label: 'Look under the Hanging Oaks', secs: 1, spread: 6, guards: ['hanged-man'],
        notes: ['Thirty ropes. Thirty men, in Aster’s colors.', 'A drumhead court sat here. Its table still stands.', 'A letter in a dead man’s boot. It was never sent.'],
      },
    ],
    // (pays out at the oaks: the cutting down starts there, with no walk back to Abel between)
    turnIn: false,
    find: {
      step: 1,
      name: 'A Deserter’s Letter',
      kind: 'letter',
      about: 'Found in the coat of a hanged man at the Hanging Oaks, folded small and never sent. He wrote it the night he ran from Halvard’s line.',
      body: ['Bess,', 'The Host is on the north road. There are more of them than there are trees.', 'Lord Halvard says no man leaves the wood. I am leaving tonight anyway.', 'Take the children and go south to your mother’s. Don’t wait for me. If I don’t get there, I hope this does.'],
      sign: 'Tam',
    },
    after: ['the-candle-road'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 800, gold: 540, text: 'Thirty men hang from the oaks in the Watch’s faded blue. They drop on anyone who walks beneath them. They ran to warn their families, and Halvard hanged them for it.' },
  },
  {
    id: 'cut-them-down',
    name: 'Cut Them Down',
    giver: 'sexton-abel',
    text: 'The hanged men swing down at anyone who walks under them. Abel has their graves dug and waiting. Cut down five of them, here at the Hanging Oaks or on the roads, and lay them in the graves by Candlewick.',
    objective: { kind: 'kill', region: 'weeping-woods', count: 5, enemies: ['hanged-man'], label: 'Cut down hanged men' },
    // (it was eight kills. Abel has their graves dug and waiting: the hero lays them in)
    then: [{ kind: 'use', region: 'weeping-woods', at: 'sexton-abel', count: 3, thing: 'grave', verb: 'Lay him in', label: 'Lay the hanged men in the graves Abel dug', secs: 1.3, spread: 8 }],
    // (pays out where the work is: the letters are taken from the same men)
    turnIn: false,
    after: ['the-hanging-oaks'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 800, gold: 540, text: 'Eight of the hanged men lie on the frozen ground at last. Every one of them has paper in his pockets.' },
  },
  {
    id: 'letters-never-sent',
    name: 'Letters Never Sent',
    giver: 'sexton-abel',
    text: 'The hanged men’s pockets hold letters, to wives, to mothers and one to a dog. None were ever sent. The men ran because they had seen the Host coming and wanted to warn their families. Take three more letters from the hanged men, and read them aloud at Hesper’s wall of names, so that what the men ran to say is said. Then bring them to Abel in Candlewick, so he can bury each man with his own.',
    objective: { kind: 'loot', region: 'weeping-woods', item: 'Deserter’s Letter', from: ['hanged-man'], chance: 0.4, count: 3, label: 'Take Deserter’s Letters from hanged men' },
    // (it was five letters handed over. They were never sent, and never read: the hero reads them out at the wall of
    // names, so that what the men ran to say is said at last)
    then: [
      {
        kind: 'use', region: 'weeping-woods', at: 'candlewife-hesper', count: 3, thing: 'candle', verb: 'Read it aloud', label: 'Read the letters aloud at Hesper’s wall of names', secs: 1.4, spread: 5,
        notes: ['“Mother. The east road is lost. Go to Aunt Wyn.”', '“My Ysolt. Take the children south tonight.”', '“To Bramble, a good dog. Stay. I’ll come back.”'],
      },
    ],
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
    text: 'The knights’ wolfhounds were buried with them in the Wolf Barrow, north of Candlewick, and for three hundred years they stayed there. Now they hunt the roads in pairs, and Woodward Fenn’s own dog, Bramble, hasn’t come home. Put down five grave wolves around the Wolf Barrow, and follow Bramble’s tracks from Fenn’s door.',
    objective: { kind: 'kill', region: 'weeping-woods', count: 5, enemies: ['grave-wolf'], label: 'Put down grave wolves' },
    // (it was eight kills, and Fenn's dog was only spoken of. She is tracked)
    then: [
      {
        kind: 'trail', region: 'weeping-woods', from: 'woodward-fenn', to: 'wolf-barrow', marks: 3, label: 'Follow Bramble’s tracks from Fenn’s door',
        notes: ['A dog’s prints, small, running hard.', 'A scrap of red collar on a thorn.', 'Claw marks up an oak. A dog is in it, alive.'],
      },
    ],
    // (pays out at the barrow, where Bramble is found: the old hound's quest goes on from there, no walk back to Fenn)
    turnIn: false,
    after: ['the-candle-road'],
    zone: 'weeping-woods',
    level: 49,
    reward: { xp: 850, gold: 560, text: 'The pack is thinned out. Up a tree by the Wolf Barrow, Fenn’s dog Bramble is alive and shaking on a branch. Something much bigger than the grave wolves chased him up there.' },
  },
  {
    id: 'old-vigil',
    name: 'Old Vigil',
    giver: 'woodward-fenn',
    text: 'What chased Bramble up the tree was Old Vigil, Lord Halvard’s wolfhound. He guards his master’s empty grave in the Wolf Barrow, because Halvard never came home to fill it, and now he attacks everyone who passes. Lay the old hound to rest at the Wolf Barrow, then bring Bramble home to Fenn.',
    objective: { kind: 'kill', region: 'weeping-woods', count: 1, enemies: ['old-vigil'], label: 'Lay Old Vigil to rest at the Wolf Barrow', lair: { at: 'wolf-barrow', enemies: ['old-vigil'] } },
    // (Bramble came home in a line of talk. She is still up her tree, and has to be talked down)
    then: [{ kind: 'use', region: 'weeping-woods', at: 'wolf-barrow', count: 1, thing: 'log', verb: 'Coax her down', label: 'Coax Bramble down out of the oak', secs: 2, spread: 3, notes: ['She comes down into your arms, shaking.'] }],
    after: ['hounds-of-the-wolf-barrow'],
    zone: 'weeping-woods',
    level: 50,
    reward: { xp: 1300, gold: 920, item: 'vigils-collar', text: 'Bramble runs ahead of you all the way back to Candlewick. Fenn buries the old hound in his master’s empty grave and gives you Vigil’s collar.' },
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
          'You came. This is Candlewick, a village of living people in the middle of the Hallow King’s dead kingdom.',
          'Their families came north with Aster’s knights three hundred years ago. When the Gates shut, they stayed with the graves.',
          'They light a candle in every window, one for each of their dead, so the dead can find their way home.',
          'In my order we lit lamps to see the dead out of the world. I don’t know what to say to these people.',
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
      { when: { quest: 'the-weeping-lord', state: 'done' }, lines: ['Halvard said the Sigil of Tides lies under the lake at Hollowmere, at the queen’s grave.', 'Cael is right that the crown at Emberdeep comes first. But I’m afraid of deep water. When we go to the lake, I’ll come anyway.'] },
      { when: { quest: 'wood-the-children', state: 'done' }, lines: ['The Hallow King was a man who rode through a blizzard for a doctor, and sat up all winter with his children.', 'He built the whole Host to get his family back. All she wanted was to tell him it wasn’t his fault.'] },
      { lines: ['Candlewick’s chapel has no priest, so I ring its bell at dusk.', 'Every candle in this village is for someone dead. I never lit one for my little brother. I keep thinking about that.'] },
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
          'Your priest says you came from Aster. Before him, nobody from outside had come up the road in three hundred years.',
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
        lines: ['Orren has Miro’s candle, the one that won’t go out even next to Halvard, and the paper with his name on it.', 'Find Halvard at the Weeping Tree, in the far north-west of the wood. Please bring him rest.'],
      },
      {
        when: { quest: 'the-weeping-lord', state: 'active' },
        lines: ['Halvard can’t hear his name while he’s still fighting.', 'Beat him down, as gently as you can. Then read him his name. He has waited three hundred years to be told he can rest.'],
      },
      {
        when: { quest: 'the-pale-crown', state: 'active' },
        lines: ['I’ve written Halvard’s name in the Roll, and beside it that someone from Aster came for him.', 'Thane Hroki of Cinderhold is an old friend of this wood. I sent word you’re coming. Take the east road to Emberdeep.'],
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
        lines: ['They swing down at anyone who walks under them. They’ve hung there for three hundred years.', 'Their graves are dug. Cut five of them down, and help me lay them in. Forty years I’ve dug alone.'],
      },
      {
        when: { quest: 'letters-never-sent', state: 'active' },
        lines: ['Letters in their pockets? To wives, to mothers, one to a dog. None of them were ever sent.', 'They ran home to warn their families. Find three more letters. Read them out at Hesper’s wall before you bring them: a letter should be heard once. Then every man is buried with his own.'],
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
        lines: ['I gave your priest the candle. Willow wax, and a wick spun from a knight’s linen. It burns blue, and it won’t go out.', 'Take it to the Weeping Tree. And come back safe.'],
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
        lines: ['You saw Bramble up a tree by the barrow? Then he’s alive. Thank you.', 'What chased him up there was Old Vigil, Lord Halvard’s own wolfhound. He’s guarded his master’s empty grave for three hundred years. Please let the old dog rest.'],
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
      { who: 'orren', text: 'They can’t really hear us. They’re looking for their father’s light. Walk to the lodge, and they’ll follow you.' },
    ],
    waves: [
      { enemies: ['weeping-specter', 'weeping-specter', 'mourning-willow'], from: ['hollow-n', 'hollow-e'], barks: [{ who: 'echo-child', text: 'Papa’s calling us. He says we’re going home soon.' }, { who: 'orren', text: 'That’s the Hallow King calling them north! Don’t let the dead take them!' }] },
      { enemies: ['weeping-specter', 'weeping-specter', 'weeping-specter', 'grave-wolf'], from: ['hollow-e', 'hollow-s'], barks: [{ who: 'orren', text: 'More dead, coming for the children! Keep them away!' }] },
    ],
    end: [
      { who: 'echo-of-ysane', text: 'There you are. Come inside, you’re frozen.' },
      { who: 'orren', text: 'Go in, little ones. Go in and rest.' },
    ],
    retry: [{ who: 'orren', text: 'We lost them! Back to the trees, they’re still out there!' }],
  },
};
