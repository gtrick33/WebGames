/**
 * The small part of cloud saves that every page loads (the engine, platform/cloudSave.ts, loads only
 * for signed-in players). The game stage waits here so a game reads its save only after this device
 * has the account's latest copy, and it marks the game that is running, so a copy arriving from another
 * device is never written underneath a game in play (it is applied when the game closes).
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

export const isHeld = (slug: string | null): boolean => !!slug && held.has(slug);

/** Called with a game's slug when it stops running. */
export function onRelease(fn: (slug: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
