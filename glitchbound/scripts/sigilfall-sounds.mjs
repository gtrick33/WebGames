#!/usr/bin/env node
/*
 * Builds Sigilfall's sound files from the pack it was given, by hand when the choices change (the files ship; the
 * pack stays out of the repository): RPG Sound Pack by artisticdude, CC0,
 * https://opengameart.org/content/rpg-sound-pack, unzipped in ~/Downloads/rpg_sound_pack (or SIGILFALL_SOUNDS).
 *
 * Each sound comes out mono and small (MP3, which every browser can decode), starting right on its first
 * moment, cut to length where it needs to be, and no louder on average than the rest, so a table of gains
 * (src/games/sigilfall/audio/samples.ts) can mix them.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PACK = process.env.SIGILFALL_SOUNDS ?? join(homedir(), 'Downloads/rpg_sound_pack/RPG Sound Pack');
const OUT = 'public/games/sigilfall/audio';
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
/** How loud a sound is on average, at most (dB). */
const TARGET = -20;

/** What ships: its name, the file it comes from, and how it is cut (`to`: seconds kept) or lifted (`boost`: dB). */
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
  // spells
  magic: ['battle/magic1.wav', { to: 0.55 }],
  'magic-long': ['battle/magic1.wav'],
  spell: ['battle/spell.wav', { to: 0.9 }],
  // the hero's things
  armor: ['inventory/armor-light.wav'],
  chain1: ['inventory/chainmail1.wav'],
  chain2: ['inventory/chainmail2.wav'],
  bottle: ['inventory/bottle.wav'],
  bubble1: ['inventory/bubble.wav'],
  bubble2: ['inventory/bubble2.wav'],
  bubble3: ['inventory/bubble3.wav'],
  cloth: ['inventory/cloth.wav'],
  'cloth-heavy': ['inventory/cloth-heavy.wav'],
  coin1: ['inventory/coin.wav'],
  coin2: ['inventory/coin2.wav'],
  coin3: ['inventory/coin3.wav'],
  ring: ['inventory/metal-ringing.wav'],
  metal1: ['inventory/metal-small1.wav'],
  metal2: ['inventory/metal-small2.wav'],
  metal3: ['inventory/metal-small3.wav'],
  wood: ['inventory/wood-small.wav'],
  beads: ['inventory/beads.wav', { boost: 10 }],
  door: ['world/door.wav'],
  // the menus
  click: ['interface/interface1.wav'],
  page1: ['interface/interface2.wav'],
  page2: ['interface/interface3.wav'],
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

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, [file, o = {}]] of Object.entries(FILES)) {
  const src = join(PACK, file);
  const chain = ['aformat=channel_layouts=mono', 'aresample=44100', 'silenceremove=start_periods=1:start_threshold=-50dB'];
  if (o.to) chain.push(`atrim=end=${o.to}`, `afade=t=out:st=${o.to - 0.06}:d=0.06`);
  if (o.boost) chain.push(`volume=${o.boost}dB`, 'alimiter=limit=0.9');
  const { mean, peak } = measure(src, chain);
  // only ever down, toward the rest: nothing clips
  const gain = Math.min(TARGET - mean, -0.5 - peak, 0);
  const to = join(OUT, `${name}.mp3`);
  ffmpeg(['-y', '-loglevel', 'error', '-i', src, '-af', [...chain, `volume=${gain.toFixed(2)}dB`].join(','), '-codec:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', to]);
  total++;
}
console.log(`${total} sounds in ${OUT}`);
