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
    words: ['Pizza|Italy', 'Sushi|Rice', 'Burger|Grill', 'Tacos|Mexico', 'Pancakes|Breakfast', 'Spaghetti|Fork', 'Soup|Spoon', 'Popcorn|Movie theater', 'Hot dog|Mustard', 'Fries|Salt', 'Sandwich|Lunchbox', 'Curry|Spicy', 'Omelet|Eggs', 'Steak|Knife', 'Salad|Bowl', 'Kebab|Late night', 'Dumplings|Steam', 'Lasagna|Layers', 'Nachos|Cheese', 'Croissant|Bakery', 'Paella|Spain', 'Risotto|Creamy rice', 'Fish and chips|Vinegar', 'Ramen|Broth', 'Burrito|Wrap', 'Moussaka|Eggplant', 'Meatballs|Tomato sauce', 'Pierogi|Poland', 'Falafel|Chickpeas', 'Fondue|Melted', 'Hummus|Dip', 'Porridge|Oats'],
  },
  {
    id: 'animals',
    name: 'Animals',
    emoji: '🐘',
    words: ['Elephant|Trunk', 'Giraffe|Tall', 'Penguin|Ice', 'Kangaroo|Pouch', 'Shark|Fin', 'Owl|Night', 'Snake|Hiss', 'Lion|Mane', 'Dolphin|Clever', 'Bee|Honey', 'Octopus|Ink', 'Zebra|Stripes', 'Sloth|Slow', 'Parrot|Talk', 'Camel|Desert', 'Panda|Bamboo', 'Spider|Web', 'Frog|Pond', 'Crocodile|Teeth', 'Bat|Cave', 'Hedgehog|Spikes', 'Koala|Eucalyptus', 'Peacock|Feathers', 'Flamingo|Pink', 'Rhino|Horn', 'Gorilla|Chest beating', 'Squirrel|Nuts', 'Jellyfish|Sting', 'Wolf|Howl', 'Tortoise|Shell', 'Skunk|Smell', 'Hamster|Wheel'],
  },
  {
    id: 'jobs',
    name: 'Jobs',
    emoji: '👩‍⚕️',
    words: ['Doctor|Hospital', 'Teacher|Homework', 'Firefighter|Ladder', 'Pilot|Cockpit', 'Chef|Kitchen', 'Police officer|Badge', 'Dentist|Smile', 'Farmer|Tractor', 'Hairdresser|Scissors', 'Lawyer|Court', 'Astronaut|Helmet', 'Plumber|Pipes', 'Photographer|Flash', 'Waiter|Tray', 'Mechanic|Garage', 'Lifeguard|Whistle', 'Mail carrier|Letters', 'DJ|Party', 'Builder|Bricks', 'Vet|Pets', 'Judge|Gavel', 'Magician|Rabbit', 'Clown|Red nose', 'Baker|Flour', 'Surgeon|Scalpel', 'Taxi driver|Meter', 'Barista|Latte', 'Scientist|Lab coat', 'Electrician|Wires', 'Tattoo artist|Ink', 'Detective|Clues', 'Zookeeper|Feeding time'],
  },
  {
    id: 'places',
    name: 'Places',
    emoji: '🏖️',
    words: ['Beach|Sand', 'Library|Quiet', 'Airport|Gate', 'Hospital|Beds', 'Movie theater|Screen', 'Gym|Sweat', 'Supermarket|Cart', 'Zoo|Cages', 'School|Bell', 'Museum|Exhibits', 'Stadium|Crowd', 'Church|Bells', 'Bank|Money', 'Hotel|Keycard', 'Restaurant|Menu', 'Park|Bench', 'Prison|Bars', 'Farm|Barn', 'Night club|Dance floor', 'Train station|Platform', 'Casino|Chips', 'Spa|Relax', 'Parking garage|Levels', 'Gas station|Pump', 'Bakery|Bread', 'Laundromat|Spin', 'Ice rink|Skates', 'Aquarium|Tanks', 'Bowling alley|Lanes', 'Theme park|Lines', 'Lighthouse|Ships', 'Campground|Tents'],
  },
  {
    id: 'countries',
    name: 'Countries',
    emoji: '🌍',
    words: ['Italy|Pasta', 'Japan|Sushi', 'Brazil|Carnival', 'Egypt|Pyramids', 'France|Baguette', 'Australia|Kangaroo', 'Canada|Maple', 'Mexico|Sombrero', 'India|Spices', 'China|Great Wall', 'Greece|Islands', 'Spain|Flamenco', 'Germany|Beer', 'Russia|Cold', 'USA|Hollywood', 'United Kingdom|Tea', 'Norway|Fjords', 'Turkey|Bazaar', 'Bulgaria|Yogurt', 'Iceland|Volcanoes', 'Portugal|Custard tarts', 'Netherlands|Tulips', 'Switzerland|Watches', 'Ireland|Green', 'Scotland|Kilts', 'Thailand|Temples', 'Argentina|Tango', 'Kenya|Safari', 'Morocco|Souks', 'Finland|Saunas', 'South Korea|Kimchi', 'Peru|Llamas'],
  },
  {
    id: 'cities',
    name: 'Cities',
    emoji: '🏙️',
    words: ['Paris|Tower', 'London|Big Ben', 'New York|Taxis', 'Rome|Colosseum', 'Tokyo|Neon', 'Venice|Canals', 'Barcelona|Gaudí', 'Dubai|Skyscrapers', 'Amsterdam|Bikes', 'Las Vegas|Casinos', 'Istanbul|Two continents', 'Berlin|Wall', 'Sydney|Opera House', 'Rio de Janeiro|Christ statue', 'Moscow|Red Square', 'Athens|Ancient', 'Cairo|Nile', 'Sofia|Vitosha', 'Prague|Bridges', 'Los Angeles|Movie stars', 'Madrid|Royal palace', 'Lisbon|Trams', 'Vienna|Waltz', 'Dublin|Pubs', 'Edinburgh|Castle on a hill', 'Budapest|Thermal baths', 'San Francisco|Golden Gate', 'Hong Kong|Harbor', 'Marrakech|Market square', 'Bangkok|Tuk-tuks', 'Plovdiv|Hills', 'Varna|Sea garden'],
  },
  {
    id: 'sports',
    name: 'Sports',
    emoji: '⚽',
    words: ['Soccer|Goal', 'Basketball|Hoop', 'Tennis|Racket', 'Swimming|Pool', 'Boxing|Gloves', 'Golf|Hole', 'Skiing|Snow', 'Volleyball|Net', 'Cycling|Pedals', 'Surfing|Waves', 'Chess|Board', 'Bowling|Pins', 'Darts|Bullseye', 'Baseball|Bat', 'Ice hockey|Puck', 'Karate|Black belt', 'Car racing|Pit stop', 'Marathon|Running', 'Table tennis|Paddle', 'Skateboarding|Tricks', 'Rugby|Scrum', 'Cricket|Wickets', 'Fencing|Sword', 'Archery|Target', 'Wrestling|Mat', 'Rowing|Oars', 'Snowboarding|Halfpipe', 'Badminton|Shuttlecock', 'Gymnastics|Beam', 'Horseback riding|Saddle', 'Climbing|Rope', 'Diving|Springboard'],
  },
  {
    id: 'movies',
    name: 'Movies',
    emoji: '🎬',
    words: ['Horror movie|Scream', 'Romantic comedy|Kiss', 'Western|Cowboys', 'Musical|Songs', 'Cartoon|Drawings', 'Documentary|Facts', 'Science fiction|Future', 'Heist|Vault', 'Zombie movie|Undead', 'Disaster movie|Flood', 'Car chase|Speed', 'Superhero movie|Cape', 'Trailer|Preview', 'Popcorn|Butter', 'Red carpet|Stars', 'Sequel|Part two', 'Stunt double|Danger', 'Subtitles|Reading', 'Movie director|Action!', 'Movie ticket|Seat', 'Cameo|Brief appearance', 'Plot twist|Surprise', 'Blooper|Mistake', 'Villain|Evil', 'Soundtrack|Music', 'Award ceremony|Speech', 'End credits|Names', 'Remake|Again', 'Animation|Frames', 'Special effects|Explosions', 'Box office|Ticket sales', 'Premiere|Opening night'],
  },
  {
    id: 'characters',
    name: 'Storybook characters',
    emoji: '📖',
    words: ['Little Red Riding Hood|Grandma', 'Robin Hood|Arrows', 'Snow White|Apple', 'Rapunzel|Long hair', 'Sherlock Holmes|Detective', 'Santa Claus|Reindeer', 'Tooth Fairy|Pillow', 'Dracula|Blood', 'Cinderella|Shoe', 'Sleeping Beauty|Spindle', 'King Arthur|Round table', 'Captain Hook|Crocodile', 'Peter Pan|Neverland', 'Pinocchio|Nose', 'Goldilocks|Porridge', 'Aladdin|Lamp', 'Hansel and Gretel|Breadcrumbs', 'Easter Bunny|Eggs', 'Jack and the Beanstalk|Giant', 'The Big Bad Wolf|Huff and puff', 'Rumpelstiltskin|Straw into gold', 'Puss in Boots|Clever cat', 'Ali Baba|Forty thieves', 'Thumbelina|Tiny girl', 'The Pied Piper|Rats', 'Baba Yaga|Hut on chicken legs', 'Merlin|Wizard', 'The Snow Queen|Mirror shard', 'The Ugly Duckling|Swan', 'Humpty Dumpty|Wall', 'Sinbad|Sailor', 'The Frog Prince|Kiss'],
  },
  {
    id: 'home',
    name: 'Around the house',
    emoji: '🛋️',
    words: ['Sofa|Living room', 'Bed|Pillow', 'Fridge|Cold', 'Toothbrush|Bathroom', 'Mirror|Reflection', 'Lamp|Light', 'Television|Remote', 'Washing machine|Laundry', 'Shower|Water', 'Clock|Time', 'Carpet|Floor', 'Curtains|Window', 'Vacuum cleaner|Dust', 'Toilet|Flush', 'Doorbell|Visitor', 'Bookshelf|Novels', 'Candle|Flame', 'Plant|Water it', 'Closet|Clothes', 'Microwave|Heat', 'Radiator|Warm', 'Stairs|Up and down', 'Doormat|Welcome', 'Bath|Bubbles', 'Light switch|Click', 'Fridge magnet|Sticky', 'Ironing board|Creases', 'Smoke alarm|Beep', 'Coat hook|Hang', 'Trash can|Garbage', 'Attic|Boxes', 'Mailbox|Letters'],
  },
  {
    id: 'kitchen',
    name: 'In the kitchen',
    emoji: '🍳',
    words: ['Frying pan|Eggs', 'Kettle|Boil', 'Toaster|Bread', 'Oven|Bake', 'Blender|Smoothie', 'Fork|Prongs', 'Chopsticks|Two', 'Grater|Cheese', 'Rolling pin|Dough', 'Colander|Holes', 'Spatula|Flip', 'Corkscrew|Wine', 'Ladle|Soup', 'Whisk|Cream', 'Teapot|Cups', 'Cutting board|Knife', 'Dishwasher|Plates', 'Apron|Cooking', 'Ice cube|Freezer', 'Salt shaker|Seasoning', 'Sieve|Flour', 'Measuring cup|Milliliters', 'Can opener|Beans', 'Oven mitt|Hot', 'Pepper mill|Grind', 'Saucepan|Lid', 'Egg timer|Sand', 'Pizza cutter|Wheel', 'Tongs|Grab', 'Cookie sheet|Cookies', 'Garlic press|Crush', 'Food processor|Chop'],
  },
  {
    id: 'clothes',
    name: 'Clothes',
    emoji: '👗',
    words: ['Jeans|Denim', 'Scarf|Neck', 'Socks|Feet', 'Hoodie|Zip', 'Tie|Office', 'Swimsuit|Beach', 'Pajamas|Sleep', 'Raincoat|Wet', 'Sneakers|Laces', 'Gloves|Hands', 'Wedding dress|White', 'Sunglasses|Shades', 'Hat|Head', 'Belt|Buckle', 'Uniform|School', 'High heels|Tall', 'Bikini|Summer', 'Suit|Formal', 'Slippers|Home', 'Crown|King', 'Bow tie|Tuxedo', 'Leggings|Stretchy', 'Cardigan|Buttons', 'Bathrobe|Spa', 'Overalls|Farmer', 'Beanie|Woolly', 'Wellies|Mud', 'Sandals|Toes', 'Waistcoat|Three-piece', 'Kilt|Scotland', 'Vest|Under', 'Onesie|Animal costume'],
  },
  {
    id: 'transport',
    name: 'Transport',
    emoji: '🚗',
    words: ['Bicycle|Pedal', 'Helicopter|Rotor', 'Submarine|Underwater', 'Taxi|Yellow', 'Train|Tracks', 'Motorcycle|Helmet', 'Hot air balloon|Basket', 'Rocket|Launch', 'Tractor|Field', 'Ambulance|Siren', 'Cruise ship|Vacation', 'Skateboard|Wheels', 'Tram|City', 'Canoe|Paddle', 'Scooter|Kick', 'Airplane|Wings', 'Bus|Stops', 'Horse carriage|Royal', 'Limousine|Long', 'Cable car|Mountain', 'Ferry|Crossing', 'Jet ski|Spray', 'Rickshaw|Pulled', 'Segway|Balance', 'Fire truck|Hose', 'Garbage truck|Trash', 'Gondola|Venice', 'Monorail|One track', 'Hovercraft|Cushion of air', 'Snowmobile|Ice', 'Unicycle|Juggler', 'Glider|Silent'],
  },
  {
    id: 'music',
    name: 'Music',
    emoji: '🎸',
    words: ['Guitar|Strings', 'Piano|Keys', 'Drums|Sticks', 'Violin|Bow', 'Trumpet|Brass', 'Microphone|Sing', 'Karaoke|Lyrics', 'Concert|Stage', 'Headphones|Ears', 'Saxophone|Jazz', 'Harmonica|Mouth', 'Choir|Group', 'Opera|Soprano', 'Rap|Rhymes', 'Flute|Wind', 'Accordion|Folk', 'Vinyl record|Retro', 'Playlist|Songs', 'Orchestra|Conductor', 'Festival|Tents', 'Tambourine|Jingle', 'Cello|Big violin', 'Banjo|Country', 'Bagpipes|Scotland', 'Xylophone|Mallets', 'Triangle|Ding', 'DJ decks|Scratch', 'Music video|Dance', 'Encore|One more', 'Lullaby|Baby', 'National anthem|Stand up', 'Busker|Hat'],
  },
  {
    id: 'hobbies',
    name: 'Hobbies',
    emoji: '🎨',
    words: ['Painting|Brush', 'Fishing|Rod', 'Gardening|Soil', 'Knitting|Wool', 'Camping|Tent', 'Cooking|Recipe', 'Photography|Camera', 'Yoga|Mat', 'Reading|Pages', 'Gaming|Controller', 'Dancing|Moves', 'Baking|Oven', 'Hiking|Trail', 'Puzzles|Pieces', 'Juggling|Balls', 'Pottery|Clay', 'Bird watching|Binoculars', 'Magic tricks|Cards', 'Rock climbing|Ropes', 'Collecting stamps|Album', 'Origami|Folding', 'Scrapbooking|Glue', 'Woodwork|Saw', 'Calligraphy|Pen', 'Embroidery|Needle', 'Crosswords|Clues', 'Sewing|Machine', 'Metal detecting|Beach treasure', 'Kite flying|String', 'Board games|Dice', 'Candle making|Wax', 'Model trains|Tiny tracks'],
  },
  {
    id: 'school',
    name: 'School',
    emoji: '🏫',
    words: ['Homework|Evening', 'Exam|Grades', 'Backpack|Shoulders', 'Pencil|Sharpen', 'Calculator|Math', 'Lunch break|Food', 'Principal|Office', 'Blackboard|Chalk', 'Field trip|Bus', 'Detention|After class', 'Graduation|Hats', 'Science lab|Experiments', 'Gym class|Sport', 'Library card|Books', 'Report card|Parents', 'Ruler|Straight', 'Map|Geography', 'School bus|Yellow', 'Spelling bee|Letters', 'Summer vacation|Freedom', 'Teacher’s pet|Favorite', 'Lunchbox|Sandwich', 'Playground|Swings', 'Field day|Egg and spoon', 'Assembly|Hall', 'Class schedule|Lessons', 'Pencil case|Zipper', 'Notebook|Lines', 'Hall pass|Corridor', 'Class photo|Smile', 'Fire drill|Alarm', 'Prom|Dance'],
  },
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    words: ['Pumpkin|Orange', 'Ghost|Sheet', 'Witch|Broom', 'Vampire|Fangs', 'Zombie|Brains', 'Skeleton|Bones', 'Werewolf|Moon', 'Haunted house|Creaks', 'Candy|Sweet', 'Spider web|Corner', 'Black cat|Bad luck', 'Mummy|Bandages', 'Costume|Dress up', 'Cauldron|Potion', 'Graveyard|Night', 'Trick or treat|Doorbell', 'Scarecrow|Field', 'Bat|Cave', 'Frankenstein|Bolts', 'Jack-o’-lantern|Candle', 'Ghost story|Flashlight', 'Spell book|Pages', 'Coffin|Lid', 'Tombstone|Rest in peace', 'Crow|Black bird', 'Full moon|Howling', 'Poison apple|Bite', 'Eyeball|Stare', 'Fog machine|Smoke', 'Caramel apple|Stick', 'Masquerade mask|Party', 'Creaky door|Hinges'],
  },
  {
    id: 'winter',
    name: 'Winter & Christmas',
    emoji: '🎄',
    words: ['Snowman|Carrot', 'Christmas tree|Lights', 'Reindeer|Antlers', 'Present|Wrapping', 'Gingerbread|Cookies', 'Sled|Hill', 'Mittens|Warm', 'Fireplace|Logs', 'Snowball|Throw', 'Ice skating|Rink', 'Stocking|Chimney', 'Elf|Workshop', 'Mistletoe|Kiss', 'Hot chocolate|Mug', 'Advent calendar|Doors', 'Fireworks|Midnight', 'Snowflake|Unique', 'Ski lift|Mountain', 'Carolers|Doorstep', 'Candy cane|Stripes', 'Igloo|Ice house', 'Snow angel|Lie down', 'Icicle|Drip', 'Polar bear|Arctic', 'Mulled wine|Cinnamon', 'Chestnuts|Roasting', 'Ugly Christmas sweater|Knitted', 'Sleigh bells|Jingle', 'Frost|Windshield', 'Snowplow|Road', 'Ski goggles|Glare', 'Wreath|Front door'],
  },
  {
    id: 'summer',
    name: 'Summer',
    emoji: '☀️',
    words: ['Sunscreen|Skin', 'Ice cream|Melt', 'Sandcastle|Bucket', 'Flip-flops|Feet', 'Watermelon|Seeds', 'Barbecue|Smoke', 'Beach umbrella|Shade', 'Surfboard|Waves', 'Road trip|Car', 'Pool party|Splash', 'Lemonade|Sour', 'Sunburn|Red', 'Festival|Wristband', 'Camping|Stars', 'Hammock|Swing', 'Postcard|Stamp', 'Snorkel|Fish', 'Sunset|Orange sky', 'Mosquito|Itchy', 'Water gun|Squirt', 'Kiddie pool|Backyard', 'Beach chair|Fold', 'Popsicle|Stick', 'Beach ball|Inflatable', 'Seashell|Ear', 'Sunhat|Brim', 'Picnic|Blanket', 'Heatwave|Sweat', 'Electric fan|Breeze', 'Pier|Arcade', 'Tide pool|Crab', 'Strawberries|Cream'],
  },
  {
    id: 'party',
    name: 'Party time',
    emoji: '🎉',
    words: ['Birthday cake|Candles', 'Balloons|Air', 'Confetti|Mess', 'Dance floor|Lights', 'Piñata|Stick', 'Karaoke|Song', 'Costume party|Dress up', 'Party hat|Cone', 'Champagne|Bubbles', 'Surprise party|Shh', 'Hangover|Morning', 'Bouncer|Door', 'Disco ball|Sparkle', 'Party games|Fun', 'Invitation|RSVP', 'Fireworks|Bang', 'Pizza delivery|Doorbell', 'Playlist|Songs', 'Selfie|Phone', 'Wedding|Rings', 'Goodie bag|Candy', 'Limbo|Bend', 'Musical chairs|Music stops', 'Party popper|Bang', 'Streamers|Ceiling', 'Toast|Speech', 'Conga|Line', 'Kazoo|Buzz', 'Glow sticks|Neon', 'Photo booth|Props', 'After-party|Late', 'Gatecrasher|Uninvited'],
  },
  {
    id: 'body',
    name: 'Body',
    emoji: '💪',
    words: ['Elbow|Arm', 'Nose|Smell', 'Knee|Leg', 'Tongue|Taste', 'Eyebrow|Face', 'Heart|Beat', 'Thumb|Hand', 'Belly button|Middle', 'Hair|Comb', 'Teeth|Brush', 'Ear|Listen', 'Lungs|Breathe', 'Skeleton|Bones', 'Muscle|Gym', 'Fingernail|Polish', 'Brain|Think', 'Ankle|Foot', 'Eyelashes|Blink', 'Shoulder|Carry', 'Freckles|Spots', 'Wrist|Watch', 'Chin|Beard', 'Toes|Ten', 'Hip|Dance', 'Spine|Back', 'Cheek|Kiss', 'Nostril|Hole', 'Kidney|Bean shape', 'Liver|Detox', 'Dimples|Smile', 'Goosebumps|Cold', 'Pulse|Wrist'],
  },
  {
    id: 'nature',
    name: 'Nature & weather',
    emoji: '🌦️',
    words: ['Rainbow|Colors', 'Volcano|Lava', 'Waterfall|Splash', 'Thunderstorm|Lightning', 'Desert|Sand', 'Jungle|Vines', 'Iceberg|Floating', 'Tornado|Spin', 'Fog|Gray', 'Cave|Dark', 'Island|Water all around', 'Mountain|Peak', 'Earthquake|Shake', 'Sunrise|Morning', 'Snow|White', 'River|Flow', 'Forest|Trees', 'Hail|Ice', 'Coral reef|Fish', 'Moon|Night', 'Glacier|Melt', 'Lightning|Flash', 'Meadow|Flowers', 'Swamp|Mud', 'Canyon|Deep', 'Geyser|Spurt', 'Sand dune|Wind', 'Rainforest|Wet', 'Avalanche|Slide', 'Tide|Beach', 'Dew|Grass', 'Puddle|Boots'],
  },
  {
    id: 'tech',
    name: 'Tech',
    emoji: '📱',
    words: ['Smartphone|Pocket', 'Laptop|Keyboard', 'Router|Internet', 'Selfie stick|Pole', 'Robot|Metal', 'Drone|Flying', 'Video call|Camera', 'Password|Secret', 'Charger|Battery', 'Emoji|Face', 'Virtual reality|Headset', 'Printer|Paper', 'Smartwatch|Wrist', 'Podcast|Listen', 'Hashtag|Social', 'Wireless earbuds|Music', 'Game console|Controller', 'Email|Inbox', 'Spam|Junk', 'Artificial intelligence|Chatbot', 'Webcam|Video', 'USB stick|Files', 'Cloud storage|Backup', 'Wi-Fi|Signal', 'Hard drive|Data', 'Touchscreen|Fingers', 'QR code|Scan', 'Smart speaker|Voice', 'Spreadsheet|Cells', 'Software update|Restart', 'Pop-up|Annoying', 'Captcha|Robot'],
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    emoji: '🐉',
    words: ['Dragon|Fire', 'Unicorn|Horn', 'Mermaid|Tail', 'Wizard|Staff', 'Fairy|Wings', 'Giant|Huge', 'Troll|Bridge', 'Castle|Tower', 'Magic wand|Spell', 'Treasure|Gold', 'Pirate ship|Flag', 'Phoenix|Rebirth', 'Elf|Pointy ears', 'Genie|Lamp', 'Crystal ball|Future', 'Knight|Armor', 'Potion|Bottle', 'Goblin|Green', 'Centaur|Half horse', 'Flying carpet|Rug', 'Pegasus|Winged horse', 'Griffin|Eagle and lion', 'Dwarf|Beard', 'Ogre|Swamp', 'Sorceress|Enchant', 'Sea monster|Tentacles', 'Cyclops|One eye', 'Hydra|Many heads', 'Fairy tale|Once upon a time', 'Enchanted forest|Mist', 'Dragon egg|Hatch', 'Kraken|Ship sinker'],
  },
  {
    id: 'space',
    name: 'Space',
    emoji: '🚀',
    words: ['Moon|Crater', 'Mars|Red', 'Sun|Hot', 'Astronaut|Spacesuit', 'Black hole|Gravity', 'Alien|Green', 'Comet|Tail', 'Satellite|Orbit', 'Telescope|Lens', 'Saturn|Rings', 'Shooting star|Wish', 'Space station|Floating', 'Galaxy|Spiral', 'Rocket|Countdown', 'UFO|Saucer', 'Meteor|Rock', 'Eclipse|Shadow', 'Milky Way|Stars', 'Jupiter|Giant', 'Moon landing|Footprint', 'Neptune|Blue', 'Venus|Hottest', 'Asteroid|Belt', 'Nebula|Cloud', 'Gravity|Fall', 'Spacewalk|Tether', 'Mission control|Houston', 'Star sign|Horoscope', 'Supernova|Explosion', 'Planetarium|Dome', 'Constellation|Pattern', 'Rover|Wheels'],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    emoji: '🍰',
    words: ['Ice cream|Cone', 'Chocolate|Cocoa', 'Cheesecake|Creamy', 'Donut|Hole', 'Cupcake|Frosting', 'Waffle|Grid', 'Brownie|Square', 'Tiramisu|Coffee', 'Jell-O|Wobbly', 'Apple pie|Crust', 'Macaron|Pastel', 'Churros|Dip', 'Cotton candy|Fair', 'Pudding|Spoon', 'Milkshake|Straw', 'Lollipop|Stick', 'Baklava|Honey', 'Banana split|Three scoops', 'Fudge|Sugar', 'Sorbet|Fruit', 'Crème brûlée|Burnt sugar', 'Trifle|Layers', 'Custard|Yellow', 'Profiteroles|Cream puffs', 'Meringue|Egg whites', 'Gelato|Italy', 'Sticky toffee pudding|Dates', 'Rice pudding|Cinnamon', 'Fruit salad|Bowl', 'Éclair|Choux', 'Strudel|Austria', 'Panna cotta|Wobble'],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    emoji: '🥤',
    words: ['Coffee|Morning', 'Tea|Kettle', 'Orange juice|Breakfast', 'Lemonade|Lemons', 'Hot chocolate|Marshmallows', 'Milk|Cow', 'Smoothie|Blender', 'Cola|Fizzy', 'Water|Tap', 'Beer|Foam', 'Wine|Grapes', 'Champagne|Toast', 'Cocktail|Umbrella', 'Iced tea|Summer', 'Energy drink|Buzz', 'Coconut water|Tropical', 'Bubble tea|Pearls', 'Ayran|Yogurt', 'Espresso|Tiny cup', 'Kombucha|Fermented', 'Cappuccino|Froth', 'Hot toddy|Honey', 'Gin and tonic|Ice and lemon', 'Mojito|Mint', 'Sangria|Fruit', 'Prosecco|Italian fizz', 'Whisky|Scotland', 'Herbal tea|Calm', 'Boza|Thick', 'Matcha|Green', 'Root beer|Float', 'Slush|Brain freeze'],
  },
  {
    id: 'fruitveg',
    name: 'Fruit & veg',
    emoji: '🍎',
    words: ['Banana|Yellow', 'Strawberry|Seeds', 'Pineapple|Spiky', 'Carrot|Rabbit', 'Onion|Tears', 'Broccoli|Tree', 'Lemon|Sour', 'Avocado|Toast', 'Tomato|Ketchup', 'Potato|Fries', 'Grapes|Bunch', 'Cherry|Pair', 'Coconut|Palm', 'Garlic|Vampires', 'Corn|Cob', 'Mushroom|Forest', 'Pumpkin|Halloween', 'Kiwi|Fuzzy', 'Chili pepper|Hot', 'Peas|Pod', 'Eggplant|Purple', 'Peach|Stone', 'Cabbage|Leaves', 'Beet|Red juice', 'Mango|Tropical', 'Pear|Shape', 'Raspberry|Jam', 'Cucumber|Salad', 'Lettuce|Burger', 'Plum|Prune', 'Blueberry|Muffin', 'Zucchini|Green'],
  },
  {
    id: 'toys',
    name: 'Games & toys',
    emoji: '🧸',
    words: ['Teddy bear|Cuddle', 'Building blocks|Stack', 'Yo-yo|String', 'Kite|Wind', 'Puzzle cube|Twist', 'Doll|Hair', 'Hide and seek|Counting', 'Dominoes|Tiles', 'Jigsaw puzzle|Pieces', 'Trampoline|Bounce', 'Flying disc|Throw', 'Water balloon|Splash', 'Board game|Dice', 'Jump rope|Skip', 'Marbles|Glass', 'Video game|Screen', 'Rocking horse|Wooden', 'Slide|Playground', 'Card game|Deck', 'Tag|Chase', 'Spinning top|Twirl', 'Toy soldier|March', 'Jack-in-the-box|Surprise', 'Hula hoop|Hips', 'Pogo stick|Spring', 'Kaleidoscope|Patterns', 'Marionette|Strings', 'Toy train|Tracks', 'Remote-control car|Batteries', 'Bubble wand|Soap', 'Sandbox|Bucket', 'Rag doll|Floppy'],
  },
  {
    id: 'feelings',
    name: 'Feelings',
    emoji: '😍',
    words: ['Love|Heart', 'Jealousy|Envy', 'Boredom|Yawn', 'Surprise|Gasp', 'Fear|Scream', 'Pride|Chest out', 'Embarrassment|Blush', 'Excitement|Jump', 'Homesick|Far away', 'Nostalgia|Old days', 'Confusion|Huh', 'Relief|Phew', 'Hunger|Stomach', 'Laziness|Sofa', 'Anger|Red face', 'Guilt|Sorry', 'Hope|Wish', 'Stress|Deadline', 'Joy|Smile', 'Sleepy|Bed', 'Awkwardness|Silence', 'Gratitude|Thanks', 'Loneliness|Alone', 'Curiosity|Questions', 'Panic|Run', 'Shyness|Hide', 'Smugness|Grin', 'Disgust|Yuck', 'Regret|Undo', 'Calm|Breathe', 'Grumpiness|Morning', 'Hangry|Snack'],
  },
  {
    id: 'bulgaria',
    name: 'Bulgaria',
    emoji: '🇧🇬',
    words: ['Banitsa|Pastry', 'Shopska salad|Cheese', 'Rakia|Strong', 'Martenitsa|Red and white', 'Kukeri|Masks', 'Rila Monastery|Mountains', 'Black Sea|Beach', 'Rose oil|Valley', 'Yogurt|Bacteria', 'Horo|Circle dance', 'Vitosha|Ski', 'Plovdiv|Old town', 'Varna|Seaside', 'Cyrillic|Alphabet', 'Baba Marta|March', 'Seven Rila Lakes|Hike', 'Lyutenitsa|Peppers', 'Sunny Beach|Party', 'Tarator|Cucumber', 'Nestinari|Fire walking', 'Lukanka|Sausage', 'Shkembe chorba|Hangover', 'Rose Valley|Kazanlak', 'Koprivshtitsa|Old houses', 'Belogradchik Rocks|Fortress', 'Thracian gold|Treasure', 'Bansko|Ski slopes', 'Melnik|Wine', 'Rhodope Mountains|Bagpipes', 'Kozunak|Easter', 'Survachka|New Year', 'Buzludzha|Monument'],
  },
  {
    id: 'powers',
    name: 'Superpowers',
    emoji: '⚡',
    words: ['Invisibility|Hidden', 'Flying|Sky', 'Super strength|Lift', 'Teleportation|Instant', 'Mind reading|Thoughts', 'Time travel|Past', 'Super speed|Fast', 'X-ray vision|Through walls', 'Shape shifting|Disguise', 'Healing|Wounds', 'Breathing underwater|Gills', 'Talking to animals|Pets', 'Freezing time|Pause', 'Fire powers|Hot', 'Weather control|Storms', 'Super memory|Remember', 'Shrinking|Tiny', 'Elastic body|Stretch', 'Night vision|Dark', 'Luck|Lottery', 'Telekinesis|Move things', 'Invulnerability|Bulletproof', 'Super hearing|Whispers', 'Self-cloning|Copies', 'Magnetism|Metal', 'Super jump|Leap', 'Laser eyes|Beam', 'Plant control|Vines', 'Ear-splitting scream|Glass breaks', 'Electric touch|Spark', 'Super smell|Nose', 'Mind control|Puppet'],
  },
  {
    id: 'travel',
    name: 'Travel',
    emoji: '✈️',
    words: ['Passport|Stamp', 'Suitcase|Wheels', 'Boarding pass|Seat', 'Jet lag|Tired', 'Souvenir|Gift', 'Hostel|Bunk beds', 'Tour guide|Umbrella', 'Map|Lost', 'Selfie|Landmark', 'Duty free|Perfume', 'Customs|Declare', 'Window seat|View', 'Backpacking|Budget', 'Room service|Hotel', 'Travel insurance|Just in case', 'Sunbed|Pool', 'Visa|Embassy', 'Road trip|Snacks', 'Cruise|Ship', 'Airport security|Liquids', 'Layover|Waiting', 'Hand luggage|Overhead', 'Currency exchange|Rates', 'Guidebook|Tips', 'Phrasebook|Words', 'Lost luggage|Carousel', 'Sightseeing|Bus tour', 'Camper van|Road', 'Check-in|Desk', 'Sleeper train|Bunk', 'Travel pillow|Neck', 'Tourist trap|Overpriced'],
  },
  {
    id: 'social',
    name: 'Online life',
    emoji: '📸',
    words: ['Influencer|Followers', 'Meme|Funny', 'Livestream|Chat', 'Filter|Face', 'Unboxing|Package', 'Viral video|Shares', 'Story|24 hours', 'Comment section|Opinions', 'Dance trend|Moves', 'Group chat|Messages', 'Dating app|Swipe', 'Podcast|Microphone', 'Online shopping|Delivery', 'Clickbait|Title', 'Notification|Ping', 'Screenshot|Proof', 'Voice message|Listen', 'Profile picture|Photo', 'Like button|Heart', 'Subscribe|Channel', 'Troll|Mean comments', 'Blue tick|Verified', 'Direct message|Private', 'Reaction video|Face', 'Unfollow|Bye', 'Trending|Popular', 'Caption|Text', 'Avatar|Cartoon me', 'Canceled|Backlash', 'Thirst trap|Pose', 'Algorithm|Feed', 'Ghosting|Disappear'],
  },
  {
    id: 'everyday',
    name: 'Everyday things',
    emoji: '🧺',
    words: ['Umbrella|Rain', 'Keys|Lock', 'Wallet|Cards', 'Glasses|Eyes', 'Backpack|Straps', 'Alarm clock|Wake up', 'Lighter|Flame', 'Bandage|Cut', 'Battery|Power', 'Envelope|Letter', 'Scissors|Cut', 'Tape|Sticky', 'Coin|Money', 'Rubber duck|Bath', 'Calendar|Dates', 'Remote control|Channels', 'Hairdryer|Hot air', 'Paperclip|Office', 'Flashlight|Dark', 'Shopping bag|Groceries', 'Toothpaste|Minty', 'Comb|Hair', 'Coat hanger|Closet', 'Plug|Socket', 'Teaspoon|Stir', 'Safety pin|Sharp', 'Sticky note|Reminder', 'Receipt|Store', 'Doorstop|Wedge', 'Clothespin|Clothesline', 'Rubber band|Stretch', 'Matches|Strike'],
  },
];

/** A theme's words as [word, hint] pairs. */
export const pairs = (t: ImpostorTheme): [string, string][] => t.words.map((w) => w.split('|') as [string, string]);
