/**
 * The small part of cloud saves that every page loads (the engine, platform/cloudSave.ts, loads only
 * for signed-in players). The game stage waits here so a game reads its save only after this device
 * has the account's latest copy, and it marks the game that is running, so a copy arriving from another
 * device is never written underneath a game in play (it is applied when the game closes, or at once for
 * a game that takes copies while it runs: takeSavesLive).
 */

let open = true;
let gate: Promise<void> = Promise.resolve();

/**
 * The account store hands over work to wait for: first its sign-in check, then a member's first
 * download. The gate is closed until the latest work settles.
 */
export function setSavesGate(work: Promise<unknown>): void {
  open = false;
  const done = work.then(
    () => undefined,
    () => undefined,
  );
  gate = done;
  void done.then(() => {
    if (gate === done) open = true;
  });
}

/** True when the saves are already in place (the stage then skips its loading screen). */
export const savesAreReady = (): boolean => open;

/** Resolves when this device has the account's saves, or after `ms` at most (offline, slow network). */
export function savesReady(ms = 4000): Promise<void> {
  const settled = async (): Promise<void> => {
    // Work handed over while waiting (the sign-in check leads to the download) is waited for too.
    for (let g = gate; ; g = gate) {
      await g;
      if (g === gate) return;
    }
  };
  return Promise.race([settled(), new Promise<void>((r) => setTimeout(r, ms))]);
}

const held = new Map<string, number>();
const listeners = new Set<(slug: string) => void>();
/** Running games that take other devices' copies of their save live (takeSavesLive): how each reloads it. */
const live = new Map<string, () => void>();

/** Marks a game as running; the returned function ends that. */
export function holdGame(slug: string): () => void {
  held.set(slug, (held.get(slug) ?? 0) + 1);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const n = (held.get(slug) ?? 1) - 1;
    if (n > 0) held.set(slug, n);
    else {
      held.delete(slug);
      for (const fn of listeners) fn(slug);
    }
  };
}

/** Whether a copy from another device must wait for this game to close: it runs and can't take one live. */
export const isHeld = (slug: string | null): boolean => !!slug && held.has(slug) && !live.has(slug);

/** Called with a game's slug when copies held back for it can go in: it stopped running, or it takes them live. */
export function onRelease(fn: (slug: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * A running game that can take another device's copy of its save while it plays: the copy is merged
 * into its stored save at once and `fn` reloads it. A copy that waits for the game to close also keeps
 * this device's own changes to that save from going out until then, which a long session never does
 * (Launch Control's garage stays open, and a phone's tab is put away rather than closed): a car bought
 * there never reached the account (issue #44). Returns the function that ends it.
 */
export function takeSavesLive(slug: string, fn: () => void): () => void {
  live.set(slug, fn);
  // copies that waited for this game go in now
  for (const l of listeners) l(slug);
  return () => {
    if (live.get(slug) === fn) live.delete(slug);
  };
}

/** A newer copy of a game's save was put in place (platform/cloudSave.ts): the running game reloads it. */
export const saveArrived = (slug: string | null): void => live.get(slug ?? '')?.();
