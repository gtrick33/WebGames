/**
 * Scribble Scramble's words, by how hard they are to draw. The drawer is offered one of each and picks;
 * a harder word is worth more to everyone who gets it. Family friendly, lowercase, letters and single
 * spaces only (the blanks show the shape of the word), at most 20 characters.
 */
export const EASY: readonly string[] = [
  'apple', 'banana', 'cat', 'dog', 'fish', 'sun', 'moon', 'star', 'tree', 'house',
  'car', 'boat', 'ball', 'hat', 'shoe', 'cup', 'book', 'key', 'bed', 'chair',
  'egg', 'cake', 'pizza', 'ice cream', 'flower', 'heart', 'cloud', 'rain', 'snowman', 'smile',
  'eye', 'nose', 'hand', 'foot', 'bird', 'duck', 'pig', 'cow', 'frog', 'snake',
  'spider', 'bee', 'snail', 'worm', 'mouse', 'bone', 'clock', 'door', 'window', 'ladder',
  'candle', 'lamp', 'phone', 'kite', 'balloon', 'drum', 'bell', 'crown', 'ring', 'sock',
  'glasses', 'umbrella', 'pencil', 'scissors', 'spoon', 'fork', 'knife', 'bread', 'cheese', 'carrot',
  'grapes', 'cherry', 'lemon', 'mushroom', 'cookie', 'donut', 'lollipop', 'leaf', 'mountain', 'island',
  'bridge', 'train', 'bus', 'rocket', 'plane', 'robot', 'ghost', 'castle', 'tent', 'flag',
  'fire', 'rainbow', 'lightning', 'bucket', 'shovel', 'box', 'gift', 'envelope', 'stamp', 'magnet',
  'anchor', 'sword', 'shield', 'arrow', 'bow', 'guitar', 'piano', 'whale', 'shark', 'octopus',
  'crab', 'turtle', 'owl', 'penguin', 'lion', 'elephant', 'giraffe', 'zebra', 'monkey', 'rabbit',
  'bear', 'horse', 'chicken', 'sheep', 'tooth', 'brain', 'skull', 'bat', 'broom', 'comb',
];

export const MEDIUM: readonly string[] = [
  'lighthouse', 'skateboard', 'waterfall', 'volcano', 'sandcastle', 'treasure chest', 'pirate ship', 'hot air balloon', 'roller coaster', 'ferris wheel',
  'campfire', 'igloo', 'windmill', 'scarecrow', 'mermaid', 'dragon', 'unicorn', 'wizard', 'vampire', 'zombie',
  'astronaut', 'firefighter', 'chef', 'dentist', 'magician', 'superhero', 'ninja', 'cowboy', 'knight', 'clown',
  'toothbrush', 'hairdryer', 'microphone', 'headphones', 'telescope', 'microscope', 'calculator', 'backpack', 'suitcase', 'wheelchair',
  'parachute', 'submarine', 'helicopter', 'motorcycle', 'tractor', 'ambulance', 'bulldozer', 'canoe', 'sailboat', 'spaceship',
  'snowboard', 'surfing', 'bowling', 'juggling', 'fishing', 'camping', 'skiing', 'karate', 'boxing', 'archery',
  'traffic light', 'mailbox', 'fire hydrant', 'park bench', 'swimming pool', 'playground', 'zoo', 'library', 'hospital', 'airport',
  'spider web', 'beehive', 'bird nest', 'cactus', 'palm tree', 'sunflower', 'pumpkin', 'pineapple', 'watermelon', 'corn',
  'hamburger', 'hot dog', 'french fries', 'popcorn', 'pancakes', 'sushi', 'spaghetti', 'sandwich', 'birthday cake', 'milkshake',
  'jellyfish', 'starfish', 'seahorse', 'dolphin', 'flamingo', 'peacock', 'kangaroo', 'koala', 'hedgehog', 'squirrel',
  'dinosaur', 'caterpillar', 'butterfly', 'ladybug', 'scorpion', 'crocodile', 'gorilla', 'camel', 'parrot', 'raccoon',
  'thunderstorm', 'tornado', 'snowflake', 'sunset', 'full moon', 'shooting star', 'earthquake', 'iceberg', 'desert', 'jungle',
  'sleeping bag', 'alarm clock', 'light bulb', 'paint brush', 'piggy bank', 'teddy bear', 'video game', 'chess', 'dice', 'puzzle',
];

export const HARD: readonly string[] = [
  'time travel', 'black hole', 'gravity', 'echo', 'shadow', 'reflection', 'invisible', 'nightmare', 'daydream', 'deja vu',
  'procrastination', 'jealousy', 'freedom', 'happiness', 'confusion', 'curiosity', 'luck', 'silence', 'electricity', 'wifi',
  'internet', 'password', 'download', 'selfie', 'hashtag', 'autocorrect', 'virtual reality', 'recycling', 'global warming', 'solar system',
  'evolution', 'photosynthesis', 'magnetism', 'hibernation', 'migration', 'eclipse', 'northern lights', 'tsunami', 'avalanche', 'quicksand',
  'stage fright', 'brain freeze', 'sleepwalking', 'hiccups', 'sneeze', 'yawn', 'goosebumps', 'butterflies', 'heartbreak', 'homesick',
  'traffic jam', 'rush hour', 'blackout', 'fire drill', 'jet lag', 'sunburn', 'camouflage', 'telepathy', 'job interview', 'time machine',
  'treasure map', 'haunted house', 'alien invasion', 'zombie apocalypse', 'secret agent', 'bank robbery', 'magic trick', 'shipwreck', 'desert island', 'lost luggage',
  'world record', 'photo finish', 'slow motion', 'instant replay', 'plot twist', 'happy ending', 'cliffhanger', 'sequel', 'spoiler', 'cameo',
  'spring cleaning', 'garage sale', 'family tree', 'love letter', 'blind date', 'first day', 'surprise party', 'pillow fight', 'tug of war', 'hide and seek',
  'gold medal', 'tightrope', 'trampoline', 'bungee jump', 'skydiving', 'scuba diving', 'mountain climber', 'marathon', 'relay race', 'high five',
  'peace', 'balance', 'opposite', 'infinity', 'speed', 'noise', 'birthday', 'weekend', 'midnight', 'tomorrow',
];

export type Tier = 0 | 1 | 2;
export const TIERS: readonly (readonly string[])[] = [EASY, MEDIUM, HARD];
export const TIER_NAMES = ['Easy', 'Medium', 'Hard'] as const;
/** What a correct guess (and the drawer) earns, by tier. */
export const TIER_MULT = [1, 1.5, 2] as const;
