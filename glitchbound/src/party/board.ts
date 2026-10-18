/**
 * Dice & Board Adventure: board generation and a pure reducer for turns, movement and tile events.
 * The UI animates token steps; every rule (where you land, what a tile does, who is next, who wins)
 * lives here and is unit tested.
 */
import { rng, shuffle, type Rng } from './engine';

export type TileKind = 'start' | 'finish' | 'card' | 'mini' | 'trivia' | 'lucky' | 'setback' | 'shortcut' | 'slide' | 'swap' | 'group' | 'duel' | 'again' | 'rest';

export interface Tile {
  kind: TileKind;
  /** Steps for lucky / setback, or the destination index for shortcut / slide. */
  value?: number;
}

export type BoardSize = 'short' | 'medium' | 'long';
export const BOARD_LENGTH: Record<BoardSize, number> = { short: 24, medium: 36, long: 50 };

export const TILE_INFO: Record<TileKind, { label: string; icon: string; color: string }> = {
  start: { label: 'Start', icon: '🏁', color: '#ffffff' },
  finish: { label: 'Finish', icon: '🏆', color: '#ffd21f' },
  card: { label: 'Challenge', icon: '🃏', color: '#ff9ccf' },
  mini: { label: 'Mini-game', icon: '🎮', color: '#7fd6ff' },
  trivia: { label: 'Trivia', icon: '❓', color: '#b9a4ff' },
  lucky: { label: 'Lucky', icon: '🍀', color: '#9be36b' },
  setback: { label: 'Oops', icon: '🌧️', color: '#ff8b7a' },
  shortcut: { label: 'Shortcut', icon: '🚀', color: '#2fd1a0' },
  slide: { label: 'Slide', icon: '🛝', color: '#ff7a59' },
  swap: { label: 'Swap', icon: '🔀', color: '#ffd21f' },
  group: { label: 'Everyone', icon: '🎉', color: '#ffb020' },
  duel: { label: 'Duel', icon: '⚔️', color: '#ff5a6c' },
  again: { label: 'Roll again', icon: '🎲', color: '#4fd4f5' },
  rest: { label: 'Chill', icon: '☕', color: '#e8e2d6' },
};

/** A fresh board: a fair mix of tiles with shortcuts and slides that never skip the whole board. */
export function makeBoard(size: BoardSize, seed: number): Tile[] {
  const r = rng(seed);
  const n = BOARD_LENGTH[size];
  const mix: TileKind[] = ['card', 'card', 'card', 'mini', 'trivia', 'lucky', 'setback', 'group', 'duel', 'swap', 'again', 'rest', 'card', 'trivia', 'mini'];
  const tiles: Tile[] = [{ kind: 'start' }];
  let bag: TileKind[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (!bag.length) bag = shuffle(mix, r);
    tiles.push({ kind: bag.pop()! });
  }
  tiles.push({ kind: 'finish' });
  for (let i = 1; i < n - 1; i++) {
    const t = tiles[i]!;
    if (t.kind === 'lucky') t.value = 2 + Math.floor(r() * 3);
    if (t.kind === 'setback') t.value = 2 + Math.floor(r() * 3);
  }
  // A few shortcuts (forward 4-8) and slides (back 4-8), spread along the board.
  const specials = Math.max(2, Math.round(n / 12));
  for (let k = 0; k < specials; k++) {
    const shortAt = Math.floor(((k + 0.3) / specials) * (n - 12)) + 2;
    const slideAt = Math.floor(((k + 0.75) / specials) * (n - 12)) + 8;
    if (shortAt < n - 10) tiles[shortAt] = { kind: 'shortcut', value: Math.min(n - 3, shortAt + 4 + Math.floor(r() * 5)) };
    if (slideAt > 8 && slideAt < n - 2) tiles[slideAt] = { kind: 'slide', value: Math.max(1, slideAt - 4 - Math.floor(r() * 5)) };
  }
  return tiles;
}

export interface BoardStats {
  moved: number;
  setbacks: number;
  boosts: number;
  challenges: number;
  skips: number;
  sixes: number;
}

export interface BoardState {
  tiles: Tile[];
  /** Player ids in turn order. */
  order: string[];
  pos: Record<string, number>;
  turn: number;
  phase: 'roll' | 'event' | 'done';
  lastRoll: number;
  /** The tile index the current player landed on (event phase). */
  landed: number;
  winner: string | null;
  stats: Record<string, BoardStats>;
  log: string[];
  /** Seed for event picks (cards, trivia) so a session is reproducible. */
  seed: number;
}

const emptyStats = (): BoardStats => ({ moved: 0, setbacks: 0, boosts: 0, challenges: 0, skips: 0, sixes: 0 });

export function startBoard(tiles: Tile[], order: string[], seed: number): BoardState {
  return {
    tiles,
    order,
    pos: Object.fromEntries(order.map((id) => [id, 0])),
    turn: 0,
    phase: 'roll',
    lastRoll: 0,
    landed: 0,
    winner: null,
    stats: Object.fromEntries(order.map((id) => [id, emptyStats()])),
    log: [],
    seed,
  };
}

export const currentPlayer = (s: BoardState): string => s.order[s.turn % s.order.length]!;
export const finishIndex = (s: BoardState): number => s.tiles.length - 1;

/** Where a roll ends: you stop on the finish if you would pass it. */
export const landingIndex = (s: BoardState, from: number, roll: number): number => Math.min(finishIndex(s), from + roll);

export type BoardAction =
  | { type: 'roll'; value: number }
  /** Resolve the landed tile. `ok` = challenge done / trivia right / duel won by the current player. */
  | { type: 'resolve'; ok: boolean; swapWith?: string; winnerId?: string };

function bump(s: BoardState, id: string, k: keyof BoardStats, n = 1): Record<string, BoardStats> {
  return { ...s.stats, [id]: { ...s.stats[id]!, [k]: s.stats[id]![k] + n } };
}

function moveTo(s: BoardState, id: string, to: number): BoardState {
  const clamped = Math.max(0, Math.min(finishIndex(s), to));
  const pos = { ...s.pos, [id]: clamped };
  if (clamped === finishIndex(s)) return { ...s, pos, phase: 'done', winner: id };
  return { ...s, pos };
}

const nextTurn = (s: BoardState): BoardState => (s.phase === 'done' ? s : { ...s, phase: 'roll', turn: s.turn + 1 });

export function reduceBoard(s: BoardState, a: BoardAction): BoardState {
  if (s.phase === 'done') return s;
  const me = currentPlayer(s);
  if (a.type === 'roll') {
    if (s.phase !== 'roll' || a.value < 1 || a.value > 6) return s;
    const from = s.pos[me]!;
    const to = landingIndex(s, from, a.value);
    let next: BoardState = { ...s, lastRoll: a.value, landed: to, stats: bump(s, me, 'moved', to - from) };
    if (a.value === 6) next = { ...next, stats: bump(next, me, 'sixes') };
    next = moveTo(next, me, to);
    if (next.phase === 'done') return { ...next, log: [...s.log, `${me} reached the finish!`] };
    const tile = s.tiles[to]!;
    // Tiles that only move you resolve instantly; the rest wait for the group.
    if (tile.kind === 'rest' || tile.kind === 'start') return nextTurn({ ...next, log: [...s.log, `${me} chilled on ${to}`] });
    return { ...next, phase: 'event' };
  }
  // resolve
  if (s.phase !== 'event') return s;
  const tile = s.tiles[s.landed]!;
  const at = s.pos[me]!;
  let next: BoardState = s;
  switch (tile.kind) {
    case 'lucky':
      next = { ...moveTo(s, me, at + (tile.value ?? 2)), stats: bump(s, me, 'boosts') };
      break;
    case 'setback':
      next = { ...moveTo(s, me, at - (tile.value ?? 2)), stats: bump(s, me, 'setbacks') };
      break;
    case 'shortcut':
      next = { ...moveTo(s, me, tile.value ?? at), stats: bump(s, me, 'boosts') };
      break;
    case 'slide':
      next = { ...moveTo(s, me, tile.value ?? at), stats: bump(s, me, 'setbacks') };
      break;
    case 'swap': {
      const other = a.swapWith && a.swapWith !== me && s.order.includes(a.swapWith) ? a.swapWith : null;
      if (other) next = { ...s, pos: { ...s.pos, [me]: s.pos[other]!, [other]: at } };
      break;
    }
    case 'again':
      // Same player rolls again: do not advance the turn.
      return { ...s, phase: 'roll', log: [...s.log, `${me} rolls again`] };
    case 'duel': {
      const winner = a.winnerId && s.order.includes(a.winnerId) ? a.winnerId : a.ok ? me : null;
      if (winner) next = { ...moveTo(s, winner, s.pos[winner]! + 2), stats: bump(s, winner, 'boosts') };
      break;
    }
    case 'card':
    case 'group':
    case 'mini':
    case 'trivia':
      // Done / right answer: +1 step bonus. Skipped / wrong: back 1.
      next = a.ok ? { ...moveTo(s, me, at + 1), stats: bump(s, me, 'challenges') } : { ...moveTo(s, me, at - 1), stats: bump(s, me, 'skips') };
      break;
    default:
      break;
  }
  const log = [...s.log, `${me}: ${tile.kind}${a.ok ? '' : ' (missed)'}`].slice(-30);
  return nextTurn({ ...next, log });
}

/** Players ordered by finish: the winner first, then by position. */
export function standings(s: BoardState): string[] {
  return [...s.order].sort((a, b) => (a === s.winner ? -1 : b === s.winner ? 1 : s.pos[b]! - s.pos[a]!));
}

export interface Award {
  title: string;
  playerId: string;
  why: string;
}

/** Funny end-of-game awards from the stats (only awards someone actually earned). */
export function boardAwards(s: BoardState): Award[] {
  const pick = (k: keyof BoardStats, title: string, why: (n: number) => string): Award | null => {
    let best: string | null = null;
    let n = 0;
    for (const id of s.order) {
      const v = s.stats[id]![k];
      if (v > n) {
        n = v;
        best = id;
      }
    }
    return best ? { title, playerId: best, why: why(n) } : null;
  };
  return [
    pick('setbacks', 'Unluckiest Legend', (n) => `${n} setback${n > 1 ? 's' : ''} and still smiling`),
    pick('boosts', 'Turbo Charged', (n) => `${n} lucky boost${n > 1 ? 's' : ''}`),
    pick('challenges', 'Challenge Champ', (n) => `${n} challenge${n > 1 ? 's' : ''} conquered`),
    pick('sixes', 'Dice Whisperer', (n) => `rolled ${n} six${n > 1 ? 'es' : ''}`),
    pick('skips', 'Professional Skipper', (n) => `skipped ${n} time${n > 1 ? 's' : ''}`),
  ].filter((x): x is Award => !!x);
}

/** A fair die roll. */
export const rollDie = (r: Rng): number => 1 + Math.floor(r() * 6);
