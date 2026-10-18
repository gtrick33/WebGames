/**
 * Charades cards: titles and names to act out. Difficulty 1 easy, 2 medium, 3 hard. Pop-culture lists
 * live here (not in UI code) so they are easy to refresh as trends change.
 */
import type { CharadesCard, CharadesCategory } from '../types';

const RAW: Record<CharadesCategory, [string, 1 | 2 | 3][]> = {
  movies: [
    ['Titanic', 1], ['Jaws', 1], ['The Lion King', 1], ['Frozen', 1], ['Toy Story', 1], ['Shrek', 1], ['Star Wars', 1], ['Jurassic Park', 1], ['Finding Nemo', 1], ['Harry Potter', 1],
    ['Home Alone', 1], ['Ghostbusters', 2], ['The Matrix', 2], ['Mamma Mia!', 2], ['Back to the Future', 2], ['The Wizard of Oz', 2], ['Pirates of the Caribbean', 2], ['Mean Girls', 2], ['Rocky', 1], ['Grease', 2],
    ['Forrest Gump', 2], ['Top Gun', 2], ['The Hunger Games', 2], ['Squid Game', 2], ['Stranger Things', 2], ['Friends', 1], ['The Office', 2], ['Breaking Bad', 3], ['Game of Thrones', 2], ['Inception', 3],
    ['The Godfather', 3], ['Pulp Fiction', 3], ['Interstellar', 3], ['Gravity', 2], ['Up', 1], ['Cars', 1], ['Ratatouille', 2], ['The Truman Show', 3], ['Jumanji', 2], ['Mission: Impossible', 2],
    ['Fast & Furious', 2], ['Barbie', 1], ['Oppenheimer', 3], ['Wednesday', 2], ['The Simpsons', 1], ['Avatar', 2], ['Gladiator', 2], ['Kung Fu Panda', 1],
  ],
  heroes: [
    ['Spider-Man', 1], ['Batman', 1], ['Superman', 1], ['Wonder Woman', 1], ['Hulk', 1], ['Iron Man', 1], ['Thor', 2], ['Captain America', 2], ['Black Panther', 2], ['Aquaman', 2],
    ['The Joker', 1], ['Thanos', 2], ['Catwoman', 2], ['Wolverine', 2], ['Doctor Strange', 3], ['Ant-Man', 2], ['The Flash', 2], ['Deadpool', 2], ['Loki', 2], ['Groot', 2],
    ['Harley Quinn', 2], ['Magneto', 3], ['Venom', 2], ['Storm', 3], ['Scarlet Witch', 3], ['Darth Vader', 1], ['Maleficent', 2], ['Voldemort', 2],
  ],
  animals: [
    ['Kangaroo', 1], ['Penguin', 1], ['Elephant', 1], ['Monkey', 1], ['Snake', 1], ['Giraffe', 1], ['Frog', 1], ['Chicken', 1], ['Shark', 1], ['Crab', 1],
    ['Octopus', 2], ['Flamingo', 2], ['Sloth', 2], ['Peacock', 2], ['Gorilla', 1], ['Bat', 2], ['Seal', 2], ['Jellyfish', 2], ['Owl', 2], ['Squirrel', 2],
    ['Chameleon', 3], ['Platypus', 3], ['Hedgehog', 2], ['Woodpecker', 2], ['Lobster', 2], ['Camel', 2], ['Dolphin', 1], ['T. rex', 1], ['Snail', 2], ['Hummingbird', 3],
  ],
  jobs: [
    ['Firefighter', 1], ['Chef', 1], ['Dentist', 1], ['Pilot', 1], ['Hairdresser', 1], ['Teacher', 1], ['Police officer', 1], ['Astronaut', 1], ['Doctor', 1], ['Waiter', 1],
    ['DJ', 2], ['Magician', 2], ['Lifeguard', 2], ['Surgeon', 2], ['Plumber', 2], ['Photographer', 2], ['Referee', 2], ['Window cleaner', 2], ['Yoga teacher', 2], ['Influencer', 2],
    ['Stuck in traffic', 2], ['First day at a new job', 3], ['Assembling flat-pack furniture', 2], ['Missing the bus', 2], ['Walking a stubborn dog', 2], ['Trying to find the TV remote', 2], ['Parallel parking', 3], ['Losing your keys', 2], ['A job interview gone wrong', 3], ['Waking up late for an exam', 3],
  ],
  famous: [
    ['Albert Einstein', 1], ['Michael Jackson', 1], ['Elvis Presley', 1], ['Cleopatra', 2], ['Napoleon', 2], ['Usain Bolt', 1], ['Cristiano Ronaldo', 1], ['Lionel Messi', 1], ['Taylor Swift', 1], ['Beyoncé', 1],
    ['Charlie Chaplin', 2], ['Shakespeare', 2], ['Mona Lisa', 2], ['Elon Musk', 2], ['Gordon Ramsay', 2], ['Freddie Mercury', 2], ['Marilyn Monroe', 2], ['Leonardo da Vinci', 3], ['Mozart', 2], ['Muhammad Ali', 2],
    ['Lady Gaga', 2], ['Serena Williams', 2], ['Mr. Bean', 1], ['The Queen of England', 2], ['Abraham Lincoln', 3], ['Marie Curie', 3],
  ],
  games: [
    ['Mario', 1], ['Pac-Man', 1], ['Tetris', 1], ['Minecraft', 1], ['Fortnite', 1], ['Sonic the Hedgehog', 1], ['Pikachu', 1], ['Zelda', 2], ['Among Us', 1], ['Angry Birds', 1],
    ['Street Fighter', 2], ['Space Invaders', 2], ['Donkey Kong', 2], ['Lara Croft', 2], ['Kirby', 2], ['The Sims', 2], ['Rocket League', 2], ['Pong', 2], ['Animal Crossing', 2], ['Guitar Hero', 2],
    ['Mortal Kombat', 3], ['Portal', 3], ['Frogger', 2], ['Just Dance', 1], ['Candy Crush', 1],
  ],
  internet: [
    ['Rickroll', 2], ['Dab', 1], ['Floss dance', 1], ['Distracted boyfriend', 2], ['Planking', 2], ['Ice bucket challenge', 1], ['Mannequin challenge', 1], ['Unboxing video', 2], ['Selfie stick', 1], ['Photobomb', 2],
    ['Video call freeze', 2], ['Influencer apology video', 3], ['Cat video', 1], ['Going viral', 3], ['Speed run', 3], ['Live stream', 2], ['Reaction video', 2], ['Doom scrolling', 3], ['Haul video', 3], ['ASMR', 3],
  ],
  cartoons: [
    ['SpongeBob', 1], ['Scooby-Doo', 1], ['Mickey Mouse', 1], ['Bugs Bunny', 1], ['Peppa Pig', 1], ['Tom and Jerry', 1], ['Homer Simpson', 1], ['Popeye', 2], ['Winnie the Pooh', 1], ['Dora the Explorer', 1],
    ['Snoopy', 2], ['Garfield', 2], ['Road Runner', 2], ['The Flintstones', 2], ['Rick and Morty', 3], ['Shaggy', 2], ['Pink Panther', 2], ['Bart Simpson', 2], ['Patrick Star', 1], ['Bluey', 1],
  ],
  random: [
    ['Brushing teeth', 1], ['Riding a horse', 1], ['Playing the drums', 1], ['Bowling', 1], ['Surfing', 1], ['Juggling', 2], ['Making a pizza', 1], ['Walking on the moon', 2], ['Escalator', 2], ['Blowing up a balloon', 1],
    ['Hiccups', 1], ['Ice skating', 1], ['Changing a nappy', 2], ['Building a snowman', 1], ['Painting a wall', 1], ['Washing a car', 1], ['Eating spaghetti', 1], ['A haunted house', 2], ['A volcano', 2], ['Tightrope walking', 2],
    ['Sneezing in slow motion', 2], ['Opening a jar that won’t open', 2], ['A rollercoaster', 1], ['Fishing', 1], ['Bungee jumping', 2], ['Playing hide and seek', 2], ['A traffic light', 3], ['Assembling IKEA furniture', 2], ['Camping in the rain', 3], ['Getting a haircut', 2],
  ],
};

export const CHARADES: CharadesCard[] = (Object.keys(RAW) as CharadesCategory[]).flatMap((category) =>
  RAW[category].map(([text, difficulty], i) => ({ id: `ch-${category}-${i + 1}`, text, category, difficulty })),
);

export const CHARADES_CATEGORIES: { id: CharadesCategory; label: string; emoji: string }[] = [
  { id: 'movies', label: 'Movies & TV', emoji: '🎬' },
  { id: 'heroes', label: 'Heroes & villains', emoji: '🦸' },
  { id: 'animals', label: 'Animals', emoji: '🐒' },
  { id: 'jobs', label: 'Jobs & situations', emoji: '👩‍🍳' },
  { id: 'famous', label: 'Famous people', emoji: '⭐' },
  { id: 'games', label: 'Video games', emoji: '🕹️' },
  { id: 'internet', label: 'Internet culture', emoji: '📱' },
  { id: 'cartoons', label: 'Cartoons', emoji: '🐭' },
  { id: 'random', label: 'Random', emoji: '🎲' },
];
