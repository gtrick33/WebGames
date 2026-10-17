import type { ReactNode } from 'react';
import type { GlyphId } from './targets';

/**
 * Original, simplified silhouettes (no real logos). Each draws its main body in `fill` with an ink
 * outline; small details are ink or white overlays so they read on any fill colour.
 */
const INK = '#14102a';

function shapes(id: GlyphId, f: string): ReactNode {
  const body = { fill: f, stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const line = { fill: 'none', stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const shine = { fill: '#fff', opacity: 0.55 };
  switch (id) {
    case 'octagon':
      return (
        <>
          <path {...body} d="M35 8h30l27 27v30L65 92H35L8 65V35z" />
          <path d="M37 16h26l21 21v26L63 84H37L16 63V37z" fill="none" stroke="#fff" strokeWidth="3" opacity="0.8" />
        </>
      );
    case 'bus':
      return (
        <>
          <rect {...body} x="8" y="22" width="84" height="50" rx="9" />
          <rect x="15" y="30" width="16" height="14" rx="3" fill="#cfe9ff" stroke={INK} strokeWidth="2.5" />
          <rect x="35" y="30" width="16" height="14" rx="3" fill="#cfe9ff" stroke={INK} strokeWidth="2.5" />
          <rect x="55" y="30" width="16" height="14" rx="3" fill="#cfe9ff" stroke={INK} strokeWidth="2.5" />
          <rect x="75" y="30" width="11" height="26" rx="3" fill="#cfe9ff" stroke={INK} strokeWidth="2.5" />
          <path d="M10 54h62" stroke={INK} strokeWidth="3" />
          <circle cx="27" cy="74" r="8" fill={INK} />
          <circle cx="72" cy="74" r="8" fill={INK} />
        </>
      );
    case 'bell':
      return (
        <>
          <path {...body} d="M50 12c-16 0-26 12-26 30v18l-9 12h70l-9-12V42c0-18-10-30-26-30z" />
          <circle cx="50" cy="80" r="7" fill={INK} />
          <path {...shine} d="M34 40c0-10 5-17 13-19-5 5-7 11-7 19v14h-6z" />
        </>
      );
    case 'cone':
      return (
        <>
          <path {...body} d="M42 10h16l20 72H22z" />
          <path d="M34 40h32l3 12H31zM29 60h42l3 11H26z" fill="#fff" opacity="0.9" />
          <rect {...body} x="12" y="80" width="76" height="10" rx="3" />
        </>
      );
    case 'bridge':
      return (
        <>
          <path {...line} d="M8 62Q30 64 30 18M30 18Q50 62 70 18M70 18Q70 64 92 62" />
          <rect {...body} x="25" y="12" width="10" height="72" rx="2" />
          <rect {...body} x="65" y="12" width="10" height="72" rx="2" />
          <rect {...body} x="4" y="60" width="92" height="8" rx="2" />
          <path d="M4 86c8-4 14 4 22 0s14 4 22 0 14 4 22 0 14 4 22 0" fill="none" stroke="#5fb4e8" strokeWidth="3.5" strokeLinecap="round" />
        </>
      );
    case 'car':
      return (
        <>
          <path {...body} d="M10 66V52l10-4 10-16h40l10 16 10 4v14z" />
          <rect {...body} x="40" y="20" width="20" height="9" rx="2" />
          <path d="M34 36h14v12H27zM52 36h14l7 12H52z" fill="#cfe9ff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M12 58h76" stroke={INK} strokeWidth="2.5" strokeDasharray="5 4" />
          <circle cx="28" cy="68" r="9" fill={INK} />
          <circle cx="72" cy="68" r="9" fill={INK} />
        </>
      );
    case 'ball':
      return (
        <>
          <circle {...body} cx="50" cy="50" r="40" />
          <path d="M18 26c18 10 18 38 0 48M82 26c-18 10-18 38 0 48" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
        </>
      );
    case 'sign':
      return (
        <>
          <rect x="46" y="66" width="8" height="28" fill={INK} />
          <rect {...body} x="8" y="14" width="84" height="56" rx="8" />
          <rect x="13" y="19" width="74" height="46" rx="5" fill="none" stroke="#fff" strokeWidth="2.5" />
          <path d="M28 42h36M52 30l14 12-14 12" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'mailbox':
      return (
        <>
          <path {...body} d="M26 92V34c0-14 10-24 24-24s24 10 24 24v58z" />
          <rect x="36" y="38" width="28" height="6" rx="3" fill={INK} />
          <path d="M26 30h48" stroke={INK} strokeWidth="3" />
          <rect x="38" y="56" width="24" height="14" rx="2" fill="#fff" opacity="0.85" />
        </>
      );
    case 'egg':
      return (
        <>
          <path {...body} d="M50 8C30 8 16 40 16 60c0 18 15 32 34 32s34-14 34-32C84 40 70 8 50 8z" />
          <ellipse {...shine} cx="36" cy="40" rx="6" ry="11" transform="rotate(20 36 40)" />
        </>
      );
    case 'feather':
      return (
        <>
          <path {...body} d="M82 10C48 12 22 36 18 72l10 0C40 52 60 30 82 10zM82 10C76 42 58 70 28 72" />
          <path {...line} d="M12 92 L48 46" />
          <path d="M40 54l-12-4M52 40l-12-6M46 62l12 2M58 48l12 2" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'fruit':
      return (
        <>
          <circle {...body} cx="50" cy="56" r="34" />
          <path {...line} d="M50 24c0-8 3-13 8-16" />
          <path {...body} d="M54 22c6-10 18-12 26-8-4 9-15 13-26 8z" fill="#4caf50" />
          <ellipse {...shine} cx="36" cy="44" rx="7" ry="11" transform="rotate(30 36 44)" />
        </>
      );
    case 'drop':
      return (
        <>
          <path {...body} d="M50 8C40 26 20 44 20 64c0 16 13 28 30 28s30-12 30-28C80 44 60 26 50 8z" />
          <path {...shine} d="M34 62c0-8 4-15 9-21-1 8-2 14 1 22-3 4-10 4-10-1z" />
        </>
      );
    case 'leaf':
      return (
        <>
          <path {...body} d="M14 86C10 46 40 14 88 12c2 46-28 76-74 74z" />
          <path {...line} d="M14 86C34 62 54 44 76 26M38 62l-2-18M52 48l-2-16M46 56l18 2M60 42l16 2" strokeWidth={2.8} />
        </>
      );
    case 'mug':
      return (
        <>
          <path {...line} d="M74 40h6c8 0 10 6 10 12s-4 14-14 14h-4" strokeWidth={5} />
          <path {...body} d="M14 30h62v40c0 12-8 20-20 20H34c-12 0-20-8-20-20z" />
          <path d="M34 8c-4 6 4 10 0 16M48 8c-4 6 4 10 0 16" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          <rect {...shine} x="22" y="38" width="6" height="28" rx="3" />
        </>
      );
    case 'bubble':
      return (
        <>
          <circle {...body} cx="50" cy="50" r="38" />
          <circle {...shine} cx="36" cy="34" r="9" />
          <circle {...shine} cx="60" cy="70" r="4" opacity={0.35} />
        </>
      );
    case 'can':
      return (
        <>
          <path {...body} d="M26 16h48v68c0 4-4 8-8 8H34c-4 0-8-4-8-8z" />
          <ellipse cx="50" cy="16" rx="24" ry="6" fill="#d8d8e4" stroke={INK} strokeWidth="3.5" />
          <path d="M26 38c12 6 36 6 48 0v16c-12 6-36 6-48 0z" fill="#fff" opacity="0.85" />
          <circle cx="50" cy="47" r="5" fill={f} stroke={INK} strokeWidth="2" />
        </>
      );
    case 'flower':
      return (
        <>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} {...body} cx="50" cy="26" rx="14" ry="20" transform={`rotate(${a} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="12" fill={INK} />
          <circle cx="46" cy="46" r="3" fill="#fff" opacity="0.5" />
        </>
      );
    case 'cloud':
      return (
        <>
          <path {...body} d="M26 76c-10 0-18-7-18-16 0-9 8-16 18-15 2-13 13-22 26-22 12 0 22 8 25 19 9 0 17 7 17 17s-8 17-18 17z" />
          <path {...shine} d="M30 54c2-8 8-14 16-16-4 4-7 9-7 16z" />
        </>
      );
    case 'canvas':
      return (
        <>
          <path {...line} d="M30 92l10-22M70 92L60 70M50 92V70" />
          <rect x="10" y="10" width="80" height="62" rx="3" fill="#f3e6c9" stroke={INK} strokeWidth="3.5" />
          <rect {...body} x="17" y="17" width="66" height="48" rx="1" strokeWidth={2.5} />
        </>
      );
    case 'gem':
      return (
        <>
          <path {...body} d="M28 14h44l20 24-42 50L8 38z" />
          <path d="M8 38h84M28 14l10 24 12 50 12-50 10-24M38 38l12-24 12 24" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path {...shine} d="M30 18l6 16H16z" />
        </>
      );
    case 'star':
      return (
        <>
          <path {...body} d="M50 8l12 26 28 3-21 19 6 28-25-14-25 14 6-28-21-19 28-3z" />
          <path {...shine} d="M50 22l5 12-5 4z" />
        </>
      );
    case 'tag':
      return (
        <>
          <path {...body} d="M12 30l18-18h56v76H30L12 70z" transform="rotate(-12 50 50)" />
          <circle cx="30" cy="50" r="6" fill="#fff" stroke={INK} strokeWidth="3" transform="rotate(-12 50 50)" />
          <path d="M46 40h28M46 52h22M46 64h26" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.5" transform="rotate(-12 50 50)" />
        </>
      );
    case 'medal':
      return (
        <>
          <path d="M30 6h14l10 34H40zM70 6H56L46 40h14z" fill="#3d5bff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <circle {...body} cx="50" cy="62" r="28" />
          <circle cx="50" cy="62" r="18" fill="none" stroke={INK} strokeWidth="2.5" opacity="0.5" />
          <path {...shine} d="M38 52c3-5 8-8 13-8-4 3-7 6-8 11z" />
        </>
      );
    case 'marker':
      return (
        <>
          <path {...body} d="M20 80l8-8 46-46 12 12-46 46-8 8z" />
          <path d="M20 80l-8 12 16-4z" fill={f} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M66 18l10-10 16 16-10 10z" fill={INK} />
          <path d="M34 66l36-36" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
        </>
      );
    case 'house':
      return (
        <>
          <path {...body} d="M14 46L50 14l36 32v44H14z" />
          <path d="M8 50L50 12l42 38" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="40" y="62" width="20" height="28" fill="#fff" stroke={INK} strokeWidth="3" />
          <path d="M40 62l20 28M60 62L40 90" stroke={INK} strokeWidth="2" />
          <rect x="22" y="52" width="12" height="12" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <rect x="66" y="52" width="12" height="12" fill="#fff" stroke={INK} strokeWidth="2.5" />
        </>
      );
    case 'pot':
      return (
        <>
          <path d="M50 34c-6-14-20-18-26-14 4 10 16 14 26 14zM50 34c6-16 22-20 28-16-4 12-18 16-28 16z" fill="#4caf50" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <rect {...body} x="16" y="34" width="68" height="14" rx="3" />
          <path {...body} d="M22 48h56l-8 42H30z" />
          <rect {...shine} x="30" y="54" width="5" height="28" rx="2.5" />
        </>
      );
    case 'fish':
      return (
        <>
          <path {...body} d="M66 50L92 28v44zM8 50c12-22 46-30 62 0-16 30-50 22-62 0z" />
          <circle cx="24" cy="46" r="4" fill={INK} />
          <path d="M38 36c6 8 6 20 0 28" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'bird':
      return (
        <>
          <path {...body} d="M30 40c0-16 12-26 26-26s24 10 24 24c0 6-2 10-4 13l14 25c-20 8-50 10-66 0-6-4-10-12-10-20 0-10 8-16 16-16z" />
          <path d="M80 34l14 6-14 6z" fill="#ff9a1a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="66" cy="32" r="4" fill={INK} />
          <path d="M34 58c8 10 22 12 34 6" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'popsicle':
      return (
        <>
          <rect x="44" y="64" width="12" height="30" rx="6" fill="#e2b77a" stroke={INK} strokeWidth="3" />
          <path {...body} d="M24 34c0-14 12-26 26-26s26 12 26 26v34c0 3-2 5-5 5H29c-3 0-5-2-5-5z" />
          <rect {...shine} x="32" y="22" width="6" height="38" rx="3" />
          <path d="M60 26v28" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
        </>
      );
    case 'moon':
      return (
        <>
          <path {...body} d="M62 8C40 10 16 28 16 54c0 22 18 38 40 38 14 0 26-6 34-18C58 82 36 60 40 36c2-12 10-22 22-28z" />
          <path d="M80 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM72 48l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#ffd12e" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        </>
      );
    case 'wave':
      return (
        <>
          <path {...body} d="M6 56c10-18 26-24 40-14 6-14 22-20 36-12-10 2-14 10-10 18 4 6 12 6 22 2v42H6z" />
          <path d="M14 74c8-4 14 4 22 0s14 4 22 0 14 4 22 0" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
        </>
      );
  }
}

export function Glyph({ id, fill, className, title }: { id: GlyphId; fill: string; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {shapes(id, fill)}
    </svg>
  );
}
