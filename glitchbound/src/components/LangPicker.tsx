import { useEffect, useRef, useState } from 'react';
import { LANGS, setLang, useLang, useT } from '../i18n';
import { Flag } from './Flag';
import { Icon } from './Icon';
import './LangPicker.css';

/**
 * The language button and its list of languages. In the header: the flag and the language code; in the
 * footer (always there, also on small phones): the flag and the language's name, opening upwards.
 */
export function LangPicker({ variant = 'header' }: { variant?: 'header' | 'footer' }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]!;
  const menuId = `lang-menu-${variant}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`lang lang-${variant}`} ref={ref}>
      <button className="lang-btn" aria-expanded={open} aria-controls={menuId} aria-label={t('Language: {name}', { name: current.name })} title={current.name} onClick={() => setOpen((v) => !v)}>
        <Flag lang={current.code} />
        {variant === 'footer' ? (
          <>
            <span className="lang-name">{current.name}</span>
            <Icon name="chevronDown" size={16} />
          </>
        ) : (
          <span className="lang-code mono">{current.code.toUpperCase()}</span>
        )}
      </button>
      <ul id={menuId} className="lang-menu panel" hidden={!open} role="listbox" aria-label={t('Language')}>
        {LANGS.map((l) => (
          <li key={l.code}>
            <button
              role="option"
              aria-selected={l.code === lang}
              className={`lang-item${l.code === lang ? ' is-on' : ''}`}
              onClick={() => {
                setOpen(false);
                void setLang(l.code);
              }}
            >
              <Flag lang={l.code} /> {l.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
