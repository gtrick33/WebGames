import type { EmojiQ } from '../emoji';

/**
 * Énigmes emoji en français : [emoji, réponses, fait] ; la bonne réponse en premier (elles sont mélangées
 * à l’affichage). Les leurres ne doivent pas coller aux emoji aussi bien que la réponse. Ajouter seulement
 * à la fin : l’identifiant d’une énigme est sa position.
 */

/** Films et livres, sous leur titre français. */
export const EMOJI_TITLES: EmojiQ[] = [
  ['🦁👑', 'Le Roi lion|Madagascar|Le Livre de la jungle|Zootopie', 'Le Roi lion est sorti en 1994, et reste l’une des cassettes vidéo les plus vendues de l’histoire.'],
  ['🧊🚢💔', 'Titanic|La Reine des neiges|Moby Dick|L’Odyssée de Pi', 'Titanic (1997) a remporté 11 Oscars, à égalité avec le record de Ben-Hur.'],
  ['👽📞🏠', 'E.T. l’extra-terrestre|Alien|Rencontres du troisième type|Lilo et Stitch', '« E.T. téléphone maison. » Le film date de 1982.'],
  ['🦖🏝️🧬', 'Jurassic Park|King Kong|Godzilla|Le Petit Dinosaure', 'Jurassic Park (1993). La plupart de ses dinosaures « jurassiques » vivaient en fait au Crétacé.'],
  ['🐠🔍', 'Le Monde de Nemo|La Petite Sirène|Gang de requins|Aquaman', 'Le Monde de Nemo (2003). Les poissons-clowns naissent tous mâles ; le plus gros peut devenir femelle.'],
  ['🕰️🔙🚗', 'Retour vers le futur|Un jour sans fin|Cars|Interstellar', 'Retour vers le futur (1985) : 88 miles à l’heure et 1,21 gigawatt.'],
  ['🧙‍♂️💍🌋', 'Le Seigneur des anneaux|Harry Potter|Le Monde de Narnia|Game of Thrones', 'Le livre de Tolkien est paru en 1954-1955 ; les films ont suivi à partir de 2001.'],
  ['❄️👸⛄', 'La Reine des neiges|Blanche-Neige|Cendrillon|Rebelle', 'La Reine des neiges (2013) s’inspire librement du conte d’Andersen du même nom.'],
  ['🐀👨‍🍳', 'Ratatouille|Kung Fu Panda|Stuart Little|Chicken Run', 'Ratatouille (2007) se passe à Paris. L’équipe de Pixar a pris des cours de cuisine pour que la cuisine soit crédible.'],
  ['🦈🏖️😱', 'Les Dents de la mer|Alerte à Malibu|Vaiana|Sauvez Willy', 'Les Dents de la mer (1975). Le requin mécanique tombait si souvent en panne qu’on le voit à peine pendant la première heure.'],
  ['🍫🏭🎫', 'Charlie et la Chocolaterie|Matilda|Le Bon Gros Géant|James et la Grosse Pêche', 'Le livre de Roald Dahl est paru en 1964. Seuls cinq tickets d’or y sont cachés.'],
  ['🌹🏰👹', 'La Belle et la Bête|Shrek|Raiponce|Le Roi lion', 'Le conte est français : Madame de Villeneuve l’a écrit en 1740, et Jean Cocteau l’a porté à l’écran en 1946.'],
  ['🪖🪽🍲💪', 'Astérix le Gaulois|Kaamelott|Les Visiteurs|Robin des Bois', 'Astérix est né en 1959 dans le journal Pilote. Obélix, lui, n’a pas droit à la potion : il est tombé dedans quand il était petit.'],
  ['🐶🚀🌕', 'On a marché sur la Lune|Le Petit Prince|Voyage au centre de la Terre|Vingt Mille Lieues sous les mers', 'Hergé a fait marcher Tintin et Milou sur la Lune en 1954, quinze ans avant Neil Armstrong.'],
  ['👑👦🌹🦊', 'Le Petit Prince|Le Roi lion|Peter Pan|Pinocchio', 'Antoine de Saint-Exupéry l’a publié en 1943, à New York. C’est le livre le plus traduit au monde après la Bible.'],
  ['🍞⛓️🇫🇷', 'Les Misérables|Le Petit Nicolas|Les Trois Mousquetaires|Germinal', 'Jean Valjean passe 19 ans au bagne pour avoir volé un pain… et tenté de s’évader. Victor Hugo a publié le roman en 1862.'],
  ['3️⃣🤺', 'Les Trois Mousquetaires|Les Trois Frères|Trois hommes et un couffin|Les Visiteurs', 'Le roman d’Alexandre Dumas (1844) a en fait quatre héros : d’Artagnan ne fait pas partie des trois.'],
  ['🐙⚓🌊', 'Vingt Mille Lieues sous les mers|Le Monde de Nemo|Titanic|Moby Dick', 'Jules Verne a imaginé le Nautilus en 1870. Les vingt mille lieues sont la distance parcourue sous la mer, pas la profondeur.'],
  ['🌍8️⃣0️⃣📅', 'Le Tour du monde en quatre-vingts jours|Vingt Mille Lieues sous les mers|Cinq Semaines en ballon|Le Voyage dans la Lune', 'Phileas Fogg croit avoir perdu son pari… mais en voyageant vers l’est, il a gagné un jour sans le savoir.'],
  ['♿🤝😂', 'Intouchables|Le Dîner de cons|Les Visiteurs|Bienvenue chez les Ch’tis', 'Sorti en 2011, il a attiré plus de 19 millions de spectateurs en France.'],
  ['📮🌧️⬆️', 'Bienvenue chez les Ch’tis|Le Père Noël est une ordure|Les Bronzés|La Grande Vadrouille', 'Kad Merad y joue un directeur de poste muté dans le Nord. Le film (2008) a dépassé les 20 millions d’entrées en France.'],
  ['🍮🥄👧', 'Le Fabuleux Destin d’Amélie Poulain|Ratatouille|Chocolat|Charlie et la Chocolaterie', 'Amélie adore briser la croûte des crèmes brûlées avec sa petite cuillère. Et le nain de jardin qui envoie des photos de voyage était une vraie farce bien avant le film.'],
  ['🛡️⏳🚗', 'Les Visiteurs|Kaamelott|Ratatouille|Le Seigneur des anneaux', 'Jean Reno et Christian Clavier, chevaliers du XIIe siècle, débarquent en pleine fin du XXe siècle (1993). « Okayyy ! »'],
  ['🍽️🤡', 'Le Dîner de cons|Intouchables|La Cité de la peur|Le Père Noël est une ordure', 'Jacques Villeret y joue François Pignon, passionné de maquettes en allumettes. La pièce (1993) est devenue un film en 1998.'],
  ['⚡👓🧙', 'Harry Potter|Le Seigneur des anneaux|Les Animaux fantastiques|Percy Jackson', 'Le premier tome sort en France en 1998, sous le titre Harry Potter à l’école des sorciers.'],
  ['⛓️🏝️💎🗡️', 'Le Comte de Monte-Cristo|Notre-Dame de Paris|Les Misérables|Robinson Crusoé', 'Edmond Dantès passe 14 ans au château d’If avant de s’évader, cousu dans le linceul d’un autre prisonnier.'],
  ['⛪🔔🏹', 'Notre-Dame de Paris|Le Comte de Monte-Cristo|Les Misérables|Germinal', 'Le roman de Victor Hugo (1831) a ravivé l’intérêt pour la cathédrale, alors en piteux état, et poussé à sa restauration.'],
  ['🐱🎩🎹', 'Les Aristochats|Les 101 Dalmatiens|Garfield|Ratatouille', 'Le film de Disney (1970) se passe à Paris, en 1910. « Tout le monde veut devenir un cat ! »'],
];

/** Expressions et proverbes. */
export const EMOJI_SAYINGS: EmojiQ[] = [
  ['🌧️🪢', 'Il pleut des cordes|Avoir la corde au cou|Tirer sur la corde|Être sur la corde raide', 'Il pleut à verse. Les Anglais, eux, disent qu’il pleut « des chats et des chiens ».'],
  ['🐰⏳😤', 'Poser un lapin|Courir deux lièvres à la fois|Sortir un lapin du chapeau|Se coucher avec les poules', 'Ne pas venir à un rendez-vous. Au XIXe siècle, « poser un lapin », c’était partir sans payer.'],
  ['🐔🦷', 'Quand les poules auront des dents|Se coucher avec les poules|Avoir la chair de poule|Être une poule mouillée', 'Autrement dit : jamais. Les Anglais disent « quand les cochons voleront ».'],
  ['🐻💰🚫', 'Vendre la peau de l’ours avant de l’avoir tué|L’argent n’a pas d’odeur|Un ours mal léché|Jeter l’argent par les fenêtres', 'Se réjouir trop tôt. La Fontaine en a tiré une fable, « L’Ours et les Deux Compagnons ».'],
  ['🧈➕💰', 'Vouloir le beurre et l’argent du beurre|Compter pour du beurre|Entrer comme dans du beurre|Avoir un œil au beurre noir', 'Vouloir tout, même ce qui ne va pas ensemble. Les Anglais veulent « avoir leur gâteau et le manger ».'],
  ['😵🍎🍎', 'Tomber dans les pommes|Haut comme trois pommes|La pomme de discorde|Être aux pommes', 'S’évanouir. Personne ne sait vraiment pourquoi des pommes : peut-être une déformation de « se pâmer ».'],
  ['🧂🗣️', 'Mettre son grain de sel|Mettre de l’eau dans son vin|Mettre la main à la pâte|Mettre les pieds dans le plat', 'Donner son avis alors que personne ne l’a demandé.'],
  ['👅➡️🐱', 'Donner sa langue au chat|Avoir un chat dans la gorge|Appeler un chat un chat|Il n’y a pas un chat', 'Renoncer à trouver la réponse. Au XVIIe siècle, Madame de Sévigné, elle, « jetait sa langue aux chiens ».'],
  ['🥕🔥', 'Les carottes sont cuites|Raconter des salades|Ramener sa fraise|Avoir la pêche', 'Tout est fichu. En anglais, c’est ton oie qui est cuite : « your goose is cooked ».'],
  ['💪💸', 'Coûter un bras|Avoir le bras long|Baisser les bras|Les bras m’en tombent', 'Coûter très cher. Les Anglais, plus gourmands, disent que ça coûte « un bras et une jambe ».'],
  ['🪳😞', 'Avoir le cafard|Avoir une araignée au plafond|Avoir la puce à l’oreille|Avoir des fourmis dans les jambes', 'Avoir le moral à zéro. Baudelaire a rendu l’expression célèbre dans Les Fleurs du mal.'],
  ['🕷️🧠', 'Avoir une araignée au plafond|Avoir le cafard|Avoir la puce à l’oreille|Avoir des fourmis dans les jambes', 'Être un peu dérangé. Le « plafond », c’est le crâne.'],
  ['🦶🍽️', 'Mettre les pieds dans le plat|Casser les pieds|Mettre la main à la pâte|Mettre son grain de sel', 'Aborder lourdement le sujet qui fâche. Les Anglais, eux, se mettent « le pied dans la bouche ».'],
];
