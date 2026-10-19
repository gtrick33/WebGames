import { useEffect, useRef, useState } from 'react';
import type { GamePreviewProps } from '../../platform/contract';
import { usePreviewActive } from '../../platform/previewLoop';
import { Parcel } from './art';
import './Game.css';
import './Preview.css';

/** Three short rounds, true to the bank: the answers single out the last card standing. */
const ROUNDS: { theme: string; qs: [string, boolean][]; cards: string[]; answer: string }[] = [
  { theme: '🎻 Instruments', qs: [['Strings?', false], ['Blown?', true], ['Has a bag?', false]], cards: ['Harp', 'Kaval', 'Gaida', 'Violin'], answer: 'Kaval' },
  { theme: '🪐 Space', qs: [['A planet?', true], ['Bigger than Earth?', true], ['Seen by eye?', false]], cards: ['Mars', 'Saturn', 'Venus', 'Neptune'], answer: 'Neptune' },
  { theme: '🐙 Sea creatures', qs: [['A fish?', false], ['A mammal?', true], ['A tusk?', true]], cards: ['Dugong', 'Turbot', 'Narwhal', 'Octopus'], answer: 'Narwhal' },
];

/** Whatsit's attract mode: yes/no answers pile up, then the line-up is crossed down to the secret. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const active = usePreviewActive(ref, playing);
  const [{ round, tick }, setShow] = useState(() => ({ round: Math.floor(Math.random() * ROUNDS.length), tick: 0 }));
  const r = ROUNDS[round]!;
  const asked = Math.min(r.qs.length, tick);
  const crossing = tick - r.qs.length - 1;
  const others = r.cards.filter((c) => c !== r.answer);
  const crossed = new Set(others.slice(0, Math.max(0, crossing)));
  const solved = crossing > others.length;

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(
      () =>
        setShow((s) => {
          const cur = ROUNDS[s.round]!;
          // Questions, the line-up, a cross per wrong card, then a beat on the answer.
          return s.tick < cur.qs.length + cur.cards.length + 3 ? { ...s, tick: s.tick + 1 } : { round: (s.round + 1) % ROUNDS.length, tick: 0 };
        }),
      650,
    );
    return () => window.clearInterval(t);
  }, [active]);

  const last = asked > 0 ? r.qs[asked - 1]! : null;
  return (
    <div ref={ref} className="pv-whz" aria-hidden="true">
      <div className="pv-whz-top">
        <Parcel mood={solved ? 'yes' : last ? (last[1] ? 'yes' : 'no') : 'think'} className="pv-whz-parcel" key={asked} />
        <span className="pv-whz-theme">{r.theme}</span>
      </div>
      <ul className="pv-whz-qs">
        {r.qs.slice(0, asked).map(([q, yes]) => (
          <li key={q} className={yes ? 'is-yes' : 'is-no'}>
            {yes ? '✓' : '✗'} {q}
          </li>
        ))}
      </ul>
      <ul className="pv-whz-cards">
        {r.cards.map((c) => (
          <li key={c} className={`${tick > r.qs.length ? 'is-in' : ''}${crossed.has(c) ? ' is-crossed' : ''}${solved && c === r.answer ? ' is-it' : ''}`}>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
