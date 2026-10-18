import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { t as tr, useT } from '../i18n';
import { getGame } from '../catalog/catalog';
import { getLiveCatalog } from '../platform/liveCatalog';
import { copyText, shareRequests, type ShareData, type ShareOutcome } from '../platform/share';
import { cardLines, renderShareCard } from '../platform/shareCard';
import './ShareSheet.css';

/**
 * The share sheet: a picture card of the result, a choice of where to send it, and a short link
 * that previews with the game's banner and the result as its title in chats and social apps.
 */

type Target = {
  id: string;
  label: string;
  color: string;
  icon: ReactNode;
  /** Only on phones (the app link does nothing on most computers). */
  mobileOnly?: boolean;
  href?: (text: string, url: string, title: string) => string;
};

const svg = (d: ReactNode): ReactNode => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor">
    {d}
  </svg>
);

const TARGETS: Target[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25d366',
    icon: svg(<path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5Zm0 2a7.5 7.5 0 1 1-3.9 13.9l-.3-.2-2.4.7.7-2.3-.2-.3A7.5 7.5 0 0 1 12 4.5Zm-3 3.6c-.3 0-.6.1-.9.5-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4.9 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4l-.4-.3-1.9-.9c-.3-.1-.5-.2-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a6.3 6.3 0 0 1-3.1-2.7c-.2-.4.2-.4.7-1.2.1-.2 0-.4 0-.5l-.9-2.1c-.2-.6-.4-.5-.6-.5H9Z" />),
    href: (text, url) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    id: 'messenger',
    label: 'Messenger',
    color: '#0a7cff',
    icon: svg(<path d="M12 2.5C6.7 2.5 2.5 6.4 2.5 11.6c0 2.8 1.3 5.2 3.3 6.9v3.2l3-1.7c1 .3 2.1.4 3.2.4 5.3 0 9.5-3.9 9.5-9.1S17.3 2.5 12 2.5Zm1 12.2-2.4-2.6-4.7 2.6 5.2-5.5 2.5 2.6 4.6-2.6-5.2 5.5Z" />),
    href: (_text, url) => `fb-messenger://share/?link=${encodeURIComponent(url)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#229ed9',
    icon: svg(<path d="m21.4 4.2-3.1 15c-.2 1-.9 1.3-1.8.8l-4.7-3.5-2.3 2.2c-.2.3-.5.5-1 .5l.3-4.8 8.8-7.9c.4-.3-.1-.5-.6-.2L6.2 13.2l-4.7-1.5c-1-.3-1-1 .2-1.5l18.3-7c.9-.3 1.6.2 1.4 1Z" />),
    href: (text, url) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'viber',
    label: 'Viber',
    color: '#7360f2',
    mobileOnly: true,
    icon: svg(<path d="M12 2.5c-4.3 0-8.5 1.4-8.5 7.5 0 3.3 1.2 5.4 3 6.5v3.8c0 .5.6.8 1 .4l2.6-2.6c.6.1 1.2.1 1.9.1 4.3 0 8.5-1.4 8.5-7.5S16.3 2.5 12 2.5Zm3.6 10.9c-.3.6-1 1.1-1.6 1.1-1.5-.1-4.9-2.8-5.6-4.6-.4-1 .2-1.9 1-2.2.4-.2.8 0 1 .3l.8 1.2c.2.4.1.8-.2 1l-.4.3c.4 1 1.3 1.8 2.3 2.2l.3-.4c.3-.3.7-.4 1-.2l1.2.8c.3.2.4.5.2.8Z" />),
    href: (text, url) => `viber://forward?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    id: 'sms',
    label: 'Messages',
    color: '#34c759',
    mobileOnly: true,
    icon: svg(<path d="M12 3C6.5 3 2.5 6.6 2.5 11c0 2.4 1.2 4.6 3.1 6l-.8 3.5 3.8-2c1.1.3 2.2.5 3.4.5 5.5 0 9.5-3.6 9.5-8S17.5 3 12 3Zm-4 9.4a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z" />),
    href: (text, url) => `sms:?&body=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    id: 'x',
    label: 'X',
    color: '#111',
    icon: svg(<path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.9 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.2 4.7H5.4l11.3 14.5Z" />),
    href: (text, url) => `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877f2',
    icon: svg(<path d="M13.5 21.5v-8h2.7l.4-3.2h-3.1V8.3c0-.9.3-1.5 1.6-1.5h1.6V4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H7.6v3.2h2.7v8h3.2Z" />),
    href: (_text, url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'email',
    label: 'Email',
    color: '#6b6a72',
    icon: svg(<path d="M3.5 5h17A1.5 1.5 0 0 1 22 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 17.5v-11A1.5 1.5 0 0 1 3.5 5Zm.5 2.3v9.7h16V7.3l-8 5.4-8-5.4ZM5.6 7h12.8L12 11.3 5.6 7Z" />),
    href: (text, url, title) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
];

const coarse = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** Short link for the share (made on the server so chat previews get the result as their title). */
async function shortLink(data: ShareData, lines: string[]): Promise<string | null> {
  try {
    const target = new URL(data.url ?? location.href, location.origin);
    if (target.origin !== location.origin) return null;
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: `${target.pathname}${target.search}`, title: lines[0] ?? data.title, description: lines.slice(1).join(' · ') }),
    });
    if (!res.ok) return null;
    const { code } = (await res.json()) as { code?: string };
    return code ? `${location.origin}/s/${code}` : null;
  } catch {
    return null;
  }
}

export default function ShareSheet({ data }: { data: ShareData }) {
  useT();
  const lines = useMemo(() => cardLines(data.text), [data.text]);
  const card = data.card;
  const game = useMemo(() => {
    const path = new URL(data.url ?? location.href, location.origin).pathname;
    const slug = /^\/games\/([a-z0-9-]+)/.exec(path)?.[1] ?? /^\/games\/([a-z0-9-]+)/.exec(location.pathname)?.[1];
    return slug ? getGame(slug, getLiveCatalog().all) : undefined;
  }, [data.url]);
  const [link, setLink] = useState<string | null>(null);
  const [picture, setPicture] = useState<{ blob: Blob; url: string } | null>(null);
  const [note, setNote] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const mobile = coarse();

  useEffect(() => {
    let live = true;
    const fallback = data.url ?? location.href;
    // Don't keep the player waiting for the short link: after 2.5 s use the normal one.
    const t = window.setTimeout(() => live && setLink((l) => l ?? fallback), 2500);
    void shortLink(data, lines).then((s) => live && setLink(s ?? fallback));
    let objectUrl = '';
    void renderShareCard({ game, lines: card?.lines ?? lines, cta: card?.cta, tiles: card?.tiles, site: location.host }).then((blob) => {
      if (!live || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setPicture({ blob, url: objectUrl });
    });
    closeRef.current?.focus();
    return () => {
      live = false;
      window.clearTimeout(t);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data, lines, game, card]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') shareRequests.finish('cancelled');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The message for apps: the text without its old link (the short link goes with it).
  const message = useMemo(
    () =>
      data.text
        .split('\n')
        .filter((l) => !/^https?:\/\//i.test(l.trim()))
        .join('\n')
        .trim(),
    [data.text],
  );
  const url = link ?? data.url ?? location.href;
  const done = (o: ShareOutcome, msg?: string): void => {
    if (msg) {
      setNote(msg);
      window.setTimeout(() => shareRequests.finish(o), 900);
    } else shareRequests.finish(o);
  };

  const fileName = game ? `${game.slug}-result.png` : card?.tiles ? 'glitchbound-daily-sweep.png' : 'glitchbound-result.png';
  const file = picture ? new File([picture.blob], fileName, { type: 'image/png' }) : null;
  const canSendPicture = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const sendPicture = async (): Promise<void> => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: `${message}\n${url}`, title: data.title });
      done('shared');
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setNote(tr('Could not send the picture. Try Save.'));
    }
  };
  const open = (t: Target): void => {
    if (!t.href) return;
    if (t.id === 'messenger' && !mobile) {
      // Messenger has no web share link without a Facebook app: copy, then open Messenger.
      void copyText(`${message}\n${url}`).then(() => {
        window.open('https://www.messenger.com/', '_blank', 'noopener');
        done('copied', tr('Copied: paste it in Messenger'));
      });
      return;
    }
    const href = t.href(message, url, data.title);
    if (href.startsWith('http')) window.open(href, '_blank', 'noopener,width=640,height=640');
    else window.location.assign(href);
    done('shared');
  };

  return (
    <div className="ss-backdrop" onClick={(e) => e.target === e.currentTarget && shareRequests.finish('cancelled')}>
      <div className="ss" role="dialog" aria-modal="true" aria-labelledby="ss-title">
        <div className="ss-head">
          <h2 id="ss-title">{game ? tr('Share {game}', { game: game.title }) : tr('Share')}</h2>
          <button ref={closeRef} className="ss-close" onClick={() => shareRequests.finish('cancelled')} aria-label={tr('Close')}>
            ✕
          </button>
        </div>
        <div className="ss-card">{picture ? <img src={picture.url} alt={(card?.lines ?? lines).join('. ')} /> : <div className="ss-card-loading">{tr('Drawing your card…')}</div>}</div>
        <div className="ss-side">
          {canSendPicture && (
            <button className="ss-primary" onClick={() => void sendPicture()}>
              {tr('Send picture + link')}
            </button>
          )}
          <div className="ss-grid" role="list">
            {TARGETS.filter((t) => !t.mobileOnly || mobile).map((t) => (
              <button key={t.id} role="listitem" className="ss-target" onClick={() => open(t)} disabled={!link}>
                <span className="ss-icon" style={{ background: t.color }}>
                  {t.icon}
                </span>
                <span>{tr(t.label)}</span>
              </button>
            ))}
            <button role="listitem" className="ss-target" disabled={!link} onClick={() => void copyText(`${message}\n${url}`).then((ok) => done(ok ? 'copied' : 'failed', ok ? tr('Copied!') : tr('Could not copy')))}>
              <span className="ss-icon" style={{ background: '#1d1238' }}>
                {svg(<path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0Zm-2.1 5.7a4 4 0 0 1-2.9-6.8l2.2-2.2a1 1 0 1 1 1.4 1.4L7 13.7a2 2 0 0 0 2.8 2.8l2.2-2.2a1 1 0 1 1 1.4 1.4l-2.2 2.2a4 4 0 0 1-2.7 1.2Zm7-6.4a1 1 0 0 1-.7-1.7l2.2-2.2A2 2 0 0 0 14.2 6L12 8.1a1 1 0 1 1-1.4-1.4l2.2-2.2a4 4 0 1 1 5.7 5.7l-2.2 2.2a1 1 0 0 1-.8.3Z" />)}
              </span>
              <span>{tr('Copy')}</span>
            </button>
            {picture && (
              <a role="listitem" className="ss-target" href={picture.url} download={fileName} onClick={() => done('shared')}>
                <span className="ss-icon" style={{ background: '#ff6a1a' }}>
                  {svg(<path d="M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4l2.3 2.3V4a1 1 0 0 1 1-1ZM5 19h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2Z" />)}
                </span>
                <span>{tr('Save')}</span>
              </a>
            )}
            {typeof navigator.share === 'function' && (
              <button
                role="listitem"
                className="ss-target"
                disabled={!link}
                onClick={() =>
                  void navigator.share({ title: data.title, text: message, url }).then(
                    () => done('shared'),
                    () => undefined,
                  )
                }
              >
                <span className="ss-icon" style={{ background: '#9a9aa6' }}>
                  {svg(<path d="M6 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />)}
                </span>
                <span>{tr('More')}</span>
              </button>
            )}
          </div>
        </div>
        <p className="ss-note" role="status">
          {note || (link ? link.replace(/^https?:\/\//, '') : tr('Making your link…'))}
        </p>
      </div>
    </div>
  );
}
