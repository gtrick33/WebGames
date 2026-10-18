import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import type { GameEntry } from '../catalog/types';
import { track } from '../platform/analytics';
import { dayKey } from '../platform/dates';
import { useLiveCatalog } from '../platform/liveCatalog';
import { useSave } from '../platform/store';
import { navigate } from '../router/router';
import './Surprise.css';

/** Spins through the games like a slot machine, slowing down, and lands on one. */
function Spinner({ games, pick, onDone }: { games: GameEntry[]; pick: GameEntry; onDone: () => void }) {
  const t = useT();
  const [shown, setShown] = useState(0);
  const [landed, setLanded] = useState(false);
  // The page around may re-render every second (clocks); the spin must not restart with it.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduced ? 1 : 12 + Math.floor(Math.random() * 3);
    let i = 0;
    let timer = 0;
    const tick = (): void => {
      i++;
      if (i >= steps) {
        setShown(-1);
        setLanded(true);
        timer = window.setTimeout(() => done.current(), 750);
        return;
      }
      setShown(i);
      // Starts fast and slows down, like a wheel running out of spin.
      timer = window.setTimeout(tick, 35 + i * i * 1.1);
    };
    timer = window.setTimeout(tick, 60);
    return () => window.clearTimeout(timer);
  }, []);
  const g = shown < 0 ? pick : games[shown % games.length]!;
  return createPortal(
    <div className="surprise" role="dialog" aria-live="polite" aria-label={t('Picking a game…')}>
      <div className={`surprise-card${landed ? ' is-landed' : ''}`} data-accent={g.accent}>
        <p className="surprise-kicker mono">🎲 {landed ? t('Your game:') : t('Picking a game…')}</p>
        <div className="surprise-window">
          <img key={g.slug} src={g.art.tile} alt="" style={{ background: g.art.bg }} />
        </div>
        <p className="surprise-title">{g.title}</p>
      </div>
    </div>,
    document.body,
  );
}

/**
 * "Surprise me": picks a random game (one you have not played today, when there is one) with a
 * short slot-machine spin, then opens it.
 */
export function SurpriseButton({ className = 'btn', label }: { className?: string; label?: string }) {
  const t = useT();
  const live = useLiveCatalog();
  const save = useSave();
  const [spin, setSpin] = useState<{ games: GameEntry[]; pick: GameEntry } | null>(null);
  const games = live.games.filter((g) => !live.settings(g.slug).maintenance);
  const go = (): void => {
    if (!games.length) return;
    const today = dayKey();
    const last = (slug: string): number => save.games[slug]?.last ?? 0;
    const fresh = games.filter((g) => !last(g.slug) || dayKey(new Date(last(g.slug))) !== today);
    const pool = fresh.length ? fresh : games;
    const pick = pool[Math.floor(Math.random() * pool.length)]!;
    track('surprise_me', { game: pick.slug });
    // Shuffle the reel so it is not the catalogue order every time.
    const reel = [...games].sort(() => Math.random() - 0.5);
    setSpin({ games: reel, pick });
  };
  return (
    <>
      <button className={className} onClick={go} type="button">
        <span aria-hidden="true">🎲</span> {label ?? t('Surprise me')}
      </button>
      {spin && (
        <Spinner
          games={spin.games}
          pick={spin.pick}
          onDone={() => {
            const slug = spin.pick.slug;
            setSpin(null);
            navigate(`/games/${slug}`);
          }}
        />
      )}
    </>
  );
}
