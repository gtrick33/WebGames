// Sigilfall: The Crown of Ash (the story trailer). "Heroic Age" from its quiet middle: twenty-five seconds of
// mystery and road, the piece's surge on the hero grown, bosses in plain cuts, the logo while it is still loud.
// The lines are the game's own story, shortened: the star, the two crowns, the bell, the dead, the sigils.
import { timeline, endCard, track } from './_kit.mjs';

/** The piece goes quiet at 26.8 s and surges at 52.4 s: the trailer's 25.6 s. */
const MUSIC_FROM = 26.8;
const push = (a = 1.0, b = 1.07, focus = [0.5, 0.5]) => ({ zoom: [a, b], focus });

const tl = timeline([
  // the game's own vision: the star comes down between two kings
  { id: 'star', src: 'vision', in: 8.75, dur: 4.2, ...push(1.3, 1.42, [0.5, 0.5]), sfx: 0 },
  { id: 'kings', src: 'vision', in: 13.2, dur: 3.6, x: 0.5, ...push(1.5, 1.6, [0.5, 0.52]), sfx: 0 },
  // tonight: Briarhollow burns, and the guard at its gate
  { id: 'burn', src: 'night', in: 4.1, dur: 3.4, x: 0.5, ...push(1.0, 1.08), sfx: 0 },
  { id: 'mara', src: 'night', in: 10.0, dur: 3.2, ...push(1.12, 1.2, [0.42, 0.5]), sfx: 0 },
  // the road
  { id: 'wood', src: 'walk-whisper', in: 13.2, dur: 2.8, x: 0.4, ...push(1.0, 1.06) },
  { id: 'plain', src: 'walk-town', in: 6.6, dur: 2.6, ...push(1.0, 1.06) },
  { id: 'glimmer', src: 'walk-glimmer', in: 6.0, dur: 2.4, ...push(1.0, 1.06) },
  { id: 'tear', src: 'walk-vale', in: 10.9, dur: 2.6, ...push(1.0, 1.08) },
  // the hero, at the start and at the end
  { id: 'noone', src: 'hall-1', in: 0.6, dur: 2.6, x: 0.4, ...push(1.2, 1.28, [0.5, 0.6]), sfx: 0 },
  { id: 'legend', src: 'hall-60', in: 0.6, dur: 3.0, ...push(1.32, 1.22, [0.5, 0.6]), sfx: 0 },
  { id: 'hearth', src: 'hearth', in: 15.2, dur: 3.0, ...push(1.1, 1.18, [0.5, 0.45]) },
  // what stands in the way
  { id: 'hrodric', src: 'hrodric', in: 0.9, dur: 2.0, ...push(1.2, 1.3, [0.5, 0.75]) },
  { id: 'court', src: 'hrodric', in: 13.6, dur: 2.6, ...push(1.05, 1.12) },
  { id: 'sun', src: 'sunking', in: 5.3, dur: 3.0, ...push(1.0, 1.08) },
  { id: 'wyrm', src: 'wyrm', in: 11.4, dur: 3.0, ...push(1.0, 1.08) },
  { id: 'slag', src: 'colossus', in: 9.2, dur: 2.6, ...push(1.12, 1.2, [0.5, 0.4]) },
  // the one who waits
  { id: 'king', src: 'king', in: 4.0, dur: 3.4, ...push(1.4, 1.5, [0.5, 0.97]), sfx: 0 },
  { id: 'ashkar', src: 'ashkar', in: 0.9, dur: 2.2, ...push(1.3, 1.42, [0.5, 0.15]) },
  { id: 'loose', src: 'ashkar', in: 31.4, dur: 2.4, ...push(1.0, 1.08) },
  { id: 'fire', src: 'ashkar', in: 40.9, dur: 3.0, ...push(1.0, 1.12) },
  { id: 'end', src: 'hall-60', in: 0.2, dur: 4.6, zoom: [1.5, 1.56], focus: [0.5, 0.3], sfx: 0 },
  { id: 'end2', src: 'hall-60', in: 0.2, dur: 3.4, zoom: [1.56, 1.6], focus: [0.5, 0.3], sfx: 0, fadeOut: 0.8 },
]);
const { T } = tl;
const line = (at, dur, text, more = {}) => ({ kind: 'line', at, dur, text, ...more });
const plate = (id, title, sub, more = {}) => ({ kind: 'plate', small: true, at: T(id, 0.1), dur: (more.dur ?? 2.3), title, sub, ...more });

export default {
  name: 'story',
  out: 'Sigilfall-Official-Story-Trailer',
  clips: tl.clips,
  sfx: 0.5,
  fxGain: 0.9,
  amb: false,
  music: [{ file: track('Heroic Age'), from: MUSIC_FROM, at: 0, gain: 1, fadeIn: 0.8, fadeOut: 1.2, ride: [[0, 1.5], [T('noone'), 1.5], [T('legend'), 1], [tl.total, 1]] }],
  hits: [
    { at: 0.2, id: 'slam', gain: 1.3, rate: 0.8 },
    { at: 0.25, id: 'explode', gain: 0.7 },
    { at: T('burn', 0.2), id: 'bell', gain: 0.9 },
    { at: T('mara', 1.4), id: 'bell', gain: 0.6 },
    { at: T('legend'), id: 'levelup', gain: 1.1 },
    { at: T('hrodric'), id: 'roar', gain: 0.9 },
    { at: T('ashkar'), id: 'roar', gain: 1 },
    { at: T('end'), id: 'slam', gain: 1.3 },
    { at: T('end', 0.05), id: 'epic', gain: 1.1 },
  ],
  gfx: [
    { kind: 'vignette', at: 0, dur: T('end') },
    line(0.9, 3.2, 'A thousand years ago, a *star* fell.'),
    line(T('kings', 0.3), 3.0, 'Two kings made *crowns* of it.'),
    line(T('burn', 0.4), 2.7, 'Now the bells have *stopped*.'),
    line(T('mara', 0.2), 2.8, 'And the dead are *walking*.'),
    line(T('plain', 0.1), 4.6, 'The *sigils* that held the dark have fallen.'),
    line(T('noone', 0.5), 1.9, 'You begin as *no one*.', { out: 0.15 }),
    { kind: 'veil', white: true, at: T('legend') - 0.04, dur: 0.45, curve: 'in', alpha: 0.8 },
    line(T('legend', 0.25), 2.5, 'Become a *legend*.'),
    plate('hrodric', 'King Hrodric', 'The Barrow of Kings', { dur: 1.8 }),
    plate('sun', 'The Sun King', 'His tomb under the sand', { side: 'right' }),
    plate('wyrm', 'The Rime Wyrm', 'The Rimeheld Vault'),
    plate('slag', 'The Slag Colossus', 'The Deepforge Halls', { side: 'right' }),
    line(T('king', 0.3), 2.9, 'And the Hallow King is *waiting*.', { pos: 'high' }),
    plate('ashkar', 'Ashkar the Bound', 'The Molten Throne', { dur: 2.0 }),
    { kind: 'veil', white: true, at: T('end') - 0.04, dur: 0.5, curve: 'in', alpha: 0.85 },
    { kind: 'veil', at: T('end'), dur: tl.total - T('end'), alpha: 0.45 },
    endCard(T('end'), tl.total - T('end'), { tag: 'Seven sigils. One Crown.', piece: 'Heroic Age', kick: 'The Crown of Ash' }),
  ],
};
