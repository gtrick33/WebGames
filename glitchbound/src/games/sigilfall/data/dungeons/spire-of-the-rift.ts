import type { BossDef } from '../bosses';
import type { EnemyDef, ItemDef, Marker } from '../types';
import type { DungeonModule } from '.';

/*
 * The Spire of the Tear (levels 56-59): see WORLD.md. The Pale Herald's tower in the Riftscar Wastes, a
 * spire of black glass that climbs through the Veil, floor by floor, each stranger than the last. The
 * hero comes in at the Spire's Foot and climbs: the Glass Threshold, the Hall of Mirrors (pillars of
 * black glass in rows), the Sentinel's Stair where the Veil Sentinel guards the way up, the Weightless
 * Gallery (the stones float there, and Ilvane the Unmoored with them), the Herald's Scriptorium (the letters he signed to every traitor),
 * the Halls Half-Through (things caught halfway out of the Veil), and the Crown of the Spire, open to
 * the Tear, where the Pale Herald keeps the Sigil of the Veil. The rooms seal while you fight in them
 * (their floors are the letters below). The Crown has no pillars: its floor is glass panes over the Tear,
 * and in the end the Herald drops them into it. A cracked wall in the Scriptorium hides his strongbox.
 */
const MAP = [
  '#######################################################################################################',
  '################.S.###################################################mmmmmmmmmmmmmmmmmmmmmmmmmmmm#####',
  '################...##################################################mmmmmmmmmmmmmmmmmmmmmmmmmmmmmm####',
  '#################Z##################################################mmmQmmmmmmmmmmmmmmmmmmmmmmmmQmmm###',
  '######iiiiiiiiiiiiiiiiiiiiii###########llllllllllllllllllll#########mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '#####iiiiiiiiiiiiiiiiiiiiiiii#########llllllllllllllllllllll########mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '####iiiiiiiixxiiiiiixxiiiiiiii#######llQlllllllllllllyllllQll#######mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '####iiiiniiiiiiiiiiiiiiiiniiii#######lllllllllyllllllllllllll#######mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '####iiiiiiiiiiiiiiiiiiiiiiiiii#######llllljlllllllllllljlllll#######mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '####iiiiiiiiiiiiiiiiiiiiiiiiiiD.....DllllllllllllllllllllllllD.....Dmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '####iixiiiiiiiiiiiiiiiiiiiiiiiD.....DllllllllllllllllllllllllD.....Dmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '####iiiiiiiiiiiiyiiiiiiiiiiiiiD.....DllllllllllllllllllllllllD.....DmmmmmmmmmmmmmmmmVmmmmmmmmmmmmmmm###',
  '####iiiiiiiyiiiiiiiiiiiiiiixii#######lllllllllllllyllllllllll#######mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '####iiiiiiiiiiiiiiiiiiiiiiiiii#######llllljlllllllllllljlllll#######mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '####iiiiniiiiiiiiiiiiiiiiniiii#######llllllllylllllllllllllll#######mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '####iiiiiiiiiiiiiiiiiiiiiiiiii#######llQllllllllllllllllllQll#######mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '#####iiiiiiiiiiiiiiiiiiiiiiii#########llllllllllllllllllllll########mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '######iiiiiiiiiiiiiiiiiiiiii###########llllllllllllllllllll#########mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '########################DDD#########################################mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm###',
  '########################...#########################################mmmQmmmmmmmmmmmmmmmmmmmmmmmmQmmm###',
  '########################...##########################################mmmmmmmmmmmmmmmmmmmmmmmmmmmmmm####',
  '########################...###########################################mmmmmmmmmmmmmmmmmmmmmmmmmmmm#####',
  '########################...############################################################################',
  '########################DDD#########################eeeeeeeeeeeeeeeeeeeeeeeeeeee#######################',
  '######################gggggggggggggggggggg#########eeeeeeeeeeeeeeeeeeeeeeeeeeeeee######################',
  '#####################gggggggggggggggggggggg#######eeeQeeeeeeeeeeeeeeeeeeeeeeeeQeee#####################',
  '####################gggggggggggggggggggggggg######eeeeeeeeeeeeeeeeeeeeyeeeeeeeeeee#####################',
  '####################gggggggggggjgggggggggggg######eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee#####################',
  '####################ggggggjgggggggggggjggggg######eeeeeeeejeeeeeeeeeeeeeejeeeeeeee#####################',
  '####################ggggggggggggggggggggggggD....Deeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee#####################',
  '####################ggggggggggWgggygggggggggD....Deeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee#####################',
  '####################gggQgggggggggggggggggQggD....DeeeeeeeeeeeeeeeeOeeeeeeeeeeeeeee#####################',
  '####################ggggggggggggjggggggggggg######eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee#####################',
  '####################gggggggggggggggggggggggg######eeeeeyeeeeeeeeeeeeeeeeeeeeeeeeee#####################',
  '####################gggggggjggggggggjggggggg######eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee#####################',
  '####################ggggyggggggggggggggggCgg######eeeeeeeeeeeeyeeeeeeeeeeeeeeeeeee#####################',
  '#####################gggggggggggggggggggggg#######eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee#####################',
  '######################gggggggggggggggggggg########eeeeeeeejeeeeeeeeeeeeeejeeeeeeee#####################',
  '##################################################eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee#####################',
  '##################################################eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee#####################',
  '##################################################eeeQeeeeeeeeeeeeeeeeeeeeeeeeQeee#####################',
  '###################################################eeeeeeeeeeeeeeeeeeeeeeeeeeeeee######################',
  '####################################################eeeeeeeeeeeeeeeeeeeeeeeeeeee#######################',
  '########################################################DDD############################################',
  '########################################################...############################################',
  '########################################################...############################################',
  '########################################################...############################################',
  '########################################################DDD############################################',
  '######aaaaaaaaaaaaaaaaaaaa###########cccccccccccccccccccccccc##########################################',
  '#####aaaaaaaaaaaaaaaaaaaaaa#########cccccccccccccccccccccccccc#########################################',
  '####aaQaaaaaaaaaaaaaaaaaaQaa#######cccccccccccccccccccccccccccc########################################',
  '####aaaaaaaaaaayaaaaaaaaaaaa#######ccccjcccjcccjcccjcccjcccjccc########################################',
  '####aaaaaaaaaaaaaaaaaaaaaaaa#######cccccccccccccccccccccccccccc########################################',
  '####aaaaaaajaaaaaaaajaaaaaaa#######cccccccccccccccccccccccccccc########################################',
  '####aaaaaaaaaaaaaaaaaaaaaaaaD.....DccQcccccccccccccccyccccccQcc########################################',
  '####aaaayaaaaaaaaaaaaaaaaaaaD.....Dccccccccccyccccccccccccccccc########################################',
  '####aaaaaaaaaaaaaaaaaaaaaaaaD.....Dcccccccccccccccccccccccccccc########################################',
  '####aaaaaaajaaaaaaaajaaaaaaa#######cccccccccccccccccccccccccccc########################################',
  '####aaaaaaaaaaaaaaaaaaayaaaa#######ccccjcccjcccjcccjcccjcccjccc########################################',
  '####aaQaaaaaaaaaaaaaaaaaaQaa#######cccccccccccccccccccccccccccc########################################',
  '#####aaaaaaaaaaaaaaaaaaaaaa#########cccccccccccccccccccccccccc#########################################',
  '######aaaaaaaaaaaaaaaaaaaa###########cccccccccccccccccccccccc##########################################',
  '#############DDD#######################################################################################',
  '#############...#######################################################################################',
  '#############...#######################################################################################',
  '#############...#######################################################################################',
  '#############...#######################################################################################',
  '##########...........##################################################################################',
  '#########.............#################################################################################',
  '########..Q.........Q..################################################################################',
  '########...............################################################################################',
  '########.......P.......################################################################################',
  '########...........y...################################################################################',
  '########...y...........################################################################################',
  '#########.............#################################################################################',
  '##########...........##################################################################################',
  '##############XX#######################################################################################',
  '#######################################################################################################',
];

const markers: Record<string, Marker> = {
  P: { kind: 'start' },
  X: { kind: 'exit', to: 'riftscar', label: 'Back down to the Riftscar' },
  C: { kind: 'chest', id: 'spire-chest', tier: 'rare' },
  S: { kind: 'chest', id: 'spire-strongbox', tier: 'epic', once: true },
  O: { kind: 'boss', boss: 'veil-sentinel' },
  V: { kind: 'boss', boss: 'herald-in-the-spire' },
  // the Weightless Gallery: Ilvane the Unmoored (sim/patterns/spire-of-the-rift.ts)
  W: { kind: 'boss', boss: 'ilvane-the-unmoored' },
  x: { kind: 'prop', prop: 'crate', solid: true },
  n: { kind: 'prop', prop: 'lamp', solid: true },
  y: { kind: 'prop', prop: 'bones' },
};

/* ------------------------------------------------------------------ enemies */

const RIFT = '#ff3fd2';
const VEIL = '#9af0ff';

const foes: Record<string, EnemyDef> = {
  'spire-lancer': {
    id: 'spire-lancer',
    name: 'Veilglass Lancer',
    sprite: 'spire-lancer',
    ai: 'ranged',
    hp: 50,
    dmg: 16,
    speed: 42,
    radius: 6,
    mass: 1.2,
    xp: 15,
    gold: [4, 9],
    aggro: 180,
    reach: 175,
    windup: 1,
    recover: 0.6,
    attackCd: 2.6,
    keep: 130,
    armor: 0.2,
    shot: { speed: 260, radius: 3, count: 1, spread: 0, color: VEIL, lead: 0.8, look: 'bolt', status: { status: 'chill', dur: 1.4, power: 0.35 } },
    resist: { arcane: 0.4, poison: 0.3 },
    blurb: 'A soldier of the Herald’s guard in armor of black glass, a lance of grieflightning in its fist. It throws where you are going, and the cold of the Veil clings to the wound: change direction when it draws back its arm.',
  },
  'spire-cantor': {
    id: 'spire-cantor',
    name: 'Cantor of the Herald',
    sprite: 'spire-cantor',
    ai: 'caster',
    hp: 64,
    dmg: 14,
    speed: 40,
    radius: 6,
    mass: 1,
    xp: 17,
    gold: [5, 11],
    aggro: 165,
    reach: 150,
    windup: 1,
    recover: 0.6,
    attackCd: 2.8,
    keep: 115,
    heals: 0.22,
    slam: { radius: 28 },
    shot: { speed: 80, radius: 4, count: 1, spread: 0, color: '#e8d8ff', homing: 1.1 },
    resist: { arcane: 0.5 },
    blurb: 'Pale-masked singers who carry the Herald’s voice from floor to floor. Their hymn knits the wounded back together and opens the Veil under your feet. Silence them first.',
  },
  'spire-halfborn': {
    id: 'spire-halfborn',
    name: 'Halfborn',
    sprite: 'spire-halfborn',
    ai: 'diver',
    hp: 52,
    dmg: 17,
    speed: 70,
    radius: 6,
    mass: 1.2,
    xp: 15,
    gold: [3, 8],
    aggro: 170,
    reach: 135,
    windup: 0.65,
    recover: 0.8,
    attackCd: 2.2,
    keep: 80,
    floats: true,
    rush: { speed: 320, dist: 150 },
    regen: 0.05,
    resist: { arcane: 0.4 },
    blurb: 'Something caught halfway through the Veil: claws and glass from the waist up, grieflight below. It hangs back, then pounces the length of a marked line. Its wounds close in the Veil if you leave it be: finish what you start.',
  },
  'spire-anchor': {
    id: 'spire-anchor',
    name: 'Tear Anchor',
    sprite: 'spire-anchor',
    ai: 'caster',
    hp: 150,
    dmg: 14,
    speed: 0,
    radius: 8,
    mass: 99,
    xp: 20,
    gold: [5, 12],
    aggro: 200,
    reach: 165,
    windup: 1.1,
    recover: 0.8,
    attackCd: 3.2,
    armor: 0.4,
    slam: { radius: 34 },
    summons: { enemy: 'spire-mote', count: 2, max: 3, cd: 8 },
    resist: { arcane: 0.5, poison: 0.6 },
    blurb: 'A spike of Veil-crystal driven through the floor to hold the Spire in the Tear. It cannot move, but it calls motes of the Tear out of the air and opens the floor under you. Break it, and the motes stop coming.',
  },
  'spire-mote': {
    id: 'spire-mote',
    name: 'Tear Mote',
    sprite: 'spire-mote',
    ai: 'exploder',
    hp: 24,
    dmg: 15,
    speed: 82,
    radius: 5,
    mass: 0.6,
    xp: 6,
    gold: [1, 3],
    aggro: 170,
    reach: 22,
    windup: 0.7,
    recover: 0.4,
    attackCd: 1,
    floats: true,
    burst: { radius: 28, pool: 0, color: RIFT },
    resist: { arcane: 0.6, poison: 0.6 },
    blurb: 'A spark of the Tear that drifted through. It flies at anything warm, swells with light and bursts. Kill it before it gets there, or get out of the circle.',
  },
  'spire-echo': {
    id: 'spire-echo',
    name: 'Echo of the Herald',
    sprite: 'spire-echo',
    ai: 'caster',
    hp: 70,
    dmg: 10,
    speed: 0,
    radius: 8,
    mass: 99,
    xp: 0,
    gold: [0, 0],
    aggro: 400,
    reach: 0,
    windup: 1,
    recover: 1,
    attackCd: 999,
    floats: true,
    burst: { radius: 30, pool: 0, color: RIFT, onDeath: true },
    resist: { poison: 0.6 },
    blurb: 'A shape of the Pale Herald in glass and light, left behind as he steps between the worlds. It throws his spells but has none of his strength: it shatters at a touch, and bursts as it breaks. The Herald himself carries the Sigil of the Veil.',
  },
};

/* ------------------------------------------------------------------ bosses */

/** The Herald's lances of pale light. */
const LANCES = { fan: 3, spread: 0.5, wind: 0.7, interval: 0.35, speed: 240, r: 3.5, mul: 0.9, look: 'bolt', color: '#e8d8ff', len: 170, lead: 0.4, sfx: 'riftShot' };

const bosses: Record<string, BossDef> = {
  'veil-sentinel': {
    id: 'veil-sentinel',
    name: 'The Veil Sentinel',
    title: 'Warden of the Stair',
    sprite: 'veil-sentinel',
    hp: 4600,
    dmg: 37,
    radius: 14,
    xp: 885,
    gold: [210, 290],
    phases: [
      {
        at: 1,
        speed: 34,
        rest: [0.6, 1],
        patterns: [
          // a beam from its core that glances off the first wall (or pillar) it meets
          { id: 'spire:prism', w: 3, cd: 5, p: { wind: 1, width: 16, len: 520, bounces: 1, beams: 1, mul: 1.5 } },
          // its arms of black glass
          { id: 'cleave', w: 3, cd: 3.5, p: { r: 58, arc: 0.9, wind: 0.75, lunge: 14, mul: 1.35 } },
          { id: 'chop', w: 2, cd: 5, p: { len: 150, width: 24, wind: 0.85, mul: 1.6 } },
          // the Tear turned inward: everything is pulled toward it, then crushed
          { id: 'spire:gravity', w: 2, cd: 11, p: { time: 2.2, pull: 36, reach: 240, r: 66, mul: 1.8 } },
          // down a clear lane; into a wall or a pillar, and it is dazed
          { id: 'charge', w: 1, cd: 8, p: { wind: 0.9, speed: 280, len: 300, mul: 1.4, stun: 1.6 } },
          { id: 'summon', w: 1, cd: 16, p: { enemies: ['rift-shardling', 'rift-shardling'] } },
        ],
      },
      {
        at: 0.5,
        banner: 'Its glass cracks, and the Veil pours through its core!',
        speed: 40,
        rest: [0.45, 0.8],
        enter: [
          { id: 'roar', w: 1, cd: 0 },
          { id: 'spire:gravity', w: 1, cd: 10, p: { time: 2.4, pull: 40, reach: 260, r: 70, mul: 1.9, wave: 1.2 } },
        ],
        patterns: [
          // two beams now, glancing twice
          { id: 'spire:prism', w: 3, cd: 4.5, p: { wind: 0.9, width: 16, len: 640, bounces: 2, beams: 2, spread: 0.6, mul: 1.5 } },
          { id: 'cleave', w: 2, cd: 3, p: { swings: 2, r: 58, arc: 0.9, wind: 0.65, gap: 0.14, lunge: 16, mul: 1.3 } },
          // and the crush sends a shockwave rolling out across the stair
          { id: 'spire:gravity', w: 2, cd: 10, p: { time: 2.2, pull: 40, reach: 260, r: 70, mul: 1.9, wave: 1.2 } },
          // rings of grieflight bursting out from its core, every other one
          { id: 'spell:pulse', w: 2, cd: 8, p: { color: '#c58cff', type: 'arcane', rings: 5, band: 30, mul: 1 } },
          // prism lines cut across the stair through the hero
          { id: 'spell:crossfire', w: 1, cd: 9, p: { color: '#9affff', type: 'arcane', lines: 3, twice: 0, width: 14, mul: 1.05 } },
          { id: 'charge', w: 1, cd: 7, p: { count: 2, wind: 0.8, speed: 300, len: 300, mul: 1.4, stun: 1.4 } },
          { id: 'summon', w: 1, cd: 18, p: { enemies: ['spire-mote', 'spire-mote', 'rift-shardling'] } },
        ],
      },
    ],
    first: { any: ['sentinel-gravity-core'] },
    drops: {
      items: {
        any: ['sentinel-gravity-core', 'prismglass-band', 'veilstep-treads', 'static-band'],
        warrior: ['bulwark-of-dawn', 'whirling-greaves'],
        mage: ['twin-flame-circlet', 'stormcaller-rod'],
        ranger: ['huntmasters-hood', 'trappers-satchel'],
        paladin: ['sunward-shield', 'dawnbreaker'],
        priest: ['psalter-of-dawn', 'choirstaff'],
        warlock: ['codex-of-hunger', 'blightcaller'],
        druid: ['thicket-idol', 'moonwhisper'],
        gloamknight: ['lantern-of-the-last-watch', 'vesper-edge'],
      },
      chance: [0.3, 0.45, 0.65],
    },
    intro: 'A construct of black glass older than the Spire, with a heart of grieflight crystal where its face should be. It was made to guard the stair, and the Herald taught it whom to let pass.',
  },
  'ilvane-the-unmoored': {
    id: 'ilvane-the-unmoored',
    name: 'Ilvane the Unmoored',
    title: 'Keeper of the Weightless Gallery',
    sprite: 'ilvane-the-unmoored',
    hp: 6000,
    dmg: 44,
    radius: 11,
    xp: 1500,
    gold: [210, 290],
    phases: [
      {
        at: 1,
        speed: 40,
        rest: [0.7, 1.05],
        patterns: [
          // falling stars, one after another toward the hero
          { id: 'spell:meteors', w: 3, cd: 5, p: { color: '#c8b8ff', type: 'arcane', count: 7, gap: 0.18, rr: 18, mul: 0.95 } },
          // a wheel of stars turning round her and flung outward
          { id: 'spell:orbit', w: 2, cd: 8, p: { look: 'holy', color: '#c8b8ff', type: 'arcane', count: 8, time: 3, grow: 30, mul: 0.85 } },
          // the astrolabe-staff swung
          { id: 'cleave', w: 2, cd: 3.5, p: { r: 52, arc: 1.05, wind: 0.7, lunge: 18, mul: 1.35 } },
          // she drifts out of the world and back in
          { id: 'spell:blink', w: 1, cd: 8, p: { color: '#c8b8ff', rr: 30 } },
          // the gallery lets go of the floor
          { id: 'spire:unmoor', w: 3, cd: 13, p: { time: 6, stones: 7, warn: 1.1, mul: 1.1 } },
        ],
      },
      {
        at: 0.5,
        banner: 'Ilvane spreads her arms: “Up! All of it! Let nothing touch the floor again!”',
        speed: 46,
        rest: [0.5, 0.85],
        enter: [
          { id: 'roar', w: 1, cd: 0 },
          { id: 'spire:unmoor', w: 1, cd: 11, p: { time: 7, stones: 10, warn: 1, mul: 1.15, fling: 1.3 } },
        ],
        patterns: [
          // falling stars, one after another toward the hero
          { id: 'spell:meteors', w: 3, cd: 4.5, p: { color: '#c8b8ff', type: 'arcane', count: 7, gap: 0.18, rr: 18, mul: 0.95 } },
          // a wheel of stars turning round her and flung outward
          { id: 'spell:orbit', w: 2, cd: 7, p: { look: 'holy', color: '#c8b8ff', type: 'arcane', count: 8, time: 3, grow: 30, mul: 0.85 } },
          // the spokes of her star-chart, turning
          { id: 'spell:vortex', w: 2, cd: 8, p: { color: '#c8b8ff', type: 'arcane', arms: 3, time: 2.6, spin: 1 } },
          { id: 'cleave', w: 2, cd: 3, p: { swings: 2, r: 52, arc: 1.05, wind: 0.6, gap: 0.14, lunge: 20, mul: 1.3 } },
          // she drifts out of the world and back in
          { id: 'spell:blink', w: 1, cd: 7, p: { color: '#c8b8ff', rr: 30 } },
          // now she flings the drifting stones at the hero while they float
          { id: 'spire:unmoor', w: 3, cd: 11, p: { time: 7, stones: 10, warn: 1, mul: 1.15, fling: 1.3 } },
        ],
      },
    ],
    first: { any: ['veilstep-treads'] },
    drops: {
      items: {
        any: ['veilstep-treads', 'prismglass-band', 'sentinel-gravity-core', 'static-band', 'second-wind-ring'],
        warrior: ['bulwark-of-dawn'],
        mage: ['twin-flame-circlet'],
        ranger: ['huntmasters-hood'],
        paladin: ['sunward-shield'],
        priest: ['psalter-of-dawn'],
        warlock: ['codex-of-hunger'],
        druid: ['thicket-idol'],
        gloamknight: ['lantern-of-the-last-watch'],
      },
      chance: [0.3, 0.5, 0.7],
    },
    intro: 'She charted the stars from this gallery for forty years. When the Herald opened the Veil above it, she looked up, and forgot which way was down.',
  },
  'herald-in-the-spire': {
    id: 'herald-in-the-spire',
    name: 'The Pale Herald',
    title: 'Voice of the Hallow King',
    sprite: 'herald-in-the-spire',
    hp: 8600,
    dmg: 31,
    radius: 12,
    xp: 1770,
    gold: [300, 420],
    floats: true,
    phases: [
      {
        at: 1,
        speed: 40,
        rest: [0.6, 1],
        patterns: [
          { id: 'volley', w: 3, cd: 4, p: { ...LANCES, shots: 2 } },
          // tears in the Veil: each pulls you toward it, spits grieflight, and bursts as it closes
          { id: 'spire:tear', w: 3, cd: 9, p: { count: 2, life: 7, pull: 20, reach: 120 } },
          // two arms of the Tear turning about him
          { id: 'spell:vortex', w: 2, cd: 9, p: { color: '#ff3fd2', type: 'arcane', arms: 2, time: 3, spin: 1.2 } },
          // small tears in the Veil set round the hero: they open when you come near
          { id: 'spell:mines', w: 2, cd: 7, p: { color: '#22e4ff', type: 'arcane', count: 5, spread: 72, fuse: 3, blast: 34, mul: 1.05 } },
          // he steps out of the world and back in behind you
          { id: 'spell:blink', w: 1, cd: 8, p: { color: '#e8d8ff', behind: 1, rr: 32 } },
          // lances of grieflight from the edges of the Crown
          { id: 'spell:lances', w: 1, cd: 10, p: { color: '#ff3fd2', type: 'arcane', count: 5, width: 14, mul: 1.05 } },
        ],
      },
      {
        at: 0.7,
        banner: '“You came all this way to find me? Then find me.” The Herald steps out of the world.',
        speed: 44,
        rest: [0.5, 0.9],
        enter: [{ id: 'spire:echoes', w: 1, cd: 18, p: { count: 3, time: 9 } }],
        patterns: [
          // echoes of him step out of the Veil and cast with him: only the one with the Sigil is him
          { id: 'spire:echoes', w: 2, cd: 18, p: { count: 3, time: 9 } },
          { id: 'spire:tear', w: 3, cd: 9, p: { count: 2, life: 7, pull: 22, reach: 120 } },
          { id: 'volley', w: 2, cd: 4, p: { ...LANCES, shots: 3 } },
          // a pane of glass flung at the hero, shattering
          { id: 'spell:split', w: 2, cd: 7, p: { look: 'rift', color: '#e8d8ff', type: 'arcane', count: 12, small: 115, mul: 0.75 } },
          // rings of the Tear rolling out from him, a gap in each
          { id: 'spell:ring', w: 1, cd: 9, p: { look: 'rift', color: '#ff3fd2', type: 'arcane', count: 18, gap: 3, waves: 3, speed: 95, mul: 0.8 } },
          // he steps out of the world and back in behind you
          { id: 'spell:blink', w: 1, cd: 8, p: { color: '#e8d8ff', behind: 1, rr: 32 } },
        ],
      },
      {
        at: 0.4,
        banner: 'The Herald strikes the floor with his staff, and the Crown begins to fall into the Tear!',
        speed: 44,
        rest: [0.45, 0.8],
        enter: [{ id: 'spire:sunder', w: 1, cd: 8, p: { count: 3, wind: 1.8, life: 7 } }],
        patterns: [
          // panes of the floor crack and fall into the Tear, and come back a while later
          { id: 'spire:sunder', w: 3, cd: 8, p: { count: 3, wind: 1.6, life: 7 } },
          { id: 'spire:tear', w: 2, cd: 9, p: { count: 2, life: 6, pull: 32, reach: 130 } },
          { id: 'spire:echoes', w: 1, cd: 20, p: { count: 3, time: 8 } },
          // two arms of the Tear turning about him
          { id: 'spell:vortex', w: 2, cd: 9, p: { color: '#ff3fd2', type: 'arcane', arms: 2, time: 3, spin: 1.2 } },
          { id: 'volley', w: 2, cd: 4, p: { ...LANCES, shots: 3 } },
          // lances of grieflight from the edges of the Crown
          { id: 'spell:lances', w: 1, cd: 10, p: { color: '#ff3fd2', type: 'arcane', count: 5, width: 14, mul: 1.05 } },
        ],
      },
      {
        at: 0.15,
        banner: '“If I fall, the Spire falls with me!” The Tear itself opens over the Crown.',
        speed: 48,
        rest: [0.35, 0.6],
        enter: [
          // the great tear in the middle of the Crown: it pulls at the whole room until the end
          { id: 'spire:tear', w: 1, cd: 8, p: { center: 1, count: 1, life: 90, pull: 18, reach: 900, every: 1.8, r: 44 } },
          { id: 'spire:sunder', w: 1, cd: 6, p: { count: 4, wind: 1.6, life: 5 } },
        ],
        patterns: [
          { id: 'spire:sunder', w: 3, cd: 6, p: { count: 4, wind: 1.5, life: 5 } },
          { id: 'spire:tear', w: 2, cd: 8, p: { count: 2, life: 5, pull: 28, reach: 120 } },
          // two arms of the Tear turning about him
          { id: 'spell:vortex', w: 2, cd: 8, p: { color: '#ff3fd2', type: 'arcane', arms: 2, time: 3, spin: 1.2 } },
          { id: 'volley', w: 2, cd: 3.5, p: { ...LANCES, shots: 3, wind: 0.6 } },
          // rings of the Tear rolling out from him, a gap in each
          { id: 'spell:ring', w: 1, cd: 8, p: { look: 'rift', color: '#ff3fd2', type: 'arcane', count: 18, gap: 3, waves: 3, speed: 95, mul: 0.8 } },
        ],
      },
    ],
    first: { any: ['mantle-of-the-pale-herald'] },
    drops: {
      items: {
        any: ['mantle-of-the-pale-herald', 'echo-of-the-herald', 'sentinel-gravity-core', 'prismglass-band', 'veilstep-treads', 'riftwalker-mantle', 'amulet-of-echoes'],
        warrior: ['quakehammer', 'whirling-greaves'],
        mage: ['heart-of-the-inferno', 'stormcaller-rod'],
        ranger: ['galeheart-bow', 'trappers-satchel'],
        paladin: ['oathsworn-blade', 'dawnbreaker'],
        priest: ['twilight-scepter', 'choirstaff'],
        warlock: ['contagion', 'blightcaller'],
        druid: ['first-oak-acorn', 'moonwhisper'],
        gloamknight: ['gravesong', 'vesper-edge'],
      },
      chance: [0.35, 0.6, 1],
    },
    intro: 'Vaelor’s voice: the gold behind every traitor, the name signed under every letter. He has fed the Tear from this spire since the old war, and he walks in and out of it like a man stepping through a door.',
  },
};

/* ------------------------------------------------------------------ items */

const items: ItemDef[] = [
  {
    id: 'sentinel-gravity-core',
    name: 'Gravity Core',
    slot: 'relic',
    rarity: 'epic',
    icon: 'relic',
    tint: '#7a4ac8',
    stats: [
      { stat: 'arcane', base: 5, per: 0.9 },
      { stat: 'hp', base: 10, per: 2.4 },
    ],
    mods: [
      {
        t: 'proc',
        proc: {
          id: 'sentinel-gravity-core',
          on: 'hit',
          chance: 0.12,
          icd: 5,
          effect: { kind: 'pull', radius: 72, force: 170 },
          text: 'Your hits have a 12% chance to turn the Tear inward where they land: enemies nearby are pulled together (at most once every 5 s).',
        },
      },
    ],
    lore: 'The Veil Sentinel’s heart, still turning. Hold it up and the dust in the air leans toward it.',
    minLevel: 55,
    special: true,
  },
  {
    id: 'prismglass-band',
    name: 'Prismglass Band',
    slot: 'ring',
    rarity: 'rare',
    icon: 'ring',
    tint: VEIL,
    stats: [
      { stat: 'crit', base: 2, per: 0.25 },
      { stat: 'power', base: 3, per: 0.6 },
    ],
    mods: [
      {
        t: 'proc',
        proc: {
          id: 'prismglass-band',
          on: 'crit',
          chance: 1,
          icd: 1.5,
          effect: { kind: 'chain', jumps: 2, range: 80, mul: 0.5, dmgType: 'arcane' },
          text: 'Your critical hits split like light through a prism: a beam leaps to 2 more enemies nearby for half the damage (at most once every 1.5 s).',
        },
      },
    ],
    lore: 'Cut from the Sentinel’s glass. Look through it and every lamp in the room is three lamps.',
    minLevel: 55,
    special: true,
  },
  {
    id: 'veilstep-treads',
    name: 'Veilstep Treads',
    slot: 'feet',
    rarity: 'epic',
    icon: 'boots',
    tint: '#3e2460',
    mat: 'leather',
    stats: [
      { stat: 'hp', base: 10, per: 2.4 },
      { stat: 'armor', base: 3, per: 0.7 },
      { stat: 'speed', base: 2, per: 0.12 },
    ],
    mods: [
      {
        t: 'proc',
        proc: {
          id: 'veilstep-treads',
          on: 'dodge',
          chance: 1,
          icd: 6,
          effect: { kind: 'buff', buff: { id: 'between-worlds', name: 'Between Worlds', dur: 2, dr: 35, color: '#c896ff' } },
          text: 'Your dodge steps half through the Veil: for 2 s after it you take 35% less damage (at most once every 6 s).',
        },
      },
    ],
    lore: 'The Herald’s cantors walk the Spire in these, and the floor never quite knows they are there.',
    minLevel: 55,
    special: true,
  },
  {
    id: 'mantle-of-the-pale-herald',
    name: 'Mantle of the Pale Herald',
    slot: 'chest',
    rarity: 'legendary',
    icon: 'robe',
    tint: '#e8e0f4',
    mat: 'cloth',
    stats: [
      { stat: 'power', base: 6, per: 1 },
      { stat: 'hp', base: 12, per: 3 },
      { stat: 'arcane', base: 4, per: 0.6 },
    ],
    mods: [
      { t: 'stat', stat: 'haste', v: 12, when: 'lowHp' },
      {
        t: 'proc',
        proc: {
          id: 'mantle-of-the-pale-herald',
          on: 'hurt',
          chance: 1,
          icd: 12,
          effect: { kind: 'shield', pct: 15, dur: 4 },
          text: 'When you are struck, an echo of you steps in front of the next blows: a shield of 15% of your health for 4 s (at most once every 12 s).',
        },
      },
    ],
    lore: 'Pale as the Herald’s mask, and lighter than it should be: half of it is still on the other side of the Veil.',
    minLevel: 55,
    special: true,
  },
  {
    id: 'echo-of-the-herald',
    name: 'Echo of the Herald',
    slot: 'amulet',
    rarity: 'legendary',
    icon: 'amulet',
    tint: RIFT,
    stats: [
      { stat: 'power', base: 5, per: 0.9 },
      { stat: 'ultCharge', base: 6, per: 0.3 },
    ],
    mods: [
      {
        t: 'proc',
        proc: {
          id: 'echo-of-the-herald',
          on: 'hit',
          chance: 0.2,
          icd: 1.2,
          effect: { kind: 'riftBurst', radius: 34, mul: 1.2, delay: 0.6 },
          text: 'Your hits have a 20% chance to echo: 0.6 s later the Tear strikes the same spot again (at most once every 1.2 s).',
        },
      },
    ],
    lore: 'A shard of one of his echoes, still trying to finish the spell it began.',
    minLevel: 55,
    special: true,
  },
];

export const SPIRE_OF_THE_RIFT: DungeonModule = {
  region: {
    id: 'spire-of-the-rift',
    name: 'The Spire of the Tear',
    subtitle: 'The Pale Herald’s tower through the Veil',
    theme: 'riftspire',
    kind: 'dungeon',
    level: 55,
    levels: [55, 56],
    at: [20, -44],
    dark: true,
    safe: false,
    music: 'riftscar',
    map: MAP,
    markers,
    encounters: [
      {
        id: 'threshold',
        floor: 'a',
        title: 'The Glass Threshold',
        waves: [
          { enemies: ['spire-lancer', 'rift-stalker', 'rift-stalker', 'spire-halfborn'] },
          { enemies: ['spire-cantor', 'shard-golem', 'spire-lancer'] },
          { enemies: ['spire-halfborn', 'rift-stalker', 'spire-lancer'], elite: true },
        ],
      },
      {
        id: 'mirrors',
        floor: 'c',
        title: 'The Hall of Mirrors',
        checkpoint: true,
        waves: [
          { enemies: ['spire-halfborn', 'spire-halfborn', 'rift-shardling', 'rift-shardling', 'spire-lancer'] },
          { enemies: ['spire-anchor', 'spire-lancer', 'spire-cantor'] },
          { enemies: ['shard-golem', 'spire-cantor', 'rift-stalker'], elite: true },
        ],
      },
      { id: 'stair', floor: 'e', waves: [], boss: 'veil-sentinel', checkpoint: true, title: 'The Sentinel’s Stair' },
      { id: 'gallery', floor: 'g', waves: [], boss: 'ilvane-the-unmoored', checkpoint: true, title: 'The Weightless Gallery' },
      {
        id: 'scriptorium',
        floor: 'i',
        title: 'The Herald’s Scriptorium',
        checkpoint: true,
        waves: [
          { enemies: ['voidcaller', 'voidcaller', 'spire-cantor', 'rift-stalker'] },
          { enemies: ['spire-lancer', 'spire-lancer', 'shard-golem', 'spire-halfborn'] },
          { enemies: ['spire-cantor', 'voidcaller', 'spire-halfborn'], elite: true },
        ],
      },
      {
        id: 'halfthrough',
        floor: 'l',
        title: 'The Halls Half-Through',
        waves: [
          { enemies: ['spire-halfborn', 'spire-halfborn', 'spire-halfborn', 'rift-stalker'] },
          { enemies: ['spire-anchor', 'shard-golem', 'spire-lancer', 'spire-cantor'] },
          { enemies: ['shard-golem', 'spire-halfborn', 'spire-lancer', 'spire-cantor'], elite: true },
        ],
      },
      { id: 'crown', floor: 'm', waves: [], boss: 'herald-in-the-spire', checkpoint: true, title: 'The Crown of the Spire' },
    ],
    blurb: 'A tower of black glass that climbs through the Veil: the Sentinel on its stair, and at its crown the Pale Herald, who keeps the Sigil of the Veil.',
  },
  bosses,
  foes,
  items,
};
