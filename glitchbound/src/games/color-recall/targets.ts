/**
 * The curated colour set. Every target is an everyday, widely recognised colour reference (signs,
 * vehicles, food, gems, nature) paired with an original, simplified silhouette drawn in Glyph.tsx.
 * No company names, logos or trademarked colour names are used. Hex values are the commonly
 * published reference values for each colour (e.g. the standard sign or paint shade).
 */

import { hexToRgb, hsbToRgb, hueName, rgbToHex, rgbToHsb } from './color';

export type GlyphId =
  | 'octagon'
  | 'bus'
  | 'bell'
  | 'cone'
  | 'bridge'
  | 'car'
  | 'ball'
  | 'sign'
  | 'mailbox'
  | 'egg'
  | 'feather'
  | 'fruit'
  | 'drop'
  | 'leaf'
  | 'mug'
  | 'bubble'
  | 'can'
  | 'flower'
  | 'cloud'
  | 'canvas'
  | 'gem'
  | 'star'
  | 'tag'
  | 'medal'
  | 'marker'
  | 'house'
  | 'pot'
  | 'fish'
  | 'bird'
  | 'popsicle'
  | 'moon'
  | 'wave';

export interface ColorTarget {
  id: string;
  name: string;
  /** One short clue, shown with the silhouette. */
  hint: string;
  hex: string;
  glyph: GlyphId;
}

export const TARGETS: ColorTarget[] = [
  { id: 'stop-sign', name: 'Stop Sign Red', hint: 'Eight sides. Everybody brakes.', hex: '#C8102E', glyph: 'octagon' },
  { id: 'school-bus', name: 'School Bus Yellow', hint: 'The morning ride, standard since 1939.', hex: '#FFD800', glyph: 'bus' },
  { id: 'fire-engine', name: 'Fire Engine Red', hint: 'Sirens, ladders and a shiny bell.', hex: '#CE2029', glyph: 'bell' },
  { id: 'safety-orange', name: 'Traffic Cone Orange', hint: 'Road work ahead.', hex: '#FF7900', glyph: 'cone' },
  { id: 'bridge-orange', name: 'Suspension Bridge Orange', hint: 'The famous bay bridge is not golden at all.', hex: '#C0362C', glyph: 'bridge' },
  { id: 'taxi', name: 'Taxi Yellow', hint: 'Raise your hand on a big-city corner.', hex: '#F7B500', glyph: 'car' },
  { id: 'tennis-ball', name: 'Tennis Ball Yellow', hint: 'Fuzzy, bouncy and easy to see on TV.', hex: '#DFFF4F', glyph: 'ball' },
  { id: 'highway-green', name: 'Highway Sign Green', hint: 'Next exit, two miles.', hex: '#006B45', glyph: 'sign' },
  { id: 'exit-green', name: 'Emergency Exit Green', hint: 'Follow it to the door.', hex: '#00A651', glyph: 'sign' },
  { id: 'post-box', name: 'Post Box Red', hint: 'Letters go in the slot.', hex: '#D2232A', glyph: 'mailbox' },
  { id: 'robin-egg', name: 'Robin Egg Blue', hint: 'Found in a spring nest.', hex: '#00CCCC', glyph: 'egg' },
  { id: 'flamingo', name: 'Flamingo Pink', hint: 'Standing on one leg.', hex: '#FC8EAC', glyph: 'feather' },
  { id: 'lemon', name: 'Lemon Yellow', hint: 'Sour, sunny, squeezable.', hex: '#FFF44F', glyph: 'fruit' },
  { id: 'tangerine', name: 'Tangerine', hint: 'Easy to peel, hard to share.', hex: '#F28500', glyph: 'fruit' },
  { id: 'cherry', name: 'Cherry Red', hint: 'On top of the sundae.', hex: '#D2042D', glyph: 'fruit' },
  { id: 'lime', name: 'Lime Zest', hint: 'Grated over everything.', hex: '#9FD037', glyph: 'fruit' },
  { id: 'eggplant', name: 'Eggplant', hint: 'Glossy, deep and roasted.', hex: '#614051', glyph: 'drop' },
  { id: 'pumpkin', name: 'Pumpkin', hint: 'Carved every October.', hex: '#FF7518', glyph: 'fruit' },
  { id: 'avocado', name: 'Avocado', hint: 'The skin, not the toast.', hex: '#568203', glyph: 'egg' },
  { id: 'mint', name: 'Mint Leaf', hint: 'Fresh from the herb pot.', hex: '#3EB489', glyph: 'leaf' },
  { id: 'matcha', name: 'Matcha', hint: 'Whisked, not steeped.', hex: '#8DB255', glyph: 'mug' },
  { id: 'espresso', name: 'Espresso', hint: 'One small, strong cup.', hex: '#4E312D', glyph: 'mug' },
  { id: 'bubblegum', name: 'Bubblegum Pink', hint: 'Chew, blow, pop.', hex: '#FFC1CC', glyph: 'bubble' },
  { id: 'grape-soda', name: 'Grape Soda', hint: 'Fizzy and very purple.', hex: '#6F2DA8', glyph: 'can' },
  { id: 'lavender', name: 'Lavender', hint: 'Fields of it in summer.', hex: '#B57EDC', glyph: 'flower' },
  { id: 'sunflower', name: 'Sunflower', hint: 'Always facing the sun.', hex: '#FFC512', glyph: 'flower' },
  { id: 'sky', name: 'Sky Blue', hint: 'A clear afternoon.', hex: '#87CEEB', glyph: 'cloud' },
  { id: 'klein-blue', name: 'International Klein Blue', hint: 'An artist patented this ultramarine in 1960.', hex: '#002FA7', glyph: 'canvas' },
  { id: 'emerald', name: 'Emerald', hint: 'The May birthstone.', hex: '#50C878', glyph: 'gem' },
  { id: 'ruby', name: 'Ruby', hint: 'The July birthstone.', hex: '#E0115F', glyph: 'gem' },
  { id: 'sapphire', name: 'Sapphire', hint: 'The September birthstone.', hex: '#0F52BA', glyph: 'gem' },
  { id: 'amethyst', name: 'Amethyst', hint: 'The February birthstone.', hex: '#9966CC', glyph: 'gem' },
  { id: 'turquoise', name: 'Turquoise', hint: 'A stone named after a country.', hex: '#40E0D0', glyph: 'drop' },
  { id: 'pool', name: 'Swimming Pool Blue', hint: 'Cannonball!', hex: '#2EB8E6', glyph: 'wave' },
  { id: 'navy', name: 'Navy Blue', hint: 'Admirals and blazers.', hex: '#000080', glyph: 'star' },
  { id: 'denim', name: 'Denim', hint: 'Your favourite jeans.', hex: '#1560BD', glyph: 'tag' },
  { id: 'khaki', name: 'Khaki', hint: 'Safari shorts.', hex: '#C3B091', glyph: 'tag' },
  { id: 'gold', name: 'Gold Medal', hint: 'First place.', hex: '#D4AF37', glyph: 'medal' },
  { id: 'silver', name: 'Silver Medal', hint: 'So close.', hex: '#C0C0C0', glyph: 'medal' },
  { id: 'bronze', name: 'Bronze Medal', hint: 'Still on the podium.', hex: '#CD7F32', glyph: 'medal' },
  { id: 'chalkboard', name: 'Chalkboard Green', hint: 'Back to school.', hex: '#2E4A3B', glyph: 'canvas' },
  { id: 'highlighter-yellow', name: 'Highlighter Yellow', hint: 'This part is on the test.', hex: '#FFFF33', glyph: 'marker' },
  { id: 'highlighter-pink', name: 'Highlighter Pink', hint: 'Also on the test.', hex: '#FF1DCE', glyph: 'marker' },
  { id: 'barn-red', name: 'Barn Red', hint: 'Out in the countryside.', hex: '#7C0A02', glyph: 'house' },
  { id: 'brick', name: 'Brick Red', hint: 'The third little pig built with it.', hex: '#CB4154', glyph: 'house' },
  { id: 'sage', name: 'Sage', hint: 'Dusty, soft, herby.', hex: '#BCB88A', glyph: 'leaf' },
  { id: 'terracotta', name: 'Terracotta', hint: 'Fired clay plant pots.', hex: '#E2725B', glyph: 'pot' },
  { id: 'salmon', name: 'Salmon', hint: 'Swims upstream.', hex: '#FA8072', glyph: 'fish' },
  { id: 'goldfish', name: 'Goldfish Orange', hint: 'Three-second memory. Not yours, though.', hex: '#F38D20', glyph: 'fish' },
  { id: 'canary', name: 'Canary Yellow', hint: 'A singing songbird.', hex: '#FFEF00', glyph: 'bird' },
  { id: 'cardinal', name: 'Cardinal Red', hint: 'A crested songbird in the snow.', hex: '#C41E3A', glyph: 'bird' },
  { id: 'rubber-duck', name: 'Rubber Duck Yellow', hint: 'Squeaky bath-time buddy.', hex: '#FFD300', glyph: 'bird' },
  { id: 'pistachio', name: 'Pistachio', hint: 'The ice cream flavour.', hex: '#93C572', glyph: 'popsicle' },
  { id: 'raspberry', name: 'Raspberry', hint: 'Sorbet on a hot day.', hex: '#E30B5C', glyph: 'popsicle' },
  { id: 'mango', name: 'Mango', hint: 'Tropical and juicy.', hex: '#FFC324', glyph: 'popsicle' },
  { id: 'midnight', name: 'Midnight Blue', hint: 'Well past bedtime.', hex: '#191970', glyph: 'moon' },
  { id: 'lilac', name: 'Lilac', hint: 'A spring blossom.', hex: '#C8A2C8', glyph: 'flower' },
  { id: 'peach', name: 'Peach', hint: 'Soft and fuzzy.', hex: '#FFCBA4', glyph: 'fruit' },
  { id: 'olive', name: 'Olive', hint: 'In the martini.', hex: '#808000', glyph: 'egg' },
  { id: 'banana', name: 'Banana Yellow', hint: 'Ripe, not spotty yet.', hex: '#FFE135', glyph: 'fruit' },
  { id: 'watermelon', name: 'Watermelon Pink', hint: 'Mind the seeds.', hex: '#FC6C85', glyph: 'fruit' },
  { id: 'plum', name: 'Plum', hint: 'Sweet, dark, juicy.', hex: '#8E4585', glyph: 'fruit' },
  { id: 'cornflower', name: 'Cornflower Blue', hint: 'A wildflower in a wheat field.', hex: '#6495ED', glyph: 'flower' },
  { id: 'poppy', name: 'Poppy Red', hint: 'A field flower with a dark centre.', hex: '#E35335', glyph: 'flower' },
  { id: 'marigold', name: 'Marigold', hint: 'Bright garden petals.', hex: '#EAA221', glyph: 'flower' },
  { id: 'seafoam', name: 'Seafoam', hint: 'Where the waves break.', hex: '#93E9BE', glyph: 'wave' },
  { id: 'teal', name: 'Teal', hint: 'Named after a little duck.', hex: '#008080', glyph: 'drop' },
  { id: 'slate', name: 'Slate Grey', hint: 'Roof tiles in the rain.', hex: '#708090', glyph: 'house' },
  { id: 'coral', name: 'Coral', hint: 'Reef life, warm and pink-orange.', hex: '#FF7F50', glyph: 'bubble' },
];

const WILD_GLYPHS: GlyphId[] = ['drop', 'canvas', 'gem', 'star', 'bubble', 'cloud', 'leaf', 'wave', 'moon', 'flower'];
const WILD_NOUNS = ['Mist', 'Glow', 'Dream', 'Splash', 'Haze', 'Pop', 'Wave', 'Fizz', 'Bloom', 'Echo', 'Spark', 'Velvet'];

/**
 * A "wild card": any colour at all, named from its hue, brightness and vividness ("Dusty Teal Haze").
 * Wild cards have no famous reference, so the curated list never runs dry. The id carries the hex, so
 * a saved result always resolves back to the same target.
 */
export function wildTarget(hex: string): ColorTarget {
  const H = hex.toUpperCase();
  const hsb = rgbToHsb(hexToRgb(H));
  const n = parseInt(H.slice(1), 16);
  const mood = hsb.b < 38 ? 'Deep' : hsb.s < 22 ? 'Dusty' : hsb.b > 85 && hsb.s < 40 ? 'Pale' : hsb.s > 80 && hsb.b > 80 ? 'Electric' : hsb.s > 60 ? 'Bold' : 'Soft';
  const hue = hsb.s < 10 ? 'Grey' : hueName(hsb.h).replace(/^./, (c) => c.toUpperCase());
  return {
    id: `wild-${H.slice(1)}`,
    name: `${mood} ${hue} ${WILD_NOUNS[n % WILD_NOUNS.length]}`,
    hint: 'Wild card: a one-off color with no famous reference.',
    hex: H,
    glyph: WILD_GLYPHS[(n >> 4) % WILD_GLYPHS.length]!,
  };
}

/** A random wild card that is pleasant to look at (not near-black or near-grey mud). */
export function randomWild(random: () => number): ColorTarget {
  const h = Math.floor(random() * 360);
  const s = 25 + Math.floor(random() * 70);
  const b = 40 + Math.floor(random() * 58);
  return wildTarget(rgbToHex(hsbToRgb({ h, s, b })));
}

export function targetById(id: string): ColorTarget | undefined {
  const m = /^wild-([0-9A-F]{6})$/i.exec(id);
  if (m) return wildTarget(`#${m[1]}`);
  return TARGETS.find((t) => t.id === id);
}
