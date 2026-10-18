/**
 * Dice Adventure in a live room: the same board and rules as the one-phone game (../board.ts). The
 * room rolls the dice (so nobody can fake a six), every phone shows the board, and the player whose
 * turn it is handles their tile on their own phone: challenge cards, duels, swaps and trivia (checked
 * by the room). The one-phone mini-games become trivia here. Away players are played for
 * automatically and slow turns time out, so a game never gets stuck.
 *
 * Phases: lobby → play → result.
 */
import { boardAwards, currentPlayer, makeBoard, reduceBoard, standings, startBoard, type BoardSize, type BoardState, type Tile, type TileKind } from '../board';
import { CHALLENGES } from '../content/challenges';
import { TRIVIA } from '../content/trivia';
import { draw, filterContent, intensityWeights, rng, shuffle } from '../engine';
import type { Intensity } from '../types';
import { joinSeat, kickSeat, leaveSeat, nextRandom, online, seatByN, seatOf, seatViews, summaryOf, type RoomBase, type SeatView } from './seats';

export { validKey } from './seats';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const SIZES: BoardSize[] = ['short', 'medium', 'long'];
export const VIBES = ['casual', 'spicy'] as const;
const ROLL_SECONDS = 40;
const MOVE_SECONDS = 6;
const SWAP_SECONDS = 30;
const CARD_SECONDS = 90;
const TRIVIA_SECONDS = 30;
const ANSWER_SHOW_MS = 2500;

export type Phase = 'lobby' | 'play' | 'result';
/** Tiles that only move someone: they resolve with one tap (or by themselves). */
const MOVES: TileKind[] = ['lucky', 'setback', 'shortcut', 'slide', 'again'];

export interface Settings {
  size: BoardSize;
  vibe: (typeof VIBES)[number];
}

export interface Event {
  kind: TileKind;
  text: string | null;
  note: string | null;
  opponent: number | null;
  trivia: { q: string; options: string[]; right: number } | null;
  picked: number | null;
}

export interface State extends RoomBase {
  game: 'board';
  phase: Phase;
  settings: Settings;
  /** Player ids inside are seat numbers as strings. */
  board: BoardState | null;
  event: Event | null;
  rolls: number;
  used: string[];
  result: { winner: number; standings: number[]; awards: { title: string; n: number; why: string }[] } | null;
}

export function newRoom(code: string, now: number, seed: number): State {
  return { game: 'board', code, created: now, updated: now, phase: 'lobby', seats: [], nextSeat: 1, host: 0, deadline: null, seed, settings: { size: 'medium', vibe: 'casual' }, board: null, event: null, rolls: 0, used: [], result: null };
}

const nameOf = (s: State, n: number | null): string => (n === null ? 'someone' : (seatByN(s, n)?.name ?? 'someone'));
const isHere = (s: State, n: number): boolean => s.seats.some((x) => x.n === n && x.online);
const current = (s: State): number | null => (s.board && s.board.phase !== 'done' ? Number(currentPlayer(s.board)) : null);

export function join(s: State, key: string, name: string, now: number): string | null {
  return joinSeat(s, key, name, now, MAX_PLAYERS, s.phase === 'play');
}

export function leave(s: State, key: string, now: number): void {
  if (!leaveSeat(s, key, now)) return;
  settle(s, now);
}

function prepareEvent(s: State): void {
  const b = s.board!;
  const tile = b.tiles[b.landed]!;
  const me = Number(currentPlayer(b));
  const others = b.order.map(Number).filter((n) => n !== me);
  const r = rng(nextRandom(s));
  const opponent = others.length ? others[Math.floor(r() * others.length)]! : null;
  const ev: Event = { kind: tile.kind, text: null, note: null, opponent, trivia: null, picked: null };
  const kinds = tile.kind === 'card' ? ['truth', 'dare', 'challenge'] : tile.kind === 'group' ? ['group', 'vote'] : tile.kind === 'duel' ? ['duel'] : [];
  if (kinds.length) {
    const prefs = { intensities: [s.settings.vibe] as Intensity[], adultConfirmed: false, excludedTags: [] };
    const pool = filterContent(CHALLENGES, prefs).filter((c) => kinds.includes(c.kind) && c.target !== 'teams');
    const w = intensityWeights(prefs);
    const d = draw(pool, s.used, r, (c) => w[c.intensity]);
    if (d.item) {
      s.used = d.used.slice(-400);
      ev.text = d.item.text.replace(/\{A\}/g, nameOf(s, me)).replace(/\{B\}/g, nameOf(s, opponent)).replace(/\{TEAM1\}|\{TEAM2\}/g, 'everyone');
      ev.note = d.item.note ?? null;
    }
  } else if (tile.kind === 'trivia' || tile.kind === 'mini') {
    const d = draw(TRIVIA, s.used, r);
    if (d.item) {
      s.used = d.used.slice(-400);
      const options = shuffle(d.item.options, r);
      ev.kind = 'trivia';
      ev.trivia = { q: d.item.q, options, right: options.indexOf(d.item.options[0]) };
    }
  }
  s.event = ev;
}

function roll(s: State): void {
  if (!s.board || s.board.phase !== 'roll') return;
  s.board = reduceBoard(s.board, { type: 'roll', value: 1 + (nextRandom(s) % 6) });
  s.rolls++;
  if (s.board.phase === 'event') prepareEvent(s);
}

function resolve(s: State, ok: boolean, extra: { swapWith?: string; winnerId?: string } = {}): void {
  if (!s.board || s.board.phase !== 'event') return;
  s.board = reduceBoard(s.board, { type: 'resolve', ok, ...extra });
  s.event = null;
}

/** What happens when the player whose turn it is does nothing (or is away). */
function resolveDefault(s: State): void {
  const kind = s.event?.kind ?? s.board?.tiles[s.board.landed]?.kind;
  if (s.event?.trivia && s.event.picked !== null) return resolve(s, s.event.picked === s.event.trivia.right);
  resolve(s, kind !== undefined && (MOVES.includes(kind) || kind === 'swap'));
}

function finish(s: State): void {
  const b = s.board!;
  const winner = Number(b.winner);
  const seat = seatByN(s, winner);
  if (seat) seat.score++;
  s.result = { winner, standings: standings(b).map(Number), awards: boardAwards(b).map((a) => ({ title: a.title, n: Number(a.playerId), why: a.why })) };
  s.phase = 'result';
  s.deadline = null;
  s.event = null;
}

/** After any change: play for away players, end the game, and set the clock for the next step. */
function settle(s: State, now: number): void {
  if (s.phase !== 'play' || !s.board) return;
  const order = s.board.order.map(Number);
  if (order.filter((n) => isHere(s, n)).length < 1 || online(s).length < 2) {
    s.phase = 'lobby';
    s.deadline = null;
    return;
  }
  for (let guard = 0; guard < 60; guard++) {
    const cur = current(s);
    if (cur === null || isHere(s, cur)) break;
    if (s.board.phase === 'roll') roll(s);
    else resolveDefault(s);
  }
  if (s.board.phase === 'done') return finish(s);
  if (s.board.phase === 'roll') s.deadline = now + ROLL_SECONDS * 1000;
  else {
    const kind = s.event?.kind ?? 'card';
    if (s.event && s.event.picked !== null) return;
    s.deadline = now + (MOVES.includes(kind) ? MOVE_SECONDS : kind === 'swap' ? SWAP_SECONDS : kind === 'trivia' ? TRIVIA_SECONDS : CARD_SECONDS) * 1000;
  }
}

export function tick(s: State, now: number): void {
  if (s.deadline === null || now < s.deadline || s.phase !== 'play' || !s.board) return;
  if (s.board.phase === 'roll') roll(s);
  else resolveDefault(s);
  settle(s, now);
  s.updated = now;
}

export type Action =
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'roll' }
  | { t: 'ok' }
  | { t: 'swap'; seat: number }
  | { t: 'done'; ok: boolean }
  | { t: 'winner'; seat: number }
  | { t: 'answer'; i: number }
  | { t: 'lobby' }
  | { t: 'kick'; seat: number };

export function act(s: State, key: string, a: Action, now: number): string | null {
  const me = seatOf(s, key);
  if (!me) return 'Join the room first.';
  const isHost = me.n === s.host;
  s.updated = now;
  const myTurn = s.phase === 'play' && current(s) === me.n;
  const kind = s.board?.phase === 'event' ? s.event?.kind : undefined;
  switch (a?.t) {
    case 'settings': {
      if (!isHost) return 'Only the host can change the settings.';
      if (s.phase === 'play') return 'Change settings between games.';
      const p = a.settings ?? {};
      if (SIZES.includes(p.size as BoardSize)) s.settings.size = p.size as BoardSize;
      if ((VIBES as readonly unknown[]).includes(p.vibe)) s.settings.vibe = p.vibe as Settings['vibe'];
      return null;
    }
    case 'start': {
      if (!isHost) return 'The host starts the game.';
      if (s.phase === 'play') return null;
      const seats = online(s);
      if (seats.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      for (const x of s.seats) x.waiting = false;
      const order = shuffle(seats.map((x) => String(x.n)), rng(nextRandom(s)));
      s.board = startBoard(makeBoard(s.settings.size, nextRandom(s)), order, nextRandom(s));
      s.event = null;
      s.result = null;
      s.rolls = 0;
      s.phase = 'play';
      settle(s, now);
      return null;
    }
    case 'roll':
      if (!myTurn || s.board?.phase !== 'roll') return null;
      roll(s);
      settle(s, now);
      return null;
    case 'ok':
      if (!myTurn || !kind || !(MOVES.includes(kind) || kind === 'swap')) return null;
      resolve(s, true);
      settle(s, now);
      return null;
    case 'swap':
      if (!myTurn || kind !== 'swap' || a.seat === me.n || !s.board!.order.includes(String(a.seat))) return null;
      resolve(s, true, { swapWith: String(a.seat) });
      settle(s, now);
      return null;
    case 'done':
      if (!myTurn || (kind !== 'card' && kind !== 'group') || typeof a.ok !== 'boolean') return null;
      resolve(s, a.ok);
      settle(s, now);
      return null;
    case 'winner':
      if (!myTurn || kind !== 'duel' || (a.seat !== me.n && a.seat !== s.event?.opponent)) return null;
      resolve(s, a.seat === me.n, { winnerId: String(a.seat) });
      settle(s, now);
      return null;
    case 'answer': {
      const t = s.event?.trivia;
      if (!myTurn || kind !== 'trivia' || !t || s.event!.picked !== null || !(a.i >= 0 && a.i < t.options.length)) return null;
      s.event!.picked = Math.floor(a.i);
      s.deadline = now + ANSWER_SHOW_MS;
      return null;
    }
    case 'lobby':
      if (!isHost) return null;
      s.phase = 'lobby';
      s.deadline = null;
      return null;
    case 'kick':
      if (kickSeat(s, me, a.seat)) settle(s, now);
      return null;
    default:
      return 'Unknown action.';
  }
}

export interface RoomView {
  game: 'board';
  code: string;
  phase: Phase;
  settings: Settings;
  players: SeatView[];
  you: number;
  host: boolean;
  deadline: number | null;
  /** Play and result. */
  board: {
    tiles: Tile[];
    order: number[];
    pos: Record<string, number>;
    current: number | null;
    step: 'roll' | 'event' | 'done';
    lastRoll: number;
    rolls: number;
    landed: number;
    turn: number;
  } | null;
  event: { kind: TileKind; text: string | null; note: string | null; opponent: number | null; trivia: { q: string; options: string[]; right: number | null } | null; picked: number | null } | null;
  result: State['result'];
}

export function viewFor(s: State, key: string): RoomView | null {
  const me = seatOf(s, key);
  if (!me) return null;
  const b = s.board;
  const ev = s.event;
  return {
    game: 'board',
    code: s.code,
    phase: s.phase,
    settings: s.settings,
    players: seatViews(s, me),
    you: me.n,
    host: me.n === s.host,
    deadline: s.deadline,
    board:
      b && s.phase !== 'lobby'
        ? { tiles: b.tiles, order: b.order.map(Number), pos: b.pos, current: current(s), step: b.phase, lastRoll: b.lastRoll, rolls: s.rolls, landed: b.landed, turn: b.turn }
        : null,
    event:
      ev && s.phase === 'play'
        ? { kind: ev.kind, text: ev.text, note: ev.note, opponent: ev.opponent, trivia: ev.trivia ? { q: ev.trivia.q, options: ev.trivia.options, right: ev.picked === null ? null : ev.trivia.right } : null, picked: ev.picked }
        : null,
    result: s.phase === 'result' ? s.result : null,
  };
}

export function summary(s: State) {
  return summaryOf(s, 'board', MAX_PLAYERS);
}
