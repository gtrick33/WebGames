import type { Typed } from '../typed';

/**
 * «Escríbelo» en español: sin opciones, se escribe la respuesta. [pregunta, respuestas aceptadas,
 * dato]. Las respuestas van separadas por «|» y se muestra la primera; la comparación no tiene en
 * cuenta mayúsculas, tildes, puntuación ni pequeñas erratas. Añade solo al final: el identificador
 * de cada pregunta es su posición.
 */
export const TYPED: Typed[] = [
  ['¿Cuál es el hueso más largo del cuerpo humano?', 'Fémur|El fémur', 'Va de la cadera a la rodilla y mide alrededor de una cuarta parte de tu estatura.'],
  ['¿Qué planeta tiene el día más corto: da una vuelta completa en menos de 10 horas?', 'Júpiter', 'El planeta más grande es el que gira más rápido: allí un día dura unas 9 horas y 56 minutos.'],
  ['¿En qué país está la mayor parte de la selva amazónica?', 'Brasil', 'Alrededor del 60 %. El resto se reparte entre otros ocho países y territorios.'],
  ['¿Qué letra tiene el alfabeto español que no tiene el inglés?', 'Ñ|Eñe|La ñ|La eñe', 'La ñ nació como una n con otra n pequeñita encima: un atajo de los copistas medievales para ahorrar pergamino.'],
  ['¿Qué gas forma la mayor parte del aire que respiramos?', 'Nitrógeno|El nitrógeno', 'Alrededor del 78 % del aire es nitrógeno. El oxígeno es solo un 21 %.'],
  ['¿Cuál es la capital de Canadá?', 'Ottawa|Otawa', 'La eligió la reina Victoria en 1857, en parte porque quedaba entre el Canadá anglófono y el francófono.'],
  ['¿Cómo se llamaba el caballo de don Quijote?', 'Rocinante', 'De «rocín», caballo de poca calidad, y «antes», porque antes lo había sido. Según Cervantes, el hidalgo tardó cuatro días en elegir el nombre.'],
  ['¿Cuál es el símbolo químico del oro?', 'Au', 'Del latín aurum. El de la plata, Ag, viene de argentum.'],
  ['¿Cómo se llama la galaxia en la que vivimos?', 'Vía Láctea|La Vía Láctea', 'Tiene entre 100 000 y 400 000 millones de estrellas, y el Sol es solo una de ellas.'],
  ['¿Cómo se llama una palabra que se lee igual al revés, como «reconocer»?', 'Palíndromo|Un palíndromo|Capicúa', 'Hay frases enteras que lo hacen: «Dábale arroz a la zorra el abad».'],
  ['¿En qué país está la antigua ciudad de Petra?', 'Jordania', 'Sus edificios se tallaron directamente en acantilados de arenisca rosa hace más de 2000 años.'],
  ['¿Qué pieza de ajedrez solo puede moverse en diagonal?', 'Alfil|El alfil|Alfiles|Los alfiles', 'El alfil, así que cada uno pasa la partida entera en casillas de un solo color. Su nombre viene del árabe al-fil, «el elefante».'],
  ['¿Qué país tiene dos capitales, La Paz y Sucre?', 'Bolivia', 'Sucre es la capital constitucional y La Paz, a unos 3600 m, es la sede de gobierno más alta del mundo.'],
  ['¿Cuál es el órgano más grande del cuerpo humano?', 'Piel|La piel', 'Extendida, la piel de un adulto cubriría unos 2 metros cuadrados.'],
  ['¿Cuál es la estrella más cercana a la Tierra?', 'Sol|El Sol', 'Sí, el Sol. La siguiente, Próxima Centauri, está a más de cuatro años luz.'],
  ['¿Qué metal conduce mejor la electricidad?', 'Plata|La plata', 'Los cables se hacen de cobre porque la plata es mucho más cara. Y Argentina se llama así por el latín argentum, «plata».'],
  ['¿Qué civilización construyó Machu Picchu?', 'Incas|Inca|Los incas|Imperio inca|El Imperio inca', 'Los incas, hacia 1450. Los conquistadores españoles nunca dieron con ella, y por eso se conservó tan bien.'],
  ['¿Cuál es el único pájaro capaz de volar hacia atrás?', 'Colibrí|El colibrí|Colibríes|Los colibríes|Picaflor|El picaflor|Chupaflor', 'El colibrí bate las alas dibujando un ocho, así que puede quedarse quieto en el aire e incluso ir marcha atrás.'],
  ['¿Qué hortaliza se tallaba en Irlanda por Halloween antes que la calabaza?', 'Nabo|Nabos|El nabo|Los nabos|Colinabo', 'El nabo. Los emigrantes irlandeses en América se pasaron a la calabaza, más grande y fácil de tallar.'],
  ['¿Qué animal aparece en la bandera de México devorando una serpiente?', 'Águila|El águila|Un águila', 'Un águila sobre un nopal: la señal que, según la leyenda, indicó a los mexicas dónde fundar Tenochtitlan.'],
  ['¿Qué ciudad italiana está construida sobre más de 100 islitas?', 'Venecia', 'Unas 118 islas, unidas por más de 400 puentes.'],
  ['¿Cuántas uvas se comen en Nochevieja en España y en buena parte de América Latina?', '12|Doce', 'Doce, una por cada campanada de medianoche. Y hay que acabarlas antes de que termine la última.'],
  ['¿Qué país tiene forma de bota?', 'Italia', 'Y la bota hasta parece estar dándole una patada a un balón: la isla de Sicilia.'],
  ['¿Qué obra de Shakespeare empieza con el fantasma de un rey asesinado?', 'Hamlet', 'Hamlet. El fantasma de su padre le pide venganza en el primer acto.'],
  ['¿Qué fruto llamaban los aztecas «ahuacatl»?', 'Aguacate|El aguacate|Palta|La palta', 'El aguacate, o palta en Sudamérica. En náhuatl, ahuacatl también significaba «testículo», quizá por su forma.'],
  ['¿De qué color es la «caja negra» de un avión?', 'Naranja|Anaranjado|Anaranjada|Color naranja', 'Naranja chillón, para que se vea bien entre los restos.'],
  ['¿Cuál es el desierto más seco del mundo, sin contar los polos?', 'Atacama|Desierto de Atacama|El Atacama|El desierto de Atacama', 'En algunos puntos de Atacama nunca se ha registrado lluvia. La NASA prueba allí sus vehículos para Marte.'],
  ['¿Cuál es la sustancia natural más dura de la Tierra?', 'Diamante|El diamante|Diamantes|Los diamantes', 'El diamante. Es solo carbono, el mismo elemento que el grafito de un lápiz.'],
  ['¿Qué país inventó el papel?', 'China', 'A Cai Lun se le atribuye haber perfeccionado la fabricación de papel en China hacia el año 105.'],
  ['¿Cuál es el océano más grande?', 'Pacífico|Océano Pacífico|El Pacífico|El océano Pacífico', 'Cubre casi un tercio del planeta, más que todas las tierras juntas. Magallanes lo llamó así en 1520 porque lo encontró en calma.'],
];
