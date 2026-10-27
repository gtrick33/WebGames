import type { Theme } from '../data/types';
import { canvas, ctx2d, type Cnv } from './pixel';

/**
 * The air between the camera and the land (VISUAL_BIBLE.md §1): what turns bright tiles into a place with
 * weather and an hour of the day. Drawn over the world each frame, under the health bars and numbers:
 * cloud shadows sliding over open land, shafts of low sun, banks of mist, a warm-to-cool grade, the whole
 * picture brought a little down in color (people included, so they belong to the land), and a vignette.
 * Everything is a few cached textures and blend fills: cheap on a phone.
 */

export interface Mood {
  /** Sunlight: the shafts' color and the warm end of the grade (null: an overcast or sunless land). */
  sun: string | null;
  /** The cool end of the grade, and the color of cloud shadows. */
  shade: string;
  /** How dark cloud shadows are (0: none). */
  clouds: number;
  /** Mist drifting over the land, and how thick. */
  mist: string | null;
  mistA: number;
  /** How much color the whole picture loses (0 to 1). */
  desat: number;
  /** Corner darkness. */
  vignette: number;
  /** Strength of the warm-to-cool grade. */
  grade: number;
  /** A color the whole picture is multiplied by (and how strongly): the land's depth, whatever painted it. */
  deep?: [string, number];
}

const OUTDOOR: Mood = { sun: '#ffd08a', shade: '#1c2a46', clouds: 0.34, mist: null, mistA: 0, desat: 0.06, vignette: 0.62, grade: 0.62, deep: ['#e2d2b2', 0.32] };
const INDOOR: Mood = { sun: null, shade: '#1a1226', clouds: 0, mist: null, mistA: 0, desat: 0.1, vignette: 0.66, grade: 0.4 };
/** Overcast, dead and haunted lands: no sun, low mist, color drained. */
const GLOOM: Mood = { sun: null, shade: '#141428', clouds: 0.16, mist: '#b8b0d8', mistA: 0.13, desat: 0.14, vignette: 0.58, grade: 0.3 };

const MOODS: Partial<Record<Theme, Mood>> = {
  village: { ...OUTDOOR, sun: '#ffcc80' },
  farm: { ...OUTDOOR, sun: '#ffcf78', desat: 0.1 },
  plains: { ...OUTDOOR, sun: '#ffd47a', desat: 0.1 },
  forest: { ...OUTDOOR, sun: '#eef0b0', shade: '#0e2a22', clouds: 0, mist: '#cfe4d4', mistA: 0.12, desat: 0.12, vignette: 0.68, deep: ['#7ea48e', 0.5] },
  coast: { ...OUTDOOR, sun: '#fff0c8', shade: '#173a52', mist: '#e0f0ff', mistA: 0.05 },
  autumn: { ...OUTDOOR, sun: '#ffb060', shade: '#2a1a32', desat: 0.1 },
  fey: { ...OUTDOOR, sun: '#d8f0ff', shade: '#1a1a44', clouds: 0.08, mist: '#bdf0ff', mistA: 0.1, desat: 0.04 },
  jungle: { ...OUTDOOR, sun: '#e8ffa0', clouds: 0.06, mist: '#d0ffd8', mistA: 0.1, desat: 0.1, vignette: 0.6, deep: ['#88b090', 0.45] },
  mountain: { ...OUTDOOR, sun: '#e4eeff', shade: '#14203a', clouds: 0.22, mist: '#dfe8ff', mistA: 0.07, desat: 0.2 },
  peaks: { ...OUTDOOR, sun: '#fff4e4', shade: '#1a2a52', clouds: 0.2, mist: '#ffffff', mistA: 0.08, desat: 0.06, deep: ['#c8d8f0', 0.22] },
  snow: { ...OUTDOOR, sun: '#fff4e0', shade: '#1a2a50', clouds: 0.14, mist: '#ffffff', mistA: 0.08, desat: 0.05, deep: ['#c8d8f0', 0.22] },
  storm: { ...GLOOM, shade: '#101c34', mist: '#c8d4ec', clouds: 0.26, desat: 0.24 },
  desert: { ...OUTDOOR, sun: '#ffd890', shade: '#3a2210', clouds: 0.1, mist: '#ffe0b0', mistA: 0.05, desat: 0.08 },
  barrow: GLOOM,
  moor: { ...GLOOM, mist: '#c4b4dc' },
  deadlake: { ...GLOOM, mist: '#b4c4d4' },
  haunted: { ...GLOOM, shade: '#0e1a2a', mist: '#a8c4dc', mistA: 0.14 },
  bonefield: { ...GLOOM, mist: '#d0c8b8' },
  pale: { ...GLOOM, mist: '#e0e4f0', desat: 0.36 },
  blight: { ...GLOOM, shade: '#1a1028', mist: '#b8a0c8', mistA: 0.14 },
  gloam: { ...GLOOM, shade: '#0a1a1a', mist: '#a0d0c0', mistA: 0.16 },
  rift: { ...GLOOM, shade: '#1a0a30', mist: '#c8a0ff', mistA: 0.1, desat: 0.15 },
  warfront: { ...OUTDOOR, sun: '#ff9a50', shade: '#200c08', clouds: 0.2, mist: '#a09088', mistA: 0.1, desat: 0.24, vignette: 0.6 },
  volcanic: { ...OUTDOOR, sun: '#ff8a40', shade: '#1a0806', clouds: 0.18, mist: '#9a8a80', mistA: 0.12, desat: 0.18, vignette: 0.66 },
  marsh: { ...OUTDOOR, sun: '#eef0c0', shade: '#142218', clouds: 0.1, mist: '#c8e0b0', mistA: 0.14, desat: 0.2, vignette: 0.6, deep: ['#a8b890', 0.32] },
  plague: { ...OUTDOOR, sun: '#e8f0a0', shade: '#1a2010', clouds: 0.1, mist: '#d0e0a0', mistA: 0.14, desat: 0.2, vignette: 0.62 },
  sunken: { ...OUTDOOR, sun: null, shade: '#0a2028', clouds: 0.12, mist: '#a8dcd8', mistA: 0.14, desat: 0.2, vignette: 0.62 },
  lavacave: { ...INDOOR, shade: '#200806', grade: 0.32 },
  icecave: { ...INDOOR, shade: '#0a1a30' },
  riftspire: { ...INDOOR, shade: '#1a0a30' },
};

export const moodOf = (theme: Theme, indoor: boolean): Mood => MOODS[theme] ?? (indoor ? INDOOR : OUTDOOR);

/* ------------------------------------------------------------- textures */

/** Soft blobs in a seamlessly tiling square (clouds, mist): `size` px, made once per color. */
const textures = new Map<string, Cnv>();
function blobs(key: string, color: string, size: number, count: number, rMin: number, rMax: number, seed: number, core = 0): Cnv {
  const hit = textures.get(key);
  if (hit) return hit;
  const c = canvas(size, size);
  const g = ctx2d(c);
  let s = seed;
  const rnd = (): number => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = rMin + rnd() * (rMax - rMin);
    // drawn on every side it crosses, so the square tiles without a seam
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        if (x + dx + r < 0 || x + dx - r > size || y + dy + r < 0 || y + dy - r > size) continue;
        const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        grd.addColorStop(0, color);
        grd.addColorStop(core, color);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.globalAlpha = 0.5 + rnd() * 0.35;
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }
  textures.set(key, c);
  return c;
}

/** A shaft of light: a long soft band, brightest along its middle and fading at both ends. */
function shaft(color: string): Cnv {
  const key = `shaft:${color}`;
  const hit = textures.get(key);
  if (hit) return hit;
  const c = canvas(48, 400);
  const g = ctx2d(c);
  const across = g.createLinearGradient(0, 0, 48, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)');
  across.addColorStop(0.5, color);
  across.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = across;
  g.fillRect(0, 0, 48, 400);
  g.globalCompositeOperation = 'destination-in';
  const along = g.createLinearGradient(0, 0, 0, 400);
  along.addColorStop(0, 'rgba(0,0,0,0.9)');
  along.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  along.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = along;
  g.fillRect(0, 0, 48, 400);
  textures.set(key, c);
  return c;
}

/** Draws a tiling texture over the view, fixed to the world (it slides with the land) and drifting. */
function tile(g: CanvasRenderingContext2D, tex: Cnv, scale: number, vw: number, vh: number, sx: number, sy: number): void {
  const size = tex.width * scale;
  const x0 = -(((sx % size) + size) % size);
  const y0 = -(((sy % size) + size) % size);
  for (let x = x0; x < vw; x += size) for (let y = y0; y < vh; y += size) g.drawImage(tex, x, y, size, size);
}

export interface AtmosphereView {
  /** The view in world px, and where its top-left corner is in the world. */
  vw: number;
  vh: number;
  ox: number;
  oy: number;
  time: number;
  /** A dark place (its own lights do the work): no sun, no clouds. */
  dark: boolean;
}

/** Lays the land's air over the picture (screen space: the caller's transform maps world px to the canvas). */
export function drawAtmosphere(g: CanvasRenderingContext2D, mood: Mood, v: AtmosphereView): void {
  const { vw, vh, ox, oy, time } = v;
  g.save();
  // the land's depth: everything taken a little down and toward its color (bright tiles stop looking like toys)
  if (mood.deep) {
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = mood.deep[1];
    g.fillStyle = mood.deep[0];
    g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'source-over';
  }
  // cloud shadows: soft dark shapes sliding over the land with the wind
  if (mood.clouds > 0 && !v.dark) {
    g.globalAlpha = mood.clouds;
    g.globalCompositeOperation = 'multiply';
    tile(g, blobs(`cloud:${mood.shade}`, mood.shade, 256, 10, 36, 84, 7, 0.55), 2.6, vw, vh, ox - time * 7, oy - time * 2.5);
    g.globalCompositeOperation = 'source-over';
  }
  // mist: two banks drifting at their own pace
  if (mood.mist && mood.mistA > 0) {
    const tex = blobs(`mist:${mood.mist}`, mood.mist, 256, 14, 26, 70, 31);
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = mood.mistA;
    tile(g, tex, 1.6, vw, vh, ox * 1.05 - time * 5, oy * 1.05 - time * 1.2);
    g.globalAlpha = mood.mistA * 0.7;
    tile(g, tex, 2.6, vw, vh, ox * 1.12 + time * 3, oy * 1.12 + 90);
  }
  // shafts of low sun from the upper left, swaying slowly
  if (mood.sun && !v.dark) {
    const sh = shaft(mood.sun);
    g.globalCompositeOperation = 'screen';
    const base = g.getTransform();
    for (let i = 0; i < 3; i++) {
      g.globalAlpha = 0.2 + 0.07 * Math.sin(time * 0.35 + i * 2.1);
      const x = vw * (0.08 + i * 0.32) + Math.sin(time * 0.08 + i) * 18 - ((ox * 0.15) % 60);
      const wide = vw * (0.1 + i * 0.05);
      // (DOMMatrix turns in degrees)
      g.setTransform(base.translate(x, -40).rotate(-34));
      g.drawImage(sh, -wide / 2, 0, wide, vh * 1.7);
    }
    g.setTransform(base);
  }
  // motes: dust in the sun, ash and spores in the gloom, drifting and catching the light
  const mote = mood.sun ?? mood.mist;
  if (mote) {
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = mote;
    for (let i = 0; i < 26; i++) {
      const a = (i * 0.6180339887) % 1;
      const b = (i * 0.7548776662) % 1;
      const x = (((a * vw * 1.3 + time * (3 + b * 5) - ox * 0.2) % (vw + 20)) + vw + 20) % (vw + 20) - 10;
      const y = (((b * vh * 1.3 + Math.sin(time * 0.6 + i) * 8 - time * (1 + a * 2) - oy * 0.2) % (vh + 20)) + vh + 20) % (vh + 20) - 10;
      g.globalAlpha = 0.25 + 0.25 * Math.sin(time * 1.7 + i * 1.3);
      const r = 0.5 + (i % 3) * 0.35;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  // the grade: warm where the sun falls, cool in the far shadows
  if (mood.grade > 0) {
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = mood.grade;
    const grd = g.createLinearGradient(0, 0, vw, vh);
    grd.addColorStop(0, mood.sun ?? '#8a7a9a');
    grd.addColorStop(1, mood.shade);
    g.fillStyle = grd;
    g.fillRect(0, 0, vw, vh);
  }
  // less candy, more painting: every color brought a little toward grey
  if (mood.desat > 0) {
    g.globalCompositeOperation = 'saturation';
    g.globalAlpha = mood.desat;
    g.fillStyle = '#808080';
    g.fillRect(0, 0, vw, vh);
  }
  // the vignette: the eye goes to the middle
  if (mood.vignette > 0) {
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const r = Math.hypot(vw, vh) / 2;
    const grd = g.createRadialGradient(vw / 2, vh / 2, r * 0.42, vw / 2, vh / 2, r);
    grd.addColorStop(0, 'rgba(8,5,4,0)');
    grd.addColorStop(1, `rgba(8,5,4,${mood.vignette})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, vw, vh);
  }
  g.restore();
}
