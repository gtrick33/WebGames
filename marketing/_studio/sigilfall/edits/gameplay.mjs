// Sigilfall: Official Gameplay Trailer. What playing it is: the HUD as it is, the game's own sound in front,
// long takes, plain cuts. Every clip is an unbroken stretch of one take at the game's own speed.
import { timeline, endCard, track } from './_kit.mjs';

const cut = { fadeIn: 0.18 };
const out = { fadeOut: 0.18 };
const tl = timeline([
  // a real fight first: the Coffin Matron wakes her children
  { id: 'hook', src: 'crypt-run', in: 53.9, dur: 4.4, ...out },

  // a new player: the hall, a hero made, the gate of Briarhollow
  { id: 'hall', src: 'begin', in: 0.5, dur: 2.9, ...cut, vfit: true },
  { id: 'class', src: 'begin', in: 4.3, dur: 2.7, vfit: true },
  { id: 'name', src: 'begin', in: 8.35, dur: 2.3, ...out, vfit: true },
  { id: 'arrive', src: 'begin', in: 10.75, dur: 2.6, ...cut },
  { id: 'talk', src: 'begin', in: 17.6, dur: 2.5, vfit: true },
  { id: 'gate', src: 'begin', in: 45.6, dur: 7.0, ...out },

  // on the road: walking, fighting, a level gained, in one take
  { id: 'road', src: 'first-fights', in: 20.6, dur: 13.5, ...cut, ...out },

  // the hero changes: new gear worn, talents learned
  { id: 'gear', src: 'equip', in: 1.3, dur: 6.0, zoom: [1.1, 1.1], focus: [0.35, 0.15], vx: 0.3, ...cut },
  { id: 'worn', src: 'equip', in: 12.75, dur: 2.0 },
  { id: 'talents', src: 'talents', in: 0.8, dur: 4.6, zoom: [1.12, 1.12], focus: [0.5, 0.25], ...out, vfit: true },

  // a dungeon: its halls, its boss, her tricks
  { id: 'halls', src: 'crypt-run', in: 6.9, dur: 6.5, ...cut },
  { id: 'boss', src: 'crypt-run', in: 29.9, dur: 3.6 },
  { id: 'fight', src: 'crypt-run', in: 36.4, dur: 8.5, ...out },

  // more ways to play
  { id: 'vigil', src: 'vigil', in: 13.6, dur: 6.0, zoom: [1.3, 1.3], focus: [0.5, 0.5], ...cut },
  { id: 'ring', src: 'ring', in: 25.6, dur: 4.5, zoom: [1.35, 1.35], focus: [0.92, 0.62], vx: 0.8, ...out },

  { id: 'last', src: 'crypt-run', in: 63.2, dur: 2.4, ...cut },
  { id: 'end', src: 'hall-mage', in: 0.2, dur: 4.7, x: 0.5, zoom: [1.5, 1.56], focus: [0.5, 0.3], sfx: 0 },
  { id: 'end2', src: 'hall-mage', in: 0.2, dur: 1.6, zoom: [1.56, 1.58], focus: [0.5, 0.3], sfx: 0, fadeOut: 0.6 },
]);
const { T } = tl;
const chip = (id, text, dur, more = {}) => ({ kind: 'chip', pos: 'low', at: T(id, 0.35), dur, text, ...more });

export default {
  name: 'gameplay',
  out: 'Sigilfall-Official-Gameplay-Trailer',
  clips: tl.clips,
  sfx: 1,
  amb: true,
  ambGain: 0.2,
  fxGain: 1.15,
  music: [{ file: track('Lord of the Land'), from: 0.3, at: 0, gain: 0.62, fadeIn: 1.5, fadeOut: 3, ride: [[0, 1], [T('end') - 1, 1], [T('end') + 0.5, 1.5], [tl.total, 1.5]] }],
  hits: [{ at: T('end', 0.35), id: 'epic', gain: 1.1 }],
  gfx: [
    { kind: 'mark', at: 0.3, dur: T('hall') - 0.4, pos: 'low', in: 0.4, out: 0.3 },
    { kind: 'chip', pos: 'low', at: 0.5, dur: T('hall') - 0.7, text: 'Official *gameplay* trailer' },
    chip('class', '*Start* · make your hero', T('arrive') - T('class') - 0.5),
    chip('arrive', '*The story* · a village, a bell, a gate to hold', T('talk') - T('arrive') - 0.2),
    { ...chip('talk', '*The story* · a village, a bell, a gate to hold', T('gate') - T('talk') - 0.5), pos: undefined },
    chip('gate', '*The first fight* · hold the gate', T('road') - T('gate') - 0.8),
    chip('road', '*Explore* · fight · level up', 6),
    { ...chip('gear', '*Gear* changes your hero', T('talents') - T('gear') - 0.5), side: 'right' },
    { ...chip('talents', '*Talents* · build them your way', 4.0), side: 'right' },
    chip('halls', '*Dungeons* · rooms of foes, then a boss', 6),
    chip('boss', '*Bosses* · learn the tricks, dodge the blows', 8),
    chip('vigil', '*The Vigil* · hold out against the horde', 5.3),
    chip('ring', '*The Ring* · arena duels', 3.8),
    { kind: 'veil', at: T('end', 0.3), dur: tl.total - T('end') - 0.3, alpha: 0.45, in: 0.5 },
    endCard(T('end', 0.3), tl.total - T('end') - 0.3, { tag: 'Seven sigils. One Crown.', piece: 'Lord of the Land' }),
  ],
};
