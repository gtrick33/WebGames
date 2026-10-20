import type { Typed } from '../typed';

/**
 * “Escreve” em português: sem escolhas, escreves a resposta. [pergunta, respostas aceites, facto]. As
 * respostas vão separadas por “|” e a primeira é a que se mostra; a comparação ignora maiúsculas,
 * acentos, pontuação e pequenas gralhas. Acrescenta só no fim: o identificador é a posição.
 */
export const TYPED: Typed[] = [
  ['Qual é o osso mais comprido do corpo humano?', 'Fémur|O fémur|Osso da coxa', 'Vai da anca ao joelho e é cerca de um quarto da tua altura.'],
  ['Que planeta tem o dia mais curto, com uma volta em menos de 10 horas?', 'Júpiter|Jupiter', 'O maior planeta é o que roda mais depressa: um dia lá dura cerca de 9 horas e 56 minutos.'],
  ['Em que país fica a maior parte da floresta amazónica?', 'Brasil|O Brasil', 'Cerca de 60% fica no Brasil. O resto espalha-se por mais oito países e territórios.'],
  ['Que gás compõe a maior parte do ar que respiramos?', 'Azoto|O azoto|Nitrogénio|O nitrogénio', 'Cerca de 78% do ar é azoto. O oxigénio é só uns 21%.'],
  ['Como se chama um grupo de porcos?', 'Vara|Uma vara|A vara', 'Uma vara de porcos. E de burros é uma récua, e de cães uma matilha.'],
  ['Qual é a capital do Canadá?', 'Otava|Ottawa', 'A rainha Vitória escolheu-a em 1857, em parte por ficar entre o Canadá de língua inglesa e o de língua francesa.'],
  ['Qual é o símbolo químico do ouro?', 'Au', 'Do latim aurum. O da prata, Ag, vem de argentum.'],
  ['Como se chama a galáxia onde vivemos?', 'Via Láctea|A Via Láctea', 'Tem entre 100 e 400 mil milhões de estrelas, e o Sol é só uma delas. “Láctea” quer dizer “de leite”.'],
  ['Como se chama uma palavra que se lê igual de trás para a frente, como “radar”?', 'Palíndromo|Um palíndromo|Capicua|Uma capicua', 'Também há frases inteiras: “A sacada da casa.” Nos números, chamamos-lhe capicua.'],
  ['Em que país fica a antiga cidade de Petra?', 'Jordânia|A Jordânia', 'Os edifícios foram escavados diretamente em falésias de arenito cor-de-rosa há mais de 2000 anos.'],
  ['Qual é o animal mais alto do mundo?', 'Girafa|A girafa|Girafas', 'Os machos podem chegar a uns 5,5 m, e a língua tem cerca de meio metro.'],
  ['Que país inventou o papel?', 'China|A China', 'Atribui-se a Cai Lun o aperfeiçoamento do papel na China, por volta do ano 105.'],
  ['Que peça de xadrez só se pode mexer na diagonal?', 'Bispo|O bispo|Bispos', 'O bispo. Por isso, cada bispo passa o jogo inteiro em casas da mesma cor.'],
  ['Qual é o maior órgão do corpo humano?', 'Pele|A pele', 'Estendida, a pele de um adulto cobriria cerca de 2 metros quadrados.'],
  ['Qual é a estrela mais próxima da Terra?', 'Sol|O Sol', 'Sim, o Sol. A seguinte mais próxima, Próxima do Centauro, fica a mais de quatro anos-luz.'],
  ['Como se chama, em Portugal, o símbolo #?', 'Cardinal|O cardinal', 'Cardinal. Noutros sítios é hashtag, cerquilha ou, em inglês técnico, “octothorpe”.'],
  ['Que prato frito japonês terá vindo dos missionários portugueses?', 'Tempura|Tempurá', 'Tempura. O nome virá das “têmporas”, os dias de jejum em que os portugueses comiam peixe e legumes fritos em vez de carne.'],
  ['Qual é o ponto mais alto de Portugal?', 'Pico|O Pico|Montanha do Pico|Ilha do Pico', 'A montanha do Pico, nos Açores, com 2351 m. No continente ganha a Torre, na serra da Estrela, com 1993 m.'],
  ['Que doce de Lisboa se faz com uma receita secreta guardada desde 1837?', 'Pastel de Belém|Pastéis de Belém|Pastel de nata|Pastéis de nata', 'Os Pastéis de Belém. A receita veio dos frades do Mosteiro dos Jerónimos, e só um punhado de pessoas a conhece.'],
  ['Em que cidade portuguesa fica a Livraria Lello, uma das mais bonitas do mundo?', 'Porto|O Porto', 'No Porto. Diz-se que inspirou a biblioteca de Hogwarts, mas J. K. Rowling, que viveu no Porto, garante que nunca lá entrou.'],
  ['Que metal conduz melhor a eletricidade?', 'Prata|A prata', 'Para fios usa-se o cobre, porque a prata é muito mais cara.'],
  ['De que árvore vem a cortiça das rolhas?', 'Sobreiro|O sobreiro', 'Do sobreiro. Portugal produz cerca de metade da cortiça do mundo, e a casca é tirada de nove em nove anos, sem abater a árvore.'],
  ['Que navegador português chegou à Índia por mar, em 1498?', 'Vasco da Gama|Gama', 'Vasco da Gama, em Calecute. A viagem de ida e volta levou mais de dois anos, e menos de metade da tripulação regressou.'],
  ['Como se chama o pequeno instrumento madeirense de quatro cordas que deu origem ao ukulele?', 'Braguinha|Machete|Cavaquinho|Machete de braga', 'O braguinha, ou machete. Chegou ao Havai em 1879 com emigrantes da Madeira, e lá ganhou o nome de ukulele, “pulga saltitona”.'],
  ['Que legume escavavam os irlandeses no Halloween, antes da abóbora?', 'Nabo|Nabos|O nabo|Rutabaga', 'Nabos. Os emigrantes irlandeses na América passaram para as abóboras, maiores e mais fáceis de escavar.'],
  ['Que cidade italiana assenta em mais de 100 pequenas ilhas?', 'Veneza', 'Cerca de 118 ilhas, ligadas por mais de 400 pontes.'],
  ['Que país tem a forma de uma bota?', 'Itália|A Itália', 'A bota até parece estar a chutar uma bola: a ilha da Sicília.'],
  ['Qual é a única ave que consegue voar para trás?', 'Colibri|O colibri|Colibris|Beija-flor', 'O colibri bate as asas num movimento em oito, por isso consegue pairar e até andar para trás.'],
  ['Qual é o maior oceano do mundo?', 'Pacífico|O Pacífico|Oceano Pacífico', 'Cobre cerca de um terço do planeta, mais do que toda a terra junta. Foi Fernão de Magalhães quem lhe chamou Pacífico, por o achar calmo.'],
  ['De que cor é, na verdade, a “caixa negra” de um avião?', 'Laranja|Cor de laranja|Cor-de-laranja', 'Cor de laranja vivo, para se encontrar mais depressa no meio dos destroços.'],
];
