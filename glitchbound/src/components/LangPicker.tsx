import { useEffect, useRef, useState } from 'react';
import { LANGS, setLang, useLang, useT } from '../i18n';
import './LangPicker.css';

/** The header's language button: the current flag; opens the list of languages. */
export function LangPicker() {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]!;

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
    <div className="lang" ref={ref}>
      <button className="lang-btn" aria-expanded={open} aria-controls="lang-menu" aria-label={t('Language: {name}', { name: current.name })} title={current.name} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">{current.flag}</span>
        <span className="lang-code mono">{current.code.toUpperCase()}</span>
      </button>
      <ul id="lang-menu" className="lang-menu panel" hidden={!open} role="listbox" aria-label={t('Language')}>
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
              <span aria-hidden="true">{l.flag}</span> {l.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A plain language select (footer): always reachable, also on small phones. */
export function LangSelect() {
  const t = useT();
  const lang = useLang();
  return (
    <label className="lang-select">
      <span aria-hidden="true">🌐</span>
      <span className="sr-only">{t('Language')}</span>
      <select value={lang} onChange={(e) => void setLang(e.target.value as typeof lang)}>
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
