/**
 * "Type it" questions: no choices, you type the answer. [question, accepted answers, fact]. Accepted
 * answers are "|"-separated, the first one is shown; matching ignores case, accents, punctuation,
 * a leading "the/a/an" and small typos. Keep answers short and unambiguous.
 * Append only: a question's id is its position.
 */
export type Typed = readonly [question: string, accepted: string, fact: string];

export const TYPED: Typed[] = [
  ['Which planet has a day that lasts longer than its year?', 'Venus', 'Venus takes 243 Earth days to spin once, but only 225 to go around the Sun.'],
  ['Which letter of the alphabet does not appear in any US state name?', 'Q', 'From Alabama to Wyoming, not one state has a Q in its name.'],
  ['Which country has the most pyramids?', 'Sudan', 'Sudan has over 200 Nubian pyramids, about twice as many as Egypt.'],
  ['Which animal’s fingerprints are so like ours they could confuse a crime scene?', 'Koala|Koalas', 'Koala fingerprints have loops and whorls almost impossible to tell apart from human ones, even under a microscope.'],
  ['Under its fur, what color is a polar bear’s skin?', 'Black', 'Black skin soaks up heat. The fur is not white either: each hair is clear and hollow.'],
  ['Which bone in your body is not connected to any other bone?', 'Hyoid|Hyoid bone', 'The horseshoe-shaped hyoid in your throat floats, held in place only by muscles.'],
  ['What is the national animal of Scotland?', 'Unicorn|Unicorns', 'The unicorn has been a Scottish symbol for centuries. On the royal coat of arms it faces England’s lion.'],
  ['Which metal is liquid at room temperature?', 'Mercury', 'Mercury melts at −39 °C. Gallium melts in your hand, but only at about 30 °C.'],
  ['Which food can stay edible for thousands of years if sealed?', 'Honey', 'Pots of honey found in ancient Egyptian tombs were still edible. Bacteria cannot grow in it.'],
  ['What is the little plastic tube on the end of a shoelace called?', 'Aglet|Aglets', 'An aglet. The word comes from the Old French for “needle”.'],
  ['A group of crows is called a … ?', 'Murder', 'A murder of crows. Owls come in a parliament and ravens in an unkindness.'],
  ['What is the small dot over a lowercase i or j called?', 'Tittle|Tittles', 'A tittle. “To a T” may come from “to a tittle”, meaning to the smallest detail.'],
  ['Which planet spins on its side?', 'Uranus', 'Uranus is tipped over by about 98 degrees, probably after a giant collision long ago.'],
  ['What did Pluto become in 2006?', 'Dwarf planet|Dwarf|Plutoid', 'Astronomers reclassified it as a dwarf planet because it has not cleared its orbit of other objects.'],
  ['The Turkish city of Batman sits on which river?', 'Batman|Batman River', 'The Batman River. The city is named after it, and the river’s name is far older than the comic.'],
  ['What does the “Q” in Q-tips stand for?', 'Quality', 'Quality. They were first sold in the 1920s as “Baby Gays”, then renamed Q-tips Baby Gays, then just Q-tips.'],
  ['Which chess piece can only ever move diagonally?', 'Bishop|Bishops', 'The bishop. That means each one spends the whole game on squares of one color.'],
  ['What is a baby kangaroo called?', 'Joey', 'A joey. Newborn joeys are about the size of a jellybean.'],
  ['Which is the only bird that can fly backwards?', 'Hummingbird|Hummingbirds', 'Hummingbirds beat their wings in a figure of eight, so they can hover and even reverse.'],
  ['What is the smallest country in the world?', 'Vatican City|Vatican|Holy See', 'Vatican City covers about 0.44 km², smaller than many city parks.'],
  ['Before pumpkins, which vegetable did people in Ireland carve for Halloween?', 'Turnip|Turnips|Swede|Rutabaga', 'Turnips (and swedes). Irish immigrants in America switched to pumpkins, which were bigger and easier to carve.'],
  ['Which play by Shakespeare opens with the ghost of a murdered king?', 'Hamlet', 'Hamlet. The ghost of his father asks him for revenge in the very first act.'],
  ['What is the name of the ancient Celtic festival that Halloween grew out of?', 'Samhain', 'Samhain, pronounced “SOW-in”, marked the end of the harvest and the start of winter.'],
  ['What is the most common letter in English?', 'E', 'E, by a wide margin. That is why it is worth just one point in Scrabble.'],
  ['Which country gave the Statue of Liberty to the United States?', 'France', 'France, in 1886. It was shipped across the Atlantic in 350 pieces.'],
  ['What color is the black box flight recorder on a plane?', 'Orange', 'Bright orange, so it can be found in wreckage.'],
  ['What is the only mammal that can truly fly?', 'Bat|Bats', 'Bats. “Flying” squirrels and lemurs only glide.'],
  ['Which fruit floats because it is about a quarter air?', 'Apple|Apples', 'Apples, which is why apple bobbing works.'],
  ['What is the hardest natural substance on Earth?', 'Diamond|Diamonds', 'Diamond. It is just carbon, the same element as the graphite in a pencil.'],
  ['Which ocean is the biggest?', 'Pacific|Pacific Ocean', 'The Pacific covers about a third of the planet, more than all the land put together.'],
];
