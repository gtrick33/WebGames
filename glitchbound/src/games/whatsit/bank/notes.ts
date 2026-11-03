/**
 * One-line reasons for the answers players most often dispute, shown on the result next to the question.
 * Keyed "<theme>:<thing>:<question>"; [English, Bulgarian].
 */
import type { BasicLang } from '../../../platform/contentLang';

const NOTES: Record<string, [en: string, bg: string]> = {
  'sports:puck:net': ['Hockey goals have nets, but the puck is shot into one, not hit over it.', 'Хокейните врати имат мрежа, но шайбата се вкарва в нея, не се удря над нея.'],
  'vehicles:hovercraft:crowd': ['Big passenger hovercraft exist, but this one is a small craft.', 'Има и големи пътнически ховъркрафти, но този е малък.'],
  'vehicles:pedalo:wheels': ['Some pedal boats have a paddle wheel, but they float rather than roll on wheels.', 'Някои водни колела имат гребно колело, но те плават, а не се търкалят на колела.'],
  'kitchen:woodenspoon:drink': ['It stirs soup too, but it is made for any food, not just drinks or soup.', 'Бърка и супа, но е за всякаква храна, не само за напитки или супа.'],
  'food:ramen:dough': ['Its noodles start as dough, but they are boiled, not baked or fried.', 'Юфката му започва като тесто, но се вари, а не се пече или пържи.'],
  'food:padthai:dough': ['Rice noodles are boiled, not baked or fried dough.', 'Оризовите нудли се варят, а не са печено или пържено тесто.'],
  'clothes:necklace:bg': ['Coin and bead necklaces (gerdan) are part of the women’s folk costume.', 'Герданите от монети и мъниста са част от женската носия.'],
  'instruments:xylophone:keys': ['Its bars are laid out like a keyboard, but you hit them; there are no keys to press.', 'Пластините му са подредени като клавиатура, но по тях се удря, няма клавиши.'],
  'toys:top:string': ['Some tops are launched with a string, but this one is spun with the fingers.', 'Някои пумпали се завъртат с връв, но този се върти с пръсти.'],
  'weather:fog:sea': ['Sea fog exists, but this fog forms over land.', 'Има и морска мъгла, но тази се образува над сушата.'],
  'weather:iceberg:sea': ['It floats at sea, but it starts out as part of a glacier on land.', 'Плава в морето, но започва като част от ледник на сушата.'],
  'bugs:scorpion:glow': ['Scorpions glow under UV light, but they don’t make their own light.', 'Скорпионите светят под ултравиолетова светлина, но не излъчват собствена светлина.'],
  'bugs:ant:fly': ['Queens and males have wings for a short time, but the workers you see can’t fly.', 'Царици и мъжки имат крила за кратко, но работничките, които виждаш, не летят.'],
  'space:saturn:hot': ['Deep inside it is hot, but its cloud tops are far below freezing.', 'Дълбоко в него е горещо, но горните му облаци са много под нулата.'],
  'space:neptune:hot': ['Deep inside it is hot, but its cloud tops are far below freezing.', 'Дълбоко в него е горещо, но горните му облаци са много под нулата.'],
  'space:parker:hot': ['Its heat shield’s surface tops 1,000 °C; the instruments behind it stay cool.', 'Повърхността на топлинния му щит надхвърля 1000 °C, а уредите зад него остават хладни.'],
};

/** The reason for a thing's answer to a question, if it is one players dispute. `thing` is "<theme>:<thing>". */
export const noteFor = (thing: string, question: string, lang: BasicLang): string | undefined => NOTES[`${thing}:${question}`]?.[lang === 'bg' ? 1 : 0];

export const NOTE_KEYS = Object.keys(NOTES);
