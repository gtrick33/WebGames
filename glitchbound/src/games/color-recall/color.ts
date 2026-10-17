/**
 * Colour maths for Color Recall: conversions, perceptual distance (CIEDE2000), scoring and the
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
  if (!m) throw new Error(`bad hex colour: ${hex}`);
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

/** RGB to HSB. Grey has no hue, so `fallbackHue` keeps the slider where it was. */
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
  return { h: Math.round(h), s: Math.round(max === 0 ? 0 : (d / max) * 100), b: Math.round(max * 100) };
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

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** CIEDE2000 colour difference. ~1 is barely visible, ~10 is clearly different, 50+ is another colour. */
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
 * Points for one colour, 0-1000. Anything under 1 ΔE (invisible to most eyes) is perfect; the curve
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

/** Emoji square per verdict, for spoiler-free share text. */
export const VERDICT_EMOJI: Record<Verdict, string> = {
  perfect: '🟪',
  brilliant: '🟩',
  great: '🟩',
  close: '🟨',
  warm: '🟧',
  off: '🟥',
};

const HUE_NAMES: [number, string][] = [
  [15, 'red'],
  [40, 'orange'],
  [65, 'yellow'],
  [95, 'lime'],
  [160, 'green'],
  [195, 'teal'],
  [250, 'blue'],
  [285, 'violet'],
  [330, 'pink'],
  [360, 'red'],
];

export function hueName(h: number): string {
  const x = ((h % 360) + 360) % 360;
  return HUE_NAMES.find(([max]) => x < max)?.[1] ?? 'red';
}

/**
 * Up to two short, plain-language tips explaining how the guess differs from the target, biggest
 * difference first. Empty when the guess is already very close.
 */
export function feedback(target: Rgb, guess: Rgb): string[] {
  if (deltaE(target, guess) < 2.5) return [];
  const t = rgbToHsb(target);
  const g = rgbToHsb(guess, t.h);
  const tips: { weight: number; text: string }[] = [];

  const dB = g.b - t.b;
  if (Math.abs(dB) >= 6) tips.push({ weight: Math.abs(dB), text: dB > 0 ? (dB > 20 ? 'Much too bright' : 'A little too bright') : dB < -20 ? 'Much too dark' : 'A little too dark' });

  const dS = g.s - t.s;
  if (Math.abs(dS) >= 8) tips.push({ weight: Math.abs(dS) * 0.8, text: dS > 0 ? (dS > 25 ? 'Far too vivid' : 'Slightly too vivid') : dS < -25 ? 'Far too washed out' : 'Slightly too muted' });

  // Hue only matters when both colours actually have some colour in them.
  if (t.s > 12 && g.s > 12) {
    let dH = g.h - t.h;
    if (dH > 180) dH -= 360;
    if (dH < -180) dH += 360;
    if (Math.abs(dH) > 50 && hueName(g.h) !== hueName(t.h)) {
      tips.push({ weight: Math.abs(dH) * 1.2, text: `Wrong hue: that’s ${hueName(g.h)}, not ${hueName(t.h)}` });
    } else if (Math.abs(dH) >= 6) {
      // Name the neighbouring hue family the guess drifted toward.
      const own = hueName(t.h);
      const near = hueName(t.h + Math.sign(dH) * 35);
      const word = near === own ? hueName(t.h + Math.sign(dH) * 70) : near;
      tips.push({ weight: Math.abs(dH) * 1.2, text: Math.abs(dH) > 30 ? `Hue is far too ${word}` : `Hue leans a bit too ${word}` });
    }
  }
  return tips
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((t) => t.text);
}

/** Readable text colour (ink or white) on top of a colour. */
export function inkOn(c: Rgb): string {
  return rgbToLab(c).L > 62 ? '#14102a' : '#ffffff';
}
