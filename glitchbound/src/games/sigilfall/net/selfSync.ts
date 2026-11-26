/**
 * A guest's own hero in a fight the host's game runs (The Ring, The Vigil): the guest's game moves it at once, and the
 * host's game has the last word. The host's word is old by the time it arrives: it says where the hero stood when the
 * host had had the guest's latest input for so long, and between far-apart friends that is 100 ms and more behind.
 * Pulled toward that place as it was, a running hero was dragged back all the time, snapped back after a dash, and slid
 * on after stopping.
 *
 * So the guest stamps each input it sends with a number (`stamp`), the host says with each word which input it last had
 * and how long it has had it (the room's relay keeps their order), and the guest compares the host's place with where
 * its own game had the hero at that same moment: send time plus how long the host had it, on the guest's own clock,
 * with no guess at the delay. Only a real difference (a knock, a root, a wall the host saw) moves the hero, eased in
 * over a few frames, or at once when it is large. Pure: the screens feed it the time and the places.
 */

/** Inputs and places kept this long (ms): far more than any round trip a fight survives. */
const KEEP_MS = 3000;
/** A difference smaller than this (px) is let be. */
const FINE = 0.75;
/** A difference larger than this (px) is made good at once (a knock, a pull, a blink the host's game gave). */
const SNAP = 64;
/** How fast a difference is eased in (per second). */
const EASE = 12;

export interface Spot {
  x: number;
  y: number;
}

/** What the host's game says of a guest's hero with its word: the input it last had (`q`) and for how long (ms). */
export type Ack = [seat: number, q: number, ageMs: number];

export class SelfSync {
  private seq = 0;
  private sent: { q: number; at: number }[] = [];
  /** Where this game had the hero, frame by frame, with any difference still being eased in already counted. */
  private hist: { at: number; x: number; y: number }[] = [];
  /** The difference still to be eased in. */
  private offX = 0;
  private offY = 0;

  /** Numbers an input about to be sent (at `now`, ms). */
  stamp(now: number): number {
    const q = ++this.seq;
    this.sent.push({ q, at: now });
    while (this.sent.length > 2 && now - this.sent[0]!.at > KEEP_MS) this.sent.shift();
    return q;
  }

  /** After the hero's own move each frame: eases in what is owed, and notes where the hero is. */
  frame(now: number, dt: number, hero: Spot): void {
    if (this.offX || this.offY) {
      const k = 1 - Math.exp(-EASE * Math.max(0, dt));
      const dx = this.offX * k;
      const dy = this.offY * k;
      hero.x += dx;
      hero.y += dy;
      this.offX -= dx;
      this.offY -= dy;
      if (Math.abs(this.offX) < 0.05 && Math.abs(this.offY) < 0.05) {
        hero.x += this.offX;
        hero.y += this.offY;
        this.offX = 0;
        this.offY = 0;
      }
    }
    this.hist.push({ at: now, x: hero.x + this.offX, y: hero.y + this.offY });
    while (this.hist.length > 2 && now - this.hist[0]!.at > KEEP_MS) this.hist.shift();
  }

  /**
   * The host's word: the hero stood at (hx, hy) when the host had had input `q` for `ageMs`. Moves the hero (now, or
   * eased in over the next frames) by how far that is from where this game had them at that moment. Returns the
   * difference found, or null when the input isn't known here (sent before a reconnect, or too long ago).
   */
  correct(q: number, ageMs: number, hx: number, hy: number, hero: Spot): Spot | null {
    const s = this.sent.find((x) => x.q === q);
    if (!s || !Number.isFinite(ageMs) || !Number.isFinite(hx) || !Number.isFinite(hy)) return null;
    const last = this.hist[this.hist.length - 1];
    if (!last) return null;
    const t = Math.min(last.at, s.at + Math.max(0, ageMs));
    const then = this.placeAt(t);
    if (!then) return null;
    const dx = hx - then.x;
    const dy = hy - then.y;
    const d = Math.hypot(dx, dy);
    if (d < FINE) return { x: 0, y: 0 };
    // everything noted since then was worked out from the wrong place: it moves as the hero will
    for (const h of this.hist) {
      if (h.at < t) continue;
      h.x += dx;
      h.y += dy;
    }
    if (d > SNAP) {
      hero.x += this.offX + dx;
      hero.y += this.offY + dy;
      this.offX = 0;
      this.offY = 0;
    } else {
      this.offX += dx;
      this.offY += dy;
    }
    return { x: dx, y: dy };
  }

  /** The hero was put somewhere outright (a new round, revived at a spot): what was kept no longer means anything. */
  reset(): void {
    this.hist = [];
    this.offX = 0;
    this.offY = 0;
  }

  /** Where this game had the hero at time `t` (ms), between the two notes either side of it. */
  private placeAt(t: number): Spot | null {
    const h = this.hist;
    if (!h.length || t < h[0]!.at) return null;
    for (let i = h.length - 1; i >= 0; i--) {
      const a = h[i]!;
      if (a.at > t) continue;
      const b = h[i + 1];
      if (!b || b.at === a.at) return { x: a.x, y: a.y };
      const k = (t - a.at) / (b.at - a.at);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    return null;
  }
}

/** The host's side: the last input each seat sent (its number) and when it came (performance.now). */
export class SeatInputs {
  private last = new Map<number, { q: number; at: number }>();

  /** An input arrived from a seat (`q` as the guest stamped it; anything else is ignored). */
  heard(seat: number, q: unknown, now: number): void {
    if (typeof q !== 'number' || !Number.isInteger(q) || q < 0) return;
    const was = this.last.get(seat);
    if (was && was.q >= q) return;
    this.last.set(seat, { q, at: now });
  }

  /** What goes with the host's word: each seat's last input and how long it has been had (ms, whole). */
  acks(now: number): Ack[] {
    return [...this.last].map(([seat, l]) => [seat, l.q, Math.round(now - l.at)]);
  }
}

/** A guest's own line in the host's word, if the host sent one (a host from before this sends none). */
export function ackFor(raw: unknown, seat: number): Ack | null {
  if (!Array.isArray(raw)) return null;
  for (const a of raw.slice(0, 8)) {
    if (!Array.isArray(a) || a[0] !== seat) continue;
    const [, q, age] = a as unknown[];
    if (typeof q === 'number' && typeof age === 'number' && Number.isFinite(q) && Number.isFinite(age)) return [seat, q, age];
  }
  return null;
}
