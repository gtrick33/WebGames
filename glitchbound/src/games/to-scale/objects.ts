/**
 * Things to size up: an emoji, what it is, its longest dimension in metres (height for things that
 * stand, length for things that lie) and a fact for the reveal. Sizes are typical real-world values.
 * Only emoji every current phone and computer can draw. Append only: a thing's id is its position.
 */
export interface Thing {
  emoji: string;
  name: string;
  /** Longest dimension, in metres. */
  size: number;
  fact: string;
}

export const THINGS: Thing[] = [
  { emoji: '🐜', name: 'an ant', size: 0.006, fact: 'A worker ant is about 6 mm long, and can carry many times its own weight.' },
  { emoji: '🐝', name: 'a honeybee', size: 0.015, fact: 'A worker honeybee is about 1.5 cm long.' },
  { emoji: '🎲', name: 'a die', size: 0.016, fact: 'A standard die is 16 mm along each edge.' },
  { emoji: '🐌', name: 'a garden snail', size: 0.03, fact: 'A garden snail’s shell is about 3 cm across.' },
  { emoji: '📎', name: 'a paperclip', size: 0.033, fact: 'A standard paperclip is about 3.3 cm long.' },
  { emoji: '🍓', name: 'a strawberry', size: 0.035, fact: 'A supermarket strawberry is about 3.5 cm long.' },
  { emoji: '🔑', name: 'a door key', size: 0.06, fact: 'A front door key is about 6 cm long.' },
  { emoji: '🥚', name: 'a hen’s egg', size: 0.06, fact: 'A large hen’s egg is about 6 cm tall.' },
  { emoji: '🎾', name: 'a tennis ball', size: 0.067, fact: 'A tennis ball is 6.7 cm across.' },
  { emoji: '🍎', name: 'an apple', size: 0.08, fact: 'A typical apple is about 8 cm across.' },
  { emoji: '🦋', name: 'a monarch butterfly', size: 0.095, fact: 'A monarch butterfly’s wings span about 9.5 cm.' },
  { emoji: '💡', name: 'a light bulb', size: 0.11, fact: 'A classic light bulb is about 11 cm tall.' },
  { emoji: '📱', name: 'a smartphone', size: 0.15, fact: 'Most smartphones are about 15 cm tall.' },
  { emoji: '🐁', name: 'a house mouse', size: 0.17, fact: 'A house mouse is about 17 cm from nose to tail tip, half of it tail.' },
  { emoji: '✏️', name: 'a pencil', size: 0.19, fact: 'A new pencil is about 19 cm long.' },
  { emoji: '🍌', name: 'a banana', size: 0.19, fact: 'A supermarket banana is about 19 cm long.' },
  { emoji: '⚽', name: 'a football', size: 0.22, fact: 'A size 5 football is 22 cm across.' },
  { emoji: '🏀', name: 'a basketball', size: 0.24, fact: 'A basketball is 24 cm across.' },
  { emoji: '🎂', name: 'a birthday cake', size: 0.25, fact: 'A party cake is about 25 cm across.' },
  { emoji: '👟', name: 'a trainer', size: 0.29, fact: 'A men’s size 9 trainer is about 29 cm long.' },
  { emoji: '🎈', name: 'a party balloon', size: 0.3, fact: 'A blown-up party balloon is about 30 cm tall.' },
  { emoji: '🍍', name: 'a pineapple', size: 0.35, fact: 'A pineapple with its leaves is about 35 cm tall.' },
  { emoji: '🧸', name: 'a teddy bear', size: 0.35, fact: 'A classic teddy bear sits about 35 cm tall.' },
  { emoji: '🦉', name: 'a barn owl', size: 0.35, fact: 'A barn owl stands about 35 cm tall.' },
  { emoji: '🐈', name: 'a house cat', size: 0.75, fact: 'A house cat is about 75 cm from nose to tail tip.' },
  { emoji: '🎸', name: 'a guitar', size: 1.0, fact: 'A full-size guitar is about 1 m long.' },
  { emoji: '🐕', name: 'a Labrador', size: 1.1, fact: 'A Labrador is about 1.1 m from nose to tail tip.' },
  { emoji: '🐧', name: 'an emperor penguin', size: 1.15, fact: 'Emperor penguins stand up to about 1.15 m tall, the biggest penguins alive.' },
  { emoji: '🐢', name: 'a giant tortoise', size: 1.3, fact: 'A Galápagos giant tortoise’s shell can be 1.3 m long.' },
  { emoji: '🚶', name: 'a person', size: 1.7, fact: 'An adult is about 1.7 m tall on average.' },
  { emoji: '🚲', name: 'a bicycle', size: 1.75, fact: 'An adult bicycle is about 1.75 m long.' },
  { emoji: '🛋️', name: 'a sofa', size: 2.0, fact: 'A three-seater sofa is about 2 m wide.' },
  { emoji: '🚪', name: 'a door', size: 2.0, fact: 'A front door is about 2 m tall.' },
  { emoji: '🐎', name: 'a horse', size: 2.4, fact: 'A horse is about 2.4 m from nose to tail.' },
  { emoji: '🗿', name: 'a moai statue', size: 4.0, fact: 'The average moai on Easter Island is about 4 m tall.' },
  { emoji: '🚗', name: 'a car', size: 4.5, fact: 'A family car is about 4.5 m long.' },
  { emoji: '🐊', name: 'a saltwater crocodile', size: 4.5, fact: 'A grown male saltwater crocodile is about 4.5 m long, and some reach 6 m.' },
  { emoji: '🦈', name: 'a great white shark', size: 4.6, fact: 'A great white shark is about 4.6 m long.' },
  { emoji: '🛶', name: 'a canoe', size: 4.8, fact: 'A two-person canoe is about 4.8 m long.' },
  { emoji: '🏎️', name: 'a Formula 1 car', size: 5.6, fact: 'A Formula 1 car is about 5.6 m long.' },
  { emoji: '🐘', name: 'an African elephant', size: 6.5, fact: 'An African elephant is about 6.5 m from trunk tip to tail.' },
  { emoji: '⛵', name: 'a sailing yacht', size: 10, fact: 'A small sailing yacht is about 10 m long.' },
  { emoji: '🏠', name: 'a family house', size: 10, fact: 'A detached family house is about 10 m wide.' },
  { emoji: '🚌', name: 'a city bus', size: 12, fact: 'A city bus is about 12 m long.' },
  { emoji: '🦖', name: 'a T. rex', size: 12, fact: 'A grown Tyrannosaurus rex was about 12 m long.' },
  { emoji: '🐋', name: 'a humpback whale', size: 15, fact: 'A humpback whale is about 15 m long.' },
  { emoji: '🚁', name: 'a helicopter', size: 17, fact: 'A medium helicopter is about 17 m long, rotors included.' },
  { emoji: '🌳', name: 'an oak tree', size: 20, fact: 'A grown oak tree is about 20 m tall.' },
  { emoji: '🚂', name: 'a steam locomotive', size: 20, fact: 'A big steam locomotive with its tender is about 20 m long.' },
  { emoji: '✈️', name: 'a jumbo jet', size: 70, fact: 'A Boeing 747 is about 70 m long.' },
  { emoji: '🗽', name: 'the Statue of Liberty', size: 93, fact: 'From the ground to the torch, the Statue of Liberty is 93 m tall, pedestal included.' },
  { emoji: '🚀', name: 'a Saturn V rocket', size: 110, fact: 'The Saturn V that flew to the Moon was 110 m tall.' },
  { emoji: '🎡', name: 'the London Eye', size: 135, fact: 'The London Eye is 135 m tall.' },
  { emoji: '🚢', name: 'a cruise ship', size: 300, fact: 'A big cruise ship is about 300 m long.' },
  { emoji: '🗼', name: 'Tokyo Tower', size: 333, fact: 'Tokyo Tower is 333 m tall, 3 m more than the Eiffel Tower.' },
  { emoji: '🌕', name: 'the Moon', size: 3_474_000, fact: 'The Moon is 3,474 km across, a bit over a quarter of the Earth.' },
  { emoji: '🌍', name: 'the Earth', size: 12_742_000, fact: 'The Earth is 12,742 km across.' },
];

/** A size in words: mm, cm, m or km. */
export function sizeText(m: number): string {
  if (m < 0.01) return `${Math.round(m * 10000) / 10} mm`;
  if (m < 1) return `${Math.round(m * 1000) / 10} cm`;
  if (m < 1000) return `${m < 10 ? Math.round(m * 100) / 100 : Math.round(m)} m`;
  return `${Math.round(m / 1000).toLocaleString('en-US')} km`;
}
