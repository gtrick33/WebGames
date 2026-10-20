import type { Typed } from '../typed';

/**
 * « À toi d’écrire » en français : pas de choix, on tape la réponse. [question, réponses acceptées, fait].
 * Les réponses sont séparées par « | », la première est affichée ; la comparaison ignore les majuscules,
 * les accents, la ponctuation et les petites fautes de frappe. Ajouter seulement à la fin : l’identifiant
 * d’une question est sa position.
 */
export const TYPED: Typed[] = [
  ['Quel est l’os le plus long du corps humain ?', 'Fémur|Le fémur', 'Il va de la hanche au genou et représente environ un quart de ta taille.'],
  ['Quelle planète a la journée la plus courte, avec un tour sur elle-même en moins de 10 heures ?', 'Jupiter', 'La plus grosse planète est aussi la plus rapide : une journée y dure environ 9 heures et 56 minutes.'],
  ['Quel gaz compose la plus grande partie de l’air que nous respirons ?', 'Azote|L’azote|Diazote', 'Environ 78 % de l’air est de l’azote. L’oxygène ne fait qu’environ 21 %.'],
  ['Comment appelle-t-on le petit du cygne ?', 'Cygneau|Le cygneau|Cygneaux', 'Les cygneaux sont gris et duveteux. Le vilain petit canard d’Andersen en était un.'],
  ['Quelle est la capitale du Canada ?', 'Ottawa', 'Ni Toronto ni Montréal : la reine Victoria a choisi Ottawa en 1857, en partie parce qu’elle se trouvait entre le Canada anglophone et le Canada francophone.'],
  ['Quel est le symbole chimique de l’or ?', 'Au', 'Du latin aurum. Celui de l’argent, Ag, vient d’argentum.'],
  ['Comment appelle-t-on un mot qui se lit pareil dans les deux sens, comme « kayak » ?', 'Palindrome|Un palindrome', 'Des phrases entières y arrivent aussi : « Ésope reste ici et se repose ».'],
  ['Dans quel pays se trouve l’antique cité de Pétra ?', 'Jordanie|La Jordanie', 'Ses monuments ont été taillés directement dans des falaises de grès rose il y a plus de 2 000 ans.'],
  ['Quelle pièce du jeu d’échecs se déplace toujours en diagonale ?', 'Fou|Le fou|Les fous', 'Le fou. Chacun passe donc toute la partie sur des cases de la même couleur. En anglais, c’est un évêque, « bishop ».'],
  ['Quel est le plus grand organe du corps humain ?', 'Peau|La peau', 'Étalée, la peau d’un adulte couvrirait environ 2 mètres carrés.'],
  ['Quelle est l’étoile la plus proche de la Terre ?', 'Soleil|Le Soleil', 'Eh oui, le Soleil. La suivante, Proxima du Centaure, est à plus de quatre années-lumière.'],
  ['Quel est le seul oiseau capable de voler en marche arrière ?', 'Colibri|Le colibri|Colibris|Oiseau-mouche', 'Le colibri bat des ailes en dessinant un huit : il peut faire du surplace, et même reculer.'],
  ['Quel métal conduit le mieux l’électricité ?', 'Argent|L’argent', 'On fait pourtant les fils en cuivre, parce que l’argent coûte bien plus cher.'],
  ['Avant les citrouilles, quel légume les Irlandais creusaient-ils pour Halloween ?', 'Navet|Le navet|Navets|Rutabaga|Betterave', 'Des navets et des betteraves. Les émigrés irlandais sont passés à la citrouille en Amérique : plus grosse, plus facile à creuser.'],
  ['Quelle est la lettre la plus fréquente en français ?', 'E|Le E', 'Le E, de loin. Georges Perec a pourtant écrit tout un roman sans un seul E : La Disparition (1969).'],
  ['De quelle couleur est la « boîte noire » d’un avion ?', 'Orange', 'Orange vif, pour qu’on la retrouve facilement dans les débris.'],
  ['Quel pays a la forme d’une botte ?', 'Italie|L’Italie', 'La botte semble même taper dans un ballon : la Sicile.'],
  ['Quel est le plus grand océan du monde ?', 'Pacifique|Le Pacifique|Océan Pacifique', 'Le Pacifique couvre environ un tiers de la planète, plus que toutes les terres réunies.'],
  ['Quel département français porte le numéro 2A ?', 'Corse-du-Sud|La Corse-du-Sud|Corse du Sud', 'En 1976, la Corse a été coupée en deux : la Corse-du-Sud (2A) et la Haute-Corse (2B) ont remplacé le 20.'],
  ['Quelle est la plus haute montagne de France ?', 'Mont Blanc|Le mont Blanc', 'Environ 4 805 m, et sa hauteur change d’une mesure à l’autre, selon l’épaisseur de neige et de glace au sommet.'],
  ['Comment appelle-t-on en français le symbole @ ?', 'Arobase|Arrobe|Arobas|Arrobase|A commercial', 'L’arobase. Les Italiens l’appellent « escargot », les Néerlandais « queue de singe ».'],
  ['Quel animal symbolise la France sur le maillot des Bleus ?', 'Coq|Le coq|Coq gaulois', 'Le coq, grâce à un jeu de mots latin : « gallus » veut dire à la fois « coq » et « Gaulois ».'],
  ['Dans quelle ville se trouve la statue du Manneken-Pis ?', 'Bruxelles', 'Il ne mesure qu’environ 55 cm, et possède une garde-robe de plus de 1 000 costumes.'],
  ['Quel est le plus long fleuve de France ?', 'Loire|La Loire', 'La Loire, environ 1 000 km, entièrement en France. Le Rhin et le Rhône, eux, prennent leur source en Suisse.'],
  ['Quel peintre s’est coupé une partie de l’oreille à Arles, en 1888 ?', 'Van Gogh|Vincent van Gogh', 'Vincent van Gogh. Il l’aurait ensuite remise, emballée dans du papier, à une jeune femme.'],
  ['Comment appelle-t-on la peur des araignées ?', 'Arachnophobie|L’arachnophobie', 'C’est l’une des phobies les plus répandues, alors que seule une poignée d’espèces sont dangereuses pour l’homme.'],
  ['Quelle est la langue officielle du Brésil ?', 'Portugais|Le portugais', 'Le Brésil compte bien plus de lusophones que le Portugal : plus de 200 millions, contre environ 10.'],
  ['Quel est le plus petit pays du monde ?', 'Vatican|Le Vatican|Cité du Vatican|La Cité du Vatican', 'Environ 0,44 km², moins que bien des parcs. Il a pourtant un distributeur de billets en latin.'],
  ['Quel est le seul mammifère capable de vraiment voler ?', 'Chauve-souris|La chauve-souris|Chauves-souris|Les chauves-souris', 'Les écureuils volants ne font que planer. Et environ une espèce de mammifère sur cinq est une chauve-souris.'],
  ['Quel pays a offert la statue de la Liberté aux États-Unis ?', 'France|La France', 'La France, en 1886. Elle a traversé l’Atlantique en 350 morceaux, rangés dans 214 caisses.'],
];
