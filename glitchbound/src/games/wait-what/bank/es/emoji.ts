import type { EmojiQ } from '../emoji';

/**
 * Acertijos de emojis en español: [emojis, respuestas, dato]; la buena va primero (se barajan al
 * mostrarse). Los títulos son los que se usan igual en España y en América Latina. Añade solo al
 * final: el identificador de cada acertijo es su posición.
 */

/** Películas y libros. */
export const EMOJI_TITLES: EmojiQ[] = [
  ['🦁👑', 'El rey león|Madagascar|El libro de la selva|Tarzán', '«El rey león» se estrenó en 1994 y sigue siendo una de las películas más vendidas de la historia en formato doméstico.'],
  ['🧊🚢💔', 'Titanic|Frozen|Moby Dick|La vida de Pi', '«Titanic» (1997) ganó 11 Óscar e igualó el récord.'],
  ['👽📞🏠', 'E.T., el extraterrestre|Alien|Hombres de negro|Lilo y Stitch', 'La película es de 1982, y lo único que quería E.T. era llamar a casa.'],
  ['🦖🏝️🧬', 'Parque Jurásico|King Kong|Godzilla|Jumanji', '«Parque Jurásico» (1993). La mayoría de sus dinosaurios «jurásicos» vivieron en realidad en el Cretácico.'],
  ['🐠🔍', 'Buscando a Nemo|La sirenita|Aquaman|Buscando a Dory', '«Buscando a Nemo» (2003). Los peces payaso nacen todos machos, y el más grande del grupo puede volverse hembra.'],
  ['🧙‍♂️💍🌋', 'El señor de los anillos|Harry Potter|Las crónicas de Narnia|Juego de tronos', 'El libro de Tolkien salió en 1954–55; las películas llegaron a partir de 2001.'],
  ['❄️👸⛄', 'Frozen|Blancanieves|La Cenicienta|La bella durmiente', '«Frozen» (2013) se inspira libremente en «La reina de las nieves», de Hans Christian Andersen.'],
  ['🏠🎈👴', 'Up|Cars|Toy Story|Coco', '«Up» (2009). Harían falta millones de globos de fiesta para levantar una casa de verdad.'],
  ['🐀👨‍🍳', 'Ratatouille|Kung Fu Panda|Stuart Little|Madagascar', '«Ratatouille» (2007). El equipo de Pixar tomó clases de cocina para que la cocina saliera creíble.'],
  ['🦈🏖️😱', 'Tiburón|La sirenita|Buscando a Nemo|Aquaman', '«Tiburón» (1975). El tiburón mecánico se averiaba tanto que apenas sale en la primera mitad.'],
  ['🤖❤️🌱', 'WALL·E|Big Hero 6|El gigante de hierro|Yo, robot', '«WALL·E» (2008) casi no tiene diálogos en sus primeros 40 minutos.'],
  ['🍫🏭🎫', 'Charlie y la fábrica de chocolate|Matilda|Hansel y Gretel|Pinocho', 'El libro de Roald Dahl es de 1964. Willy Wonka solo escondió cinco tickets dorados.'],
  ['🧛🏰🦇', 'Drácula|Batman|Frankenstein|La familia Addams', 'El «Drácula» de Bram Stoker se publicó en 1897.'],
  ['👻🚫', 'Cazafantasmas|Casper|Beetlejuice|Scooby-Doo', '«Cazafantasmas» (1984). ¿A quién vas a llamar?'],
  ['🌪️👠🦁', 'El mago de Oz|Twister|La Cenicienta|El rey león', 'En el libro de L. Frank Baum, de 1900, los zapatos de Dorothy son plateados. La película los hizo de rubí.'],
  ['🕷️🧑', 'Spider-Man|Ant-Man|La telaraña de Charlotte|Aracnofobia', 'Spider-Man apareció por primera vez en un cómic en 1962.'],
  ['🐼🥋', 'Kung Fu Panda|Karate Kid|Shrek|Big Hero 6', '«Kung Fu Panda» (2008). Los pandas gigantes de verdad pasan hasta 14 horas al día comiendo.'],
  ['🍎👸☠️', 'Blancanieves|La bella durmiente|La Cenicienta|Rapunzel', '«Blancanieves y los siete enanitos» (1937) fue el primer largometraje de dibujos animados en celuloide. El primer largometraje animado de todos fue argentino: «El Apóstol», de 1917.'],
  ['🤠🧸🚀', 'Toy Story|Cars|Paddington|Coco', '«Toy Story» (1995) fue el primer largometraje animado íntegramente por ordenador.'],
  ['💀🎸🌼', 'Coco|Encanto|Soul|Red', '«Coco» (2017) transcurre en el Día de Muertos mexicano, cuando el cempasúchil guía a las almas de vuelta a casa.'],
  ['🛡️🐴🌬️', 'Don Quijote de la Mancha|El Lazarillo de Tormes|La Celestina|Bodas de sangre', 'Cervantes publicó la primera parte en 1605, y muchos la consideran la primera novela moderna.'],
  ['💯📅🧍', 'Cien años de soledad|Crónica de una muerte anunciada|El amor en los tiempos del cólera|Rayuela', 'Gabriel García Márquez la publicó en 1967 y se negó toda su vida a vender los derechos para el cine.'],
  ['🐴🌼📖', 'Platero y yo|Marianela|La Celestina|Rayuela', 'Juan Ramón Jiménez lo publicó en 1914. Platero, el burro, era «pequeño, peludo, suave».'],
  ['🤴🌹🪐', 'El principito|La bella y la bestia|Peter Pan|Alicia en el país de las maravillas', 'Antoine de Saint-Exupéry lo publicó en 1943, y hoy se lee en cientos de idiomas.'],
  ['🍫💧👩‍🍳', 'Como agua para chocolate|Chocolat|Charlie y la fábrica de chocolate|Ratatouille', 'La novela de Laura Esquivel es de 1989. El título viene de la cocina: el chocolate se hace con agua a punto de hervir, como quien está a punto de estallar.'],
  ['👦👨‍🦯🍇', 'El Lazarillo de Tormes|Oliver Twist|Pinocho|Don Quijote de la Mancha', 'Se publicó en 1554 sin nombre de autor, y quién lo escribió sigue siendo un misterio.'],
  ['🌀🐐👧', 'El laberinto del fauno|El orfanato|Alicia en el país de las maravillas|Coraline', 'Guillermo del Toro la estrenó en 2006 y ganó tres Óscar.'],
];

/** Refranes y expresiones. */
export const EMOJI_SAYINGS: EmojiQ[] = [
  ['🦐😴🌊', 'Camarón que se duerme se lo lleva la corriente|Al mal tiempo, buena cara|Quien mucho abarca, poco aprieta|En boca cerrada no entran moscas', 'Quien se despista pierde la oportunidad. En inglés, el pájaro madrugador se lleva el gusano.'],
  ['🤐🦟', 'En boca cerrada no entran moscas|Perro ladrador, poco mordedor|Ojos que no ven, corazón que no siente|Por la boca muere el pez', 'Mejor callar a tiempo que meter la pata.'],
  ['✋🐦💯🕊️', 'Más vale pájaro en mano que ciento volando|Matar dos pájaros de un tiro|Cría cuervos y te sacarán los ojos|Camarón que se duerme se lo lleva la corriente', 'Mejor algo seguro que mucho dudoso. En la versión inglesa, en el arbusto hay solo dos pájaros.'],
  ['🐕🔊🦷❌', 'Perro ladrador, poco mordedor|A caballo regalado no le mires el diente|Dar gato por liebre|Al mal tiempo, buena cara', 'Quien amenaza mucho rara vez llega a hacer nada.'],
  ['🎁🐴🦷', 'A caballo regalado no le mires el diente|Perro ladrador, poco mordedor|A quien madruga, Dios lo ayuda|Ser uña y carne', 'Lo regalado no se critica. Por los dientes se sabe la edad de un caballo.'],
  ['⏰🌅🙏', 'A quien madruga, Dios lo ayuda|Al mal tiempo, buena cara|Más vale pájaro en mano que ciento volando|Costar un ojo de la cara', 'Aunque otro refrán le lleva la contraria: «No por mucho madrugar amanece más temprano».'],
  ['🐒👗🐒', 'Aunque la mona se vista de seda, mona se queda|Dar gato por liebre|Ser uña y carne|Tirar la casa por la ventana', 'Cambiar el envoltorio no cambia lo que hay dentro.'],
  ['🌊🌀🎣', 'A río revuelto, ganancia de pescadores|Camarón que se duerme se lo lleva la corriente|Por la boca muere el pez|Al mal tiempo, buena cara', 'En el caos siempre hay quien sale ganando.'],
  ['🐱➡️🐇', 'Dar gato por liebre|Aquí hay gato encerrado|Como el perro y el gato|De noche, todos los gatos son pardos', 'Engañar dando algo peor de lo prometido. Se decía que en algunas ventas servían gato guisado haciéndolo pasar por liebre.'],
  ['💅🥩', 'Ser uña y carne|Costar un ojo de la cara|Tirar la casa por la ventana|Dar gato por liebre', 'Ser inseparables, tan unidos como la uña y la carne del dedo.'],
  ['👁️💰', 'Costar un ojo de la cara|Ojos que no ven, corazón que no siente|Ser uña y carne|Tirar la casa por la ventana', 'Ser carísimo. En inglés, lo caro cuesta «un brazo y una pierna».'],
  ['🏠🪟💸', 'Tirar la casa por la ventana|Costar un ojo de la cara|Dar gato por liebre|A río revuelto, ganancia de pescadores', 'Gastar a lo grande, sin mirar el dinero, normalmente para celebrar algo.'],
  ['🐟👄💀', 'Por la boca muere el pez|En boca cerrada no entran moscas|A río revuelto, ganancia de pescadores|Camarón que se duerme se lo lleva la corriente', 'Quien habla de más acaba metiéndose en líos, igual que el pez que muerde el anzuelo.'],
];
