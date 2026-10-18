/**
 * After a deploy, a tab opened earlier still asks for the old build's code files, which are gone:
 * Safari says "Importing a module script failed", Chrome "Failed to fetch dynamically imported
 * module" (issues #15-#18). That is not a crash: reload once into the new build (at most once a
 * minute, so a real outage never loops) and keep it out of the crash reports.
 */
const KEY = 'glitchbound.freshReload';

export const isStaleBuildError = (e: unknown): boolean =>
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk/i.test(String((e as Error | undefined)?.message ?? e));

/** Reloads into the new build; false when it already tried in the last minute. */
export function reloadForNewBuild(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

/** Wraps a dynamic import: a missing file from an old build reloads the page instead of failing. */
export const fresh =
  <T,>(load: () => Promise<T>) =>
  (): Promise<T> =>
    load().catch((e: unknown) => {
      if (isStaleBuildError(e) && reloadForNewBuild()) return new Promise<T>(() => undefined);
      throw e;
    });
