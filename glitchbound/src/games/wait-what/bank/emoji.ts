/**
 * Emoji puzzles: a row of emoji to decode. [emoji, answers, fact]; answers are "Right|Wrong|Wrong|Wrong"
 * (the right one first, shuffled when shown). Decoys must not fit the emoji just as well.
 * Append only: a puzzle's id is its position.
 */
export type EmojiQ = readonly [emoji: string, answers: string, fact: string];

/** Films and books. */
export const EMOJI_TITLES: EmojiQ[] = [
  ['🦁👑', 'The Lion King|Madagascar|The Jungle Book|Zootopia', 'The Lion King came out in 1994 and is still one of the best-selling home videos ever.'],
  ['🧊🚢💔', 'Titanic|Frozen|Moby Dick|Life of Pi', 'Titanic (1997) won 11 Oscars, tying the record.'],
  ['👽📞🏠', 'E.T. the Extra-Terrestrial|Alien|Close Encounters|Lilo & Stitch', '“E.T. phone home.” The film came out in 1982.'],
  ['🦖🏝️🧬', 'Jurassic Park|King Kong|Godzilla|The Land Before Time', 'Jurassic Park (1993). Most of its “Jurassic” dinosaurs actually lived in the Cretaceous.'],
  ['🐠🔍', 'Finding Nemo|The Little Mermaid|Shark Tale|Aquaman', 'Finding Nemo (2003). Clownfish are all born male; the biggest can turn female.'],
  ['🕰️🔙🚗', 'Back to the Future|Groundhog Day|Cars|Interstellar', 'Back to the Future (1985): 88 miles per hour and 1.21 gigawatts.'],
  ['🧙‍♂️💍🌋', 'The Lord of the Rings|Harry Potter|The Chronicles of Narnia|Game of Thrones', 'Tolkien’s book came out in 1954–55; the films followed from 2001.'],
  ['❄️👸⛄', 'Frozen|Snow White|Cinderella|Brave', 'Frozen (2013) was loosely based on Hans Christian Andersen’s “The Snow Queen”.'],
  ['🏠🎈👴', 'Up|Home Alone|Toy Story|Coco', 'Up (2009). It would take millions of party balloons to lift a real house.'],
  ['🐀👨‍🍳', 'Ratatouille|Kung Fu Panda|Stuart Little|Chicken Run', 'Ratatouille (2007). Pixar’s team took cooking classes to get the kitchen right.'],
  ['🦈🏖️😱', 'Jaws|Baywatch|Moana|Free Willy', 'Jaws (1975). The mechanical shark broke so often that it barely appears in the first half.'],
  ['🤖❤️🌱', 'WALL-E|Big Hero 6|The Iron Giant|I, Robot', 'WALL-E (2008) has almost no dialogue in its first 40 minutes.'],
  ['🍫🏭🎫', 'Charlie and the Chocolate Factory|Matilda|The BFG|James and the Giant Peach', 'Roald Dahl’s book came out in 1964. Only five golden tickets were ever hidden.'],
  ['🧛🏰🦇', 'Dracula|Batman|Frankenstein|The Addams Family', 'Bram Stoker’s Dracula was published in 1897.'],
  ['🎃🎄💀', 'The Nightmare Before Christmas|Coco|Corpse Bride|Hocus Pocus', 'The Nightmare Before Christmas (1993) took three years of stop-motion filming.'],
  ['👻🚫', 'Ghostbusters|Casper|Beetlejuice|Scooby-Doo', 'Ghostbusters (1984). Who you gonna call?'],
  ['🌪️👠🦁', 'The Wizard of Oz|Twister|Cinderella|The Lion King', 'In L. Frank Baum’s 1900 book, Dorothy’s slippers are silver. The film made them ruby red.'],
  ['🐝🎬', 'Bee Movie|A Bug’s Life|Antz|Honey, I Shrunk the Kids', 'Bee Movie (2007), whose opening monologue became one of the internet’s longest-running jokes.'],
  ['🕷️🧑', 'Spider-Man|Ant-Man|Charlotte’s Web|Arachnophobia', 'Spider-Man first swung into a comic in 1962.'],
  ['👸🐸', 'The Princess and the Frog|Shrek|Tangled|Enchanted', 'The Princess and the Frog (2009) introduced Tiana, Disney’s first Black princess.'],
  ['🧜‍♀️🦀🎶', 'The Little Mermaid|Moana|Finding Dory|Splash', 'The Little Mermaid (1989), based on Hans Christian Andersen’s much sadder 1837 tale.'],
  ['🐼🥋', 'Kung Fu Panda|The Karate Kid|Mulan|Big Hero 6', 'Kung Fu Panda (2008). Real giant pandas spend up to 14 hours a day eating.'],
  ['🍎👸☠️', 'Snow White|Sleeping Beauty|Cinderella|Rapunzel', 'Snow White and the Seven Dwarfs (1937) was the first full-length cel-animated feature.'],
  ['🤠🧸🚀', 'Toy Story|Cars|Paddington|Monsters, Inc.', 'Toy Story (1995) was the first fully computer-animated feature film.'],
  ['👹🚪😱', 'Monsters, Inc.|Shrek|Coco|Inside Out', 'Monsters, Inc. (2001). Sulley has over two million individually animated hairs.'],
  ['💀🎸🌼', 'Coco|Encanto|Soul|Turning Red', 'Coco (2017) is set on Mexico’s Day of the Dead, when marigolds guide spirits home.'],
];

/** Sayings and idioms. */
export const EMOJI_SAYINGS: EmojiQ[] = [
  ['🌧️🐱🐶', 'It’s raining cats and dogs|Fighting like cats and dogs|Let sleeping dogs lie|Curiosity killed the cat', 'Raining cats and dogs: pouring down. Nobody is quite sure where the phrase comes from.'],
  ['🐘🏠', 'The elephant in the room|A white elephant|A bull in a china shop|When pigs fly', 'The elephant in the room: an obvious problem nobody wants to talk about.'],
  ['🍰🍴🍰', 'Have your cake and eat it too|A piece of cake|The icing on the cake|Let them eat cake', 'Having your cake and eating it: wanting two things that cannot both happen.'],
  ['🥚🧺', 'Don’t put all your eggs in one basket|Walking on eggshells|Chicken or the egg|Egg on your face', 'All your eggs in one basket: risking everything on a single plan.'],
  ['🐦🐦🪨', 'Kill two birds with one stone|A bird in the hand|The early bird catches the worm|Birds of a feather', 'Two birds with one stone: getting two things done with one action.'],
  ['🌙🔵', 'Once in a blue moon|Over the moon|Out of the blue|Shoot for the moon', 'A blue moon is a second full moon in one calendar month. It happens about every two and a half years.'],
  ['⏰💰', 'Time is money|Money talks|Make up for lost time|Pay through the nose', 'Time is money: often credited to Benjamin Franklin, in 1748.'],
  ['🐱👅❓', 'Cat got your tongue?|Let the cat out of the bag|Curiosity killed the cat|Copycat', 'Cat got your tongue? Asked when someone suddenly goes quiet.'],
  ['💔🦵', 'Break a leg|Cost an arm and a leg|Pulling your leg|Cold feet', 'Break a leg: theater people say it because wishing “good luck” is meant to bring bad luck.'],
  ['🐟💧🚫', 'A fish out of water|There are plenty more fish in the sea|Something smells fishy|Swimming against the tide', 'A fish out of water: someone in a place where they do not fit in.'],
];
