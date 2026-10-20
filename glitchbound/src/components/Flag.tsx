import type { ReactNode } from 'react';
import type { Lang } from '../i18n';
import './Flag.css';

/**
 * Small flat flags for the language pickers. Flag emoji are not drawn on Windows (it shows the
 * letters "GB" instead), so the flags are drawn here, simplified, on a 30 x 20 canvas.
 */
const H = (a: string, b: string, c?: string): ReactNode =>
  c ? (
    <>
      <rect width="30" height="7" fill={a} />
      <rect y="6.67" width="30" height="7" fill={b} />
      <rect y="13.33" width="30" height="6.67" fill={c} />
    </>
  ) : (
    <>
      <rect width="30" height="10" fill={a} />
      <rect y="10" width="30" height="10" fill={b} />
    </>
  );
const V = (a: string, b: string, c: string): ReactNode => (
  <>
    <rect width="10" height="20" fill={a} />
    <rect x="10" width="10" height="20" fill={b} />
    <rect x="20" width="10" height="20" fill={c} />
  </>
);

const FLAGS: Record<Lang, ReactNode> = {
  en: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" strokeWidth="1.4" />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6.5" />
      <path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="3.6" />
    </>
  ),
  bg: H('#fff', '#00966e', '#d62612'),
  de: H('#000', '#dd0000', '#ffce00'),
  es: (
    <>
      <rect width="30" height="20" fill="#aa151b" />
      <rect y="5" width="30" height="10" fill="#f1bf00" />
    </>
  ),
  fr: V('#002395', '#fff', '#ed2939'),
  it: V('#009246', '#fff', '#ce2b37'),
  nl: H('#ae1c28', '#fff', '#21468b'),
  pl: H('#fff', '#dc143c'),
  pt: (
    <>
      <rect width="30" height="20" fill="#da291c" />
      <rect width="12" height="20" fill="#046a38" />
      <circle cx="12" cy="10" r="3.6" fill="none" stroke="#ffe900" strokeWidth="1.3" />
      <path d="M10.6 8.2h2.8v2.6a1.4 1.4 0 0 1-2.8 0z" fill="#fff" stroke="#da291c" strokeWidth=".7" />
    </>
  ),
  ro: V('#002b7f', '#fcd116', '#ce1126'),
  tr: (
    <>
      <rect width="30" height="20" fill="#e30a17" />
      <circle cx="10.5" cy="10" r="5" fill="#fff" />
      <circle cx="11.75" cy="10" r="4" fill="#e30a17" />
      <polygon points="15.3,7.6 15.84,9.26 17.58,9.26 16.18,10.28 16.71,11.94 15.3,10.92 13.89,11.94 14.43,10.28 13.02,9.26 14.76,9.26" fill="#fff" />
    </>
  ),
  uk: H('#0057b7', '#ffd700'),
};

export function Flag({ lang, size = 20 }: { lang: Lang; size?: number }) {
  return (
    <svg className="flag" viewBox="0 0 30 20" width={size} height={(size * 2) / 3} aria-hidden="true" focusable="false">
      {FLAGS[lang]}
    </svg>
  );
}
