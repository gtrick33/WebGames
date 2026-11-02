/**
 * Color math for Color Recall: conversions, perceptual distance (CIEDE2000), scoring and the
 * plain-language "what to fix" feedback. Pure functions only, so everything here is unit tested.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Hue 0-360, saturation and brightness 0-100. */
export interface Hsb {
  h: number;
  s: number;
  b: number;
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`bad hex color: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (v: number): string => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function hsbToRgb({ h, s, b }: Hsb): Rgb {
  const S = clamp(s, 0, 100) / 100;
  const V = clamp(b, 0, 100) / 100;
  const H = (((h % 360) + 360) % 360) / 60;
  const c = V * S;
  const x = c * (1 - Math.abs((H % 2) - 1));
  const [r1, g1, b1] = H < 1 ? [c, x, 0] : H < 2 ? [x, c, 0] : H < 3 ? [0, c, x] : H < 4 ? [0, x, c] : H < 5 ? [x, 0, c] : [c, 0, x];
  const m = V - c;
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}

/** RGB to HSB. Gray has no hue, so `fallbackHue` keeps the slider where it was. */
export function rgbToHsb({ r, g, b }: Rgb, fallbackHue = 0): Hsb {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = fallbackHue;
  if (d > 0) {
    if (max === R) h = 60 * (((G - B) / d) % 6);
    else if (max === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
    h = (h + 360) % 360;
  }
  // 359.5° and up rounds to 360, which is 0 on a 0-359 slider.
  return { h: Math.round(h) % 360, s: Math.round(max === 0 ? 0 : (d / max) * 100), b: Math.round(max * 100) };
}

function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab({ r, g, b }: Rgb): Lab {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  // sRGB D65 -> XYZ, normalised by the D65 white point.
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE lightness, 0 (black) to 100 (white). */
export const lightness = (c: Rgb): number => rgbToLab(c).L;

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** CIEDE2000 color difference. ~1 is barely visible, ~10 is clearly different, 50+ is another color. */
export function deltaE(c1: Rgb, c2: Rgb): number {
  const l1 = rgbToLab(c1);
  const l2 = rgbToLab(c2);
  const C1 = Math.hypot(l1.a, l1.b);
  const C2 = Math.hypot(l2.a, l2.b);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1 = (1 + G) * l1.a;
  const a2 = (1 + G) * l2.a;
  const C1p = Math.hypot(a1, l1.b);
  const C2p = Math.hypot(a2, l2.b);
  const h1p = C1p === 0 ? 0 : (deg(Math.atan2(l1.b, a1)) + 360) % 360;
  const h2p = C2p === 0 ? 0 : (deg(Math.atan2(l2.b, a2)) + 360) % 360;

  const dLp = l2.L - l1.L;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));

  const Lbp = (l1.L + l2.L) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbp /= 2;
    else hbp = h1p + h2p < 360 ? (hbp + 360) / 2 : (hbp - 360) / 2;
  }
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.2 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

export const MAX_POINTS = 1000;

/**
 * Points for one color, 0-1000. Anything under 1 ΔE (invisible to most eyes) is perfect; the curve
 * then falls smoothly: ΔE 5 ≈ 870, 10 ≈ 660, 20 ≈ 330, 40 ≈ 50.
 */
export function pointsFor(dE: number): number {
  if (!(dE > 1)) return MAX_POINTS;
  return Math.round(MAX_POINTS * Math.exp(-(((dE - 1) / 18) ** 1.4)));
}

export type Verdict = 'perfect' | 'brilliant' | 'great' | 'close' | 'warm' | 'off';

export function verdictFor(points: number): Verdict {
  if (points >= 980) return 'perfect';
  if (points >= 900) return 'brilliant';
  if (points >= 750) return 'great';
  if (points >= 550) return 'close';
  if (points >= 300) return 'warm';
  return 'off';
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  perfect: 'Perfect!',
  brilliant: 'Brilliant',
  great: 'Great eye',
  close: 'Close',
  warm: 'Getting warm',
  off: 'Way off',
};

/** The verdict's words for a score: "Perfect!" only for a full 1,000, "Near perfect" just below. */
export const verdictText = (points: number): string => (points >= MAX_POINTS ? VERDICT_TEXT.perfect : verdictFor(points) === 'perfect' ? 'Near perfect' : VERDICT_TEXT[verdictFor(points)]);

/** Emoji square per verdict, for spoiler-free share text. */
export const VERDICT_EMOJI: Record<Verdict, string> = {
  perfect: '🟪',
  brilliant: '🟩',
  great: '🟩',
  close: '🟨',
  warm: '🟧',
  off: '🟥',
};

/** Hue families by HSB hue (the slider), from 0°. */
const HUE_NAMES: [number, string][] = [
  [15, 'red'],
  [40, 'orange'],
  [65, 'yellow'],
  [95, 'lime'],
  [160, 'green'],
  [195, 'teal'],
  [250, 'blue'],
  [275, 'violet'],
  [300, 'purple'],
  [325, 'magenta'],
  [345, 'pink'],
  [360, 'red'],
];

/** The hue family of a hue angle alone (pure, fully vivid colors). */
export function hueName(h: number): string {
  const x = ((h % 360) + 360) % 360;
  return HUE_NAMES.find(([max]) => x < max)?.[1] ?? 'red';
}

/**
 * What most people would call a color: its hue family adjusted for lightness and vividness, so a
 * light or soft red is pink, a dark orange is brown and a dark or dusty magenta is purple.
 */
export function colorName(c: Rgb): string {
  const { h, s, b } = rgbToHsb(c);
  if (s < 10) return 'gray';
  const name = hueName(h);
  if (name === 'red' && b > 70 && s < 62) return 'pink';
  if ((name === 'orange' || (name === 'yellow' && h < 50)) && b < 60 && s > 25) return 'brown';
  if (name === 'magenta' && (b < 60 || s < 40)) return 'purple';
  return name;
}

interface Lch {
  L: number;
  C: number;
  h: number;
}

function rgbToLch(c: Rgb): Lch {
  const { L, a, b } = rgbToLab(c);
  return { L, C: Math.hypot(a, b), h: (deg(Math.atan2(b, a)) + 360) % 360 };
}

/**
 * Up to two short, plain-language tips explaining how the guess differs from the target, biggest
 * difference first. They are measured in the same perceptual space as the score (lightness,
 * chroma and hue, weighted as CIEDE2000 weights them), so a guess that loses points always gets
 * at least one tip. Empty only when the guess is already very close (ΔE under 2.5).
 */
export function feedback(target: Rgb, guess: Rgb): string[] {
  if (deltaE(target, guess) < 2.5) return [];
  const t = rgbToLch(target);
  const g = rgbToLch(guess);
  const Lbar = (t.L + g.L) / 2;
  const Cbar = (t.C + g.C) / 2;
  const dL = (g.L - t.L) / (1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2));
  const dC = (g.C - t.C) / (1 + 0.045 * Cbar);
  let dh = g.h - t.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const dH = t.C < 1 || g.C < 1 ? 0 : (2 * Math.sqrt(t.C * g.C) * Math.sin(rad(dh / 2))) / (1 + 0.015 * Cbar);

  const tips: { weight: number; text: string }[] = [];
  tips.push({ weight: Math.abs(dL), text: dL > 0 ? (dL > 12 ? 'Much too bright' : 'A little too bright') : dL < -12 ? 'Much too dark' : 'A little too dark' });

  // A near-gray target: any color in the guess reads as a tint.
  if (t.C < 6 && g.C >= 6 && dC > 0) {
    const tint = colorName(guess);
    tips.push({ weight: Math.abs(dC) + Math.abs(dH), text: `Too colorful: it has a ${tint === 'gray' ? hueName(rgbToHsb(guess).h) : tint} tint` });
  } else {
    tips.push({ weight: Math.abs(dC), text: dC > 0 ? (dC > 10 ? 'Far too vivid' : 'Slightly too vivid') : dC < -10 ? 'Far too washed out' : 'Slightly too muted' });
    if (dH !== 0) tips.push({ weight: Math.abs(dH), text: hueTip(target, guess) });
  }
  tips.sort((a, b) => b.weight - a.weight);
  const top = tips[0]!.weight;
  return tips
    .filter((x, i) => i === 0 || x.weight >= Math.max(1.5, top * 0.5))
    .slice(0, 2)
    .map((x) => x.text);
}

/** "Wrong hue: that's X, not Y", or which neighboring family the guess drifted toward (on the HSB hue slider). */
function hueTip(target: Rgb, guess: Rgb): string {
  const th = rgbToHsb(target);
  const gh = rgbToHsb(guess, th.h);
  let dH = gh.h - th.h;
  if (dH > 180) dH -= 360;
  if (dH < -180) dH += 360;
  const own = colorName(target);
  const theirs = colorName(guess);
  if (Math.abs(dH) > 50 && theirs !== own) return `Wrong hue: that’s ${theirs}, not ${own}`;
  // Walk from the target's hue in the direction of the drift to the first family that is neither
  // the target's hue band nor what the target is called (a light red is "pink": its drift toward
  // magenta must not read as "too pink").
  const step = dH >= 0 ? 5 : -5;
  const base = hueName(th.h);
  let word = base;
  for (let x = th.h; (word === base || word === own) && Math.abs(x - th.h) <= 120; x += step) word = hueName(x);
  return Math.abs(dH) > 30 ? `Hue is far too ${word}` : `Hue leans a bit too ${word}`;
}

/** Readable text color (ink or white) on top of a color. */
export function inkOn(c: Rgb): string {
  return rgbToLab(c).L > 62 ? '#14102a' : '#ffffff';
}
