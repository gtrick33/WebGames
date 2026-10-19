import type { CoachStep } from '../../components/Coach';
import type { ContentLang } from '../../platform/contentLang';
import { CardArt, Robot } from './art';
import { cardId } from './logic';

const card = (count: number, shape: number, colour: number, fill: number): number => cardId({ count, shape, colour, fill });

/** A row of cards, each on a green (likes) or red (hates) tile, with an optional ✓/✗ under it. */
function Cards({ ids, tones, marks }: { ids: number[]; tones: ('yes' | 'no')[]; marks?: boolean }) {
  return (
    <div className="fbx-coach-cards">
      {ids.map((id, i) => (
        <span key={id} className={`fbx-coach-card is-${tones[i]}`}>
          <CardArt id={id} />
          {marks && <b>{tones[i] === 'yes' ? '✓' : '✗'}</b>}
        </span>
      ))}
    </div>
  );
}

const TEXT: Record<ContentLang, { title: string; body: string }[]> = {
  en: [
    {
      title: 'It has a secret rule',
      body: 'Every day the Fussbox likes some cards and hates the rest. To start, it shows you two of each.',
    },
    {
      title: 'Feed it cards',
      body: 'Build any card and feed it in. Green and a ding: it likes it. Red and a buzz: it hates it. The fewer tests you need, the more points.',
    },
    {
      title: 'Then ace the exam',
      body: 'Think you’ve cracked it? Say whether it likes each of 8 new cards. Then it tells you its rule.',
    },
  ],
  bg: [
    {
      title: 'То има тайно правило',
      body: 'Всеки ден Fussbox харесва някои карти и мрази останалите. За начало ти показва по две от всеки вид.',
    },
    {
      title: 'Храни го с карти',
      body: 'Направи която и да е карта и му я дай. Зелено и звън: харесва я. Червено и бръмчене: мрази я. Колкото по-малко тестове, толкова повече точки.',
    },
    {
      title: 'После вземи изпита',
      body: 'Мислиш, че си го разгадал? Кажи дали харесва всяка от 8 нови карти. После ще ти издаде правилото си.',
    },
  ],
};

export const COACH_BUTTONS: Record<ContentLang, { skip: string; next: string; done: string }> = {
  en: { skip: 'Skip', next: 'Next', done: 'Let’s play' },
  bg: { skip: 'Пропусни', next: 'Напред', done: 'Да играем' },
};

/** Fussbox's first-time walkthrough: the rule, the tests, the exam. */
export function coachSteps(lang: ContentLang): CoachStep[] {
  const t = TEXT[lang];
  return [
    {
      ...t[0]!,
      art: (
        <div className="fbx-coach-art">
          <Cards ids={[card(2, 0, 0, 1), card(1, 1, 0, 2)]} tones={['yes', 'yes']} />
          <Robot mood="idle" className="fbx-coach-robot" />
          <Cards ids={[card(0, 0, 1, 0), card(2, 2, 2, 0)]} tones={['no', 'no']} />
        </div>
      ),
    },
    {
      ...t[1]!,
      art: (
        <div className="fbx-coach-art">
          <Cards ids={[card(1, 2, 0, 0)]} tones={['yes']} />
          <span className="fbx-coach-arrow">→</span>
          <Robot mood="yes" className="fbx-coach-robot" />
        </div>
      ),
    },
    {
      ...t[2]!,
      art: <Cards ids={[card(0, 1, 0, 1), card(2, 0, 1, 2), card(1, 1, 0, 0), card(0, 2, 2, 0)]} tones={['yes', 'no', 'yes', 'no']} marks />,
    },
  ];
}
