/**
 * Belot's cards, drawn here (no image files): cream faces with a bold ink outline, corner indexes,
 * pips laid out like a real deck, aces with one big suit, and the court cards as cartoon characters
 * in their suit's colours (the jack in a feathered cap, the queen in a tiara, the king crowned and
 * bearded). Suits are SVG paths, never text, so phones do not turn them into emoji.
 */
import { memo } from 'react';
import { rankOf, RANKS, suitOf, type Card } from './logic';

/** The four suits in a 100 × 100 box. */
const SUIT_PATH = [
  // clubs: three leaves and a stem
  'M50 10a17 17 0 0 1 16 23a17 17 0 1 1 3 30a18 18 0 0 1-13-6q2 18 12 31H32q10-13 12-31a18 18 0 0 1-13 6a17 17 0 1 1 3-30a17 17 0 0 1 16-23z',
  // diamonds
  'M50 4Q66 30 90 50Q66 70 50 96Q34 70 10 50Q34 30 50 4z',
  // hearts
  'M50 90C22 68 4 50 4 31C4 16 16 6 30 6c9 0 16 5 20 13c4-8 11-13 20-13c14 0 26 10 26 25c0 19-18 37-46 59z',
  // spades
  'M50 6C34 28 8 40 8 60c0 13 10 22 22 22c7 0 12-3 16-8q-2 14-12 22h32q-10-8-12-22c4 5 9 8 16 8c12 0 22-9 22-22C92 40 66 28 50 6z',
];
export const RED = '#e8344e';
export const BLACK = '#1d1238';
export const suitColor = (s: number): string => (s === 1 || s === 2 ? RED : BLACK);

export function SuitIcon({ suit, size = 18, className, color }: { suit: number; size?: number; className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d={SUIT_PATH[suit]} fill={color ?? suitColor(suit)} />
    </svg>
  );
}

/** Where the pips go for 7 to 10, in a 100 × 140 card (x, y, upside down). */
const PIPS: Record<number, [number, number, boolean][]> = {
  0: [[30, 32, false], [70, 32, false], [50, 51, false], [30, 70, false], [70, 70, false], [30, 108, true], [70, 108, true]],
  1: [[30, 32, false], [70, 32, false], [50, 51, false], [30, 70, false], [70, 70, false], [50, 89, true], [30, 108, true], [70, 108, true]],
  2: [[30, 32, false], [70, 32, false], [30, 57, false], [70, 57, false], [50, 70, false], [30, 83, true], [70, 83, true], [30, 108, true], [70, 108, true]],
  3: [[30, 32, false], [70, 32, false], [50, 45, false], [30, 57, false], [70, 57, false], [30, 83, true], [70, 83, true], [50, 95, true], [30, 108, true], [70, 108, true]],
};

/** Each suit's court colours: coat, trim, and the face's cheeks. */
const COURT = [
  { coat: '#2fb36a', trim: '#ffd12e' },
  { coat: '#ff8a1f', trim: '#7b4dff' },
  { coat: '#ff4fa3', trim: '#ffd12e' },
  { coat: '#3d7bff', trim: '#c4f034' },
];

function Court({ suit, rank }: { suit: number; rank: number }) {
  const { coat, trim } = COURT[suit]!;
  const ink = BLACK;
  // 4 jack, 5 queen, 6 king
  return (
    <g stroke={ink} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
      <rect x="16" y="22" width="68" height="96" rx="10" fill={coat} opacity="0.22" stroke="none" />
      {/* shoulders */}
      <path d="M22 116c2-22 14-32 28-32s26 10 28 32z" fill={coat} />
      <path d="M40 86l10 14l10-14" fill="none" stroke={trim} strokeWidth="4" />
      {/* head */}
      <circle cx="50" cy="64" r="19" fill="#ffe1c4" />
      <circle cx="42.5" cy="62" r="2.6" fill={ink} stroke="none" />
      <circle cx="57.5" cy="62" r="2.6" fill={ink} stroke="none" />
      <circle cx="39" cy="70" r="3.4" fill="#ff9fb0" stroke="none" opacity="0.8" />
      <circle cx="61" cy="70" r="3.4" fill="#ff9fb0" stroke="none" opacity="0.8" />
      {rank === 6 ? (
        <>
          {/* beard and moustache */}
          <path d="M33 66c0 16 8 24 17 24s17-8 17-24c-4 6-9 8-17 8s-13-2-17-8z" fill="#f2f2f2" />
          <path d="M42 72q8-5 16 0" fill="none" />
          {/* crown */}
          <path d="M31 48l4-20l9 10l6-14l6 14l9-10l4 20z" fill={trim} />
          <circle cx="50" cy="40" r="2.5" fill={RED} stroke="none" />
        </>
      ) : rank === 5 ? (
        <>
          {/* hair and tiara */}
          <path d="M31 66c-4-22 6-34 19-34s23 12 19 34c-3-10-8-18-19-18s-16 8-19 18z" fill="#7a3b12" />
          <path d="M34 40q16-14 32 0l-4 6q-12-8-24 0z" fill={trim} />
          <circle cx="50" cy="35" r="3" fill="#5ad1ff" stroke="none" />
          <path d="M44 74q6 4 12 0" fill="none" />
        </>
      ) : (
        <>
          {/* cap with a feather */}
          <path d="M30 54q2-20 22-20q18 0 20 16q-20-6-42 4z" fill={trim} />
          <path d="M64 40q14-16 22-12q-8 4-14 16z" fill={coat} />
          <path d="M44 73q6 3 12 0" fill="none" />
        </>
      )}
    </g>
  );
}

export const CardFace = memo(function CardFace({ card }: { card: Card }) {
  const s = suitOf(card);
  const r = rankOf(card);
  const color = suitColor(s);
  const label = RANKS[r]!;
  const corner = (rot: boolean) => (
    <g transform={rot ? 'rotate(180 50 70)' : undefined}>
      <text x="13" y="21" fontSize={label === '10' ? 17 : 19} fontWeight="800" fill={color} textAnchor="middle" fontFamily="var(--bl-font)" letterSpacing={label === '10' ? -1.5 : 0}>
        {label}
      </text>
      <path d={SUIT_PATH[s]} fill={color} transform="translate(5 25) scale(0.16)" />
    </g>
  );
  return (
    <svg className="bl-face" viewBox="0 0 100 140" aria-hidden="true">
      <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="#fffaf2" stroke={BLACK} strokeWidth="3" />
      {r <= 3 &&
        PIPS[r]!.map(([x, y, flip], i) => <path key={i} d={SUIT_PATH[s]} fill={color} transform={`translate(${x - 9} ${y - 9}) scale(0.18)${flip ? ' rotate(180 50 50)' : ''}`} />)}
      {r === 7 && (
        <>
          <circle cx="50" cy="70" r="30" fill={color} opacity="0.1" />
          <path d={SUIT_PATH[s]} fill={color} stroke={BLACK} strokeWidth="5" transform="translate(23 43) scale(0.54)" />
          <path d="M78 32l3 7l7 3l-7 3l-3 7l-3-7l-7-3l7-3z" fill="#ffd12e" stroke={BLACK} strokeWidth="1.5" />
        </>
      )}
      {r >= 4 && r <= 6 && <Court suit={s} rank={r} />}
      {corner(false)}
      {corner(true)}
    </svg>
  );
});

/** Shared SVG definitions (the back's lattice), rendered once per table. */
export function CardDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <pattern id="bl-lattice" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill="#5b2bd6" />
          <rect width="7" height="7" fill="#7b4dff" />
        </pattern>
      </defs>
    </svg>
  );
}

/** The back: GlitchBound purple with a diamond lattice and a round emblem. */
export const CardBack = memo(function CardBack() {
  return (
    <svg className="bl-face" viewBox="0 0 100 140" aria-hidden="true">
      <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="#fffaf2" stroke={BLACK} strokeWidth="3" />
      <rect x="8" y="8" width="84" height="124" rx="6" fill="url(#bl-lattice)" stroke={BLACK} strokeWidth="2" />
      <circle cx="50" cy="70" r="18" fill="#ffd12e" stroke={BLACK} strokeWidth="2.5" />
      <path d={SUIT_PATH[2]} fill={RED} transform="translate(39 59) scale(0.22)" />
    </svg>
  );
});

/** A card for screen readers: "Queen of hearts". */
export function cardLabel(card: Card, suits: readonly string[]): string {
  const names = ['7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
  return `${names[rankOf(card)]} ${suits[suitOf(card)]}`;
}
