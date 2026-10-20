import type { EmojiQ } from '../emoji';

/**
 * Puzzles de emojis em português: [emojis, respostas, facto]; a resposta certa vem primeiro (são
 * baralhadas quando aparecem). Acrescenta só no fim: o identificador do puzzle é a posição.
 */

/** Filmes e livros (com os títulos que têm em Portugal). */
export const EMOJI_TITLES: EmojiQ[] = [
  ['🦁👑', 'O Rei Leão|Madagáscar|O Livro da Selva|Zootrópolis', 'O Rei Leão estreou em 1994 e continua a ser um dos vídeos mais vendidos de sempre.'],
  ['🧊🚢💔', 'Titanic|Frozen: O Reino do Gelo|Moby Dick|A Vida de Pi', 'Titanic (1997) ganhou 11 Óscares e igualou o recorde.'],
  ['👽📞🏠', 'E.T. – O Extraterrestre|Alien – O 8.º Passageiro|Encontros Imediatos do Terceiro Grau|Lilo & Stitch', '“E.T. phone home.” O filme é de 1982.'],
  ['🦖🏝️🧬', 'Parque Jurássico|King Kong|Godzilla|Em Busca do Vale Encantado', 'Parque Jurássico (1993). A maior parte dos seus dinossauros “jurássicos” viveu, na verdade, no Cretácico.'],
  ['🐠🔍', 'À Procura de Nemo|A Pequena Sereia|Aquaman|À Procura de Dory', 'À Procura de Nemo (2003). Os peixes-palhaço nascem todos machos, e o maior pode tornar-se fêmea.'],
  ['🕰️🔙🚗', 'Regresso ao Futuro|O Feitiço do Tempo|Carros|Interstellar', 'Regresso ao Futuro (1985): 88 milhas por hora e 1,21 gigawatts.'],
  ['🧙‍♂️💍🌋', 'O Senhor dos Anéis|Harry Potter|As Crónicas de Nárnia|A Guerra dos Tronos', 'O livro de Tolkien saiu em 1954–55; os filmes vieram a partir de 2001.'],
  ['❄️👸⛄', 'Frozen: O Reino do Gelo|Branca de Neve|Cinderela|A Bela Adormecida', 'Frozen (2013) inspira-se, à larga, em “A Rainha da Neve”, de Hans Christian Andersen.'],
  ['🐀👨‍🍳', 'Ratatui|O Panda do Kung Fu|Stuart Little|A Fuga das Galinhas', 'Ratatui (2007). A equipa da Pixar teve aulas de cozinha para acertar na cozinha do filme.'],
  ['🦈🏖️😱', 'Tubarão|Marés Vivas|Vaiana|A Pequena Sereia', 'Tubarão (1975). O tubarão mecânico avariava tanto que quase não aparece na primeira metade.'],
  ['🍫🏭🎫', 'Charlie e a Fábrica de Chocolate|Matilda|O Amigo Gigante|James e o Pêssego Gigante', 'O livro de Roald Dahl saiu em 1964. Só se esconderam cinco bilhetes dourados.'],
  ['🧛🏰🦇', 'Drácula|Batman|Frankenstein|A Família Addams', 'O Drácula de Bram Stoker foi publicado em 1897.'],
  ['🎃🎄💀', 'O Estranho Mundo de Jack|Coco|A Noiva Cadáver|Abracadabra', 'O Estranho Mundo de Jack (1993) levou três anos a filmar em stop-motion.'],
  ['👻🚫', 'Os Caça-Fantasmas|Casper|Os Fantasmas Divertem-se|Scooby-Doo', 'Os Caça-Fantasmas (1984). A quem vais ligar?'],
  ['🌪️👠🦁', 'O Feiticeiro de Oz|Twister|Cinderela|O Rei Leão', 'No livro de L. Frank Baum, de 1900, os sapatos da Dorothy são prateados. O filme fê-los vermelho-rubi.'],
  ['🕷️🧑', 'Homem-Aranha|Homem-Formiga|A Menina e o Porquinho|Aracnofobia', 'O Homem-Aranha apareceu pela primeira vez numa banda desenhada em 1962.'],
  ['👸🐸', 'A Princesa e o Sapo|Shrek|Entrelaçados|Uma História de Encantar', 'A Princesa e o Sapo (2009) apresentou a Tiana, a primeira princesa negra da Disney.'],
  ['🐼🥋', 'O Panda do Kung Fu|Karate Kid|Mulan|Shrek', 'O Panda do Kung Fu (2008). Os pandas-gigantes verdadeiros passam até 14 horas por dia a comer.'],
  ['🍎👸☠️', 'Branca de Neve|A Bela Adormecida|Cinderela|Rapunzel', 'Branca de Neve e os Sete Anões (1937) foi a primeira longa-metragem de animação em acetato.'],
  ['🤠🧸🚀', 'Toy Story|Carros|Paddington|Monstros e Companhia', 'Toy Story (1995) foi a primeira longa-metragem toda feita por computador.'],
  ['👹🚪😱', 'Monstros e Companhia|Shrek|Coco|Divertida-Mente', 'Monstros e Companhia (2001). O Sulley tem mais de dois milhões de pelos animados um a um.'],
  ['💀🎸🌼', 'Coco|Encanto|Soul|Monstros e Companhia', 'Coco (2017) passa-se no Dia dos Mortos mexicano, quando os cravos-de-defunto guiam os espíritos até casa.'],
  ['⛵🌊📜', 'Os Lusíadas|Mensagem|Memorial do Convento|A Jangada de Pedra', 'A epopeia de Camões (1572) canta a viagem de Vasco da Gama à Índia. Conta-se que Camões salvou o manuscrito a nado, num naufrágio.'],
  ['🙈🏙️🌫️', 'Ensaio sobre a Cegueira|O Ano da Morte de Ricardo Reis|Os Maias|Mensagem', 'O romance de José Saramago (1995) imagina uma epidemia de “cegueira branca”. Saramago ganhou o Nobel em 1998.'],
  ['🪨🛶🌊', 'A Jangada de Pedra|Os Lusíadas|Ensaio sobre a Cegueira|Os Maias', 'No romance de Saramago (1986), a Península Ibérica solta-se da Europa e vai à deriva pelo Atlântico.'],
  ['🦁⭐⚽', 'O Leão da Estrela|O Pátio das Cantigas|A Canção de Lisboa|O Costa do Castelo', 'A comédia de 1947, com António Silva, gira à volta de um adepto doente pelo Sporting. Teve um remake em 2015.'],
];

/** Provérbios e ditados. */
export const EMOJI_SAYINGS: EmojiQ[] = [
  ['🐦✋🐦🐦💨', 'Mais vale um pássaro na mão do que dois a voar|Uma andorinha não faz a primavera|Cada macaco no seu galho|A galinha da vizinha é sempre melhor do que a minha', 'Mais vale o pouco que se tem do que o muito que se pode perder. Os ingleses contam os pássaros no mato.'],
  ['🐦1️⃣🚫🌸', 'Uma andorinha não faz a primavera|Mais vale um pássaro na mão do que dois a voar|De grão em grão enche a galinha o papo|Quem não tem cão caça com gato', 'Um só sinal bom não chega para tirar conclusões. Já Aristóteles o dizia.'],
  ['🌾🌾🌾🐔', 'De grão em grão enche a galinha o papo|Uma andorinha não faz a primavera|Cão que ladra não morde|Galinha velha faz bom caldo', 'Aos poucos, chega-se lá: vale para as poupanças, para o trabalho e para a paciência.'],
  ['🚫🐕➡️🐈', 'Quem não tem cão caça com gato|Cão que ladra não morde|Gato escaldado de água fria tem medo|De noite, todos os gatos são pardos', 'Quando falta o ideal, desenrasca-se com o que há. Bem à portuguesa.'],
  ['🐕🗣️🚫🦷', 'Cão que ladra não morde|Quem não tem cão caça com gato|Gato escaldado de água fria tem medo|Pela boca morre o peixe', 'Quem faz muito barulho raramente passa à ação.'],
  ['🐈🔥💧😨', 'Gato escaldado de água fria tem medo|Cão que ladra não morde|Quem não tem cão caça com gato|Água mole em pedra dura tanto bate até que fura', 'Quem já se queimou uma vez desconfia de tudo o que se pareça.'],
  ['💧🪨🕳️', 'Água mole em pedra dura tanto bate até que fura|De grão em grão enche a galinha o papo|Águas passadas não movem moinhos|Gato escaldado de água fria tem medo', 'Com persistência, até o impossível acaba por ceder.'],
  ['🌊⏮️🚫⚙️', 'Águas passadas não movem moinhos|Água mole em pedra dura tanto bate até que fura|Nem tanto ao mar nem tanto à terra|Deitar água na fervura', 'O que já passou não muda nada: não vale a pena remoer.'],
  ['🧱👂', 'As paredes têm ouvidos|Em boca fechada não entra mosca|Quem conta um conto acrescenta um ponto|Olhos que não veem, coração que não sente', 'Cuidado com o que dizes: pode haver alguém a ouvir.'],
  ['👄🔒🪰', 'Em boca fechada não entra mosca|As paredes têm ouvidos|Quem conta um conto acrescenta um ponto|Pela boca morre o peixe', 'Às vezes, o melhor é ficar calado.'],
  ['🐟👄🪝', 'Pela boca morre o peixe|Em boca fechada não entra mosca|Peixe não puxa carroça|Filho de peixe sabe nadar', 'Quem fala demais acaba por se tramar, como o peixe que morde o anzol.'],
  ['🐟👶🏊', 'Filho de peixe sabe nadar|Pela boca morre o peixe|Peixe não puxa carroça|Quem não tem cão caça com gato', 'Os filhos herdam o jeito dos pais. Os ingleses dizem que a maçã não cai longe da árvore.'],
];
