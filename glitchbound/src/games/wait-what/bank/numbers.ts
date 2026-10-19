/**
 * "Guess the number" questions, answered with the lever (a slider with − and + buttons). Full points
 * within `tol` of the answer, some points up to `near`. The slider's range must not give the answer
 * away, so it is never centerd on it. Append only: a question's id is its position.
 */
export interface NumberQ {
  q: string;
  answer: number;
  min: number;
  max: number;
  step: number;
  /** Full points when the guess is this close (or closer). */
  tol: number;
  /** Some points up to this far off. */
  near: number;
  unit?: string;
  fact: string;
}

export const NUMBERS: NumberQ[] = [
  { q: 'How many hearts does an octopus have?', answer: 3, min: 0, max: 10, step: 1, tol: 0, near: 1, fact: 'Two pump blood through the gills, the third pumps it around the rest of the body.' },
  { q: 'How many bones are in an adult human body?', answer: 206, min: 50, max: 500, step: 1, tol: 4, near: 40, fact: 'Babies are born with around 300. Many of them fuse together as we grow.' },
  { q: 'How many keys does a standard piano have?', answer: 88, min: 20, max: 160, step: 1, tol: 0, near: 12, fact: '52 white keys and 36 black ones, covering a little over seven octaves.' },
  { q: 'How many teeth does an adult have, wisdom teeth included?', answer: 32, min: 10, max: 70, step: 1, tol: 0, near: 4, fact: 'Thirty-two, although plenty of people never grow all four wisdom teeth.' },
  { q: 'The Hundred Years’ War lasted how many years?', answer: 116, min: 40, max: 200, step: 1, tol: 1, near: 20, fact: 'It ran from 1337 to 1453, with long truces in between.' },
  { q: 'How many countries are there in Africa?', answer: 54, min: 10, max: 90, step: 1, tol: 0, near: 6, fact: 'Fifty-four countries are UN members, more than on any other continent.' },
  { q: 'How many squares of any size are on a chessboard?', answer: 204, min: 64, max: 500, step: 1, tol: 0, near: 40, fact: '64 small ones, plus every 2×2, 3×3 and so on up to the whole board: 204 in all.' },
  { q: 'How many people have walked on the Moon?', answer: 12, min: 0, max: 40, step: 1, tol: 0, near: 3, fact: 'Twelve astronauts, all on Apollo missions between 1969 and 1972.' },
  { q: 'How many seconds did the Wright brothers’ first powered flight last?', answer: 12, min: 0, max: 120, step: 1, tol: 1, near: 15, fact: 'Twelve seconds and about 37 meters, in December 1903. A jumbo jet is longer than that flight.' },
  { q: 'How many eyes do most spiders have?', answer: 8, min: 0, max: 20, step: 1, tol: 0, near: 2, fact: 'Most have eight, some have six, and a few cave spiders have none at all.' },
  { q: 'How many different words did Dr. Seuss use to write “Green Eggs and Ham”?', answer: 50, min: 0, max: 600, step: 5, tol: 0, near: 40, fact: 'Exactly fifty. His publisher bet him he could not write a book with so few.' },
  { q: 'Roughly how many litres of blood does an adult body hold?', answer: 5, min: 0, max: 20, step: 0.5, tol: 0.5, near: 2.5, unit: 'L', fact: 'About 5 litres, pumped around the whole body roughly once a minute.' },
  { q: 'How many time zones does Russia stretch across?', answer: 11, min: 1, max: 24, step: 1, tol: 0, near: 2, fact: 'Eleven. When it is breakfast time in Kaliningrad, it is evening in Kamchatka.' },
  { q: 'How many lines are there in a sonnet?', answer: 14, min: 4, max: 40, step: 1, tol: 0, near: 2, fact: 'Fourteen, whether Italian or Shakespearean.' },
  { q: 'How many players does a rugby union team have on the pitch?', answer: 15, min: 5, max: 30, step: 1, tol: 0, near: 2, fact: 'Fifteen. Rugby league uses thirteen and rugby sevens, well, seven.' },
  { q: 'How long is a marathon, to the nearest kilometer?', answer: 42, min: 10, max: 100, step: 1, tol: 0, near: 5, unit: 'km', fact: '42.195 km, fixed by the route of the 1908 London Olympics, from Windsor Castle to the royal box.' },
  { q: 'How old was Mozart when he wrote his first symphony?', answer: 8, min: 0, max: 40, step: 1, tol: 0, near: 4, unit: 'years', fact: 'Eight. He wrote it in London in 1764.' },
  { q: 'How old was the oldest person ever verified, in years?', answer: 122, min: 90, max: 160, step: 1, tol: 0, near: 5, unit: 'years', fact: 'Jeanne Calment of France lived to 122 years and 164 days.' },
  { q: 'How many strings does a modern concert harp have?', answer: 47, min: 10, max: 100, step: 1, tol: 1, near: 12, fact: 'Usually 47, plus seven pedals that change their pitch.' },
  { q: 'How many bones are in a giraffe’s neck?', answer: 7, min: 0, max: 40, step: 1, tol: 0, near: 3, fact: 'Seven, the same number as in yours. Each one can be over 25 cm long.' },
  { q: 'Up to how many hours a day can a koala sleep?', answer: 20, min: 0, max: 24, step: 1, tol: 2, near: 6, unit: 'hours', fact: 'Around 18 to 22 hours. Eucalyptus leaves give them very little energy.' },
  { q: 'Roughly how fast can a cheetah sprint?', answer: 110, min: 20, max: 250, step: 5, tol: 10, near: 40, unit: 'km/h', fact: 'Around 100 to 120 km/h, but only for a few hundred meters.' },
  { q: 'About how many minutes does sunlight take to reach Earth?', answer: 8, min: 0, max: 60, step: 1, tol: 0, near: 4, unit: 'min', fact: 'About 8 minutes 20 seconds. You always see the Sun as it was a little while ago.' },
  { q: 'How many letters are in the longest word in major English dictionaries?', answer: 45, min: 10, max: 120, step: 1, tol: 0, near: 8, fact: 'Pneumonoultramicroscopicsilicovolcanoconiosis: 45 letters, a lung disease from volcanic dust.' },
  { q: 'How many dots are there on a standard six-sided die, in total?', answer: 21, min: 6, max: 60, step: 1, tol: 0, near: 4, fact: '1 + 2 + 3 + 4 + 5 + 6 = 21. Opposite faces always add up to seven.' },
  { q: 'About how deep is the deepest point of the ocean?', answer: 11, min: 0, max: 30, step: 0.5, tol: 0.5, near: 4, unit: 'km', fact: 'Challenger Deep in the Mariana Trench is about 10.9 km down. Everest would fit with room to spare.' },
  { q: 'How tall is Mount Everest?', answer: 8849, min: 4000, max: 12000, step: 10, tol: 60, near: 700, unit: 'm', fact: '8,849 m, as measured by China and Nepal together in 2020.' },
  { q: 'How tall is the Eiffel Tower, antennas included?', answer: 330, min: 100, max: 700, step: 5, tol: 15, near: 90, unit: 'm', fact: 'About 330 m. Its iron also expands in summer heat, making it up to 15 cm taller.' },
  { q: 'How many sides does a UK 50p coin have?', answer: 7, min: 3, max: 20, step: 1, tol: 0, near: 1, fact: 'Seven, with curved edges so it still rolls smoothly through coin machines.' },
  { q: 'How many dimples does a typical golf ball have?', answer: 336, min: 50, max: 900, step: 2, tol: 70, near: 250, fact: 'Most have between 300 and 500. The dimples help the ball fly about twice as far.' },
  { q: 'How many Earths could fit inside the Sun, in thousands?', answer: 1300, min: 0, max: 6000, step: 50, tol: 200, near: 900, unit: 'thousand', fact: 'About 1.3 million, if you could squash them in without gaps.' },
  { q: 'How many legs does a lobster have, claws included?', answer: 10, min: 2, max: 30, step: 1, tol: 0, near: 2, fact: 'Ten: lobsters are decapods, which literally means “ten feet”.' },
  { q: 'How many years did it take to build the Panama Canal, counting the US work from 1904?', answer: 10, min: 1, max: 60, step: 1, tol: 1, near: 6, unit: 'years', fact: 'The US work ran from 1904 to 1914, after a failed French attempt in the 1880s.' },
  { q: 'Bees must visit about how many million flowers to make a kilogram of honey?', answer: 4, min: 0, max: 30, step: 0.5, tol: 1, near: 4, unit: 'million', fact: 'Roughly four million, flying a distance of several trips around the Earth.' },
  { q: 'How many hours long is a day on Venus, roughly? (One full spin.)', answer: 5832, min: 10, max: 9000, step: 10, tol: 250, near: 2000, unit: 'hours', fact: 'About 5,832 hours, or 243 Earth days. Its year is only 225 Earth days.' },
  { q: 'At what temperature, in °C, do the Celsius and Fahrenheit scales meet?', answer: -40, min: -100, max: 100, step: 1, tol: 0, near: 10, unit: '°C', fact: '−40 °C is exactly −40 °F.' },
  { q: 'How many years passed between the first Moon landing and the first iPhone?', answer: 38, min: 0, max: 80, step: 1, tol: 1, near: 6, unit: 'years', fact: 'From July 1969 to June 2007: 38 years.' },
  { q: 'How many Lego bricks does it take to reach the height of the Eiffel Tower, in thousands?', answer: 34, min: 0, max: 200, step: 1, tol: 3, near: 20, unit: 'thousand', fact: 'A standard brick is 9.6 mm tall, so about 34,000 stacked bricks reach 330 m.' },
  { q: 'How many times does the average heart beat in a day, in thousands?', answer: 100, min: 10, max: 400, step: 5, tol: 15, near: 60, unit: 'thousand', fact: 'Around 100,000 beats a day, about 2.5 billion in a lifetime.' },
  { q: 'How many Olympic rings are there on the Olympic flag?', answer: 5, min: 1, max: 12, step: 1, tol: 0, near: 1, fact: 'Five. With the white background, their six colors were chosen so every national flag of 1913 had at least one of them.' },
];
