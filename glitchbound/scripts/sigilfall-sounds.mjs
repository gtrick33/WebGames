#!/usr/bin/env node
/*
 * Builds Sigilfall's sound files from the packs they come from, by hand when the choices change (the files ship; the
 * packs stay out of the repository). Where each is from, and under what license, is in
 * src/games/sigilfall/CREDITS_AND_LICENSES.md.
 *
 * - ~/Downloads/rpg_sound_pack (or SIGILFALL_SOUNDS): RPG Sound Pack by artisticdude, CC0.
 * - ~/Downloads/sigilfall-audio/packs (or SIGILFALL_SOUNDS_MORE): the other effect packs, each unzipped in a folder of
 *   its own (paths below that start with '@/'): rubberduck's CC0 packs, Vehicle's CC0 fantasy libraries, StarNinjas'
 *   impacts, Kenney's interface sounds, a few single CC0 sounds, and the Fantasy Sound Effects Library by Little Robot
 *   Sound Factory (CC BY 3.0).
 * - ~/Downloads/sigilfall-audio/music (or SIGILFALL_MUSIC): the soundtrack, by Kevin MacLeod (incompetech.com), CC BY 4.0.
 * - assets/sigilfall/cc0 (or SIGILFALL_CC0; paths below that start with '%/'): the CC0 packs added for the small-AAA
 *   pass (POLISH_PLAN.md), each in a folder of its own: Kenney's Impact Sounds (kenney.nl), and from opengameart.org the
 *   RPG Male Adventurer voice clips (wolfwoot: oga-male/) and the RPG Voice Starter Pack (Cici Fyre: oga-female/).
 *
 * `--only <prefix>` builds just the sounds whose names start with it, into the folder as it is (nothing else is touched,
 * so a machine with only some of the packs can still add a sound): `node scripts/sigilfall-sounds.mjs --only step`.
 *
 * Each sound comes out mono and small (MP3, which every browser can decode), starting right on its first
 * moment, cut to length where it needs to be, and no louder on average than the rest, so a table of gains
 * (src/games/sigilfall/audio/samples.ts) can mix them. The music comes out stereo at 80 kbps, silence off both ends,
 * no longer than MUSIC_MAX with its end faded, and all at one loudness (quieter than the effects: it sits under them).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PACK = process.env.SIGILFALL_SOUNDS ?? join(homedir(), 'Downloads/rpg_sound_pack/RPG Sound Pack');
const MORE = process.env.SIGILFALL_SOUNDS_MORE ?? join(homedir(), 'Downloads/sigilfall-audio/packs');
const MUSIC = process.env.SIGILFALL_MUSIC ?? join(homedir(), 'Downloads/sigilfall-audio/music');
const CC0 = process.env.SIGILFALL_CC0 ?? 'assets/sigilfall/cc0';
/** Just the sounds whose names start with this (`--only <prefix>`), into the folder as it is. */
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const OUT = 'public/games/sigilfall/audio';
const MUSIC_OUT = 'public/games/sigilfall/music';
/** How loud a piece of music is overall (LUFS), and the longest one runs (seconds). */
const MUSIC_LOUDNESS = -23;
const MUSIC_MAX = 150;
/** How loud a loop of ambience is on average (dB): well under everything else. */
const AMBIENCE = -30;
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
/** How loud a sound is on average, at most (dB). */
const TARGET = -20;

/**
 * What ships: its name, the file it comes from, and how it is cut (`to`: seconds kept) or lifted (`boost`: dB); `kbps` and
 * `ar` make a small one smaller (a footstep needs no more than 40 kbps, a voice's grunt 32 kbps at 22 kHz).
 */
const FILES = {
  // the blade
  swing1: ['battle/swing.wav'],
  swing2: ['battle/swing2.wav'],
  swing3: ['battle/swing3.wav'],
  clash1: ['battle/sword-unsheathe.wav', { to: 0.32 }],
  clash2: ['battle/sword-unsheathe2.wav', { to: 0.32 }],
  clash3: ['battle/sword-unsheathe3.wav', { to: 0.32 }],
  clash4: ['battle/sword-unsheathe4.wav', { to: 0.32 }],
  clash5: ['battle/sword-unsheathe5.wav', { to: 0.32 }],
  // the hero's things
  armor: ['inventory/armor-light.wav'],
  chain1: ['inventory/chainmail1.wav'],
  chain2: ['inventory/chainmail2.wav'],
  bottle: ['inventory/bottle.wav'],
  bubble1: ['inventory/bubble.wav'],
  bubble2: ['inventory/bubble2.wav'],
  cloth: ['inventory/cloth.wav'],
  'cloth-heavy': ['inventory/cloth-heavy.wav'],
  coin1: ['inventory/coin.wav'],
  coin2: ['inventory/coin2.wav'],
  coin3: ['inventory/coin3.wav'],
  ring: ['inventory/metal-ringing.wav'],
  metal2: ['inventory/metal-small2.wav'],
  metal3: ['inventory/metal-small3.wav'],
  wood: ['inventory/wood-small.wav'],
  beads: ['inventory/beads.wav', { boost: 10 }],
  door: ['world/door.wav'],
  // the menus
  // those who fight
  giant1: ['NPC/giant/giant1.wav'],
  giant2: ['NPC/giant/giant2.wav'],
  giant3: ['NPC/giant/giant3.wav'],
  giant4: ['NPC/giant/giant4.wav'],
  giant5: ['NPC/giant/giant5.wav'],
  ogre1: ['NPC/ogre/ogre1.wav'],
  ogre2: ['NPC/ogre/ogre2.wav'],
  ogre3: ['NPC/ogre/ogre3.wav'],
  ogre4: ['NPC/ogre/ogre4.wav'],
  ogre5: ['NPC/ogre/ogre5.wav'],
  beast1: ['NPC/gutteral beast/mnstr1.wav'],
  beast2: ['NPC/gutteral beast/mnstr2.wav'],
  beast3: ['NPC/gutteral beast/mnstr3.wav'],
  beast4: ['NPC/gutteral beast/mnstr8.wav'],
  beast5: ['NPC/gutteral beast/mnstr12.wav'],
  beast6: ['NPC/gutteral beast/mnstr13.wav'],
  beast7: ['NPC/gutteral beast/mnstr15.wav'],
  wolf: ['NPC/misc/wolfman.wav'],
  shade1: ['NPC/shade/shade1.wav'],
  shade2: ['NPC/shade/shade2.wav'],
  shade3: ['NPC/shade/shade3.wav'],
  shade4: ['NPC/shade/shade14.wav'],
  shade5: ['NPC/shade/shade15.wav'],
  slime1: ['NPC/slime/slime1.wav'],
  slime2: ['NPC/slime/slime3.wav'],
  slime3: ['NPC/slime/slime5.wav'],
  slime4: ['NPC/slime/slime6.wav'],
  slime5: ['NPC/slime/slime10.wav'],
  bite1: ['NPC/beetle/bite-small.wav'],
  bite2: ['NPC/beetle/bite-small2.wav'],
  bite3: ['NPC/beetle/bite-small3.wav'],

  // ---- the other packs ('@/' is SIGILFALL_SOUNDS_MORE) ----
  // blows landing: on flesh and leather, on the hero, on metal, on a raised guard
  hit1: ['@/sfx_breaking_and_falling/bfh1_hit_05.ogg'],
  hit2: ['@/sfx_breaking_and_falling/bfh1_hit_09.ogg'],
  hit3: ['@/sfx_breaking_and_falling/bfh1_hit_10.ogg'],
  hit4: ['@/sfx_breaking_and_falling/bfh1_hit_11.ogg'],
  hit5: ['@/sfx_breaking_and_falling/bfh1_hit_13.ogg'],
  hit6: ['@/sfx_breaking_and_falling/bfh1_hit_08.ogg'],
  thud1: ['@/sfx_breaking_and_falling/bfh1_hit_03.ogg'],
  thud2: ['@/sfx_breaking_and_falling/bfh1_hit_04.ogg'],
  thud3: ['@/sfx_breaking_and_falling/bfh1_hit_07.ogg'],
  metalhit1: ['@/sfx_breaking_and_falling/bfh1_metal_hit_01.ogg'],
  metalhit2: ['@/sfx_breaking_and_falling/bfh1_metal_hit_03.ogg'],
  metalhit3: ['@/sfx_breaking_and_falling/bfh1_metal_hit_05.ogg'],
  metalhit4: ['@/sfx_breaking_and_falling/bfh1_metal_hit_06.ogg'],
  block1: ['@/impact_-_starninjas/impact.2.ogg'],
  block2: ['@/impact_-_starninjas/impact.6.ogg', { to: 0.6 }],
  block3: ['@/impact_-_starninjas/impact.10.ogg', { to: 0.6 }],
  steel1: ['@/tinysized/sfx-cc0/sword-clash-01.wav', { to: 0.7 }],
  steel2: ['@/tinysized/sfx-cc0/sword-clash-02.wav', { to: 0.7 }],
  steel3: ['@/tinysized/sfx-cc0/sword-clash-03.wav', { to: 0.7 }],
  steel4: ['@/tinysized/sfx-cc0/sword-clash-04.wav', { to: 0.7 }],
  // the ground: a slam, stones, rock breaking, a blast
  slam1: ['@/100-CC0-SFX_0/slam_01.ogg'],
  slam2: ['@/100-CC0-SFX_0/slam_02.ogg'],
  slam3: ['@/100-CC0-SFX_0/slam_07.ogg'],
  stones1: ['@/80-CC0-RPG-SFX_0/stones_01.ogg'],
  stones2: ['@/80-CC0-RPG-SFX_0/stones_02.ogg'],
  stones3: ['@/80-CC0-RPG-SFX_0/stones_03.ogg'],
  rock1: ['@/sfx_breaking_and_falling/bfh1_rock_breaking_01.ogg'],
  rock2: ['@/sfx_breaking_and_falling/bfh1_rock_breaking_02.ogg'],
  rock3: ['@/sfx_breaking_and_falling/bfh1_rock_falling_01.ogg'],
  boom: ['@/100-CC0-SFX_0/explosion.ogg'],
  // spells, by what they are made of
  fire1: ['@/80-CC0-RPG-SFX_0/spell_fire_01.ogg'],
  fire2: ['@/80-CC0-RPG-SFX_0/spell_fire_02.ogg'],
  fire3: ['@/80-CC0-RPG-SFX_0/spell_fire_05.ogg'],
  fire4: ['@/80-CC0-RPG-SFX_0/spell_fire_06.ogg'],
  fire5: ['@/80-CC0-RPG-SFX_0/spell_fire_07.ogg'],
  firebig1: ['@/80-CC0-RPG-SFX_0/spell_fire_03.ogg'],
  firebig2: ['@/80-CC0-RPG-SFX_0/spell_fire_04.ogg'],
  arc1: ['@/80-CC0-RPG-SFX_0/spell_01.ogg'],
  arc2: ['@/80-CC0-RPG-SFX_0/spell_02.ogg'],
  chime1: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Spell_00.wav', { to: 1.4 }],
  chime2: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Spell_01.wav'],
  conjure: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Spell_02.wav', { to: 1.8 }],
  riftcall: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Spell_03.wav', { to: 2.4 }],
  dark: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Spell_04.wav', { to: 1.6 }],
  frost: ['@/single/freeze.wav', { to: 1.4 }],
  shatter1: ['@/sfx_breaking_and_falling/bfh1_glass_breaking_01.ogg'],
  shatter2: ['@/sfx_breaking_and_falling/bfh1_glass_breaking_02.ogg'],
  zap1: ['@/tinysized/sfx-cc0/paralyzer-discharge-01.wav', { to: 0.55 }],
  zap2: ['@/tinysized/sfx-cc0/paralyzer-discharge-02.wav', { to: 0.6 }],
  thunder: ['@/sfx_100_v2/sfx100v2_thunder_01.ogg', { to: 2.4 }],
  cure1: ['@/single/cure/Cure4.wav'],
  cure2: ['@/single/cure/Cure5.wav', { to: 1.3 }],
  cure3: ['@/single/cure/Cure8.wav', { to: 1.3 }],
  teleport: ['@/single/teleport.wav', { to: 1 }],
  breath: ['@/single/ghostbreath.flac', { to: 1.6 }],
  // the air: a weapon drawn back, an arrow away
  whoosh1: ['@/tinysized/sfx-cc0/tube-plastic-whoosh-01.wav'],
  whoosh2: ['@/tinysized/sfx-cc0/tube-plastic-whoosh-02.wav'],
  whoosh3: ['@/tinysized/sfx-cc0/tin-whistle-whoosh-01.wav'],
  arrow1: ['@/weapons-apparel/sfx/arrow-feathers-01.wav'],
  arrow2: ['@/weapons-apparel/sfx/arrow-feathers-02.wav'],
  arrow3: ['@/weapons-apparel/sfx/arrow-feathers-03.wav'],
  // things found, things sprung
  gem1: ['@/80-CC0-RPG-SFX_0/item_gem_01.ogg'],
  gem2: ['@/80-CC0-RPG-SFX_0/item_gem_03.ogg'],
  gem3: ['@/80-CC0-RPG-SFX_0/item_gem_04.ogg'],
  trap1: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Trap_00.wav'],
  bag: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Inventory_Open_00.wav'],
  // great voices
  growl1: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Dragon_Growl_00.wav', { to: 2.2 }],
  growl2: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Dragon_Growl_01.wav', { to: 2.2 }],
  // a bell, a gong
  bell: ['@/100-CC0-SFX_0/bell_03.ogg'],
  gong: ['@/100-CC0-SFX_0/gong_01.ogg'],
  // the moments: a level, a quest, a boss down, a fall
  jingle: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Jingle_Achievement_00.wav'],
  // (the victory jingle's first phrase, for a quest done: it rings out instead of stopping dead at two seconds, which
  // sounded like the game cutting its own sound off every time a quest was finished)
  'win-short': ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Jingle_Win_00.wav', { to: 2, ring: 1.2 }],
  win: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Jingle_Win_00.wav', { to: 5.5 }],
  lose: ['@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Jingle_Lose_00.wav', { to: 4 }],
  // the menus
  'ui-click': ['@/kenney_interfaceSounds/Audio/click_001.ogg'],
  'ui-select': ['@/kenney_interfaceSounds/Audio/select_001.ogg'],
  'ui-open': ['@/kenney_interfaceSounds/Audio/open_001.ogg'],
  'ui-close': ['@/kenney_interfaceSounds/Audio/close_001.ogg'],
  'ui-confirm': ['@/kenney_interfaceSounds/Audio/confirmation_001.ogg'],
  'ui-error': ['@/kenney_interfaceSounds/Audio/error_004.ogg'],
  'ui-pluck': ['@/kenney_interfaceSounds/Audio/pluck_001.ogg'],
  'ui-bong': ['@/kenney_interfaceSounds/Audio/bong_001.ogg'],
  'ui-tick': ['@/kenney_interfaceSounds/Audio/tick_001.ogg'],
  // footsteps, by the ground underfoot (src/games/sigilfall/audio/steps.ts): grass and earth, stone, planks, snow, sand
  'step-grass1': ['%/kenney-impact-sounds/Audio/footstep_grass_000.ogg', { kbps: 40 }],
  'step-grass2': ['%/kenney-impact-sounds/Audio/footstep_grass_001.ogg', { kbps: 40 }],
  'step-grass3': ['%/kenney-impact-sounds/Audio/footstep_grass_002.ogg', { kbps: 40 }],
  'step-grass4': ['%/kenney-impact-sounds/Audio/footstep_grass_003.ogg', { kbps: 40 }],
  'step-stone1': ['%/kenney-impact-sounds/Audio/footstep_concrete_000.ogg', { kbps: 40 }],
  'step-stone2': ['%/kenney-impact-sounds/Audio/footstep_concrete_001.ogg', { kbps: 40 }],
  'step-stone3': ['%/kenney-impact-sounds/Audio/footstep_concrete_002.ogg', { kbps: 40 }],
  'step-stone4': ['%/kenney-impact-sounds/Audio/footstep_concrete_003.ogg', { kbps: 40 }],
  'step-wood1': ['%/kenney-impact-sounds/Audio/footstep_wood_000.ogg', { kbps: 40 }],
  'step-wood2': ['%/kenney-impact-sounds/Audio/footstep_wood_001.ogg', { kbps: 40 }],
  'step-wood3': ['%/kenney-impact-sounds/Audio/footstep_wood_002.ogg', { kbps: 40 }],
  'step-wood4': ['%/kenney-impact-sounds/Audio/footstep_wood_003.ogg', { kbps: 40 }],
  // voices (src/games/sigilfall/audio/voice.ts): a hero's efforts, cries and shouts, a man's and a woman's, and two more
  // women's for the companions. CC0: RPG Male Adventurer (wolfwoot), RPG Voice Starter Pack (Cici Fyre), opengameart.org
  'vo-m-attack0': ['%/oga-male/RPG Male Adventurer/attack0.wav', { kbps: 32, ar: 22050 }],
  'vo-m-attack1': ['%/oga-male/RPG Male Adventurer/attack1.wav', { kbps: 32, ar: 22050 }],
  'vo-m-attack2': ['%/oga-male/RPG Male Adventurer/attack2.wav', { kbps: 32, ar: 22050 }],
  'vo-m-attack3': ['%/oga-male/RPG Male Adventurer/attack3.wav', { kbps: 32, ar: 22050 }],
  'vo-m-attack4': ['%/oga-male/RPG Male Adventurer/attack4.wav', { kbps: 32, ar: 22050 }],
  'vo-m-attack5': ['%/oga-male/RPG Male Adventurer/attack5.wav', { kbps: 32, ar: 22050 }],
  'vo-m-big0': ['%/oga-male/RPG Male Adventurer/attackbig0.wav', { kbps: 32, ar: 22050 }],
  'vo-m-big1': ['%/oga-male/RPG Male Adventurer/attackbig1.wav', { kbps: 32, ar: 22050 }],
  'vo-m-big2': ['%/oga-male/RPG Male Adventurer/attackbig2.wav', { kbps: 32, ar: 22050 }],
  'vo-m-big3': ['%/oga-male/RPG Male Adventurer/attackbig3.wav', { kbps: 32, ar: 22050 }],
  'vo-m-hurt0': ['%/oga-male/RPG Male Adventurer/hurt0.wav', { kbps: 32, ar: 22050 }],
  'vo-m-hurt1': ['%/oga-male/RPG Male Adventurer/hurt1.wav', { kbps: 32, ar: 22050 }],
  'vo-m-hurt2': ['%/oga-male/RPG Male Adventurer/hurt2.wav', { kbps: 32, ar: 22050 }],
  'vo-m-hurt3': ['%/oga-male/RPG Male Adventurer/hurt3.wav', { kbps: 32, ar: 22050 }],
  'vo-m-hurt4': ['%/oga-male/RPG Male Adventurer/hurt4.wav', { kbps: 32, ar: 22050 }],
  'vo-m-death0': ['%/oga-male/RPG Male Adventurer/death0.wav', { kbps: 32, ar: 22050 }],
  'vo-m-death1': ['%/oga-male/RPG Male Adventurer/death1.wav', { kbps: 32, ar: 22050 }],
  'vo-m-jump0': ['%/oga-male/RPG Male Adventurer/jump0.wav', { kbps: 32, ar: 22050 }],
  'vo-m-jump1': ['%/oga-male/RPG Male Adventurer/jump1.wav', { kbps: 32, ar: 22050 }],
  'vo-m-victory0': ['%/oga-male/RPG Male Adventurer/victory0.wav', { kbps: 32, ar: 22050 }],
  'vo-m-victory1': ['%/oga-male/RPG Male Adventurer/victory1.wav', { kbps: 32, ar: 22050 }],
  'vo-f1-attack1': ['%/oga-female/RPG Voice Starter Pack/Type 1/attack1.wav', { kbps: 32, ar: 22050 }],
  'vo-f1-attack2': ['%/oga-female/RPG Voice Starter Pack/Type 1/attack2.wav', { kbps: 32, ar: 22050 }],
  'vo-f1-attack3': ['%/oga-female/RPG Voice Starter Pack/Type 1/attack3.wav', { kbps: 32, ar: 22050 }],
  'vo-f1-hurt1': ['%/oga-female/RPG Voice Starter Pack/Type 1/damaged1.wav', { kbps: 32, ar: 22050 }],
  'vo-f1-hurt2': ['%/oga-female/RPG Voice Starter Pack/Type 1/damaged2.wav', { kbps: 32, ar: 22050 }],
  'vo-f1-hurt3': ['%/oga-female/RPG Voice Starter Pack/Type 1/damaged3.wav', { kbps: 32, ar: 22050 }],
  'vo-f1-jump1': ['%/oga-female/RPG Voice Starter Pack/Type 1/jump1.wav', { kbps: 32, ar: 22050 }],
  'vo-f1-jump2': ['%/oga-female/RPG Voice Starter Pack/Type 1/jump2.wav', { kbps: 32, ar: 22050 }],
  'vo-f1-jump3': ['%/oga-female/RPG Voice Starter Pack/Type 1/jump3.wav', { kbps: 32, ar: 22050 }],
  'vo-f2-attack1': ['%/oga-female/RPG Voice Starter Pack/Type 2/attack1.wav', { kbps: 32, ar: 22050 }],
  'vo-f2-attack2': ['%/oga-female/RPG Voice Starter Pack/Type 2/attack2.wav', { kbps: 32, ar: 22050 }],
  'vo-f2-attack3': ['%/oga-female/RPG Voice Starter Pack/Type 2/attack3.wav', { kbps: 32, ar: 22050 }],
  'vo-f3-attack1': ['%/oga-female/RPG Voice Starter Pack/Type 3/attack1.wav', { kbps: 32, ar: 22050 }],
  'vo-f3-attack2': ['%/oga-female/RPG Voice Starter Pack/Type 3/attack2.wav', { kbps: 32, ar: 22050 }],
  'vo-f3-attack3': ['%/oga-female/RPG Voice Starter Pack/Type 3/attack3.wav', { kbps: 32, ar: 22050 }],
  'step-snow1': ['%/kenney-impact-sounds/Audio/footstep_snow_000.ogg', { kbps: 40 }],
  'step-snow2': ['%/kenney-impact-sounds/Audio/footstep_snow_001.ogg', { kbps: 40 }],
  'step-snow3': ['%/kenney-impact-sounds/Audio/footstep_snow_002.ogg', { kbps: 40 }],
  'step-snow4': ['%/kenney-impact-sounds/Audio/footstep_snow_003.ogg', { kbps: 40 }],
};

/** The air of a place, looping quietly under everything (src/games/sigilfall/audio/ambience.ts says where). */
const AMBIENCES = {
  cave: '@/Fantasy_Sound_Library/Fantasy Sound Library/Wav/Ambience_Cave_00.wav',
  forest: '@/single/Forest_Ambience.mp3',
  day: '@/single/amb_morning_0.ogg',
  wind: '@/single/wind.ogg',
  water: '@/sfx_100_v2/sfx100v2_loop_water_02.ogg',
};

/** The soundtrack (src/games/sigilfall/audio/tracks.ts says who plays what): Kevin MacLeod's pieces, by title. */
const TRACKS = {
  title: 'Ascending the Vale',
  village: 'Suonatore di Liuto',
  court: 'Lord of the Land',
  tavern: 'Minstrel Guild',
  chapel: 'Agnus Dei X',
  forest: 'Enchanted Valley',
  road: 'Teller of the Tales',
  highland: 'Skye Cuillin',
  coast: 'Moorland',
  desert: 'Ibn Al-Noor',
  tomb: 'Curse of the Scarab',
  jungle: 'Tabuk',
  forge: 'The Hive',
  barrows: 'Ossuary 6 - Air',
  highwall: 'Dark Times',
  darkwood: 'The Dread',
  snow: 'Frozen Star',
  rift: 'Echoes of Time v2',
  crypt: 'Ossuary 5 - Rest',
  cave: 'Crypto',
  boss: 'Five Armies',
  siege: 'Heroic Age',
  // the Ring's arenas (src/games/sigilfall/audio/tracks.ts RING_MUSIC)
  'ring-sands': 'Desert City',
  'ring-frost': 'Ice Flow',
  'ring-forge': 'Volatile Reaction',
};

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-hide_banner', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${FFMPEG} ${args.join(' ')}\n${r.stderr}`);
  return r.stderr;
}

/** A sound's average and its peak, after whatever came before `chain`. */
function measure(src, chain) {
  const text = ffmpeg(['-nostats', '-i', src, '-af', [...chain, 'volumedetect'].join(','), '-f', 'null', '-']);
  return { mean: Number(/mean_volume: (-?[\d.]+)/.exec(text)[1]), peak: Number(/max_volume: (-?[\d.]+)/.exec(text)[1]) };
}

/**
 * A sound cut at `to` seconds that rings out for `ring` more, as a held note does in a hall (a few echoes, fading),
 * instead of stopping on the cut.
 */
export const ringOut = (to, ring) => [
  `atrim=end=${to}`,
  `apad=pad_dur=${ring}`,
  'aecho=1.0:0.8:110|240|400|600|850:0.42|0.3|0.2|0.12|0.07',
  `afade=t=out:st=${to}:d=${(ring - 0.1).toFixed(2)}`,
  `atrim=end=${(to + ring - 0.1).toFixed(2)}`,
];

/** Where a sound comes from: the first pack, ('@/') the folder of the others, or ('%/') the CC0 packs' folder. */
const from = (file) => (file.startsWith('@/') ? join(MORE, file.slice(2)) : file.startsWith('%/') ? join(CC0, file.slice(2)) : join(PACK, file));

if (!ONLY) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, [file, o = {}]] of Object.entries(FILES)) {
  if (ONLY && !name.startsWith(ONLY)) continue;
  const src = from(file);
  const chain = ['aformat=channel_layouts=mono', `aresample=${o.ar ?? 44100}`, 'silenceremove=start_periods=1:start_threshold=-50dB'];
  if (o.to && o.ring) chain.push(...ringOut(o.to, o.ring));
  else if (o.to) chain.push(`atrim=end=${o.to}`, `afade=t=out:st=${o.to - 0.06}:d=0.06`);
  if (o.boost) chain.push(`volume=${o.boost}dB`, 'alimiter=limit=0.9');
  const { mean, peak } = measure(src, chain);
  // only ever down, toward the rest: nothing clips
  const gain = Math.min(TARGET - mean, -0.5 - peak, 0);
  const to = join(OUT, `${name}.mp3`);
  ffmpeg(['-y', '-loglevel', 'error', '-i', src, '-af', [...chain, `volume=${gain.toFixed(2)}dB`].join(','), '-codec:a', 'libmp3lame', '-b:a', `${o.kbps ?? 64}k`, '-map_metadata', '-1', to]);
  total++;
}
console.log(`${total} sounds in ${OUT}`);
// (just the sounds asked for: the air and the music stay as they are)
if (ONLY) process.exit(0);

// the air of places: a loop each, quiet, with its ends eased so the seam is not heard
for (const [name, file] of Object.entries(AMBIENCES)) {
  const src = from(file);
  const chain = ['aformat=channel_layouts=mono', 'aresample=44100'];
  const { mean, peak } = measure(src, chain);
  const gain = Math.min(AMBIENCE - mean, -1 - peak);
  ffmpeg(['-y', '-loglevel', 'error', '-i', src, '-af', [...chain, `volume=${gain.toFixed(2)}dB`].join(','), '-codec:a', 'libmp3lame', '-b:a', '56k', '-map_metadata', '-1', join(OUT, `amb-${name}.mp3`)]);
  console.log(`amb-${name}: ${mean} dB, ${gain.toFixed(1)} dB`);
}

rmSync(MUSIC_OUT, { recursive: true, force: true });
mkdirSync(MUSIC_OUT, { recursive: true });
const TRIM = ['silenceremove=start_periods=1:start_threshold=-60dB', 'areverse', 'silenceremove=start_periods=1:start_threshold=-60dB', 'areverse'];
for (const [name, title] of Object.entries(TRACKS)) {
  const src = join(MUSIC, `${title}.mp3`);
  // (a long piece is cut to length, on a slow fade)
  const cut = [...TRIM, `atrim=end=${MUSIC_MAX}`, `afade=t=out:st=${MUSIC_MAX - 4}:d=4`];
  const text = ffmpeg(['-nostats', '-i', src, '-af', [...cut, 'ebur128=framelog=quiet'].join(','), '-f', 'null', '-']);
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(text)[1]);
  // (the battle pieces a little above the rest: they are meant to be felt)
  const gain = MUSIC_LOUDNESS + (name === 'boss' || name === 'siege' || name.startsWith('ring-') ? 2 : 0) - lufs;
  const chain = [...cut, `volume=${gain.toFixed(2)}dB`, 'alimiter=limit=0.89:level=disabled'];
  ffmpeg(['-y', '-loglevel', 'error', '-i', src, '-af', chain.join(','), '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '80k', '-map_metadata', '-1', join(MUSIC_OUT, `${name}.mp3`)]);
  console.log(`${name}: ${title}, ${lufs} LUFS, ${gain.toFixed(1)} dB`);
}
