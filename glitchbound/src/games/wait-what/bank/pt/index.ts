import { EN, type Pack } from '../../pack';
import { ANIMALS } from './animals';
import { FOOD } from './food';
import { GEO } from './geo';
import { HISTORY } from './history';
import { MONEY } from './money';
import { MYTHS } from './myths';
import { POP } from './pop';
import { SCIENCE } from './science';
import { SPACE } from './space';
import { SPORTS } from './sports';
import { TECH } from './tech';
import { WORDS } from './words';
import { BULGARIA } from './bulgaria';
import { GROWTH } from './growth';

export const PT: Pack = {
  ...EN,
  lang: 'pt' as Pack['lang'],
  locale: 'pt-PT',
  batches: [
    { since: EN.batches[0]!.since, items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS } },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Verdadeiro', 'Falso'],
    ['Mito', 'Facto'],
    ['Sim', 'Não'],
  ],
  ui: { ...(EN as unknown as { ui: never }).ui },
};

export const PACK = PT;
