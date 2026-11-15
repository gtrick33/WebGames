import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * The landing's people and the quests of Hollowmere, the dead lake at the heart of Vaelmoor (STORY_BIBLE.md
 * §3, Act V). Queen Ysane is buried under it, and so is Elsmere, the town that drowned the night Vaelmoor
 * died. Lord Halvard sent the hero here: the one sigil never taken out of Vaelmoor, the Sigil of Tides, is under
 * the lake, hidden by Ysane's maid Bettany when the wardens came. On the southern shore the Ferryman, who rows
 * the dead across the lake so they can rest, keeps a landing with Old Nan's hostel (she came out from Candlewick
 * thirty winters ago), a pilgrim selling charms and a gravedigger who has lately had to bury people twice.
 * Brother Orren comes too, and the lake calls him with his drowned brother's voice. The main chain: the drowned
 * on the shore, Orren on Mourners' Shore, the old causeway to the necropolis on the island, where the Lich of
 * Hollowmere makes the Hallow King's soldiers out of the lake's dead and keeps Ysane's last echo behind his
 * throne; when he falls, she gives up the Sigil of Tides (six of seven) and asks to be let go. Tobiah looks for
 * his daughter in Drowned Elsmere, Nan for her lodgers on Mourners' Shore, and Mott for his shrouds. Main chain
 * first. Written to DIALOGUE_STYLE.md (plain, direct, no punchlines).
 */
export const HOLLOWMERE_QUESTS: QuestDef[] = [
  /* ---------------------------------------------------------- the way in */
  {
    id: 'the-dead-lake',
    name: 'The Dead Lake',
    giver: 'thane-hroki',
    text: 'The Pale Crown is broken. Now find the Sigil of Tides, which Halvard said lies under the lake at Hollowmere. Take the west road out of Emberdeep to the lake. The Ferryman keeps a landing on its south shore.',
    objective: { kind: 'talk', npc: 'the-ferryman', label: 'Find the Ferryman on Hollowmere’s south shore' },
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
    text: 'The Ferryman rows the dead across Hollowmere so they can rest. They used to wait quietly on the shore for him. Now the drowned walk out of the lake every night and bang on the landing’s shutters. Put down six of them along the shore.',
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
    text: 'Orren walked out to Mourners’ Shore alone at dusk, and Old Nan saw him go. A boy’s voice is calling his name from the water, and the drowned are rising around him. Go after him. Keep the dead off him, and don’t let him walk into the lake.',
    objective: { kind: 'event', event: 'orren-on-the-shore', label: 'Protect Orren on Mourners’ Shore' },
    after: ['the-restless-shore'],
    zone: 'hollowmere',
    level: 55,
    reward: {
      xp: 3000,
      gold: 800,
      text: 'The voice on the water is Davin, Orren’s little brother. When they were boys, Davin fell through the ice on a mill pond, and Orren was too scared to go out after him. Tonight Orren holds up his lantern until the voice stops. “I loved you, Davin,” he says, crying. “That’s why I’m not coming.”',
    },
  },
  {
    id: 'across-the-mere',
    name: 'Across the Mere',
    giver: 'the-ferryman',
    auto: true,
    text: 'The Lich of Hollowmere rules the island in the middle of the lake. He keeps the dead from crossing and turns them into soldiers for the Host. The Ferryman won’t row there, but an old causeway runs out to it, north-east of the landing. Cross it and reach the Necropolis.',
    objective: { kind: 'explore', spot: 'the-necropolis', label: 'Cross the causeway to the Necropolis' },
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
    text: 'Inside the Necropolis, the drowned lie in rows, waiting to be made into soldiers. The Lich sits on a throne of coral and bone and calls more of them up out of the lake. Kill him, and the lake’s dead can cross in peace.',
    objective: { kind: 'kill', region: 'hollowmere', count: 1, enemies: ['the-lich-of-hollowmere'], label: 'Defeat the Lich of Hollowmere in the Necropolis' },
    after: ['across-the-mere'],
    zone: 'hollowmere',
    level: 55,
    reward: {
      xp: 9200,
      gold: 2400,
      item: 'phylactery-of-hollowmere',
      text: 'The Lich falls apart on his throne, and all over the island the dead lie down. Behind the throne sits a woman in a grey crown, very still. It is the last echo of Queen Ysane. The Ferryman gives you the black jar where the Lich hid his soul.',
    },
  },
  {
    id: 'ysanes-last-echo',
    name: 'Let Me Go',
    giver: 'the-ferryman',
    auto: true,
    text: 'Behind the Lich’s throne waits the last echo of Queen Ysane, the strongest memory the Ash Crown keeps. She has waited three hundred years for someone to listen to her. Go and talk to her.',
    objective: { kind: 'talk', npc: 'echo-of-ysane-mere', label: 'Talk to Queen Ysane behind the Lich’s throne' },
    after: ['the-necropolis'],
    zone: 'hollowmere',
    level: 56,
    reward: {
      xp: 4000,
      gold: 900,
      perk: 'sigil-tides',
      text: 'Ysane gives you the Sigil of Tides. Her maid, Bettany, hid it under the lake when the wardens came. “I loved him,” Ysane says. “When you find him, tell him to let me go.” Then she asks you to put out her lamp, and when you do, she is gone. That makes six sigils of seven. Vosk still has the last one, the Sigil of Stone.',
    },
  },
  /* -------------------------------------------------- Tobiah's daughter */
  {
    id: 'a-pilgrims-errand',
    name: 'A Pilgrim’s Errand',
    giver: 'pilgrim-tobiah',
    text: 'Pilgrim Tobiah’s daughter, Wenna, drowned three winters ago. People say every drowned soul who is still mourned ends up in Hollowmere, and Tobiah still mourns her. He thinks she walks in Drowned Elsmere, a town that sank the night Vaelmoor died. Go north-west of the landing and see what is there.',
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
    text: 'Drowned Elsmere is a bell tower standing in the water, with roofs under the surface. Drowned women in grey veils skim over it, still looking for their doors, and a few of them died much more recently. Tobiah hopes one of them carries something of Wenna’s. Take five keepsakes from the lake wraiths.',
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
    text: 'One keepsake is a locket with Wenna’s name in it, and Tobiah sat up with it all night. Elsmere’s sexton is still ringing the bell in the drowned tower. Every ring calls the lake’s dead back up, so none of them can rest. Kill the Bell-Ringer in Drowned Elsmere.',
    objective: { kind: 'kill', region: 'hollowmere', count: 1, enemies: ['the-bell-ringer'], label: 'Kill the Bell-Ringer in Drowned Elsmere' },
    after: ['keepsakes-of-elsmere'],
    zone: 'hollowmere',
    level: 54,
    reward: { xp: 1250, gold: 900, item: 'elsmere-bell-clapper', text: 'The bell stops. Tobiah buries the locket on the hill above the landing and stops calling for Wenna. That evening, the Ferryman rows out with a passenger nobody else can see. Tobiah gives you the bell’s clapper on a pilgrim’s cord.' },
  },
  /* ------------------------------------------------------ Old Nan's hostel */
  {
    id: 'the-answering-dead',
    name: 'The Answering Dead',
    giver: 'old-nan',
    text: 'Mourners’ Shore is where the living call out to their dead across the water. Lately the lake wraiths answer, and they attack anyone they find. Old Nan’s lodgers are hiding in the reeds, too scared to move. Lay eight lake wraiths to rest, on Mourners’ Shore east of the landing.',
    objective: { kind: 'kill', region: 'hollowmere', count: 8, enemies: ['lake-wraith'], label: 'Lay lake wraiths to rest' },
    after: ['the-dead-lake'],
    zone: 'hollowmere',
    level: 54,
    reward: { xp: 1100, gold: 860, item: 'nans-knitted-shawl', text: 'Nan’s lodgers come home cold and quiet, and she sits up with them by the fire. In the morning she puts her own shawl around your shoulders. “It’s kept me warm for thirty winters,” she says. “It can keep you warm where you’re going.”' },
  },
  /* ------------------------------------------------------ Digger Mott's dead */
  {
    id: 'buried-twice',
    name: 'Buried Twice',
    giver: 'digger-mott',
    text: 'Digger Mott has buried the landing’s dead for forty years. Lately something digs up his graves at night and carries the bodies off in their shrouds. The Ferryman says it is the bone-weavers, who sew the dead into soldiers for the Lich. Take four stolen shrouds back from the bone-weavers at the Corpse Landing, on the east shore.',
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
    text: 'Mott took a close look at the guards on the north road in their bone armor. He knows some of their faces, because he buried them himself. The Lich has sewn the landing’s own dead into his guard. Lay six necropolis guards to rest, on the roads north of the landing or on the island.',
    objective: { kind: 'kill', region: 'hollowmere', count: 6, enemies: ['necropolis-guard'], label: 'Lay necropolis guards to rest' },
    after: ['buried-twice'],
    zone: 'hollowmere',
    level: 55,
    reward: { xp: 1100, gold: 900, item: 'gravediggers-mitts', text: 'Mott digs six new graves on the hill above the landing, deep ones this time. He gives you his spare work mitts.' },
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
        lines: ['Hroki sent you? His grandfather sold me the nails for this boat.', 'You’re alive. Most people who reach me aren’t. Sit down, if you like.'],
      },
      {
        when: { quest: 'the-restless-shore', state: 'active' },
        lines: ['The dead used to wait quietly on the stones for me to row them across.', 'Now they walk out of the water and bang on Nan’s shutters. Put them down along the shore. Don’t leave them lying there, or the lake will mend them.'],
      },
      {
        when: { quest: 'across-the-mere', state: 'active' },
        lines: ['I won’t row you to the island. No boat that went there ever came back.', 'The old causeway still runs out to it, north-east of here. They used to carry the dead along it with lamps.'],
      },
      {
        when: { quest: 'the-necropolis', state: 'active' },
        lines: ['The Lich was a sorcerer of the old kingdom. He drowned himself so he could rule the drowned.', 'Kill him, and my passengers can finally cross.'],
      },
      {
        when: { quest: 'ysanes-last-echo', state: 'active' },
        lines: ['There was one woman I never rowed across. The Lich kept her on the island.', 'Go and talk to her. She has waited a long time.'],
      },
      {
        when: { quest: 'the-necropolis', state: 'done' },
        lines: ['I rowed until dawn. So many of them had waited so long to cross.', 'Thank you for setting them free.'],
      },
      {
        when: { quest: 'the-dead-lake', state: 'done' },
        lines: ['This is the landing: Nan’s hostel, Tobiah’s charms, Mott’s graves, and my boat.', 'Don’t stare at the water too long. It shows a sky that isn’t there, and it pulls at you.'],
      },
      { lines: ['I row the dead across the lake, a penny a head.', 'Not many living people come here.'] },
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
        lines: ['My lodgers went to call to their dead across the water, and something called back. Now they’re hiding in the reeds.', 'Lay those wraiths to rest so my lodgers can come home.'],
      },
      { when: { quest: 'the-answering-dead', state: 'done' }, lines: ['They’re asleep by the fire. I’ve told them no more calling across the water for a while.', 'Keep the shawl. I’ll knit myself another.'] },
      { lines: ['This is the Landing Hostel. Beds, pie, potions, and a fire that has never gone out.', 'I came here from Candlewick thirty winters ago. Potions are on the shelf. Pay what’s marked.'] },
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
        lines: [
          'My daughter Wenna drowned at Emberwick three winters ago. I came north through the Gloam Gate to find her.',
          'They say this lake keeps every drowned soul who is still mourned. I have never stopped mourning her.',
          'People say she walks in Drowned Elsmere, north-west of here. I’m afraid to go. Will you look for me?',
        ],
      },
      {
        when: { quest: 'keepsakes-of-elsmere', state: 'active' },
        lines: ['Women in grey veils, still looking for their doors. That sounds like Elsmere.', 'Bring me what they carry: a comb, a ring, a locket. Anything Wenna might have held.'],
      },
      {
        when: { quest: 'the-bell-of-elsmere', state: 'active' },
        lines: ['This locket is hers. Her name is inside. I had it engraved the year she married.', 'Some nights I hear that bell under the water. Every time it rings, the dead get up again. Please make it stop, so she can rest.'],
      },
      { when: { quest: 'the-bell-of-elsmere', state: 'done' }, lines: ['I buried the locket on the hill, under a stone I carved myself. It’s not a good stone, but she’d like it.', 'I’ll stay here a while and sell charms to the living. They need them more than the dead do.'] },
      { lines: ['This is the Pilgrim’s Pack. Charms, amulets, rings and relics, blessed at six shrines.', 'Take your time and look around.'] },
    ],
  },
  // Brother Orren at the landing: the lake shows everyone their own dead, and it shows him his
  'orren-at-the-mere': {
    id: 'orren-at-the-mere',
    name: 'Brother Orren',
    title: 'At the water’s edge',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'ysanes-last-echo', state: 'done' },
        lines: [
          'She asked him to let her go. He never did. That is where all of this started.',
          'Elyra is coming north from Lastlight to meet the army at Dawn’s Rest. Bring her the sigil.',
          'When we face the Hallow King, I want to be the one who gives him Ysane’s message.',
        ],
      },
      { when: { quest: 'orren-on-the-shore', state: 'active' }, lines: ['There’s a boy out on the water. He knows my name, the name only our mother used.', 'Don’t let me go in. If I start to walk toward the water, stop me.'] },
      { when: { quest: 'orren-on-the-shore', state: 'done' }, lines: ['For forty years I told mourners the dead must stay dead. I didn’t know how hard that was until tonight.', 'I still believe it. I believe it more now.'] },
      { lines: ['This lake frightens me. I keep hearing a voice out on the water.', 'I’m trying not to listen.'] },
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
          'I have waited three hundred years for someone who would listen to me.',
          'I know what I am. I’m a memory his crown keeps. His whole kingdom died so he could have me back for one night.',
          'I loved him. I don’t want to be the reason for any more of this. When you find him, tell him to let me go.',
        ],
      },
      { lines: ['Please put out the lamp when we’re done. I’m tired.'] },
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
        lines: ['I’ve dug graves at this landing for forty years. Lately my graves keep coming up empty.', 'Something takes the dead in their shrouds and leaves needles of finger-bone in the dirt. Get my shrouds back.'],
      },
      {
        when: { quest: 'old-customers', state: 'active' },
        lines: ['I’ve seen the guards on the north road in their bone armor. I know some of those faces. I buried them.', 'I want them back in the ground where I put them. Lay six of them to rest, and I’ll dig deeper this time.'],
      },
      { when: { quest: 'old-customers', state: 'done' }, lines: ['Six new graves on the hill, nice and deep. They’ll stay down this time.', 'If you need anything dug, I’m always here.'] },
      { lines: ['I’m Mott. I dig the graves here.', 'These are hard times. The lake’s dead don’t stay buried anymore.'] },
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
    banner: 'The Lake Calls',
    start: [
      { who: 'orren-praying', text: 'Davin? Davin. You’re still small. You never got to grow up.' },
      { who: 'orren-praying', text: 'No. Hold the lantern up, Orren. He’s dead. This is the lake talking.' },
    ],
    waves: [
      { enemies: ['lake-wraith', 'lake-wraith', 'drowned-dead', 'drowned-dead'], from: ['mourners-water', 'mourners-reeds'] },
      { enemies: ['lake-wraith', 'lake-wraith', 'lake-wraith', 'mere-serpent'], from: ['mourners-water', 'mourners-east'], barks: [{ who: 'orren-praying', text: 'He says the water is warm. Don’t let me go to him! Keep them back!' }] },
      { enemies: ['lake-wraith', 'lake-wraith', 'drowned-dead', 'drowned-dead', 'drowned-dead'], from: ['mourners-water', 'mourners-reeds', 'mourners-east'], barks: [{ who: 'orren-praying', text: 'I’m sorry I didn’t go out on the ice, Davin. I’m not going out now. Hold them!' }] },
    ],
    end: [{ who: 'orren-praying', text: 'He’s gone quiet. The dead must stay dead. Help me up.' }],
    retry: [{ who: 'orren-praying', text: 'I took a step toward him. Don’t let me do that again. Hold the shore!' }],
  },
};
