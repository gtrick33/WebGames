/**
 * Name Your Price item library. Rarity is a light hint for collectors (1 common, 2 rare, 3 legendary),
 * never a claim about real value. Items need no images: each has an emoji fallback.
 */
import type { AuctionItem, AuctionTheme } from '../types';

type Row = [name: string, rarity: 1 | 2 | 3, emoji: string, tags?: string];

const THEMES: Record<AuctionTheme, Row[]> = {
  heroes: [
    ['Spider-Man', 3, '🕷️', 'agile'], ['Batman', 3, '🦇', 'gadgets'], ['Superman', 3, '🦸', 'strong'], ['Wonder Woman', 3, '⚔️', 'strong'], ['Iron Man', 3, '🤖', 'gadgets'],
    ['Captain America', 2, '🛡️', 'leader'], ['Thor', 2, '🔨', 'strong'], ['Hulk', 2, '💚', 'strong'], ['Black Panther', 2, '🐆', 'agile'], ['The Flash', 2, '⚡', 'speed'],
    ['Aquaman', 1, '🔱', 'water'], ['Ant-Man', 1, '🐜', 'gadgets'], ['Storm', 2, '🌩️', 'magic'], ['Wolverine', 2, '🐺', 'strong'], ['Doctor Strange', 2, '🌀', 'magic'],
    ['Green Lantern', 1, '💍', 'magic'], ['Ms. Marvel', 1, '✨', 'agile'], ['Hawkeye', 1, '🏹', 'agile'], ['Scarlet Witch', 3, '🔮', 'magic'], ['Groot', 1, '🌳', 'strong'],
  ],
  villains: [
    ['The Joker', 3, '🃏', 'chaos'], ['Thanos', 3, '🧤', 'strong'], ['Darth Vader', 3, '🖤', 'leader'], ['Voldemort', 2, '🐍', 'magic'], ['Loki', 2, '🐍', 'trickster'],
    ['Magneto', 2, '🧲', 'magic'], ['Maleficent', 2, '🐉', 'magic'], ['Harley Quinn', 2, '🎈', 'chaos'], ['Venom', 2, '🕸️', 'strong'], ['Catwoman', 1, '🐈‍⬛', 'agile'],
    ['Lex Luthor', 1, '💼', 'gadgets'], ['Ursula', 1, '🐙', 'magic'], ['Scar', 1, '🦁', 'trickster'], ['Bowser', 2, '🐢', 'strong'], ['Dracula', 2, '🧛', 'creature'],
    ['Cruella de Vil', 1, '🐾', 'chaos'], ['The Grinch', 1, '🎄', 'trickster'], ['Green Goblin', 1, '🎃', 'chaos'],
  ],
  anime: [
    ['Goku', 3, '🐉', 'strong'], ['Naruto', 3, '🍥', 'agile'], ['Luffy', 3, '👒', 'strong'], ['Sailor Moon', 2, '🌙', 'magic'], ['Pikachu', 3, '⚡', 'cute'],
    ['Totoro', 2, '🌳', 'cute'], ['Light Yagami', 2, '📓', 'trickster'], ['Levi Ackerman', 2, '⚔️', 'agile'], ['Saitama', 2, '👊', 'strong'], ['Tanjiro', 2, '🌊', 'agile'],
    ['Vegeta', 2, '👑', 'strong'], ['Edward Elric', 1, '🦾', 'magic'], ['Spike Spiegel', 1, '🚬', 'cool'], ['Mikasa', 1, '🧣', 'agile'], ['Gojo Satoru', 3, '🕶️', 'magic'],
    ['Kirby', 1, '🩷', 'cute'], ['Astro Boy', 1, '🚀', 'gadgets'],
  ],
  screen: [
    ['Harry Potter', 3, '⚡', 'magic'], ['James Bond', 3, '🍸', 'gadgets'], ['Indiana Jones', 2, '🤠', 'adventure'], ['Sherlock Holmes', 2, '🔍', 'brains'], ['Hermione Granger', 2, '📚', 'brains'],
    ['Jack Sparrow', 2, '🏴‍☠️', 'trickster'], ['Yoda', 3, '💚', 'magic'], ['Eleven', 2, '🧇', 'magic'], ['Walter White', 2, '⚗️', 'brains'], ['Gandalf', 3, '🧙', 'magic'],
    ['Wednesday Addams', 1, '🖤', 'brains'], ['Rocky Balboa', 1, '🥊', 'strong'], ['Forrest Gump', 1, '🏃', 'speed'], ['Ellen Ripley', 1, '👽', 'adventure'], ['Michael Scott', 1, '☕', 'chaos'],
    ['Mary Poppins', 1, '☂️', 'magic'], ['Neo', 2, '🕶️', 'agile'], ['E.T.', 1, '🚲', 'cute'],
  ],
  gaming: [
    ['Mario', 3, '🍄', 'classic'], ['Link', 3, '🗡️', 'adventure'], ['Master Chief', 2, '🪖', 'strong'], ['Lara Croft', 2, '🏺', 'adventure'], ['Sonic', 2, '💨', 'speed'],
    ['Kratos', 2, '🪓', 'strong'], ['Pac-Man', 1, '🟡', 'classic'], ['Steve (Minecraft)', 1, '⛏️', 'builder'], ['Samus Aran', 2, '🔫', 'gadgets'], ['Geralt of Rivia', 2, '🐺', 'magic'],
    ['Donkey Kong', 1, '🦍', 'strong'], ['Yoshi', 1, '🦖', 'cute'], ['Ezio Auditore', 1, '🦅', 'agile'], ['Cloud Strife', 2, '⚔️', 'strong'], ['Princess Peach', 1, '👑', 'classic'],
    ['Crash Bandicoot', 1, '🌀', 'speed'], ['Among Us Crewmate', 1, '🚀', 'cute'],
  ],
  sports: [
    ['Lionel Messi', 3, '⚽', 'football'], ['Cristiano Ronaldo', 3, '⚽', 'football'], ['Pelé', 3, '⚽', 'legend'], ['Michael Jordan', 3, '🏀', 'legend'], ['Serena Williams', 3, '🎾', 'legend'],
    ['Usain Bolt', 2, '⚡', 'speed'], ['Kylian Mbappé', 2, '⚽', 'football'], ['LeBron James', 2, '🏀', 'basketball'], ['Roger Federer', 2, '🎾', 'legend'], ['Simone Biles', 2, '🤸', 'agile'],
    ['Erling Haaland', 2, '⚽', 'football'], ['Muhammad Ali', 3, '🥊', 'legend'], ['Lewis Hamilton', 2, '🏎️', 'speed'], ['Diego Maradona', 2, '⚽', 'legend'], ['Zinedine Zidane', 2, '⚽', 'legend'],
    ['Novak Djokovic', 2, '🎾', 'tennis'], ['Mo Salah', 1, '⚽', 'football'], ['Steph Curry', 1, '🏀', 'basketball'],
  ],
  creatures: [
    ['Dragon', 3, '🐉', 'myth'], ['Unicorn', 2, '🦄', 'myth'], ['Phoenix', 3, '🔥', 'myth'], ['Kraken', 2, '🦑', 'myth'], ['Yeti', 1, '❄️', 'myth'],
    ['Godzilla', 3, '🦖', 'giant'], ['King Kong', 2, '🦍', 'giant'], ['Loch Ness Monster', 1, '🌊', 'myth'], ['Werewolf', 1, '🐺', 'myth'], ['Griffin', 2, '🦅', 'myth'],
    ['Pegasus', 2, '🪽', 'myth'], ['Mothra', 1, '🦋', 'giant'], ['Slime monster', 1, '🟢', 'silly'], ['Baby dragon', 1, '🐲', 'cute'], ['Giant octopus', 1, '🐙', 'giant'],
  ],
  cartoons: [
    ['SpongeBob', 2, '🧽', 'silly'], ['Bugs Bunny', 2, '🥕', 'trickster'], ['Mickey Mouse', 3, '🐭', 'classic'], ['Homer Simpson', 2, '🍩', 'silly'], ['Scooby-Doo', 2, '🐕', 'classic'],
    ['Shrek', 2, '🧅', 'strong'], ['Bluey', 1, '🐶', 'cute'], ['Peppa Pig', 1, '🐷', 'cute'], ['Garfield', 1, '🍝', 'silly'], ['Snoopy', 2, '✈️', 'classic'],
    ['Tom', 1, '🐈', 'classic'], ['Jerry', 1, '🧀', 'trickster'], ['Patrick Star', 1, '⭐', 'silly'], ['Rick Sanchez', 2, '🧪', 'brains'], ['Winnie the Pooh', 1, '🍯', 'cute'],
    ['Road Runner', 1, '💨', 'speed'], ['Pink Panther', 1, '🩷', 'cool'],
  ],
  internet: [
    ['Rickroll', 2, '🎤', 'meme'], ['Doge', 2, '🐕', 'meme'], ['Grumpy Cat', 2, '😾', 'meme'], ['Nyan Cat', 1, '🌈', 'meme'], ['This is fine dog', 2, '🔥', 'meme'],
    ['Distracted boyfriend', 1, '👀', 'meme'], ['Keyboard cat', 1, '🎹', 'meme'], ['Stonks guy', 1, '📈', 'meme'], ['Dancing baby', 1, '👶', 'retro'], ['Trollface', 1, '😏', 'retro'],
    ['Woman yelling at cat', 2, '🐱', 'meme'], ['Shiba Inu', 1, '🐕', 'cute'], ['Harambe', 1, '🦍', 'retro'], ['Big Chungus', 1, '🐰', 'meme'], ['Pepe', 1, '🐸', 'meme'],
  ],
  food: [
    ['Pizza', 3, '🍕', 'savory'], ['Sushi', 2, '🍣', 'savory'], ['Tacos', 2, '🌮', 'savory'], ['Chocolate cake', 2, '🍰', 'sweet'], ['Croissant', 1, '🥐', 'sweet'],
    ['Burger', 2, '🍔', 'savory'], ['Ramen', 2, '🍜', 'savory'], ['Ice cream', 2, '🍦', 'sweet'], ['Pancakes', 1, '🥞', 'sweet'], ['Avocado toast', 1, '🥑', 'savory'],
    ['Fries', 1, '🍟', 'savory'], ['Donut', 1, '🍩', 'sweet'], ['A lifetime supply of coffee', 3, '☕', 'drink'], ['Unlimited pasta', 2, '🍝', 'savory'], ['A golden toaster', 1, '🍞', 'object'],
    ['Comfy socks', 1, '🧦', 'object'], ['Self-cleaning room', 3, '🧹', 'object'], ['Never-dying phone battery', 3, '🔋', 'object'],
  ],
  cars: [
    ['Ferrari', 3, '🏎️', 'supercar'], ['Lamborghini', 3, '🏎️', 'supercar'], ['Porsche 911', 2, '🚗', 'sports'], ['Bugatti', 3, '🏎️', 'hyper'], ['Tesla', 2, '🔋', 'electric'],
    ['Mini Cooper', 1, '🚙', 'city'], ['VW Camper van', 1, '🚐', 'classic'], ['Aston Martin', 2, '🚗', 'classic'], ['McLaren', 2, '🏎️', 'supercar'], ['Ford Mustang', 2, '🐎', 'muscle'],
    ['Jeep', 1, '🚙', 'offroad'], ['Batmobile', 3, '🦇', 'fiction'], ['DeLorean', 2, '⏱️', 'fiction'], ['Monster truck', 1, '🛻', 'offroad'], ['Vespa', 1, '🛵', 'city'],
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
    ['The Phoenix', 3, '🔥', 'creature'], ['Kraken', 2, '🐙', 'monster'], ['Minotaur', 1, '🐂', 'monster'], ['Pegasus', 2, '🦄', 'creature'], ['Cerberus', 1, '🐕', 'monster'],
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
    ['Greek island hopping', 2, '⛵', 'beach'], ['Machu Picchu trek', 2, '⛰️', 'adventure'], ['Las Vegas weekend', 1, '🎰', 'city'], ['Bali yoga retreat', 1, '🧘', 'beach'], ['Disney World with no queues', 2, '🏰', 'fun'],
    ['Interrail across Europe', 1, '🚆', 'road'], ['Hot-air balloon over Cappadocia', 2, '🎈', 'adventure'], ['Camping under the stars', 1, '⛺', 'nature'], ['World Cup final ticket', 3, '🏆', 'fun'], ['Antarctica expedition', 2, '🐧', 'snow'],
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
