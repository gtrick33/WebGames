import type { Typed } from '../typed';

/**
 * «Scrivilo» in italiano: niente scelte, la risposta si scrive. [domanda, risposte accettate, fatto]. Le
 * risposte sono separate da «|» e si mostra la prima; il confronto ignora maiuscole, accenti,
 * punteggiatura e piccoli errori di battitura. Aggiungi solo in fondo: l’id di una domanda è la sua
 * posizione.
 */
export const TYPED: Typed[] = [
  ['Qual è l’osso più lungo del corpo umano?', 'Femore|Il femore', 'Va dall’anca al ginocchio ed è circa un quarto della tua altezza.'],
  ['Quale pianeta ha il giorno più corto, con un giro su se stesso in meno di 10 ore?', 'Giove', 'Il pianeta più grande è anche quello che gira più in fretta: lì un giorno dura circa 9 ore e 56 minuti.'],
  ['In quale paese si trova la maggior parte della foresta amazzonica?', 'Brasile|Il Brasile', 'Circa il 60% è in Brasile. Il resto è sparso tra altri otto paesi e territori.'],
  ['Quale gas costituisce la maggior parte dell’aria che respiriamo?', 'Azoto|L’azoto', 'Circa il 78% dell’aria è azoto. L’ossigeno è solo il 21% circa.'],
  ['Qual è la capitale del Canada?', 'Ottawa', 'La scelse la regina Vittoria nel 1857, anche perché stava tra il Canada anglofono e quello francofono.'],
  ['Qual è il simbolo chimico dell’oro?', 'Au', 'Dal latino aurum. Anche il simbolo dell’argento, Ag, viene dal latino: argentum.'],
  ['Come si chiama la galassia in cui viviamo?', 'Via Lattea|La Via Lattea', 'Per i greci era il latte schizzato dal seno della dea Era. Anche «galassia» viene da gala, latte.'],
  ['Come si chiama una parola che si legge uguale anche al contrario, come «anilina»?', 'Palindromo|Un palindromo|Palindroma', 'Funziona anche con frasi intere: «I topi non avevano nipoti».'],
  ['In quale paese si trova l’antica città di Petra?', 'Giordania|La Giordania', 'I suoi edifici furono scolpiti direttamente nelle pareti di arenaria rosa più di 2.000 anni fa.'],
  ['Qual è l’animale più alto del mondo?', 'Giraffa|La giraffa|Giraffe', 'I maschi arrivano a circa 5,5 m, e la lingua è lunga circa mezzo metro.'],
  ['Quale paese ha inventato la carta?', 'Cina|La Cina', 'A Cai Lun si attribuisce il perfezionamento della carta in Cina, intorno all’anno 105.'],
  ['Che cosa è diventato Plutone nel 2006?', 'Pianeta nano|Un pianeta nano|Nano|Plutoide', 'Gli astronomi lo hanno declassato a pianeta nano perché non ha ripulito la sua orbita da altri oggetti.'],
  ['Qual è l’organo più grande del corpo umano?', 'Pelle|La pelle|Cute|La cute', 'Stesa, la pelle di un adulto coprirebbe circa 2 metri quadrati.'],
  ['Qual è la stella più vicina alla Terra?', 'Sole|Il Sole', 'Sì, il Sole. La successiva, Proxima Centauri, è a più di quattro anni luce.'],
  ['Quale pezzo degli scacchi si muove sempre e solo in diagonale?', 'Alfiere|L’alfiere|Alfieri', 'L’alfiere. Per questo ogni alfiere passa tutta la partita sulle caselle di un solo colore.'],
  ['Qual è il metallo che conduce meglio l’elettricità?', 'Argento|L’argento', 'Per i cavi si usa il rame perché l’argento costa molto di più.'],
  ['Quale vulcano seppellì Pompei ed Ercolano nel 79 d.C.?', 'Vesuvio|Il Vesuvio', 'Plinio il Giovane descrisse l’eruzione in cui morì suo zio, Plinio il Vecchio. Ancora oggi le eruzioni di quel tipo si chiamano «pliniane».'],
  ['Qual è il lago più grande d’Italia?', 'Garda|Lago di Garda|Il lago di Garda|Benaco', 'Il Garda, circa 370 km². Il più profondo però è il lago di Como, oltre 400 m: il suo fondo sta sotto il livello del mare.'],
  ['Quale Stato indipendente è completamente circondato dalla città di Roma?', 'Vaticano|Città del Vaticano|Il Vaticano|Santa Sede', 'Il Vaticano, lo Stato più piccolo del mondo: meno di mezzo chilometro quadrato.'],
  ['Da quale città italiana prendono il nome i jeans?', 'Genova', 'Da «Gênes», il nome francese di Genova, dove si tesseva la tela blu dei marinai. E il «denim» viene da Nîmes: «de Nîmes».'],
  ['Quale pittore firmò un solo quadro in tutta la vita, scrivendo il nome nel sangue di san Giovanni Battista?', 'Caravaggio|Michelangelo Merisi|Merisi', 'Caravaggio, nella Decollazione del Battista a Malta: la firma spunta dal sangue che sgorga dal collo del santo.'],
  ['«Ciao» viene dal veneziano «s-ciào vostro». Che cosa voleva dire «s-ciào»?', 'Schiavo|Servo|Sono vostro schiavo|Vostro schiavo', '«Schiavo vostro», cioè «al vostro servizio». Lo stesso giro di cortesia ha dato all’Austria e alla Baviera il saluto «Servus».'],
  ['Quale strumento inventò a Firenze, intorno al 1700, il padovano Bartolomeo Cristofori?', 'Pianoforte|Il pianoforte|Piano|Fortepiano', 'Lo chiamava «gravicembalo col piano e forte», perché suonava piano o forte a seconda di come si premevano i tasti.'],
  ['Quale colore prende il nome da una battaglia combattuta nel 1859 vicino a Milano?', 'Magenta|Il magenta', 'Il colorante, appena inventato, fu ribattezzato così per celebrare la vittoria franco-piemontese di Magenta.'],
  ['Qual è il fiume più lungo d’Italia?', 'Po|Il Po', 'Il Po, 652 km. Il secondo però non è il Tevere, ma l’Adige.'],
  ['Qual è il vulcano attivo più alto d’Europa?', 'Etna|L’Etna|Mongibello', 'L’Etna, intorno ai 3.300 m, e la sua altezza cambia a ogni eruzione. I catanesi lo chiamano «a Muntagna».'],
  ['Prima delle zucche, quale ortaggio si intagliava in Irlanda per Halloween?', 'Rapa|Le rape|La rapa|Rape|Navone', 'Le rape. Gli emigrati irlandesi in America passarono alle zucche, più grandi e più facili da intagliare.'],
  ['Quale tragedia di Shakespeare comincia con il fantasma di un re assassinato?', 'Amleto|Hamlet', 'Amleto. Lo spettro del padre gli chiede vendetta già nel primo atto.'],
  ['Di che colore è la «scatola nera» degli aerei?', 'Arancione|Arancio|Arancione acceso', 'Arancione acceso, così si trova più facilmente tra i rottami.'],
  ['Qual è l’oceano più grande?', 'Pacifico|Oceano Pacifico|Il Pacifico', 'Il Pacifico copre circa un terzo del pianeta: più di tutte le terre emerse messe insieme.'],
];
