import type { NpcDef, QuestDef } from '../types';

/**
 * Vinehold's people and the quests of Vinecoil Jungle (see WORLD.md). The serpent cult's high queen,
 * the Coiled Queen, sold the Hollow King the venom the Rot-Mother brewed into her plague, and her
 * jars are still going north. Keeper Ansel found some on the quay at Stormwatch. The main chain runs
 * from the Cult Camp, where Vinehold's loggers were taken, by way of Shaman Tuoko's reading of the
 * jars and an antidote from the stranglers, up the Serpent Steps to the Coiled Temple. Trader Mabel
 * wants the black panther of the falls; Tuoko wants the red fever stopped. Main chain first.
 */
export const VINECOIL_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-serpent-temples',
    name: 'The Serpent Temples',
    giver: 'keeper-ansel',
    text: 'A letter from Keeper Ansel caught up with you after the Sun King’s tomb. A trading cutter put into Stormwatch with a hold full of sealed clay jars, bound north. One broke on the quay, and four gulls drank from the puddle. Ansel buried the gulls. The seal on every jar is a coiled serpent beside the Hollow King’s empty crown, and the cutter loaded them at Vinehold, in Vinecoil Jungle. Take the east road out of Stormwatch, or the south road out of the Sunscorch, and find Warden Kesh.',
    objective: { kind: 'talk', npc: 'warden-kesh', label: 'Talk to Warden Kesh in Vinehold' },
    after: ['the-sun-king'],
    level: 39,
    reward: { xp: 1400, gold: 420 },
  },
  /* ------------------------------------------------------ the Coiled Queen */
  {
    id: 'the-lost-loggers',
    name: 'The Lost Loggers',
    giver: 'warden-kesh',
    text: 'A week ago a crew of eight loggers went up the north trail to cut ironwood and didn’t come back. Two wardens went after them, and didn’t come back either. Kesh has stopped sending people. She is sending you. The serpent cult has made a camp on the trail, north-east of Vinehold. Find out what happened to her loggers.',
    objective: { kind: 'explore', spot: 'cult-camp', label: 'Search the Cult Camp' },
    after: ['the-serpent-temples'],
    zone: 'vinecoil',
    reward: { xp: 1600, gold: 430 },
  },
  {
    id: 'snakes-in-the-timber',
    name: 'Snakes in the Timber',
    giver: 'warden-kesh',
    text: 'The loggers’ axes were stacked neatly by the fire, and their boots were in a row. The loggers weren’t. The cult is marching people east to its temples, and Kesh has six wardens to stop it with. Drive back the cultists and their naga wherever they walk in the jungle. Every one you stop is one less pair of hands on a logger’s collar.',
    objective: { kind: 'kill', region: 'vinecoil', count: 12, enemies: ['serpent-cultist', 'naga-warrior'], label: 'Defeat serpent cultists and naga' },
    after: ['the-lost-loggers'],
    zone: 'vinecoil',
    level: 40,
    reward: { xp: 2000, gold: 450 },
  },
  {
    id: 'venom-for-a-king',
    name: 'Venom for a King',
    giver: 'warden-kesh',
    text: 'The cultists carry jars at their belts: the same sealed clay as Ansel’s, the same serpent and empty crown. Kesh wants five on her table, so somebody can find out what is in them without drinking it. The cultists walk the trails from the Cult Camp, north-east of Vinehold, to the river and beyond. Don’t shake the jars.',
    objective: { kind: 'loot', region: 'vinecoil', item: 'Venom Jar', from: ['serpent-cultist'], chance: 0.4, count: 5, label: 'Take Venom Jars from serpent cultists' },
    after: ['snakes-in-the-timber'],
    zone: 'vinecoil',
    level: 40,
    reward: { xp: 2000, gold: 450 },
  },
  {
    id: 'the-queens-bargain',
    name: 'The Queen’s Bargain',
    giver: 'warden-kesh',
    text: 'There are glyphs pressed into the wax of every seal, older than Vinehold and older than the kingdoms. Nobody in the stockade can read them except Shaman Tuoko, who keeps the Smoking Gourd on the square and reads them the way other people read the weather. Take the jars to Tuoko.',
    objective: { kind: 'talk', npc: 'shaman-tuoko', label: 'Bring the Venom Jars to Shaman Tuoko' },
    after: ['venom-for-a-king'],
    zone: 'vinecoil',
    level: 40,
    reward: { xp: 1600, gold: 460 },
  },
  {
    id: 'strangler-hearts',
    name: 'Strangler Hearts',
    giver: 'shaman-tuoko',
    text: 'Tuoko read the seals: the Coiled Queen’s venom, a hundred jars of it, sold to the Hollow King for his plague. If you are going to see the Queen about it, Tuoko says, you will want an antidote first, because her venom kills in a breath. The vine stranglers in Strangler Grove, south-west of Vinehold, grow a heart that drinks poison and thrives on it. Bring four.',
    objective: { kind: 'loot', region: 'vinecoil', item: 'Strangler Heart', from: ['vine-strangler'], chance: 0.35, count: 4, label: 'Cut Strangler Hearts from vine stranglers' },
    after: ['the-queens-bargain'],
    zone: 'vinecoil',
    level: 41,
    reward: { xp: 2100, gold: 480 },
  },
  {
    id: 'the-serpent-steps',
    name: 'The Serpent Steps',
    giver: 'warden-kesh',
    text: 'The antidote is brewing and smells exactly as bad as Tuoko promised. Meanwhile one of Kesh’s wardens found a logger’s boot on the old processional road, the Serpent Steps, in the ruins east of Vinehold across the river. The cult marched its prisoners up the steps toward the Coiled Temple. Find the steps.',
    objective: { kind: 'explore', spot: 'serpent-steps', label: 'Find the Serpent Steps' },
    after: ['strangler-hearts'],
    zone: 'vinecoil',
    level: 41,
    reward: { xp: 1900, gold: 480 },
  },
  {
    id: 'the-scaled-guard',
    name: 'The Scaled Guard',
    giver: 'warden-kesh',
    text: 'The steps are guarded by naga in bronze scale, all the way from the ruins east of Vinehold to the Coiled Temple in the far east. Kesh can’t take her wardens up that road with the naga on it. Break the Queen’s scaled guard: eight of them should make the rest nervous.',
    objective: { kind: 'kill', region: 'vinecoil', count: 8, enemies: ['naga-warrior'], label: 'Defeat naga warriors' },
    after: ['the-serpent-steps'],
    zone: 'vinecoil',
    level: 42,
    reward: { xp: 2400, gold: 520, item: { rarity: 'rare' } },
  },
  {
    id: 'the-coiled-queen',
    name: 'The Coiled Queen',
    giver: 'warden-kesh',
    text: 'The road is open, Tuoko’s antidote is in your belly and the loggers are somewhere inside the Coiled Temple, in the far north-east of the jungle. So is the Coiled Queen, high queen of the serpent cult, who sold the Hollow King the venom for his plague and is bottling more. Go up the steps and end her trade.',
    objective: { kind: 'kill', region: 'vinecoil', count: 1, enemies: ['the-coiled-queen'], label: 'Defeat the Coiled Queen in her temple' },
    after: ['the-scaled-guard'],
    zone: 'vinecoil',
    level: 42,
    reward: {
      xp: 6300,
      gold: 1400,
      item: 'coiled-queens-fang',
      text: 'The Queen’s coils go slack. In the temple you find Kesh’s loggers, thin and furious, and the Queen’s ledger: a hundred jars to the Rot-Mother’s cistern, paid in Hollow gold, and the last load a month ago, north to General Morvain’s lines at the siege of Highwall. Kesh sets the Queen’s fang on a cord for you.',
    },
  },
  /* ---------------------------------------------------- Trader Mabel's pelts */
  {
    id: 'mabels-mules',
    name: 'Mabel’s Mules',
    giver: 'trader-mabel',
    text: 'Trader Mabel sent a string of six mules down the falls trail with a load of mail shirts for the wardens. Four mules came back, without the shirts or much of their nerve. Something at Panther Falls, south-east of Vinehold across the river, had a go at the rest. Mabel would like her shirts, and an explanation.',
    objective: { kind: 'explore', spot: 'panther-falls', label: 'Search Panther Falls' },
    after: ['the-serpent-temples'],
    zone: 'vinecoil',
    level: 40,
    reward: { xp: 1700, gold: 440 },
  },
  {
    id: 'spotted-pelts',
    name: 'Spotted Pelts',
    giver: 'trader-mabel',
    text: 'Panthers, and more of them than there should be: something is driving them out of the deep jungle toward the stockade. Mabel takes the practical view. A panther that has eaten her mules owes her a pelt, and the wardens need cloaks. Six pelts from the jungle panthers that prowl around Vinehold and down to the falls.',
    objective: { kind: 'loot', region: 'vinecoil', item: 'Panther Pelt', from: ['jungle-panther'], chance: 0.4, count: 6, label: 'Take Panther Pelts from jungle panthers' },
    after: ['mabels-mules'],
    zone: 'vinecoil',
    level: 40,
    reward: { xp: 2100, gold: 460 },
  },
  {
    id: 'nightpelt',
    name: 'Nightpelt',
    giver: 'trader-mabel',
    text: 'The loggers tell a story about a black panther at the falls, as old as the stockade, who takes a man off the trail every rainy season and is never seen. Mabel didn’t believe it until she saw what was left of her mules. Nightpelt is at Panther Falls, south-east of Vinehold, and her pride comes when she calls. Mabel has a buyer for the hide. Mabel always has a buyer.',
    objective: { kind: 'kill', region: 'vinecoil', count: 1, enemies: ['nightpelt'], label: 'Defeat Nightpelt at Panther Falls' },
    after: ['spotted-pelts'],
    zone: 'vinecoil',
    level: 41,
    reward: { xp: 3500, gold: 760, item: 'nightpelt-jerkin', text: 'Mabel turns the buyer down. She cuts a jerkin from the black hide herself and gives it to you, which she says is the worst deal she has ever made.' },
  },
  /* ------------------------------------------------- Shaman Tuoko's fever */
  {
    id: 'the-mire-pools',
    name: 'The Mire Pools',
    giver: 'shaman-tuoko',
    text: 'Half of Vinehold is down with the red fever, and the other half is nursing them. Tuoko knows where it comes from: the Mire Pools, south-east of Vinehold, where the blood mosquitoes breed, and this year they are breeding like they have been told to. Go and look at the pools. Keep your sleeves down.',
    objective: { kind: 'explore', spot: 'mire-pools', label: 'Look over the Mire Pools' },
    after: ['the-serpent-temples'],
    zone: 'vinecoil',
    level: 40,
    reward: { xp: 1700, gold: 440 },
  },
  {
    id: 'the-red-fever',
    name: 'The Red Fever',
    giver: 'shaman-tuoko',
    text: 'The pools are black with them, and the swarms are spreading up the trails toward the stockade. Tuoko can’t drain the Mire, but she can thin what comes out of it. Swat the blood mosquitoes wherever they swarm, from the Mire Pools to Strangler Grove. Twelve should buy Vinehold a quiet night.',
    objective: { kind: 'kill', region: 'vinecoil', count: 12, enemies: ['blood-mosquito'], label: 'Swat blood mosquitoes' },
    after: ['the-mire-pools'],
    zone: 'vinecoil',
    level: 41,
    reward: { xp: 2000, gold: 470 },
  },
  {
    id: 'a-drop-of-venom',
    name: 'A Drop of Venom',
    giver: 'shaman-tuoko',
    text: 'The fever breaks for viper venom, a drop at a time. Tuoko’s grandmother cured it that way, and her grandmother, and nobody in the family has ever been bitten finding out, which Tuoko says is the real family secret. The cult’s temple vipers coil on the Serpent Steps east of Vinehold and around the Coiled Temple. Five fangs, please, with the venom still in them.',
    objective: { kind: 'loot', region: 'vinecoil', item: 'Viper Fang', from: ['temple-viper'], chance: 0.4, count: 5, label: 'Take Viper Fangs from temple vipers' },
    after: ['the-red-fever'],
    zone: 'vinecoil',
    level: 41,
    reward: { xp: 2600, gold: 560, item: 'tuokos-gourd', text: 'The fever breaks in Vinehold by morning. Tuoko fills a gourd with the last of the smoke and hangs it on your belt.' },
  },
];

export const VINECOIL_NPCS: Record<string, NpcDef> = {
  'warden-kesh': {
    id: 'warden-kesh',
    name: 'Warden Kesh',
    title: 'Warden of Vinehold',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-serpent-temples', state: 'active' },
        lines: ['Ansel sent you? The old lamp-man with the gulls? Then the jars have gone further than I feared.', 'I’m Kesh. I keep the wardens, and the wardens keep Vinehold, and lately nobody is keeping me. Come in. Mind the stockade, it bites.'],
      },
      {
        when: { quest: 'the-lost-loggers', state: 'active' },
        lines: ['Eight loggers went up the north trail for ironwood. Two wardens went after them. That’s ten people, and I haven’t heard from one.', 'The serpent cult has a camp up there, north-east of town. Go and look. Come back, please. I’m running out of people to send.'],
      },
      {
        when: { quest: 'snakes-in-the-timber', state: 'active' },
        lines: ['Boots in a row. The cult always takes the boots off first. It’s a temple thing. Prisoners walk slower barefoot.', 'They march them east to the temples. Drive the cultists back, and their naga with them. I’ll take every warden I can spare and none of them can be spared.'],
      },
      {
        when: { quest: 'venom-for-a-king', state: 'active' },
        lines: ['Every cultist carries a jar at the belt. Same seal as Ansel’s: the serpent, and that empty crown.', 'Five on my table, please. Unopened. I lost a good dog to one of those jars, and I’d rather not lose you.'],
      },
      {
        when: { quest: 'the-queens-bargain', state: 'active' },
        lines: ['The glyphs on the seals are older than the stockade, older than the kingdoms. I can’t read them. Nobody can, except Tuoko.', 'She keeps the Smoking Gourd, on the square. Take her the jars. Don’t let her taste one; she’ll want to.'],
      },
      {
        when: { quest: 'strangler-hearts', state: 'active' },
        lines: ['A hundred jars to the Hollow King. For the plague that took Duskfen. Sold by a queen who lives a day’s walk from my gate.', 'Do what Tuoko says. If her brew can keep that venom out of you, it’s worth the smell.'],
      },
      {
        when: { quest: 'the-serpent-steps', state: 'active' },
        lines: ['One of my wardens found a logger’s boot on the old processional road, east of here across the river. The Serpent Steps.', 'The cult marches its prisoners up those steps to the Coiled Temple. Find the road. Then we’ll know where they’ve taken them.'],
      },
      {
        when: { quest: 'the-scaled-guard', state: 'active' },
        lines: ['Naga, all the way up the steps. Bronze scale, tridents, tempers.', 'I won’t take wardens up that road with the naga on it. Thin them out, and the rest will remember they have somewhere else to be.'],
      },
      {
        when: { quest: 'the-coiled-queen', state: 'active' },
        lines: ['The road’s open. The loggers are in the temple, if they’re anywhere. So is she: the Coiled Queen.', 'She sold the venom for the Duskfen plague, and she’s bottling more. Go up the steps, in the far north-east, and close her shop.'],
      },
      {
        when: { quest: 'the-coiled-queen', state: 'done' },
        lines: ['Eight loggers and two wardens, home and complaining about the food. I’ve never been so glad to hear complaining.', 'The ledger says her last jars went north to the siege of Highwall. Whoever is drinking that venom up there, I’d like them to choke on it.'],
      },
      {
        when: { quest: 'the-serpent-temples', state: 'done' },
        lines: ['This is Vinehold: a stockade, a sawmill and a lot of people who would rather be cutting wood than holding spears.', 'Stay on the trails. Anything off the trails either wants to eat you or wants to sell you to something that does.'],
      },
      { lines: ['Vinehold. Loggers, wardens and mud. Mind the panthers on the way in.', 'The jungle was here before the kingdoms, and it will be here after. We just try to get the timber out first.'] },
    ],
  },
  'trader-mabel': {
    id: 'trader-mabel',
    name: 'Trader Mabel',
    title: 'Trader',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'Mabel’s Hides & Mail',
    talk: [
      {
        when: { quest: 'mabels-mules', state: 'active' },
        lines: ['Six mules, six loads of mail shirts for the wardens, one trail down past the falls. Four mules came home. No shirts. Very little nerve.', 'Panther Falls, south-east of town, across the river. Find my shirts. Find out what ate my mules. In that order, if you can.'],
      },
      {
        when: { quest: 'spotted-pelts', state: 'active' },
        lines: ['Panthers! More of them than there should be, and closer to the stockade every week. Something’s pushing them out of the deep green.', 'A panther that’s eaten my mule owes me a pelt. Six pelts, and the wardens get cloaks. That’s what I call a fair trade.'],
      },
      {
        when: { quest: 'nightpelt', state: 'active' },
        lines: ['The loggers talk about a black panther at the falls. Takes a man every rainy season. Never seen. I thought it was a story to scare apprentices.', 'Then I saw what was left of my mules. Nightpelt. Bring me her hide. I’ve a buyer. I always have a buyer.'],
      },
      { when: { quest: 'nightpelt', state: 'done' }, lines: ['The buyer offered me twice what the hide’s worth. I said no. I don’t know what came over me.', 'Wear it in good health. And if anyone asks, you paid full price.'] },
      { lines: ['Mabel’s Hides & Mail. Hides from the jungle, mail from the coast, prices from my own head.', 'If it fits, it’s yours. If it doesn’t fit, it’s still yours: I don’t take returns.'] },
    ],
  },
  'shaman-tuoko': {
    id: 'shaman-tuoko',
    name: 'Shaman Tuoko',
    title: 'Shaman',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Smoking Gourd',
    talk: [
      {
        when: { quest: 'the-queens-bargain', state: 'active' },
        lines: [
          'Kesh’s jars. Put them on the table, gently. Gently. Thank you.',
          'The serpent on the seal is the Coiled Queen’s, high queen of the old temples. The glyphs under it say: “For the King with the empty crown. A hundred jars, paid in pale gold.”',
          'Duskfen’s plague was brewed from this. The Queen sold the Hollow King the venom, and someone in a cistern turned it into a sickness. Tell Kesh. Then come back. You’ll need something from me.',
        ],
      },
      {
        when: { quest: 'strangler-hearts', state: 'active' },
        lines: ['If you mean to visit the Queen, you’ll want an antidote first. Her venom kills in a breath, and you breathe a lot.', 'The stranglers in Strangler Grove, south-west of town, grow a heart that drinks poison and likes it. Four hearts. I’ll do the rest. You won’t like the taste.'],
      },
      {
        when: { quest: 'the-mire-pools', state: 'active' },
        lines: ['Half the stockade has the red fever and the other half is nursing them. It comes up from the Mire Pools, south-east of town, where the blood mosquitoes breed.', 'They breed every year. Not like this. This year they’re breeding like someone told them to. Go and look. Sleeves down.'],
      },
      {
        when: { quest: 'the-red-fever', state: 'active' },
        lines: ['Black with them, you say? I believe it. I can hear them from here at night.', 'Swat them wherever they swarm. Twelve, and Vinehold sleeps tonight. Twenty, and I might.'],
      },
      {
        when: { quest: 'a-drop-of-venom', state: 'active' },
        lines: ['The fever breaks for viper venom, a drop at a time. My grandmother’s cure, and hers. None of us has ever been bitten getting it. That’s the real secret.', 'The temple vipers coil on the Serpent Steps, east of town, and up around the Coiled Temple. Five fangs, with the venom in them. Hold them by the wrong end.'],
      },
      { when: { quest: 'the-coiled-queen', state: 'done' }, lines: ['The Queen is dead and her jars are in the river. The fish are having a terrible week. I can live with that.'] },
      { when: { quest: 'a-drop-of-venom', state: 'done' }, lines: ['The fever’s broken. The stockade is eating me out of soup. Sit, have a bowl before it’s gone.'] },
      { lines: ['The Smoking Gourd. Soup in the pot, potions on the shelf, smoke in everything.', 'Potions for the trail. You’ll want more than you think. Everyone does.'] },
    ],
  },
};
