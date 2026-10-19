/**
 * Fussbox's pictures: the cards (1–3 symbols in a shape, colour and fill) and the robot with its mood
 * face. Shared by the game and its first-time walkthrough.
 */
import { useId } from 'react';
import { cardOf, type Card } from './logic';

export const COLOURS = ['#ff4f9a', '#2d6cdf', '#f5b400'];

/** One symbol: circle, triangle or square, solid, striped or hollow. */
export function Symbol({ shape, colour, fill, y, pat, k = 1 }: { shape: number; colour: number; fill: number; y: number; pat: string; k?: number }) {
  const c = COLOURS[colour]!;
  const paint = fill === 0 ? c : fill === 1 ? `url(#${pat})` : 'none';
  const common = { fill: paint, stroke: c, strokeWidth: 3.5, strokeLinejoin: 'round' as const };
  if (shape === 0) return <circle cx={30} cy={y} r={10.5 * k} {...common} />;
  if (shape === 1) return <path d={`M30 ${y - 11 * k} L${30 + 11.5 * k} ${y + 9 * k} L${30 - 11.5 * k} ${y + 9 * k} Z`} {...common} />;
  return <rect x={30 - 10.5 * k} y={y - 10.5 * k} width={21 * k} height={21 * k} rx={2.5} {...common} />;
}

/** Where the symbols sit on a card, and how big they are, so two or three never touch. */
const LAYOUT: { ys: number[]; k: number }[] = [
  { ys: [40], k: 1 },
  { ys: [26, 54], k: 0.9 },
  { ys: [16, 40, 64], k: 0.8 },
];

/**
 * A card: 1–3 identical symbols, stacked. With a `title` it is a labelled picture that also shows its name
 * on hover; without one it is decoration (inside a button that carries the name).
 */
export function CardArt({ id, className = '', title }: { id: number; className?: string; title?: string }) {
  const card = cardOf(id);
  const pat = `fbx-${useId().replace(/:/g, '')}`;
  const { ys, k } = LAYOUT[card.count]!;
  return (
    <svg className={`fbx-card ${className}`} viewBox="0 0 60 80" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      {title && <title>{title}</title>}
      <defs>
        <pattern id={pat} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.2" height="5" fill={COLOURS[card.colour]} />
        </pattern>
      </defs>
      <rect x="1.5" y="1.5" width="57" height="77" rx="8" className="fbx-card-bg" />
      {ys.map((y) => (
        <Symbol key={y} shape={card.shape} colour={card.colour} fill={card.fill} y={y} pat={pat} k={k} />
      ))}
    </svg>
  );
}

/** One symbol on its own (no card), for the pickers and the walkthrough. */
export function SymbolIcon({ card, className = '' }: { card: Card; className?: string }) {
  const pat = `fbx-${useId().replace(/:/g, '')}`;
  return (
    <svg className={className} viewBox="15 26 30 28" aria-hidden="true">
      <defs>
        <pattern id={pat} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.2" height="5" fill={COLOURS[card.colour]} />
        </pattern>
      </defs>
      <Symbol shape={card.shape} colour={card.colour} fill={card.fill} y={40} pat={pat} />
    </svg>
  );
}

export type Mood = 'idle' | 'yes' | 'no' | 'think';
/** The Fussbox: a little boxy robot whose face lights green (likes it) or red (hates it). */
export function Robot({ mood, className = '' }: { mood: Mood; className?: string }) {
  const mouth = mood === 'yes' ? 'M22 47 Q32 56 42 47' : mood === 'no' ? 'M22 52 Q32 44 42 52' : mood === 'think' ? 'M24 50 L40 48' : 'M24 50 L40 50';
  return (
    <svg className={`fbx-robot is-${mood} ${className}`} viewBox="0 0 64 72" aria-hidden="true">
      <line x1="32" y1="4" x2="32" y2="13" className="fbx-robot-ant" />
      <circle cx="32" cy="5" r="3.5" className="fbx-robot-bulb" />
      <rect x="6" y="13" width="52" height="50" rx="10" className="fbx-robot-body" />
      <rect x="12" y="20" width="40" height="36" rx="7" className="fbx-robot-face" />
      <circle cx="24" cy="35" r="3.6" className="fbx-robot-eye" />
      <circle cx="40" cy="35" r="3.6" className="fbx-robot-eye" />
      <path d={mouth} className="fbx-robot-mouth" />
      <rect x="18" y="63" width="10" height="7" rx="2" className="fbx-robot-foot" />
      <rect x="36" y="63" width="10" height="7" rx="2" className="fbx-robot-foot" />
    </svg>
  );
}
