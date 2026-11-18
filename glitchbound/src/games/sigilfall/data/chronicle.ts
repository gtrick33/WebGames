import type { SigilId } from './types';

/**
 * The Chronicle (STORY_BIBLE.md §1 and §2): the tale as a narrator tells it, between the acts, and what each of the
 * seven sigils is. The act pages come up as an act begins (engine.ts storyPages) and stay in the Journal; a sigil's
 * page is the Sigil Rite, the moment it is won.
 */

/** A page of the tale: told as an act begins, kept in the Journal. */
export interface TalePage {
  /** Over the title: "Prologue", "Act II". */
  over: string;
  title: string;
  /** The narrator's words, a paragraph each. */
  told: string[];
  /** What the hero sets out to do now, in one plain sentence. */
  now: string;
}

/** By act id (data/acts.ts). */
export const TALES: Record<string, TalePage> = {
  prologue: {
    over: 'Prologue',
    title: 'The Night the Bells Stopped',
    told: [
      'A thousand years ago a star fell between two sister kingdoms, Aster and Vaelmoor. It broke in two, and each kingdom forged its half into a crown. While those crowns were worn, the dead stayed dead.',
      'Three hundred years ago, King Vaelor of Vaelmoor lost his queen and his two children to the plague. He broke his crown and drank its light to bring them back. They came back for one night. Then his kingdom died and rose again, grey and cold: the Ashen Host. Vaelor became the Hallow King.',
      'Seven wardens broke Aster’s crown into seven sigils, hid them far apart, and sealed the Hallow King in Duskspire, in the frozen north. For three hundred years nobody remembered where the sigils lay.',
      'Somebody has remembered. You come to Briarhollow, a village on the edge of the Vale, as its lamps are lit.',
    ],
    now: 'Find the guard at Briarhollow’s gate.',
  },
  'act-1': {
    over: 'Act I',
    title: 'The Villages of the Vale',
    told: [
      'The Ashen Host came for the sigil hidden under Briarhollow’s chapel, and it failed. The sigil lives in Elyra now, the herbwife’s apprentice. It burns in her like a coal.',
      'The Host will come back for it, with more. Briarhollow cannot stand alone. Elder Maren means to make the village a camp for the whole Vale, if the Vale’s other villages will join it.',
      'Each of them has its own trouble. And each trouble, if you look closely, is paid for in the same cold grey coin.',
    ],
    now: 'Help the villages of the Vale, and win them to Briarhollow’s side.',
  },
  'act-2': {
    over: 'Act II',
    title: 'The Crown City',
    told: [
      'Hearthstead held, but Rider-Captain Vosk escaped with its hearthstone, and the hearthstone was a sigil. The Host now has one sigil, and Elyra has one.',
      'Vosk’s orders said the roads north were paid for. Someone in Aster is selling the kingdom to the Hallow King.',
      'Vosk rode north across the Ashen Barrows, where the lamps are going out one by one. The road to the truth runs the same way, and then west, to the Crown City.',
    ],
    now: 'Follow Vosk’s road north, then find the traitor in the Crown City.',
  },
  'act-3': {
    over: 'Act III',
    title: 'The Race for the Sigils',
    told: [
      'The traitor was Lord Chancellor Crane. He sold the wardens’ map to the Pale Herald, the voice of the Hallow King, and the Host is digging up the sigils one by one.',
      'Four holy places are marked on the map in grey ink: a desert tomb, a fey court, a frozen vault, and a wound in the sky. The Host has a head start on all of them.',
      'The Hallow King needs all seven sigils to open his prison and remake his dead kingdom out of Aster’s grief. Every sigil you reach first is one he will never hold.',
    ],
    now: 'Reach the four places on the wardens’ map before the Host does.',
  },
  'act-4': {
    over: 'Act IV',
    title: 'The Gates',
    told: [
      'At the Tear, Nyx sold your road to the Pale Herald for her brother’s life. The Herald took Elyra, and every sigil she carried, into the north.',
      'That same night the Host burned Fernstead. Briarhollow is full of people who have lost their homes.',
      'Elyra is alive. The Herald needs her: the sigils answer to the one who bonded them. Between you and her stand the Three Gates the wardens built: Highwall, besieged, then the Gloam Gate where she is kept.',
    ],
    now: 'Break the siege of Highwall and find the way to Elyra.',
  },
  'act-5': {
    over: 'Act V',
    title: 'The Dead Kingdom',
    told: [
      'Elyra is free, and five sigils are back in her keeping. Two gates have fallen. The road into Vaelmoor is open.',
      'Beyond it lies the kingdom that died in a single night, three hundred years ago, and has been dying ever since. The snow there never melts. The candles there never go out.',
      'Somewhere in it is the last sigil Elyra can still win. The other is on the Hallow King’s brow.',
    ],
    now: 'Cross Vaelmoor and find the last sigil before the Hallow King’s Host can stop you.',
  },
  'act-6': {
    over: 'Act VI',
    title: 'The Last March',
    told: [
      'Six sigils burn in Elyra now. The seventh, the Sigil of Stone that Vosk stole, is set in the Ash Crown on the Hallow King’s brow.',
      'Everyone you helped is coming: rangers, riders, lancers, huscarls, archers of the forest clans. They gather on the snowfield below Duskspire.',
      'There is one road left, and it ends at the Hallow King’s throne.',
    ],
    now: 'March on Duskspire with every banner you have won.',
  },
  crownfall: {
    over: 'The Finale',
    title: 'Crownfall',
    told: ['The Duskspire Gate has opened. The Hallow King waits on his throne of ice with the Ash Crown on his brow, and his dead knights kneel before him.', 'He does not want the world. He wants his wife and his children back, exactly as they were. He will spend every living soul in Aster to have them.'],
    now: 'Defeat the Hallow King.',
  },
  epilogue: {
    over: 'Epilogue',
    title: 'The Bell',
    told: ['The Ash Crown is unmade. Everything it ate has gone home.', 'The camp at Briarhollow can go home too, those who still have homes. In the chapel tower, the old bell is waiting for someone to ring it.'],
    now: 'Go home to Briarhollow.',
  },
};

/** What a sigil is, for the Sigil Rite and the Journal's crown. */
export interface SigilLore {
  name: string;
  /** Its light (the rite's rays, the crown's gem). */
  color: string;
  /** Where the warden hid it. */
  place: string;
  /** Who hid it. */
  warden: string;
  /** What it showed Elyra (the vision it holds), in a sentence. */
  vision: string;
  /** What it took from her, or null. */
  price: string | null;
  /** A line the wardens cut over its hiding place. */
  verse: string;
}

export const SIGIL_LORE: Record<SigilId, SigilLore> = {
  'sigil-embers': {
    name: 'The Sigil of Embers',
    color: '#ff8a3d',
    place: 'the crypt under Briarhollow’s chapel',
    warden: 'Brother Hale, Briarhollow’s first priest',
    vision: 'The star falling, a thousand years ago, and breaking in two over two kingdoms.',
    price: 'The words of the lullaby her mother sang her. She can still hum it.',
    verse: 'Keep the fire low, and keep it lit.',
  },
  'sigil-sun': {
    name: 'The Sigil of the Sun',
    color: '#ffd84d',
    place: 'the Tomb of the Sun King, in the Sunscorch',
    warden: 'the Sun King, who sealed himself in with it',
    vision: 'A plague ship sailing into Vaelmoor’s harbor, and the young man who waved it in.',
    price: 'The color of Briarhollow’s orchard in spring.',
    verse: 'What the sun has seen, the sun remembers.',
  },
  'sigil-thorns': {
    name: 'The Sigil of Thorns',
    color: '#6ad05a',
    place: 'the Thorn Court, in the Glimmerwood',
    warden: 'the first Prince Thistlemourn',
    vision: 'King Vaelor at his dying children’s bedside, the night he broke his crown.',
    price: 'Thessa’s face. She still knows the name of the woman who raised her.',
    verse: 'Nothing that grows is ever truly lost.',
  },
  'sigil-frost': {
    name: 'The Sigil of Frost',
    color: '#bfe8ff',
    place: 'the Vault of Rime, under the ice of Rimeheld',
    warden: 'Jarl Ingrith the Unthawed, frozen beside it for three hundred years',
    vision: 'Eight wardens at the border. Seven ride away with the sigils. One stays behind.',
    price: 'Her own birthday.',
    verse: 'Hold still, and hold on.',
  },
  'sigil-veil': {
    name: 'The Sigil of the Veil',
    color: '#c58cff',
    place: 'the Tear, in the Shattered Vale',
    warden: 'Magister Orla, who sealed the Tear with it',
    vision: 'Ser Edric, the eighth warden, holding the Gloam Gate alone at dusk.',
    price: 'The night of the raid on Briarhollow: the burning inn, the chapel door, the night she met you.',
    verse: 'Between here and there, a door. Keep it shut.',
  },
  'sigil-tides': {
    name: 'The Sigil of Tides',
    color: '#4ab8ff',
    place: 'the drowned altar of Hollowmere',
    warden: 'Bettany, Queen Ysane’s maid, who stayed',
    vision: 'Queen Ysane, dying, asking Vaelor to let her go.',
    price: 'Your name. She knows your face, and she trusts it.',
    verse: 'Everything the water takes, it gives back changed.',
  },
  'sigil-stone': {
    name: 'The Sigil of Stone',
    color: '#d8c8a0',
    place: 'Hearthstead’s hearthstone, until Vosk stole it for the Ash Crown',
    warden: 'Marshal Teodric of Hearthstead',
    vision: 'Two kings forging two crowns under one sky, when the kingdoms were sisters.',
    price: null,
    verse: 'The hearth outlasts the house.',
  },
};

/** The sigils, in the order the story wins them (the Rite counts them so: "the fourth of seven"). */
export const SIGIL_ORDER: SigilId[] = ['sigil-embers', 'sigil-sun', 'sigil-thorns', 'sigil-frost', 'sigil-veil', 'sigil-tides', 'sigil-stone'];

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
/** "the fourth of seven", for a count of sigils won. */
export const ordinalOfSeven = (n: number): string => `The ${ORDINALS[Math.max(0, Math.min(6, n - 1))]} of seven`;
