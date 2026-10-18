/**
 * Opens the sign-in dialog from anywhere. The dialog itself (components/SignIn.tsx) loads the first
 * time it is needed, so the first visit does not download it; a request made before it is ready is
 * kept and replayed as soon as it mounts.
 */
type Opener = (reason?: string) => void;

const openers = new Set<Opener>();
let pending: { reason?: string } | null = null;
let loader: (() => void) | null = null;

export function openSignIn(reason?: string): void {
  if (openers.size === 0) {
    pending = { reason };
    loader?.();
    return;
  }
  openers.forEach((fn) => fn(reason));
}

/** The dialog registers here when it mounts (and gets any request that came first). */
export function onSignInOpen(fn: Opener): () => void {
  openers.add(fn);
  if (pending) {
    const p = pending;
    pending = null;
    fn(p.reason);
  }
  return () => {
    openers.delete(fn);
  };
}

/** The header tells us how to load the dialog. */
export function setSignInLoader(fn: (() => void) | null): void {
  loader = fn;
}
