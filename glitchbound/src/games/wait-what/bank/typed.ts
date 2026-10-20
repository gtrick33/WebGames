/**
 * "Type it" questions: no choices, you type the answer. [question, accepted answers, fact]. Accepted
 * answers are "|"-separated, the first one is shown; matching ignores case, accents, punctuation,
 * a leading "the/a/an" and small typos. Keep answers short and unambiguous.
 * Append only: a question's id is its position.
 */
export type Typed = readonly [question: string, accepted: string, fact: string];

export const TYPED: Typed[] = [
  ['What is the longest bone in the human body?', 'Femur|Thigh bone|Thighbone', 'It runs from hip to knee and makes up about a quarter of your height.'],
  ['Which planet has the shortest day, spinning once in under 10 hours?', 'Jupiter', 'The biggest planet spins the fastest: a day there lasts about 9 hours and 56 minutes.'],
  ['In which country is most of the Amazon rainforest?', 'Brazil', 'About 60% of it lies in Brazil. The rest is spread over eight other countries and territories.'],
  ['Which gas makes up most of the air we breathe?', 'Nitrogen', 'About 78% of air is nitrogen. Oxygen is only about 21%.'],
  ['What is a baby swan called?', 'Cygnet|Cygnets', 'Cygnets are gray and fluffy, and often ride around on a parent’s back.'],
  ['What is the capital of Canada?', 'Ottawa', 'Queen Victoria chose it in 1857, partly because it sat between English- and French-speaking Canada.'],
  ['What is the chemical symbol for gold?', 'Au', 'From the Latin aurum. Silver’s symbol, Ag, comes from argentum.'],
  ['What is the name of the galaxy we live in?', 'Milky Way|The Milky Way', 'It holds somewhere between 100 and 400 billion stars, and our Sun is just one of them.'],
  ['What do you call a word that reads the same backwards, like “level”?', 'Palindrome|A palindrome', 'Whole sentences can do it too: “Was it a car or a cat I saw?”'],
  ['In which country is the ancient city of Petra?', 'Jordan', 'Its buildings were carved straight into pink sandstone cliffs over 2,000 years ago.'],
  ['What is the tallest animal in the world?', 'Giraffe|A giraffe|Giraffes', 'Males can reach about 5.5 m, and their tongues are about half a meter long.'],
  ['Which country invented paper?', 'China', 'Cai Lun is credited with improving papermaking in China around the year 105.'],
  ['What is a group of lions called?', 'Pride|A pride', 'A pride is mostly related females. Males usually stay only a few years.'],
  ['What did Pluto become in 2006?', 'Dwarf planet|Dwarf|Plutoid', 'Astronomers reclassified it as a dwarf planet because it has not cleared its orbit of other objects.'],
  ['Which is the largest organ of the human body?', 'Skin|The skin', 'Spread out, an adult’s skin would cover about 2 square meters.'],
  ['What is the closest star to Earth?', 'Sun|The Sun', 'Yes, the Sun. The next closest, Proxima Centauri, is over four light-years away.'],
  ['Which chess piece can only ever move diagonally?', 'Bishop|Bishops', 'The bishop. That means each one spends the whole game on squares of one color.'],
  ['What is a baby kangaroo called?', 'Joey', 'A joey. Newborn joeys are about the size of a jellybean.'],
  ['Which is the only bird that can fly backwards?', 'Hummingbird|Hummingbirds', 'Hummingbirds beat their wings in a figure of eight, so they can hover and even reverse.'],
  ['Which metal is the best conductor of electricity?', 'Silver', 'Copper is used for wires instead because silver costs far more.'],
  ['Before pumpkins, which vegetable did people in Ireland carve for Halloween?', 'Turnip|Turnips|Swede|Rutabaga', 'Turnips (and swedes). Irish immigrants in America switched to pumpkins, which were bigger and easier to carve.'],
  ['Which play by Shakespeare opens with the ghost of a murdered king?', 'Hamlet', 'Hamlet. The ghost of his father asks him for revenge in the very first act.'],
  ['What is the name of the ancient Celtic festival that Halloween grew out of?', 'Samhain', 'Samhain, pronounced “SOW-in”, marked the end of the harvest and the start of winter.'],
  ['What is the most common letter in English?', 'E', 'E, by a wide margin. That is why it is worth just one point in Scrabble.'],
  ['Which country gave the Statue of Liberty to the United States?', 'France', 'France, in 1886. It was shipped across the Atlantic in 350 pieces.'],
  ['What color is the black box flight recorder on a plane?', 'Orange', 'Bright orange, so it can be found in wreckage.'],
  ['Which Italian city is built on more than 100 small islands?', 'Venice', 'About 118 islands, linked by more than 400 bridges.'],
  ['Which country is shaped like a boot?', 'Italy', 'The boot even looks like it is kicking a ball: the island of Sicily.'],
  ['What is the hardest natural substance on Earth?', 'Diamond|Diamonds', 'Diamond. It is just carbon, the same element as the graphite in a pencil.'],
  ['Which ocean is the biggest?', 'Pacific|Pacific Ocean', 'The Pacific covers about a third of the planet, more than all the land put together.'],
];
