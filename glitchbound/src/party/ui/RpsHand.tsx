import type { ReactElement } from 'react';

/**
 * Rock, paper and scissors as chunky cartoon hands (ink outline, flat colours, the party's look),
 * instead of emoji, which every phone draws differently. Drawn on a 100 x 100 canvas.
 */
export type RpsHandId = 'rock' | 'paper' | 'scissors';

const INK = '#1d1238';
const SKIN = '#ffd3a3';
const SHADE = '#f4b27e';
const TILE: Record<RpsHandId, string> = { rock: '#ff8a7a', paper: '#7fe3f5', scissors: '#c4f034' };
const LABEL: Record<RpsHandId, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

const finger = (x: number, y: number, w: number, h: number, key: string, rotate?: string) => (
  <rect key={key} x={x} y={y} width={w} height={h} rx={w / 2} transform={rotate} />
);

function Rock() {
  return (
    <>
      {finger(21, 30, 16, 34, 'f1')}
      {finger(35, 25, 16, 39, 'f2')}
      {finger(49, 25, 16, 39, 'f3')}
      {finger(63, 30, 16, 34, 'f4')}
      <path d="M21 54h58v10c0 15-11 25-29 25S21 79 21 64z" />
      <path d="M27 60h30a9 9 0 0 1 0 18H35a9 9 0 0 1-9-9z" fill={SHADE} />
      <path d="M39 33v8M53 33v8M67 37v6" strokeWidth="3" opacity=".35" />
    </>
  );
}

function Paper() {
  return (
    <>
      {finger(27, 16, 12, 42, 'f1', 'rotate(-8 33 50)')}
      {finger(39, 9, 12, 48, 'f2')}
      {finger(51, 11, 12, 46, 'f3')}
      {finger(63, 19, 11, 40, 'f4', 'rotate(8 68 50)')}
      {finger(6, 48, 36, 13, 'thumb', 'rotate(-42 30 56)')}
      <path d="M26 50h48v12c0 16-10 27-24 27S26 78 26 62z" />
      <path d="M38 64c4 5 18 5 24 0" strokeWidth="3" opacity=".35" />
    </>
  );
}

function Scissors() {
  return (
    <>
      {finger(30, 6, 13, 50, 'f1', 'rotate(-14 37 52)')}
      {finger(49, 6, 13, 50, 'f2', 'rotate(14 55 52)')}
      {finger(52, 44, 14, 24, 'f3')}
      {finger(64, 47, 14, 21, 'f4')}
      <path d="M23 50h55v12c0 16-11 27-28 27S23 78 23 62z" />
      <path d="M28 62h28a9 9 0 0 1 0 18H36a9 9 0 0 1-9-9z" fill={SHADE} />
    </>
  );
}

const DRAW: Record<RpsHandId, () => ReactElement> = { rock: Rock, paper: Paper, scissors: Scissors };

/** A hand on its coloured tile; `bare` draws just the hand (for the reveal rows). */
export function RpsHand({ hand, size = 64, bare = false }: { hand: RpsHandId; size?: number; bare?: boolean }) {
  const Hand = DRAW[hand];
  return (
    <svg className="pt-rps-art" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={LABEL[hand]}>
      {!bare && <rect x="3" y="3" width="94" height="94" rx="24" fill={TILE[hand]} stroke={INK} strokeWidth="4" />}
      <g fill={SKIN} stroke={INK} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" transform={bare ? undefined : 'translate(9 9) scale(0.82)'}>
        <Hand />
      </g>
    </svg>
  );
}
