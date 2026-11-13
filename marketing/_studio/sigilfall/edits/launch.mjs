// Sigilfall: Choose Your Calling (the launch trailer). Cut to the bars of "Five Armies": one bar a calling,
// the hero built in three and a half, four bars of bosses, a bar for each other way to play, the logo on the
// last chord. Every clip plays at the game's own speed.
import { timeline, endCard, track, CALLINGS } from './_kit.mjs';

const BAR = (60 / 113.75) * 4;
const bars = (n) => BAR * n;
/** The piece's bar lines fall at 103.19 s + n bars (its strongest beats, measured: audio/analyze.mjs). */
const MUSIC_FROM = 103.19;
const near = { zoom: [1.16, 1.24], focus: [0.5, 0.45] };

const tl = timeline([
  // the Sun King's light comes down as the first chord does
  { id: 'hook', src: 'sunking', in: 12.0, dur: bars(1.5), zoom: [1.0, 1.08] },

  // seven callings, a bar each
  { id: 'warrior', src: 'cls-warrior', in: 11.45, dur: bars(1), ...near },
  { id: 'mage', src: 'cls-mage', in: 4.1, dur: bars(1), ...near },
  { id: 'ranger', src: 'cls-ranger', in: 15.9, dur: bars(1), ...near },
  { id: 'paladin', src: 'cls-paladin', in: 7.6, dur: bars(1), ...near },
  { id: 'priest', src: 'cls-priest', in: 2.3, dur: bars(1), ...near },
  { id: 'warlock', src: 'cls-warlock', in: 4.0, dur: bars(1), ...near },
  { id: 'druid', src: 'cls-druid', in: 17.6, dur: bars(1), ...near },

  // the hero is yours to build
  { id: 'plain', src: 'hall-1', in: 1.0, dur: bars(0.5), zoom: [1.2, 1.24], focus: [0.5, 0.6] },
  { id: 'gear', src: 'equip', in: 3.55, dur: bars(1), zoom: [1.3, 1.3], focus: [0.1, 0.1], vx: 0.3 },
  { id: 'talents', src: 'talents', in: 2.75, dur: bars(1), zoom: [1.25, 1.25], focus: [0.5, 0.3], vfit: true },
  { id: 'built', src: 'hall-60', in: 1.0, dur: bars(1), zoom: [1.2, 1.28], focus: [0.5, 0.6] },

  // what waits for them
  { id: 'ashkar', src: 'ashkar', in: 13.75, dur: bars(1), zoom: [1.0, 1.06] },
  { id: 'wyrm', src: 'wyrm', in: 11.5, dur: bars(1), zoom: [1.0, 1.06] },
  { id: 'hearth', src: 'hearth', in: 15.0, dur: bars(1), ...near },
  { id: 'loose', src: 'ashkar', in: 36.4, dur: bars(1), zoom: [1.0, 1.06] },

  // more ways to play
  { id: 'vigil', src: 'vigil', in: 15.4, dur: bars(1), zoom: [1.3, 1.36] },
  { id: 'ring', src: 'ring', in: 26.4, dur: bars(1), zoom: [1.35, 1.4], focus: [0.95, 0.62], vx: 0.82 },
  { id: 'rift', src: 'rift', in: 19.9, dur: bars(1), ...near },

  { id: 'last', src: 'sunking', in: 27.75, dur: bars(1), zoom: [1.0, 1.1] },
  { id: 'end', src: 'hall-mage', in: 0.2, dur: 4.6, zoom: [1.5, 1.56], focus: [0.5, 0.3], sfx: 0 },
  { id: 'end2', src: 'hall-mage', in: 0.2, dur: 1.9, zoom: [1.56, 1.6], focus: [0.5, 0.3], sfx: 0, fadeOut: 0.5 },
]);
const { T } = tl;
const calling = (id, side = 'left') => ({ kind: 'plate', at: T(id, 0.06), dur: bars(1) - 0.12, side, ...CALLINGS[id] });
const plate = (id, title, sub, more = {}) => ({ kind: 'plate', small: true, at: T(id, 0.06), dur: bars(1) - 0.12, title, sub, ...more });

export default {
  name: 'launch',
  out: 'Sigilfall-Official-Launch-Trailer',
  clips: tl.clips,
  sfx: 0.55,
  fxGain: 1,
  music: [{ file: track('Five Armies'), from: MUSIC_FROM, at: 0, gain: 0.9, fadeIn: 0.05, fadeOut: 2.2, ride: [[0, 1], [T('end') + 2.4, 1], [tl.total, 0.8]] }],
  hits: [
    { at: 0.02, id: 'slam', gain: 1.2 },
    ...['warrior', 'mage', 'ranger', 'paladin', 'priest', 'warlock', 'druid'].map((id) => ({ at: T(id), id: 'whirl', gain: 0.55, rate: 1.3 })),
    { at: T('plain'), id: 'open', gain: 1 },
    { at: T('built'), id: 'levelup', gain: 1.2 },
    { at: T('ashkar'), id: 'roar', gain: 0.8 },
    { at: T('vigil'), id: 'whirl', gain: 0.6, rate: 1.2 },
    { at: T('ring'), id: 'whirl', gain: 0.6, rate: 1.2 },
    { at: T('rift'), id: 'whirl', gain: 0.6, rate: 1.2 },
    { at: T('end'), id: 'slam', gain: 1.3 },
    { at: T('end', 0.05), id: 'epic', gain: 1.1 },
  ],
  gfx: [
    { kind: 'big', at: 0.9, dur: bars(1.5) - 1.0, title: 'Choose Your Calling', in: 0.25, out: 0.12 },
    calling('warrior'), calling('mage', 'right'), calling('ranger'), calling('paladin', 'right'), calling('priest'), calling('warlock', 'right'), calling('druid'),
    { kind: 'plate', small: true, at: T('plain', 0.06), dur: bars(0.5) - 0.1, title: 'Level 1', sub: 'Everyone starts somewhere' },
    plate('gear', 'New gear', 'Every piece shows on your hero', { side: 'right' }),
    plate('talents', 'Talents', 'Three paths for every calling'),
    plate('built', 'Level 60', 'Build them your way'),
    plate('ashkar', 'Ashkar the Bound', 'The Molten Throne', { side: 'right' }),
    plate('wyrm', 'The Rime Wyrm', 'The Rimeheld Vault'),
    plate('hearth', 'Hearthstead', 'Hold the town', { side: 'right' }),
    plate('vigil', 'The Vigil', 'Hold out against the horde'),
    plate('ring', 'The Ring', 'Arena duels', { side: 'right' }),
    plate('rift', 'Riftstones', 'Dungeons against the clock'),
    { kind: 'veil', white: true, at: T('end') - 0.04, dur: 0.5, curve: 'in', alpha: 0.85 },
    { kind: 'veil', at: T('end'), dur: tl.total - T('end'), alpha: 0.45 },
    endCard(T('end'), tl.total - T('end'), { tag: 'Seven sigils. One Crown.', piece: 'Five Armies' }),
  ],
};
