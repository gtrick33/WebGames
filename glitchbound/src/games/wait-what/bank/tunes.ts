/**
 * "Name that tune": famous melodies that are long out of copyright, played by a small chiptune synth
 * (sound.ts). Notes are "NOTE:beats" (for example "E4:1 D#5:0.5"; "R" is a rest), in the tune's own
 * tempo. Only the opening phrase is played: enough to recognise, short enough for the clock.
 * `spooky` tunes are picked for Halloween. Append only: a tune's id is its position.
 */
export interface Tune {
  name: string;
  bpm: number;
  notes: string;
  fact: string;
  spooky?: true;
}

export const TUNES: Tune[] = [
  { name: 'Ode to Joy', bpm: 132, notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2', fact: 'From Beethoven’s Ninth Symphony (1824), finished when he was almost completely deaf. It is now the anthem of the European Union.' },
  { name: 'Twinkle, Twinkle, Little Star', bpm: 120, notes: 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2', fact: 'The tune is an old French song, “Ah! vous dirai-je, maman”. Mozart wrote twelve variations on it.' },
  { name: 'Happy Birthday', bpm: 120, notes: 'G4:0.75 G4:0.25 A4 G4 C5 B4:2 G4:0.75 G4:0.25 A4 G4 D5 C5:2', fact: 'It began in 1893 as “Good Morning to All”. In 2015 a US judge ruled the copyright claim on it invalid.' },
  { name: 'Jingle Bells', bpm: 150, notes: 'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4', fact: 'Published in 1857 as “One Horse Open Sleigh”. In 1965 it became the first song played in space, on a harmonica.' },
  { name: 'Für Elise', bpm: 110, notes: 'E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1.5 R:0.5 C4:0.5 E4:0.5 A4:0.5 B4:1.5 R:0.5 E4:0.5 G#4:0.5 B4:0.5 C5:1.5', fact: 'Beethoven’s piece was only found 40 years after his death. Nobody knows for sure who Elise was.' },
  { name: 'Frère Jacques', bpm: 130, notes: 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2', fact: 'A French round from the 1700s about a monk who sleeps through the morning bells.' },
  { name: 'Mary Had a Little Lamb', bpm: 130, notes: 'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2', fact: 'The first words ever recorded on a phonograph, by Thomas Edison in 1877.' },
  { name: 'Beethoven’s Fifth Symphony', bpm: 108, notes: 'R:0.5 G4:0.5 G4:0.5 G4:0.5 D#4:2 R:0.5 F4:0.5 F4:0.5 F4:0.5 D4:3', fact: 'Da-da-da-DUM. The rhythm matches Morse code for V, so the BBC used it as a “V for Victory” signal in World War II.' },
  { name: 'Here Comes the Bride', bpm: 76, notes: 'C4 F4:0.75 F4:0.25 F4:2 C4 G4:0.75 E4:0.25 F4:2', fact: 'It is the Bridal Chorus from Wagner’s opera Lohengrin (1850), where the marriage goes badly wrong.' },
  { name: 'Toccata and Fugue in D minor', bpm: 60, notes: 'A4:0.25 G4:0.25 A4:1.5 R:0.5 G4:0.25 F4:0.25 E4:0.25 D4:0.25 C#4:1 D4:2', fact: 'The organ piece usually credited to Bach became the sound of every haunted house and mad scientist.', spooky: true },
  { name: 'Funeral March (Chopin)', bpm: 56, notes: 'A#3:1 A#3:0.75 A#3:0.25 A#3:1 C#4:0.75 C4:0.25 C4:0.75 A#3:0.25 A#3:0.75 A3:0.25 A#3:2', fact: 'From Chopin’s Piano Sonata No. 2 (1839). It was played at his own funeral ten years later.', spooky: true },
  { name: 'Dies Irae', bpm: 72, notes: 'F4 E4 F4 D4 E4 C4 D4 D4:2', fact: 'A medieval chant about Judgment Day, borrowed by countless horror films (it opens “The Shining”).', spooky: true },
  { name: 'In the Hall of the Mountain King', bpm: 140, notes: 'B3:0.5 C#4:0.5 D4:0.5 E4:0.5 F#4:0.5 D4:0.5 F#4:1 F4:0.5 C#4:0.5 F4:1 E4:0.5 C4:0.5 E4:1', fact: 'Grieg wrote it in 1875 for Peer Gynt, as trolls close in around the hero. Grieg himself said he could not bear to hear it.', spooky: true },
  { name: 'Brahms’ Lullaby', bpm: 100, notes: 'E4:0.5 E4:0.5 G4:2 E4:0.5 E4:0.5 G4:2 E4:0.5 G4:0.5 C5 B4:1.5 A4:0.5 A4 G4:2', fact: 'Brahms wrote it in 1868 for a friend’s newborn son. It is often called “Lullaby and Good Night”.' },
  { name: 'London Bridge Is Falling Down', bpm: 130, notes: 'G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2 D4 E4 F4:2 E4 F4 G4:2', fact: 'The rhyme is centuries old. The 1831 London Bridge was later sold and rebuilt in Arizona.' },
  { name: 'Old MacDonald Had a Farm', bpm: 140, notes: 'G4 G4 G4 D4 E4 E4 D4:2 B4 B4 A4 A4 G4:2', fact: 'E-I-E-I-O. The song exists in many languages, each with its own animal noises.' },
  { name: 'Row, Row, Row Your Boat', bpm: 110, notes: 'C4:1.5 C4:1.5 C4 D4:0.5 E4:1.5 E4 D4:0.5 E4 F4:0.5 G4:3', fact: 'A round: each singer starts a line later, so it can go on forever.' },
  { name: 'Yankee Doodle', bpm: 150, notes: 'C4 C4 D4 E4 C4 E4 D4 G3 C4 C4 D4 E4 C4:2 B3:2', fact: 'British soldiers sang it to mock the colonists, who then made it their own proud anthem.' },
  { name: 'Eine kleine Nachtmusik', bpm: 130, notes: 'G4 R:0.5 D4:0.5 G4 R:0.5 D4:0.5 G4:0.5 D4:0.5 G4:0.5 B4:0.5 D5:2 C5 R:0.5 A4:0.5 C5 R:0.5 A4:0.5 C5:0.5 A4:0.5 F#4:0.5 A4:0.5 D4:2', fact: 'Mozart wrote it in 1787, but it was not published until 1827, decades after his death.' },
  { name: 'Canon in D', bpm: 72, notes: 'F#5 E5 D5 C#5 B4 A4 B4 C#5', fact: 'Pachelbel’s Canon was all but forgotten for over two centuries, then became the world’s favourite wedding tune.' },
  { name: 'Auld Lang Syne', bpm: 96, notes: 'C4 F4:1.5 F4:0.5 F4 A4 G4:1.5 F4:0.5 G4 A4 F4:1.5 F4:0.5 A4 C5 D5:3', fact: 'Robert Burns wrote it down in 1788. It is sung at New Year all over the world.' },
  { name: 'When the Saints Go Marching In', bpm: 150, notes: 'C4 E4 F4 G4:4 C4 E4 F4 G4:4 C4 E4 F4 G4:2 E4:2 C4:2 E4:2 D4:4', fact: 'An American spiritual that became a New Orleans jazz anthem, famously recorded by Louis Armstrong in 1938.' },
  { name: 'Greensleeves', bpm: 150, notes: 'A4 C5:2 D5 E5:1.5 F5:0.5 E5 D5:2 B4 G4:1.5 A4:0.5 B4 C5:2 A4 A4:1.5 G#4:0.5 A4 B4:2 G#4 E4:2', fact: 'An English folk song from the 1500s. The legend that Henry VIII wrote it is almost certainly untrue.' },
];
