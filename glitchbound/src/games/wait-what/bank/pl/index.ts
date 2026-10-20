// TEMP: lists not yet translated fall back to English.
import { EN, type Pack } from '../../pack';
import { GROWTH } from './growth';
import { ANIMALS } from './animals';
import { BULGARIA } from './bulgaria';
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
import { UI_PL } from './ui';
import { WORDS } from './words';

export const PL: Pack = {
  ...EN,
  lang: 'pl',
  locale: 'pl-PL',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Prawda', 'Fałsz'],
    ['Mit', 'Fakt'],
    ['Tak', 'Nie'],
  ],
  ui: UI_PL,
};

export const PACK = PL;
