import type { CoachStep } from '../../components/Coach';
import type { ContentLang } from '../../platform/contentLang';
import { Parcel } from './art';

const TEXT: Record<ContentLang, { title: string; body: string }[]> = {
  en: [
    {
      title: 'Something is hiding in the box',
      body: 'Every day the Whatsit hides one thing from the day’s theme, maybe something you have never heard of.',
    },
    {
      title: 'Ask yes/no questions',
      body: 'Pick questions from the list and the box answers. The first three are free; after that each one costs a few points.',
    },
    {
      title: 'Then pick it from the line-up',
      body: 'When you are ready, 12 things from the theme appear. Cross out the ones that don’t match your answers and make your one pick. No more questions after that!',
    },
  ],
  bg: [
    {
      title: 'Нещо се крие в кутията',
      body: 'Всеки ден Whatsit крие едно нещо от темата на деня, може би нещо, за което никога не си чувал.',
    },
    {
      title: 'Задавай въпроси с да или не',
      body: 'Избирай въпроси от списъка и кутията отговаря. Първите три са безплатни, всеки следващ струва няколко точки.',
    },
    {
      title: 'После го избери от редицата',
      body: 'Когато си готов, се появяват 12 неща от темата. Задраскай тези, които не пасват на отговорите, и направи своя един избор. След това няма повече въпроси!',
    },
  ],
};

const EXAMPLE: Record<ContentLang, { theme: string; q: [string, boolean][]; cards: [string, boolean][] }> = {
  en: {
    theme: '🎻 Musical instruments',
    q: [
      ['Does it have strings?', false],
      ['Do you blow into it?', true],
    ],
    cards: [
      ['Kaval', false],
      ['Harp', true],
      ['Didgeridoo', false],
      ['Violin', true],
    ],
  },
  bg: {
    theme: '🎻 Музикални инструменти',
    q: [
      ['Има ли струни?', false],
      ['Духа ли се в него?', true],
    ],
    cards: [
      ['Кавал', false],
      ['Арфа', true],
      ['Диджериду', false],
      ['Цигулка', true],
    ],
  },
};

export const COACH_BUTTONS: Record<ContentLang, { skip: string; next: string; done: string }> = {
  en: { skip: 'Skip', next: 'Next', done: 'Let’s play' },
  bg: { skip: 'Пропусни', next: 'Напред', done: 'Да играем' },
};

/** Whatsit's first-time walkthrough: the box, the questions, the line-up. */
export function coachSteps(lang: ContentLang): CoachStep[] {
  const t = TEXT[lang];
  const ex = EXAMPLE[lang];
  const yesNo = lang === 'bg' ? ['Да', 'Не'] : ['Yes', 'No'];
  return [
    {
      ...t[0]!,
      art: (
        <div className="whz-coach-art">
          <Parcel mood="think" className="whz-coach-parcel" />
          <span className="whz-coach-theme">{ex.theme}</span>
        </div>
      ),
    },
    {
      ...t[1]!,
      art: (
        <ul className="whz-coach-qs">
          {ex.q.map(([q, yes]) => (
            <li key={q}>
              <span>{q}</span>
              <b className={yes ? 'is-yes' : 'is-no'}>{yes ? yesNo[0] : yesNo[1]}</b>
            </li>
          ))}
        </ul>
      ),
    },
    {
      ...t[2]!,
      art: (
        <div className="whz-coach-cards">
          {ex.cards.map(([name, crossed]) => (
            <span key={name} className={crossed ? 'is-crossed' : ''}>
              {name}
            </span>
          ))}
        </div>
      ),
    },
  ];
}
