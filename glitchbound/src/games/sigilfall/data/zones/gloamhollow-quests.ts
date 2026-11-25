import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * The Gloam Gate, the second of the Three Gates (STORY_BIBLE.md v3, Act IV), played in the Riftscar Wastes
 * (data/zones/riftscar.ts; written for Gloamhollow, whose ids they keep). Nyx came back to Highwall's camp with the
 * Pale Herald's prison map; it leads north from the Shattered Vale across the Riftscar's glass to Lastlight, the
 * lamp-keepers' village on the water, and on up the road to the Gloam Gate, where the Herald keeps Elyra in the cells
 * under the gatehouse. The main chain: the lamps on the road, Nyx's confession (the map is the Herald's trap, to bring
 * the hero to the front of the Gate where his Gatewarden waits, and she said yes to his deal before she came back),
 * the Gate and the eighth warden's vision, the cells (in by a drain the map doesn't show; hold the stair while Nyx
 * picks the lock), the way out (Elyra and Wren follow you down the road), the Gatewarden, and the morning after at
 * Lastlight's fire. Widow Marrow wants her son's lamp back from the Black Pool. Main chain first. Written to
 * DIALOGUE_STYLE.md. v4: Nyx confesses all of it at the jetty and gives up the Herald's letter she kept; Ser Edric's
 * words ("Till the last light. Then a little after.") are on his cairn by the Gate and on the Grey Lady's locket; the
 * five sigils come back from the vault to Elyra by the fire, and the Veil's rite takes the night she met the hero.
 */
export const GLOAMHOLLOW_QUESTS: QuestDef[] = [
  /* ------------------------------------------------------- the lamp road */
  {
    id: 'gloam-the-lamp-road',
    name: 'The Lamp Road',
    giver: 'nyx-returned',
    auto: true,
    text: 'Elyra is a prisoner in the cells under the Gloam Gate, and her five sigils are in the Gate’s vault. Nyx’s map leads there, north out of the Shattered Vale and across the glass of the Riftscar Wastes. The last village on that road is Lastlight, whose lamp-keepers keep the way to the Gate lit. Take the north causeway out of the Shattered Vale and find their head keeper, Brin.',
    // (it was a walk and a talk. Lastlight is found the way every traveler finds it: lamp by lamp across the glass)
    objective: {
      kind: 'trail', region: 'riftscar', from: 'glass-flats', to: 'lamp-keeper-brin', marks: 3, thing: 'lantern', label: 'Follow the lit lamps across the glass to Lastlight',
      notes: ['A lamp, lit, alone on the glass. Then another.', 'This one is out. Something leaned on it.', 'Lastlight. There is a lamp in every window.'],
    },
    then: [{ kind: 'talk', npc: 'lamp-keeper-brin', label: 'Talk to Lamp-keeper Brin in Lastlight' }],
    after: ['the-long-night-ends'],
    // it is how the hero hears of Gloamhollow: it starts with the map in hand, not on arrival
    level: 44,
    reward: { xp: 1500, gold: 420, text: 'Brin hears why you have come, and she doesn’t ask Nyx a single question. She gives each of you a lamp, Nyx too. On her road, everyone carries a light.' },
  },
  {
    id: 'gloam-the-unlit-mile',
    name: 'The Unlit Mile',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'For three hundred years Lastlight has kept a lamp lit every fifty paces from the village to the Gloam Gate. This month, marsh-lights have been putting them out. They lean on a lamp until it dies, then lead travelers off the road and into the water. Snuff out four marsh-lights on the road north and in Wisp Glen, and relight the lamps of the unlit mile.',
    objective: { kind: 'kill', region: 'riftscar', count: 4, enemies: ['marsh-light'], label: 'Snuff out marsh-lights on the road and in Wisp Glen' },
    // (it was six kills. The mile is unlit until its lamps are lit again, and the lights come back to lean on them)
    then: [{ kind: 'use', region: 'riftscar', at: 'will-o-glen', count: 3, thing: 'lantern', verb: 'Relight', label: 'Relight the lamps of the unlit mile', secs: 1.1, spread: 7, ambush: ['marsh-light', 'marsh-light'] }],
    after: ['gloam-the-lamp-road'],
    zone: 'riftscar',
    level: 44,
    reward: { xp: 1600, gold: 430, text: 'Brin follows you up the road and relights every lamp. From the last one you can see the Gloam Gate, black against the sky, with one window glowing violet. Nyx’s map says the guard changes at the second bell of night, so you go back down to Lastlight to wait for it.' },
  },
  {
    id: 'gloam-nyx-confesses',
    name: 'The Price of the Map',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'You have until the second bell of night. Nyx is sitting alone at the end of Lastlight’s jetty with her lamp out, and she hasn’t eaten since Highwall. Talk to her before you go up to the Gate.',
    // (it was a walk down the jetty. She sits with her lamp out: a lit one is carried out to her)
    objective: { kind: 'carry', region: 'riftscar', from: 'lamp-keeper-brin', to: 'nyx-lastlight', thing: 'lantern', verb: 'Take a lit lamp', label: 'Carry a lit lamp out to Nyx on the jetty' },
    then: [{ kind: 'talk', npc: 'nyx-lastlight', label: 'Talk to Nyx' }],
    after: ['gloam-the-unlit-mile'],
    zone: 'riftscar',
    level: 46,
    find: {
      name: 'The Letter Nyx Kept',
      kind: 'letter',
      about: 'The voidcallers’ cipher from the Breach Camp in the Shattered Vale, the letter Nyx snatched out of your hand. She told everyone it was only the singers’ orders. It was a letter to her, and under every line of grey cipher she has written it out in pencil.',
      body: [
        'Little thief.',
        'Your brother Wren is alive. He asks for you at night.',
        'The warden-girl will come to the Tear for the Veil. Bring her by the north path, after dark, and tell no one.',
        'Do this, and Wren walks free the same night. Fail me, and he walks in my king’s Host.',
      ],
      sign: '(sealed with an empty crown)',
    },
    reward: { xp: 1500, gold: 300, text: 'Nyx lights her lamp again from yours. She will take you in under the gatehouse by a way the Herald doesn’t know, not through the front where his Gatewarden waits. “We bring them both out,” she says. “Elyra first.”' },
  },
  {
    id: 'gloam-the-gate',
    name: 'The Eighth Warden',
    giver: 'nyx-lastlight',
    auto: true,
    text: 'It is the second bell of night, when the Gate’s guard changes. The Gloam Gate stands at the north end of the lamp road, and the Host has held it for thirty years. Cael and Orren have ridden in from Highwall to go in with you. Go up to the Gate with Nyx and find the way in under the gatehouse.',
    objective: { kind: 'explore', spot: 'the-gloam-gate', label: 'Go up to the Gloam Gate with Nyx' },
    // (the way in was found in a line of talk. It is looked for under the gatehouse, grating by grating, with the
    // guard changing overhead)
    then: [
      {
        kind: 'use', region: 'riftscar', at: 'gate-causeway', count: 3, thing: 'runestone', verb: 'Search', label: 'Search under the gatehouse for the way in', secs: 1.1, spread: 6, guards: ['hollow-sentinel'],
        notes: ['A grating, rusted shut. Not this one.', 'A cairn-stone, older than the Gate. A name is cut in it.', 'The drain. Wide enough for one, and it goes down.'],
      },
    ],
    after: ['gloam-nyx-confesses'],
    zone: 'riftscar',
    level: 46,
    find: {
      step: 1,
      name: 'Ser Edric’s Cairn-Stone',
      kind: 'relic',
      about: 'A flat stone from the cairn beside the Gloam Gate, where Ser Edric fell three hundred years ago. His widow, the Grey Lady, came north to carry him home, and before she left she cut his words into it. The same words are engraved on her locket, which you found at Fernstead.',
      body: ['EDRIC OF FERNSTEAD', 'THE EIGHTH WARDEN', 'Till the last light. Then a little after.'],
    },
    reward: { xp: 1700, gold: 460, text: 'Behind the cairn, Nyx finds a drain that isn’t on the Herald’s map. It runs under the gatehouse to a stair and a locked iron door. Nyx knows the lock. Brennick made it, the old thief who taught her the trade.' },
  },
  {
    id: 'gloam-the-cells',
    name: 'The Cells',
    giver: 'nyx-lastlight',
    auto: true,
    text: 'The drain comes out at the bottom of the cell stair, by a locked iron door. Nyx needs time to pick the lock, and the Gate’s guards are already coming down the stair. Hold the stair with Cael and Orren while she works.',
    objective: { kind: 'event', event: 'gloam-cells', label: 'Hold the cell stair while Nyx picks the lock' },
    after: ['gloam-the-gate'],
    zone: 'riftscar',
    level: 47,
    reward: { xp: 2400, gold: 560, text: 'The lock gives. Behind the door is a row of cells, and in cell four sits Elyra, thin and pale, with no light in her hands at all. She looks up and knows your face at once. In cell five, Wren is asleep against the bars.' },
  },
  {
    id: 'gloam-out-of-the-cells',
    name: 'Out of the Dark',
    giver: 'nyx-lastlight',
    auto: true,
    text: 'Elyra is free, but she can barely walk, and Wren is weak from half a year in a cell. Every guard in the Gate is coming down the stair. Lead them both out through the drain and down the road to the first lit lamp, where Brin’s keepers are waiting.',
    objective: { kind: 'event', event: 'gloam-out', label: 'Lead Elyra and Wren down the road to the lamps' },
    after: ['gloam-the-cells'],
    zone: 'riftscar',
    level: 47,
    reward: { xp: 2600, gold: 600, text: 'At the first lamp, Elyra sits down on the glass and cries without a sound. All the way down the road she held on to your sleeve. Brin wraps her and Wren in blankets and takes them down to Lastlight.' },
  },
  {
    id: 'the-gatewarden',
    name: 'The Gatewarden',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'Elyra and Wren are safe in Lastlight, but Elyra’s five sigils are still in the vault behind the Gatewarden, a giant in black armor who holds the gateway. While he stands in it, the Gate’s runes heal him. Go back up the road, draw him out of the gateway and defeat him.',
    // (the Gate's runes heal him while he stands in it: the three round the gateway are put out before he is fought)
    objective: { kind: 'use', region: 'riftscar', at: 'the-gloam-gate', count: 3, thing: 'rod', verb: 'Snuff the rune', label: 'Snuff the three runes that heal the Gatewarden', secs: 1.2, spread: 6, guards: ['border-reaver'] },
    then: [{ kind: 'kill', region: 'riftscar', count: 1, enemies: ['the-gatewarden'], label: 'Defeat the Gatewarden at the Gloam Gate', lair: { at: 'the-gloam-gate', enemies: ['the-gatewarden'] } }],
    after: ['gloam-out-of-the-cells'],
    zone: 'riftscar',
    level: 48,
    reward: {
      xp: 5600,
      gold: 1300,
      item: 'gatewardens-rune-plate',
      text: 'The Gatewarden falls, and the violet light in the Gate’s window goes out. In the vault behind him you find the five sigils in an iron box, cold and dark without Elyra. Brin’s keepers come up the road and hang their lamps on the Gate, for the first time in thirty years.',
    },
  },
  {
    id: 'the-gloam-gate',
    name: 'The Second Gate',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'The Gloam Gate is taken, and the five sigils from its vault are in your pack. Only the one who bonded them can wake them again. Elyra is by Brin’s fire in Lastlight, with Nyx and Wren beside her. Take the sigils down to her.',
    // (the sigils were in the hero's pack at Lastlight's fire. They are carried there, down the lamp road, with what is
    // left of the Gate's riders after them)
    objective: { kind: 'carry', region: 'riftscar', from: 'the-gloam-gate', to: 'elyra-lastlight', thing: 'chest', verb: 'Take up the sigils', label: 'Carry the five sigils down the lamp road', ambush: [['border-reaver', 'border-reaver'], ['hollow-sentinel', 'marsh-light']] },
    then: [{ kind: 'talk', npc: 'elyra-lastlight', label: 'Give the sigils to Elyra by Lastlight’s fire' }],
    after: ['the-gatewarden'],
    zone: 'riftscar',
    level: 48,
    reward: {
      xp: 3200,
      gold: 700,
      item: { rarity: 'epic' },
      perk: 'sigil-veil',
      text: 'You put the five sigils in Elyra’s hands, and their light runs back into her. “Five,” she says. “Another is somewhere past the Gate, in the dead kingdom. I can feel it. The last is the Stone, and Vosk carried that north to his king.” Highwall holds, the Gloam Gate is taken, and the road into Vaelmoor is open.',
    },
  },

  /* ------------------------------------------------- postgame: Wren's fate */
  {
    id: 'thread-wren',
    name: 'Wren’s First Night',
    giver: 'wren',
    text: 'Wren has become one of Lastlight’s lamp-keepers. Tonight is his first night as a keeper on the road to the Gate. Walk the road with him: light his first three lamps, snuff out the marsh-lights that come to lean on them, and stand by the last one until the road is his.',
    // (it was twelve kills. A keeper's first night is lamps lit: the hero lights his first three with him, clears what
    // comes to lean on them, and stands by the last until the road is his)
    objective: { kind: 'use', region: 'riftscar', at: 'gate-causeway', count: 3, thing: 'lantern', verb: 'Light it with Wren', label: 'Light Wren’s first three lamps on the Gate road', secs: 1.1, spread: 7, ambush: ['marsh-light', 'marsh-light'] },
    then: [
      { kind: 'kill', region: 'riftscar', count: 6, enemies: ['marsh-light'], label: 'Snuff out the marsh-lights on Wren’s road' },
      { kind: 'hold', region: 'riftscar', at: 'gate-causeway', secs: 20, waves: [['marsh-light', 'marsh-light'], ['marsh-light', 'gloam-lurker']], label: 'Stand by Wren’s last lamp until the lights give up' },
    ],
    after: ['epilogue-the-bell'],
    zone: 'riftscar',
    level: 60,
    reward: { xp: 4000, gold: 1200, item: { rarity: 'epic' }, text: 'At dawn every lamp is still lit. Wren falls asleep against the last one with his hook across his knees. Nyx carries him home and doesn’t say a word.' },
  },
  /* ------------------------------------------------- Widow Marrow's son */
  {
    id: 'the-black-pool',
    name: 'The Black Pool',
    giver: 'widow-marrow',
    text: 'Widow Marrow’s son Tam was a lamp-keeper. A year ago he walked off the road at dusk, singing, toward the Black Pool west of the village. He never came back. Marrow wants someone to go and see what happened to him.',
    // (it was a walk to the pool. Tam's own way off the road is followed)
    objective: {
      kind: 'trail', region: 'riftscar', from: 'widow-marrow', to: 'the-black-pool', marks: 3, label: 'Follow where Tam left the lamp road',
      notes: ['His boots left the road here. He was not running.', 'A keeper’s wick-trimmer, dropped in the reeds.', 'Singing, faint, from the water. A woman’s voice.'],
    },
    then: [
      { kind: 'explore', spot: 'the-black-pool', label: 'Find the Black Pool' },
      { kind: 'use', region: 'riftscar', at: 'the-black-pool', count: 1, thing: 'bones', verb: 'Search the reeds', label: 'Search the reeds at the water’s edge', secs: 1.3, spread: 3, notes: ['A lamp-tag on a cord: “Tam Marrow, Keeper.”'] },
    ],
    after: ['gloam-the-lamp-road'],
    zone: 'riftscar',
    level: 45,
    // (this and the lurkers pay out at the pool, and the chain goes on there: the hero carries it all back to Marrow
    // once, at the end, instead of walking the glass three times to tell her each step)
    turnIn: false,
    find: {
      step: 2,
      name: 'Tam’s Lamp-Tag',
      kind: 'token',
      about: 'The brass tag every Lastlight keeper ties to their lamp. It was hanging with Tam’s lamp on a hook at the edge of the Black Pool. Someone scratched words into its back with a knife, in a hurry.',
      body: ['TAM. KEEPER. LASTLIGHT.', '(Scratched on the back:) she sings like mam. going to see.'],
    },
    reward: { xp: 700, gold: 430, text: 'Tam’s lamp hangs on a hook at the edge of the pool, still warm after a year. Gloam lurkers move in the reeds. Under the black water, a woman is singing a lullaby.' },
  },
  {
    id: 'gloam-lurkers',
    name: 'Lurkers in the Reeds',
    giver: 'widow-marrow',
    text: 'Gloam lurkers hide in the reeds around the Black Pool and drag down anyone the singing draws to the water. Defeat five of them and cut a way through the reeds, so you can reach the water’s edge and see who is singing.',
    objective: { kind: 'kill', region: 'riftscar', count: 5, enemies: ['gloam-lurker'], label: 'Defeat gloam lurkers around the Black Pool' },
    // (it was eight kills, to reach the water. The way to it is cut)
    then: [{ kind: 'use', region: 'riftscar', at: 'the-black-pool', count: 3, thing: 'herb', verb: 'Cut the reeds', label: 'Cut a way through the reeds to the water’s edge', secs: 1, spread: 5, ambush: ['gloam-lurker'] }],
    after: ['the-black-pool'],
    zone: 'riftscar',
    level: 45,
    turnIn: false,
    reward: { xp: 750, gold: 450, text: 'With the lurkers gone, the singing stops. A drowned woman in an old lamp-keeper’s coat rises out of the Black Pool and stands in the water, waiting.' },
  },
  {
    id: 'the-drowned-mother',
    name: 'The Drowned Mother',
    giver: 'widow-marrow',
    text: 'The singer is a drowned woman in a lamp-keeper’s coat three hundred years old. She sings people into the Black Pool, and she sang Tam in. Lay her to rest. Then take Tam’s lamp home to Widow Marrow in Lastlight.',
    objective: { kind: 'kill', region: 'riftscar', count: 1, enemies: ['the-drowned-mother'], label: 'Lay the Drowned Mother to rest at the Black Pool', lair: { at: 'the-black-pool', enemies: ['the-drowned-mother'] } },
    // (Tam's lamp went home in a line of talk. It goes home in the hero's hands, lit, through what is left in the reeds)
    then: [{ kind: 'carry', region: 'riftscar', from: 'the-black-pool', to: 'widow-marrow', thing: 'lantern', verb: 'Take Tam’s lamp', label: 'Carry Tam’s lamp home to Widow Marrow', ambush: [['gloam-lurker'], ['marsh-light', 'marsh-light']] }],
    after: ['gloam-lurkers'],
    zone: 'riftscar',
    level: 46,
    reward: { xp: 1100, gold: 620, item: 'tams-lamp', text: 'Marrow reads the back of Tam’s tag and sits down. “He thought it was me calling him,” she says. That night she lights his lamp in her window. In the morning she gives it to you, and sends all her lamp-oil to light the road to the Gate.' },
  },

];

export const GLOAMHOLLOW_NPCS: Record<string, NpcDef> = {
  'lamp-keeper-brin': {
    id: 'lamp-keeper-brin',
    name: 'Lamp-keeper Brin',
    title: 'Head keeper of Lastlight',
    sprite: 'villager',
    talk: [
      { when: { quest: 'gloam-the-lamp-road', state: 'active' }, lines: ['I’m Brin, the head lamp-keeper. You came up the road in the dark. Never do that out here.', 'You’re going to the Gloam Gate? Then you’ll need our lamps lit, and something has been putting them out.'] },
      { when: { quest: 'gloam-the-unlit-mile', state: 'active' }, lines: ['There’s a lamp every fifty paces from my door to the Gate. My grandmother lit them, and her grandmother before her.', 'The marsh-lights lean on them until they go out. Snuff out four, and relight the lamps of the unlit mile yourself, out by Wisp Glen. My keepers won’t go that far any more.'] },
      { when: { quest: 'gloam-nyx-confesses', state: 'active' }, lines: ['Nyx is sitting at the end of my jetty with her lamp out. A keeper only does that when someone has died.', 'Go and talk to her before you go up to the Gate.'] },
      { when: { quest: 'gloam-the-gate', state: 'active' }, lines: ['There’s a cairn beside the gateway, as old as our lamps. A warden of Aster fell there, holding the Gate alone.', 'My people kept a lamp lit on it for three hundred years, until the Host took the Gate.'] },
      { when: { quest: 'the-gatewarden', state: 'active' }, lines: ['Elyra is asleep by my fire. Wren is eating everything in the house.', 'The Gatewarden still holds the Gate, and Elyra’s sigils are in the vault behind him. Go and defeat him.'] },
      { when: { quest: 'the-gloam-gate', state: 'active' }, lines: ['Elyra is awake. She’s weak, but she asked for you.', 'Take her what you found in the vault. She’s by the fire.'] },
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['The Gate is lit now. This morning I walked through it and saw the road north into Vaelmoor.', 'Brother Orren went through the Gate at dawn. He left word that he’ll wait for you at Candlewick.'] },
      { lines: ['This is Lastlight, the last village before the Hallow King’s country. We keep the road to the Gate lit.', 'Always carry a lamp on the glass. The marsh-lights lead people off the road.'] },
    ],
  },
  'widow-marrow': {
    id: 'widow-marrow',
    name: 'Widow Marrow',
    title: 'Oil, potions and grudges',
    sprite: 'villager',
    shop: 'inn',
    shopName: 'Marrow’s Oil-House',
    talk: [
      { when: { quest: 'the-black-pool', state: 'active' }, lines: ['My son Tam walked off the road a year ago, singing, toward the Black Pool. That’s west of the village.', 'I think he’s dead. I need someone to go and see.'] },
      { when: { quest: 'gloam-lurkers', state: 'active' }, lines: ['You’ve been out to the pool? Don’t tell me yet. Finish it first.', 'Some nights I can hear singing from that way, when the wind is right.'] },
      { when: { quest: 'the-drowned-mother', state: 'active' }, lines: ['A drowned keeper in an old coat? That’s Lastlight’s first lamp-keeper. She walked into that pool after her own lost child.', 'Lay her to rest, so she can’t take anyone else’s. Then bring me Tam’s lamp. Bring it lit, the way he carried it.'] },
      { when: { quest: 'the-drowned-mother', state: 'done' }, lines: ['I lit Tam’s lamp in my window last night. Now I’ve sent all my oil to light the road to the Gate.', 'The first keeper went into that pool after her child. If I’d seen Tam go in, I’d have gone in after him too.'] },
      { lines: ['This is Marrow’s Oil-House. I sell lamp-oil and potions.', 'Take a potion before you go up the road to the Gate.'] },
    ],
  },
  'tinker-gale': {
    id: 'tinker-gale',
    name: 'Tinker Gale',
    title: 'Lamp-maker and mender',
    sprite: 'villager',
    shop: 'armor',
    shopName: 'Gale’s Mending',
    talk: [
      { lines: ['This is Gale’s Mending. I fix armor and lamps, and I sell both.', 'If your armor took a beating on the glass, bring it here.'] },
    ],
  },
  // Nyx at Lastlight and the Gate: the map was the Herald's bait; she came to make it real
  'nyx-lastlight': {
    id: 'nyx-lastlight',
    name: 'Nyx',
    title: 'Come back',
    sprite: 'villager',
    talk: [
      { when: { quest: 'gloam-the-lamp-road', state: 'active' }, lines: ['Talk to Brin. She runs the lamps, and nobody reaches the Gate without them.', 'When she hears what I did, she won’t like me. That’s fair.'] },
      { when: { quest: 'gloam-the-unlit-mile', state: 'active' }, lines: ['Brin gave me a lamp, but she watches me every time I carry it. I don’t blame her.', 'Go and put out those marsh-lights. I’ll keep watch on the road.'] },
      {
        when: { quest: 'gloam-nyx-confesses', state: 'active' },
        lines: [
          'In the Vale I told you that coded letter was only orders for the singers. I lied. It was to me, from the Herald. Read it.',
          'He wrote that Wren was alive, and would walk free if I brought Elyra to the Tear. So I told him your road.',
          'He took Elyra, and he kept Wren anyway. He never meant to let him go.',
          'When he gave me the map, he said I had one more chance. I said yes to his face. Part of me still means it.',
          'If he puts Wren in front of me, I’m scared of what I’ll do. So I’ll walk in front, where you can see me.',
        ],
      },
      { when: { quest: 'gloam-the-gate', state: 'active' }, lines: ['His map doesn’t show the drains. One of them runs under the gatehouse.', 'We go in that way, not through the front where his Gatewarden waits.'] },
      { when: { quest: 'gloam-the-cells', state: 'active' }, lines: ['Brennick made this lock. He’s the old thief who taught me the trade, and this is the hardest kind he made.', 'I need time. Hold the stair and keep the guards away from me.'] },
      { when: { quest: 'gloam-out-of-the-cells', state: 'active' }, lines: ['Wren, I’ve got you. Stay behind me and keep walking.'] },
      { when: { quest: 'the-gatewarden', state: 'active' }, lines: ['Wren is asleep. Elyra keeps asking where you went.', 'Get her sigils back from that vault. I’ll stay with her.'] },
      { when: { quest: 'the-gloam-gate', state: 'active' }, lines: ['She’s awake. Go on. She asked for you before she asked for water.'] },
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['Every evening I tell Elyra the story of the night you met. It’s the least I owe her.', 'Wren wants to be a lamp-keeper here. I think I’ll let him.'] },
      { lines: ['I’m staying in Lastlight with Wren for now. My lamp stays lit.'] },
    ],
  },
  // Elyra after the cells: free, and forgetting small things first (STORY_BIBLE.md §2)
  'elyra-lastlight': {
    id: 'elyra-lastlight',
    name: 'Elyra',
    title: 'Out of the dark',
    sprite: 'villager',
    talk: [
      {
        when: { quest: 'the-gloam-gate', state: 'active' },
        lines: [
          'You brought them back. I can feel all five through the cloth, like coals in a pocket.',
          'Every sigil I’ve bonded took a memory with it. The Veil will take one too, and I don’t know which.',
          'Give them to me anyway. While they answer to me, the Herald can’t use them.',
        ],
      },
      { when: { quest: 'ysanes-last-echo', state: 'done' }, lines: ['The Sigil of Tides woke in your hand, and I felt it from here. It bonded to me across the whole of Vaelmoor.', 'It took your name. I know your face, and I trust it. Don’t tell me your name yet. I want to find it myself.', 'I’m coming north to Dawn’s Rest with the others. Bring me the sigil there.'] },
      { when: { quest: 'wood-the-children', state: 'done' }, lines: ['Orren wrote to me about the King’s children in the snow.', 'Their father sat up all winter between their beds. Then he broke his crown to bring them back.', 'If you find the Sigil of Tides, I’ll feel it wake, even from here. Every sigil I’ve bonded is tied to me.'] },
      // (after the Veil's rite: she knows the hero, and has lost the night they met)
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['I know your face, and I trust it more than anyone’s. I can’t remember the night we met. Nyx tells it to me every evening.', 'Brin says I’m too weak to walk into Vaelmoor yet. Go on north. I’ll follow when I can.'] },
      { lines: ['I want to go north with you. Brin says I’m too weak to walk that far yet.', 'Go on without me. I’ll catch up when I can.'] },
    ],
  },
  wren: {
    id: 'wren',
    name: 'Wren',
    title: 'Nyx’s brother',
    sprite: 'villager',
    talk: [
      // (the later days first: the first that holds is said)
      { when: { quest: 'thread-wren', state: 'done' }, lines: ['I’m a real lamp-keeper now. Brin said so.', 'Nyx cried when we came home. Don’t tell her I saw.'] },
      { when: { quest: 'thread-wren', state: 'offered' }, lines: ['Brin gave me a lamp-keeper’s hook. Tonight is my first night as a keeper.', 'Will you walk it with me? The marsh-lights will come for my lamps.'] },
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['You’re the one Nyx talks about. Thank you for coming for us.', 'I want to be a lamp-keeper. Brin says I can. Nyx hasn’t decided yet.'] },
      { lines: ['The Herald kept me in a cell for half a year. I’m still getting used to the sky.'] },
    ],
  },
};

/** The cells under the Gloam Gate, and the way out of them (Act IV, the second Gate). */
export const GLOAMHOLLOW_EVENTS: Record<string, StoryEventDef> = {
  'gloam-cells': {
    id: 'gloam-cells',
    region: 'riftscar',
    kind: 'defend',
    at: 'gate-cells',
    radius: 10,
    level: 47,
    allies: ['cael', 'orren'],
    ward: { pet: 'nyx-at-the-lock', at: 'gate-cells', name: 'Nyx, at the lock' },
    banner: 'Hold the stair!',
    start: [
      { who: 'nyx-at-the-lock', text: 'I know this lock. I need time. Keep them off me!' },
      { who: 'cael', text: 'The stair is narrow. They can only come a few at a time. Hold here!' },
    ],
    waves: [
      { enemies: ['hollow-sentinel', 'border-reaver', 'border-reaver'], from: ['gate-n', 'gate-w'] },
      { enemies: ['hollow-sentinel', 'hollow-sentinel', 'pale-acolyte', 'pale-acolyte', 'marsh-light'], from: ['gate-n', 'gate-e'], barks: [{ who: 'orren', text: 'More guards on the stair! Keep them away from Nyx!' }] },
      { enemies: ['hollow-sentinel', 'hollow-sentinel', 'border-reaver', 'border-reaver', 'tear-wraith'], from: ['gate-n', 'gate-w', 'gate-e'], barks: [{ who: 'nyx-at-the-lock', text: 'Almost there! Don’t let them reach me!' }] },
    ],
    end: [{ who: 'nyx-at-the-lock', text: 'Got it! The door is open!' }],
    retry: [{ who: 'nyx-at-the-lock', text: 'I lost it. I have to start the lock again. Hold them off!' }],
  },
  'gloam-out': {
    id: 'gloam-out',
    region: 'riftscar',
    kind: 'rescue',
    at: 'gate-cells',
    radius: 8,
    level: 47,
    allies: ['nyx'],
    rescue: { pets: ['elyra-freed', 'wren'], at: 'gate-cells', to: 'gate-causeway' },
    banner: 'Out of the dark!',
    start: [
      { who: 'elyra-freed', text: 'I can walk. Don’t carry me. Just get us out.' },
      { who: 'wren', text: 'Nyx? Nyx! You came back for me!' },
    ],
    waves: [
      { enemies: ['border-reaver', 'border-reaver', 'marsh-light', 'marsh-light'], from: ['gate-w', 'gate-e'] },
      { enemies: ['hollow-sentinel', 'border-reaver', 'gloam-lurker', 'gloam-lurker'], from: ['gate-n', 'gate-w'], barks: [{ who: 'elyra-freed', text: 'I can see lamps down the road! Head for the lamps!' }] },
    ],
    end: [
      { who: 'elyra-freed', text: 'We’re out. We’re really out.' },
      { who: 'nyx', text: 'Wren, look at me. You’re safe. I’m sorry it took me so long.' },
    ],
    retry: [{ who: 'nyx', text: 'Back to the drain! We try again!' }],
  },
};
