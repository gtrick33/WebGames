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
  { q: 'How many minutes does a soccer match last, without stoppage or extra time?', answer: 90, min: 30, max: 180, step: 5, tol: 0, near: 15, unit: 'minutes', fact: 'Two halves of 45 minutes. Stoppage time is added on top.' },
  { q: 'How many bones are in one human hand, wrist included?', answer: 27, min: 5, max: 70, step: 1, tol: 1, near: 8, fact: 'Your hands and feet together hold more than half of all the bones in your body.' },
  { q: 'How many keys does a standard piano have?', answer: 88, min: 20, max: 160, step: 1, tol: 0, near: 12, fact: '52 white keys and 36 black ones, covering a little over seven octaves.' },
  { q: 'How many teeth does an adult have, wisdom teeth included?', answer: 32, min: 10, max: 70, step: 1, tol: 0, near: 4, fact: 'Thirty-two, although plenty of people never grow all four wisdom teeth.' },
  { q: 'How many moons does Mars have?', answer: 2, min: 0, max: 10, step: 1, tol: 0, near: 1, fact: 'Phobos and Deimos, named after the Greek gods of fear and dread.' },
  { q: 'How many countries are there in Africa?', answer: 54, min: 10, max: 90, step: 1, tol: 0, near: 6, fact: 'Fifty-four countries are UN members, more than on any other continent.' },
  { q: 'How many players does a baseball team have on the field?', answer: 9, min: 3, max: 21, step: 1, tol: 0, near: 2, fact: 'Nine fielders, including the pitcher and the catcher.' },
  { q: 'How many arms does a typical starfish have?', answer: 5, min: 1, max: 25, step: 1, tol: 0, near: 2, fact: 'Most have five, but some species have 40 or more, and they can regrow lost ones.' },
  { q: 'How many seconds did the Wright brothers’ first powered flight last?', answer: 12, min: 0, max: 120, step: 1, tol: 1, near: 15, fact: 'Twelve seconds and about 37 meters, in December 1903. A jumbo jet is longer than that flight.' },
  { q: 'How many eyes do most spiders have?', answer: 8, min: 0, max: 20, step: 1, tol: 0, near: 2, fact: 'Most have eight, some have six, and a few cave spiders have none at all.' },
  { q: 'How many different words did Dr. Seuss use to write “Green Eggs and Ham”?', answer: 50, min: 0, max: 600, step: 5, tol: 0, near: 40, fact: 'Exactly fifty. His publisher bet him he could not write a book with so few.' },
  { q: 'Roughly how many liters of blood does an adult body hold?', answer: 5, min: 0, max: 20, step: 0.5, tol: 0.5, near: 2.5, unit: 'L', fact: 'About 5 liters, pumped around the whole body roughly once a minute.' },
  { q: 'How many time zones does Russia stretch across?', answer: 11, min: 1, max: 24, step: 1, tol: 0, near: 2, fact: 'Eleven. When it is breakfast time in Kaliningrad, it is evening in Kamchatka.' },
  { q: 'How many lines are there in a sonnet?', answer: 14, min: 4, max: 40, step: 1, tol: 0, near: 2, fact: 'Fourteen, whether Italian or Shakespearean.' },
  { q: 'How many players does a rugby union team have on the pitch?', answer: 15, min: 5, max: 30, step: 1, tol: 0, near: 2, fact: 'Fifteen. Rugby league uses thirteen and rugby sevens, well, seven.' },
  { q: 'At roughly what temperature does water boil on top of Mount Everest?', answer: 70, min: 30, max: 130, step: 1, tol: 3, near: 15, unit: '°C', fact: 'The thin air lets it boil at around 70 °C, too cool to cook pasta properly.' },
  { q: 'How old was Mozart when he wrote his first symphony?', answer: 8, min: 0, max: 40, step: 1, tol: 0, near: 4, unit: 'years', fact: 'Eight. He wrote it in London in 1764.' },
  { q: 'How old was the oldest person ever verified, in years?', answer: 122, min: 90, max: 160, step: 1, tol: 0, near: 5, unit: 'years', fact: 'Jeanne Calment of France lived to 122 years and 164 days.' },
  { q: 'How many strings does a modern concert harp have?', answer: 47, min: 10, max: 100, step: 1, tol: 1, near: 12, fact: 'Usually 47, plus seven pedals that change their pitch.' },
  { q: 'How many bones are in a giraffe’s neck?', answer: 7, min: 0, max: 40, step: 1, tol: 0, near: 3, fact: 'Seven, the same number as in yours. Each one can be over 25 cm long.' },
  { q: 'How many teeth does an adult dog have?', answer: 42, min: 10, max: 90, step: 1, tol: 0, near: 6, fact: 'Ten more than an adult human. Puppies have 28 milk teeth.' },
  { q: 'Roughly how fast can a cheetah sprint?', answer: 110, min: 20, max: 250, step: 5, tol: 10, near: 40, unit: 'km/h', fact: 'Around 100 to 120 km/h, but only for a few hundred meters.' },
  { q: 'How many stripes are on the US flag?', answer: 13, min: 3, max: 35, step: 1, tol: 0, near: 3, fact: 'One for each of the original thirteen colonies. The 50 stars stand for today’s states.' },
  { q: 'How many countries share a land border with Germany?', answer: 9, min: 2, max: 22, step: 1, tol: 0, near: 2, fact: 'Denmark, Poland, Czechia, Austria, Switzerland, France, Luxembourg, Belgium and the Netherlands.' },
  { q: 'How many dots are there on a standard six-sided die, in total?', answer: 21, min: 6, max: 60, step: 1, tol: 0, near: 4, fact: '1 + 2 + 3 + 4 + 5 + 6 = 21. Opposite faces always add up to seven.' },
  { q: 'About how deep is the deepest point of the ocean?', answer: 11, min: 0, max: 30, step: 0.5, tol: 0.5, near: 4, unit: 'km', fact: 'Challenger Deep in the Mariana Trench is about 10.9 km down. Everest would fit with room to spare.' },
  { q: 'How tall is Mount Everest?', answer: 8849, min: 4000, max: 12000, step: 10, tol: 60, near: 700, unit: 'm', fact: '8,849 m, as measured by China and Nepal together in 2020.' },
  { q: 'How tall is the Eiffel Tower, antennas included?', answer: 330, min: 100, max: 700, step: 5, tol: 15, near: 90, unit: 'm', fact: 'About 330 m. Its iron also expands in summer heat, making it up to 15 cm taller.' },
  { q: 'How many sides does a UK 50p coin have?', answer: 7, min: 3, max: 20, step: 1, tol: 0, near: 1, fact: 'Seven, with curved edges so it still rolls smoothly through coin machines.' },
  { q: 'How many legs does a butterfly have?', answer: 6, min: 0, max: 20, step: 1, tol: 0, near: 2, fact: 'Six, like every insect, though some butterflies seem to stand on only four.' },
  { q: 'How many symphonies did Beethoven finish?', answer: 9, min: 1, max: 30, step: 1, tol: 0, near: 2, fact: 'He finished the Ninth, with its “Ode to Joy”, when he was almost completely deaf.' },
  { q: 'How many legs does a lobster have, claws included?', answer: 10, min: 2, max: 30, step: 1, tol: 0, near: 2, fact: 'Ten: lobsters are decapods, which literally means “ten feet”.' },
  { q: 'How many years did it take to build the Panama Canal, counting the US work from 1904?', answer: 10, min: 1, max: 60, step: 1, tol: 1, near: 6, unit: 'years', fact: 'The US work ran from 1904 to 1914, after a failed French attempt in the 1880s.' },
  { q: 'How many players does an ice hockey team have on the ice, goalie included?', answer: 6, min: 2, max: 16, step: 1, tol: 0, near: 1, fact: 'Five skaters and a goaltender.' },
  { q: 'How many hours long is a day on Venus, roughly? (One full spin.)', answer: 5832, min: 10, max: 9000, step: 10, tol: 250, near: 2000, unit: 'hours', fact: 'About 5,832 hours, or 243 Earth days. Its year is only 225 Earth days.' },
  { q: 'At what temperature, in °C, do the Celsius and Fahrenheit scales meet?', answer: -40, min: -100, max: 100, step: 1, tol: 0, near: 10, unit: '°C', fact: '−40 °C is exactly −40 °F.' },
  { q: 'How many years passed between the first Moon landing and the first iPhone?', answer: 38, min: 0, max: 80, step: 1, tol: 1, near: 6, unit: 'years', fact: 'From July 1969 to June 2007: 38 years.' },
  { q: 'How many Lego bricks does it take to reach the height of the Eiffel Tower, in thousands?', answer: 34, min: 0, max: 200, step: 1, tol: 3, near: 20, unit: 'thousand', fact: 'A standard brick is 9.6 mm tall, so about 34,000 stacked bricks reach 330 m.' },
  { q: 'How many cards are in a standard deck, jokers not counted?', answer: 52, min: 20, max: 100, step: 1, tol: 0, near: 6, fact: 'Count ace as 1 and king as 13 and the whole deck adds up to 364. Add one joker for 365.' },
  { q: 'How many Olympic rings are there on the Olympic flag?', answer: 5, min: 1, max: 12, step: 1, tol: 0, near: 1, fact: 'Five. With the white background, their six colors were chosen so every national flag of 1913 had at least one of them.' },
];
