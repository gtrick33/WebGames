import type { HolidayId } from '../platform/seasons';

/**
 * Holiday skins for the arcade and party pages. They dress the edges of cards and buttons, never
 * their content: cobwebs strung along the top of every card (spun into both top corners), snow lying
 * on top and sliding down the sides, or one small ornament on a card's corner (hearts, eggs...); a glow
 * ring around every button, and on the main buttons one extra (a spider dangling on its thread, a
 * heart). The art lives here as SVG; where it sits and how it moves is in SeasonSkins.css.
 * `card` and `button` are CSS images ('none' for no ornament); `extra` sets more CSS variables
 * (the right-hand corner and the repeating edge of the garlands).
 */
export interface SeasonSkin {
  card: string;
  button: string;
  extra?: Record<string, string>;
}

const INK = '#1d1238';
const svg = (viewBox: string, body: string, extra = ''): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra}>${body}</svg>`;
export const svgUrl = (markup: string): string => `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;

/** A heart in a 24x23 box. */
const HEART = 'M12 21C12 21 2 14.5 2 8C2 4.7 4.6 2 7.8 2C9.7 2 11.2 3 12 4.4C12.8 3 14.3 2 16.2 2C19.4 2 22 4.7 22 8C22 14.5 12 21 12 21Z';
/** An egg around (0, 0). */
const EGG = 'M0 -13C6 -13 9 -3 9 3C9 9 5 13 0 13C-5 13 -9 9 -9 3C-9 -3 -6 -13 0 -13Z';

/** Mirrors a drawing left to right (for the right-hand corner of a garland). */
const mirrored = (width: number, body: string): string => `<g transform="translate(${width} 0) scale(-1 1)">${body}</g>`;

/** A cobweb spun into a card's top-left corner (drawn as a mask: the page's text color shows through). */
const WEB_CORNER = `<g fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round">
<path d="M0 0L32 0M0 0L27.72 11.48M0 0L18.38 18.38M0 0L11.48 27.72M0 0L0 32"/>
<path d="M8 0Q6.77 1.35 7.39 3.06Q5.74 3.83 5.66 5.66Q3.83 5.74 3.06 7.39Q1.35 6.77 0 8"/>
<path d="M15 0Q12.65 2.52 13.86 5.74Q10.73 7.17 10.61 10.61Q7.17 10.73 5.74 13.86Q2.52 12.65 0 15"/>
<path d="M22 0Q18.54 3.69 20.33 8.42Q15.72 10.5 15.56 15.56Q10.5 15.72 8.42 20.33Q3.69 18.54 0 22"/>
</g>`;
const COBWEB_L = svg('0 0 32 32', WEB_CORNER);
const COBWEB_R = svg('0 0 32 32', mirrored(32, WEB_CORNER));
/** Silk strands sagging between the two corner webs, repeated along the card's top edge. */
const COBWEB_EDGE = svg(
  '0 0 64 14',
  `<g fill="none" stroke="#fff" stroke-linecap="round"><path d="M0 0.5Q16 16 32 0.5Q48 13 64 0.5" stroke-width="1"/><path d="M12 0.5Q26 9 40 0.5" stroke-width="0.8" opacity="0.7"/></g>`,
  // Repeats are resized to fit the card exactly ('round'): stretch a little rather than leave gaps.
  ' preserveAspectRatio="none"',
);

/** A spider on its thread (the bottom of the image is the spider; the thread runs off the top). */
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

/*
 * Snow lying on a card: a lumpy, shaded drift along the top that wraps over the rounded corners and
 * slides a little way down both sides, with a few icicles. Three pieces (left corner, a repeating top
 * edge, right corner), so it fits any width without stretching. In every piece the card's top edge is
 * at y = 10 and, in the corners, its side at x = 6.
 */
const SNOW_FILL = '<defs><linearGradient id="sn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.65" stop-color="#f6faff"/><stop offset="1" stop-color="#dcebfa"/></linearGradient></defs>';
const SNOW_CORNER = `<path d="M9 44C9 47.5 4 47.5 3.5 43L2.5 30C1 22 3 14 9 9C12 4 18 1 24 2C28 -0.5 34 0 37 2.5C40 2 43 3 44 4L44 13L28 13A19 19 0 0 0 9 32Z" fill="url(#sn)" stroke="#d6e7f7" stroke-width="0.8"/>
<path d="M9 44L9 32A19 19 0 0 1 28 13L44 13" fill="none" stroke="#bcd6ef" stroke-width="1.6" stroke-linecap="round"/>
<path d="M31 13Q33 20.5 35 13Z" fill="#e8f4ff" stroke="#bcd6ef" stroke-width="0.7"/>
<path d="M9 36Q13.5 38 9 40Z" fill="#e8f4ff" stroke="#bcd6ef" stroke-width="0.7"/>
<g fill="#cfe4f8"><circle cx="13" cy="8" r="0.9"/><circle cx="26" cy="5" r="0.8"/><circle cx="5.5" cy="22" r="0.8"/></g>`;
const SNOW_L = svg('0 0 44 48', SNOW_FILL + SNOW_CORNER);
const SNOW_R = svg('0 0 44 48', SNOW_FILL + mirrored(44, SNOW_CORNER));
const SNOW_EDGE = svg(
  '0 0 96 20',
  `${SNOW_FILL}<path d="M0 13L0 4C5 1 10 0.5 15 2.5C20 -0.5 27 -0.5 31 2C35 0.5 39 1 42 3C47 0 55 0 60 2.5C64 1 69 0.5 73 2C78 -0.5 86 0 90 2.5C92 3 94 3.5 96 4L96 13Z" fill="url(#sn)"/>
<path d="M0 4C5 1 10 0.5 15 2.5C20 -0.5 27 -0.5 31 2C35 0.5 39 1 42 3C47 0 55 0 60 2.5C64 1 69 0.5 73 2C78 -0.5 86 0 90 2.5C92 3 94 3.5 96 4" fill="none" stroke="#d6e7f7" stroke-width="0.8"/>
<path d="M0 13H96" stroke="#bcd6ef" stroke-width="1.6"/>
<path d="M20 13Q22.5 19.5 25 13Z M67 13Q68.5 17 70 13Z" fill="#e8f4ff" stroke="#bcd6ef" stroke-width="0.7"/>
<g fill="#cfe4f8"><circle cx="9" cy="6" r="0.9"/><circle cx="37" cy="7" r="0.8"/><circle cx="58" cy="6" r="0.9"/><circle cx="84" cy="7" r="0.8"/></g>`,
  ' preserveAspectRatio="none"',
);

const heart = (x: number, y: number, s: number, deg: number, fill: string): string =>
  `<g transform="translate(${x} ${y}) scale(${s}) rotate(${deg} 12 12)"><path d="${HEART}" fill="${fill}" stroke="${INK}" stroke-width="${(2 / s).toFixed(2)}" stroke-linejoin="round"/><ellipse cx="7.5" cy="7" rx="2.2" ry="1.4" fill="#fff" opacity="0.75" transform="rotate(-30 7.5 7)"/></g>`;

const HEARTS = svg('0 0 44 40', heart(1, 10, 1.25, -12, '#ff4f9a') + heart(25, 1, 0.75, 14, '#ff8fb8'));
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

/** Two painted eggs in a tuft of grass. */
const EGGS = svg(
  '0 0 46 40',
  egg(14, 21, -12, '#b8a1ff', ZIGZAG) +
    egg(32, 20, 14, '#ffd36e', DOTS) +
    `<path d="M2 40L5 32L8 38L11 30L14 38L18 31L21 38L25 32L28 39L32 31L35 38L39 32L42 38L44 40Z" fill="#7cc94a" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
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

export const SKINS: Record<HolidayId, SeasonSkin> = {
  halloween: { card: svgUrl(COBWEB_L), button: svgUrl(SPIDER), extra: { '--skin-card-r': svgUrl(COBWEB_R), '--skin-card-edge': svgUrl(COBWEB_EDGE) } },
  winter: { card: svgUrl(SNOW_L), button: 'none', extra: { '--skin-card-r': svgUrl(SNOW_R), '--skin-card-edge': svgUrl(SNOW_EDGE) } },
  valentine: { card: svgUrl(HEARTS), button: svgUrl(HEART_ONE) },
  lunar: { card: svgUrl(RED_ENVELOPE), button: svgUrl(LANTERN) },
  easter: { card: svgUrl(EGGS), button: svgUrl(EGG_ONE) },
  diwali: { card: svgUrl(DIYA), button: 'none' },
  summer: { card: svgUrl(BEACH_BALL), button: svgUrl(SUN) },
};
