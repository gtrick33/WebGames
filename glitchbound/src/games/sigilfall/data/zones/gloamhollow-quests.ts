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
 * DIALOGUE_STYLE.md.
 */
export const GLOAMHOLLOW_QUESTS: QuestDef[] = [
  /* ------------------------------------------------------- the lamp road */
  {
    id: 'gloam-the-lamp-road',
    name: 'The Lamp Road',
    giver: 'nyx-returned',
    auto: true,
    text: 'Elyra is a prisoner in the cells under the Gloam Gate. The Herald keeps her five sigils in the Gate’s vault. Nyx’s map shows the way there, north from the Shattered Vale and across the glass of the Riftscar Wastes. On the way is Lastlight, a village of lamp-keepers who keep the road to the Gate lit. Take the north road out of the Shattered Vale and find their head keeper, Brin.',
    objective: { kind: 'talk', npc: 'lamp-keeper-brin', label: 'Talk to Lamp-keeper Brin in Lastlight' },
    after: ['the-long-night-ends'],
    // it is how the hero hears of Gloamhollow: it starts with the map in hand, not on arrival
    level: 44,
    reward: { xp: 1500, gold: 420, text: 'Brin hears why you have come. She gives each of you a lamp, Nyx too. On her road, everyone carries a light.' },
  },
  {
    id: 'gloam-the-unlit-mile',
    name: 'The Unlit Mile',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'For three hundred years, Lastlight has kept lamps burning on the road from the village to the Gloam Gate. This month, marsh-lights have been putting them out. These drifting fires lean on a lamp until it dies, then lure travelers off the road and into the water. Snuff out six marsh-lights on the road and in Wisp Glen.',
    objective: { kind: 'kill', region: 'riftscar', count: 6, enemies: ['marsh-light'], label: 'Snuff out marsh-lights on the road and in Wisp Glen' },
    after: ['gloam-the-lamp-road'],
    zone: 'riftscar',
    level: 44,
    reward: { xp: 1600, gold: 430, text: 'Brin follows you and relights every lamp. From the last one you can see the Gloam Gate to the north. One window in it glows violet.' },
  },
  {
    id: 'gloam-nyx-confesses',
    name: 'The Price of the Map',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'Nyx has hardly spoken since you reached Lastlight. She is sitting at the end of the jetty with her lamp out. Talk to her before you go up to the Gate.',
    objective: { kind: 'talk', npc: 'nyx-lastlight', label: 'Talk to Nyx on Lastlight’s jetty' },
    after: ['gloam-the-unlit-mile'],
    zone: 'riftscar',
    level: 46,
    reward: { xp: 1500, gold: 300, text: 'Nyx lights her lamp again. She will take you into the Gate by a way the Herald doesn’t know about, not through the front where his Gatewarden waits. “We bring Elyra and Wren out together,” she says.' },
  },
  {
    id: 'gloam-the-gate',
    name: 'The Eighth Warden',
    giver: 'nyx-lastlight',
    auto: true,
    text: 'The Gloam Gate stands at the north end of the lamp road. It is the second of the Three Gates, and the Host has held it for thirty years. Cael and Orren have caught up with you from Highwall. Go up to the Gate with Nyx and find a way in under the gatehouse.',
    objective: { kind: 'explore', spot: 'the-gloam-gate', label: 'Go up to the Gloam Gate with Nyx' },
    after: ['gloam-nyx-confesses'],
    zone: 'riftscar',
    level: 46,
    reward: { xp: 1700, gold: 460, text: 'Nyx finds a drain that isn’t on the Herald’s map. It runs under the gatehouse to a stair and a locked door. Nyx knows the lock. Brennick, the man who taught her to pick locks, made it.' },
  },
  {
    id: 'gloam-the-cells',
    name: 'The Cells',
    giver: 'nyx-lastlight',
    auto: true,
    text: 'The drain leads to a locked door at the bottom of a stair under the gatehouse. Nyx needs time to pick the lock, and the Gate’s guards are already coming down the stair. Hold the stair with Cael and Orren while Nyx works.',
    objective: { kind: 'event', event: 'gloam-cells', label: 'Hold the cell stair while Nyx picks the lock' },
    after: ['gloam-the-gate'],
    zone: 'riftscar',
    level: 47,
    reward: { xp: 2400, gold: 560, text: 'The lock opens. Behind the door is a row of cells, and in one of them sits Elyra. She is thin and pale, but she is alive. Nyx’s brother Wren is in the next cell.' },
  },
  {
    id: 'gloam-out-of-the-cells',
    name: 'Out of the Dark',
    giver: 'nyx-lastlight',
    auto: true,
    text: 'Elyra is free, but she can barely walk. Wren is weak too. Every guard in the Gate is coming down to the cells. Lead them both out through the drain and down the road to the first lit lamp, where Brin’s keepers are waiting.',
    objective: { kind: 'event', event: 'gloam-out', label: 'Lead Elyra and Wren down the road to the lamps' },
    after: ['gloam-the-cells'],
    zone: 'riftscar',
    level: 47,
    reward: { xp: 2600, gold: 600, text: 'At the first lamp, Elyra sits down on the glass and cries. Brin wraps her in a blanket and takes her and Wren back to Lastlight.' },
  },
  {
    id: 'the-gatewarden',
    name: 'The Gatewarden',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'Elyra and Wren are safe in Lastlight. Elyra’s sigils are still in the Gate’s vault, and the Gatewarden, a giant in black armor, guards the gateway in front of them. While he stands in the gateway, the Gate’s runes heal him. Go back up the road and defeat him.',
    objective: { kind: 'kill', region: 'riftscar', count: 1, enemies: ['the-gatewarden'], label: 'Defeat the Gatewarden at the Gloam Gate' },
    after: ['gloam-out-of-the-cells'],
    zone: 'riftscar',
    level: 48,
    reward: {
      xp: 5600,
      gold: 1300,
      item: 'gatewardens-rune-plate',
      text: 'The Gatewarden falls, and the violet light in the Gate’s window goes out. Brin’s keepers come up the road behind you and hang their lamps on the Gate. For the first time in thirty years, the Gloam Gate is out of the Host’s hands.',
    },
  },
  {
    id: 'the-gloam-gate',
    name: 'The Second Gate',
    giver: 'lamp-keeper-brin',
    auto: true,
    text: 'The Gloam Gate is ours. Elyra is wrapped in blankets by Brin’s fire in Lastlight, with Nyx and Wren beside her. Go and sit with her.',
    objective: { kind: 'talk', npc: 'elyra-lastlight', label: 'Sit with Elyra by Lastlight’s fire' },
    after: ['the-gatewarden'],
    zone: 'riftscar',
    level: 48,
    reward: {
      xp: 3200,
      gold: 700,
      item: { rarity: 'epic' },
      perk: 'sigil-veil',
      text: 'Brin brings the five sigils from the Gate’s vault: Embers, Sun, Thorns, Frost and the Veil. Elyra holds them, and her light comes back. “Five,” she says. “The Sigil of Tides is somewhere in Vaelmoor. I can feel it. And Vosk still has the Stone.” The road north through the Gloam Gate into Vaelmoor is open.',
    },
  },

  /* ------------------------------------------------- postgame: Wren's fate */
  {
    id: 'thread-wren',
    name: 'Wren’s First Night',
    giver: 'wren',
    text: 'Wren has become one of Lastlight’s lamp-keepers. Tonight is his first night as a keeper on the road to the Gate. Walk the road with him and snuff out twelve marsh-lights before they put out his lamps.',
    objective: { kind: 'kill', region: 'riftscar', count: 12, enemies: ['marsh-light'], label: 'Snuff out marsh-lights on Wren’s road' },
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
    objective: { kind: 'explore', spot: 'the-black-pool', label: 'Search the Black Pool west of Lastlight' },
    after: ['gloam-the-lamp-road'],
    zone: 'riftscar',
    level: 45,
    reward: { xp: 700, gold: 430, text: 'At the edge of the pool, Tam’s lamp hangs on a hook, still warm. Gloam lurkers move in the reeds. Something under the water is singing in a woman’s voice.' },
  },
  {
    id: 'gloam-lurkers',
    name: 'Lurkers in the Reeds',
    giver: 'widow-marrow',
    text: 'Gloam lurkers hide in the reeds around the Black Pool and attack anyone the marsh-lights lead there. Marrow wants to go to the pool herself. Defeat eight gloam lurkers around the Black Pool so she can get there safely.',
    objective: { kind: 'kill', region: 'riftscar', count: 8, enemies: ['gloam-lurker'], label: 'Defeat gloam lurkers around the Black Pool' },
    after: ['the-black-pool'],
    zone: 'riftscar',
    level: 45,
    reward: { xp: 750, gold: 450 },
  },
  {
    id: 'the-drowned-mother',
    name: 'The Drowned Mother',
    giver: 'widow-marrow',
    text: 'The singing voice is the Drowned Mother. Three hundred years ago, Lastlight’s first lamp-keeper walked into the Black Pool after her lost child and drowned. The Ash Crown’s grieflight woke her, and now she lures people into the water, as she lured Tam. Go to the Black Pool and lay her to rest.',
    objective: { kind: 'kill', region: 'riftscar', count: 1, enemies: ['the-drowned-mother'], label: 'Lay the Drowned Mother to rest at the Black Pool' },
    after: ['gloam-lurkers'],
    zone: 'riftscar',
    level: 46,
    reward: { xp: 1100, gold: 620, item: 'tams-lamp', text: 'Marrow lights Tam’s lamp in her window for one night. In the morning she gives it to you, and sends all her lamp-oil to light the road to the Gate.' },
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
      { when: { quest: 'gloam-the-unlit-mile', state: 'active' }, lines: ['There’s a lamp every fifty paces from my door to the Gate. My grandmother lit them, and her grandmother before her.', 'The marsh-lights lean on them until they go out. Snuff out six, and I’ll relight the lamps behind you.'] },
      { when: { quest: 'gloam-nyx-confesses', state: 'active' }, lines: ['Nyx is sitting at the end of my jetty with her lamp out. Something is wrong with her.', 'Go and talk to her before you go up to the Gate.'] },
      { when: { quest: 'the-gatewarden', state: 'active' }, lines: ['Elyra is asleep by my fire. Wren is eating everything in the house.', 'The Gatewarden still holds the Gate, and Elyra’s sigils are in the vault behind him. Go and defeat him.'] },
      { when: { quest: 'the-gloam-gate', state: 'active' }, lines: ['Elyra is awake. She’s weak, but she asked for you.', 'Go and sit with her by the fire.'] },
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
      { when: { quest: 'gloam-lurkers', state: 'active' }, lines: ['That’s Tam’s lamp. A year in the reeds, and it’s still warm.', 'I want to go to that pool myself. Clear the lurkers away so I can.'] },
      { when: { quest: 'the-drowned-mother', state: 'active' }, lines: ['The singer is Lastlight’s first lamp-keeper. She drowned looking for her own child, and now she takes other people’s.', 'Lay her to rest, so she can’t take anyone else.'] },
      { when: { quest: 'the-drowned-mother', state: 'done' }, lines: ['I lit Tam’s lamp in my window last night. Now I’ve sent all my oil to light the road to the Gate.'] },
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
      {
        when: { quest: 'gloam-nyx-confesses', state: 'active' },
        lines: [
          'At Highwall I told you the Herald offered me Wren if I brought you to him. I didn’t tell you that I said yes.',
          'Then I walked into Mara’s camp and told her it was a trap. I meant it. But part of me still wants his deal.',
          'If he puts Wren in front of me, I’m scared of what I’ll do. Now you know.',
          'I’ll walk in front, where you can see me.',
        ],
      },
      { when: { quest: 'gloam-the-gate', state: 'active' }, lines: ['His map doesn’t show the drains. One of them runs under the gatehouse.', 'We go in that way, not through the front where his Gatewarden waits.'] },
      { when: { quest: 'gloam-the-cells', state: 'active' }, lines: ['Brennick made this lock. He’s the man who taught me to pick locks, and this is the hardest kind.', 'I need time. Hold the stair and keep the guards away from me.'] },
      { when: { quest: 'gloam-out-of-the-cells', state: 'active' }, lines: ['Wren, I’ve got you. Stay behind me and keep walking.'] },
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['I told Elyra I was sorry. It doesn’t fix what I did, so I’m staying to help.', 'Wren wants to become a lamp-keeper here. I think I’ll let him.'] },
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
          'You came. I knew you would. I kept telling myself that in the dark.',
          'The Herald needs me alive. He never told me why.',
          'I remember the inn, and the bell, and you. I can’t remember Thessa’s face anymore.',
        ],
      },
      { when: { quest: 'the-seventh-sigil', state: 'active' }, lines: ['Vosk is dead, but you didn’t bring the Stone. I can feel it to the north, high up and cold.', 'It’s on the Hallow King’s brow. He has set it in his crown.'] },
      { when: { quest: 'the-seventh-sigil', state: 'done' }, lines: ['I know your face, and I know you came for me in the dark. But I can’t find your name.', 'Don’t tell me yet. I want to find it myself.', 'The Stone is in the King’s crown. When it comes loose, I’ll be there to catch it.'] },
      { when: { quest: 'ysanes-last-echo', state: 'done' }, lines: ['You met Queen Ysane. I felt it from here. All the sigils went quiet at once.', 'She asked her husband to let her go, didn’t she?'] },
      { when: { quest: 'wood-the-children', state: 'done' }, lines: ['Orren wrote to me about the King’s children in the snow.', 'Their father sat up all winter between their beds. Then he broke his crown to bring them back.'] },
      { lines: ['I want to go north with you. Brin says I’m too weak to walk that far yet.', 'Go on without me. I’ll catch up when I can.'] },
    ],
  },
  wren: {
    id: 'wren',
    name: 'Wren',
    title: 'Nyx’s brother',
    sprite: 'villager',
    talk: [
      { when: { quest: 'the-gloam-gate', state: 'done' }, lines: ['You’re the one Nyx talks about. Thank you for coming for us.', 'I want to be a lamp-keeper. Brin says I can. Nyx hasn’t decided yet.'] },
      { when: { quest: 'thread-wren', state: 'offered' }, lines: ['Brin gave me a lamp-keeper’s hook. Tonight is my first night as a keeper.', 'Will you walk it with me? The marsh-lights will come for my lamps.'] },
      { when: { quest: 'thread-wren', state: 'done' }, lines: ['I’m a real lamp-keeper now. Brin said so.', 'Nyx cried when we came home. Don’t tell her I saw.'] },
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
