import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { HolidayId } from '../platform/seasons';
import './SeasonScene.css';

/**
 * Each holiday's scenery behind the page (the owner, 2026-10-28: "a bit more functionality… different
 * background, flying bats for halloween, and other mini events"): a backdrop that stays (a moon, lanterns,
 * lamps, a snowdrift…) and now and then a small event crossing it (a witch on her broom, a sleigh,
 * fireworks, a bunny…). All of it sits behind the content like the floating decorations: it never covers
 * text, never takes a click, stops while the tab is hidden, and is still under reduced motion.
 */

interface Happening {
  id: number;
  kind: string;
  /** Where it happens (% of the screen) and how long it takes (s). */
  x: number;
  y: number;
  secs: number;
  /** Left to right (or the way the art faces). */
  ltr: boolean;
}

interface SceneDef {
  backdrop: () => ReactNode;
  /** The event, and the pause between two (ms). */
  event?: { kind: string; every: [number, number]; secs: [number, number]; area: [number, number, number, number] };
}

let ids = 0;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/** At the screen's edges, in the page's margins, never behind its text. */
const LANTERNS = [1.5, 5, 95, 98.5];
const LAMPS = Array.from({ length: 14 }, (_, i) => 3 + i * 7.2);

const SCENES: Partial<Record<HolidayId, SceneDef>> = {
  halloween: {
    backdrop: () => (
      <>
        <div className="sc-glow sc-glow-dusk" />
        <div className="sc-moon" />
      </>
    ),
    event: { kind: 'witch', every: [26_000, 48_000], secs: [11, 15], area: [0, 100, 14, 34] },
  },
  winter: {
    backdrop: () => (
      <>
        <div className="sc-aurora" />
        <div className="sc-drift" />
      </>
    ),
    event: { kind: 'sleigh', every: [30_000, 55_000], secs: [12, 16], area: [0, 100, 12, 30] },
  },
  valentine: {
    backdrop: () => <div className="sc-glow sc-glow-rose" />,
    event: { kind: 'balloon', every: [9_000, 16_000], secs: [14, 20], area: [6, 94, 100, 100] },
  },
  lunar: {
    backdrop: () => (
      <>
        <div className="sc-glow sc-glow-gold" />
        {LANTERNS.map((x, i) => (
          <span key={x} className="sc-lantern" style={{ left: `${x}%`, animationDelay: `-${i * 1.3}s` } as CSSProperties} />
        ))}
      </>
    ),
    event: { kind: 'firework', every: [6_000, 12_000], secs: [1.8, 2.2], area: [12, 88, 18, 50] },
  },
  diwali: {
    backdrop: () => (
      <>
        <div className="sc-glow sc-glow-gold" />
        <div className="sc-lamps">
          {LAMPS.map((x, i) => (
            <span key={x} className="sc-lamp" style={{ left: `${x}%`, animationDelay: `-${(i * 0.37) % 1.4}s` } as CSSProperties} />
          ))}
        </div>
      </>
    ),
    event: { kind: 'firework', every: [5_000, 10_000], secs: [1.8, 2.2], area: [10, 90, 16, 48] },
  },
  easter: {
    backdrop: () => <div className="sc-meadow" />,
    event: { kind: 'bunny', every: [24_000, 42_000], secs: [9, 12], area: [0, 100, 100, 100] },
  },
  summer: {
    backdrop: () => (
      <>
        <div className="sc-sun" />
        <div className="sc-waves" />
      </>
    ),
    event: { kind: 'gulls', every: [20_000, 36_000], secs: [12, 16], area: [0, 100, 14, 32] },
  },
};

export function SeasonScene({ id }: { id: HolidayId }) {
  const scene = SCENES[id];
  const [now, setNow] = useState<Happening[]>([]);
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const ev = scene?.event;
    if (!ev || still) return;
    let timer = 0;
    const next = (): void => {
      // never more than two at once, and none while nobody is looking
      if (!document.hidden)
        setNow((list) =>
          list.length >= 2 ? list : [...list, { id: ++ids, kind: ev.kind, x: rand(ev.area[0], ev.area[1]), y: rand(ev.area[2], ev.area[3]), secs: rand(ev.secs[0], ev.secs[1]), ltr: Math.random() < 0.5 }],
        );
      timer = window.setTimeout(next, rand(ev.every[0], ev.every[1]));
    };
    timer = window.setTimeout(next, rand(3_000, 8_000));
    return () => window.clearTimeout(timer);
  }, [scene, still]);
  if (!scene) return null;
  return (
    <div className={`season-scene sc-${id}`} aria-hidden="true">
      {scene.backdrop()}
      {now.map((h) => (
        <span
          key={h.id}
          className={`sc-ev sc-${h.kind}${h.ltr ? ' is-ltr' : ''}`}
          style={{ ['--x' as string]: `${h.x}%`, ['--y' as string]: `${h.y}%`, animationDuration: `${h.secs}s` }}
          onAnimationEnd={(e) => e.target === e.currentTarget && setNow((list) => list.filter((x) => x.id !== h.id))}
        >
          <EventArt kind={h.kind} />
        </span>
      ))}
    </div>
  );
}

/** The little actors, as silhouettes or simple shapes (no emoji: they look the same everywhere). */
function EventArt({ kind }: { kind: string }) {
  switch (kind) {
    case 'witch':
      return (
        <svg viewBox="0 0 96 48" className="sc-art">
          {/* the broom, the rider in her hat and cloak, a cat on the bristles */}
          <path d="M6 32 L70 30" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M66 26 L92 22 L90 30 L94 36 L66 34 Z" />
          <path d="M28 31 C30 22 36 18 41 19 L44 9 L38 4 L50 6 L47 18 C52 20 54 26 52 31 Z" />
          <path d="M26 31 C20 34 14 40 10 44 C18 40 24 37 32 33 Z" />
          <path d="M72 26 C72 22 75 20 77 21 L78 17 L80 21 C82 21 83 23 82 26 Z" />
        </svg>
      );
    case 'sleigh':
      return (
        <svg viewBox="0 0 146 40" className="sc-art">
          {/* two reindeer at a gallop out in front, facing the way they go (right, as drawn), and the sleigh behind
              them on its runners, its curled runners to the front (the reindeer were drawn behind the sleigh, and it flew
              backwards: 2026-11-21) */}
          {[76, 106].map((dx) => (
            <g key={dx} transform={`translate(${dx} 0)`}>
              <path d="M8 22 C12 18 22 18 26 21 L30 15 L28 9 L31 13 L33 8 L33 14 L36 16 L32 19 L29 24 L30 32 L27 32 L25 26 L14 27 L11 33 L8 33 L10 26 Z" />
            </g>
          ))}
          <path d="M40 20 L86 21" stroke="currentColor" strokeWidth="1.2" />
          <g transform="translate(-70 0)">
            <path d="M74 14 L100 14 C104 14 106 18 104 22 L110 22 L112 12 L118 12 L116 26 L76 26 Z" />
            <path d="M72 30 L120 30 C126 30 128 26 126 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="104" cy="9" r="4" />
          </g>
        </svg>
      );
    case 'balloon':
      return (
        <svg viewBox="0 0 24 56" className="sc-art">
          <path d="M12 26 C12 26 2 19 2 11.5 C2 7.6 4.9 4.6 8.3 4.6 C10.2 4.6 11.4 5.6 12 7 C12.6 5.6 13.8 4.6 15.7 4.6 C19.1 4.6 22 7.6 22 11.5 C22 19 12 26 12 26 Z" />
          <path d="M12 26 C10 34 14 42 11 54" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.7" />
        </svg>
      );
    case 'bunny':
      return (
        <svg viewBox="0 0 40 32" className="sc-art">
          <path d="M8 26 C4 26 3 20 7 17 C9 12 16 10 22 12 L25 4 C26 1 29 2 28 5 L27 12 L30 3 C31 0 34 1 33 4 L31 13 C35 15 36 19 34 22 C33 26 28 27 24 27 L22 30 L18 30 L19 27 L12 27 L10 30 L6 30 Z" />
          <circle cx="6.5" cy="21" r="3.2" className="sc-tail" />
        </svg>
      );
    case 'gulls':
      return (
        <svg viewBox="0 0 80 30" className="sc-art">
          <path d="M2 14 Q10 6 18 13 Q26 6 34 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M40 22 Q46 16 52 21 Q58 16 64 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M58 8 Q63 4 68 8 Q73 4 78 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'firework':
      return (
        <span className="sc-burst">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ ['--a' as string]: `${i * 30}deg` }} />
          ))}
        </span>
      );
    default:
      return null;
  }
}
