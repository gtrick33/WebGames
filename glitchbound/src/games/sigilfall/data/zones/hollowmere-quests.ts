import type { NpcDef, QuestDef } from '../types';

/**
 * The landing's people and the quests of Hollowmere (see WORLD.md). Beyond the Gloam Gate lies the dead
 * lake, and on its southern shore the Ferryman, who has rowed the dead across it for one coin a head
 * since before the Hollow King went into the ground, keeps a landing with Old Nan's hostel, a pilgrim
 * selling charms and a gravedigger who has lately had to bury people twice. The main chain follows the
 * drowned up out of the water, the serpents in the shallows and the black barges to the Corpse Landing,
 * then over the old causeway to the necropolis on the water, where the Lich of Hollowmere makes
 * Vaelor's dead out of the dead who should have crossed. It ends pointing north, to the Pale Reach.
 * Osric looks for his daughter in Drowned Elsmere, Nan for her lodgers on Mourners' Shore, and Mott for
 * his shrouds. Main chain first.
 */
export const HOLLOWMERE_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-dead-lake',
    name: 'The Dead Lake',
    giver: 'lamp-keeper-ada',
    text: 'With the Gatewarden dead the King’s border stands open, and Lamp-keeper Ada has no more lamps to light past it. Beyond Gloamhollow the east causeway runs out over Hollowmere, a black lake so still it shows a sky that isn’t there. On its southern shore a ferryman keeps a landing; Ada’s grandmother bought eels from him, she says, and so did hers. Take the east causeway out of Gloamhollow and find the Ferryman.',
    objective: { kind: 'talk', npc: 'the-ferryman', label: 'Find the Ferryman at his landing on Hollowmere’s southern shore' },
    after: ['the-gloam-gate'],
    level: 56,
    reward: { xp: 2000, gold: 650 },
  },
  /* ------------------------------------------------------- the shore */
  {
    id: 'the-restless-shore',
    name: 'The Restless Shore',
    giver: 'the-ferryman',
    text: 'The Ferryman has rowed the dead across Hollowmere for longer than he can count, one coin a head, and they always used to wait quietly on the shore for him. Not any more: the drowned of the sunken towns walk out of the water every night and knock on Old Nan’s shutters. Put down twelve drowned dead along the shore around the landing. Don’t leave them lying about, he adds: the lake stitches its own back together.',
    objective: { kind: 'kill', region: 'hollowmere', count: 12, enemies: ['drowned-dead'], label: 'Put down the drowned dead' },
    after: ['the-dead-lake'],
    zone: 'hollowmere',
    level: 56,
    reward: { xp: 2200, gold: 680 },
  },
  {
    id: 'pennies-for-the-ferryman',
    name: 'Pennies for the Ferryman',
    giver: 'the-ferryman',
    text: 'Everyone who drowned in the lake was buried, or should have been, with a penny under the tongue for the crossing. The Ferryman won’t row anyone without their fare: rules are rules, and he has had a long time to grow fond of rules. Bring him six pennies from the drowned dead and the lake wraiths, wherever they walk or skim, and he will see their owners across properly.',
    objective: { kind: 'loot', region: 'hollowmere', item: 'Ferry Penny', from: ['drowned-dead', 'lake-wraith'], chance: 0.35, count: 6, label: 'Take Ferry Pennies from the drowned dead and lake wraiths' },
    after: ['the-restless-shore'],
    zone: 'hollowmere',
    level: 56,
    reward: { xp: 2200, gold: 700 },
  },
  {
    id: 'the-serpent-shallows',
    name: 'The Serpent Shallows',
    giver: 'the-ferryman',
    text: 'The fares are paid, but the ferry won’t get far: the way across the mere runs through the Serpent Shallows, north-east of the landing, and something in them has been taking bites out of the boat. Mere serpents, blind and black and as long as the boat is. Kill six, at the Shallows or wherever they rear up out of the water, and the Ferryman can row again.',
    objective: { kind: 'kill', region: 'hollowmere', count: 6, enemies: ['mere-serpent'], label: 'Kill mere serpents' },
    after: ['pennies-for-the-ferryman'],
    zone: 'hollowmere',
    level: 57,
    reward: { xp: 2300, gold: 720 },
  },
  /* ---------------------------------------------- the Lich's household */
  {
    id: 'the-black-barges',
    name: 'The Black Barges',
    giver: 'the-ferryman',
    text: 'The Ferryman went out on the water last night for the first time in a month and came back early, and quiet. He saw other boats: black barges poled by nobody, riding low with the dead and making for the Corpse Landing on the far east shore. He has rowed this lake since before the King went into the ground, and he has never had competition. Go east along the shore and see where they land.',
    objective: { kind: 'explore', spot: 'corpse-landing', label: 'Find the Corpse Landing on the east shore' },
    after: ['the-serpent-shallows'],
    zone: 'hollowmere',
    level: 57,
    reward: { xp: 2100, gold: 700 },
  },
  {
    id: 'the-bone-weavers',
    name: 'The Bone-Weavers',
    giver: 'the-ferryman',
    text: 'At the Corpse Landing the barges unload the dead, and the bone-weavers set to work: hunched, four-armed things that sew the drowned into new shapes with needles of finger-bone and send them walking toward the island. The Ferryman calls it theft, and for once he raises his voice. Kill five bone-weavers, at the Corpse Landing on the east shore or wherever they work.',
    objective: { kind: 'kill', region: 'hollowmere', count: 5, enemies: ['bone-weaver'], label: 'Kill bone-weavers' },
    after: ['the-black-barges'],
    zone: 'hollowmere',
    level: 57,
    reward: { xp: 2400, gold: 740 },
  },
  {
    id: 'the-lichs-seal',
    name: 'The Lich’s Seal',
    giver: 'the-ferryman',
    text: 'The weavers work for the island: the necropolis in the middle of the mere, where the Lich of Hollowmere makes the Hollow King’s dead out of the dead who should have crossed with the Ferryman. Its doors open for its own and nobody else, and its own carry its seal, a disc of black bone. Take three seals from the necropolis guards and lich acolytes, on the roads north of the landing or at the island itself.',
    objective: { kind: 'loot', region: 'hollowmere', item: 'Necropolis Seal', from: ['necropolis-guard', 'lich-acolyte'], chance: 0.3, count: 3, label: 'Take Necropolis Seals from guards and acolytes' },
    after: ['the-bone-weavers'],
    zone: 'hollowmere',
    level: 58,
    reward: { xp: 2400, gold: 760 },
  },
  {
    id: 'across-the-mere',
    name: 'Across the Mere',
    giver: 'the-ferryman',
    text: 'The Ferryman will not row to the island. No boat that went there ever came back, he says, and he would like to keep his. But the old causeway the dead were once carried along to be buried still runs out to it, north-east of the landing beyond the Serpent Shallows, and with the seal its doors will open. Go to the necropolis and see what the Lich is making.',
    objective: { kind: 'explore', spot: 'the-necropolis', label: 'Reach the necropolis on the water' },
    after: ['the-lichs-seal'],
    zone: 'hollowmere',
    level: 58,
    reward: { xp: 2300, gold: 760, item: { rarity: 'rare' } },
  },
  {
    id: 'the-necropolis',
    name: 'The Necropolis',
    giver: 'the-ferryman',
    text: 'Inside the necropolis the drowned lie in rows, waiting to be finished, and among them the Lich of Hollowmere sits on a throne of coral and bone and calls more up out of the lake. He was a sorcerer of the old kingdom, the Ferryman says, who had himself drowned so he could rule the drowned, and Vaelor has made him the maker of his dead. Kill the Lich in his necropolis on the water, and the lake’s dead can cross in peace.',
    objective: { kind: 'kill', region: 'hollowmere', count: 1, enemies: ['the-lich-of-hollowmere'], label: 'Kill the Lich of Hollowmere in the necropolis' },
    after: ['across-the-mere'],
    zone: 'hollowmere',
    level: 58,
    reward: {
      xp: 9200,
      gold: 2400,
      item: 'phylactery-of-hollowmere',
      text: 'The Lich comes apart on his throne, and all over the island the half-finished dead lie down at once. That night the Ferryman rows until dawn and comes back lighter. He gives you the black jar the Lich kept his death in, and points north with his oar: the Lich made his soldiers for the Pale Reach, and somebody up there is still fighting them.',
    },
  },
  /* --------------------------------------------------- Osric's daughter */
  {
    id: 'a-pilgrims-errand',
    name: 'A Pilgrim’s Errand',
    giver: 'pilgrim-osric',
    text: 'Pilgrim Osric walked here from Emberwick with a staff and a pack of charms, looking for his daughter Wenna, who married a chandler in Elsmere and went under with the town when the lake rose. He sells charms at the landing because he ran out of money, he says, not out of hope. He has never dared go up the western shore himself. Go north-west of the landing to Drowned Elsmere and tell him what is left of it.',
    objective: { kind: 'explore', spot: 'drowned-town', label: 'Find Drowned Elsmere north-west of the landing' },
    after: ['the-dead-lake'],
    zone: 'hollowmere',
    level: 56,
    reward: { xp: 1600, gold: 640 },
  },
  {
    id: 'keepsakes-of-elsmere',
    name: 'Keepsakes of Elsmere',
    giver: 'pilgrim-osric',
    text: 'What is left of Elsmere is a bell tower standing in the water, roofs under the surface, and the women of the town skimming over them in wet grey veils, still looking for their own doors. Osric thinks one of them may be Wenna. He would like back what they carry: a ring, a comb, a locket, anything she might have held. Take five keepsakes from the lake wraiths, around Drowned Elsmere or anywhere on the shore.',
    objective: { kind: 'loot', region: 'hollowmere', item: 'Elsmere Keepsake', from: ['lake-wraith'], chance: 0.35, count: 5, label: 'Take Elsmere Keepsakes from lake wraiths' },
    after: ['a-pilgrims-errand'],
    zone: 'hollowmere',
    level: 57,
    reward: { xp: 1800, gold: 680 },
  },
  {
    id: 'the-bell-of-elsmere',
    name: 'The Bell of Elsmere',
    giver: 'pilgrim-osric',
    text: 'One of the keepsakes is a locket with Wenna’s name in it, and Osric sat up with it all night. In the morning he asked you to make the bell stop. Elsmere’s sexton rang it the night the lake rose, and he is ringing it still in the drowned tower: every toll calls the town’s dead up out of the water again, and none of them can rest while it rings. Kill the Bell-Ringer in Drowned Elsmere, north-west of the landing.',
    objective: { kind: 'kill', region: 'hollowmere', count: 1, enemies: ['the-bell-ringer'], label: 'Kill the Bell-Ringer in Drowned Elsmere' },
    after: ['keepsakes-of-elsmere'],
    zone: 'hollowmere',
    level: 57,
    reward: { xp: 2800, gold: 900, item: 'elsmere-bell-clapper', text: 'The bell stops. Osric buries the locket on the hill above the landing, and that evening the Ferryman rows out with a passenger nobody else can see. Osric threads the bell’s clapper on a pilgrim’s cord for you.' },
  },
  /* ------------------------------------------------------ Old Nan's hostel */
  {
    id: 'eel-pie',
    name: 'Eel Pie',
    giver: 'old-nan',
    text: 'Old Nan has kept the hostel at the landing for thirty winters, feeding mourners and pilgrims and the occasional lost hero. Her eel pie is famous on this shore, which isn’t hard, as nobody else on this shore eats. The eels have got bigger lately, and so have her ambitions. Bring her five cuts of mere serpent, from the shallows north-east of the landing or wherever they rear up.',
    objective: { kind: 'loot', region: 'hollowmere', item: 'Cut of Serpent', from: ['mere-serpent'], chance: 0.4, count: 5, label: 'Take Cuts of Serpent from mere serpents' },
    after: ['the-dead-lake'],
    zone: 'hollowmere',
    level: 56,
    reward: { xp: 1500, gold: 620 },
  },
  {
    id: 'nans-lodgers',
    name: 'Nan’s Lodgers',
    giver: 'old-nan',
    text: 'Nan’s lodgers are mourners, come to the dead lake to call across the water to their dead. They walk out to Mourners’ Shore, east of the landing, at dusk, and come back by dark. Last night three of them didn’t, and Nan has kept their pie warm. Go east along the shore and look for them.',
    objective: { kind: 'explore', spot: 'mourners-shore', label: 'Look for Nan’s lodgers on Mourners’ Shore' },
    after: ['eel-pie'],
    zone: 'hollowmere',
    level: 57,
    reward: { xp: 1600, gold: 660 },
  },
  {
    id: 'the-answering-dead',
    name: 'The Answering Dead',
    giver: 'old-nan',
    text: 'Mourners’ Shore is where the living call to the dead, and lately the dead have started answering: the lake wraiths come skimming in over the water at the sound of a voice, and Nan’s lodgers are huddled in the reeds, too frightened to move. Nan would like the shore quiet before anyone else goes calling. Lay eight lake wraiths to rest, on Mourners’ Shore east of the landing or anywhere they skim.',
    objective: { kind: 'kill', region: 'hollowmere', count: 8, enemies: ['lake-wraith'], label: 'Lay lake wraiths to rest' },
    after: ['nans-lodgers'],
    zone: 'hollowmere',
    level: 57,
    reward: { xp: 2400, gold: 860, item: 'nans-knitted-shawl', text: 'The lodgers come back cold and quiet, and Nan sits up with them by the fire. In the morning she takes the shawl off her own shoulders and puts it round yours. “It’s done thirty winters here,” she says. “It can do a few more where you’re going.”' },
  },
  /* ------------------------------------------------------ Digger Mott's dead */
  {
    id: 'buried-twice',
    name: 'Buried Twice',
    giver: 'digger-mott',
    text: 'Digger Mott has buried everyone who died at the landing for forty years, and lately he has had to bury some of them twice. Something comes in the night, opens his graves and carries the dead off in their shrouds; he found needles of finger-bone in the dirt. Bone-weavers, says the Ferryman. Mott would like his shrouds back, with or without what was in them. Take four from the bone-weavers, at the Corpse Landing on the east shore or wherever they work.',
    objective: { kind: 'loot', region: 'hollowmere', item: 'Stolen Shroud', from: ['bone-weaver'], chance: 0.4, count: 4, label: 'Take Stolen Shrouds from bone-weavers' },
    after: ['the-dead-lake'],
    zone: 'hollowmere',
    level: 57,
    reward: { xp: 1700, gold: 680 },
  },
  {
    id: 'old-customers',
    name: 'Old Customers',
    giver: 'digger-mott',
    text: 'Mott has had a good look at the shrouds, and at the guards who walk the north road in their bone plate, and he knows some of the faces under the helms: he dug their graves himself. The Lich sews the landing’s own dead into his guard. Mott wants his old customers back in the ground where he put them. Lay six necropolis guards to rest, on the roads north of the landing or at the island.',
    objective: { kind: 'kill', region: 'hollowmere', count: 6, enemies: ['necropolis-guard'], label: 'Lay necropolis guards to rest' },
    after: ['buried-twice'],
    zone: 'hollowmere',
    level: 58,
    reward: { xp: 2500, gold: 900, item: 'gravediggers-mitts', text: 'Mott digs six new graves on the hill above the landing, slowly and properly, and leans on his spade when he’s done. “Third time’s the charm,” he says, and gives you his second-best mitts.' },
  },
];

export const HOLLOWMERE_NPCS: Record<string, NpcDef> = {
  'the-ferryman': {
    id: 'the-ferryman',
    name: 'The Ferryman',
    title: 'Ferryman of Hollowmere',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-dead-lake', state: 'active' },
        lines: ['Ada’s girl sent you. Her grandmother’s grandmother bought eels off me. Good teeth, that family.', 'You’re warm. Most who come down this road aren’t, by the time they get to me. Sit, if you like. The lake isn’t going anywhere. Neither am I.'],
      },
      {
        when: { quest: 'the-restless-shore', state: 'active' },
        lines: ['The dead used to wait for me. Quietly, on the stones, the way you wait for a coach. Now they walk up and knock on Nan’s shutters.', 'Put them down along the shore. And don’t leave them lying: the lake sews its own back up if you give it a moment.'],
      },
      {
        when: { quest: 'pennies-for-the-ferryman', state: 'active' },
        lines: ['One coin a head. It has always been one coin a head. I don’t make the rules. Well. I made that one, but a long time ago, and I’ve grown fond of it.', 'They were buried with pennies under their tongues, most of them. Bring me six, and I’ll see six across.'],
      },
      {
        when: { quest: 'the-serpent-shallows', state: 'active' },
        lines: ['Fares paid, and I can’t get the boat past the Shallows north-east of here. Something keeps biting it.', 'Mere serpents. Blind as stones and long as my boat, and they spit. I liked the eels better when they were smaller.'],
      },
      {
        when: { quest: 'the-black-barges', state: 'active' },
        lines: ['I saw boats on my lake last night. Black barges, low in the water, poled by nobody, full of the dead.', 'Nobody rows this lake but me. Nobody has, since before your King went into the ground. Go east and see where they land.'],
      },
      {
        when: { quest: 'the-bone-weavers', state: 'active' },
        lines: ['They unload my passengers and sew them into soldiers. Sew them. With needles.', 'Theft, is what it is. Kill the weavers. Forgive me raising my voice. I don’t, usually. There is usually no one to hear it.'],
      },
      {
        when: { quest: 'the-lichs-seal', state: 'active' },
        lines: ['The island in the middle of the mere. There was a necropolis on it before there was a kingdom round it, and now there’s a Lich in it.', 'Its doors open for its own. Its own carry a seal of black bone. Take three, from the guards and the acolytes.'],
      },
      {
        when: { quest: 'across-the-mere', state: 'active' },
        lines: ['I won’t row you to the island. No boat that went there came back, and I am fond of this one.', 'The old causeway still runs out to it, north-east, past the Shallows. They used to carry the dead along it with lamps. Take a lamp.'],
      },
      {
        when: { quest: 'the-necropolis', state: 'active' },
        lines: ['A sorcerer of the old kingdom, the Lich. He had himself drowned, so he could rule the drowned. Clever man. I rowed him across once, you know. He came back.', 'Kill him. Properly, this time. I would like my passengers back.'],
      },
      {
        when: { quest: 'the-last-road', state: 'active' },
        lines: ['The Lich made his soldiers for the Pale Reach, north of the mere, and sent them up the north road by the hundred.', 'Somebody is still fighting them up there. I have rowed their dead home all month, in good Highwall mail. A Commander Aldric, at Dawn’s Rest. Go and help him lose fewer.'],
      },
      {
        when: { quest: 'the-necropolis', state: 'done' },
        lines: ['I rowed until dawn. First time in years my arms have ached. I’d forgotten how much I liked it.', 'When it’s all done, up north, come back down to the water. I’ll row you across the lake for nothing. Just the once. Don’t tell anyone.'],
      },
      {
        when: { quest: 'the-dead-lake', state: 'done' },
        lines: ['The landing: Nan’s hostel, Osric’s charms, Mott’s graves and my boat. Everything a traveller needs, and a few things they’d rather not.', 'Mind the water. It is very still, and it shows you a sky that isn’t there. Don’t look at it too long.'],
      },
      { lines: ['One coin a head. Living folk ride free, but I don’t get many.', 'I have rowed this lake longer than anyone remembers. Including me, some days.'] },
    ],
  },
  'old-nan': {
    id: 'old-nan',
    name: 'Old Nan',
    title: 'Keeper of the Landing Hostel',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'The Landing Hostel',
    talk: [
      {
        when: { quest: 'eel-pie', state: 'active' },
        lines: ['Thirty winters I’ve kept this hostel, and thirty winters folk have eaten my eel pie and said nothing nice about the lake.', 'The eels have got bigger. Fine. So has my oven. Five cuts of mere serpent, from the shallows north-east of here, and you’ll eat well tonight.'],
      },
      {
        when: { quest: 'nans-lodgers', state: 'active' },
        lines: ['My lodgers are mourners. They walk out to Mourners’ Shore at dusk, east of here, and call across the water.', 'Three of them didn’t come back last night. Their pie’s going cold. Go and look for them, would you?'],
      },
      {
        when: { quest: 'the-answering-dead', state: 'active' },
        lines: ['Hiding in the reeds, are they? Poor lambs. You call across the water long enough and something calls back.', 'Lay those wraiths to rest, so my lodgers can come home. And then nobody calls across anything for a week. House rule.'],
      },
      { when: { quest: 'the-answering-dead', state: 'done' }, lines: ['They’re asleep by the fire, the three of them, and I’ve forbidden all calling. They’re calling quietly anyway. Mourners.', 'Wear the shawl. It suits you better than it suited me, and I’ll knit another. I’ve nothing but time and grey wool.'] },
      { lines: ['The Landing Hostel. Beds, pie, potions and a fire that has never gone out. The fire I’m proud of. The pie I’m famous for.', 'Potions on the shelf. Pay what’s marked. If it isn’t marked, I’ve forgotten what I paid for it, and so has the man I bought it from.'] },
    ],
  },
  'pilgrim-osric': {
    id: 'pilgrim-osric',
    name: 'Pilgrim Osric',
    title: 'Pilgrim and Charm-Seller',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'The Pilgrim’s Pack',
    talk: [
      {
        when: { quest: 'a-pilgrims-errand', state: 'active' },
        lines: ['My daughter Wenna married a chandler in Elsmere. When the lake rose, Elsmere went under, and nobody came out.', 'I walked here from Emberwick to find her. I sell charms because I ran out of money, not hope. I’ve never had the courage to go up the western shore. Will you?'],
      },
      {
        when: { quest: 'keepsakes-of-elsmere', state: 'active' },
        lines: ['Women in grey veils, looking for their own doors. Yes. That sounds like Elsmere. They were always visiting.', 'Bring me what they carry. A comb, a ring, a locket. Anything she might have held. I’ll know it when I see it. I think I will.'],
      },
      {
        when: { quest: 'the-bell-of-elsmere', state: 'active' },
        lines: ['It’s hers. Her name’s inside. I had it engraved, the year she married.', 'The bell. I can hear it some nights, under the water. Every time it rings, they all get up again. Make it stop. Please. Let her rest.'],
      },
      { when: { quest: 'the-bell-of-elsmere', state: 'done' }, lines: ['I buried the locket on the hill, next to a stone I carved myself. It’s not a good stone. She’d laugh at it.', 'I’ll stay a while, I think. Somebody should sell the living a few charms, out here. They need them more than the dead do.'] },
      { lines: ['The Pilgrim’s Pack. Charms, amulets, rings and relics, blessed at six shrines and sold at one landing.', 'Do they work? Some do. I couldn’t tell you which. That’s what makes it a pilgrimage.'] },
    ],
  },
  'digger-mott': {
    id: 'digger-mott',
    name: 'Digger Mott',
    title: 'Gravedigger',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'buried-twice', state: 'active' },
        lines: ['Forty years I’ve dug graves at this landing. Never had a complaint. Lately the graves are coming back empty.', 'Needles of finger-bone in the dirt, and my shrouds gone with whoever was in them. Get my shrouds back. I’m not made of linen.'],
      },
      {
        when: { quest: 'old-customers', state: 'active' },
        lines: ['I’ve seen the guards on the north road, in their bone plate. I know some of those faces. I put them in the ground myself.', 'Old customers. I’d like them back where I left them. Six, to start. I’ll dig deeper this time.'],
      },
      { when: { quest: 'old-customers', state: 'done' }, lines: ['Six new graves on the hill, nice and deep. Third time’s the charm.', 'If you ever need a hole dug, you know where I am. Here. I’m always here. It’s a gravedigger’s whole charm.'] },
      { lines: ['Mott. I dig. They lie. Usually.', 'Busy times. The lake gives back more than it used to, and less of it stays put.'] },
    ],
  },
};
