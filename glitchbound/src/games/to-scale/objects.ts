/**
 * Things to size up: an emoji (or original art), what it is, one real dimension in meters and a fact
 * for the reveal. `dim` says what the size measures (length, height, width, across) and `axis` which
 * side of the drawn picture shows it; `level` turns diagonal art (a pencil, a rocket) so its long axis
 * lies along that side before it is measured. Sizes are typical real-world values. Only emoji every
 * current phone and computer can draw. Append only: a thing's id is its position, and the sizes pick
 * the daily pairs, so changing one changes dailies.
 */
import { BALLOON, CAT, CROCODILE, CRUISE_SHIP, DIE, DOG, JET, LOCOMOTIVE, SOFA, TENNIS_BALL, type Art } from './art';

export type Dim = 'long' | 'tall' | 'wide' | 'across';

export interface Thing {
  emoji: string;
  name: string;
  /** The measured dimension (`dim`), in meters. */
  size: number;
  dim: Dim;
  /** Which side of the drawn picture is `size`: its width or its height. */
  axis: 'w' | 'h';
  /** Rotate the emoji so its long axis lies along `axis` before measuring it (diagonal art). */
  level?: boolean;
  /** Original art drawn to real proportions, used instead of the emoji. */
  art?: Art;
  fact: string;
}

export const THINGS: Thing[] = [
  { emoji: '🐜', name: 'an ant', size: 0.006, dim: 'long', axis: 'w', level: true, fact: 'A worker ant is about 6 mm long, and can carry many times its own weight.' },
  { emoji: '🐝', name: 'a honeybee', size: 0.015, dim: 'long', axis: 'w', fact: 'A worker honeybee is about 1.5 cm long.' },
  { emoji: '🎲', name: 'a die', size: 0.016, dim: 'across', axis: 'w', art: DIE, fact: 'A standard die is 16 mm along each edge.' },
  { emoji: '🐌', name: 'a garden snail', size: 0.03, dim: 'long', axis: 'w', fact: 'A garden snail is about 3 cm long as it crawls, shell included.' },
  { emoji: '📎', name: 'a paperclip', size: 0.033, dim: 'long', axis: 'w', level: true, fact: 'A standard paperclip is about 3.3 cm long.' },
  { emoji: '🍓', name: 'a strawberry', size: 0.035, dim: 'long', axis: 'h', level: true, fact: 'A supermarket strawberry is about 3.5 cm long.' },
  { emoji: '🔑', name: 'a door key', size: 0.06, dim: 'long', axis: 'w', level: true, fact: 'A front door key is about 6 cm long.' },
  { emoji: '🥚', name: 'a hen’s egg', size: 0.06, dim: 'tall', axis: 'h', fact: 'A large hen’s egg is about 6 cm tall.' },
  { emoji: '🎾', name: 'a tennis ball', size: 0.067, dim: 'across', axis: 'w', art: TENNIS_BALL, fact: 'A tennis ball is 6.7 cm across.' },
  { emoji: '🍎', name: 'an apple', size: 0.08, dim: 'across', axis: 'w', fact: 'A typical apple is about 8 cm across.' },
  { emoji: '🦋', name: 'a monarch butterfly', size: 0.095, dim: 'wide', axis: 'w', fact: 'A monarch butterfly’s wings span about 9.5 cm.' },
  { emoji: '💡', name: 'a light bulb', size: 0.11, dim: 'tall', axis: 'h', fact: 'A classic light bulb is about 11 cm tall.' },
  { emoji: '📱', name: 'a smartphone', size: 0.15, dim: 'tall', axis: 'h', fact: 'Most smartphones are about 15 cm tall.' },
  { emoji: '🐁', name: 'a house mouse', size: 0.17, dim: 'long', axis: 'w', level: true, fact: 'A house mouse is about 17 cm from nose to tail tip, half of it tail.' },
  { emoji: '✏️', name: 'a pencil', size: 0.19, dim: 'long', axis: 'w', level: true, fact: 'A new pencil is about 19 cm long.' },
  { emoji: '🍌', name: 'a banana', size: 0.19, dim: 'long', axis: 'h', level: true, fact: 'A supermarket banana is about 19 cm long.' },
  { emoji: '⚽', name: 'a soccer ball', size: 0.22, dim: 'across', axis: 'w', fact: 'A size 5 soccer ball is 22 cm across.' },
  { emoji: '🏀', name: 'a basketball', size: 0.24, dim: 'across', axis: 'w', fact: 'A basketball is 24 cm across.' },
  { emoji: '🎂', name: 'a birthday cake', size: 0.25, dim: 'across', axis: 'w', fact: 'A party cake is about 25 cm across.' },
  { emoji: '👟', name: 'a sneaker', size: 0.29, dim: 'long', axis: 'w', fact: 'A men’s US size 10 sneaker is about 29 cm long.' },
  { emoji: '🎈', name: 'a party balloon', size: 0.3, dim: 'tall', axis: 'h', art: BALLOON, fact: 'A blown-up party balloon is about 30 cm tall.' },
  { emoji: '🍍', name: 'a pineapple', size: 0.35, dim: 'tall', axis: 'h', fact: 'A pineapple with its leaves is about 35 cm tall.' },
  { emoji: '🧸', name: 'a teddy bear', size: 0.35, dim: 'tall', axis: 'h', fact: 'A classic teddy bear sits about 35 cm tall.' },
  { emoji: '🦉', name: 'a barn owl', size: 0.35, dim: 'tall', axis: 'h', fact: 'A barn owl stands about 35 cm tall.' },
  { emoji: '🐈', name: 'a house cat', size: 0.75, dim: 'long', axis: 'w', art: CAT, fact: 'A house cat is about 75 cm from nose to tail tip.' },
  { emoji: '🎸', name: 'a guitar', size: 1.0, dim: 'long', axis: 'h', level: true, fact: 'A full-size guitar is about 1 m long.' },
  { emoji: '🐕', name: 'a Labrador', size: 1.1, dim: 'long', axis: 'w', art: DOG, fact: 'A Labrador is about 1.1 m from nose to tail tip.' },
  { emoji: '🐧', name: 'an emperor penguin', size: 1.15, dim: 'tall', axis: 'h', fact: 'Emperor penguins stand up to about 1.15 m tall, the biggest penguins alive.' },
  { emoji: '🐢', name: 'a giant tortoise', size: 1.3, dim: 'long', axis: 'w', fact: 'A big Galápagos giant tortoise is about 1.3 m long, head to tail.' },
  { emoji: '🚶', name: 'a person', size: 1.7, dim: 'tall', axis: 'h', fact: 'An adult is about 1.7 m tall on average.' },
  { emoji: '🚲', name: 'a bicycle', size: 1.75, dim: 'long', axis: 'w', fact: 'An adult bicycle is about 1.75 m long.' },
  { emoji: '🛋️', name: 'a sofa', size: 2.0, dim: 'wide', axis: 'w', art: SOFA, fact: 'A three-seater sofa is about 2 m wide.' },
  { emoji: '🚪', name: 'a door', size: 2.0, dim: 'tall', axis: 'h', fact: 'A front door is about 2 m tall.' },
  { emoji: '🐎', name: 'a horse', size: 2.4, dim: 'long', axis: 'w', fact: 'A horse is about 2.4 m from nose to tail.' },
  { emoji: '🗿', name: 'a moai statue', size: 4.0, dim: 'tall', axis: 'h', fact: 'The average moai on Easter Island is about 4 m tall.' },
  { emoji: '🚗', name: 'a car', size: 4.5, dim: 'long', axis: 'w', fact: 'A family car is about 4.5 m long.' },
  { emoji: '🐊', name: 'a saltwater crocodile', size: 4.5, dim: 'long', axis: 'w', art: CROCODILE, fact: 'A grown male saltwater crocodile is about 4.5 m long, and some reach 6 m.' },
  { emoji: '🦈', name: 'a great white shark', size: 4.6, dim: 'long', axis: 'w', fact: 'A great white shark is about 4.6 m long.' },
  { emoji: '🛶', name: 'a canoe', size: 4.8, dim: 'long', axis: 'w', fact: 'A two-person canoe is about 4.8 m long.' },
  { emoji: '🏎️', name: 'a Formula 1 car', size: 5.6, dim: 'long', axis: 'w', fact: 'A Formula 1 car is about 5.6 m long.' },
  { emoji: '🐘', name: 'an African elephant', size: 6.5, dim: 'long', axis: 'w', fact: 'An African elephant is about 6.5 m from trunk tip to tail.' },
  { emoji: '⛵', name: 'a sailing yacht', size: 10, dim: 'long', axis: 'w', fact: 'A small sailing yacht is about 10 m long from bow to stern.' },
  { emoji: '🏠', name: 'a family house', size: 10, dim: 'wide', axis: 'w', fact: 'A single-family house is about 10 m wide.' },
  { emoji: '🚌', name: 'a city bus', size: 12, dim: 'long', axis: 'w', fact: 'A city bus is about 12 m long.' },
  { emoji: '🦖', name: 'a T. rex', size: 12, dim: 'long', axis: 'w', fact: 'A grown Tyrannosaurus rex was about 12 m long.' },
  { emoji: '🐋', name: 'a humpback whale', size: 15, dim: 'long', axis: 'w', fact: 'A humpback whale is about 15 m long.' },
  { emoji: '🚁', name: 'a helicopter', size: 17, dim: 'long', axis: 'w', fact: 'A medium helicopter is about 17 m long, rotors included.' },
  { emoji: '🌳', name: 'an oak tree', size: 20, dim: 'tall', axis: 'h', fact: 'A grown oak tree is about 20 m tall.' },
  { emoji: '🚂', name: 'a steam locomotive', size: 20, dim: 'long', axis: 'w', art: LOCOMOTIVE, fact: 'A big steam locomotive with its tender is about 20 m long.' },
  { emoji: '✈️', name: 'a jumbo jet', size: 70, dim: 'long', axis: 'w', art: JET, fact: 'A Boeing 747 is about 70 m long.' },
  { emoji: '🗽', name: 'the Statue of Liberty', size: 93, dim: 'tall', axis: 'h', fact: 'From the ground to the torch, the Statue of Liberty is 93 m tall, pedestal included.' },
  { emoji: '🚀', name: 'a Saturn V rocket', size: 110, dim: 'tall', axis: 'h', level: true, fact: 'The Saturn V that flew to the Moon was 110 m tall.' },
  { emoji: '🎡', name: 'the London Eye', size: 135, dim: 'tall', axis: 'h', fact: 'The London Eye is 135 m tall.' },
  { emoji: '🚢', name: 'a cruise ship', size: 300, dim: 'long', axis: 'w', art: CRUISE_SHIP, fact: 'A big cruise ship is about 300 m long.' },
  { emoji: '🗼', name: 'Tokyo Tower', size: 333, dim: 'tall', axis: 'h', fact: 'Tokyo Tower is 333 m tall, 3 m more than the Eiffel Tower.' },
  { emoji: '🌕', name: 'the Moon', size: 3_474_000, dim: 'across', axis: 'w', fact: 'The Moon is 3,474 km across, a bit over a quarter of the Earth.' },
  { emoji: '🌍', name: 'the Earth', size: 12_742_000, dim: 'across', axis: 'w', fact: 'The Earth is 12,742 km across.' },
];

/** The real box of a thing's picture, in meters, from its size and the picture's width over height. */
export function artBox(t: Pick<Thing, 'axis'>, size: number, aspect: number): { w: number; h: number } {
  return t.axis === 'w' ? { w: size, h: size / aspect } : { w: size * aspect, h: size };
}

/** The measured side of a picture's box (the one `size` is). */
export const measured = (t: Pick<Thing, 'axis'>, b: { w: number; h: number }): number => (t.axis === 'w' ? b.w : b.h);

/** A size in words: mm, cm, m or km. */
export function sizeText(m: number): string {
  if (m < 0.01) return `${Math.round(m * 10000) / 10} mm`;
  if (m < 1) return `${Math.round(m * 1000) / 10} cm`;
  if (m < 1000) return `${m < 10 ? Math.round(m * 100) / 100 : Math.round(m)} m`;
  return `${Math.round(m / 1000).toLocaleString('en-US')} km`;
}

/** A size in US units: inches, feet or miles. */
export function usText(m: number): string {
  const inches = m / 0.0254;
  if (inches < 12) return `${inches < 1 ? Math.round(inches * 100) / 100 : Math.round(inches * 10) / 10} in`;
  const feet = m / 0.3048;
  if (m < 1609.344) return `${feet < 10 ? Math.round(feet * 10) / 10 : Math.round(feet).toLocaleString('en-US')} ft`;
  return `${Math.round(m / 1609.344).toLocaleString('en-US')} mi`;
}
