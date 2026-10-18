import { useState } from 'react';
import { useLiveCatalog } from '../platform/liveCatalog';
import { Link } from '../router/router';
import { Icon } from './Icon';
import './NoticeBanner.css';

const KEY = 'glitchbound.noticeDismissed';

const readDismissed = (): string => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};

/** The admins' site-wide notice (set on /admin › Games). Dismissed per notice: a new one shows again. */
export function NoticeBanner() {
  const { raw } = useLiveCatalog();
  const [dismissed, setDismissed] = useState(readDismissed);
  const n = raw.notice;
  if (!n || dismissed === n.id) return null;
  const dismiss = (): void => {
    setDismissed(n.id);
    try {
      localStorage.setItem(KEY, n.id);
    } catch {
      /* blocked storage */
    }
  };
  const external = n.link.startsWith('https://');
  return (
    <div className={`notice-banner tone-${n.tone}`} role="status">
      <div className="wrap notice-inner">
        <span className="notice-icon" aria-hidden="true">
          <Icon name={n.tone === 'party' ? 'party' : n.tone === 'warning' ? 'bolt' : 'star'} size={18} />
        </span>
        <p className="notice-text">
          {n.text}
          {n.link &&
            (external ? (
              <a href={n.link} target="_blank" rel="noreferrer" className="notice-link">
                Learn more
              </a>
            ) : (
              <Link href={n.link} className="notice-link">
                Take a look
              </Link>
            ))}
        </p>
        <button className="notice-close" onClick={dismiss} aria-label="Dismiss this notice">
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
