import type { Typed } from '../typed';

/**
 * „Tipp es ein“ auf Deutsch: keine Auswahl, man schreibt die Antwort. [Frage, erlaubte Antworten, Fakt].
 * Die Antworten sind mit „|“ getrennt, die erste wird angezeigt; Groß- und Kleinschreibung, Akzente,
 * Satzzeichen und kleine Tippfehler zählen nicht. Varianten mit ae/oe/ue und ss stehen mit drin.
 * Nur hinten anhängen: die Nummer einer Frage ist ihre Position.
 */
export const TYPED: Typed[] = [
  ['Wie heißt der längste Knochen des menschlichen Körpers?', 'Oberschenkelknochen|Der Oberschenkelknochen|Femur|Der Femur|Oberschenkel', 'Er reicht von der Hüfte bis zum Knie und macht etwa ein Viertel deiner Körpergröße aus.'],
  ['Welcher Planet hat den kürzesten Tag – er dreht sich in weniger als 10 Stunden einmal?', 'Jupiter|Der Jupiter', 'Der größte Planet dreht sich am schnellsten: Ein Tag dauert dort etwa 9 Stunden und 56 Minuten.'],
  ['Welches Gas macht den Großteil der Luft aus, die wir atmen?', 'Stickstoff|Der Stickstoff|N2', 'Rund 78 % der Luft sind Stickstoff. Sauerstoff macht nur etwa 21 % aus.'],
  ['Wie heißt die Hauptstadt von Kanada?', 'Ottawa', 'Königin Victoria wählte sie 1857, auch weil sie zwischen dem englisch- und dem französischsprachigen Kanada lag.'],
  ['Wie lautet das chemische Symbol für Gold?', 'Au', 'Vom lateinischen „aurum“. Das Symbol für Silber, Ag, kommt von „argentum“.'],
  ['Wie nennt man ein Wort, das rückwärts gelesen gleich bleibt, wie „Rentner“?', 'Palindrom|Ein Palindrom|Das Palindrom|Palindrome', 'Auch ganze Sätze gehen: „Erika feuert nur untreue Fakire.“'],
  ['In welchem Land liegt die antike Felsenstadt Petra?', 'Jordanien', 'Ihre Bauten wurden vor über 2.000 Jahren direkt in rosafarbene Sandsteinfelsen gehauen.'],
  ['Wie heißt das größte Organ des menschlichen Körpers?', 'Haut|Die Haut', 'Ausgebreitet würde die Haut eines Erwachsenen etwa 2 Quadratmeter bedecken.'],
  ['Welcher Stern ist der Erde am nächsten?', 'Sonne|Die Sonne', 'Ja, die Sonne. Der nächste danach, Proxima Centauri, ist über vier Lichtjahre entfernt.'],
  ['Welche Schachfigur zieht immer nur diagonal?', 'Läufer|Der Läufer|Laeufer|Laufer', 'Der Läufer. Darum verbringt jeder Läufer die ganze Partie auf Feldern einer einzigen Farbe.'],
  ['Welcher Vogel kann als einziger rückwärts fliegen?', 'Kolibri|Der Kolibri|Kolibris|Die Kolibris', 'Kolibris schlagen ihre Flügel in einer Acht, darum können sie in der Luft stehen und sogar rückwärts fliegen.'],
  ['Welches Metall leitet Strom am besten?', 'Silber|Das Silber', 'Für Kabel nimmt man trotzdem Kupfer, weil Silber viel teurer ist.'],
  ['Welches Gemüse höhlten die Iren an Halloween aus, bevor es Kürbisse gab?', 'Rübe|Rüben|Die Rübe|Steckrübe|Die Steckrübe|Steckrüben|Runkelrübe|Kohlrübe|Ruebe|Steckruebe', 'Rüben. Irische Auswanderer in Amerika stiegen auf Kürbisse um, die größer und leichter zu schnitzen waren. Auch bei uns schnitzte man früher Rübengeister.'],
  ['Welche italienische Stadt ist auf über 100 kleinen Inseln gebaut?', 'Venedig', 'Rund 118 Inseln, verbunden durch über 400 Brücken.'],
  ['Welche Farbe hat die „Blackbox“, der Flugschreiber eines Flugzeugs?', 'Orange|Leuchtorange|Knallorange', 'Knallorange, damit man sie in Trümmern findet. Schwarz ist an ihr gar nichts.'],
  ['Welche Stadt war von 1949 bis 1990 Regierungssitz der Bundesrepublik?', 'Bonn', 'Offiziell nur „vorläufige Bundeshauptstadt“: Bonn sollte bewusst provisorisch wirken, bis Berlin wieder Hauptstadt sein konnte. Spötter nannten es „Bundesdorf“.'],
  ['Welches Tier ziert das Wappen der Bundesrepublik?', 'Adler|Der Adler|Bundesadler|Der Bundesadler', 'Der Bundesadler. Seine rundliche Version im Plenarsaal des Bundestags heißt im Volksmund „fette Henne“.'],
  ['Wie heißt der Buchstabe ß?', 'Eszett|Das Eszett|Esszett|Scharfes S|Das scharfe S|Scharfes Es|Sz', 'Eszett oder scharfes S. Seit 2017 gibt es offiziell auch ein großes ẞ.'],
  ['Schiff + Fahrt: Wie schreibt man das zusammengesetzte Wort seit der Reform von 1996?', 'Schifffahrt|Die Schifffahrt|Schiffahrt', 'Mit drei f. Seitdem bleiben drei gleiche Buchstaben stehen, auch beim Balletttänzer und beim Teeei.'],
  ['Nach welchem deutschen Physiker heißen bei uns die X-Strahlen?', 'Röntgen|Wilhelm Conrad Röntgen|Wilhelm Röntgen|Roentgen', 'Wilhelm Conrad Röntgen entdeckte sie 1895 und verzichtete bewusst auf ein Patent. Die meisten Sprachen sagen bis heute „X-Strahlen“.'],
  ['In welcher Stadt kam laut der bekanntesten Legende der Döner im Fladenbrot auf?', 'Berlin', 'Kadir Nurman soll ihn 1972 am Bahnhof Zoo als schnelles Essen für Berufstätige erfunden haben. Die Idee beanspruchen allerdings auch andere.'],
  ['Welches Tier ist das Wappentier Berlins?', 'Bär|Der Bär|Baer|Berliner Bär', 'Der Bär – wohl weil der Name danach klingt. Tatsächlich kommt „Berlin“ vermutlich vom slawischen „berl“, Sumpf.'],
  ['Wie heißt die Figur mit Hut auf den Fußgängerampeln im Osten Deutschlands?', 'Ampelmännchen|Das Ampelmännchen|Ampelmann|Der Ampelmann|Ampelmaennchen|Ost-Ampelmännchen', 'Karl Peglau entwarf es 1961 in der DDR. Nach der Wende sollte es verschwinden – Proteste retteten es.'],
  ['Wie nennt man das Zeichen @ bei uns umgangssprachlich?', 'Klammeraffe|Der Klammeraffe|Affenschwanz|Affenohr', 'Klammeraffe. In Tschechien heißt es Rollmops („zavináč“), in Italien Schnecke, in Dänemark Elefantenrüssel.'],
  ['Welches Insekt dürfte laut einem berühmten Mythos nach den Gesetzen der Physik gar nicht fliegen können?', 'Hummel|Die Hummel|Hummeln|Die Hummeln', 'Die Hummel. Der Mythos stammt aus einer Überschlagsrechnung der 1930er, die so tat, als hätte sie starre Flügel wie ein Flugzeug.'],
  ['Welches ist das höchste Tier der Welt?', 'Giraffe|Die Giraffe|Giraffen|Die Giraffen', 'Männchen werden rund 5,5 m hoch, und ihre Zunge ist etwa einen halben Meter lang.'],
  ['Was wurde Pluto im Jahr 2006?', 'Zwergplanet|Ein Zwergplanet|Plutoid', 'Astronomen stuften ihn zum Zwergplaneten herab, weil er seine Umlaufbahn nicht von anderen Körpern freigeräumt hat.'],
  ['Welcher Ozean ist der größte?', 'Pazifik|Der Pazifik|Pazifischer Ozean|Der Pazifische Ozean|Stiller Ozean|Der Stille Ozean', 'Er bedeckt rund ein Drittel der Erde – mehr als alles Land zusammen.'],
  ['Welcher Buchstabe ist im Deutschen der häufigste?', 'E', 'Das E, mit großem Abstand. Darum bringt es beim deutschen Scrabble nur einen Punkt.'],
  ['Welches Land schenkte den USA die Freiheitsstatue?', 'Frankreich', 'Frankreich, 1886. Sie wurde in 350 Teilen über den Atlantik verschifft.'],
  ['Wie hieß das keltische Fest, aus dem Halloween hervorging?', 'Samhain', 'Samhain, gesprochen etwa „Sau-in“, markierte das Ende der Ernte und den Beginn des Winters.'],
  ['Welches Stück von Shakespeare beginnt mit dem Geist eines ermordeten Königs?', 'Hamlet', 'Hamlet. Der Geist seines Vaters verlangt schon im ersten Akt Rache.'],
];
