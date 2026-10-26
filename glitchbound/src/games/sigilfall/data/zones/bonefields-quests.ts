import type { NpcDef, QuestDef } from '../types';

/**
 * The Forward Camp's people and the quests of the Bonefields (see WORLD.md). The Legion that broke at
 * Highwall ran north onto an ashen plain and is mustering again, and Marshal Ardent holds a camp of
 * stakes and tents in the teeth of it. The main chain follows the dead: from Haldren's dug-up graves
 * and the empty gallows to the Bone Pits where the necromancers stitch them together, through the
 * lancers' muster rolls (the Legion marches south when the Colossus stands and the Pale Crown is
 * forged) to the plundered Wardens' Ossuary, and ends at the Muster with the Bone Colossus, built
 * around the bones of the Sigil-wardens who beat the King the first time. Ardent then sends the hero
 * west to the Weeping Woods and north to Emberdeep (those chains belong to those zones). Cook Brannoc
 * wants his stores back and the butcher of the pits dealt with, Armorer Jessa wants to learn to break
 * a death knight's runes, and Farmer Haldren wants his family's dead to lie still. Main chain first.
 */
export const BONEFIELDS_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'into-the-bonefields',
    name: 'Into the Bonefields',
    giver: 'lord-commander-varn',
    text: 'The Legion that ran from Highwall didn’t run far. North of the wall, on the ashen plain the old maps call the Bonefields, it is mustering again, and bigger. Varn has sent his best officer, Marshal Ardent, to hold a Forward Camp in the teeth of it, with three hundred soldiers and a lot of stakes. Take the north road out of Highwall March and report to her.',
    objective: { kind: 'talk', npc: 'marshal-ardent', label: 'Report to Marshal Ardent at the Forward Camp' },
    after: ['the-long-night-ends'],
    level: 48,
    reward: { xp: 1650, gold: 560 },
  },
  /* -------------------------------------------------------- the muster */
  {
    id: 'haldrens-farm',
    name: 'Haldren’s Farm',
    giver: 'marshal-ardent',
    text: 'Ardent sent six foragers to Haldren’s Farm, west of the camp, the last farm on the plain with a roof on it. None came back. The farmer did, alone, three days later, and he won’t say what he saw. Go and see for yourself.',
    objective: { kind: 'explore', spot: 'raided-farm', label: 'Search Haldren’s Farm' },
    after: ['into-the-bonefields'],
    zone: 'bonefields',
    reward: { xp: 1700, gold: 570, text: 'The foragers lie in the yard. Behind the barn the family plot has been dug up, every grave, with dog-tracks all round it and cart-ruts leading away north-west.' },
  },
  {
    id: 'no-mans-land',
    name: 'No Man’s Land',
    giver: 'marshal-ardent',
    text: 'The Legion’s pickets stand a bowshot from the camp’s stakes, day and night, and shoot at anyone who goes for water. Ardent wants room to breathe. Cut down the Legion’s soldiers and crossbowmen on the plain around the Forward Camp and Gallows Hill.',
    objective: { kind: 'kill', region: 'bonefields', count: 12, enemies: ['legion-soldier', 'legion-crossbowman'], label: 'Defeat Legion soldiers and crossbowmen' },
    after: ['haldrens-farm'],
    zone: 'bonefields',
    level: 48,
    reward: { xp: 1800, gold: 580 },
  },
  {
    id: 'gallows-hill',
    name: 'Gallows Hill',
    giver: 'marshal-ardent',
    text: 'The Legion hanged the soldiers Highwall lost in the retreat on Gallows Hill, east of the camp, where the whole camp could see them. Ardent has been meaning to cut them down for a week. Now the pickets are thinner, go up the hill and bring her their names.',
    objective: { kind: 'explore', spot: 'gallows-hill', label: 'Climb Gallows Hill' },
    after: ['no-mans-land'],
    zone: 'bonefields',
    level: 49,
    reward: { xp: 1750, gold: 580, text: 'The gallows are empty. Chalked on the beam in a neat clerk’s hand: COLLECTED. BONE PITS.' },
  },
  {
    id: 'the-bone-pits',
    name: 'The Bone Pits',
    giver: 'marshal-ardent',
    text: 'Haldren’s dead and Highwall’s hanged went the same way: north-west, in carts, to somewhere the Legion calls the Bone Pits. Ardent wants to know what happens to them there, though she suspects she won’t like it. Follow the cart-ruts north-west of the camp.',
    objective: { kind: 'explore', spot: 'bone-pits', label: 'Find the Bone Pits' },
    after: ['gallows-hill'],
    zone: 'bonefields',
    level: 49,
    reward: { xp: 1750, gold: 590, text: 'Pits the size of fields, full of the dead of every battle since the Amberfield, sorted by size. Necromancers walk the edges with lanterns, raising what they need and stitching the rest into abominations, which carry what is left north, to the Muster.' },
  },
  {
    id: 'the-stitchers',
    name: 'The Stitchers',
    giver: 'marshal-ardent',
    text: 'Every necromancer at the pits is a hundred dead men walking. Ardent does her sums like a quartermaster and she likes this one: kill the stitchers, and the dead stay dead. Cut down the Legion’s necromancers at the Bone Pits and wherever they walk the plain with their lanterns.',
    objective: { kind: 'kill', region: 'bonefields', count: 6, enemies: ['legion-necromancer'], label: 'Kill Legion necromancers' },
    after: ['the-bone-pits'],
    zone: 'bonefields',
    level: 50,
    reward: { xp: 1900, gold: 600 },
  },
  {
    id: 'muster-rolls',
    name: 'Muster Rolls',
    giver: 'marshal-ardent',
    text: 'Ardent needs to know what the Legion is mustering for, and when it marches. Its lancers ride between the Muster and the camps on the plain carrying the rolls, and they ride fast: let one charge past you into a tent pole, then take what it carries. Four rolls, from the lancers, wherever they ride.',
    objective: { kind: 'loot', region: 'bonefields', item: 'Muster Roll', from: ['legion-lancer'], chance: 0.35, count: 4, label: 'Take Muster Rolls from Legion lancers' },
    after: ['the-stitchers'],
    zone: 'bonefields',
    level: 50,
    reward: { xp: 1900, gold: 600, text: 'The rolls count every company on the plain, and all of them end the same way: TO MARCH SOUTH WHEN THE COLOSSUS STANDS AND THE CROWN IS FORGED. Highwall again, and this time behind a giant.' },
  },
  {
    id: 'the-wardens-ossuary',
    name: 'The Wardens’ Ossuary',
    giver: 'marshal-ardent',
    text: 'One roll is an order on its own: ALL BONES FROM THE OSSUARY TO THE MUSTER, FOR THE COLOSSUS’S HEART. The Wardens’ Ossuary, north-east of the camp, is where the Sigil-wardens who beat Vaelor the first time were laid to rest. Go and see what the Legion wants with them.',
    objective: { kind: 'explore', spot: 'the-ossuary', label: 'Visit the Wardens’ Ossuary' },
    after: ['muster-rolls'],
    zone: 'bonefields',
    level: 51,
    reward: { xp: 1850, gold: 610, text: 'The ossuary is empty: every niche cleared, every warden’s bones carted north. The Legion is building its giant around the ones who beat the King.' },
  },
  {
    id: 'break-the-giants',
    name: 'Break the Giants',
    giver: 'marshal-ardent',
    text: 'The Colossus stands at the Muster in the north of the plain, and its smaller brothers stand round it: bone giants, each built from a hundred men. Before Ardent sends anyone at the Colossus, the giants come down. Break four, around the Muster and the northern plain. When their fists go up, get out from under them.',
    objective: { kind: 'kill', region: 'bonefields', count: 4, enemies: ['bone-giant'], label: 'Break bone giants' },
    after: ['the-wardens-ossuary'],
    zone: 'bonefields',
    level: 51,
    reward: { xp: 1900, gold: 620 },
  },
  {
    id: 'the-bone-colossus',
    name: 'The Bone Colossus',
    giver: 'marshal-ardent',
    text: 'The giants are down, and the Colossus stands alone in the Muster with its necromancers mending it. Ardent has the whole camp under arms, but she won’t send three hundred soldiers at a thing as tall as a keep. She’s sending you. Go north to the Muster and bring the Bone Colossus down before it marches. Don’t let it rest: the necromancers mend it while it does.',
    objective: { kind: 'kill', region: 'bonefields', count: 1, enemies: ['the-bone-colossus'], label: 'Kill the Bone Colossus at the Muster' },
    after: ['break-the-giants'],
    zone: 'bonefields',
    level: 52,
    reward: {
      xp: 7000,
      gold: 1800,
      item: 'wardens-reliquary',
      text: 'The Colossus comes apart all at once, in a rain of bone that goes on for a long time. When it stops, the Muster is a field of bones again and the army meant to march behind it is scattered over the plain. Where its heart should be is a silver reliquary of the Sigil-wardens’ bones. Ardent gives it to you. “They beat him once,” she says. “Take them along. They’ll want to see the end of it.”',
    },
  },
  /* -------------------------------------------------- Cook Brannoc's stores */
  {
    id: 'crows-in-the-stores',
    name: 'Crows in the Stores',
    giver: 'cook-brannoc',
    text: 'The carrion crows that follow the Legion have found the camp’s stores, and they have learned to open sacks. Brannoc has lost a side of bacon, two cheeses and most of his temper. Thin out the carrion crows on the plain, around Haldren’s Farm and anywhere else they circle.',
    objective: { kind: 'kill', region: 'bonefields', count: 10, enemies: ['carrion-crow'], label: 'Shoot down carrion crows' },
    after: ['into-the-bonefields'],
    zone: 'bonefields',
    level: 48,
    reward: { xp: 1650, gold: 560 },
  },
  {
    id: 'stolen-rations',
    name: 'Stolen Rations',
    giver: 'cook-brannoc',
    text: 'The Legion took the camp’s last supply wagons on the road from Highwall. The dead don’t eat, but the Pale Herald’s quartermasters count everything, so every Legion soldier on the plain carries a share of Brannoc’s rations in its pack, uneaten. Brannoc finds this more insulting than the theft. Take six packs back from the Legion soldiers.',
    objective: { kind: 'loot', region: 'bonefields', item: 'Stolen Rations', from: ['legion-soldier'], chance: 0.35, count: 6, label: 'Take back Stolen Rations from Legion soldiers' },
    after: ['crows-in-the-stores'],
    zone: 'bonefields',
    level: 49,
    reward: { xp: 1750, gold: 580 },
  },
  {
    id: 'the-butcher-of-the-pits',
    name: 'The Butcher of the Pits',
    giver: 'cook-brannoc',
    text: 'Every cook knows a butcher, and Brannoc knows of one at the Bone Pits: Butcher Krogg, the stitcher who makes the abominations, three men wide with a cleaver in one hand. A man with a cleaver like that, says Brannoc, should be making stew. Go to the Bone Pits, north-west of the camp, and put Krogg down. Step back when he falls: he is full of the same rot as his work.',
    objective: { kind: 'kill', region: 'bonefields', count: 1, enemies: ['butcher-krogg'], label: 'Kill Butcher Krogg at the Bone Pits' },
    after: ['stolen-rations', 'the-bone-pits'],
    zone: 'bonefields',
    level: 50,
    reward: { xp: 2450, gold: 780, item: 'butchers-apron', text: 'Brannoc boils Krogg’s apron twice and gives it to you. “Best leather on the plain,” he says. “Worst kitchen.”' },
  },
  /* -------------------------------------------------- Armorer Jessa's runes */
  {
    id: 'blackened-plate',
    name: 'Blackened Plate',
    giver: 'armorer-jessa',
    text: 'The Hollow King’s death knights wear plate that turns a camp sword like a sheet of glass, and Jessa wants to know why. Bone-steel, she thinks, from the Deepforge, and something in the runes. She needs pieces to work on. Take four plates of blackened armor from the death knights, out on the plain and at the Wardens’ Ossuary.',
    objective: { kind: 'loot', region: 'bonefields', item: 'Blackened Plate', from: ['death-knight'], chance: 0.35, count: 4, label: 'Take Blackened Plate from death knights' },
    after: ['into-the-bonefields'],
    zone: 'bonefields',
    level: 50,
    reward: { xp: 1800, gold: 600 },
  },
  {
    id: 'runebreaker',
    name: 'Runebreaker',
    giver: 'armorer-jessa',
    text: 'Jessa has it: the runes hold the plate together, not the steel, and a rune breaks when the knight wearing it does. Which is useful to know and no help at all. She wants six death knights broken so the camp can stop worrying about them, and she wants to watch the plate go dull. Kill six, wherever they walk.',
    objective: { kind: 'kill', region: 'bonefields', count: 6, enemies: ['death-knight'], label: 'Break death knights' },
    after: ['blackened-plate'],
    zone: 'bonefields',
    level: 51,
    reward: { xp: 2500, gold: 800, item: 'runebreaker-greaves', text: 'Jessa hammers the dead runes off a pair of death knight’s legplates and fits them to you. “Good steel,” she says. “That was always the problem.”' },
  },
  /* ------------------------------------------------- Farmer Haldren's dead */
  {
    id: 'the-diggers',
    name: 'The Diggers',
    giver: 'farmer-haldren',
    text: 'Haldren has found his voice. The grave-hounds dug up his family plot: the Legion sends them sniffing over the plain for the buried dead, and they dig all night. He wants them gone before they find anyone else’s grandmother. Kill eight grave-hounds, around his farm and anywhere they dig.',
    objective: { kind: 'kill', region: 'bonefields', count: 8, enemies: ['grave-hound'], label: 'Kill grave-hounds' },
    after: ['haldrens-farm'],
    zone: 'bonefields',
    level: 49,
    reward: { xp: 1750, gold: 580 },
  },
  {
    id: 'laid-to-rest',
    name: 'Laid to Rest',
    giver: 'farmer-haldren',
    text: 'Haldren has seen the abominations walking the plain, and he thinks he knows a coat on one of them, and a pair of boots on another. He wants them put down so they can lie still, wherever they lumber, at the Bone Pits, on Gallows Hill and on the plain. Five, he says. He’ll do the burying himself.',
    objective: { kind: 'kill', region: 'bonefields', count: 5, enemies: ['abomination'], label: 'Put down abominations' },
    after: ['the-diggers'],
    zone: 'bonefields',
    level: 50,
    reward: { xp: 2350, gold: 760, item: { rarity: 'rare' }, text: 'Haldren buries what comes back in the old plot, all of it in one grave because nobody can tell whose is whose. He gives you the best thing left in his house, which he dug up from under the hearth.' },
  },
];

export const BONEFIELDS_NPCS: Record<string, NpcDef> = {
  'marshal-ardent': {
    id: 'marshal-ardent',
    name: 'Marshal Ardent',
    title: 'Marshal of the Forward Camp',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'into-the-bonefields', state: 'active' },
        lines: ['Varn sent you. Good. He promised me reinforcements, and you’re the only one that came.', 'Ardent, Marshal of this camp. Three hundred soldiers, a ditch, a lot of stakes, and the whole Legion on the other side of them. Welcome to the Bonefields.'],
      },
      {
        when: { quest: 'haldrens-farm', state: 'active' },
        lines: ['I sent six foragers to Haldren’s Farm, west of here. Six didn’t come back. Haldren did, and he won’t talk.', 'Go and look. Tell me what I lost, so I know what to stop losing.'],
      },
      {
        when: { quest: 'no-mans-land', state: 'active' },
        lines: ['Dug-up graves and cart-ruts. Noted. First I need room to breathe.', 'Their pickets are a bowshot from my stakes. Cut down the soldiers and crossbowmen around the camp and Gallows Hill. Twelve will make them think about it.'],
      },
      {
        when: { quest: 'gallows-hill', state: 'active' },
        lines: ['They hanged our men on Gallows Hill, east of here, where we could all see. I’ve been meaning to cut them down for a week.', 'Go up the hill. Bring me their names. I keep a list.'],
      },
      {
        when: { quest: 'the-bone-pits', state: 'active' },
        lines: ['Collected. In chalk. Somebody in the Legion has a tidy hand and a filthy job.', 'Follow the carts north-west. Find these Bone Pits and tell me what happens there. I suspect I won’t like it. Tell me anyway.'],
      },
      {
        when: { quest: 'the-stitchers', state: 'active' },
        lines: ['Necromancers stitching our dead into whatever they need. I did the sum: one necromancer is a hundred soldiers I don’t have to fight.', 'Kill the stitchers. Six. Then we’ll talk about the rest.'],
      },
      {
        when: { quest: 'muster-rolls', state: 'active' },
        lines: ['I want to know what they’re mustering for and when they march. Their lancers carry the rolls.', 'They ride fast and straight. Stand in front of a tent pole and step aside at the last moment. Four rolls.'],
      },
      {
        when: { quest: 'the-wardens-ossuary', state: 'active' },
        lines: ['When the Colossus stands and the Crown is forged. Highwall again, behind a giant. Varn will love that.', 'And this one: all bones from the Ossuary to the Muster. The Wardens’ Ossuary is north-east of here. The Sigil-wardens are buried there. Go and look.'],
      },
      {
        when: { quest: 'break-the-giants', state: 'active' },
        lines: ['They’re building it out of the wardens. The ones who beat the King. That’s not strategy, that’s spite.', 'The Colossus has bone giants round it at the Muster. Break four, and then I’ll send you at the big one.'],
      },
      {
        when: { quest: 'the-bone-colossus', state: 'active' },
        lines: ['The Colossus, alone in the Muster, north of here, with its necromancers fussing round it like tailors.', 'Bring it down before it walks. Don’t give it a breather: they mend it whenever it gets one. I’ll have the camp under arms, for whatever that’s worth.'],
      },
      {
        when: { quest: 'the-candle-road', state: 'active' },
        lines: ['The Legion’s scattered and the plain is quiet. Quiet makes me nervous. It always means something is happening somewhere else.', 'West of here, the Weeping Woods. Candlewick keeps a candle in every window, and its Candlewife writes that the old dead there are stirring. Go and help her. Take the west road.'],
      },
      {
        when: { quest: 'the-pale-crown', state: 'active' },
        lines: ['The rolls said “when the Crown is forged”. The dwarves at Cinderhold say the forging is under Emberdeep, north of here, with a fire lord in chains doing it.', 'Thane Hroki holds Cinderhold. Take the north road and find him. Break that Crown, and the King’s dead have nothing to march behind.'],
      },
      {
        when: { quest: 'the-bone-colossus', state: 'done' },
        lines: ['A field of bones, and none of them getting up. I may frame the view.', 'The Legion will muster again somewhere. It always does. But not here, and not behind that.'],
      },
      {
        when: { quest: 'into-the-bonefields', state: 'done' },
        lines: ['The Forward Camp: Highwall’s first foothold beyond the wall. We are standing in the King’s front garden.', 'Brannoc feeds us, Jessa keeps our armor on us, and Haldren is the only farmer left on this plain. Keep all three alive and you keep the camp alive.'],
      },
      { lines: ['Keep your head below the stakes. Their crossbows are better than ours.', 'Marshal Ardent. Varn’s. Whatever he told you about me is true, and I’ve heard what he told you.'] },
    ],
  },
  'cook-brannoc': {
    id: 'cook-brannoc',
    name: 'Cook Brannoc',
    title: 'Camp Cook',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Mess Tent',
    talk: [
      {
        when: { quest: 'crows-in-the-stores', state: 'active' },
        lines: ['Crows. In my stores. They’ve learned to open sacks. One of them looked me in the eye while it did it.', 'A side of bacon. Two cheeses. Thin them out, ten of them, before they learn to light the stove.'],
      },
      {
        when: { quest: 'stolen-rations', state: 'active' },
        lines: ['The dead took my wagons, and the dead don’t eat. They’re carrying my rations about the plain, in their packs, uneaten. Counted.', 'I’m more insulted than hungry, and I’m very hungry. Six packs back from the soldiers, please.'],
      },
      {
        when: { quest: 'the-butcher-of-the-pits', state: 'active' },
        lines: ['There’s a butcher at the Bone Pits. Krogg. Three men wide, with a cleaver I’d give my right arm for, which he’d probably take.', 'A cleaver like that belongs in a kitchen. Go and take it off him. Step back when he drops: he’s full of rot.'],
      },
      { when: { quest: 'the-butcher-of-the-pits', state: 'done' }, lines: ['Boiled it twice. Best leather on the plain, worst kitchen in the world. Wear it in good health.', 'And no: no relation to the smith in Emberwick. Well. Some relation. We don’t talk about the pie.'] },
      { lines: ['The Mess Tent: hot food, cold beer, and potions, which are neither.', 'Eat. Nobody wins a war hungry. I’ve checked.'] },
    ],
  },
  'armorer-jessa': {
    id: 'armorer-jessa',
    name: 'Armorer Jessa',
    title: 'Armorer',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'Jessa’s Anvil',
    talk: [
      {
        when: { quest: 'blackened-plate', state: 'active' },
        lines: ['Have you seen a camp sword hit a death knight? It bounces. I made that sword. I want to know why it bounces.', 'Bone-steel from the Deepforge, I think, and something in the runes. Bring me four plates of it and I’ll find out.'],
      },
      {
        when: { quest: 'runebreaker', state: 'active' },
        lines: ['It’s the runes, not the steel. The runes hold the plate together, and they break when the knight does. Useful. No help at all.', 'Break six of them so the camp can stop worrying. I want to watch the plate go dull.'],
      },
      { when: { quest: 'runebreaker', state: 'done' }, lines: ['Good steel, with the runes off. That was always the problem with it.'] },
      { lines: ['Jessa’s Anvil. Helms, mail, plate, boots. If it stops a blade, I sell it; if it doesn’t, I melt it.', 'Come back in one piece and I’ll mend whatever you’re wearing. Come back in two and I’ll mend you too, but I charge more.'] },
    ],
  },
  'farmer-haldren': {
    id: 'farmer-haldren',
    name: 'Farmer Haldren',
    title: 'The last farmer on the plain',
    sprite: 'villager',
    talk: [
      { when: { quest: 'haldrens-farm', state: 'active' }, lines: ['…', 'Go and look, if the Marshal says so. I can’t. Not yet.'] },
      {
        when: { quest: 'the-diggers', state: 'active' },
        lines: ['You saw the plot. My mother, my father, my wife. Dug up by dogs and carted off like turnips.', 'The Legion sends those hounds sniffing over the plain for the buried dead. Kill them. Eight. Before they find anyone else’s grandmother.'],
      },
      {
        when: { quest: 'laid-to-rest', state: 'active' },
        lines: ['I saw one of those stitched things out on the plain. It was wearing my father’s coat. I’d know that coat anywhere. I patched it.', 'Put them down, so they can lie still. Five. I’ll do the burying myself.'],
      },
      { when: { quest: 'laid-to-rest', state: 'done' }, lines: ['One grave for all of them. Nobody can tell whose is whose any more. I don’t think they mind.', 'I’ll plough again in the spring, if there’s a spring. Bones make good soil, they say. I wish they didn’t.'] },
      { lines: ['Forty years I farmed this plain. It wasn’t always called the Bonefields. It was called Haldren’s, mostly.'] },
    ],
  },
};
