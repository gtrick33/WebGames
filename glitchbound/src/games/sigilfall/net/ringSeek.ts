/**
 * A search for a match in The Ring, carried out (arena/queue.ts decides each step). It asks quick match for a room of
 * its format, sits down, and after that only does what `seekStep` says, four times a second and whenever the room
 * says something new. Once the host says go the room's word is handed over, and the search keeps the connection only
 * to notice the host walking out of a match they were running.
 */
import { quickMatch } from '../../../platform/rooms';
import { SEEK_MS, seekFacts, seekStep } from '../arena/queue';
import type { Format } from '../arena/ranks';
import { Link } from './link';
import type { Action, Pick, View } from './ringRoom';

export interface SeekLook {
  /** Whole seconds until the search settles for the computer. */
  left: number;
  /** Who else is in the room, by name. */
  others: string[];
  /** Both sides are full of people: the gates are about to open. */
  full: boolean;
}

export interface SeekHandlers {
  onLook(look: SeekLook): void;
  /** The host said go: the room's word, as in a room of friends, and the connection the match talks over. */
  onRun(v: View, link: Link<View, Action>): void;
  /** Nobody came, or rooms can't be reached: the computer's teams. */
  onBots(): void;
  onRelay(seat: number, d: unknown): void;
  /** Whoever was running the match left it. */
  onGone(): void;
}

export interface SeekOptions {
  format: Format;
  map: string;
  name: string;
  pick: Omit<Pick, 'team'>;
}

/** How many rooms a search will try before it just waits its time out. */
const MAX_ROOMS = 4;
/** The same word isn't sent to the room twice within this long (its answer is on the way). */
const RESEND_MS = 1_000;

export class Seek {
  private link: Link<View, Action> | null = null;
  private readonly since = Date.now();
  private timer = 0;
  private fullAt = 0;
  private wrongAt = 0;
  private skip: string[] = [];
  private said = '';
  private saidAt = 0;
  private shown = '';
  /** 'look' while searching, 'run' once the match began, 'over' when stopped. */
  private state: 'look' | 'run' | 'over' = 'look';
  private hostSeat = 0;

  constructor(
    private readonly o: SeekOptions,
    private readonly h: SeekHandlers,
  ) {
    this.timer = window.setInterval(() => this.tick(), 250);
    this.look([]);
    void this.find();
  }

  private async find(): Promise<void> {
    try {
      const found = await quickMatch('sigilfall-ring', this.skip, String(this.o.format));
      if (this.state !== 'look') return;
      const code = found.code;
      this.link = new Link<View, Action>(code, this.o.name, {
        onView: (v) => this.view(code, v),
        onRelay: (n, d) => this.h.onRelay(n, d),
        onState: (s) => {
          if (s !== 'gone' || this.link?.code !== code) return;
          if (this.state === 'run') this.gone();
          // (full, or closed, before it began: another one)
          else if (this.state === 'look') this.next();
        },
      });
    } catch {
      // rooms can't be reached: there is nobody to find
      if (this.state === 'look') this.bots();
    }
  }

  private view(code: string, v: View): void {
    if (this.link?.code !== code) return;
    if (this.state === 'run') {
      if (v.phase === 'run' && v.you !== this.hostSeat && !v.seats.some((s) => s.n === this.hostSeat)) this.gone();
      return;
    }
    this.tick();
  }

  private tick(): void {
    if (this.state !== 'look') return;
    const now = Date.now();
    const waited = now - this.since;
    const v = this.link?.view ?? null;
    if (!v || v.game !== 'sigilfall-ring') {
      this.look([]);
      if (waited >= SEEK_MS) this.bots();
      return;
    }
    if (v.phase === 'run') {
      // the host's word. (Seated without a side, in a room that went without us: not our match.)
      if (!v.seats.find((s) => s.n === v.you)?.pick) return this.next();
      this.state = 'run';
      this.hostSeat = v.host;
      window.clearInterval(this.timer);
      this.h.onRun(v, this.link!);
      return;
    }
    const f = seekFacts(v, this.o.format);
    this.fullAt = f.full ? this.fullAt || now : 0;
    this.wrongAt = f.wrong ? this.wrongAt || now : 0;
    this.look(f.others, f.full);
    // (the ground is the host's to choose, as the format is)
    if (f.host && !f.wrong && v.map !== this.o.map) this.say({ t: 'setup', format: this.o.format, map: this.o.map }, now);
    const step = seekStep(f, waited, this.fullAt ? now - this.fullAt : 0, this.wrongAt ? now - this.wrongAt : 0);
    if (step.do === 'setup') this.say({ t: 'setup', format: this.o.format, map: this.o.map }, now);
    else if (step.do === 'pick') this.say({ t: 'pick', pick: { ...this.o.pick, team: step.team } }, now);
    else if (step.do === 'start') this.say({ t: 'start' }, now);
    else if (step.do === 'bots') this.bots();
    else if (step.do === 'next') this.next();
  }

  private say(a: Action, now: number): void {
    const word = JSON.stringify(a);
    if (word === this.said && now - this.saidAt < RESEND_MS) return;
    this.said = word;
    this.saidAt = now;
    this.link?.send(a);
  }

  private look(others: string[], full = false): void {
    const look: SeekLook = { left: Math.max(0, Math.ceil((SEEK_MS - (Date.now() - this.since)) / 1000)), others, full };
    const sig = JSON.stringify(look);
    if (sig === this.shown) return;
    this.shown = sig;
    this.h.onLook(look);
  }

  /** This room is no use: leave it and ask for another (a few times; after that the search waits its time out). */
  private next(): void {
    const was = this.link;
    this.link = null;
    this.fullAt = 0;
    this.wrongAt = 0;
    this.said = '';
    if (was) {
      this.skip.push(was.code);
      was.send({ t: 'bye' });
      was.close();
    }
    if (this.skip.length <= MAX_ROOMS) void this.find();
  }

  private bots(): void {
    this.stop();
    this.h.onBots();
  }

  private gone(): void {
    this.stop();
    this.h.onGone();
  }

  /** Ends it: out of the room, and nothing more is heard from this search. */
  stop(): void {
    if (this.state === 'over') return;
    this.state = 'over';
    window.clearInterval(this.timer);
    const was = this.link;
    this.link = null;
    was?.send({ t: 'bye' });
    was?.close();
  }

  /**
   * The match is over and this end ran it: it stays in the room a little longer, so the last word reaches everyone
   * before their host is seen to leave.
   */
  stopSoon(ms = 3000): void {
    if (this.state === 'over') return;
    this.state = 'over';
    window.clearInterval(this.timer);
    const was = this.link;
    this.link = null;
    window.setTimeout(() => {
      was?.send({ t: 'bye' });
      was?.close();
    }, ms);
  }
}
