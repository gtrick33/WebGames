import type { HolidayId } from '../platform/seasons';

/**
 * Holiday skins for the arcade and party pages: a little piece of art on every card and button
 * (Halloween cobwebs and dangling spiders, snow on top of everything at Christmas, hearts for
 * Valentine's...). The art lives here as SVG; where it sits and how it moves is in SeasonSkins.css.
 * `card` and `button` are CSS images (an SVG, or a gradient for light effects).
 */
export interface SeasonSkin {
  card: string;
  button: string;
}

const INK = '#1d1238';
const svg = (viewBox: string, body: string, extra = ''): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra}>${body}</svg>`;
export const svgUrl = (markup: string): string => `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;

/** A heart in a 24x23 box. */
const HEART = 'M12 21C12 21 2 14.5 2 8C2 4.7 4.6 2 7.8 2C9.7 2 11.2 3 12 4.4C12.8 3 14.3 2 16.2 2C19.4 2 22 4.7 22 8C22 14.5 12 21 12 21Z';
/** An egg around (0, 0). */
const EGG = 'M0 -13C6 -13 9 -3 9 3C9 9 5 13 0 13C-5 13 -9 9 -9 3C-9 -3 -6 -13 0 -13Z';

/** A cobweb spun in the top-left corner, with a spider hanging off it. */
const COBWEB = svg(
  '0 0 100 100',
  `<g fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round">
<path d="M0 0L100 0M0 0L92.4 38.3M0 0L70.7 70.7M0 0L38.3 92.4M0 0L0 100"/>
<path d="M22 0Q17.7 3.5 20.3 8.4Q15 10 15.6 15.6Q10 15 8.4 20.3Q3.5 17.7 0 22"/>
<path d="M44 0Q35.3 7 40.7 16.8Q29.9 20 31.1 31.1Q20 29.9 16.8 40.7Q7 35.3 0 44"/>
<path d="M66 0Q53 10.5 61 25.3Q44.9 30 46.7 46.7Q30 44.9 25.3 61Q10.5 53 0 66"/>
<path d="M88 0Q70.6 14 81.3 33.7Q59.8 40 62.2 62.2Q40 59.8 33.7 81.3Q14 70.6 0 88"/>
<path d="M54 48V69" stroke-width="0.9"/>
</g>
<g transform="translate(54 75)">
<path d="M-3 -2L-8 -6L-10 -2M-3 0L-9 -1L-11 3M-3 2L-8 4L-9 8M-2 3L-6 7L-6 11M3 -2L8 -6L10 -2M3 0L9 -1L11 3M3 2L8 4L9 8M2 3L6 7L6 11" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cy="1.5" rx="4.2" ry="5.2" fill="${INK}"/>
<circle cy="-4" r="2.9" fill="${INK}"/>
<circle cx="-1.1" cy="-4.3" r="0.8" fill="#fff"/><circle cx="1.1" cy="-4.3" r="0.8" fill="#fff"/>
</g>`,
);

/** A spider on a long thread (the bottom of the image is the spider; the thread runs off the top). */
const SPIDER = svg(
  '0 0 20 60',
  `<path d="M10 0V46" stroke="#fff" stroke-width="1"/><path d="M10 0V46" stroke="${INK}" stroke-width="0.5" opacity="0.5"/>
<g transform="translate(10 51)">
<path d="M-3 -2L-7 -5L-9 -1M-3 0L-8 0L-9 4M-3 2L-7 4L-7 8M3 -2L7 -5L9 -1M3 0L8 0L9 4M3 2L7 4L7 8" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cy="1.5" rx="3.6" ry="4.4" fill="${INK}"/>
<circle cy="-3.4" r="2.5" fill="${INK}"/>
<circle cx="-0.9" cy="-3.7" r="0.7" fill="#fff"/><circle cx="0.9" cy="-3.7" r="0.7" fill="#fff"/>
</g>`,
);

/** A soft cap of snow with a few drips; stretched to the width of what it sits on. */
const SNOWCAP = svg(
  '0 0 200 24',
  `<path d="M2 16C2 6 14 4 22 8C28 1 44 1 52 7C60 2 74 2 82 8C90 1 106 0 114 7C122 2 138 2 146 8C154 1 170 2 178 8C188 4 198 8 198 16C198 20 194 21 190 20L186 20C185 23.5 182 23.5 181 20L120 20C119 24 116 24 115 20L60 20C59 23 57 23 56 20L10 20C6 21 2 20 2 16Z" fill="#fff"/>
<path d="M8 19C40 21 160 21 192 19" stroke="#bfe3ff" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="40" cy="10" r="1.6" fill="#dff1ff"/><circle cx="120" cy="9" r="1.6" fill="#dff1ff"/><circle cx="170" cy="11" r="1.4" fill="#dff1ff"/>`,
  ' preserveAspectRatio="none"',
);

const heart = (x: number, y: number, s: number, deg: number, fill: string): string =>
  `<g transform="translate(${x} ${y}) scale(${s}) rotate(${deg} 12 12)"><path d="${HEART}" fill="${fill}" stroke="${INK}" stroke-width="${(2 / s).toFixed(2)}" stroke-linejoin="round"/><ellipse cx="7.5" cy="7" rx="2.2" ry="1.4" fill="#fff" opacity="0.75" transform="rotate(-30 7.5 7)"/></g>`;

const HEARTS = svg('0 0 60 50', heart(1, 16, 1.35, -12, '#ff4f9a') + heart(30, 3, 1, 14, '#ff8fb8') + heart(36, 28, 0.78, 8, '#e8174f'));
const HEART_ONE = svg('0 0 24 23', `<path d="${HEART}" fill="#ff4f9a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="7.5" cy="7" rx="2.2" ry="1.4" fill="#fff" opacity="0.75" transform="rotate(-30 7.5 7)"/>`);

/** A red envelope and a lucky coin. */
const RED_ENVELOPE = svg(
  '0 0 56 50',
  `<g transform="rotate(-10 20 26)">
<rect x="6" y="8" width="26" height="36" rx="3" fill="#e63946" stroke="${INK}" stroke-width="2"/>
<path d="M6.5 16Q19 25 31.5 16" fill="none" stroke="#ffc928" stroke-width="2"/>
<circle cx="19" cy="24" r="5" fill="#ffc928" stroke="${INK}" stroke-width="1.5"/>
</g>
<g transform="translate(41 35)">
<circle r="11" fill="#ffc928" stroke="${INK}" stroke-width="2"/>
<circle r="7.5" fill="none" stroke="#d99a00" stroke-width="1.5"/>
<rect x="-3" y="-3" width="6" height="6" fill="#e63946" stroke="${INK}" stroke-width="1.5"/>
</g>`,
);

/** A paper lantern with a tassel, hanging from the top of the image. */
const LANTERN = svg(
  '0 0 14 28',
  `<path d="M7 0V5" stroke="${INK}" stroke-width="1.2"/>
<rect x="4" y="4" width="6" height="2.5" rx="0.8" fill="#ffc928" stroke="${INK}" stroke-width="0.8"/>
<ellipse cx="7" cy="12.2" rx="6.2" ry="6" fill="#e63946" stroke="${INK}" stroke-width="1"/>
<path d="M7 6.5V18M4 7.5Q2.4 12.2 4 17M10 7.5Q11.6 12.2 10 17" stroke="#ffc928" stroke-width="0.7" fill="none"/>
<rect x="4" y="17.6" width="6" height="2.5" rx="0.8" fill="#ffc928" stroke="${INK}" stroke-width="0.8"/>
<path d="M7 20V27M5.6 20V25.5M8.4 20V25.5" stroke="#e63946" stroke-width="0.9" stroke-linecap="round"/>`,
);

const egg = (x: number, y: number, deg: number, fill: string, pattern: string): string =>
  `<g transform="translate(${x} ${y}) rotate(${deg})"><path d="${EGG}" fill="${fill}" stroke="${INK}" stroke-width="1.8"/>${pattern}</g>`;
const ZIGZAG = '<path d="M-8.6 0L-5 -3L-1.5 0L2 -3L5.5 0L8.6 -3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>';
const DOTS = '<g fill="#fff"><circle cx="-3" cy="-4" r="1.6"/><circle cx="3" cy="-1" r="1.6"/><circle cx="-4" cy="4" r="1.6"/><circle cx="3.5" cy="6" r="1.4"/></g>';
const STRIPES = '<path d="M-8.8 -1H8.8M-8.4 5H8.4" stroke="#fff" stroke-width="2"/>';

/** Three painted eggs in a tuft of grass. */
const EGGS = svg(
  '0 0 66 46',
  egg(14, 26, -14, '#b8a1ff', ZIGZAG) +
    egg(33, 22, 6, '#ffd36e', DOTS) +
    egg(51, 27, 18, '#8fe3cf', STRIPES) +
    `<path d="M2 46L5 37L8 44L11 35L14 44L18 36L21 44L25 38L28 45L32 36L35 44L39 37L42 44L46 36L49 44L53 38L56 44L60 36L64 46Z" fill="#7cc94a" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
);
const EGG_ONE = svg('-10 -14 20 28', `<path d="${EGG}" fill="#ffd36e" stroke="${INK}" stroke-width="1.8"/>${DOTS}`);

/** A diya: a clay oil lamp with a glowing flame. */
const DIYA = svg(
  '0 0 56 44',
  `<defs><radialGradient id="glow"><stop offset="0" stop-color="#ffe27a" stop-opacity="0.95"/><stop offset="1" stop-color="#ffb703" stop-opacity="0"/></radialGradient></defs>
<circle cx="28" cy="15" r="15" fill="url(#glow)"/>
<path d="M28 3C32.5 9.5 33.5 14 28 21C22.5 14 23.5 9.5 28 3Z" fill="#ffb703" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M28 10C30 13 30 15.5 28 18.5C26 15.5 26 13 28 10Z" fill="#fff3b0"/>
<path d="M7 24H49C47 34.5 39 41 28 41C17 41 9 34.5 7 24Z" fill="#ff7a1a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
<path d="M11 28.5H45" stroke="#ffd23f" stroke-width="2"/>
<g fill="#ff4fc8" stroke="${INK}" stroke-width="0.8"><circle cx="18" cy="34" r="2"/><circle cx="28" cy="36" r="2"/><circle cx="38" cy="34" r="2"/></g>`,
);

/** A striped beach ball. */
const BEACH_BALL = svg(
  '0 0 44 44',
  `<circle cx="22" cy="22" r="19" fill="#fff"/>
<path d="M22 22L22 3A19 19 0 0 1 38.45 12.5Z" fill="#ff5a6c"/>
<path d="M22 22L38.45 31.5A19 19 0 0 1 22 41Z" fill="#ffd23f"/>
<path d="M22 22L5.55 31.5A19 19 0 0 1 5.55 12.5Z" fill="#12c6b3"/>
<circle cx="22" cy="22" r="19" fill="none" stroke="${INK}" stroke-width="2"/>
<circle cx="22" cy="22" r="4" fill="#fff" stroke="${INK}" stroke-width="1.5"/>
<path d="M11 11Q15 7 20 6.5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>`,
);

/** A little sun. */
const SUN = svg(
  '0 0 24 24',
  `<g stroke="${INK}" stroke-width="1.6" stroke-linecap="round"><path d="M12 1.5V4.5M12 19.5V22.5M1.5 12H4.5M19.5 12H22.5M4.6 4.6L6.7 6.7M17.3 17.3L19.4 19.4M4.6 19.4L6.7 17.3M17.3 6.7L19.4 4.6"/></g>
<circle cx="12" cy="12" r="5.6" fill="#ffd23f" stroke="${INK}" stroke-width="1.6"/>`,
);

/** A band of gold light, swept across buttons. */
const SHIMMER = 'linear-gradient(105deg, transparent 38%, rgb(255 236 170 / 0.85) 48%, rgb(255 255 255 / 0.95) 50%, rgb(255 205 90 / 0.85) 52%, transparent 62%)';

export const SKINS: Record<HolidayId, SeasonSkin> = {
  halloween: { card: svgUrl(COBWEB), button: svgUrl(SPIDER) },
  winter: { card: svgUrl(SNOWCAP), button: svgUrl(SNOWCAP) },
  valentine: { card: svgUrl(HEARTS), button: svgUrl(HEART_ONE) },
  lunar: { card: svgUrl(RED_ENVELOPE), button: svgUrl(LANTERN) },
  easter: { card: svgUrl(EGGS), button: svgUrl(EGG_ONE) },
  diwali: { card: svgUrl(DIYA), button: SHIMMER },
  summer: { card: svgUrl(BEACH_BALL), button: svgUrl(SUN) },
};
