import { useEffect, useRef, useState } from 'react';
import type { GamePreviewProps } from '../../platform/contract';
import { usePreviewActive } from '../../platform/previewLoop';
import { CardArt, Robot } from './art';
import { cardOf, likes, makeRound, type Level, type Round } from './logic';
import './Game.css';
import './Preview.css';

/** Fussbox's attract mode: cards slide into the robot, it lights green or red, the trays fill up. */
const fresh = (): Show => {
  const round = makeRound((Math.random() * 2 ** 32) >>> 0, (1 + Math.floor(Math.random() * 2)) as Level);
  return { round, n: 0, card: round.exam[0]!, judged: false, liked: round.liked.slice(), hated: round.hated.slice() };
};
interface Show {
  round: Round;
  n: number;
  card: number;
  judged: boolean;
  liked: number[];
  hated: number[];
}

/** Fussbox's attract mode: cards slide into the robot, it lights green or red, the trays fill up. */
export default function Preview({ playing = true }: GamePreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const active = usePreviewActive(ref, playing);
  const [show, setShow] = useState<Show>(fresh);

  useEffect(() => {
    if (!active) return;
    const tick = window.setInterval(() => {
      setShow((s) => {
        if (!s.judged) return { ...s, judged: true };
        if (s.n >= 7) return fresh();
        const yes = likes(s.round.rule, cardOf(s.card));
        return {
          ...s,
          n: s.n + 1,
          card: s.round.exam[(s.n + 1) % s.round.exam.length]!,
          judged: false,
          liked: yes ? [...s.liked, s.card].slice(-4) : s.liked,
          hated: yes ? s.hated : [...s.hated, s.card].slice(-4),
        };
      });
    }, 700);
    return () => window.clearInterval(tick);
  }, [active]);

  const yes = likes(show.round.rule, cardOf(show.card));
  return (
    <div ref={ref} className="pv-fbx" aria-hidden="true">
      <div className="pv-fbx-tray is-yes">
        <b>✓</b>
        {show.liked.map((id) => (
          <CardArt key={id} id={id} />
        ))}
      </div>
      <div className="pv-fbx-bench">
        <Robot mood={show.judged ? (yes ? 'yes' : 'no') : 'idle'} className="pv-fbx-robot" key={`${show.n}${show.judged}`} />
        <div className="pv-fbx-card" key={show.card}>
          <CardArt id={show.card} />
        </div>
      </div>
      <div className="pv-fbx-tray is-no">
        <b>✗</b>
        {show.hated.map((id) => (
          <CardArt key={id} id={id} />
        ))}
      </div>
    </div>
  );
}
