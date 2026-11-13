/**
 * When an open page asks the account again (platform/arrivals.ts), so a purchase the shop confirms, or something an admin
 * gives, arrives without a reload. Cheap by design: one small request a minute while the page is in view, one at once when
 * the player comes back to it, and a quick look every few seconds only for a few minutes after a checkout, stopping the
 * moment the item is there. Nothing while the page is hidden or the browser is offline; failures wait longer each time.
 *
 * Pure timing: what a look is and when one makes sense are given to it, so the tests can run it on a fake clock.
 */

export const POLL = {
  /** The usual pace, while the page is in view. */
  every: 60_000,
  /** After a checkout: this often... */
  burst: 4_000,
  /** ...for this long at most. */
  burstFor: 180_000,
  /** Failures double the wait, up to this. */
  slowest: 600_000,
  /** Coming back to the page looks at once, unless a look was this recent (focus and visibility come together). */
  gap: 10_000,
};

export interface PollDeps {
  /** One look: true when it worked (whatever it found), false when it failed. */
  check: () => Promise<boolean>;
  /** Whether a look makes sense now: a member, the page in view, the browser online. */
  can: () => boolean;
  now?: () => number;
}

export class AccountPoll {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private fails = 0;
  private last = 0;
  private burstUntil = 0;
  private burstDone: (() => boolean) | null = null;
  private readonly now: () => number;

  constructor(private readonly deps: PollDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** Looking fast, after a checkout: until `done` says the item is here, or the time is up. */
  bursting(): boolean {
    if (!this.burstDone || this.now() >= this.burstUntil || this.burstDone()) {
      this.burstDone = null;
      return false;
    }
    return true;
  }

  /** How long until the next look. */
  wait(): number {
    const base = this.bursting() ? POLL.burst : POLL.every;
    return Math.min(POLL.slowest, base * 2 ** Math.min(this.fails, 8));
  }

  /** The account was just read (a sign-in, the first load): the next look is a whole wait away. */
  seen(): void {
    this.last = this.now();
    this.plan();
  }

  /** Plans the next look, in place of any planned. Nothing while a look makes no sense: wake() starts it again. */
  plan(): void {
    this.clear();
    if (!this.deps.can()) return;
    this.timer = setTimeout(() => void this.look(), this.wait());
  }

  /** The page came back into view, or online: a look now, unless one was just made. */
  wake(): void {
    if (this.now() - this.last < POLL.gap) this.plan();
    else void this.look();
  }

  /** Looks every few seconds for a few minutes, until `done` (a look right away too). */
  burst(done: () => boolean): void {
    this.burstDone = done;
    this.burstUntil = this.now() + POLL.burstFor;
    this.fails = 0;
    if (this.deps.can()) void this.look();
  }

  stop(): void {
    this.clear();
    this.burstDone = null;
  }

  private clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private async look(): Promise<void> {
    this.clear();
    if (this.busy) return;
    if (!this.deps.can()) return;
    this.busy = true;
    this.last = this.now();
    const ok = await this.deps.check().catch(() => false);
    this.busy = false;
    this.fails = ok ? 0 : this.fails + 1;
    this.plan();
  }
}
