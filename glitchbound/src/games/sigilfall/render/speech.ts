/**
 * A spoken line as a card over the speaker's head, laid out in screen pixels (render/renderer.ts draws it): the
 * speaker's name, then their words, wrapped to what the screen has room for and never cut short (the old bubble
 * kept three lines of 34 letters and dropped the rest: a tenth of the story's lines lost their end). All of it
 * stays on the screen, clear of the bars along its edges, on a phone held either way.
 */

export interface SpeechCard {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  /** The words' size, the name's, and a line's height. */
  fs: number;
  nameFs: number;
  lineH: number;
  padX: number;
  padY: number;
  /** The baseline of the first line of words, and of the name over them. */
  textY: number;
  nameY: number;
  /** Where its tail points down to the speaker (null when it has been moved off them: it has no one to point at). */
  tailX: number | null;
  /** The tail points up instead, to a speaker the card stands under. */
  tailUp?: boolean;
  /** A subtitle in the lane along the bottom of the picture (placeSpeech), not a card over anyone. */
  lane?: boolean;
  /** Where placeSpeech put it, against its speaker, to be asked for again next frame (SpeechAsk.keep). */
  keep?: SpeechKeep;
  /**
   * What stands before the name and the words, from the card's padding: a portrait of the speaker (`face` a side) and
   * the gap after it, on a scene's line (POLISH_PLAN.md piece 12); 0 with none.
   */
  lead: number;
  face: number;
}

/**
 * Where a line was put, against its speaker: in the lane, or in one of the card's shapes moved (dx, dy) off where it
 * stands over their head (under their feet, `under`).
 */
export type SpeechKeep = { lane: true } | { lane?: false; shape: number; dx: number; dy: number; under: boolean };

/** A box on the view, in its CSS pixels: a card, or a piece of the HUD the picture's words keep clear of. */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Do two boxes meet (or come within `gap` of each other)? */
export const boxesMeet = (a: ViewBox, b: ViewBox, gap = 0): boolean => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

/** How a string is measured: its width at a size and a weight, in the same pixels as the view. */
export type Measure = (text: string, px: number, weight: number) => number;

/** A line of words broken where it must be to fit `maxW`, nothing left out. A word wider than the room keeps its line. */
export function wrapWords(text: string, maxW: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next) > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The words' size on a view: readable on a phone, not shouting on a desk. */
export const speechSize = (viewW: number, viewH: number): number => clamp(Math.min(viewW * 0.034, viewH * 0.037), 12, 15);

/**
 * Lays a line out over a head at (headX, headY). `top` and `bottom` are what the edges of the view keep for
 * themselves (a scene's bars, the HUD's rows), `left` and `right` what its sides do.
 */
export interface SpeechAsk {
  text: string;
  name: string;
  headX: number;
  headY: number;
  viewW: number;
  viewH: number;
  top: number;
  bottom: number;
  left?: number;
  right?: number;
  measure: Measure;
  /** Where the speaker's feet are on the screen, for a card that stands under them (placeSpeech). */
  footY?: number;
  /** A scene's line: the one being read, placed first and never sent to the lane. */
  staged?: boolean;
  /** How wide a card may grow against its usual measure (placeSpeech tries wider and narrower ones where it is crowded). */
  wide?: number;
  /** Smaller words, a last resort where the picture is crowded (placeSpeech). */
  small?: boolean;
  /** A foe's bark: where no place is free it gives way (it isn't drawn) rather than lie over a line that matters. */
  minor?: boolean;
  /** A portrait of the speaker beside their words, this many pixels a side (a scene's line: POLISH_PLAN.md piece 12). */
  face?: number;
  /** Where this line was last frame (SpeechCard.keep): kept while it is still free, so the card doesn't jump about. */
  keep?: SpeechKeep;
}

export function layoutSpeech(o: SpeechAsk): SpeechCard {
  const fs = o.small ? Math.max(11, Math.round(speechSize(o.viewW, o.viewH) * 0.84)) : speechSize(o.viewW, o.viewH);
  const nameFs = Math.round(fs * 0.82 * 10) / 10;
  const lineH = Math.round(fs * 1.32);
  const padX = Math.round(fs * 0.8);
  const padY = Math.round(fs * 0.6);
  // (what the sides of the view keep for themselves: a phone's stick on the left and its skills on the right, while
  // the hero is playing)
  const left = Math.max(8, o.left ?? 8);
  const right = Math.max(8, o.right ?? 8);
  // (a little kept at the right of the card for the mark that the next line can be taken: on a one-line card it
  // sat on the last letter)
  const mark = Math.round(fs * 0.75);
  // (a portrait before the words, where there is room for one beside them: on a narrow view it is left out)
  const face0 = o.face && o.viewW - left - right > o.face * 5 ? Math.round(o.face) : 0;
  const lead = face0 ? face0 + Math.round(fs * 0.7) : 0;
  const room = Math.max(96, Math.min(o.viewW - left - right - padX * 2 - mark - lead, fs * 21 * (o.wide ?? 1)));
  const lines = wrapWords(o.text, room, (s) => o.measure(s, fs, 600));
  const nameW = o.name ? o.measure(o.name, nameFs, 800) : 0;
  const nameH = o.name ? Math.round(nameFs * 1.35) : 0;
  const wide = Math.max(nameW, ...lines.map((l) => o.measure(l, fs, 600)), fs * 4);
  const w = Math.min(o.viewW - left - right, Math.ceil(wide) + padX * 2 + mark + lead);
  const words = padY * 2 + nameH + lines.length * lineH;
  const h = face0 ? Math.max(words, face0 + Math.round(padY * 1.4)) : words;
  let x = o.headX - w / 2;
  let y = o.headY - 12 - h;
  const x0 = clamp(x, left, Math.max(left, o.viewW - right - w));
  const y0 = clamp(y, o.top + 4, Math.max(o.top + 4, o.viewH - o.bottom - 4 - h - 8));
  const moved = Math.abs(y0 - y) > 1;
  x = x0;
  y = y0;
  const tailX = !moved && o.headX > x + 12 && o.headX < x + w - 12 ? o.headX : null;
  // (the words stand in the middle of a card a portrait made taller)
  const top = y + Math.round((h - words) / 2) + padY;
  return { x, y, w, h, lines, fs, nameFs, lineH, padX, padY, textY: top + nameH + Math.round(fs * 0.98), nameY: top + nameFs * 0.86, tailX, lead, face: face0 };
}

/** The pieces of the HUD a spoken line looks out for (ui/hudBoxes.ts measures them; a piece not on the screen is absent). */
const TAKEN = ['quest', 'map', 'thumbs', 'potion', 'mount'] as const;

/**
 * A line laid out as `layoutSpeech` does, then moved off the quest if it would be written across it. On a phone held
 * on its side the quest sits under the hero's bars and reaches into the open middle the words are kept to, so a shout
 * from the left of the picture covered the end of the objective. The line goes beside the quest instead: along the
 * top of the picture as far as the map when it stays above the thumb's buttons, else only as far as those buttons, if
 * that doesn't break it into a column. Where neither fits the line stays where it was, and the HUD lets the quest fade
 * while the words are up (ui/GameScreen.tsx Tracker).
 */
export function layoutSpeechClear(o: SpeechAsk, hud: ReadonlyMap<string, ViewBox> | null): SpeechCard {
  const card = layoutSpeech(o);
  const quest = hud?.get('quest');
  if (!hud || !quest || !boxesMeet(card, quest, 2)) return card;
  const mid = o.viewW / 2;
  const onLeft = (b: ViewBox): boolean => b.x + b.w / 2 < mid;
  const map = hud.get('map');
  const thumbs = hud.get('thumbs');
  const questLeft = onLeft(quest);
  const left = questLeft ? quest.x + quest.w + 6 : map && onLeft(map) ? map.x + map.w + 12 : 8;
  const right = questLeft ? (map && !onLeft(map) ? o.viewW - map.x + 12 : 8) : o.viewW - quest.x + 6;
  const short = thumbs && questLeft !== onLeft(thumbs) ? (questLeft ? { left, right: o.viewW - thumbs.x + 6 } : { left: thumbs.x + thumbs.w + 6, right }) : null;
  const taken = TAKEN.map((k) => hud.get(k)).filter((b): b is ViewBox => !!b);
  for (const side of [{ left, right }, short]) {
    if (!side) continue;
    const beside = layoutSpeech({ ...o, ...side });
    if (beside.lines.length <= card.lines.length + 1 && !taken.some((b) => boxesMeet(beside, b, 2))) return beside;
  }
  return card;
}

/**
 * Where the picture has room for words (POLISH_PLAN.md piece 2: one owner for the screen). The HUD's pieces are drawn
 * over the picture, so words under any of them are words lost; the fight is the hero and the foes on them, and a card
 * written across it hides the blow it warns of.
 */
export interface SpeechRoom {
  /** Every piece of the HUD on the screen (ui/hudBoxes.ts measures them). */
  hud: readonly ViewBox[];
  /** Where the fight is: the hero and the foes about them (null in a scene, or with nobody near). */
  action: ViewBox | null;
  /**
   * The lane along the bottom of the picture where words go as subtitles in a fight: between `left` and `right`,
   * standing on `bottom` (null in a scene: its bars keep the words).
   */
  lane: { left: number; right: number; bottom: number } | null;
  /** A fight is on: what is shouted in it goes to the lane first, off the fight. */
  fight: boolean;
}

/** A card moved to (x, y), its words with it; its tail kept only if it still stands over (or under) its speaker. */
function moveCard(c: SpeechCard, x: number, y: number, tailX: number | null, tailUp = false): SpeechCard {
  return { ...c, x, y, textY: c.textY - c.y + y, nameY: c.nameY - c.y + y, tailX, tailUp };
}

/**
 * The same line as a small card in the lane: a scene's card made smaller (its speaker's face, their name, the words in
 * a smaller hand), as wide as the lane lets it be, no tail (placed by packLane). The owner, 2026-11-20: the bubbles
 * over heads are hard to follow; the lines said outside a scene stand still, centered, as a cutscene's do but smaller.
 */
function laneSized(o: SpeechAsk, lane: NonNullable<SpeechRoom['lane']>): SpeechCard {
  const wide = Math.max(120, lane.right - lane.left);
  return layoutSpeech({ ...o, small: true, headX: (lane.left + lane.right) / 2, headY: o.viewH / 2, left: lane.left, right: o.viewW - lane.left - wide });
}

/**
 * The subtitles of a fight laid out together in the lane, as a reader takes them: side by side along its bottom row
 * while they fit, each row centered, the next row above. Each line's spot, by its place in `cards` (none can meet
 * another: they are packed).
 */
function packLane(cards: readonly SpeechCard[], lane: NonNullable<SpeechRoom['lane']>): SpeechCard[] {
  const rows: number[][] = [[]];
  const room = lane.right - lane.left;
  let used = 0;
  cards.forEach((c, i) => {
    const row = rows[rows.length - 1]!;
    if (row.length && used + 8 + c.w > room) {
      rows.push([i]);
      used = c.w;
    } else {
      row.push(i);
      used += (row.length > 1 ? 8 : 0) + c.w;
    }
  });
  const out: SpeechCard[] = new Array(cards.length);
  let bottom = lane.bottom;
  for (const row of rows) {
    const wide = row.reduce((n, i) => n + cards[i]!.w, 0) + 8 * (row.length - 1);
    const tall = Math.max(...row.map((i) => cards[i]!.h));
    let x = Math.max(lane.left, (lane.left + lane.right) / 2 - wide / 2);
    for (const i of row) {
      const c = cards[i]!;
      out[i] = { ...moveCard(c, x, bottom - c.h, null), lane: true };
      x += c.w + 8;
    }
    bottom -= tall + 6;
  }
  return out;
}

/**
 * Every place a line could go, best first, made one at a time as they are asked for (placeSpeech stops at the first
 * that is free: over the head, most often, so the rest are never made).
 */
function* candidates(o: SpeechAsk, room: SpeechRoom, hudMap: ReadonlyMap<string, ViewBox> | null, spot: SpeechCard | undefined): Generator<SpeechCard> {
  const over = layoutSpeech(o);
  if (room.fight && spot) yield spot;
  yield over;
  // (beside the quest, as layoutSpeechClear lays it: a phone on its side)
  if (hudMap) {
    const beside = layoutSpeechClear(o, hudMap);
    if (beside !== over) yield beside;
  }
  // round the head, nearest first: a step sideways costs less than a step up, and a step up less than going under
  const step = over.h * 0.5 + 6;
  const near: [dx: number, dy: number, cost: number][] = [];
  for (let dy = -4; dy <= 6; dy++) for (let dx = -12; dx <= 12; dx++) if (dx || dy) near.push([dx, dy, Math.abs(dx) * 40 + Math.abs(dy) * step * (dy > 0 ? 3 : 1.5)]);
  // (under the feet, the tail up to them: dy is 99)
  if (o.footY !== undefined) for (let dx = -8; dx <= 8; dx++) near.push([dx, 99, 2 * step + Math.abs(dx) * 40]);
  near.sort((a, b) => a[2] - b[2]);
  for (const [dx, dy] of near) {
    const x = clamp(over.x + dx * 40, 2, o.viewW - 2 - over.w);
    const onHead = o.headX > x + 12 && o.headX < x + over.w - 12;
    if (dy === 99) yield moveCard(over, x, o.footY! + 10, onHead ? o.headX : null, true);
    else yield moveCard(over, x, over.y + dy * step, dy === 0 && over.tailX !== null && onHead ? o.headX : null);
  }
  if (!room.fight && spot) yield spot;
}

/** The first of `tries` that passes `ok`. */
function first(tries: Iterable<SpeechCard>, ok: (c: SpeechCard) => boolean): SpeechCard | undefined {
  for (const c of tries) if (ok(c)) return c;
  return undefined;
}

/**
 * Where each spoken line goes, all of them at once so none is written over another or under the HUD. A scene's line is
 * placed first. Each takes the free place nearest over its speaker's head: there if it can (its tail on them), else
 * beside the quest (a phone on its side, where the quest reaches into the open middle), else the nearest spot round
 * the head that is clear, over it, beside it or under the feet, and last the lane along the bottom. In a fight a line
 * that isn't a scene's goes to the lane first, so the blows stay in sight. A place that would cover the fight is taken
 * only when no other is free; where nothing at all is free a foe's bark gives way (null: not drawn while there is no
 * room for it), and any other line stays over the head, as it always was, and the HUD piece under it fades until it is
 * said (ui/GameScreen.tsx). The lines that matter (a scene's, a companion's, a townsperson's, the hero's) are placed
 * before the foes', so a crowd of barks never takes their room.
 */
export function placeSpeech(asks: readonly SpeechAsk[], room: SpeechRoom, hudMap: ReadonlyMap<string, ViewBox> | null = null): (SpeechCard | null)[] {
  const out: (SpeechCard | null)[] = new Array(asks.length);
  const placed: ViewBox[] = [];
  const rank = (o: SpeechAsk): number => (o.staged ? 0 : o.minor ? 2 : 1);
  const order = asks.map((_, i) => i).sort((i, j) => rank(asks[i]!) - rank(asks[j]!));
  // the lane's spots, for every line that isn't a scene's: packed together, so in a fight they sit side by side
  const shouts = asks.map((o, i) => (room.lane && !o.staged ? i : -1)).filter((i) => i >= 0);
  const packed = room.lane ? packLane(shouts.map((i) => laneSized(asks[i]!, room.lane!)), room.lane) : [];
  const laneOf = new Map(shouts.map((i, k) => [i, packed[k]!]));
  for (const i of order) {
    const o = asks[i]!;
    const spot = laneOf.get(i);
    const inView = (c: ViewBox): boolean => c.x >= 2 && c.x + c.w <= o.viewW - 2 && c.y >= o.top && c.y + c.h <= o.viewH - 2;
    const free = (c: ViewBox): boolean => inView(c) && !room.hud.some((b) => boxesMeet(c, b, 4)) && !placed.some((b) => boxesMeet(c, b, 6));
    const calm = (c: ViewBox): boolean => !!o.staged || !room.action || !boxesMeet(c, room.action, 0);
    const over = layoutSpeech(o);
    // the card as it is first, then wider (fewer lines) and narrower (more) where it is crowded
    let pick: SpeechCard | undefined;
    let shaped = 0;
    const shapes: SpeechAsk[] = [o, { ...o, wide: 1.6 }, { ...o, wide: 0.7 }, { ...o, small: true, wide: 1.4 }];
    // where it was a moment ago, while that is still free: a card that took the best place each frame afresh jumped
    // from over a walking speaker's head to under their feet or down to the lane and back as they went, too fast to
    // be read (the owner: "their bubbles keep switching from top to bottom screen with their movement and i cant read
    // them"). It moves only when its place is taken, or would cover the fight with another free
    const kept = keptCard(o, shapes, spot);
    // (a line that isn't a scene's goes to its fixed card in the lane whenever that is free, in a fight or out of one)
    if (spot && free(spot)) pick = spot;
    if (!pick && kept && free(kept) && calm(kept)) pick = kept;
    for (let k = 0; k < shapes.length && !pick; k++) {
      pick = first(candidates(shapes[k]!, room, hudMap, spot), (c) => free(c) && calm(c));
      shaped = k;
    }
    if (!pick && kept && free(kept)) pick = kept;
    for (let k = 0; k < shapes.length && !pick; k++) {
      pick = first(candidates(shapes[k]!, room, hudMap, spot), free);
      shaped = k;
    }
    if (!pick && o.minor) {
      out[i] = null;
      continue;
    }
    // (nothing is free. Before it goes over the head whatever is there: a place that covers only the HUD, never
    // another line. A HUD piece under a line fades until it is said; two lines written over each other can't be read.
    // Seen on a phone with four people speaking at once at the great lamp: NINE_PLAN.md, the release bar)
    for (let k = 0; k < shapes.length && !pick; k++) {
      pick = first(candidates(shapes[k]!, room, hudMap, spot), (c) => inView(c) && !placed.some((b) => boxesMeet(c, b, 6)));
      shaped = k;
    }
    pick ??= over;
    if (pick === kept && o.keep) pick = { ...pick, keep: o.keep };
    else if (pick.lane) pick = { ...pick, keep: { lane: true } };
    else {
      const base = layoutSpeech(shapes[shaped]!);
      pick = { ...pick, keep: { shape: shaped, dx: pick.x - base.x, dy: pick.y - base.y, under: !!pick.tailUp } };
    }
    placed.push(pick);
    out[i] = pick;
  }
  return out;
}

/** The card where `o.keep` says it was, as its speaker stands now (the lane's spot for a subtitle), or none. */
function keptCard(o: SpeechAsk, shapes: readonly SpeechAsk[], spot: SpeechCard | undefined): SpeechCard | undefined {
  const k = o.keep;
  if (!k) return undefined;
  if (k.lane) return spot;
  const shape = shapes[k.shape];
  if (!shape) return undefined;
  const over = layoutSpeech(shape);
  const x = clamp(over.x + k.dx, 2, o.viewW - 2 - over.w);
  const onHead = o.headX > x + 12 && o.headX < x + over.w - 12;
  // (under the feet it stays under them, wherever they walk; over the head, it keeps its tail while it is still on them)
  if (k.under) return o.footY === undefined ? undefined : moveCard(over, x, o.footY + 10, onHead ? o.headX : null, true);
  return moveCard(over, x, over.y + k.dy, Math.abs(k.dy) < 1 && over.tailX !== null && onHead ? o.headX : null);
}
