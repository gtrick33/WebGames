import type { NpcDef, QuestDef, StoryEventDef } from '../types';

/**
 * The Gloam Gate, the second of the Three Gates (STORY_BIBLE.md v3, Act IV), played in the Riftscar Wastes
 * (data/zones/riftscar.ts; written for Gloamhollow, whose ids they keep). Nyx came back to Highwall's camp with the
 * Pale Herald's prison map; it leads north from the Shattered Vale across the Riftscar's glass to Lastlight, the
 * lamp-keepers' walled village, and on up the road to the Gloam Gate, where the Herald keeps Elyra in the cells
 * under the gatehouse. The main chain: the lamps on the road, Nyx's confession (the map was the Herald's bait), the
 * Gate and the eighth warden's vision, the cells (hold the stair while Nyx picks the lock), the way out (Elyra and
 * Wren follow you down the road), the Gatewarden, and the morning after at Lastlight's fire. Widow Marrow wants her
 * son's lamp back from the Black Pool. Main chain first.
 */
export const GLOAMHOLLOW_QUESTS: QuestDef[] = [
  /* ------------------------------------------------------- the lamp road */
  {
    id: 'gloam-the-lamp-road',
    name: 'The Lamp Road',
    giver: 'nyx-returned',
    auto: true,
    text: 'The Herald’s map shows a causeway north from the Shattered Vale across the Riftscar Wastes, glass and violet light where the Tear first tore the world open, and at the end of it a gatehouse marked with one word in a neat grey hand: KEPT. The only people who still live on it are the lamp-keepers of Lastlight, who keep the causeway lit. Nyx says they will not like her. Take the north road out of the Shattered Vale and find their head keeper.',
    objective: { kind: 'talk', npc: 'lamp-keeper-brin', label: 'Find the head lamp-keeper at Lastlight' },
    after: ['the-long-night-ends'],
    // it is how the hero hears of Gloamhollow: it starts with the map in hand, not on arrival
    level: 44,
    reward: { xp: 1500, gold: 420, text: 'Brin looks at Nyx for a long time and then hands her a lamp to carry. “On this road,” she says, “everybody carries one. Even you.”' },
  },
  {
    id: 'gloam-the-unlit-mile',
    name: 'The Unlit Mile',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'Every night for three hundred years Lastlight has lit the lamps from the village to the Gate, one every fifty paces, so nobody who walks the causeway walks it in the dark. For a month the marsh-lights have been putting them out: little drifting fires that lean on a lamp until it gutters and then lead whoever is lost off the stones and into the water. Brin wants her mile back. Snuff the marsh-lights on the causeway and in Wisp Glen.',
    objective: { kind: 'kill', region: 'riftscar', count: 6, enemies: ['marsh-light'], label: 'Snuff out the marsh-lights on the unlit mile' },
    after: ['gloam-the-lamp-road'],
    zone: 'riftscar',
    level: 44,
    reward: { xp: 1600, gold: 430, text: 'Brin lights the mile behind you, lamp by lamp, humming. You can see the Gate from the last one: a black tooth on the horizon, and one window in it lit violet.' },
  },
  {
    id: 'gloam-nyx-confesses',
    name: 'The Price of the Map',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'Cell ten: the thief’s brother. Promised. Nyx has not said a word since she read it. She is sitting on the end of Lastlight’s wall with her feet over the glass and her lamp out. Go and talk to her before the two of you walk up to that Gate.',
    objective: { kind: 'talk', npc: 'nyx-lastlight', label: 'Talk to Nyx on Lastlight’s wall' },
    after: ['gloam-the-unlit-mile'],
    zone: 'riftscar',
    level: 46,
    reward: { xp: 1500, gold: 300, text: 'The map was the Herald’s price. He gave it to her so she would bring you to the Gate, and he promised her Wren back for it. She took the map, and then she came and told Mara everything, and she has been waiting a week for you to ask why. “He wants you at that Gate,” she says. “So do I. Only one of us is lying about why.”' },
  },
  {
    id: 'gloam-the-gate',
    name: 'The Eighth Warden',
    giver: 'nyx-lastlight',
    auto: true,
    text: 'Nyx has lit her lamp again. The Gloam Gate stands at the north end of the causeway: the second of the Three Gates the Sigil-wardens built across the road to Vaelmoor, three hundred years old, the Host’s for thirty. The Herald keeps Elyra in its cells, and the sigils in its vault. There is a cairn by the causeway that nobody in Lastlight will touch. Go up with Nyx and find a way under the gatehouse.',
    objective: { kind: 'explore', spot: 'the-gloam-gate', label: 'Reach the Gloam Gate' },
    after: ['gloam-nyx-confesses'],
    zone: 'riftscar',
    level: 46,
    reward: { xp: 1700, gold: 460, text: 'Nyx finds the drain where the Herald’s map says there is no drain, and under the gatehouse a stair, and at the bottom of the stair a door with a lock she has seen before. “Brennick’s work,” she says. “He taught me on one of these. Give me a minute. Give me a long minute.”' },
  },
  {
    id: 'gloam-the-cells',
    name: 'The Cells',
    giver: 'nyx-lastlight',
    auto: true,
    text: 'The cell stair runs down under the gatehouse, and the lock at the bottom is the best Nyx has ever seen. She needs time, and the Gate’s sentinels are already coming down the stair. Cael and Orren came up the causeway behind you. Hold the stair while Nyx works the lock.',
    objective: { kind: 'event', event: 'gloam-cells', label: 'Hold the cell stair while Nyx picks the lock' },
    after: ['gloam-the-gate'],
    zone: 'riftscar',
    level: 47,
    reward: { xp: 2400, gold: 560, text: 'The lock gives with a sound like a held breath let go. Behind it, a corridor of doors, and at the ninth a girl in a moss-green robe sitting very straight on a stone bench, with violet light leaking out of her fingertips.' },
  },
  {
    id: 'gloam-out-of-the-cells',
    name: 'Out of the Dark',
    giver: 'nyx-lastlight',
    auto: true,
    text: 'Elyra can walk, just. Wren, Nyx’s brother, can walk and will not stop talking. The Gate has woken: every sentinel in it is coming down to the cells. Get them both out through the drain and down the causeway to the first lit lamp, where Brin’s keepers are waiting.',
    objective: { kind: 'event', event: 'gloam-out', label: 'Lead Elyra and Wren down the causeway to the lamps' },
    after: ['gloam-the-cells'],
    zone: 'riftscar',
    level: 47,
    reward: { xp: 2600, gold: 600, text: 'At the first lamp Elyra stops, and puts her hand flat on the glass as if it were warm, and laughs, and then cries, and then asks Brin very politely what her name is, twice.' },
  },
  {
    id: 'the-gatewarden',
    name: 'The Gatewarden',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'The prisoners are out, but the Gloam Gate still stands across the road north, and its keeper stands in it: the Gatewarden, a giant in blackened plate with the portcullis for a shield and the Gate’s own key for a mace. While he stands in the gateway, the Gate’s runes mend him. Go back up the causeway and bring him down, and the second Gate is ours.',
    objective: { kind: 'kill', region: 'riftscar', count: 1, enemies: ['the-gatewarden'], label: 'Defeat the Gatewarden at the Gloam Gate' },
    after: ['gloam-out-of-the-cells'],
    zone: 'riftscar',
    level: 48,
    reward: {
      xp: 5600,
      gold: 1300,
      item: 'gatewardens-rune-plate',
      text: 'The Gatewarden goes down on one knee in the gateway, and stays there, and the violet window above the gate goes out. Brin’s keepers walk up the causeway behind you hanging lamps on the Gate’s own hooks. Nobody has lit the Gloam Gate in thirty years. It looks smaller lit.',
    },
  },
  {
    id: 'the-gloam-gate',
    name: 'The Second Gate',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'The Gloam Gate is lit and held, and Lastlight has turned its square into an infirmary for one: Elyra, wrapped in three blankets by Brin’s fire, with Nyx and Wren on either side of her like bookends. Go and sit with her.',
    objective: { kind: 'talk', npc: 'elyra-lastlight', label: 'Sit with Elyra by Lastlight’s fire' },
    after: ['the-gatewarden'],
    zone: 'riftscar',
    level: 48,
    reward: {
      xp: 3200,
      gold: 700,
      item: { rarity: 'epic' },
      perk: 'sigil-veil',
      text: 'Brin brings what the Gatewarden kept in the gate’s vault: every sigil the Herald took, and the Veil with them. Elyra holds them all at once and goes white. She remembers the inn, and the bell, and the chapel door. She does not remember the song Thessa taught her, and she knows she doesn’t. “He kept me awake,” she says, “so the sigils would keep talking. They talk all the time now.” Then: “Six. Vosk has the seventh. And the road to Vaelmoor is open.”',
    },
  },

  /* ------------------------------------------------- postgame: Wren's fate */
  {
    id: 'thread-wren',
    name: 'Wren’s First Night',
    giver: 'wren',
    text: 'Wren has asked Brin for a lamp-keeper’s hook, and Nyx has said over her dead body, and Brin has said that can be arranged. Tonight is his first night on the causeway. The marsh-lights know it. Walk the unlit mile with him and snuff whatever leans on his lamps.',
    objective: { kind: 'kill', region: 'riftscar', count: 12, enemies: ['marsh-light'], label: 'Keep Wren’s lamps lit: snuff marsh-lights' },
    after: ['epilogue-the-bell'],
    zone: 'riftscar',
    level: 60,
    reward: { xp: 4000, gold: 1200, item: { rarity: 'epic' }, text: 'Every lamp is lit at dawn, and Wren is asleep against the last one with his hook across his knees. Nyx carries him home over her shoulder like a sack of flour and does not say anything at all, which Brin says is the nicest thing she has ever seen her do.' },
  },
  /* ------------------------------------------------- Widow Marrow's son */
  {
    id: 'the-black-pool',
    name: 'The Black Pool',
    giver: 'widow-marrow',
    text: 'Widow Marrow keeps the lamp-oil, the potions and the oldest grudge in Lastlight. Her son Tam was a lamp-keeper; a year ago he walked the causeway at dusk with his lamp and walked off the stones toward the Black Pool, west of the village, singing. She wants to know where he went. She thinks she knows.',
    objective: { kind: 'explore', spot: 'the-black-pool', label: 'Search the Black Pool west of Lastlight' },
    after: ['gloam-the-lamp-road'],
    zone: 'riftscar',
    level: 45,
    reward: { xp: 700, gold: 430, text: 'At the edge of the pool, a lamp-hook driven into the glass, and on it a lamp that is still warm. Things move in the reeds: gloam lurkers, long and patient, and something under the water that sings in a woman’s voice.' },
  },
  {
    id: 'gloam-lurkers',
    name: 'Lurkers in the Reeds',
    giver: 'widow-marrow',
    text: 'The lurkers lie in the reeds at the Black Pool’s edge and take whatever the marsh-lights lead to them. Marrow wants a path cleared to the water so she can go and say something to it. Thin out the gloam lurkers around the Black Pool and on the western fen.',
    objective: { kind: 'kill', region: 'riftscar', count: 8, enemies: ['gloam-lurker'], label: 'Defeat gloam lurkers' },
    after: ['the-black-pool'],
    zone: 'riftscar',
    level: 45,
    reward: { xp: 750, gold: 450 },
  },
  {
    id: 'the-drowned-mother',
    name: 'The Drowned Mother',
    giver: 'widow-marrow',
    text: 'The voice in the pool is the Drowned Mother: Lastlight’s first lamp-keeper, who walked into the Black Pool after her own lost child three hundred years ago and never came out. The grieflight found her there and made her a mother again, of marsh-lights. She has been calling children home ever since, and Tam was somebody’s child. Go to the Black Pool and let her rest.',
    objective: { kind: 'kill', region: 'riftscar', count: 1, enemies: ['the-drowned-mother'], label: 'Lay the Drowned Mother to rest at the Black Pool' },
    after: ['gloam-lurkers'],
    zone: 'riftscar',
    level: 46,
    reward: { xp: 1100, gold: 620, item: 'tams-lamp', text: 'Marrow cleans Tam’s lamp and fills it and lights it in her window for a night. In the morning she sends every jar of lamp-oil in her cellar up to the Gate. “Light the whole road,” she says. “All the way to whatever is at the end of it.”' },
  },

];

export const GLOAMHOLLOW_NPCS: Record<string, NpcDef> = {
  'lamp-keeper-brin': {
    id: 'lamp-keeper-brin',
    name: 'Lamp-keeper Brin',
    title: 'Head keeper of Lastlight',
    sprite: 'villager',
    talk: [
      { when: { quest: 'gloam-the-lamp-road', state: 'active' }, lines: ['You came up the causeway in the dark. Don’t. Nobody walks it in the dark. That is the whole point of us.', 'Brin. I keep the lamps. Your thief keeps looking at the Gate. Everyone who comes here does that once.'] },
      { when: { quest: 'gloam-the-unlit-mile', state: 'active' }, lines: ['One lamp every fifty paces, from my door to the Gate. Three hundred years. My grandmother lit them, and hers.', 'The marsh-lights lean on them till they gutter. Snuff the lights. Ten. I’ll do the relighting; I like the relighting.'] },
      { when: { quest: 'gloam-nyx-confesses', state: 'active' }, lines: ['Your thief is on my wall with her lamp out. Nobody sits on my wall with their lamp out.', 'Go and talk to her. And bring the lamp back lit, one way or another.'] },
      { when: { quest: 'the-gatewarden', state: 'active' }, lines: ['They’re out. Both of them. I’ve got the girl by my fire and the brother is eating everything in the house.', 'But the Gate is still standing across the road, and its keeper in it. Bring him down, and I’ll hang my lamps on his hooks.'] },
      { when: { quest: 'the-gloam-gate', state: 'active' }, lines: ['She keeps asking me my name. I keep telling her. She says thank you every time, like it’s new.', 'Go and sit with her. Sit on the side she can see.'] },
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['The Gate’s lit. All the way. I walked to the end of the causeway this morning and looked north, and there was a road there, and I’d never seen it.', 'Whatever’s at the end of it, you’ll need light. Take some.'] },
      { lines: ['Lastlight. Last light before the Hallow King’s country. We keep the causeway lit so nobody walks it in the dark.', 'Carry a lamp on the glass. Everybody does. Even the dead carry lamps here, they just carry them out.'] },
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
      { when: { quest: 'the-black-pool', state: 'active' }, lines: ['My Tam walked off the causeway a year ago, at dusk, with his lamp lit, singing. Toward the Black Pool. West.', 'Go and look. I know what you’ll find. I want someone else to have seen it.'] },
      { when: { quest: 'gloam-lurkers', state: 'active' }, lines: ['His lamp. Still warm. A year in the reeds and still warm.', 'Clear me a path to that water. I have something to say to it and I want to say it standing up.'] },
      { when: { quest: 'the-drowned-mother', state: 'active' }, lines: ['The first keeper. She lost a child to that pool, and went in after it, and now she takes everyone else’s. I could almost forgive her. Almost.', 'Let her rest. Then let my Tam rest. Then come and have some soup.'] },
      { when: { quest: 'the-drowned-mother', state: 'done' }, lines: ['I lit his lamp in my window last night. This morning I sent every jar of oil I own up to the Gate.', 'Light the whole road. All the way to the end of it.'] },
      { lines: ['Marrow’s Oil-House. Lamp-oil, potions, and opinions, all strong.', 'Drink one of mine before you go up the causeway. Drink two before you come down it.'] },
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
      { lines: ['Gale’s Mending. Mail, plate, lamps, buckles, hinges, hearts. Not the last one. I tried.', 'If it’s broken, bring it. If it’s haunted, bring it anyway; I charge extra.'] },
    ],
  },
  // Nyx at Lastlight and the Gate: the map was the Herald's bait; she came to make it real
  'nyx-lastlight': {
    id: 'nyx-lastlight',
    name: 'Nyx',
    title: 'Come back',
    sprite: 'villager',
    talk: [
      { when: { quest: 'gloam-the-lamp-road', state: 'active' }, lines: ['North from the Vale, over the glass. There’s a village of people who light lamps. They’re going to hate me. Everybody does that eventually; it saves time if it’s early.'] },
      {
        when: { quest: 'gloam-nyx-confesses', state: 'active' },
        lines: [
          'He gave me the map. The Herald. So I’d bring you to the Gate. That was the price for Wren, the second time. I took it.',
          'Then I walked into Mara’s camp and put it on her table and told her everything, and she didn’t kill me, which I’m still thinking about.',
          'He wants you at that Gate. So do I. Only one of us is lying about why. I need you to believe it’s him.',
        ],
      },
      { when: { quest: 'gloam-the-gate', state: 'active' }, lines: ['There’s a drain where his map says there’s no drain. He doesn’t know about drains. People who own everything never do.'] },
      { when: { quest: 'gloam-the-cells', state: 'active' }, lines: ['Brennick’s lock. He taught me on one of these. I was eleven and he hit my knuckles every time I rushed it.', 'Hold the stair. Don’t talk to me. Don’t let anyone talk to me.'] },
      { when: { quest: 'gloam-out-of-the-cells', state: 'active' }, lines: ['Wren, stop talking. Wren. Wren, I love you, stop talking and walk.'] },
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['I don’t get to say sorry. I worked that out. I get to keep showing up. So: here I am.', 'Wren wants to be a lamp-keeper. A lamp-keeper. Our father would have laughed himself sick. I might let him.'] },
      { lines: ['Still here. Still lighting my lamp. Brin checks.'] },
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
          'You came. I knew you’d come. I kept saying it, so I’d keep knowing it. He didn’t like that.',
          'He kept me awake so the sigils would keep talking. Five of them, all at once, all the time. They’re very old and they all want something.',
          'I remember the inn. And the bell. I don’t remember the song Thessa taught me. I know there was one. That’s the strange part. I can feel where it was.',
        ],
      },
      { when: { quest: 'the-seventh-sigil', state: 'active' }, lines: ['Seven. All seven. I can feel them coming up the causeway with you, like weather.', 'Give them to me. I know what they’ll cost. I’ve been paying for a year; I know the prices.'] },
      { when: { quest: 'the-seventh-sigil', state: 'done' }, lines: ['I know you. I do. I know your face and how you stand and that you came for me in the dark. I can’t find your name. It was here a moment ago.', 'Don’t tell me again yet. Let me look for it. I want to find it myself.'] },
      { when: { quest: 'ysanes-last-echo', state: 'done' }, lines: ['You met her. The queen. I could feel it from here: the sigils all went quiet at once, like a room when someone important comes in.', 'She asked to be let go, didn’t she. I would have.'] },
      { when: { quest: 'wood-the-children', state: 'done' }, lines: ['Orren wrote. He says you brought two children home through the snow, and they were three hundred years late.', 'I keep thinking about their father. Out in the snow looking for a star. He found one. That was the trouble.'] },
      { lines: ['Brin makes me drink something every hour. It tastes like lamp-oil. I think it might be lamp-oil.', 'Sit on this side. I can see you better on this side.'] },
    ],
  },
  wren: {
    id: 'wren',
    name: 'Wren',
    title: 'Nyx’s brother',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['You’re the one she talks about. She talks about you like you’re weather. Big, unavoidable, probably wet.', 'I’m going to keep lamps. Brin says I can. Nyx says over her dead body. I think that means yes.'] },
      { when: { quest: 'thread-wren', state: 'offered' }, lines: ['Brin says I can have a hook. Nyx says over her dead body. Will you walk the causeway with me tonight? Before she finds out?'] },
      { when: { quest: 'thread-wren', state: 'done' }, lines: ['Lamp-keeper Wren. Say it again. No, say it the way Brin says it, like it’s a real thing.', 'Nyx cried. Don’t tell her I saw.'] },
      { lines: ['Two years in a cell. You know what I missed? Soup. Not freedom, not sky. Soup. Brin makes very good soup.'] },
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
      { who: 'nyx-at-the-lock', text: 'Brennick’s lock. Of course it is. Give me a minute. Give me a long minute.' },
      { who: 'cael', text: 'Stair’s narrow. Good. Narrow is how you hold a thing.' },
    ],
    waves: [
      { enemies: ['hollow-sentinel', 'border-reaver', 'border-reaver'], from: ['gate-n', 'gate-w'] },
      { enemies: ['hollow-sentinel', 'hollow-sentinel', 'pale-acolyte', 'pale-acolyte', 'marsh-light'], from: ['gate-n', 'gate-e'], barks: [{ who: 'orren', text: 'They’re Vaelmoor’s gate-guards. They don’t know the Gate fell. Lantern up, Cael, let them see it.' }] },
      { enemies: ['hollow-sentinel', 'hollow-sentinel', 'border-reaver', 'border-reaver', 'tear-wraith'], from: ['gate-n', 'gate-w', 'gate-e'], barks: [{ who: 'nyx-at-the-lock', text: 'Almost. Almost — don’t look at me, it makes my hands shake —' }] },
    ],
    end: [{ who: 'nyx-at-the-lock', text: 'Got it. Got it. Oh, Brennick, you old bastard, I got it.' }],
    retry: [{ who: 'nyx-at-the-lock', text: 'I lost the pins. Start again. I can start again. I’m good at starting again.' }],
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
      { who: 'elyra-freed', text: 'I can walk. I can. Don’t carry me. If you carry me I’ll never stop being carried.' },
      { who: 'wren', text: 'Is that Nyx? That’s Nyx. Nyx, you look terrible. Is this a rescue? Are we being rescued?' },
    ],
    waves: [
      { enemies: ['border-reaver', 'border-reaver', 'marsh-light', 'marsh-light'], from: ['gate-w', 'gate-e'] },
      { enemies: ['hollow-sentinel', 'border-reaver', 'gloam-lurker', 'gloam-lurker'], from: ['gate-n', 'gate-w'], barks: [{ who: 'elyra-freed', text: 'The lamps. I can see the lamps. Somebody lit the lamps.' }] },
    ],
    end: [
      { who: 'elyra-freed', text: 'It’s warm. The glass is warm. I forgot glass could be warm.' },
      { who: 'nyx', text: 'Wren. Wren, look at me. You’re out. We’re out. Now stop talking.' },
    ],
    retry: [{ who: 'nyx', text: 'Back to the drain! Again! We go again!' }],
  },
};
