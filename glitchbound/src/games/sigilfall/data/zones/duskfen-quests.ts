import type { NpcDef, QuestDef } from '../types';

/**
 * Stilt Hollow's people and Duskfen's quests. The sickness that turns villagers into ghouls is not a
 * sickness at all but a brew: the Rot-Mother, one of the Hollow King's lieutenants, stirs it in the
 * old cistern under the south of the fen, and her green sisters carry it to the wells in jars. Healer
 * Osk works it out from the bile; Mags the scavenger has seen the sisters; the trail leads down into
 * the Rotmother's Cistern, past Brother Pustule, to the Rot-Mother herself. Brother Wendel and Mags
 * have chains of their own. The chain opens once Mother Mire is dead in Greyfen.
 */
export const DUSKFEN_QUESTS: QuestDef[] = [
  /* ------------------------------------------------------------ the way in */
  {
    id: 'the-sick-villages',
    name: 'The Sick Villages',
    giver: 'marshwarden-tilde',
    text: 'Mother Mire is dead, and Tilde knows now what made her: not a curse but a sickness, come up the river from Duskfen, the plague swamp west of Greyfen, where it is turning whole villages into ghouls. Tilde’s old friend Healer Osk is still fighting it in Stilt Hollow. Take the west causeway out of Greyfen and find her.',
    objective: { kind: 'talk', npc: 'healer-osk', label: 'Talk to Healer Osk in Stilt Hollow' },
    after: ['the-ghoul-mother'],
    level: 18,
    reward: { xp: 400, gold: 140 },
  },
  /* ------------------------------------------------------------ the plague */
  {
    id: 'low-wick',
    name: 'Low Wick',
    giver: 'healer-osk',
    text: 'Low Wick was the first village to sicken. Osk sent it medicine for a month, and then the carts stopped coming back. It lies south of Stilt Hollow, across the black water. Go and see what is left of it. Don’t drink anything.',
    objective: { kind: 'explore', spot: 'low-wick', label: 'Go to Low Wick' },
    after: ['the-sick-villages'],
    zone: 'duskfen',
    reward: { xp: 470, gold: 150 },
  },
  {
    id: 'the-turned',
    name: 'The Turned',
    giver: 'healer-osk',
    text: 'Nobody is left in Low Wick, only what the sickness made of them, and it is spreading out through the reeds. Osk knew most of them by name. She asks you to put them down quickly, and not to tell her which ones.',
    objective: { kind: 'kill', region: 'duskfen', count: 12, enemies: ['plague-ghoul', 'plaguebearer'], label: 'Defeat plague ghouls and plaguebearers' },
    after: ['low-wick'],
    zone: 'duskfen',
    reward: { xp: 600, gold: 160 },
  },
  {
    id: 'bad-blood',
    name: 'Bad Blood',
    giver: 'healer-osk',
    text: 'The plaguebearers carry the sickness in skins of bile and spit it at anything alive. Osk wants four skins, full and stoppered, to find out what is in them. Carry them at arm’s length.',
    objective: { kind: 'loot', region: 'duskfen', item: 'Skin of Bile', from: ['plaguebearer'], chance: 0.5, count: 4, label: 'Take Skins of Bile from plaguebearers' },
    after: ['the-turned'],
    zone: 'duskfen',
    reward: { xp: 540, gold: 160 },
  },
  {
    id: 'brewed-not-born',
    name: 'Brewed, Not Born',
    giver: 'healer-osk',
    text: 'Osk boiled the bile down and found grave-dust, cistern water and something sweet. No sickness grows like that by itself: somebody brews it. Mags the scavenger goes everywhere in Duskfen that has anything worth taking. If anyone has seen the brewers, it’s Mags.',
    objective: { kind: 'talk', npc: 'mags', label: 'Ask Mags who she has seen' },
    after: ['bad-blood'],
    zone: 'duskfen',
    level: 19,
    reward: { xp: 460, gold: 150 },
  },
  {
    id: 'the-green-sisters',
    name: 'The Green Sisters',
    giver: 'mags',
    text: 'Mags has seen them: women in green rags who walk the fen at night with stoppered jars and pour them into the wells. A week later the village coughs; two weeks later it bites. The sisters gather at the Weeping Wells, south-west of Stilt Hollow. Take their jars before they can pour them.',
    objective: { kind: 'loot', region: 'duskfen', item: 'Rot Jar', from: ['rot-sister'], chance: 0.5, count: 3, label: 'Take Rot Jars from the green sisters' },
    after: ['brewed-not-born'],
    zone: 'duskfen',
    level: 20,
    reward: { xp: 640, gold: 180 },
  },
  {
    id: 'the-cistern-mouth',
    name: 'The Cistern Mouth',
    giver: 'healer-osk',
    text: 'Every jar bears the same seal: a pot over a fire, and the word MOTHER. Osk has heard it from her dying patients, at the end; she thought they were calling for their mothers. They were calling for the Rot-Mother, who stirs her pot in the old cistern under the south of the fen. The sisters fill their jars there. Find the cistern’s mouth.',
    objective: { kind: 'explore', spot: 'cistern-mouth', label: 'Find the Cistern Mouth' },
    after: ['the-green-sisters'],
    zone: 'duskfen',
    level: 21,
    reward: { xp: 560, gold: 180 },
  },
  {
    id: 'brother-pustule',
    name: 'Brother Pustule',
    giver: 'healer-osk',
    text: 'The Cistern Mouth breathes out the same sweet stink as the bile. Below it, Duskfen’s old cistern has become the Rot-Mother’s brewery, and Brother Pustule keeps her vats. Osk has made you a tincture to keep the worst of it out of your lungs. It tastes worse than the swamp. Go down and get past him.',
    objective: { kind: 'boss', boss: 'brother-pustule', label: 'Defeat Brother Pustule in the Rotmother’s Cistern' },
    after: ['the-cistern-mouth'],
    zone: 'duskfen',
    level: 22,
    reward: { xp: 1000, gold: 220, item: { rarity: 'rare' } },
  },
  {
    id: 'the-rot-mother',
    name: 'The Rot-Mother',
    giver: 'healer-osk',
    text: 'At the bottom of the cistern the Rot-Mother stirs her pot. Every sick village in Duskfen was ladled out of it, and every ghoul she makes marches north to join the Hollow King, whose lieutenant she is. End her, and Stilt Hollow might live to see a dry summer.',
    objective: { kind: 'boss', boss: 'the-rot-mother', label: 'Defeat the Rot-Mother' },
    after: ['brother-pustule'],
    zone: 'duskfen',
    reward: { xp: 2350, gold: 700, item: 'plaguewarden-hood', text: 'Osk pours the last of the brew into the fire. She gives you the hood she wore on the worst nights in Stilt Hollow, made over to fit you.' },
  },
  /* -------------------------------------------- the chapel of St. Ilse */
  {
    id: 'the-rotting-chapel',
    name: 'The Rotting Chapel',
    giver: 'brother-wendel',
    text: 'Brother Wendel kept the chapel of St. Ilse, in the far west of the fen, with six other brothers. He left to fetch medicine; when he came back the chapel had gone green, and so had the brothers. He would like to know if any of them are still themselves. He doesn’t think so.',
    objective: { kind: 'explore', spot: 'rotting-chapel', label: 'Go to the Rotting Chapel' },
    after: ['low-wick'],
    zone: 'duskfen',
    level: 21,
    reward: { xp: 560, gold: 170 },
  },
  {
    id: 'prayer-beads',
    name: 'Prayer Beads',
    giver: 'brother-wendel',
    text: 'The brothers of St. Ilse walk with the ghouls now, all over the fen, and they still wear their prayer beads, though they don’t pray any more. Wendel wants the beads back, five strings, so he can say their names over them.',
    objective: { kind: 'loot', region: 'duskfen', item: 'Prayer Beads', from: ['plague-ghoul'], chance: 0.35, count: 5, label: 'Recover Prayer Beads from plague ghouls' },
    after: ['the-rotting-chapel'],
    zone: 'duskfen',
    reward: { xp: 600, gold: 180 },
  },
  {
    id: 'hunt-gutrot',
    name: 'Gutrot',
    giver: 'brother-wendel',
    text: 'One brother doesn’t walk with the others. Brother Aldo, the chapel’s cellarer, ate everything the sickness gave him and swelled into the thing the ghouls call Gutrot. He sits in the Rotting Chapel and coughs up the dead. Wendel has prayed for him every night. Now he asks you to end it.',
    objective: { kind: 'kill', region: 'duskfen', count: 1, enemies: ['gutrot'], label: 'Defeat Gutrot in the Rotting Chapel' },
    after: ['prayer-beads'],
    zone: 'duskfen',
    level: 22,
    reward: { xp: 960, gold: 240, item: 'st-ilse-beads', text: 'Wendel knots the seven strings into one and puts it over your head. He says every name as he does it.' },
  },
  /* ------------------------------------------------------ Mags's salvage */
  {
    id: 'crow-pickings',
    name: 'Crow Pickings',
    giver: 'mags',
    text: 'The plague crows steal anything that shines, which Mags considers unfair competition. They nest at Carrion Nest, north-west of Stilt Hollow, and hunt all over the fen. Bring back six of their trinkets. Mags will decide which ones are hers.',
    objective: { kind: 'loot', region: 'duskfen', item: 'Shiny Trinket', from: ['plague-crow'], chance: 0.5, count: 6, label: 'Take Shiny Trinkets from plague crows' },
    after: ['the-sick-villages'],
    zone: 'duskfen',
    level: 19,
    reward: { xp: 520, gold: 170 },
  },
  {
    id: 'thick-skin',
    name: 'Thick Skin',
    giver: 'mags',
    text: 'Troll hide keeps out water, rot and most arrows, and the trolls of Troll Mire, west of Stilt Hollow, wear it everywhere. Mags wants four hides. Trolls knit back together if you give them a moment, so don’t give them a moment.',
    objective: { kind: 'loot', region: 'duskfen', item: 'Troll Hide', from: ['swamp-troll'], chance: 0.5, count: 4, label: 'Take Troll Hides from swamp trolls' },
    after: ['crow-pickings'],
    zone: 'duskfen',
    level: 20,
    reward: { xp: 600, gold: 180 },
  },
  {
    id: 'hunt-bogmaw',
    name: 'Bogmaw',
    giver: 'mags',
    text: 'The biggest troll in the mire is Bogmaw, and he sits on the best salvage in Duskfen: three wagons, a rowboat and, Mags swears, a piano. Get him off it. Mags will make you something from his hide that keeps your feet dry and your heart beating.',
    objective: { kind: 'kill', region: 'duskfen', count: 1, enemies: ['bogmaw'], label: 'Defeat Bogmaw in Troll Mire' },
    after: ['thick-skin'],
    zone: 'duskfen',
    level: 21,
    reward: { xp: 880, gold: 220, item: 'trollhide-boots', text: 'Mags stitches you a pair of boots from Bogmaw’s hide. They still try to heal.' },
  },
  /* ---------------------------------------------------------- clean water */
  {
    id: 'clean-water',
    name: 'Clean Water',
    giver: 'healer-osk',
    text: 'The sick in Stilt Hollow need clean water, and the only clean water left in Duskfen bubbles up at Stillwater Spring, north-east of the village, where the plague hasn’t reached. Yet. Find it and mark the way, so Osk’s helpers can fetch it.',
    objective: { kind: 'explore', spot: 'stillwater', label: 'Find Stillwater Spring' },
    after: ['low-wick'],
    zone: 'duskfen',
    reward: { xp: 520, gold: 220 },
  },
];

export const DUSKFEN_NPCS: Record<string, NpcDef> = {
  'healer-osk': {
    id: 'healer-osk',
    name: 'Healer Osk',
    title: 'Healer of Stilt Hollow',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-sick-villages', state: 'active' },
        lines: ['Tilde sent you? Then you’ve seen what the sickness makes. Good. I won’t have to describe it.', 'Stilt Hollow is the last village in Duskfen still breathing on its own. I mean to keep it that way.'],
      },
      {
        when: { quest: 'low-wick', state: 'active' },
        lines: ['Low Wick, south of here, across the black water. The first to sicken. I sent medicine for a month. Then the carts stopped coming back.', 'Look. Don’t touch. Don’t drink. Don’t breathe, if you can manage it.'],
      },
      { when: { quest: 'the-turned', state: 'active' }, lines: ['They were people. Now they’re hungry. Put them down quickly.', 'Don’t tell me which ones. I knew most of them.'] },
      {
        when: { quest: 'bad-blood', state: 'active' },
        lines: ['The plaguebearers carry it in skins of bile. I need four, full and stoppered.', 'If one bursts on you, walk into the water and keep walking until it stops itching.'],
      },
      {
        when: { quest: 'brewed-not-born', state: 'active' },
        lines: ['Grave-dust, cistern water, and something sweet. Sickness doesn’t grow like that. Somebody brews it.', 'Mags goes everywhere worth taking from. Ask her who she’s seen. Count your fingers after.'],
      },
      {
        when: { quest: 'the-green-sisters', state: 'active' },
        lines: ['Sisters with jars, pouring them into the wells. And I’ve been treating the water with salt and prayer.', 'Bring me their jars. Unbroken, if you love me. Unbroken anyway, if you don’t.'],
      },
      {
        when: { quest: 'the-cistern-mouth', state: 'active' },
        lines: ['MOTHER. My patients say it at the end, when the fever takes them. I thought they were calling for their mothers.', 'They weren’t. The old cistern is in the south of the fen. Find its mouth.'],
      },
      {
        when: { quest: 'brother-pustule', state: 'active' },
        lines: ['Drink this. It keeps the worst out of your lungs. Yes, it tastes like that. So does the cistern.', 'Brother Pustule keeps her vats. He isn’t a brother of anything I’d join.'],
      },
      {
        when: { quest: 'the-rot-mother', state: 'active' },
        lines: ['She’s at the bottom, stirring. Every ghoul in this fen came out of her pot, and every one of them marches north to the Hollow King.', 'End her. I’ll have the water boiled by the time you’re back.'],
      },
      {
        when: { quest: 'clean-water', state: 'active' },
        lines: ['Stillwater Spring, north-east of the village. The only clean water left in the fen.', 'If the plague has reached it, don’t tell me. Just come back looking brave.'],
      },
      { when: { quest: 'the-rot-mother', state: 'done' }, lines: ['The wells are running clear. Clearish. The fever has broken in half the beds.', 'I’m going to sleep for a week. If anyone gets sick, tell them to wait.'] },
      { lines: ['Stilt Hollow. Mind the planks: the ones that creak are the safe ones.', 'If you’re sick, see me. If you’re not, see me anyway, so I remember what healthy looks like.'] },
    ],
  },
  'brother-wendel': {
    id: 'brother-wendel',
    name: 'Brother Wendel',
    title: 'Keeper of the sick',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'St. Ilse’s Hostel',
    talk: [
      {
        when: { quest: 'the-rotting-chapel', state: 'active' },
        lines: ['I kept the chapel of St. Ilse, in the far west of the fen, with six brothers. I left to fetch medicine. When I came back it had gone green, and so had they.', 'Go and see. If any of them are still themselves, tell them Wendel came back.'],
      },
      { when: { quest: 'prayer-beads', state: 'active' }, lines: ['The brothers still wear their beads. They don’t pray any more, but they wear them.', 'Five strings. I’ll say their names over them. It’s what I have.'] },
      {
        when: { quest: 'hunt-gutrot', state: 'active' },
        lines: ['Brother Aldo kept our cellar. He ate whatever the sickness gave him, and it gave him a great deal.', 'The ghouls call him Gutrot. He coughs up the dead, and they burst. Stand back from them. End it. I’ll pray for both of you.'],
      },
      { when: { quest: 'hunt-gutrot', state: 'done' }, lines: ['The chapel is quiet. I’ll go back in the spring and scrub it. It will take until the next spring.'] },
      { lines: ['Potions on the shelf, beds in the back, and a prayer for anyone who wants one.', 'Most of the beds are full. The sick sleep better when someone is awake, so I’m awake.'] },
    ],
  },
  mags: {
    id: 'mags',
    name: 'Mags',
    title: 'Scavenger',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'Mags’s Finds',
    talk: [
      {
        when: { quest: 'brewed-not-born', state: 'active' },
        lines: [
          'Who’s brewing it? Ah. Now that’s worth something. …Fine, it’s worth nothing. Osk saved my leg once.',
          'Women in green rags, at night, with jars. They pour them into the wells. They meet at the Weeping Wells, south-west of here. I don’t go there. That should tell you something.',
        ],
      },
      { when: { quest: 'the-green-sisters', state: 'active' }, lines: ['The Weeping Wells. Don’t let the sisters pour on you, and don’t let me catch you selling those jars.', 'They call the sick up out of the mud. Hit the sister, not the mud.'] },
      { when: { quest: 'crow-pickings', state: 'active' }, lines: ['The crows steal anything that shines. That’s my job. Unfair competition.', 'Six trinkets. I’ll decide which ones are mine. All of them, probably.'] },
      { when: { quest: 'thick-skin', state: 'active' }, lines: ['Troll hide. Keeps out water, rot and most arrows. Trolls wear it everywhere, the show-offs.', 'Four hides. They knit back together if you let them catch their breath. Don’t let them.'] },
      {
        when: { quest: 'hunt-bogmaw', state: 'active' },
        lines: ['Bogmaw sits on the best salvage in Duskfen: three wagons, a rowboat and a piano. I swear it’s a piano.', 'Get him off it and I’ll make you boots out of him. Good boots.'],
      },
      { when: { quest: 'hunt-bogmaw', state: 'done' }, lines: ['It was a harpsichord. Close enough. Look after those boots: they’re the only thing in this fen that ever got better.'] },
      { lines: ['Mags. I find things. Rings, charms, little treasures the swamp is done with.', 'Everything’s for sale except my boat. Especially not my boat.'] },
    ],
  },
};
