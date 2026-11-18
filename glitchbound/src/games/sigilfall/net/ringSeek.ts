/**
 * A search for a match in The Ring, carried out (arena/queue.ts decides each step). It asks quick match for a room of
 * its format, sits down, and after that only does what `seekStep` says, four times a second and whenever the room
 * says something new. Once the host says go the room's word is handed over, and the search keeps the connection to
 * notice anyone leaving the match: it ends there for everyone else.
 */
import { ratedMatch } from '../../../platform/rooms';
import { DROP_MS, FOUND_MS, leftBehind, SEEK_MS, seekFacts, seekStep } from '../arena/queue';
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
  /** A party's search called off: by its leader (`why` empty), or because the room wouldn't take it into the queue. */
  onCancel?(why?: string): void;
  onLook(look: SeekLook): void;
  /** The host said go: the room's word, as in a room of friends, and the connection the match talks over. */
  onRun(v: View, link: Link<View, Action>): void;
  /** Nobody came, or rooms can't be reached: the computer's teams. */
  onBots(): void;
  onRelay(seat: number, d: unknown): void;
  /** Someone else left the match (or its room can't be reached any more): it is over, and nothing changes. */
  onGone(): void;
}

export interface SeekOptions {
  format: Format;
  map: string;
  name: string;
  pick: Omit<Pick, 'team'>;
  /**
   * A party's own room, already joined (arena/queue.ts): the search waits in it instead of looking for one. Its leader
   * puts it in the ranked queue at `rating` (arena/ranked.ts partyRating) and starts it; the others only wait for it.
   * The room stays the party's when the search ends: it is never left.
   */
  party?: Link<View, Action>;
  rating?: number;
}

/** A name for this device's searches (not the player's: only so the queue doesn't count their own last search as someone else). */
function searcherId(): string {
  const make = (): string => Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  try {
    const kept = localStorage.getItem('sigilfall.ring.who');
    if (kept && /^[a-z0-9]{6,24}$/.test(kept)) return kept;
    const id = make();
    localStorage.setItem('sigilfall.ring.who', id);
    return id;
  } catch {
    return (memo ??= make());
  }
}
let memo: string | undefined;

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
  /** The seats that were in the match when it began, since when each has been without its connection, and our own. */
  private runSeats: number[] = [];
  private away = new Map<number, number>();
  private downSince = 0;

  constructor(
    private readonly o: SeekOptions,
    private readonly h: SeekHandlers,
  ) {
    this.timer = window.setInterval(() => this.tick(), 250);
    this.look([]);
    if (o.party) {
      this.link = o.party;
      // (a party's last match is still in its room's word until its leader ends it: only a later one is this search's)
      this.runBefore = o.party.view?.run ?? 0;
      this.tick();
    } else void this.find();
  }
  private runBefore = 0;

  /** The party's room said something new (its owner passes it on: the room's handlers are its own). */
  seen(): void {
    if (this.o.party) this.view(this.o.party.code);
  }

  private async find(): Promise<void> {
    try {
      // (rated: sent to players near this rating; nobody else around in this queue: the computer at once)
      const found = await ratedMatch('sigilfall-ring', this.skip, String(this.o.format), this.o.pick.rating ?? 1000, searcherId());
      if (this.state !== 'look') return;
      const code = found.code;
      if (code === null) return this.bots();
      const handlers = {
        onView: () => this.view(code),
        onRelay: (n: number, d: unknown) => this.h.onRelay(n, d),
        onState: (s: string) => {
          if (s !== 'gone' || this.link?.code !== code) return;
          if (this.state === 'run') this.gone();
          // (full, or closed, before it began: another one)
          else if (this.state === 'look') this.next();
        },
      };
      // (with the room's door key: a ranked room takes nobody new without it while it waits)
      this.link = new Link<View, Action>(code, this.o.name, handlers, found.door);
    } catch {
      // rooms can't be reached: there is nobody to find
      if (this.state === 'look') this.bots();
    }
  }

  private view(code: string): void {
    if (this.link?.code !== code) return;
    if (this.state === 'run') this.watch();
    else this.tick();
  }

  /** While the match runs: has anyone left it? */
  private watch(): void {
    const link = this.link;
    const v = link?.view;
    if (this.state !== 'run' || !link || !v) return;
    const now = Date.now();
    this.downSince = link.open ? 0 : this.downSince || now;
    if (this.downSince) {
      // (our own connection: what the room last said is old news until it is back)
      if (now - this.downSince >= DROP_MS) this.gone();
      return;
    }
    // (a party's room goes back to its lobby as its match ends: that is the end of it, not someone leaving)
    if (v.phase !== 'run' && this.o.party) return this.stop();
    if (v.phase !== 'run' || leftBehind(v, this.runSeats, this.away, now)) this.gone();
  }

  /** A party's search, in its own room: the leader queues it and starts it; the others wait for the leader. */
  private partyTick(v: View, now: number, waited: number): void {
    const host = v.host === v.you;
    const f = seekFacts(v, this.o.format);
    this.fullAt = f.full ? this.fullAt || now : 0;
    this.look(f.others, f.full);
    if (!host) {
      // (the leader called it off: so does everyone else)
      if (v.queued === null && waited >= RESEND_MS * 2) {
        this.stop();
        this.h.onCancel?.();
      }
      return;
    }
    if (v.format !== this.o.format && v.queued === null) return this.say({ t: 'setup', format: this.o.format, map: this.o.map }, now);
    if (v.map !== this.o.map && v.queued === null) this.say({ t: 'setup', format: this.o.format, map: this.o.map }, now);
    if (v.queued === null) {
      // (a room with people on both sides is a custom game, and the queue won't take it)
      if (waited >= 3_000) {
        this.stop();
        this.h.onCancel?.('Your party can’t queue as it is: everyone in it has to be on one side, no more than the format holds.');
        return;
      }
      return this.say({ t: 'queue', on: true, rating: this.o.rating ?? this.o.pick.rating ?? 1000 }, now);
    }
    // both sides full of people: a moment to read who came, then the gates; the time up: the computer takes the rest
    if ((f.full && now - this.fullAt >= FOUND_MS) || waited >= SEEK_MS) this.say({ t: 'start' }, now);
  }

  private tick(): void {
    if (this.state !== 'look') return;
    const now = Date.now();
    const waited = now - this.since;
    const v = this.link?.view ?? null;
    if (this.o.party && v && v.game === 'sigilfall-ring' && v.phase === 'lobby') return this.partyTick(v, now, waited);
    // (the party's last match, not ended yet: wait for its leader to end it)
    if (this.o.party && v && v.phase === 'run' && v.run <= this.runBefore) return;
    if (!v || v.game !== 'sigilfall-ring') {
      this.look([]);
      // (a party never goes off on its own to fight the computer: its leader starts its match, with or without people)
      if (waited >= SEEK_MS && !this.o.party) this.bots();
      return;
    }
    if (v.phase === 'run') {
      // the host's word. (Seated without a side, in a room that went without us: not our match.)
      if (!v.seats.find((s) => s.n === v.you)?.pick) return this.next();
      this.state = 'run';
      this.runSeats = v.seats.filter((s) => s.pick).map((s) => s.n);
      window.clearInterval(this.timer);
      this.timer = window.setInterval(() => this.watch(), 1000);
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
    // (a party's room is its own: it is never given up for another)
    if (this.o.party) return this.stop();
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

  /** Ends it: out of the room (a party's own: out of the queue, and still in it), and nothing more is heard from it. */
  stop(): void {
    if (this.state === 'over') return;
    const looking = this.state === 'look';
    this.state = 'over';
    window.clearInterval(this.timer);
    const was = this.link;
    this.link = null;
    if (this.o.party) {
      if (looking && was?.view && was.view.host === was.view.you && was.view.queued !== null) was.send({ t: 'queue', on: false });
      return;
    }
    was?.send({ t: 'bye' });
    was?.close();
  }

  /**
   * The match is over and this end ran it: it stays in the room a little longer, so the last word reaches everyone
   * before their host is seen to leave.
   */
  stopSoon(ms = 3000): void {
    if (this.state === 'over') return;
    if (this.o.party) return this.stop();
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
