/**
 * One of a Kind: mystery words. Everyday things that are easy to clue in one word, so the fun is in
 * dodging each other's clues. Original list, no brand names.
 */
export const MYSTERY_WORDS: string[] = (
  'apple banana cherry lemon mango pineapple strawberry watermelon carrot potato tomato onion garlic pumpkin mushroom popcorn ' +
  'pancake waffle sandwich burger pizza noodles sushi taco cheese butter honey chocolate cookie cake donut cereal coffee tea ' +
  'milk soup salad pepper salt sugar egg bacon sausage toast jam pickle peanut cucumber broccoli corn rice bread ' +
  'cat dog horse cow pig sheep goat chicken duck owl eagle penguin parrot flamingo swan frog snake turtle lizard crocodile ' +
  'shark whale dolphin octopus crab jellyfish lobster seal bee butterfly spider ant snail worm mouse rabbit squirrel hedgehog ' +
  'fox wolf bear lion tiger zebra giraffe elephant monkey gorilla kangaroo koala panda camel bat unicorn dragon dinosaur ' +
  'castle bridge tower lighthouse pyramid church school hospital library museum airport station prison farm zoo circus ' +
  'beach island desert jungle forest mountain volcano river lake waterfall cave glacier ocean garden park playground ' +
  'kitchen bathroom bedroom attic basement garage balcony elevator staircase chimney roof window door fence mailbox ' +
  'umbrella candle mirror clock lamp pillow blanket sofa chair table bed ladder hammer scissors needle magnet key lock ' +
  'wallet backpack suitcase bottle cup spoon fork knife plate kettle toaster fridge oven microwave vacuum broom bucket ' +
  'phone computer camera television radio robot rocket satellite telescope microscope battery lightbulb headphones keyboard ' +
  'car bus train bicycle motorbike truck tractor helicopter airplane boat submarine sailboat skateboard scooter ambulance ' +
  'guitar piano drum violin trumpet microphone ticket map compass flag crown sword shield helmet armor arrow ' +
  'pirate ninja wizard witch ghost vampire zombie mermaid fairy giant knight princess cowboy astronaut detective ' +
  'doctor teacher chef farmer firefighter police pilot dentist clown magician painter singer dancer baker plumber ' +
  'snow rain thunder rainbow sun moon star cloud wind tornado fog ice fire smoke earthquake ' +
  'birthday wedding holiday vacation picnic camping fireworks party parade concert museum festival exam homework ' +
  'football tennis golf swimming skiing boxing chess yoga karate marathon basketball baseball bowling surfing hockey ' +
  'shoe sock hat scarf glove jacket dress tie belt pajamas sunglasses watch necklace ring wig ' +
  'tree flower rose cactus grass leaf seed shell pearl diamond gold coin treasure balloon kite puzzle dice ' +
  'snowman sandcastle bubble shadow dream ghost secret mystery memory ' +
  'avocado blueberry coconut grape kiwi lime melon olive peach pear plum raspberry lettuce cabbage spinach ' +
  'beetroot radish celery pea bean lentil chilli ginger cinnamon vanilla mustard ketchup mayonnaise omelette ' +
  'porridge yoghurt muffin croissant bagel pretzel crumpet scone biscuit brownie pudding custard jelly lollipop ' +
  'marshmallow popsicle smoothie milkshake lemonade juice soda wine beer champagne cocktail whisky gin vodka ' +
  'espresso cappuccino kebab burrito lasagne spaghetti risotto curry dumpling falafel hummus nachos fries hotdog ' +
  'meatball steak llama alpaca donkey bull reindeer moose deer badger otter beaver raccoon skunk hamster ferret ' +
  'gerbil cheetah leopard panther hyena rhino hippo walrus seahorse starfish shrimp squid oyster clam stingray ' +
  'swordfish pelican stork crow raven pigeon seagull vulture peacock ostrich turkey goose hummingbird woodpecker ' +
  'robin sparrow beetle ladybird mosquito wasp moth caterpillar cricket grasshopper scorpion centipede tadpole ' +
  'slug skyscraper cottage mansion igloo tent caravan treehouse cabin barn shed windmill palace temple mosque ' +
  'cathedral stadium arena gym cinema theatre bakery butcher pharmacy supermarket market mall harbour pier tunnel ' +
  'motorway roundabout crossroads pavement lamppost bench fountain statue monument cemetery toothbrush toothpaste ' +
  'soap shampoo towel sponge razor comb hairbrush perfume lipstick mascara pillowcase duvet mattress hammock ' +
  'cushion rug curtain wardrobe drawer shelf bookcase desk stool cradle dustpan mop iron hanger peg basket bin ' +
  'hose rake shovel wheelbarrow lawnmower teapot mug saucer bowl jug pan wok whisk sieve grater ladle spatula ' +
  'corkscrew tray laptop tablet printer router charger cable remote joystick drone speaker earphones webcam ' +
  'calculator stapler envelope stamp notebook pencil crayon eraser ruler glue paintbrush easel bulldozer crane ' +
  'forklift taxi tram limousine yacht canoe kayak raft ferry glider jetpack sledge saxophone cello harp flute ' +
  'accordion banjo ukulele harmonica tambourine xylophone bagpipes tuba referee goalkeeper trophy medal whistle ' +
  'stopwatch racket saddle surfboard snowboard dartboard iceberg canyon cliff swamp meadow oasis geyser valley ' +
  'reef lagoon dune hurricane blizzard drought flood hailstorm lightning sunshine breeze frost dew puddle mud ' +
  'skeleton mummy werewolf goblin troll ogre elf dwarf genie centaur phoenix griffin yeti sheriff butler nanny ' +
  'surgeon lifeguard janitor librarian cashier waiter barber florist tailor spy burglar judge lawyer mayor king ' +
  'queen prince emperor pharaoh viking samurai gladiator gift confetti invitation costume mask tiara passport ' +
  'souvenir postcard binoculars lantern torch rope anchor silver ruby emerald piggybank hiccup sneeze yawn snore ' +
  'tickle wink hug kiss handshake selfie emoji password hashtag podcast playlist livestream meme spam virus yoyo ' +
  'dominoes cards marbles trampoline swing seesaw slide sandpit'
)
  .split(' ')
  .filter((w, i, all) => w && all.indexOf(w) === i);
