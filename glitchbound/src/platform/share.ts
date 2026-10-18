/**
 * Shares text + link with the native share sheet when available, otherwise copies to the clipboard.
 * Returns what happened so the UI can confirm it.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface ShareData {
  title: string;
  text: string;
  url?: string;
  /** What the picture card shows, when it should differ from the text. */
  card?: ShareCard;
}

export interface ShareCard {
  /** Lines for the card instead of the text's own. */
  lines?: string[];
  /** Game tiles drawn on the card, each with a done (✓) or not yet (✗) badge: the Daily Sweep. */
  tiles?: { src: string; bg: string; done: boolean }[];
  /** The button text at the bottom of the card. */
  cta?: string;
}

/* The share sheet (components/ShareSheet.tsx) is mounted once by the app and opened from here. */
interface Pending {
  data: ShareData;
  resolve: (o: ShareOutcome) => void;
}
let pending: Pending | null = null;
let hosts = 0;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

export const shareRequests = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: (): Pending | null => pending,
  /** The sheet host announces itself; without one (tests, embeds) sharing falls back to copying. */
  attach(): () => void {
    hosts++;
    return () => {
      hosts--;
    };
  },
  finish(outcome: ShareOutcome): void {
    const p = pending;
    pending = null;
    emit();
    p?.resolve(outcome);
  },
};

/**
 * Opens the share sheet (picture card, platform picker, rich link). Resolves with what the player
 * did. Falls back to the device's own share sheet or the clipboard when the sheet isn't available.
 */
export function shareOrCopy(data: ShareData): Promise<ShareOutcome> {
  if (hosts > 0) {
    pending?.resolve('cancelled');
    return new Promise((resolve) => {
      pending = { data, resolve };
      emit();
    });
  }
  return shareDirect(data);
}

/** Copies text to the clipboard (with an old-browser fallback). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

export async function shareDirect(data: ShareData): Promise<ShareOutcome> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  // Native sheets are best on touch devices; desktop share dialogs are clumsy, so copy there.
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (nav?.share && coarse) {
    try {
      await nav.share({ title: data.title, text: data.text, url: data.url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  const text = data.url && !data.text.includes(data.url) ? `${data.text}\n${data.url}` : data.text;
  try {
    await nav?.clipboard.writeText(text);
    return 'copied';
  } catch {
    return legacyCopy(text) ? 'copied' : 'failed';
  }
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Friend challenge links carry only a number: /games/<slug>?beat=<score>. */
export function parseBeatParam(search: string): number | null {
  const raw = new URLSearchParams(search).get('beat');
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}
