/**
 * Name Your Price item library. Rarity is a light hint for collectors (1 common, 2 rare, 3 legendary),
 * never a claim about real value. Items need no images: each has an emoji fallback.
 */
import type { AuctionItem, AuctionTheme } from '../types';

type Row = [name: string, rarity: 1 | 2 | 3, emoji: string, tags?: string];

const THEMES: Record<AuctionTheme, Row[]> = {
  heroes: [
    ['Wall-crawling acrobat', 3, '🕷️', 'agile'], ['Masked night watcher', 3, '🦇', 'gadgets'], ['Caped flying hero', 3, '🦸', 'strong'], ['Warrior princess', 3, '⚔️', 'strong'], ['Genius in a robot suit', 3, '🤖', 'gadgets'],
    ['Shield-throwing captain', 2, '🛡️', 'leader'], ['Thunder hero with a hammer', 2, '🔨', 'strong'], ['Gentle giant who smashes', 2, '💚', 'strong'], ['Jungle guardian', 2, '🐆', 'agile'], ['Lightning-fast runner', 2, '⚡', 'speed'],
    ['Sea king with a trident', 1, '🔱', 'water'], ['Shrinking hero', 1, '🐜', 'gadgets'], ['Storm summoner', 2, '🌩️', 'magic'], ['Clawed loner', 2, '🐺', 'strong'], ['Master of the mystic arts', 2, '🌀', 'magic'],
    ['Cosmic space ranger', 1, '💍', 'magic'], ['Stretchy teen hero', 1, '✨', 'agile'], ['Master archer', 1, '🏹', 'agile'], ['Reality-bending witch', 3, '🔮', 'magic'], ['Walking tree giant', 1, '🌳', 'strong'],
  ],
  villains: [
    ['Cackling clown villain', 3, '🃏', 'chaos'], ['Galaxy-conquering warlord', 3, '🪐', 'strong'], ['Masked space overlord', 3, '🖤', 'leader'], ['Evil sorcerer', 2, '🪄', 'magic'], ['Smooth-talking con artist', 2, '🎩', 'trickster'],
    ['Master of magnetism', 2, '🧲', 'magic'], ['Horned dark fairy', 2, '🐉', 'magic'], ['Chaotic jester', 2, '🎈', 'chaos'], ['Alien goo monster', 2, '🕸️', 'strong'], ['Cat burglar', 1, '🐈‍⬛', 'agile'],
    ['Bald billionaire schemer', 1, '💼', 'gadgets'], ['Sea witch', 1, '🐙', 'magic'], ['Scheming royal adviser', 1, '🦁', 'trickster'], ['Dungeon boss', 2, '🗝️', 'strong'], ['Dracula', 2, '🧛', 'creature'],
    ['Puppy-coat fashionista', 1, '🐾', 'chaos'], ['Christmas-hating grump', 1, '🎄', 'trickster'], ['Goblin on a glider', 1, '🎃', 'chaos'],
  ],
  anime: [
    ['Spiky-haired martial artist', 3, '🐉', 'strong'], ['Ninja who never gives up', 3, '🍥', 'agile'], ['Pirate captain with big dreams', 3, '👒', 'strong'], ['Magical girl', 2, '🌙', 'magic'], ['Electric pocket pet', 3, '⚡', 'cute'],
    ['Giant forest spirit', 2, '🌳', 'cute'], ['Mastermind student', 2, '📓', 'trickster'], ['Elite monster hunter', 2, '⚔️', 'agile'], ['Bored hero who wins in one hit', 2, '👊', 'strong'], ['Swordsman with a water blade', 2, '🌊', 'agile'],
    ['Proud rival prince', 2, '👑', 'strong'], ['Alchemist with a metal arm', 1, '🦾', 'magic'], ['Laid-back space bounty hunter', 1, '🛸', 'cool'], ['Scarf-wearing soldier', 1, '🧣', 'agile'], ['Blindfolded sorcerer', 3, '🕶️', 'magic'],
    ['Pink puffball', 1, '🩷', 'cute'], ['Robot boy', 1, '🚀', 'gadgets'],
  ],
  screen: [
    ['Young wizard', 3, '⚡', 'magic'], ['Secret agent in a tuxedo', 3, '🍸', 'gadgets'], ['Whip-cracking archaeologist', 2, '🤠', 'adventure'], ['Sherlock Holmes', 2, '🔍', 'brains'], ['Know-it-all student', 2, '📚', 'brains'],
    ['Swaggering pirate', 2, '🏴‍☠️', 'trickster'], ['Ancient mountain master', 3, '🧘', 'magic'], ['Kid with psychic powers', 2, '🧇', 'magic'], ['Mad scientist', 2, '⚗️', 'brains'], ['Wise old wizard', 3, '🧙', 'magic'],
    ['Gloomy goth girl', 1, '🖤', 'brains'], ['Underdog boxer', 1, '🥊', 'strong'], ['Runner who never stops', 1, '🏃', 'speed'], ['Alien-fighting space officer', 1, '👽', 'adventure'], ['Clueless office boss', 1, '☕', 'chaos'],
    ['Flying nanny with an umbrella', 1, '☂️', 'magic'], ['Hacker who dodges bullets', 2, '🕶️', 'agile'], ['Lost alien who wants to go home', 1, '🚲', 'cute'],
  ],
  gaming: [
    ['Platform-jumping hero', 3, '🍄', 'classic'], ['Elf hero with a sword', 3, '🗡️', 'adventure'], ['Armoured space soldier', 2, '🪖', 'strong'], ['Tomb-raiding adventurer', 2, '🏺', 'adventure'], ['Super-speed mascot', 2, '💨', 'speed'],
    ['Angry war god', 2, '🪓', 'strong'], ['Dot-chomping circle', 1, '🟡', 'classic'], ['Blocky miner', 1, '⛏️', 'builder'], ['Bounty hunter in power armour', 2, '🔫', 'gadgets'], ['Silver-haired monster hunter', 2, '🐺', 'magic'],
    ['Barrel-throwing ape', 1, '🦍', 'strong'], ['Friendly dinosaur sidekick', 1, '🦖', 'cute'], ['Hooded assassin', 1, '🦅', 'agile'], ['Hero with a giant sword', 2, '⚔️', 'strong'], ['Castle princess', 1, '👑', 'classic'],
    ['Spinning crate-smasher', 1, '🌀', 'speed'], ['Space crewmate (maybe a traitor)', 1, '🚀', 'cute'],
  ],
  sports: [
    ['Lionel Messi', 3, '⚽', 'football'], ['Cristiano Ronaldo', 3, '⚽', 'football'], ['Pelé', 3, '⚽', 'legend'], ['Michael Jordan', 3, '🏀', 'legend'], ['Serena Williams', 3, '🎾', 'legend'],
    ['Usain Bolt', 2, '⚡', 'speed'], ['Kylian Mbappé', 2, '⚽', 'football'], ['LeBron James', 2, '🏀', 'basketball'], ['Roger Federer', 2, '🎾', 'legend'], ['Simone Biles', 2, '🤸', 'agile'],
    ['Erling Haaland', 2, '⚽', 'football'], ['Muhammad Ali', 3, '🥊', 'legend'], ['Lewis Hamilton', 2, '🏎️', 'speed'], ['Diego Maradona', 2, '⚽', 'legend'], ['Zinedine Zidane', 2, '⚽', 'legend'],
    ['Novak Djokovic', 2, '🎾', 'tennis'], ['Mo Salah', 1, '⚽', 'football'], ['Steph Curry', 1, '🏀', 'basketball'],
  ],
  creatures: [
    ['Dragon', 3, '🐉', 'myth'], ['Unicorn', 2, '🦄', 'myth'], ['Phoenix', 3, '🔥', 'myth'], ['Kraken', 2, '🦑', 'myth'], ['Yeti', 1, '❄️', 'myth'],
    ['City-stomping lizard', 3, '🦖', 'giant'], ['Giant ape', 2, '🦍', 'giant'], ['Loch Ness Monster', 1, '🌊', 'myth'], ['Werewolf', 1, '🐺', 'myth'], ['Griffin', 2, '🦅', 'myth'],
    ['Pegasus', 2, '🪽', 'myth'], ['Giant moth', 1, '🦋', 'giant'], ['Slime monster', 1, '🟢', 'silly'], ['Baby dragon', 1, '🐲', 'cute'], ['Giant octopus', 1, '🐙', 'giant'],
  ],
  cartoons: [
    ['Chatty sea sponge', 2, '🧽', 'silly'], ['Wisecracking rabbit', 2, '🥕', 'trickster'], ['Whistling cartoon mouse', 3, '🐭', 'classic'], ['Couch-potato dad', 2, '🍩', 'silly'], ['Mystery-solving dog', 2, '🐕', 'classic'],
    ['Grumpy ogre', 2, '🧅', 'strong'], ['Playful puppy', 1, '🐶', 'cute'], ['Giggling piglet', 1, '🐷', 'cute'], ['Lazy orange cat', 1, '🍝', 'silly'], ['Daydreaming beagle', 2, '✈️', 'classic'],
    ['Cat that never catches the mouse', 1, '🐈', 'classic'], ['Cheese-stealing mouse', 1, '🧀', 'trickster'], ['Dozy starfish', 1, '⭐', 'silly'], ['Mad scientist grandpa', 2, '🧪', 'brains'], ['Honey-loving bear', 1, '🍯', 'cute'],
    ['Desert bird that outruns everyone', 1, '💨', 'speed'], ['Tiptoeing pink cat', 1, '🩷', 'cool'],
  ],
  internet: [
    ['Surprise prank link', 2, '🔗', 'meme'], ['Meme dog', 2, '🐕', 'meme'], ['Cat with a frown', 2, '😾', 'meme'], ['Rainbow pixel cat', 1, '🌈', 'meme'], ['Calm dog in chaos', 2, '🔥', 'meme'],
    ['Wandering-eye meme', 1, '👀', 'meme'], ['Piano-playing cat', 1, '🎹', 'meme'], ['Line-goes-up guy', 1, '📈', 'meme'], ['Dancing baby', 1, '👶', 'retro'], ['Smug troll face', 1, '😏', 'retro'],
    ['Shouting-match meme', 2, '🐱', 'meme'], ['Shiba Inu', 1, '🐕', 'cute'], ['Viral dancing grandpa', 1, '🕺', 'retro'], ['Chonky bunny', 1, '🐰', 'meme'], ['Sad frog', 1, '🐸', 'meme'],
  ],
  food: [
    ['Pizza', 3, '🍕', 'savory'], ['Sushi', 2, '🍣', 'savory'], ['Tacos', 2, '🌮', 'savory'], ['Chocolate cake', 2, '🍰', 'sweet'], ['Croissant', 1, '🥐', 'sweet'],
    ['Burger', 2, '🍔', 'savory'], ['Ramen', 2, '🍜', 'savory'], ['Ice cream', 2, '🍦', 'sweet'], ['Pancakes', 1, '🥞', 'sweet'], ['Avocado toast', 1, '🥑', 'savory'],
    ['Fries', 1, '🍟', 'savory'], ['Donut', 1, '🍩', 'sweet'], ['A lifetime supply of coffee', 3, '☕', 'drink'], ['Unlimited pasta', 2, '🍝', 'savory'], ['A golden toaster', 1, '🍞', 'object'],
    ['Comfy socks', 1, '🧦', 'object'], ['Self-cleaning room', 3, '🧹', 'object'], ['Never-dying phone battery', 3, '🔋', 'object'],
  ],
  cars: [
    ['Red Italian supercar', 3, '🏎️', 'supercar'], ['Wedge-shaped supercar', 3, '🏎️', 'supercar'], ['Classic German sports car', 2, '🚗', 'sports'], ['1,500-horsepower hypercar', 3, '🏎️', 'hyper'], ['Self-driving electric car', 2, '🔋', 'electric'],
    ['Tiny city car', 1, '🚙', 'city'], ['Retro camper van', 1, '🚐', 'classic'], ['British spy car', 2, '🚗', 'classic'], ['Race-track special', 2, '🏎️', 'supercar'], ['American muscle car', 2, '🐎', 'muscle'],
    ['Off-road 4x4', 1, '🚙', 'offroad'], ['Gadget-packed hero car', 3, '🦇', 'fiction'], ['Time-travelling sports car', 2, '⏱️', 'fiction'], ['Monster truck', 1, '🛻', 'offroad'], ['Italian scooter', 1, '🛵', 'city'],
  ],
  music: [
    ['Michael Jackson', 3, '🕺', 'pop'], ['Beyoncé', 3, '🐝', 'pop'], ['Freddie Mercury', 3, '👑', 'rock'], ['Taylor Swift', 3, '🎤', 'pop'], ['Elvis Presley', 2, '🎸', 'rock'],
    ['Madonna', 2, '💃', 'pop'], ['Bob Marley', 2, '🌿', 'reggae'], ['Eminem', 2, '🎙️', 'rap'], ['Rihanna', 2, '☂️', 'pop'], ['Ed Sheeran', 1, '🎸', 'pop'],
    ['Billie Eilish', 2, '🖤', 'pop'], ['Bruno Mars', 2, '🎶', 'pop'], ['The Beatles', 3, '🪲', 'rock'], ['Adele', 2, '🎹', 'ballad'], ['Snoop Dogg', 1, '🐶', 'rap'],
    ['Lady Gaga', 2, '⚡', 'pop'], ['Bad Bunny', 2, '🐰', 'latin'], ['Daft Punk', 2, '🤖', 'electronic'], ['Mozart', 1, '🎼', 'classical'], ['BTS', 2, '💜', 'pop'],
  ],
  history: [
    ['Cleopatra', 3, '👑', 'ruler'], ['Julius Caesar', 2, '🏛️', 'ruler'], ['Napoleon', 2, '🎩', 'ruler'], ['Leonardo da Vinci', 3, '🎨', 'genius'], ['Albert Einstein', 3, '🧠', 'genius'],
    ['Marie Curie', 2, '⚗️', 'genius'], ['Genghis Khan', 2, '🏹', 'ruler'], ['Joan of Arc', 2, '⚔️', 'warrior'], ['Nikola Tesla', 2, '⚡', 'genius'], ['Alexander the Great', 2, '🐎', 'ruler'],
    ['Shakespeare', 1, '🪶', 'artist'], ['Isaac Newton', 2, '🍎', 'genius'], ['Amelia Earhart', 1, '✈️', 'explorer'], ['Christopher Columbus', 1, '⛵', 'explorer'], ['Queen Elizabeth I', 1, '👸', 'ruler'],
    ['Spartacus', 1, '🛡️', 'warrior'], ['Houdini', 1, '🔗', 'artist'], ['Frida Kahlo', 1, '🌺', 'artist'], ['Neil Armstrong', 2, '🚀', 'explorer'], ['Ada Lovelace', 1, '💻', 'genius'],
  ],
  myths: [
    ['Zeus', 3, '⚡', 'god'], ['Thor (the god)', 2, '🔨', 'god'], ['Odin', 2, '👁️', 'god'], ['Poseidon', 2, '🔱', 'god'], ['Hades', 2, '💀', 'god'],
    ['Athena', 2, '🦉', 'god'], ['Medusa', 2, '🐍', 'monster'], ['Hercules', 2, '💪', 'hero'], ['Anubis', 2, '🐺', 'god'], ['Ra', 1, '☀️', 'god'],
    ['Valkyrie', 3, '🪽', 'hero'], ['Hydra', 2, '🐲', 'monster'], ['Minotaur', 1, '🐂', 'monster'], ['Sphinx', 2, '🦁', 'creature'], ['Cerberus', 1, '🐕', 'monster'],
    ['Achilles', 1, '🛡️', 'hero'], ['King Arthur', 1, '🗡️', 'hero'], ['Merlin', 2, '🧙', 'magic'], ['Loki (the god)', 2, '🃏', 'trickster'], ['Aphrodite', 2, '💘', 'god'],
  ],
  powers: [
    ['Teleportation', 3, '🌀', 'travel'], ['Flight', 3, '🕊️', 'travel'], ['Invisibility', 2, '👻', 'stealth'], ['Mind reading', 3, '🧠', 'mind'], ['Time travel', 3, '⏳', 'time'],
    ['Super strength', 2, '💪', 'body'], ['Healing touch', 2, '💖', 'body'], ['Talking to animals', 1, '🐾', 'mind'], ['Shape-shifting', 2, '🦎', 'body'], ['Stopping time', 3, '⏸️', 'time'],
    ['Never needing sleep', 2, '😴', 'body'], ['Perfect memory', 1, '📚', 'mind'], ['Breathing underwater', 1, '🫧', 'body'], ['Super speed', 2, '⚡', 'travel'], ['Controlling the weather', 2, '🌦️', 'nature'],
    ['Speaking every language', 2, '🗣️', 'mind'], ['Luck that never runs out', 2, '🍀', 'fate'], ['X-ray vision', 1, '👀', 'stealth'], ['Making anyone laugh', 1, '😂', 'mind'], ['Infinite snacks', 1, '🍿', 'fate'],
  ],
  trips: [
    ['A month in Japan', 3, '🗾', 'city'], ['Safari in Kenya', 2, '🦁', 'nature'], ['Northern Lights in Iceland', 3, '🌌', 'nature'], ['Road trip on Route 66', 2, '🛣️', 'road'], ['Maldives overwater villa', 3, '🏝️', 'beach'],
    ['New York for a weekend', 2, '🗽', 'city'], ['Paris with a view of the tower', 2, '🗼', 'city'], ['Space hotel night', 3, '🛰️', 'space'], ['Backpacking South America', 2, '🎒', 'adventure'], ['Ski chalet in the Alps', 2, '⛷️', 'snow'],
    ['Greek island hopping', 2, '⛵', 'beach'], ['Machu Picchu trek', 2, '⛰️', 'adventure'], ['Las Vegas weekend', 1, '🎰', 'city'], ['Bali yoga retreat', 1, '🧘', 'beach'], ['Theme park with no queues', 2, '🏰', 'fun'],
    ['Interrail across Europe', 1, '🚆', 'road'], ['Hot-air balloon over Cappadocia', 2, '🎈', 'adventure'], ['Camping under the stars', 1, '⛺', 'nature'], ['Football final ticket', 3, '🏆', 'fun'], ['Antarctica expedition', 2, '🐧', 'snow'],
  ],
  pets: [
    ['Golden retriever', 2, '🦮', 'dog'], ['Corgi', 2, '🐕', 'dog'], ['Fluffy cat', 2, '🐈', 'cat'], ['Red panda', 3, '🐼', 'exotic'], ['Baby otter', 3, '🦦', 'exotic'],
    ['Capybara', 2, '🦫', 'exotic'], ['Pygmy goat', 1, '🐐', 'farm'], ['Talking parrot', 2, '🦜', 'bird'], ['Bunny', 1, '🐇', 'small'], ['Hedgehog', 1, '🦔', 'small'],
    ['Pet dragon', 3, '🐉', 'fiction'], ['Penguin', 2, '🐧', 'exotic'], ['Miniature pig', 1, '🐖', 'farm'], ['Husky', 2, '🐺', 'dog'], ['Axolotl', 1, '🦎', 'exotic'],
    ['A loyal unicorn', 3, '🦄', 'fiction'], ['Hamster', 1, '🐹', 'small'], ['Sloth', 1, '🦥', 'exotic'], ['Owl', 2, '🦉', 'bird'], ['Lazy bulldog', 1, '🐶', 'dog'],
  ],
  fantasy: [
    ['Wizard', 2, '🧙', 'magic'], ['Elf archer', 2, '🏹', 'agile'], ['Dwarf warrior', 1, '⛏️', 'strong'], ['Knight', 1, '🛡️', 'strong'], ['Mermaid', 2, '🧜', 'water'],
    ['Fairy', 1, '🧚', 'magic'], ['Vampire', 2, '🧛', 'creature'], ['Genie', 3, '🧞', 'magic'], ['Centaur', 2, '🐎', 'creature'], ['Witch', 1, '🧹', 'magic'],
    ['Troll', 1, '👹', 'strong'], ['Necromancer', 2, '💀', 'magic'], ['Ninja', 2, '🥷', 'agile'], ['Samurai', 2, '⚔️', 'strong'], ['Pirate captain', 1, '🏴‍☠️', 'adventure'],
  ],
};

export const AUCTION_ITEMS: AuctionItem[] = (Object.keys(THEMES) as AuctionTheme[]).flatMap((theme) =>
  THEMES[theme].map(([name, rarity, emoji, tags], i) => ({ id: `a-${theme}-${i + 1}`, name, theme, rarity, emoji, tags: tags ? [tags] : [] })),
);

export const AUCTION_THEMES: { id: AuctionTheme; label: string; emoji: string }[] = [
  { id: 'heroes', label: 'Superheroes', emoji: '🦸' },
  { id: 'villains', label: 'Villains & antiheroes', emoji: '😈' },
  { id: 'anime', label: 'Anime', emoji: '🍥' },
  { id: 'screen', label: 'Movies & TV', emoji: '🎬' },
  { id: 'gaming', label: 'Video games', emoji: '🎮' },
  { id: 'sports', label: 'Sports stars', emoji: '⚽' },
  { id: 'creatures', label: 'Creatures', emoji: '🐉' },
  { id: 'cartoons', label: 'Cartoons', emoji: '🐭' },
  { id: 'internet', label: 'Internet & memes', emoji: '📱' },
  { id: 'food', label: 'Food & stuff', emoji: '🍕' },
  { id: 'cars', label: 'Dream garage', emoji: '🏎️' },
  { id: 'fantasy', label: 'Fantasy', emoji: '🧙' },
  { id: 'music', label: 'Music legends', emoji: '🎤' },
  { id: 'history', label: 'History icons', emoji: '🏛️' },
  { id: 'myths', label: 'Gods & myths', emoji: '⚡' },
  { id: 'powers', label: 'Superpowers', emoji: '🌀' },
  { id: 'trips', label: 'Dream trips', emoji: '✈️' },
  { id: 'pets', label: 'Dream pets', emoji: '🐶' },
];
