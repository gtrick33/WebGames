/**
 * After a deploy, a tab opened earlier still asks for the old build's code files, which are gone:
 * Safari says "Importing a module script failed", Chrome "Failed to fetch dynamically imported
 * module" (issues #15-#18). That is not a crash: reload once into the new build (at most once a
 * minute, so a real outage never loops) and keep it out of the crash reports.
 */
const KEY = 'glitchbound.freshReload';

export const isStaleBuildError = (e: unknown): boolean =>
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk/i.test(String((e as Error | undefined)?.message ?? e));

/** Set once this page has asked to reload: anything else that fails meanwhile just waits for it. */
let reloading = false;

/** Reloads into the new build; false when the previous page already tried in the last minute. */
export function reloadForNewBuild(): boolean {
  if (reloading) return true;
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  reloading = true;
  location.reload();
  return true;
}

/**
 * Vite's `vite:preloadError`: a file of an import is gone, so start loading the new build. The event
 * is never cancelled: cancelling makes Vite resolve the import with `undefined`, which React.lazy
 * then crashed on (issue #19). Left alone, the import fails with the stale-build error that every
 * `fresh()` import and the game stage already turn into a quiet wait for the reload.
 *
 * Vite sends the same event for anything an import's own promise fails with, not only a missing file:
 * `import('./x').then((m) => m.callTheApi())` arrives here with the API's error when that call fails. That is
 * not a deploy. Reloading for it restarted a slow first visit in the middle of a game's files and dropped the
 * Play from the address (found on a slow-4G run of Sigilfall, 2026-11-24). So the page reloads only when what
 * failed says a file is gone; an event that says nothing of its cause is treated as before.
 */
export const onPreloadError = (e?: Event): void => {
  const cause = (e as (Event & { payload?: unknown }) | undefined)?.payload;
  if (cause !== undefined && !isStaleBuildError(cause)) return;
  reloadForNewBuild();
};

/** Wraps a dynamic import: a missing file from an old build reloads the page instead of failing. */
export const fresh =
  <T,>(load: () => Promise<T>) =>
  (): Promise<T> =>
    load().catch((e: unknown) => {
      if (isStaleBuildError(e) && reloadForNewBuild()) return new Promise<T>(() => undefined);
      throw e;
    });
