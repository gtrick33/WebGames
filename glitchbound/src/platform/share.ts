/**
 * Shares text + link with the native share sheet when available, otherwise copies to the clipboard.
 * Returns what happened so the UI can confirm it.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareOrCopy(data: { title: string; text: string; url?: string }): Promise<ShareOutcome> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  // Native sheets are best on touch devices; desktop share dialogs are clumsy, so copy there.
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (nav?.share && coarse) {
    try {
      await nav.share(data);
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
