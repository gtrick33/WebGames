import { after, all, during, until } from './cond';
import type { SceneDef } from '../sim/scene';

/**
 * The main story's staging, land by land (STORY_BIBLE.md v3): every step of the main story opens on a scene of its
 * own, every land's chain closes on one, and every sigil the hero wins shows Elyra (and the player) what it saw, as a
 * vision. Built from sim/scene.ts's steps; the people and places named are the lands' own.
 */
export const STORY_SCENES: SceneDef[] = [
  /* ================================================================ Prologue */
  {
    // the morning after the crypt: Elyra in the square, the iron warm in her, and the first vision: the star
    id: 'vision-embers',
    region: 'briarhollow',
    when: all(after('close-the-rift'), until('the-empty-tomb')),
    near: 'briar-square',
    r: 240,
    steps: [
      { look: 'elyra' },
      { say: 'elyra', line: 'When I touched it, it was warm. Like a hand. And then I saw something.' },
      { music: 'chapel' },
      { fade: 'out', secs: 0.9 },
      { vision: 'A thousand years ago, a star fell on the border of two kingdoms.', tint: 'ember' },
      { look: 'briar-square' },
      { ghost: 'vision-king-aster', as: 'marshal-dunmore', at: 'briar-square', dx: -2, face: 1 },
      { ghost: 'vision-king-vaelmoor', as: 'old-gaius', at: 'briar-square', dx: 2, face: -1 },
      { fade: 'in', secs: 0.9 },
      { fx: 'thunder', at: 'briar-square', color: '#ffd88a', size: 40 },
      { wait: 1.4 },
      { fx: 'blast', at: 'briar-square', color: '#ffb070', size: 34 },
      { vision: 'It broke in two as it fell. Each king took his half home and made a crown of it.', tint: 'ember' },
      { say: 'vision-king-aster', line: 'Half for Aster. While it is worn, the dead stay dead.' },
      { say: 'vision-king-vaelmoor', line: 'And half for Vaelmoor. We shall keep the same promise.' },
      { wait: 0.8 },
      { fade: 'out', secs: 0.8 },
      { vision: '' },
      { look: 'elyra' },
      { fade: 'in', secs: 0.8 },
      { say: 'elyra', line: 'Half of it fell on us. I felt it land. And somebody wants it back.' },
      { look: 'hero' },
    ],
  },
  {
    // the Whisperwood at dawn: violet eyes in the trees, and the alpha's roar from the east
    id: 'wood-the-trail',
    region: 'whisperwood',
    when: during('into-the-wood'),
    r: 9999,
    steps: [
      { title: 'The Whisperwood', sub: 'North of Briarhollow' },
      { wait: 1.2 },
      { say: 'mara', line: 'Look at their eyes. Every beast in this wood has the chapel’s light in it.' },
      { sfx: 'roar' },
      { shake: 3 },
      { say: 'mara', line: 'And that’s the one leading them. East. Thin them out on the way, and we take its head.' },
    ],
  },

  /* ================================================================ Act I: Brackenridge Hills */
  {
    // Fernstead at sunset: a candle in every window, and the Warden waiting at the well
    id: 'fern-candles',
    region: 'brackenridge',
    when: during('west-road'),
    near: 'fern-square',
    r: 260,
    steps: [
      { title: 'Fernstead', sub: 'The Brackenridge Hills' },
      { look: 'fern-square' },
      { wait: 1.4 },
      { say: 'warden-hollis', line: 'You came by the west road, and before dark. Good. Nobody uses the hill roads after the candles now.' },
      { emote: 'warden-hollis', icon: 'dots' },
      { say: 'warden-hollis', line: 'One candle in every window, for every soul the barrows took. So they can find their way home.' },
      { look: 'hero' },
      { say: 'warden-hollis', line: 'Lately they’ve been finding it.' },
    ],
  },
  {
    // the Old Barrows: grieflight rising out of the mounds like smoke, the dead sitting up
    id: 'fern-the-barrows',
    region: 'brackenridge',
    when: during('the-old-barrows'),
    near: 'old-barrows',
    r: 170,
    steps: [
      { look: 'old-barrows' },
      { music: 'crypt' },
      { fx: 'summon', at: 'old-barrows', color: '#b48cff', size: 44 },
      { sfx: 'soul' },
      { shake: 2 },
      { wait: 1.6 },
      { say: 'elyra', line: 'That light. It’s the same as under the chapel.' },
      { say: 'elyra', line: 'And the iron in me is warm again. Something here remembers it.' },
      { look: 'hero' },
    ],
  },
  {
    // Alsa has sung the song: Elyra at the inn, saying what Thessa taught her
    id: 'fern-the-song',
    region: 'brackenridge',
    when: all(after('the-widows-song'), until('lay-the-grey-lady')),
    near: 'mother-alsa',
    r: 140,
    steps: [
      { look: 'mother-alsa' },
      { say: 'mother-alsa', line: 'My gran sang it to me in my cot. I never knew it was a widow’s song.' },
      { emote: 'elyra', icon: 'dots' },
      { say: 'elyra', line: 'Thessa says grief is the strongest thing in the world.' },
      { say: 'elyra', line: 'Somebody has learned to spend it.' },
      { look: 'hero' },
    ],
  },
  {
    // at the barrows again: the song, and Elyra hearing the name in it
    id: 'fern-the-lady-sings',
    region: 'brackenridge',
    when: during('lay-the-grey-lady'),
    near: 'old-barrows',
    r: 150,
    steps: [{ look: 'old-barrows' }, { sfx: 'soul' }, { wait: 1.2 }, { say: 'elyra', line: 'Listen. She’s singing his name. Over and over, like a door she keeps knocking on.' }, { look: 'hero' }],
  },
  {
    // the Lady at rest, and the question she left
    id: 'fern-at-rest',
    region: 'brackenridge',
    when: all(after('lay-the-grey-lady'), until('the-harvest-stones')),
    near: 'old-barrows',
    r: 220,
    steps: [
      { look: 'old-barrows' },
      { fx: 'heal', at: 'old-barrows', color: '#ffd88a' },
      { wait: 1 },
      { say: 'elyra', line: 'She wasn’t angry. She was only tired of waiting for him.' },
      { say: 'elyra', line: '“He promised me Edric.” Who promises a dead woman her dead husband?' },
      { look: 'hero' },
    ],
  },
  {
    // the stones lit: Hollis sends her rangers
    id: 'fern-the-stones-lit',
    region: 'brackenridge',
    when: all(after('the-harvest-stones'), until('camp-scouts')),
    near: 'fern-stones',
    r: 220,
    steps: [
      { look: 'fern-stones' },
      { fx: 'buff', at: 'fern-stones', color: '#ffd88a' },
      { wait: 1.2 },
      { say: 'warden-hollis', line: 'Six of my best leave for Briarhollow tonight. Tell Maren the hills are watching the road for her now.' },
      { look: 'hero' },
    ],
  },
  /* ================================================================ Act I: Thornvale */
  {
    // Millbrook: the Reeve on his side of his own bridge
    id: 'mill-arrival',
    region: 'thornvale',
    when: during('south-road'),
    near: 'reeve-aldous',
    r: 220,
    steps: [
      { title: 'Millbrook', sub: 'Thornvale' },
      { look: 'mill-pond' },
      { wait: 1.2 },
      { say: 'reeve-aldous', line: 'That’s my grain, on the far side of my own bridge. They charge us a cart to fetch our own sacks.' },
      { look: 'hero' },
    ],
  },
  {
    // Kettle Farm: the ashes, and orders on a dead man
    id: 'mill-kettle',
    region: 'thornvale',
    when: during('kettle-farm'),
    near: 'east-farm',
    r: 150,
    steps: [
      { look: 'east-farm' },
      { wait: 1 },
      { say: 'mara', line: 'They burned it with the dog still chained in the yard. Bandits don’t waste a dog. Somebody wanted it seen.' },
      { emote: 'mara', icon: 'question' },
      { say: 'mara', line: 'Here, in this one’s coat. Writing. Not any writing I know.' },
      { look: 'hero' },
    ],
  },
  {
    // Nyx, where she shouldn't be, reading what nobody honest can
    id: 'mill-nyx',
    region: 'thornvale',
    when: during('thieves-cant'),
    near: 'nyx',
    r: 140,
    steps: [
      { look: 'nyx' },
      { title: 'Nyx', sub: 'Reads everything, for a fee' },
      { say: 'nyx', line: 'Thieves’ cant, but posh. Somebody taught bandits to write like a clerk.' },
      { say: 'nyx', line: '“Hunt the bell-chapels. Bring me the warm iron.” No name. Grey ink.' },
      { emote: 'nyx', icon: 'alert' },
      { say: 'nyx', line: 'You lot are in trouble. That’ll be two silver.' },
      { look: 'hero' },
    ],
  },
  {
    // Harlan dead: his blades dig in at the mill
    id: 'mill-after-harlan',
    region: 'thornvale',
    when: all(after('the-bandit-king'), until('mill-the-bridge')),
    near: 'sefa',
    r: 200,
    steps: [
      { look: 'mill-pond' },
      { say: 'sefa', line: 'With Harlan dead, his blades dug in at the mill. Last stand, they think.' },
      { say: 'sefa', line: 'Millbrook’s lads are with me. Are you?' },
      { look: 'hero' },
    ],
  },
  {
    // the barricade burned, the wheel turning: carts for the camp, and grey coins for Maren
    id: 'mill-the-wheel',
    region: 'thornvale',
    when: all(after('mill-the-bridge'), until('hollow-gold')),
    near: 'reeve-aldous',
    r: 220,
    steps: [
      { look: 'mill-pond' },
      { fx: 'blast', at: 'mill-pond', color: '#ff8a3a', size: 30 },
      { wait: 1.2 },
      { say: 'reeve-aldous', line: 'Twelve carts to Briarhollow. And Tobin’s hens on top, he insists.' },
      { say: 'mara', line: 'And Harlan’s grey coins to Maren. They weigh nothing. That isn’t right.' },
      { look: 'hero' },
    ],
  },

  /* ================================================================ Act I: The Amberfield */
  {
    // Hearthstead: the walled village, and wagons that come in emptier every week
    id: 'hearth-arrival',
    region: 'amberfield',
    when: during('refugees-on-the-road'),
    near: 'marshal-dunmore',
    r: 240,
    steps: [
      { title: 'Hearthstead', sub: 'The Amberfield Steppes' },
      { look: 'hearth-gate' },
      { wait: 1.2 },
      { say: 'marshal-dunmore', line: 'Wagons come in from the east with fewer people every week. The ones who arrive don’t talk about the road.' },
      { look: 'hero' },
    ],
  },
  {
    // the burned caravan: someone small under the last wagon
    id: 'hearth-the-caravan',
    region: 'amberfield',
    when: during('the-broken-caravan'),
    near: 'broken-caravan',
    r: 150,
    steps: [{ look: 'broken-caravan' }, { wait: 1.2 }, { say: 'elyra', line: 'Listen. Somebody’s under that wagon. Small, and being very quiet.' }, { look: 'hero' }],
  },
  {
    // the outriders, and the captain on the ridge who never comes down
    id: 'hearth-the-captain',
    region: 'amberfield',
    when: during('riders-in-the-grass'),
    near: 'marshal-dunmore',
    r: 240,
    steps: [
      { sfx: 'warhorn' },
      { look: 'hearth-gate' },
      { wait: 1 },
      { say: 'marshal-dunmore', line: 'Their captain sits up on the ridges past my gate and watches. Vosk, the refugees call him.' },
      { say: 'marshal-dunmore', line: 'He counts our walls, not our swords. That’s a man planning a siege.' },
      { look: 'hero' },
    ],
  },
  {
    // the Clan Stones remember the star: and Elyra feels the sigil under Hearthstead wake
    id: 'hearth-the-stones',
    region: 'amberfield',
    when: during('the-clan-stones'),
    near: 'clan-stones',
    r: 160,
    steps: [
      { look: 'clan-stones' },
      { music: 'chapel' },
      { vision: 'The clans’ oldest stone remembers a night the sky broke in two.', tint: 'sun' },
      { fx: 'thunder', at: 'clan-stones', color: '#ffd88a', size: 34 },
      { wait: 1.6 },
      { vision: '' },
      { emote: 'elyra', icon: 'alert' },
      { say: 'elyra', line: 'Something under Hearthstead just woke up. Something warm. I can feel it from here.' },
      { look: 'hero' },
    ],
  },
  {
    // the empty shrine: a sigil under the hearthstone all these years, and a glimpse of it before it's gone
    id: 'hearth-the-sigil-gone',
    region: 'amberfield',
    when: during('hearth-the-shrine'),
    near: 'hearth-shrine',
    r: 120,
    steps: [
      { look: 'hearth-shrine' },
      { say: 'elyra', line: 'It was here. A sigil, under their hearthstone, all this time. It’s still warm.' },
      { music: 'chapel' },
      { fade: 'out', secs: 0.7 },
      { vision: 'For a moment it shows her what it saw: two crowns forged from one star…', tint: 'ember' },
      { ghost: 'vision-smith-aster', as: 'marshal-dunmore', at: 'hearth-shrine', dx: -1.5, face: 1 },
      { ghost: 'vision-smith-vaelmoor', as: 'old-gaius', at: 'hearth-shrine', dx: 1.5, face: -1 },
      { fade: 'in', secs: 0.7 },
      { fx: 'summon', at: 'hearth-shrine', color: '#ffb070', size: 32 },
      { wait: 1.6 },
      { fade: 'out', secs: 0.4 },
      { vision: '' },
      { fade: 'in', secs: 0.6 },
      { say: 'elyra', line: '…and then it’s gone. He took it before I could hold it.' },
      { look: 'hero' },
    ],
  },
  {
    // Vosk's dropped orders read: someone in the Crown City is paying for the Host's roads
    id: 'hearth-the-orders',
    region: 'amberfield',
    when: all(after('orders-from-the-north'), until('camp-riders')),
    near: 'old-gaius',
    r: 160,
    steps: [
      { look: 'old-gaius' },
      { say: 'old-gaius', line: '“The roads are paid for.” Somebody in your Crown City is selling the King’s Road by the mile.' },
      { say: 'mara', line: 'Then we go and ask who.' },
      { look: 'hero' },
    ],
  },
];
