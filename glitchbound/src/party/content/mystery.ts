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
  'guitar piano drum violin trumpet microphone ticket map compass flag crown sword shield helmet armour arrow ' +
  'pirate ninja wizard witch ghost vampire zombie mermaid fairy giant knight princess cowboy astronaut detective ' +
  'doctor teacher chef farmer firefighter police pilot dentist clown magician painter singer dancer baker plumber ' +
  'snow rain thunder rainbow sun moon star cloud wind tornado fog ice fire smoke earthquake ' +
  'birthday wedding holiday vacation picnic camping fireworks party parade concert museum festival exam homework ' +
  'football tennis golf swimming skiing boxing chess yoga karate marathon basketball baseball bowling surfing hockey ' +
  'shoe sock hat scarf glove jacket dress tie belt pyjamas sunglasses watch necklace ring wig ' +
  'tree flower rose cactus grass leaf seed shell pearl diamond gold coin treasure balloon kite puzzle dice ' +
  'snowman sandcastle bubble shadow dream ghost secret mystery memory'
)
  .split(' ')
  .filter((w, i, all) => w && all.indexOf(w) === i);
