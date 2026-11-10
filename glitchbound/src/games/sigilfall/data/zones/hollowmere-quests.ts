import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * The landing's people and the quests of Hollowmere, the dead lake at the heart of Vaelmoor (STORY_BIBLE.md
 * §3, Act V). Queen Ysane is buried under it, and so is Elsmere, the town that drowned the night Vaelmoor
 * died: the last of the frozen places. The lake keeps more than its own dead: every drowned soul whose
 * mourners still call to them drifts here, which is what the Ash Crown feeds on. On its southern shore the
 * Ferryman, who has rowed the dead across it for one coin a head since before the Hallow King went into the
 * ground, keeps a landing with Old Nan's hostel (she came out from Candlewick thirty winters ago), a pilgrim
 * selling charms and a gravedigger who has lately had to bury people twice. Brother Orren comes too, and the
 * lake shows him his own dead. The main chain follows the
 * drowned up out of the water, the serpents in the shallows and the black barges to the Corpse Landing,
 * then over the old causeway to the necropolis on the water, where the Lich of Hollowmere makes
 * Vaelor's dead out of the dead who should have crossed, and keeps Ysane's memory at its heart: when he falls,
 * her last echo asks to be let go. Tobiah looks for his daughter in Drowned Elsmere, Nan for her lodgers on Mourners' Shore, and Mott for
 * his shrouds. Main chain first.
 */
export const HOLLOWMERE_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-dead-lake',
    name: 'The Dead Lake',
    giver: 'thane-hroki',
    text: 'Halvard said it with the violet going out of his eyes: Vaelor’s queen is under the lake at Hollowmere, and he still goes there. West of the caldera the road runs down to a black lake so still it shows a sky that isn’t there. On its southern shore a ferryman keeps a landing; Hroki’s grandfather sold him the nails for his boat, he says, and so did his. Take the west road out of Emberdeep and find the Ferryman.',
    objective: { kind: 'talk', npc: 'the-ferryman', label: 'Find the Ferryman at his landing on Hollowmere’s southern shore' },
    after: ['ashkar-the-bound'],
    // the hand-off that sends the hero to hollowmere: it starts when the last chapter ends, not on arrival
    level: 53,
    reward: { xp: 2000, gold: 650 },
  },
  /* ------------------------------------------------------- the shore */
  {
    id: 'the-restless-shore',
    name: 'The Restless Shore',
    auto: true,
    giver: 'the-ferryman',
    text: 'The Ferryman has rowed the dead across Hollowmere for longer than he can count, one coin a head, and they always used to wait quietly on the shore for him. Not any more: the drowned of the sunken towns walk out of the water every night and knock on Old Nan’s shutters. Put down twelve drowned dead along the shore around the landing. Don’t leave them lying about, he adds: the lake stitches its own back together.',
    objective: { kind: 'kill', region: 'hollowmere', count: 6, enemies: ['drowned-dead'], label: 'Put down the drowned dead on the shore' },
    after: ['the-dead-lake'],
    zone: 'hollowmere',
    level: 53,
    reward: { xp: 2200, gold: 680 },
  },
  /* ---------------------------------------------- the Lich's household */
  /* ---------------------------------------------------- Orren's own dead */
  {
    id: 'orren-on-the-shore',
    name: 'The Answering Water',
    giver: 'orren-at-the-mere',
    auto: true,
    text: 'The seals are in hand and the causeway is open, and Orren has walked out onto Mourners’ Shore alone at dusk with his lantern, the way the mourners do. Nan saw him go. She says the lake answers everyone eventually, and it has started answering him: a boy’s voice, out on the water, calling his name. Go after him and keep the lake off him while he decides.',
    objective: { kind: 'event', event: 'orren-on-the-shore', label: 'Hold Mourners’ Shore while the lake calls Orren' },
    after: ['the-restless-shore'],
    zone: 'hollowmere',
    level: 55,
    reward: {
      xp: 3000,
      gold: 800,
      text: 'The boy on the water is Davin, Orren’s brother, who went through the ice of the mill pond when they were nine and eight, while Orren stood on the bank and could not make himself go out after him. He has called Orren in every night since the Gate opened. Orren stands at the edge with his lantern held up until the voice stops. “The dead must stay dead,” he says, with his face wet. “I’m sorry, Davin. I’m the one who stays.”',
    },
  },
  {
    id: 'across-the-mere',
    name: 'Across the Mere',
    giver: 'the-ferryman',
    auto: true,
    text: 'The Ferryman will not row to the island. No boat that went there ever came back, he says, and he would like to keep his. But the old causeway the dead were once carried along to be buried still runs out to it, north-east of the landing beyond the Serpent Shallows, and with the seal its doors will open. Go to the necropolis and see what the Lich is making.',
    objective: { kind: 'explore', spot: 'the-necropolis', label: 'Reach the necropolis on the water' },
    after: ['orren-on-the-shore'],
    zone: 'hollowmere',
    level: 55,
    reward: { xp: 2300, gold: 760, item: { rarity: 'rare' } },
  },
  {
    id: 'the-necropolis',
    name: 'The Necropolis',
    auto: true,
    giver: 'the-ferryman',
    text: 'Inside the necropolis the drowned lie in rows, waiting to be finished, and among them the Lich of Hollowmere sits on a throne of coral and bone and calls more up out of the lake. He was a sorcerer of the old kingdom, the Ferryman says, who had himself drowned so he could rule the drowned, and Vaelor has made him the maker of his dead. Kill the Lich in his necropolis on the water, and the lake’s dead can cross in peace.',
    objective: { kind: 'kill', region: 'hollowmere', count: 1, enemies: ['the-lich-of-hollowmere'], label: 'Kill the Lich of Hollowmere in the necropolis' },
    after: ['across-the-mere'],
    zone: 'hollowmere',
    level: 55,
    reward: {
      xp: 9200,
      gold: 2400,
      item: 'phylactery-of-hollowmere',
      text: 'The Lich comes apart on his throne, and all over the island the half-finished dead lie down at once. Behind his throne, in a hollow of coral, a woman in a grey crown is sitting very still with her hands in her lap. The Ferryman, when you tell him, gives you the black jar the Lich kept his death in, and does not ask what else you found.',
    },
  },
  {
    id: 'ysanes-last-echo',
    name: 'Let Me Go',
    giver: 'the-ferryman',
    auto: true,
    text: 'The Lich kept something at the heart of his necropolis that was not his: Queen Ysane’s memory, the oldest and strongest of all the Ash Crown’s, the one it was built to bring back. She is waiting behind the throne. She has been waiting to speak to someone who isn’t her husband for three hundred years.',
    objective: { kind: 'talk', npc: 'echo-of-ysane-mere', label: 'Speak to Queen Ysane behind the Lich’s throne' },
    after: ['the-necropolis'],
    zone: 'hollowmere',
    level: 56,
    reward: {
      xp: 4000,
      gold: 900,
      perk: 'sigil-tides',
      text: 'She knows what she is. She knows what he did, and why, and what it costs every night in a kingdom she has never seen. “I loved him,” she says. “I would like to stop being the reason. Let me go. When you find him, tell him to let me go.” Her maid hid the Sigil of Tides in the drowned altar the night she died; she puts it in your hands, and asks you to put out the lamp, and when you do, she is not there. Elyra holds the sigil a long time. When she looks up she smiles at you, and doesn’t say your name.',
    },
  },
  /* --------------------------------------------------- Osric's daughter */
  {
    id: 'a-pilgrims-errand',
    name: 'A Pilgrim’s Errand',
    giver: 'pilgrim-tobiah',
    text: 'Pilgrim Tobiah came through the Gloam Gate behind the army with a staff and a pack of charms, looking for his daughter Wenna, who drowned off the ferry at Emberwick three winters ago. The lake keeps everyone whose mourners still call to them, he says, and he has never stopped calling. He thinks she walks in Drowned Elsmere, the town that went under the night Vaelmoor died. He has never dared go up the western shore himself. Go north-west of the landing and tell him what is there.',
    objective: { kind: 'explore', spot: 'drowned-town', label: 'Find Drowned Elsmere north-west of the landing' },
    after: ['the-dead-lake'],
    zone: 'hollowmere',
    level: 53,
    reward: { xp: 700, gold: 640 },
  },
  {
    id: 'keepsakes-of-elsmere',
    name: 'Keepsakes of Elsmere',
    giver: 'pilgrim-tobiah',
    text: 'What is left of Elsmere is a bell tower standing in the water, roofs under the surface, and women in wet grey veils skimming over them, still looking for doors: Elsmere’s own, three hundred years drowned, and among them a few that are much newer. Tobiah thinks one of them may be Wenna. He would like back what they carry: a ring, a comb, a locket, anything she might have held. Take five keepsakes from the lake wraiths, around Drowned Elsmere or anywhere on the shore.',
    objective: { kind: 'loot', region: 'hollowmere', item: 'Elsmere Keepsake', from: ['lake-wraith'], chance: 0.35, count: 5, label: 'Take Elsmere Keepsakes from lake wraiths' },
    after: ['a-pilgrims-errand'],
    zone: 'hollowmere',
    level: 54,
    reward: { xp: 800, gold: 680 },
  },
  {
    id: 'the-bell-of-elsmere',
    name: 'The Bell of Elsmere',
    giver: 'pilgrim-tobiah',
    text: 'One of the keepsakes is a locket with Wenna’s name in it, and Tobiah sat up with it all night. In the morning he asked you to make the bell stop. Elsmere’s sexton rang it the night the lake rose, and he is ringing it still in the drowned tower: every toll calls the lake’s dead up out of the water again, Elsmere’s and everyone else’s, and none of them can rest while it rings. Kill the Bell-Ringer in Drowned Elsmere, north-west of the landing.',
    objective: { kind: 'kill', region: 'hollowmere', count: 1, enemies: ['the-bell-ringer'], label: 'Kill the Bell-Ringer in Drowned Elsmere' },
    after: ['keepsakes-of-elsmere'],
    zone: 'hollowmere',
    level: 54,
    reward: { xp: 1250, gold: 900, item: 'elsmere-bell-clapper', text: 'The bell stops. Tobiah buries the locket on the hill above the landing, and stops calling, and that evening the Ferryman rows out with a passenger nobody else can see. Tobiah threads the bell’s clapper on a pilgrim’s cord for you.' },
  },
  /* ------------------------------------------------------ Old Nan's hostel */
  {
    id: 'the-answering-dead',
    name: 'The Answering Dead',
    giver: 'old-nan',
    text: 'Mourners’ Shore is where the living call to the dead, and lately the dead have started answering: the lake wraiths come skimming in over the water at the sound of a voice, and Nan’s lodgers are huddled in the reeds, too frightened to move. Nan would like the shore quiet before anyone else goes calling. Lay eight lake wraiths to rest, on Mourners’ Shore east of the landing or anywhere they skim.',
    objective: { kind: 'kill', region: 'hollowmere', count: 8, enemies: ['lake-wraith'], label: 'Lay lake wraiths to rest' },
    after: ['the-dead-lake'],
    zone: 'hollowmere',
    level: 54,
    reward: { xp: 1100, gold: 860, item: 'nans-knitted-shawl', text: 'The lodgers come back cold and quiet, and Nan sits up with them by the fire. In the morning she takes the shawl off her own shoulders and puts it round yours. “It’s done thirty winters here,” she says. “It can do a few more where you’re going.”' },
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
    level: 54,
    reward: { xp: 750, gold: 680 },
  },
  {
    id: 'old-customers',
    name: 'Old Customers',
    giver: 'digger-mott',
    text: 'Mott has had a good look at the shrouds, and at the guards who walk the north road in their bone plate, and he knows some of the faces under the helms: he dug their graves himself. The Lich sews the landing’s own dead into his guard. Mott wants his old customers back in the ground where he put them. Lay six necropolis guards to rest, on the roads north of the landing or at the island.',
    objective: { kind: 'kill', region: 'hollowmere', count: 6, enemies: ['necropolis-guard'], label: 'Lay necropolis guards to rest' },
    after: ['buried-twice'],
    zone: 'hollowmere',
    level: 55,
    reward: { xp: 1100, gold: 900, item: 'gravediggers-mitts', text: 'Mott digs six new graves on the hill above the landing, slowly and properly, and leans on his spade when he’s done. “Third time’s the charm,” he says, and gives you his second-best mitts.' },
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
        lines: ['Hesper sent you. Candlewick’s candlewife. Her grandmother’s grandmother bought eels off me. Good teeth, that family.', 'You’re warm. Most who come down this road aren’t, by the time they get to me. Sit, if you like. The lake isn’t going anywhere. Neither am I.'],
      },
      {
        when: { quest: 'the-restless-shore', state: 'active' },
        lines: ['The dead used to wait for me. Quietly, on the stones, the way you wait for a coach. Now they walk up and knock on Nan’s shutters.', 'Put them down along the shore. And don’t leave them lying: the lake sews its own back up if you give it a moment.'],
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
        when: { quest: 'ysanes-last-echo', state: 'active' },
        lines: ['There was a woman I never rowed across. I waited. She never came down to the water. They kept her on the island.', 'Go and talk to her. Somebody should. I’d go myself, but I have never once left the boat, and it’s late to start.'],
      },
      {
        when: { quest: 'the-necropolis', state: 'done' },
        lines: ['I rowed until dawn. First time in years my arms have ached. I’d forgotten how much I liked it.', 'When it’s all done, up north, come back down to the water. I’ll row you across the lake for nothing. Just the once. Don’t tell anyone.'],
      },
      {
        when: { quest: 'the-dead-lake', state: 'done' },
        lines: ['The landing: Nan’s hostel, Tobiah’s charms, Mott’s graves and my boat. Everything a traveler needs, and a few things they’d rather not.', 'Mind the water. It is very still, and it shows you a sky that isn’t there. Don’t look at it too long.'],
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
        when: { quest: 'the-answering-dead', state: 'active' },
        lines: ['Hiding in the reeds, are they? Poor lambs. You call across the water long enough and something calls back.', 'Lay those wraiths to rest, so my lodgers can come home. And then nobody calls across anything for a week. House rule.'],
      },
      { when: { quest: 'the-answering-dead', state: 'done' }, lines: ['They’re asleep by the fire, the three of them, and I’ve forbidden all calling. They’re calling quietly anyway. Mourners.', 'Wear the shawl. It suits you better than it suited me, and I’ll knit another. I’ve nothing but time and grey wool.'] },
      { lines: ['The Landing Hostel. Beds, pie, potions and a fire that has never gone out. The fire I’m proud of. The pie I’m famous for.', 'Potions on the shelf. Pay what’s marked. If it isn’t marked, I’ve forgotten what I paid for it, and so has the man I bought it from.'] },
    ],
  },
  'pilgrim-tobiah': {
    id: 'pilgrim-tobiah',
    name: 'Pilgrim Tobiah',
    title: 'Pilgrim and Charm-Seller',
    sprite: 'villager',
    shop: 'curios',
    shopName: 'The Pilgrim’s Pack',
    talk: [
      {
        when: { quest: 'a-pilgrims-errand', state: 'active' },
        lines: ['My daughter Wenna drowned off the ferry at Emberwick three winters ago. They say this lake keeps everyone whose mourners still call to them. I have never stopped calling.', 'I came through the Gate behind your army. I sell charms because I ran out of money, not hope. They say she walks in drowned Elsmere, with the town’s own dead. I’ve never had the courage to go up the western shore. Will you?'],
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
  // Brother Orren at the landing: the lake shows everyone their own dead, and it shows him his
  'orren-at-the-mere': {
    id: 'orren-at-the-mere',
    name: 'Brother Orren',
    title: 'At the water’s edge',
    sprite: 'villager',
    talk: [
      { when: { quest: 'orren-on-the-shore', state: 'active' }, lines: ['There is a boy on the water. He knows my name. He knows the name our mother called me, which nobody living does.', 'Don’t let me go in. If I start to walk, hold me. Hold me hard.'] },
      { when: { quest: 'orren-on-the-shore', state: 'done' }, lines: ['Forty years I’ve told mourners the dead must stay dead. I thought I was telling them something hard. I didn’t know anything.', 'I still believe it. I believe it the way you believe in a wall, with your back against it.'] },
      { when: { quest: 'ysanes-last-echo', state: 'done' }, lines: ['She asked to be let go. Do you understand? She asked. He has been holding on to someone who is asking to be let go.', 'When we find him, I want to be the one who tells him. I think I’ve earned it now.'] },
      { lines: ['The lake is very still. It shows you a sky that isn’t there. Don’t look at it too long. I did.'] },
    ],
  },
  // Queen Ysane's last echo, kept at the heart of the Lich's necropolis
  'echo-of-ysane-mere': {
    id: 'echo-of-ysane-mere',
    name: 'Queen Ysane',
    title: 'The last echo',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'ysanes-last-echo', state: 'active' },
        lines: [
          'You are not him. Good. I have only ever been allowed to speak to him, and he only ever hears what he came to hear.',
          'I know what I am. I know what he has done with me. A kingdom of grief, so that I can stand in a doorway and say his name.',
          'I loved him. I would like to stop being the reason. Let me go. When you find him, tell him to let me go.',
        ],
      },
      { lines: ['Put out the lamp, would you? I’ve been in the light so long.'] },
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
/** Mourners' Shore: the lake answers Orren (Act V). */
export const HOLLOWMERE_EVENTS: Record<string, StoryEventDef> = {
  'orren-on-the-shore': {
    id: 'orren-on-the-shore',
    region: 'hollowmere',
    kind: 'defend',
    at: 'mourners-edge',
    radius: 10,
    level: 55,
    ward: { pet: 'orren-praying', at: 'mourners-edge', name: 'Brother Orren' },
    banner: 'The water answers',
    start: [
      { who: 'orren-praying', text: 'Davin? Davin. You’re… you’re still small. You were always going to be small.' },
      { who: 'orren-praying', text: 'No. Lantern up. Lantern up, Orren. You know what this is.' },
    ],
    waves: [
      { enemies: ['lake-wraith', 'lake-wraith', 'drowned-dead', 'drowned-dead'], from: ['mourners-water', 'mourners-reeds'] },
      { enemies: ['lake-wraith', 'lake-wraith', 'lake-wraith', 'mere-serpent'], from: ['mourners-water', 'mourners-east'], barks: [{ who: 'orren-praying', text: 'He says the water is warm. He says I can stop being cold now. I have been cold for forty years.' }] },
      { enemies: ['lake-wraith', 'lake-wraith', 'drowned-dead', 'drowned-dead', 'drowned-dead'], from: ['mourners-water', 'mourners-reeds', 'mourners-east'], barks: [{ who: 'orren-praying', text: 'I’m sorry. I’m sorry I didn’t go out on the ice. I’m not going out now. I’m the one who stays.' }] },
    ],
    end: [{ who: 'orren-praying', text: 'He’s gone quiet. Not gone. Quiet. The dead must stay dead. Help me up. My knees are older than my faith.' }],
    retry: [{ who: 'orren-praying', text: 'I took a step. I took a step toward him. Again. Hold the shore again.' }],
  },
};
