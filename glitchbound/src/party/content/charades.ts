/**
 * Charades cards: titles and names to act out. Difficulty 1 easy, 2 medium, 3 hard. Pop-culture lists
 * live here (not in UI code) so they are easy to refresh as trends change.
 */
import type { CharadesCard, CharadesCategory } from '../types';

const RAW: Partial<Record<CharadesCategory, [string, 1 | 2 | 3][]>> = {
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

/* More cards and categories, appended so existing ids never change. */
const MORE: Record<CharadesCategory, [string, 1 | 2 | 3][]> = {
  movies: [
    ['The Incredibles', 1], ['Moana', 1], ['Encanto', 2], ['Coco', 2], ['Inside Out', 2], ['Minions', 1], ['Despicable Me', 1], ['Madagascar', 1], ['Ice Age', 1], ['The Little Mermaid', 1],
    ['Beauty and the Beast', 1], ['Aladdin', 1], ['Cinderella', 1], ['King Kong', 1], ['E.T.', 2], ['Psycho', 3], ['The Shining', 3], ['Dirty Dancing', 2], ['Pretty Woman', 2], ['Love Actually', 3],
    ['The Devil Wears Prada', 3], ['Legally Blonde', 2], ['The Karate Kid', 1], ['Terminator', 1], ['Die Hard', 2], ['John Wick', 2], ['The Lord of the Rings', 2], ['Dune', 3], ['La La Land', 3], ['Joker', 2],
    ['Paddington', 1], ['Elf', 1], ['Night at the Museum', 2], ['The Mask', 2], ['Mrs. Doubtfire', 3], ['Godzilla', 1], ['Zootopia', 2], ['Lilo & Stitch', 1], ['The Crown', 3], ['Bridgerton', 2],
    ['Peaky Blinders', 2], ['The Mandalorian', 2], ['Prison Break', 2], ['The Walking Dead', 1], ['Sherlock', 2], ['Doctor Who', 2], ['MasterChef', 1], ['Love Island', 2], ['Money Heist', 2], ['The Last of Us', 2],
    ['Baywatch', 1], ['Ted Lasso', 3], ['Euphoria', 3], ['Succession', 3], ['Black Mirror', 3], ['The Exorcist', 3], ['Twilight', 2], ['Spirited Away', 3], ['Wonka', 2], ['Gremlins', 2],
  ],
  heroes: [
    ['Robin', 1], ['Black Widow', 2], ['Captain Marvel', 2], ['Nick Fury', 3], ['Supergirl', 2], ['Shazam', 3], ['Green Arrow', 3], ['Poison Ivy', 2], ['Mystique', 3], ['Professor X', 2],
    ['Gamora', 3], ['Star-Lord', 2], ['Rocket Raccoon', 2], ['Hellboy', 2], ['Blade', 2], ['Ghost Rider', 2], ['Daredevil', 3], ['Silver Surfer', 3], ['Bane', 2], ['The Riddler', 2],
    ['Two-Face', 3], ['Sauron', 3], ['Cruella de Vil', 2], ['The Wicked Witch', 1], ['Captain Hook', 1], ['Jafar', 2], ['Hades', 2], ['Doctor Octopus', 3],
  ],
  animals: [
    ['Horse', 1], ['Cow', 1], ['Pig', 1], ['Sheep', 1], ['Duck', 1], ['Rabbit', 1], ['Lion', 1], ['Tiger', 1], ['Bear', 1], ['Panda', 1],
    ['Koala', 2], ['Zebra', 2], ['Rhino', 2], ['Hippo', 2], ['Crocodile', 1], ['Turtle', 1], ['Parrot', 2], ['Eagle', 1], ['Spider', 1], ['Butterfly', 1],
    ['Bee', 1], ['Scorpion', 2], ['Ostrich', 2], ['Walrus', 3], ['Meerkat', 3], ['Mole', 3], ['Beaver', 2], ['Raccoon', 2], ['Skunk', 2], ['Pufferfish', 3],
    ['Seahorse', 3], ['Moose', 2], ['Wolf', 1], ['Fox', 2], ['Bulldog', 2], ['Mosquito', 2], ['Worm', 1], ['Swan', 2], ['Pelican', 3], ['Armadillo', 3],
  ],
  jobs: [
    ['Mechanic', 1], ['Farmer', 1], ['Builder', 1], ['Nurse', 1], ['Postman', 1], ['Taxi driver', 1], ['Baker', 1], ['Barista', 2], ['Personal trainer', 2], ['Archaeologist', 3],
    ['Scientist', 2], ['Judge', 2], ['Lawyer in court', 2], ['Mime artist', 3], ['Clown', 1], ['Ballet dancer', 1], ['Orchestra conductor', 2], ['Bus driver', 1], ['Zookeeper', 2], ['Vet', 2],
    ['Gardener', 1], ['Detective', 2], ['Spy', 2], ['News reader', 2], ['Weather presenter', 2], ['Tattoo artist', 2], ['Sushi chef', 3], ['Air traffic controller', 3], ['Car salesperson', 3], ['Flight attendant', 2],
    ['Security guard', 2], ['Pizza delivery', 1], ['Life coach', 3], ['Bomb disposal expert', 3], ['Getting a parking ticket', 2], ['Burning the toast', 1], ['Locked out in a towel', 2], ['Falling asleep on the train', 2], ['Phone dies mid-call', 2], ['Stepping in gum', 2],
  ],
  famous: [
    ['Harry Styles', 2], ['Rihanna', 2], ['Adele', 2], ['Ed Sheeran', 2], ['Billie Eilish', 2], ['Kim Kardashian', 2], ['Oprah Winfrey', 2], ['Dwayne “The Rock” Johnson', 1], ['Arnold Schwarzenegger', 2], ['Bruce Lee', 1],
    ['Jackie Chan', 1], ['Madonna', 2], ['Bob Marley', 2], ['Steve Jobs', 2], ['Bill Gates', 3], ['Barack Obama', 2], ['Gandhi', 3], ['Isaac Newton', 2], ['Stephen Hawking', 3], ['Vincent van Gogh', 2],
    ['Pablo Picasso', 3], ['Frida Kahlo', 3], ['Tom Cruise', 2], ['Keanu Reeves', 2], ['Shakira', 2], ['Snoop Dogg', 2], ['Michael Jordan', 1], ['Roger Federer', 2], ['Mike Tyson', 1], ['David Beckham', 1],
    ['Neymar', 2], ['Dolly Parton', 2], ['Bob Ross', 2], ['Houdini', 3], ['Julius Caesar', 3], ['Sigmund Freud', 3], ['Charles Darwin', 3], ['Jeff Bezos', 3], ['Zendaya', 2], ['Tom Holland', 2],
  ],
  games: [
    ['Pokémon', 1], ['Call of Duty', 2], ['Grand Theft Auto', 2], ['FIFA', 1], ['Halo', 2], ['Overwatch', 3], ['League of Legends', 3], ['Roblox', 1], ['Fall Guys', 2], ['Clash of Clans', 2],
    ['Mario Kart', 1], ['Super Smash Bros.', 2], ['Resident Evil', 3], ['Assassin’s Creed', 3], ['God of War', 3], ['Subway Surfers', 1], ['Flappy Bird', 1], ['Temple Run', 2], ['Wii Sports', 1], ['Duck Hunt', 2],
    ['Crash Bandicoot', 2], ['Fruit Ninja', 1], ['Doom', 3], ['Hungry Hungry Hippos', 2], ['Jenga', 1], ['Twister', 1], ['Monopoly', 1], ['Hide and seek', 1], ['Musical chairs', 1], ['Rock, paper, scissors', 1],
  ],
  internet: [
    ['Hashtag', 2], ['Swiping right', 2], ['Ghosting', 3], ['Rage quitting', 2], ['Clickbait', 3], ['Buffering', 2], ['Captcha', 3], ['Forgot my password', 2], ['Group chat drama', 3], ['Voice note', 2],
    ['Duck-face selfie', 1], ['Leaving someone on read', 3], ['Low battery panic', 2], ['Hunting for the Wi-Fi password', 2], ['Mukbang', 3], ['Gender reveal party', 2], ['Fidget spinner', 1], ['Gangnam Style', 1], ['Bottle flip', 1], ['Spam email', 2],
    ['Accidentally liking an old photo', 3], ['Zoom call on mute', 2], ['Influencer at brunch', 2], ['Plank challenge', 2], ['Typing…', 3],
  ],
  cartoons: [
    ['Donald Duck', 1], ['Goofy', 1], ['Daffy Duck', 2], ['Tweety', 1], ['Sylvester', 2], ['Fred Flintstone', 2], ['Johnny Bravo', 3], ['The Powerpuff Girls', 2], ['Dexter’s Laboratory', 3], ['Courage the Cowardly Dog', 3],
    ['Ben 10', 2], ['Wile E. Coyote', 2], ['Elmo', 1], ['Cookie Monster', 1], ['Kermit the Frog', 1], ['Miss Piggy', 2], ['Thomas the Tank Engine', 1], ['Paw Patrol', 1], ['Teenage Mutant Ninja Turtles', 2], ['The Smurfs', 2],
    ['Inspector Gadget', 3], ['Phineas and Ferb', 3], ['Family Guy', 2], ['South Park', 2], ['Woody Woodpecker', 2], ['Minnie Mouse', 1], ['Stitch', 1], ['Olaf', 1], ['Sid the Sloth', 2], ['Optimus Prime', 2],
  ],
  random: [
    ['Doing the laundry', 1], ['Changing a tyre', 2], ['Ironing a shirt', 1], ['Walking in high heels', 2], ['Skydiving', 2], ['Riding a unicycle', 3], ['Rowing a boat', 1], ['Chopping onions', 1], ['Taking a selfie', 1], ['Climbing a ladder', 1],
    ['Shaving', 1], ['Putting on make-up', 1], ['Doing yoga', 1], ['Lifting weights', 1], ['Rock climbing', 2], ['Milking a cow', 2], ['Making popcorn', 2], ['A tornado', 2], ['A thunderstorm', 2], ['Brain freeze', 2],
    ['Stepping on Lego', 1], ['Waiting for the microwave', 3], ['Staying awake in class', 2], ['Sleepwalking', 1], ['Mowing the lawn', 1], ['Parachuting', 2], ['Being a statue', 2], ['Washing a dog', 2], ['Hailing a taxi', 2], ['Blowing out birthday candles', 1],
    ['Catching a fly', 2], ['Untangling headphones', 3], ['Carrying too many shopping bags', 2], ['Walking on hot sand', 2], ['A slow-motion fight', 2], ['Putting up a tent', 2], ['Brushing a horse', 3], ['A magic trick gone wrong', 3], ['Doing the worm', 2], ['Trying to whistle', 2],
  ],
  food: [
    ['Spaghetti', 1], ['Pizza', 1], ['Hot dog', 1], ['Ice cream cone', 1], ['Banana', 1], ['Popcorn', 1], ['Sushi', 2], ['Tacos', 2], ['Pancakes', 1], ['Corn on the cob', 2],
    ['Jelly', 2], ['Chewing gum', 1], ['A very hot chilli', 1], ['Lemon', 1], ['Coconut', 2], ['Watermelon', 1], ['Birthday cake', 1], ['Fondue', 3], ['Burrito', 2], ['Noodles', 1],
    ['Candy floss', 2], ['Toast', 1], ['Boiled egg', 2], ['Fortune cookie', 3], ['Pretzel', 2], ['Barbecue', 1], ['Milkshake', 1], ['Doughnut', 1], ['Croissant', 2], ['Onion', 1],
    ['Kebab', 2], ['Smoothie', 2], ['Spring roll', 3], ['Popsicle', 1], ['Bubble tea', 3],
  ],
  sports: [
    ['Boxing', 1], ['Swimming', 1], ['Karate', 1], ['Golf', 1], ['Skiing', 1], ['Snowboarding', 2], ['Skateboarding', 1], ['Archery', 2], ['Fencing', 3], ['Wrestling', 1],
    ['Weightlifting', 1], ['Gymnastics', 2], ['Synchronised swimming', 3], ['Curling', 3], ['Pole vault', 3], ['High jump', 2], ['Hurdles', 2], ['Sprinting', 1], ['Volleyball', 1], ['Baseball', 1],
    ['Cricket', 2], ['Rugby', 2], ['Ice hockey', 2], ['Table tennis', 1], ['Darts', 1], ['Water polo', 3], ['Horse racing', 2], ['Formula 1', 2], ['Javelin', 2], ['Kayaking', 2],
    ['Penalty shoot-out', 2], ['Triathlon', 3], ['Sumo wrestling', 2], ['Figure skating', 2], ['Tug of war', 1],
  ],
  music: [
    ['Air guitar', 1], ['Playing the violin', 1], ['Opera singer', 2], ['Rock concert', 1], ['Rapper', 1], ['Beatboxing', 2], ['Karaoke', 1], ['Boy band', 2], ['Moonwalk', 1], ['Macarena', 1],
    ['YMCA', 1], ['Thriller dance', 2], ['Bohemian Rhapsody', 3], ['Single Ladies', 2], ['Let It Go', 1], ['Baby Shark', 1], ['Happy Birthday', 1], ['We Will Rock You', 2], ['Dancing Queen', 2], ['Shake It Off', 2],
    ['Despacito', 2], ['Uptown Funk', 2], ['Smooth Criminal', 3], ['Stayin’ Alive', 2], ['Eye of the Tiger', 2], ['Twist and Shout', 3], ['Playing the bagpipes', 3], ['DJ at a wedding', 2], ['Crowd surfing', 2], ['Mosh pit', 3],
  ],
  places: [
    ['Eiffel Tower', 1], ['Pyramids of Giza', 2], ['Great Wall of China', 2], ['Statue of Liberty', 1], ['Leaning Tower of Pisa', 1], ['Big Ben', 2], ['Niagara Falls', 2], ['Mount Everest', 2], ['Las Vegas', 2], ['Hollywood', 2],
    ['Venice', 2], ['The Moon', 1], ['The North Pole', 2], ['A desert island', 1], ['The Amazon rainforest', 3], ['Stonehenge', 3], ['Disneyland', 1], ['An airport', 1], ['A gym', 1], ['A library', 2],
    ['A dentist’s waiting room', 3], ['A nightclub', 2], ['A haunted castle', 2], ['A zoo', 1], ['A hospital', 1], ['A beach', 1], ['A submarine', 2], ['A spaceship', 1], ['A wedding', 1], ['A job centre', 3],
  ],
  afterdark: [
    ['Walk of shame', 2], ['Lap dance', 1], ['Strip poker', 2], ['Speed dating', 2], ['Skinny-dipping', 1], ['Booty call', 2], ['Hickey', 2], ['The morning after', 3], ['First kiss', 1], ['Bachelorette party', 2],
    ['Stag do', 2], ['Spin the bottle', 1], ['Seven minutes in heaven', 3], ['Sexting', 2], ['Pole dancing', 1], ['Honeymoon', 2], ['Getting caught', 2], ['Sneaking out', 1], ['Body shots', 2], ['Fifty Shades of Grey', 2],
    ['Magic Mike', 2], ['Tinder date', 1], ['Swiping left', 1], ['Handcuffs', 2], ['Blindfold', 1], ['Dirty dancing', 2], ['Friends with benefits', 3], ['Mile-high club', 3], ['Striptease', 1], ['Bedroom eyes', 2],
    ['Pillow talk', 3], ['The O face', 2], ['One-night stand', 2], ['Caught cheating', 3], ['Netflix and chill', 2], ['Love bite', 2], ['Massage oil', 2], ['Hot tub', 1], ['Wrong name in bed', 3], ['Hotel “do not disturb” sign', 3],
  ],
};

export const CHARADES: CharadesCard[] = (Object.keys(MORE) as CharadesCategory[]).flatMap((category) =>
  [...(RAW[category] ?? []), ...MORE[category]].map(([text, difficulty], i) => ({ id: `ch-${category}-${i + 1}`, text, category, difficulty })),
);

export const CHARADES_CATEGORIES: { id: CharadesCategory; label: string; emoji: string; adult?: boolean }[] = [
  { id: 'movies', label: 'Movies & TV', emoji: '🎬' },
  { id: 'heroes', label: 'Heroes & villains', emoji: '🦸' },
  { id: 'animals', label: 'Animals', emoji: '🐒' },
  { id: 'jobs', label: 'Jobs & situations', emoji: '👩‍🍳' },
  { id: 'famous', label: 'Famous people', emoji: '⭐' },
  { id: 'games', label: 'Video games', emoji: '🕹️' },
  { id: 'internet', label: 'Internet culture', emoji: '📱' },
  { id: 'cartoons', label: 'Cartoons', emoji: '🐭' },
  { id: 'random', label: 'Random', emoji: '🎲' },
  { id: 'food', label: 'Food & drink', emoji: '🍕' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'music', label: 'Songs & dances', emoji: '🎤' },
  { id: 'places', label: 'Places', emoji: '🗽' },
  { id: 'afterdark', label: 'After Dark', emoji: '🔞', adult: true },
];
