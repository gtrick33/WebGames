import { useId, type CSSProperties, type ReactNode } from 'react';

/**
 * Profile icons (src/catalog/looks.ts, kind 'icon'): emblems a member wears in place of their picture. Drawn here as
 * SVG on a 100×100 badge and colored only through --c1 … --c4 (the style's own colors are set in Looks.css), so an
 * admin's recolored icon needs no new art. --c1/--c2: the badge, --c3: the figure, --c4: its accent.
 */

const DARK = '#1d1238';
const fill = (v: string): CSSProperties => ({ fill: v });
const stop = (v: string): CSSProperties => ({ stopColor: v });

function Badge({ id, children }: { id: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" style={stop('var(--c1)')} />
          <stop offset="1" style={stop('var(--c2)')} />
        </linearGradient>
        <radialGradient id={`${id}sh`} cx="0.5" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${id}bg)`} />
      <circle cx="50" cy="50" r="50" fill={`url(#${id}sh)`} />
      {children}
    </svg>
  );
}

function Fox() {
  return (
    <>
      <path className="li-ear" d="M17 19 L43 37 L26 51 Z" style={fill('var(--c3)')} />
      <path d="M83 19 L57 37 L74 51 Z" style={fill('var(--c3)')} />
      <path d="M23 27 L36 38 L27 45 Z" fill={DARK} opacity="0.45" />
      <path d="M77 27 L64 38 L73 45 Z" fill={DARK} opacity="0.45" />
      <path d="M23 44 L50 35 L77 44 L71 65 L50 85 L29 65 Z" style={fill('var(--c3)')} />
      <path d="M23 50 L44 60 L50 85 L29 67 Z" style={fill('var(--c4)')} />
      <path d="M77 50 L56 60 L50 85 L71 67 Z" style={fill('var(--c4)')} />
      <path d="M50 35 L56 46 L50 52 L44 46 Z" style={fill('var(--c4)')} opacity="0.5" />
      <path d="M33 54 Q39 49 45 55 Q39 58 33 54 Z" fill={DARK} />
      <path d="M67 54 Q61 49 55 55 Q61 58 67 54 Z" fill={DARK} />
      <circle cx="40.5" cy="53.5" r="1.2" fill="#fff" />
      <circle cx="59.5" cy="53.5" r="1.2" fill="#fff" />
      <path d="M45.5 77 L54.5 77 L50 82.5 Z" fill={DARK} />
    </>
  );
}

function Owl() {
  return (
    <>
      <path d="M28 27 L40 38 Q50 33 60 38 L72 27 L72 53 Q73 81 50 87 Q27 81 28 53 Z" style={fill('var(--c3)')} />
      <ellipse cx="50" cy="72" rx="14" ry="12" style={fill('var(--c4)')} opacity="0.22" />
      <path d="M42 67 l3.5 3.5 l3.5 -3.5 M51 67 l3.5 3.5 l3.5 -3.5 M46.5 74 l3.5 3.5 l3.5 -3.5" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
      {[40.5, 59.5].map((x) => (
        <g key={x}>
          <circle cx={x} cy="52" r="10.5" fill="#fff" />
          <circle cx={x} cy="52" r="6.4" style={fill('var(--c4)')} />
          <circle cx={x} cy="52" r="3.2" fill={DARK} />
          <circle cx={x + 2} cy="50" r="1.3" fill="#fff" />
          <circle className="li-lid" cx={x} cy="52" r="10.8" style={fill('var(--c3)')} />
        </g>
      ))}
      <path d="M45.5 59 L54.5 59 L50 68 Z" fill="#ffb020" />
    </>
  );
}

function Skull({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}glow`}>
          <stop offset="0" style={stop('var(--c4)')} />
          <stop offset="1" style={stop('var(--c4)')} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M50 15 C28 15 18 31 18 47 C18 57 23 63 28.5 66 L28.5 75 Q28.5 81 34.5 81 L65.5 81 Q71.5 81 71.5 75 L71.5 66 C77 63 82 57 82 47 C82 31 72 15 50 15 Z" style={fill('var(--c3)')} />
      <path d="M66 20 C76 26 82 36 82 47 C82 57 77 63 71.5 66 L71.5 75 Q71.5 81 65.5 81 L60 81 C66 70 70 52 66 20 Z" fill={DARK} opacity="0.13" />
      <path d="M58 21 l-3 6 l4 3 l-2.5 5" fill="none" stroke={DARK} strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="38" cy="49" rx="8.6" ry="9.6" fill="#140a24" />
      <ellipse cx="62" cy="49" rx="8.6" ry="9.6" fill="#140a24" />
      <g className="li-glow">
        <circle cx="38" cy="50" r="9" fill={`url(#${id}glow)`} opacity="0.7" />
        <circle cx="62" cy="50" r="9" fill={`url(#${id}glow)`} opacity="0.7" />
        <circle cx="38" cy="50" r="3.4" style={fill('var(--c4)')} />
        <circle cx="62" cy="50" r="3.4" style={fill('var(--c4)')} />
      </g>
      <path d="M50 57 L45.5 65.5 L54.5 65.5 Z" fill="#140a24" />
      <path d="M33.5 70 H66.5" stroke="#140a24" strokeWidth="2" strokeLinecap="round" />
      <path d="M40.5 70 V79 M47 70 V79.5 M53 70 V79.5 M59.5 70 V79" stroke="#140a24" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function Rocket({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}fl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="0.35" stopColor="#ffc928" />
          <stop offset="0.75" style={stop('var(--c4)')} />
          <stop offset="1" style={stop('var(--c4)')} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="li-spark">
        <circle cx="20" cy="30" r="1.4" fill="#fff" />
        <circle cx="80" cy="66" r="1.2" fill="#fff" />
        <circle cx="72" cy="18" r="1" fill="#fff" />
      </g>
      <g transform="rotate(40 50 50)">
        <path className="li-flame" d="M41.5 66 Q50 98 58.5 66 Z" fill={`url(#${id}fl)`} />
        <path d="M38 50 L26 71 L39.5 66.5 Z" style={fill('var(--c4)')} />
        <path d="M62 50 L74 71 L60.5 66.5 Z" style={fill('var(--c4)')} />
        <path d="M50 11 C63.5 23 65.5 44 62 66 L38 66 C34.5 44 36.5 23 50 11 Z" style={fill('var(--c3)')} />
        <path d="M50 11 C63.5 23 65.5 44 62 66 L55 66 C58 44 57 23 50 11 Z" fill="#000" opacity="0.13" />
        <path d="M50 11 C55 16 58.5 21.5 60.2 27 L39.8 27 C41.5 21.5 45 16 50 11 Z" style={fill('var(--c4)')} />
        <circle cx="50" cy="42" r="7.8" fill={DARK} />
        <circle cx="50" cy="42" r="5.2" style={fill('var(--c2)')} />
        <circle cx="48.2" cy="40.2" r="1.6" fill="#fff" opacity="0.85" />
        <rect x="43" y="64.5" width="14" height="4.5" rx="1.6" fill="#3a3550" />
      </g>
    </>
  );
}

function Crown({ id }: { id: string }) {
  const sparkle = 'M0 -6 L1.4 -1.4 L6 0 L1.4 1.4 L0 6 L-1.4 1.4 L-6 0 L-1.4 -1.4 Z';
  return (
    <>
      <defs>
        <linearGradient id={`${id}au`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stop('color-mix(in srgb, var(--c3) 55%, #fff)')} />
          <stop offset="0.55" style={stop('var(--c3)')} />
          <stop offset="1" style={stop('color-mix(in srgb, var(--c3) 62%, #5a3000)')} />
        </linearGradient>
      </defs>
      <g className="li-bob">
        <path d="M20 66 L15.5 31 L34 47 L50 21 L66 47 L84.5 31 L80 66 Z" fill={`url(#${id}au)`} />
        <path d="M20 66 L15.5 31 L34 47 L50 21 L44 47 L30 58 Z" fill="#fff" opacity="0.16" />
        <rect x="18.5" y="62" width="63" height="14" rx="3.5" fill={`url(#${id}au)`} />
        <rect x="18.5" y="62" width="63" height="3" rx="1.5" fill="#fff" opacity="0.3" />
        <circle cx="15.5" cy="30" r="4.2" style={fill('var(--c3)')} />
        <circle cx="50" cy="20" r="4.8" style={fill('var(--c3)')} />
        <circle cx="84.5" cy="30" r="4.2" style={fill('var(--c3)')} />
        <circle cx="32" cy="69" r="3.6" style={fill('var(--c4)')} />
        <circle cx="68" cy="69" r="3.6" style={fill('var(--c4)')} />
        <path d="M50 63.5 L55 69 L50 74.5 L45 69 Z" style={fill('var(--c2)')} />
        <circle cx="31" cy="68" r="1.1" fill="#fff" />
        <circle cx="67" cy="68" r="1.1" fill="#fff" />
      </g>
      <path className="li-spark" d={sparkle} transform="translate(80 18)" fill="#fff" />
      <path className="li-spark li-spark-2" d={sparkle} transform="translate(22 78) scale(0.7)" fill="#fff" />
    </>
  );
}

function Bolt({ id }: { id: string }) {
  const bolt = 'M57 9 L26 55 L46 55 L38 91 L75 40 L54 40 L64 9 Z';
  return (
    <>
      <defs>
        <filter id={`${id}bl`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <linearGradient id={`${id}bo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={stop('color-mix(in srgb, var(--c3) 45%, #fff)')} />
          <stop offset="0.5" style={stop('var(--c3)')} />
          <stop offset="1" style={stop('color-mix(in srgb, var(--c3) 70%, #b06000)')} />
        </linearGradient>
      </defs>
      <path className="li-glow" d={bolt} style={fill('var(--c4)')} filter={`url(#${id}bl)`} />
      <g className="li-flicker">
        <path d={bolt} fill={`url(#${id}bo)`} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M24 30 l-6 -3 M80 62 l7 2 M76 26 l5 -5 M27 74 l-5 4" style={{ stroke: 'var(--c4)' }} strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </>
  );
}

/** The emblem of a profile icon style, or nothing for a style this build doesn't draw. */
export function LookIcon({ style }: { style: string }) {
  const id = `li${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const figure =
    style === 'fox' ? <Fox /> : style === 'owl' ? <Owl /> : style === 'skull' ? <Skull id={id} /> : style === 'rocket' ? <Rocket id={id} /> : style === 'crown' ? <Crown id={id} /> : style === 'bolt' ? <Bolt id={id} /> : null;
  return figure && <Badge id={id}>{figure}</Badge>;
}
