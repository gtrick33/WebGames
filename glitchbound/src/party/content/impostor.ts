/**
 * Impostor: everyone gets the secret word except the impostor, who only gets a hint (related, but
 * never the word). Themes keep a round fair: everyone knows what kind of thing it is.
 * Each entry is "word|hint". Append only within a theme: a word's id is theme + position.
 */
export interface ImpostorTheme {
  id: string;
  name: string;
  emoji: string;
  words: string[];
}

export const IMPOSTOR_THEMES: ImpostorTheme[] = [
  {
    id: 'food',
    name: 'Food',
    emoji: '🍕',
    words: ['Pizza|Italy', 'Sushi|Rice', 'Burger|Grill', 'Tacos|Mexico', 'Pancakes|Breakfast', 'Spaghetti|Fork', 'Soup|Spoon', 'Popcorn|Cinema', 'Hot dog|Mustard', 'Fries|Salt', 'Sandwich|Lunchbox', 'Curry|Spicy', 'Omelette|Eggs', 'Steak|Knife', 'Salad|Bowl', 'Kebab|Late night', 'Dumplings|Steam', 'Lasagne|Layers', 'Nachos|Cheese', 'Croissant|Bakery'],
  },
  {
    id: 'animals',
    name: 'Animals',
    emoji: '🐘',
    words: ['Elephant|Trunk', 'Giraffe|Tall', 'Penguin|Ice', 'Kangaroo|Pouch', 'Shark|Fin', 'Owl|Night', 'Snake|Hiss', 'Lion|Mane', 'Dolphin|Clever', 'Bee|Honey', 'Octopus|Ink', 'Zebra|Stripes', 'Sloth|Slow', 'Parrot|Talk', 'Camel|Desert', 'Panda|Bamboo', 'Spider|Web', 'Frog|Pond', 'Crocodile|Teeth', 'Bat|Cave'],
  },
  {
    id: 'jobs',
    name: 'Jobs',
    emoji: '👩‍⚕️',
    words: ['Doctor|Hospital', 'Teacher|Homework', 'Firefighter|Ladder', 'Pilot|Cockpit', 'Chef|Kitchen', 'Police officer|Badge', 'Dentist|Smile', 'Farmer|Tractor', 'Hairdresser|Scissors', 'Lawyer|Court', 'Astronaut|Helmet', 'Plumber|Pipes', 'Photographer|Flash', 'Waiter|Tray', 'Mechanic|Garage', 'Lifeguard|Whistle', 'Postman|Letters', 'DJ|Party', 'Builder|Bricks', 'Vet|Pets'],
  },
  {
    id: 'places',
    name: 'Places',
    emoji: '🏖️',
    words: ['Beach|Sand', 'Library|Quiet', 'Airport|Gate', 'Hospital|Beds', 'Cinema|Screen', 'Gym|Sweat', 'Supermarket|Trolley', 'Zoo|Cages', 'School|Bell', 'Museum|Exhibits', 'Stadium|Crowd', 'Church|Bells', 'Bank|Money', 'Hotel|Keycard', 'Restaurant|Menu', 'Park|Bench', 'Prison|Bars', 'Farm|Barn', 'Night club|Dance floor', 'Train station|Platform'],
  },
  {
    id: 'countries',
    name: 'Countries',
    emoji: '🌍',
    words: ['Italy|Pasta', 'Japan|Sushi', 'Brazil|Carnival', 'Egypt|Pyramids', 'France|Baguette', 'Australia|Kangaroo', 'Canada|Maple', 'Mexico|Sombrero', 'India|Spices', 'China|Great Wall', 'Greece|Islands', 'Spain|Flamenco', 'Germany|Beer', 'Russia|Cold', 'USA|Hollywood', 'United Kingdom|Tea', 'Norway|Fjords', 'Turkey|Bazaar', 'Bulgaria|Yoghurt', 'Iceland|Volcanoes'],
  },
  {
    id: 'cities',
    name: 'Cities',
    emoji: '🏙️',
    words: ['Paris|Tower', 'London|Big Ben', 'New York|Taxis', 'Rome|Colosseum', 'Tokyo|Neon', 'Venice|Canals', 'Barcelona|Gaudí', 'Dubai|Skyscrapers', 'Amsterdam|Bikes', 'Las Vegas|Casinos', 'Istanbul|Two continents', 'Berlin|Wall', 'Sydney|Opera House', 'Rio de Janeiro|Christ statue', 'Moscow|Red Square', 'Athens|Ancient', 'Cairo|Nile', 'Sofia|Vitosha', 'Prague|Bridges', 'Los Angeles|Movie stars'],
  },
  {
    id: 'sports',
    name: 'Sports',
    emoji: '⚽',
    words: ['Football|Goal', 'Basketball|Hoop', 'Tennis|Racket', 'Swimming|Pool', 'Boxing|Gloves', 'Golf|Hole', 'Skiing|Snow', 'Volleyball|Net', 'Cycling|Pedals', 'Surfing|Waves', 'Chess|Board', 'Bowling|Pins', 'Darts|Bullseye', 'Baseball|Bat', 'Ice hockey|Puck', 'Karate|Black belt', 'Motor racing|Pit stop', 'Marathon|Running', 'Table tennis|Paddle', 'Skateboarding|Tricks'],
  },
  {
    id: 'movies',
    name: 'Movies',
    emoji: '🎬',
    words: ['Horror film|Scream', 'Romantic comedy|Kiss', 'Western|Cowboys', 'Musical|Songs', 'Cartoon|Drawings', 'Documentary|Facts', 'Science fiction|Future', 'Heist|Vault', 'Zombie film|Undead', 'Disaster movie|Flood', 'Car chase|Speed', 'Superhero film|Cape', 'Trailer|Preview', 'Popcorn|Butter', 'Red carpet|Stars', 'Sequel|Part two', 'Stunt double|Danger', 'Subtitles|Reading', 'Movie director|Action!', 'Cinema ticket|Seat'],
  },
  {
    id: 'characters',
    name: 'Storybook characters',
    emoji: '📖',
    words: ['Little Red Riding Hood|Grandma', 'Robin Hood|Arrows', 'Snow White|Apple', 'Rapunzel|Long hair', 'Sherlock Holmes|Detective', 'Santa Claus|Reindeer', 'Tooth Fairy|Pillow', 'Dracula|Blood', 'Cinderella|Shoe', 'Sleeping Beauty|Spindle', 'King Arthur|Round table', 'Captain Hook|Crocodile', 'Peter Pan|Neverland', 'Pinocchio|Nose', 'Goldilocks|Porridge', 'Aladdin|Lamp', 'Hansel and Gretel|Breadcrumbs', 'Easter Bunny|Eggs', 'Jack and the Beanstalk|Giant', 'The Big Bad Wolf|Huff and puff'],
  },
  {
    id: 'home',
    name: 'Around the house',
    emoji: '🛋️',
    words: ['Sofa|Living room', 'Bed|Pillow', 'Fridge|Cold', 'Toothbrush|Bathroom', 'Mirror|Reflection', 'Lamp|Light', 'Television|Remote', 'Washing machine|Laundry', 'Shower|Water', 'Clock|Time', 'Carpet|Floor', 'Curtains|Window', 'Vacuum cleaner|Dust', 'Toilet|Flush', 'Doorbell|Visitor', 'Bookshelf|Novels', 'Candle|Flame', 'Plant|Water it', 'Wardrobe|Clothes', 'Microwave|Heat'],
  },
  {
    id: 'kitchen',
    name: 'In the kitchen',
    emoji: '🍳',
    words: ['Frying pan|Eggs', 'Kettle|Boil', 'Toaster|Bread', 'Oven|Bake', 'Blender|Smoothie', 'Fork|Prongs', 'Chopsticks|Two', 'Grater|Cheese', 'Rolling pin|Dough', 'Colander|Holes', 'Spatula|Flip', 'Corkscrew|Wine', 'Ladle|Soup', 'Whisk|Cream', 'Teapot|Cups', 'Cutting board|Knife', 'Dishwasher|Plates', 'Apron|Cooking', 'Ice cube|Freezer', 'Salt shaker|Seasoning'],
  },
  {
    id: 'clothes',
    name: 'Clothes',
    emoji: '👗',
    words: ['Jeans|Denim', 'Scarf|Neck', 'Socks|Feet', 'Hoodie|Zip', 'Tie|Office', 'Swimsuit|Beach', 'Pajamas|Sleep', 'Raincoat|Wet', 'Sneakers|Laces', 'Gloves|Hands', 'Wedding dress|White', 'Sunglasses|Shades', 'Hat|Head', 'Belt|Buckle', 'Uniform|School', 'High heels|Tall', 'Bikini|Summer', 'Suit|Formal', 'Slippers|Home', 'Crown|King'],
  },
  {
    id: 'transport',
    name: 'Transport',
    emoji: '🚗',
    words: ['Bicycle|Pedal', 'Helicopter|Rotor', 'Submarine|Underwater', 'Taxi|Yellow', 'Train|Tracks', 'Motorbike|Helmet', 'Hot air balloon|Basket', 'Rocket|Launch', 'Tractor|Field', 'Ambulance|Siren', 'Cruise ship|Holiday', 'Skateboard|Wheels', 'Tram|City', 'Canoe|Paddle', 'Scooter|Kick', 'Airplane|Wings', 'Bus|Stops', 'Horse carriage|Royal', 'Limousine|Long', 'Cable car|Mountain'],
  },
  {
    id: 'music',
    name: 'Music',
    emoji: '🎸',
    words: ['Guitar|Strings', 'Piano|Keys', 'Drums|Sticks', 'Violin|Bow', 'Trumpet|Brass', 'Microphone|Sing', 'Karaoke|Lyrics', 'Concert|Stage', 'Headphones|Ears', 'Saxophone|Jazz', 'Harmonica|Mouth', 'Choir|Group', 'Opera|Soprano', 'Rap|Rhymes', 'Flute|Wind', 'Accordion|Folk', 'Vinyl record|Retro', 'Playlist|Songs', 'Orchestra|Conductor', 'Festival|Tents'],
  },
  {
    id: 'hobbies',
    name: 'Hobbies',
    emoji: '🎨',
    words: ['Painting|Brush', 'Fishing|Rod', 'Gardening|Soil', 'Knitting|Wool', 'Camping|Tent', 'Cooking|Recipe', 'Photography|Camera', 'Yoga|Mat', 'Reading|Pages', 'Gaming|Controller', 'Dancing|Moves', 'Baking|Oven', 'Hiking|Trail', 'Puzzles|Pieces', 'Juggling|Balls', 'Pottery|Clay', 'Bird watching|Binoculars', 'Magic tricks|Cards', 'Rock climbing|Ropes', 'Collecting stamps|Album'],
  },
  {
    id: 'school',
    name: 'School',
    emoji: '🏫',
    words: ['Homework|Evening', 'Exam|Grades', 'Backpack|Shoulders', 'Pencil|Sharpen', 'Calculator|Math', 'Lunch break|Food', 'Principal|Office', 'Blackboard|Chalk', 'Field trip|Bus', 'Detention|After class', 'Graduation|Hats', 'Science lab|Experiments', 'Gym class|Sport', 'Library card|Books', 'Report card|Parents', 'Ruler|Straight', 'Map|Geography', 'School bus|Yellow', 'Spelling bee|Letters', 'Summer holidays|Freedom'],
  },
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    words: ['Pumpkin|Orange', 'Ghost|Sheet', 'Witch|Broom', 'Vampire|Fangs', 'Zombie|Brains', 'Skeleton|Bones', 'Werewolf|Moon', 'Haunted house|Creaks', 'Candy|Sweet', 'Spider web|Corner', 'Black cat|Bad luck', 'Mummy|Bandages', 'Costume|Dress up', 'Cauldron|Potion', 'Graveyard|Night', 'Trick or treat|Doorbell', 'Scarecrow|Field', 'Bat|Cave', 'Frankenstein|Bolts', 'Jack-o’-lantern|Candle'],
  },
  {
    id: 'winter',
    name: 'Winter & Christmas',
    emoji: '🎄',
    words: ['Snowman|Carrot', 'Christmas tree|Lights', 'Reindeer|Antlers', 'Present|Wrapping', 'Gingerbread|Cookies', 'Sledge|Hill', 'Mittens|Warm', 'Fireplace|Logs', 'Snowball|Throw', 'Ice skating|Rink', 'Stocking|Chimney', 'Elf|Workshop', 'Mistletoe|Kiss', 'Hot chocolate|Mug', 'Advent calendar|Doors', 'Fireworks|Midnight', 'Snowflake|Unique', 'Ski lift|Mountain', 'Carol singers|Doorstep', 'Candy cane|Stripes'],
  },
  {
    id: 'summer',
    name: 'Summer',
    emoji: '☀️',
    words: ['Sunscreen|Skin', 'Ice cream|Melt', 'Sandcastle|Bucket', 'Flip-flops|Feet', 'Watermelon|Seeds', 'Barbecue|Smoke', 'Beach umbrella|Shade', 'Surfboard|Waves', 'Road trip|Car', 'Pool party|Splash', 'Lemonade|Sour', 'Sunburn|Red', 'Festival|Wristband', 'Camping|Stars', 'Hammock|Swing', 'Postcard|Stamp', 'Snorkel|Fish', 'Sunset|Orange sky', 'Mosquito|Itchy', 'Water gun|Squirt'],
  },
  {
    id: 'party',
    name: 'Party time',
    emoji: '🎉',
    words: ['Birthday cake|Candles', 'Balloons|Air', 'Confetti|Mess', 'Dance floor|Lights', 'Piñata|Stick', 'Karaoke|Song', 'Fancy dress|Costume', 'Party hat|Cone', 'Champagne|Bubbles', 'Surprise party|Shh', 'Hangover|Morning', 'Bouncer|Door', 'Disco ball|Sparkle', 'Party games|Fun', 'Invitation|RSVP', 'Fireworks|Bang', 'Pizza delivery|Doorbell', 'Playlist|Songs', 'Selfie|Phone', 'Wedding|Rings'],
  },
  {
    id: 'body',
    name: 'Body',
    emoji: '💪',
    words: ['Elbow|Arm', 'Nose|Smell', 'Knee|Leg', 'Tongue|Taste', 'Eyebrow|Face', 'Heart|Beat', 'Thumb|Hand', 'Belly button|Middle', 'Hair|Comb', 'Teeth|Brush', 'Ear|Listen', 'Lungs|Breathe', 'Skeleton|Bones', 'Muscle|Gym', 'Fingernail|Polish', 'Brain|Think', 'Ankle|Foot', 'Eyelashes|Blink', 'Shoulder|Carry', 'Freckles|Spots'],
  },
  {
    id: 'nature',
    name: 'Nature & weather',
    emoji: '🌦️',
    words: ['Rainbow|Colors', 'Volcano|Lava', 'Waterfall|Splash', 'Thunderstorm|Lightning', 'Desert|Sand', 'Jungle|Vines', 'Iceberg|Floating', 'Tornado|Spin', 'Fog|Gray', 'Cave|Dark', 'Island|Water all around', 'Mountain|Peak', 'Earthquake|Shake', 'Sunrise|Morning', 'Snow|White', 'River|Flow', 'Forest|Trees', 'Hail|Ice', 'Coral reef|Fish', 'Moon|Night'],
  },
  {
    id: 'tech',
    name: 'Tech',
    emoji: '📱',
    words: ['Smartphone|Pocket', 'Laptop|Keyboard', 'Router|Internet', 'Selfie stick|Pole', 'Robot|Metal', 'Drone|Flying', 'Video call|Camera', 'Password|Secret', 'Charger|Battery', 'Emoji|Face', 'Virtual reality|Headset', 'Printer|Paper', 'Smartwatch|Wrist', 'Podcast|Listen', 'Hashtag|Social', 'Wireless earbuds|Music', 'Game console|Controller', 'Email|Inbox', 'Spam|Junk', 'Artificial intelligence|Chatbot'],
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    emoji: '🐉',
    words: ['Dragon|Fire', 'Unicorn|Horn', 'Mermaid|Tail', 'Wizard|Staff', 'Fairy|Wings', 'Giant|Huge', 'Troll|Bridge', 'Castle|Tower', 'Magic wand|Spell', 'Treasure|Gold', 'Pirate ship|Flag', 'Phoenix|Rebirth', 'Elf|Pointy ears', 'Genie|Lamp', 'Crystal ball|Future', 'Knight|Armor', 'Potion|Bottle', 'Goblin|Green', 'Centaur|Half horse', 'Flying carpet|Rug'],
  },
  {
    id: 'space',
    name: 'Space',
    emoji: '🚀',
    words: ['Moon|Crater', 'Mars|Red', 'Sun|Hot', 'Astronaut|Spacesuit', 'Black hole|Gravity', 'Alien|Green', 'Comet|Tail', 'Satellite|Orbit', 'Telescope|Lens', 'Saturn|Rings', 'Shooting star|Wish', 'Space station|Floating', 'Galaxy|Spiral', 'Rocket|Countdown', 'UFO|Saucer', 'Meteor|Rock', 'Eclipse|Shadow', 'Milky Way|Stars', 'Jupiter|Giant', 'Moon landing|Footprint'],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    emoji: '🍰',
    words: ['Ice cream|Cone', 'Chocolate|Cocoa', 'Cheesecake|Creamy', 'Donut|Hole', 'Cupcake|Frosting', 'Waffle|Grid', 'Brownie|Square', 'Tiramisu|Coffee', 'Jelly|Wobbly', 'Apple pie|Crust', 'Macaron|Pastel', 'Churros|Dip', 'Candy floss|Fair', 'Pudding|Spoon', 'Milkshake|Straw', 'Lollipop|Stick', 'Baklava|Honey', 'Banana split|Three scoops', 'Fudge|Sugar', 'Sorbet|Fruit'],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    emoji: '🥤',
    words: ['Coffee|Morning', 'Tea|Kettle', 'Orange juice|Breakfast', 'Lemonade|Lemons', 'Hot chocolate|Marshmallows', 'Milk|Cow', 'Smoothie|Blender', 'Cola|Fizzy', 'Water|Tap', 'Beer|Foam', 'Wine|Grapes', 'Champagne|Toast', 'Cocktail|Umbrella', 'Iced tea|Summer', 'Energy drink|Buzz', 'Coconut water|Tropical', 'Bubble tea|Pearls', 'Ayran|Yoghurt', 'Espresso|Tiny cup', 'Kombucha|Fermented'],
  },
  {
    id: 'fruitveg',
    name: 'Fruit & veg',
    emoji: '🍎',
    words: ['Banana|Yellow', 'Strawberry|Seeds', 'Pineapple|Spiky', 'Carrot|Rabbit', 'Onion|Tears', 'Broccoli|Tree', 'Lemon|Sour', 'Avocado|Toast', 'Tomato|Ketchup', 'Potato|Chips', 'Grapes|Bunch', 'Cherry|Pair', 'Coconut|Palm', 'Garlic|Vampires', 'Corn|Cob', 'Mushroom|Forest', 'Pumpkin|Halloween', 'Kiwi|Fuzzy', 'Chilli pepper|Hot', 'Peas|Pod'],
  },
  {
    id: 'toys',
    name: 'Games & toys',
    emoji: '🧸',
    words: ['Teddy bear|Cuddle', 'Building blocks|Stack', 'Yo-yo|String', 'Kite|Wind', 'Puzzle cube|Twist', 'Doll|Hair', 'Hide and seek|Counting', 'Dominoes|Tiles', 'Jigsaw puzzle|Pieces', 'Trampoline|Bounce', 'Flying disc|Throw', 'Water balloon|Splash', 'Board game|Dice', 'Skipping rope|Jump', 'Marbles|Glass', 'Video game|Screen', 'Rocking horse|Wooden', 'Slide|Playground', 'Card game|Deck', 'Tag|Chase'],
  },
  {
    id: 'feelings',
    name: 'Feelings',
    emoji: '😍',
    words: ['Love|Heart', 'Jealousy|Envy', 'Boredom|Yawn', 'Surprise|Gasp', 'Fear|Scream', 'Pride|Chest out', 'Embarrassment|Blush', 'Excitement|Jump', 'Homesick|Far away', 'Nostalgia|Old days', 'Confusion|Huh', 'Relief|Phew', 'Hunger|Stomach', 'Laziness|Sofa', 'Anger|Red face', 'Guilt|Sorry', 'Hope|Wish', 'Stress|Deadline', 'Joy|Smile', 'Sleepy|Bed'],
  },
  {
    id: 'bulgaria',
    name: 'Bulgaria',
    emoji: '🇧🇬',
    words: ['Banitsa|Pastry', 'Shopska salad|Cheese', 'Rakia|Strong', 'Martenitsa|Red and white', 'Kukeri|Masks', 'Rila Monastery|Mountains', 'Black Sea|Beach', 'Rose oil|Valley', 'Yoghurt|Bacteria', 'Horo|Circle dance', 'Vitosha|Ski', 'Plovdiv|Old town', 'Varna|Seaside', 'Cyrillic|Alphabet', 'Baba Marta|March', 'Seven Rila Lakes|Hike', 'Lyutenitsa|Peppers', 'Sunny Beach|Party', 'Tarator|Cucumber', 'Nestinari|Fire walking'],
  },
  {
    id: 'powers',
    name: 'Superpowers',
    emoji: '⚡',
    words: ['Invisibility|Hidden', 'Flying|Sky', 'Super strength|Lift', 'Teleportation|Instant', 'Mind reading|Thoughts', 'Time travel|Past', 'Super speed|Fast', 'X-ray vision|Through walls', 'Shape shifting|Disguise', 'Healing|Wounds', 'Breathing underwater|Gills', 'Talking to animals|Pets', 'Freezing time|Pause', 'Fire powers|Hot', 'Weather control|Storms', 'Super memory|Remember', 'Shrinking|Tiny', 'Elastic body|Stretch', 'Night vision|Dark', 'Luck|Lottery'],
  },
  {
    id: 'travel',
    name: 'Travel',
    emoji: '✈️',
    words: ['Passport|Stamp', 'Suitcase|Wheels', 'Boarding pass|Seat', 'Jet lag|Tired', 'Souvenir|Gift', 'Hostel|Bunk beds', 'Tour guide|Umbrella', 'Map|Lost', 'Selfie|Landmark', 'Duty free|Perfume', 'Customs|Declare', 'Window seat|View', 'Backpacking|Budget', 'Room service|Hotel', 'Travel insurance|Just in case', 'Sunbed|Pool', 'Visa|Embassy', 'Road trip|Snacks', 'Cruise|Ship', 'Airport security|Liquids'],
  },
  {
    id: 'social',
    name: 'Online life',
    emoji: '📸',
    words: ['Influencer|Followers', 'Meme|Funny', 'Livestream|Chat', 'Filter|Face', 'Unboxing|Package', 'Viral video|Shares', 'Story|24 hours', 'Comment section|Opinions', 'Dance trend|Moves', 'Group chat|Messages', 'Dating app|Swipe', 'Podcast|Microphone', 'Online shopping|Delivery', 'Clickbait|Title', 'Notification|Ping', 'Screenshot|Proof', 'Voice message|Listen', 'Profile picture|Photo', 'Like button|Heart', 'Subscribe|Channel'],
  },
  {
    id: 'everyday',
    name: 'Everyday things',
    emoji: '🧺',
    words: ['Umbrella|Rain', 'Keys|Lock', 'Wallet|Cards', 'Glasses|Eyes', 'Backpack|Straps', 'Alarm clock|Wake up', 'Lighter|Flame', 'Plaster|Cut', 'Battery|Power', 'Envelope|Letter', 'Scissors|Cut', 'Tape|Sticky', 'Coin|Money', 'Rubber duck|Bath', 'Calendar|Dates', 'Remote control|Channels', 'Hairdryer|Hot air', 'Paperclip|Office', 'Torch|Dark', 'Shopping bag|Groceries'],
  },
];

/** A theme's words as [word, hint] pairs. */
export const pairs = (t: ImpostorTheme): [string, string][] => t.words.map((w) => w.split('|') as [string, string]);
