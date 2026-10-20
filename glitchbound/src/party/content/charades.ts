/**
 * Charades cards: scenes, things and famous real people to act out. Difficulty 1 easy, 2 medium, 3 hard.
 * No film, show, game, song or cartoon titles, characters or brands (they belong to other companies):
 * generic moments only. Lists live here (not in UI code) so they are easy to refresh.
 */
import type { CharadesCard, CharadesCategory } from '../types';

const RAW: Partial<Record<CharadesCategory, [string, 1 | 2 | 3][]>> = {
  movies: [
    ['A sinking ship', 1], ['Shark attack', 1], ['Jungle king roaring', 1], ['Ice queen casting a spell', 1], ['Toys coming to life', 1], ['Sword fight on a ship', 1], ['Laser sword duel', 2], ['Dinosaur escape', 1], ['Underwater treasure hunt', 2], ['Wizard duel', 1],
    ['Burglars break into a house', 1], ['Ghost hunters', 2], ['Dodging bullets in slow motion', 2], ['Musical number in the street', 2], ['Time machine', 1], ['Tornado carries a house away', 2], ['Pirate walking the plank', 1], ['Popular kids at the lunch table', 2], ['Boxer training montage', 1], ['High school dance-off', 2],
    ['Running across the country', 2], ['Fighter pilot', 1], ['Survival in the wilderness', 2], ['Game show contestant', 1], ['Kids on bikes chasing a monster', 2], ['Friends on a sofa in a café', 1], ['Awkward office boss', 2], ['Mad scientist’s lab', 2], ['Crowning a new king', 2], ['Dream inside a dream', 3],
    ['Mafia boss making an offer', 3], ['Dance contest in a diner', 3], ['Astronaut lost in space', 2], ['Floating in zero gravity', 2], ['Hot-air balloon escape', 2], ['Car race to the finish', 1], ['Chef in a chaotic kitchen', 2], ['Hidden camera prank', 2], ['Haunted doll', 2], ['Abseiling into a vault', 2],
    ['Street race', 1], ['Fashion show runway', 1], ['Inventor’s big test', 3], ['Creepy twins in a hallway', 2], ['Family sitcom dinner', 2], ['Alien invasion', 1], ['Gladiator fight', 2], ['Kung fu master', 1],
  ],
  heroes: [
    ['Superhero flying', 1], ['Masked vigilante', 1], ['Super strength', 1], ['Warrior princess', 1], ['Angry giant smashing things', 1], ['Hero in a robot suit', 1], ['God of thunder', 2], ['Hero with a shield', 2], ['Cat burglar', 2], ['Underwater hero', 2],
    ['Villain’s evil laugh', 1], ['Supervillain plotting world domination', 2], ['Jewel thief', 2], ['Hero with claws', 2], ['Sorcerer casting spells', 3], ['Shrinking hero', 2], ['Fastest hero alive', 2], ['Wisecracking antihero', 2], ['Trickster god', 2], ['Walking tree', 2],
    ['Henchman', 2], ['Master of magnets', 3], ['Slimy alien villain', 2], ['Weather-controlling hero', 3], ['Mind-control villain', 3], ['Villain breathing through a mask', 1], ['Evil fairy queen', 2], ['Dark wizard', 2],
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
    ['Lady Gaga', 2], ['Serena Williams', 2], ['Steve Irwin', 2], ['The Queen of England', 2], ['Abraham Lincoln', 3], ['Marie Curie', 3],
  ],
  games: [
    ['Jumping on platforms', 1], ['Chomping dots in a maze', 1], ['Falling blocks puzzle', 1], ['Digging and building with blocks', 1], ['Battle royale', 1], ['Racing game', 1], ['Treasure hunt', 1], ['Hero with a sword in a dungeon', 2], ['Escape room', 2], ['Slingshot', 1],
    ['Button mashing', 2], ['Shooting alien invaders', 2], ['Climbing ladders to save someone', 2], ['Exploring an ancient tomb', 2], ['Bubble shooter', 2], ['Building your dream house', 2], ['Kart racing', 1], ['Retro arcade machine', 2], ['Farming game', 2], ['Rhythm game', 2],
    ['Fighting game combo', 3], ['Teleport puzzle', 3], ['Crossing a busy road', 2], ['Dance mat game', 1], ['Match-three puzzle', 1],
  ],
  internet: [
    ['Online prank link', 2], ['Dab', 1], ['Floss dance', 1], ['Checking out someone else', 2], ['Planking', 2], ['Ice bucket challenge', 1], ['Mannequin challenge', 1], ['Unboxing video', 2], ['Selfie stick', 1], ['Photobomb', 2],
    ['Video call freeze', 2], ['Influencer apology video', 3], ['Cat video', 1], ['Going viral', 3], ['Speed run', 3], ['Live stream', 2], ['Reaction video', 2], ['Doom scrolling', 3], ['Haul video', 3], ['ASMR', 3],
  ],
  cartoons: [
    ['Slipping on a banana peel', 1], ['Anvil falling on your head', 1], ['Running off a cliff and looking down', 1], ['Cat chasing a mouse', 1], ['Talking pig', 1], ['Dog chasing its tail', 1], ['Dad asleep on the sofa', 1], ['Eyes popping out', 2], ['Bear waking from hibernation', 1], ['Little explorer with a map', 1],
    ['Dog walking its owner', 2], ['Lazy cat on a sofa', 2], ['Bird outrunning everyone', 2], ['Caveman cartoon', 2], ['Dizzy stars around your head', 3], ['Ghost chase down a corridor', 2], ['Tiptoeing detective', 2], ['Cheeky kid prankster', 2], ['Cartoon sneeze', 1], ['Puppy playing pretend', 1],
  ],
  random: [
    ['Brushing teeth', 1], ['Riding a horse', 1], ['Playing the drums', 1], ['Bowling', 1], ['Surfing', 1], ['Juggling', 2], ['Making a pizza', 1], ['Walking on the moon', 2], ['Escalator', 2], ['Blowing up a balloon', 1],
    ['Hiccups', 1], ['Ice skating', 1], ['Changing a nappy', 2], ['Building a snowman', 1], ['Painting a wall', 1], ['Washing a car', 1], ['Eating spaghetti', 1], ['A haunted house', 2], ['A volcano', 2], ['Tightrope walking', 2],
    ['Sneezing in slow motion', 2], ['Opening a jar that won’t open', 2], ['A rollercoaster', 1], ['Fishing', 1], ['Bungee jumping', 2], ['Playing hide and seek', 2], ['A traffic light', 3], ['Hanging a picture on the wall', 2], ['Camping in the rain', 3], ['Getting a haircut', 2],
  ],
};

/* More cards and categories, appended so existing ids never change. */
const MORE: Record<CharadesCategory, [string, 1 | 2 | 3][]> = {
  movies: [
    ['Ocean voyage on a raft', 1], ['Haunted mansion tour', 2], ['Day of the Dead parade', 2], ['Love at first sight', 1], ['Evil genius plotting', 1], ['Bank heist', 2], ['Caveman in the modern world', 2], ['Mermaid on land', 1], ['Monster under the bed', 1], ['Genie granting wishes', 1],
    ['Glass slipper fitting', 1], ['Giant monster attacks the city', 1], ['Alien befriends a kid', 2], ['Horror movie scream', 2], ['Creepy hotel corridor', 3], ['Big dance lift', 2], ['Shopping spree', 2], ['Airport goodbye', 2], ['Bossy fashion editor', 3], ['Courtroom drama', 2],
    ['Karate tournament', 1], ['Robot from the future', 1], ['Hero crawling through air vents', 2], ['Assassin on a mission', 2], ['Epic quest across mountains', 2], ['Desert planet', 3], ['Dancing in the rain', 2], ['Evil clown', 2], ['Teddy bear comes to life', 1], ['Christmas elf', 1],
    ['Statues coming to life', 2], ['Putting on a magic mask', 2], ['Disguised as a granny', 3], ['Dragon attacks a village', 1], ['Talking animals', 2], ['Pet alien', 1], ['Royal family drama', 3], ['Regency ball', 2], ['Gangster in a flat cap', 2], ['Space bounty hunter', 2],
    ['Digging out of prison', 2], ['Zombie apocalypse', 1], ['Detective with a magnifying glass', 2], ['Time traveler arrives', 2], ['Cooking competition', 1], ['Reality dating show', 2], ['Masked robbers', 2], ['Survivors on the road', 2], ['Lifeguard running in slow motion', 1], ['Football coach pep talk', 3],
    ['Teen drama party', 3], ['Fight over the family fortune', 3], ['Robot takes over', 3], ['Exorcism', 3], ['Vampire romance', 2], ['Lost in a spirit world', 3], ['Chocolate factory tour', 2], ['Cute pets turn evil', 2], ['Giant tidal wave', 2], ['Car chase', 1],
  ],
  heroes: [
    ['Sidekick', 1], ['Super spy', 2], ['Hero shooting energy blasts', 2], ['Spy boss with an eye patch', 3], ['Hero’s secret identity', 3], ['Superhero landing', 2], ['Archer hero', 2], ['Evil plant lady', 2], ['Shape-shifting spy', 3], ['Telepathic professor', 2],
    ['Space pirate', 2], ['Talking raccoon', 2], ['Demon detective', 2], ['Vampire hunter', 2], ['Hero with a flaming skull', 2], ['Blind hero with super hearing', 3], ['Hero surfing through space', 3], ['Masked strongman villain', 2], ['Villain who leaves riddles', 2], ['Two-faced villain', 3],
    ['Dark lord in a tower', 3], ['Puppy-snatching villain', 2], ['Wicked witch', 1], ['Pirate captain with a hook', 1], ['Evil royal adviser', 2], ['Lord of the underworld', 2], ['Villain with robot arms', 3], ['Superhero changing in a phone box', 2],
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
    ['Monster-collecting adventure', 1], ['Sniper hiding in a bush', 2], ['Open-world car chase', 2], ['Football video game', 1], ['Space soldier', 2], ['Healer in a team battle', 3], ['Online battle arena', 3], ['Building an online world', 1], ['Obstacle course race', 2], ['Defending your castle', 2],
    ['Banana skin on the race track', 1], ['Knocking someone off a platform', 2], ['Survival horror', 3], ['Rooftop parkour', 3], ['Final boss battle', 3], ['Endless runner', 1], ['Tapping to keep a bird in the air', 1], ['Running from a temple monster', 2], ['Motion-control bowling', 1], ['Light-gun shooting', 2],
    ['Smashing crates', 2], ['Slicing flying fruit', 1], ['Retro first-person shooter', 3], ['Claw machine', 2], ['Wobbly block tower', 1], ['Twisting on a spotty floor mat', 1], ['Going bankrupt in a board game', 1], ['Hide and seek', 1], ['Musical chairs', 1], ['Rock, paper, scissors', 1],
  ],
  internet: [
    ['Hashtag', 2], ['Swiping right', 2], ['Ghosting', 3], ['Rage quitting', 2], ['Clickbait', 3], ['Buffering', 2], ['Proving you’re not a robot', 3], ['Forgot my password', 2], ['Group chat drama', 3], ['Voice note', 2],
    ['Duck-face selfie', 1], ['Leaving someone on read', 3], ['Low battery panic', 2], ['Hunting for the internet password', 2], ['Mukbang', 3], ['Gender reveal party', 2], ['Fidget spinner', 1], ['Horse-riding dance', 1], ['Bottle flip', 1], ['Spam email', 2],
    ['Accidentally liking an old photo', 3], ['Video call on mute', 2], ['Influencer at brunch', 2], ['Plank challenge', 2], ['Typing…', 3],
  ],
  cartoons: [
    ['Duck losing its temper', 1], ['Clumsy dog', 1], ['Duck chasing bread', 2], ['Little bird and a hungry cat', 1], ['Cat that keeps getting squashed', 2], ['Caveman with a club', 2], ['Muscle-bound show-off', 3], ['Superpowered little sisters', 2], ['Boy genius with a secret lab', 3], ['Cowardly dog in a spooky house', 3],
    ['Kid with a transforming watch', 2], ['Coyote with a rocket', 2], ['Furry monster under the bridge', 1], ['Cookie crumbs everywhere', 1], ['Singing frog', 1], ['Diva pig', 2], ['Steam train with a face', 1], ['Rescue puppies', 1], ['Turtles doing kung fu', 2], ['Tiny forest villagers', 2],
    ['Detective with gadgets in his hat', 3], ['Kids building a rollercoaster', 3], ['Talking dog', 2], ['Paper cut-out kids', 2], ['Cartoon chase through doors', 2], ['Mouse with a big bow', 1], ['Blue alien', 1], ['Snowman melting in summer', 1], ['Squirrel chasing an acorn', 2], ['Robot that turns into a car', 2],
  ],
  random: [
    ['Doing the laundry', 1], ['Changing a tire', 2], ['Ironing a shirt', 1], ['Walking in high heels', 2], ['Skydiving', 2], ['Riding a unicycle', 3], ['Rowing a boat', 1], ['Chopping onions', 1], ['Taking a selfie', 1], ['Climbing a ladder', 1],
    ['Shaving', 1], ['Putting on make-up', 1], ['Doing yoga', 1], ['Lifting weights', 1], ['Rock climbing', 2], ['Milking a cow', 2], ['Making popcorn', 2], ['A tornado', 2], ['A thunderstorm', 2], ['Brain freeze', 2],
    ['Stepping on a toy brick', 1], ['Waiting for the microwave', 3], ['Staying awake in class', 2], ['Sleepwalking', 1], ['Mowing the lawn', 1], ['Parachuting', 2], ['Being a statue', 2], ['Washing a dog', 2], ['Hailing a taxi', 2], ['Blowing out birthday candles', 1],
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
    ['Weightlifting', 1], ['Gymnastics', 2], ['Synchronized swimming', 3], ['Curling', 3], ['Pole vault', 3], ['High jump', 2], ['Hurdles', 2], ['Sprinting', 1], ['Volleyball', 1], ['Baseball', 1],
    ['Cricket', 2], ['Rugby', 2], ['Ice hockey', 2], ['Table tennis', 1], ['Darts', 1], ['Water polo', 3], ['Horse racing', 2], ['Motor racing', 2], ['Javelin', 2], ['Kayaking', 2],
    ['Penalty shoot-out', 2], ['Triathlon', 3], ['Sumo wrestling', 2], ['Figure skating', 2], ['Tug of war', 1],
  ],
  music: [
    ['Air guitar', 1], ['Playing the violin', 1], ['Opera singer', 2], ['Rock concert', 1], ['Rapper', 1], ['Beatboxing', 2], ['Karaoke', 1], ['Boy band', 2], ['Moonwalk', 1], ['Line dance', 1],
    ['Spelling letters with your arms', 1], ['Zombie dance', 2], ['Rock opera', 3], ['Pop diva dance routine', 2], ['Power ballad', 1], ['Kids’ song with actions', 1], ['Happy Birthday', 1], ['Stomp, stomp, clap', 2], ['Disco queen', 2], ['Hair-flip dance', 2],
    ['Salsa dancing', 2], ['Funky strut', 2], ['Gravity-defying lean', 3], ['Disco finger point', 2], ['Training-montage music', 2], ['The twist', 3], ['Playing the bagpipes', 3], ['DJ at a wedding', 2], ['Crowd surfing', 2], ['Mosh pit', 3],
  ],
  places: [
    ['Eiffel Tower', 1], ['Pyramids of Giza', 2], ['Great Wall of China', 2], ['Statue of Liberty', 1], ['Leaning Tower of Pisa', 1], ['Big Ben', 2], ['Niagara Falls', 2], ['Mount Everest', 2], ['Las Vegas', 2], ['Hollywood', 2],
    ['Venice', 2], ['The Moon', 1], ['The North Pole', 2], ['A desert island', 1], ['The Amazon rainforest', 3], ['Stonehenge', 3], ['A theme park', 1], ['An airport', 1], ['A gym', 1], ['A library', 2],
    ['A dentist’s waiting room', 3], ['A nightclub', 2], ['A haunted castle', 2], ['A zoo', 1], ['A hospital', 1], ['A beach', 1], ['A submarine', 2], ['A spaceship', 1], ['A wedding', 1], ['A job center', 3],
  ],
  afterdark: [
    ['Walk of shame', 2], ['Lap dance', 1], ['Strip poker', 2], ['Speed dating', 2], ['Skinny-dipping', 1], ['Booty call', 2], ['Hickey', 2], ['The morning after', 3], ['First kiss', 1], ['Bachelorette party', 2],
    ['Stag do', 2], ['Spin the bottle', 1], ['Seven minutes in heaven', 3], ['Sexting', 2], ['Pole dancing', 1], ['Honeymoon', 2], ['Getting caught', 2], ['Sneaking out', 1], ['Body shots', 2], ['Tied up with a silk scarf', 2],
    ['Male stripper', 2], ['Dating-app date', 1], ['Swiping left', 1], ['Handcuffs', 2], ['Blindfold', 1], ['Grinding on the dance floor', 2], ['Friends with benefits', 3], ['Mile-high club', 3], ['Striptease', 1], ['Bedroom eyes', 2],
    ['Pillow talk', 3], ['The O face', 2], ['One-night stand', 2], ['Caught cheating', 3], ['Coming up for “coffee”', 2], ['Love bite', 2], ['Massage oil', 2], ['Hot tub', 1], ['Wrong name in bed', 3], ['Hotel “do not disturb” sign', 3],
  ],
};

/* Third batch, appended per category so existing ids never change. */
const EXTRA: Partial<Record<CharadesCategory, [string, 1 | 2 | 3][]>> = {
  movies: [
    ['Slow clap in a school gym', 2], ['Running through an airport to stop a wedding', 2], ['Hacker typing very fast', 1], ['Defusing a bomb: red wire or blue wire', 2], ['Villain explaining the whole plan', 3], ['Training montage up a flight of stairs', 2],
    ['Heist crew walking in slow motion', 2], ['Last survivor in a horror film', 2], ['Jumping from an exploding building', 1], ['Kissing in the rain', 1], ['Tunnelling out of prison with a spoon', 2], ['Car hanging off a cliff', 1],
    ['Castaway talking to a ball', 3], ['Dramatic courtroom “Objection!”', 2], ['Spy dangling from the ceiling on a wire', 2], ['Dodging lasers in a museum vault', 2], ['Walking away from an explosion without looking', 2], ['Underdog team wins the final', 2],
    ['Cowboy showdown at high noon', 1], ['Babysitter alone in a creepy house', 2], ['Mummy rising from a tomb', 1], ['Body swap with a parent', 3], ['Detective revealing the killer at dinner', 3], ['Pulling a sword from a stone', 1],
    ['Someone objects at the wedding', 2],
  ],
  heroes: [
    ['Hero turning invisible', 1], ['Villain stroking a cat in a big chair', 2], ['Hero who talks to fish', 2], ['Ice-powered villain', 2], ['Hero rescuing a cat from a tree', 1], ['Villain tying someone to the railway tracks', 2],
    ['Hero with a jetpack', 1], ['Hero lifting a car', 1], ['Hero with laser eyes', 1], ['Villain with a freeze ray', 2], ['Evil twin', 2], ['Robot sidekick', 2],
    ['Masked wrestler hero', 2], ['Hero who controls fire', 1], ['Villain escaping in a hot-air balloon', 3], ['Ninja assassin', 1], ['Knight in shining armour', 1], ['Hero catching a falling plane', 2],
    ['Villain’s lair inside a volcano', 3], ['Pirate queen', 2],
  ],
  animals: [
    ['Polar bear', 1], ['Goat', 1], ['Donkey', 1], ['Llama', 2], ['Rooster crowing', 1], ['Turkey', 1],
    ['Goose', 1], ['Pigeon', 1], ['Vulture', 2], ['Gecko', 2], ['Tortoise', 1], ['Otter', 2],
    ['Badger', 2], ['Hamster', 1], ['Cat stalking a bird', 2], ['Puppy', 1], ['Starfish', 2], ['Whale', 1],
    ['Grasshopper', 2], ['Caterpillar', 2], ['Ladybird', 2], ['Praying mantis', 3], ['Bull', 1], ['Reindeer', 1],
    ['Cheetah', 1], ['Hyena', 2], ['Baboon', 2], ['Sea lion', 2], ['Bison', 2], ['Dragonfly', 3],
  ],
  jobs: [
    ['Lumberjack', 1], ['Fisherman', 1], ['Astronomer', 2], ['Beekeeper', 2], ['Chimney sweep', 2], ['Butler', 1],
    ['Fortune teller', 1], ['Puppeteer', 2], ['Ventriloquist', 3], ['Tour guide', 1], ['Stunt double', 2], ['Deep-sea diver', 2],
    ['Street performer', 2], ['Auctioneer', 3], ['School crossing guard', 2], ['Traffic warden', 2], ['Ice cream seller', 1], ['Wedding planner', 2],
    ['Tailor', 2], ['Bouncer', 1], ['Lighthouse keeper', 3], ['Dog groomer', 2], ['Missing the last train home', 2], ['Getting stuck in a lift', 1],
    ['Spilling coffee on your laptop', 1], ['Sitting on a whoopee cushion', 1], ['Getting lost in a furniture store', 2], ['Accidentally replying to everyone', 3], ['Hiding from the boss', 2], ['Opening a present you hate', 2],
  ],
  famous: [
    ['Joan of Arc', 2], ['Genghis Khan', 2], ['Queen Victoria', 2], ['Henry VIII', 2], ['Christopher Columbus', 2], ['Neil Armstrong', 1],
    ['Amelia Earhart', 3], ['Florence Nightingale', 3], ['Galileo', 3], ['Beethoven', 2], ['Marco Polo', 3], ['Tutankhamun', 2],
    ['Alexander the Great', 2], ['Nikola Tesla', 3], ['Thomas Edison', 2], ['Salvador Dalí', 3], ['Andy Warhol', 3], ['Audrey Hepburn', 3],
    ['Pelé', 2], ['Diego Maradona', 2], ['Edith Piaf', 3], ['Frank Sinatra', 2], ['Louis Armstrong', 2], ['Jimi Hendrix', 2],
    ['John Lennon', 2], ['David Bowie', 2], ['Whitney Houston', 2], ['Rasputin', 3], ['Nelson Mandela', 2], ['Winston Churchill', 2],
    ['Socrates', 3], ['Robin Hood', 1], ['King Arthur', 2], ['Mother Teresa', 2],
  ],
  games: [
    ['Pressing pause at the worst moment', 2], ['Respawning after losing a life', 2], ['Collecting coins', 1], ['Grabbing a power-up', 1], ['Finding a save point', 2], ['Levelling up', 1],
    ['Game over screen', 1], ['Boss with three health bars', 3], ['Split-screen racing', 2], ['Online lag', 2], ['Spinning a prize wheel', 1], ['Pinball', 1],
    ['Air hockey', 1], ['Table football', 1], ['Bingo caller', 1], ['Hopscotch', 1], ['Leapfrog', 1], ['Snakes and ladders', 1],
    ['Building a card tower', 2], ['Poker face', 2], ['Chess grandmaster thinking', 2], ['Whack-a-mole', 1], ['A tutorial that never ends', 3],
  ],
  internet: [
    ['Clicking all the traffic lights to prove you’re human', 2], ['Stuck with a cat filter on a work call', 2], ['Typo in a viral post', 2], ['Main character energy', 3], ['Smart speaker mishearing you', 2], ['Robot vacuum chasing the cat', 1],
    ['Autocorrect fail', 2], ['Screenshot of a screenshot', 3], ['Life hack that doesn’t work', 2], ['Influencer pose in front of a landmark', 1], ['Tagging the wrong person', 2], ['Two-factor login code', 3],
    ['Accepting the cookie pop-up', 2], ['Software update at the worst time', 2], ['Waiting while someone is typing', 1], ['Muting the group chat', 2], ['Leaving the group chat dramatically', 2], ['Posting a sunset photo', 1],
    ['Online quiz result', 2], ['Unsubscribing from emails', 2], ['Phone face ID not recognising you', 2], ['Viral dance challenge', 1], ['Setting up a new phone', 2], ['Forgetting to unmute', 1],
    ['Battery at one percent', 1],
  ],
  cartoons: [
    ['Running in mid-air', 1], ['Bump growing on your head', 1], ['Tiny rain cloud over one person', 2], ['Light bulb idea over your head', 1], ['Steam coming out of your ears', 1], ['Sneaking along inside a barrel', 2],
    ['Hiding behind a tree that is far too thin', 2], ['Running into a painted tunnel on a wall', 3], ['Getting squashed flat as a pancake', 1], ['Sooty face after an explosion', 1], ['Heart eyes', 1], ['Jaw hitting the floor', 1],
    ['Dancing vegetables', 2], ['Hero dog with a cape', 2], ['Bird nest in your hair', 2], ['Villain twirling a moustache', 1], ['Jumping into a hole drawn on the floor', 3], ['Running so fast your legs become a wheel', 2],
    ['Tongue frozen to a lamppost', 2], ['Snowball growing as it rolls downhill', 2],
  ],
  random: [
    ['Defrosting a freezer', 2], ['Wrapping a present with far too much tape', 1], ['Peeling off a sticker that won’t come off', 2], ['Losing a sock in the washing machine', 2], ['Opening crisps quietly in a cinema', 2], ['Sneaking into the house late at night', 1],
    ['Folding a fitted sheet', 2], ['Squeezing into skinny jeans', 1], ['Shaking the last bit out of a ketchup bottle', 1], ['Finding a spider in the bath', 1], ['Getting dressed in the dark', 2], ['Running for a train', 1],
    ['Slipping on ice', 1], ['Being chased by a wasp', 1], ['Getting into a cold sea', 1], ['Learning to ride a bike', 1], ['Building a sandcastle', 1], ['Tiptoeing past a sleeping baby', 2],
    ['Sneaking a biscuit from the jar', 1], ['Carrying a sofa up the stairs', 2], ['Bathing a cat', 1], ['Plucking eyebrows', 2], ['Walking into a spider’s web', 1], ['Eating soup that is too hot', 1],
    ['Assembling a trampoline', 3], ['Untying a knot with your teeth', 2], ['Reversing into a parking space', 2], ['Trying to sleep on a plane', 2], ['Climbing over a fence in a dress', 2], ['Losing your shoe in the mud', 2],
  ],
  food: [
    ['Eating an artichoke', 3], ['Cracking open a crab', 2], ['Peeling a mango', 2], ['Eating a lobster', 2], ['Using chopsticks for the first time', 1], ['Cutting a cake into equal slices', 2],
    ['Making pasta from scratch', 2], ['Flipping a pancake too high', 1], ['Chilli-eating contest', 1], ['Taco breaking on the first bite', 2], ['Ice lolly melting down your arm', 1], ['Opening a coconut', 2],
    ['Popping candy', 2], ['Cheese pull on a pizza slice', 1], ['Sour sweets', 1], ['Peanut butter stuck to the roof of your mouth', 2], ['Slurping oysters', 2], ['Snails in garlic butter', 3],
    ['Fizzy drink burp', 1], ['Peeling hot chestnuts', 3], ['Building a gingerbread house', 2], ['Fish and chips on the beach', 1], ['Wobbly jelly on a plate', 1], ['Spreading cold butter on soft bread', 2],
    ['Biting into a hot pizza', 1],
  ],
  sports: [
    ['Long jump', 1], ['Shot put', 2], ['Discus', 2], ['Badminton', 1], ['Squash', 2], ['Bobsleigh', 2],
    ['Ski jump', 2], ['Rowing', 1], ['Sailing', 2], ['Cycling race', 1], ['Mountain biking', 2], ['BMX trick', 2],
    ['High dive', 1], ['Crossing the marathon finish line', 1], ['Passing a relay baton', 2], ['Ribbon gymnastics', 2], ['Trampolining', 1], ['Dressage', 3],
    ['Rodeo', 1], ['Arm wrestling', 1], ['Snooker', 2], ['Bowling a strike', 1], ['Goalkeeper diving for a save', 1], ['Limbo', 1],
    ['Synchronised diving', 3],
  ],
  music: [
    ['Playing the triangle', 1], ['Accordion', 2], ['Harp', 2], ['Saxophone solo', 2], ['Trumpet fanfare', 1], ['Drum solo', 1],
    ['Tuba', 2], ['Banjo', 2], ['Ukulele', 2], ['Yodelling', 2], ['Barbershop quartet', 3], ['Church choir', 2],
    ['Tap dance', 2], ['Breakdance spin', 2], ['Ballet pirouette', 1], ['Can-can', 2], ['Conga line', 1], ['Tango', 2],
    ['Irish dancing', 2], ['Bulgarian horo', 2], ['Waltz', 2], ['Stage dive', 2], ['Lighters in the air for a ballad', 2], ['Smashing a guitar on stage', 1],
  ],
  places: [
    ['Sydney Opera House', 2], ['Taj Mahal', 2], ['Colosseum', 2], ['Machu Picchu', 3], ['Grand Canyon', 2], ['Mount Fuji', 2],
    ['The Sahara', 2], ['Antarctica', 1], ['Times Square', 3], ['A car wash', 1], ['A laundrette', 2], ['A petrol station at 3 a.m.', 2],
    ['A bowling alley', 1], ['A ski lift', 1], ['A sauna', 1], ['A cinema', 1], ['A traffic jam', 1], ['A supermarket checkout', 1],
    ['A stuck lift', 1], ['A cruise ship', 1], ['A campsite', 1], ['A haunted forest', 2], ['A football stadium', 1], ['A sushi conveyor belt', 2],
    ['A sleeper train', 3], ['A courtroom', 2],
  ],
  afterdark: [
    ['Struggling with a bra clasp', 2], ['Sexy firefighter calendar', 2], ['Awkward condom purchase', 2], ['Hiding a lover in the wardrobe', 2], ['Climbing out of a bedroom window', 2], ['Sexy nurse costume', 1],
    ['Shower for two', 2], ['Champagne in a bubble bath', 2], ['Morning-breath kiss', 2], ['Naughty text sent to Mum', 3], ['Speed-dating bell', 2], ['Rose petals on the bed', 1],
    ['Candles everywhere', 1], ['Slow striptease with a tie', 2], ['Body paint', 2], ['Rubbing sun cream on a crush', 2], ['Kiss cam at a stadium', 2], ['Edible underwear', 2],
    ['Waterbed', 2], ['Pole-dancing class', 1], ['Flirting in a sauna', 2], ['Hen-night stripper', 2], ['Hiding a love bite with a scarf', 2], ['Valentine’s dinner disaster', 3],
    ['Getting caught by the neighbours', 3],
  ],
};

export const CHARADES: CharadesCard[] = (Object.keys(MORE) as CharadesCategory[]).flatMap((category) =>
  [...(RAW[category] ?? []), ...MORE[category], ...(EXTRA[category] ?? [])].map(([text, difficulty], i) => ({ id: `ch-${category}-${i + 1}`, text, category, difficulty })),
);

export const CHARADES_CATEGORIES: { id: CharadesCategory; label: string; emoji: string; adult?: boolean }[] = [
  { id: 'movies', label: 'Movie moments', emoji: '🎬' },
  { id: 'heroes', label: 'Heroes & villains', emoji: '🦸' },
  { id: 'animals', label: 'Animals', emoji: '🐒' },
  { id: 'jobs', label: 'Jobs & situations', emoji: '👩‍🍳' },
  { id: 'famous', label: 'Famous people', emoji: '⭐' },
  { id: 'games', label: 'Games', emoji: '🕹️' },
  { id: 'internet', label: 'Internet culture', emoji: '📱' },
  { id: 'cartoons', label: 'Cartoon moments', emoji: '🐭' },
  { id: 'random', label: 'Random', emoji: '🎲' },
  { id: 'food', label: 'Food & drink', emoji: '🍕' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'music', label: 'Songs & dances', emoji: '🎤' },
  { id: 'places', label: 'Places', emoji: '🗽' },
  { id: 'afterdark', label: 'After Dark', emoji: '🔞', adult: true },
];
