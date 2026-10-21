import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { Icon } from './Icon';
import './InstallPrompt.css';

const SEEN = 'glitchbound.installTip';

const seen = (): boolean => {
  try {
    return localStorage.getItem(SEEN) === '1';
  } catch {
    return true;
  }
};

/**
 * iPhone and iPad in Safari (not the installed app): once, a little while into a visit, how to play
 * full screen on every page and in every game: Share, then Add to Home Screen (Safari never lets a
 * website hide its bars itself). Out of the way while a game is pinned over the screen.
 */
export function InstallPrompt() {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (seen()) return;
    const id = window.setTimeout(() => setShow(true), 12_000);
    return () => window.clearTimeout(id);
  }, []);
  if (!show) return null;
  const done = (): void => {
    try {
      localStorage.setItem(SEEN, '1');
    } catch {
      /* storage blocked: it just shows again next visit */
    }
    setShow(false);
  };
  return (
    <aside className="ip" aria-label={t('Full screen app')}>
      <button className="ip-close" onClick={done} aria-label={t('Close')}>
        <Icon name="close" size={18} />
      </button>
      <strong className="ip-title">{t('Play full screen, without Safari’s bars')}</strong>
      <p className="ip-text">
        <Icon name="share" size={18} />
        <span>{t('Tap Share, then Add to Home Screen: GlitchBound opens full screen, without Safari’s bars.')}</span>
      </p>
      <button className="btn btn-sm btn-primary" onClick={done}>
        {t('Got it')}
      </button>
    </aside>
  );
}
