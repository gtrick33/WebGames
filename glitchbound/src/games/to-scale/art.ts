/**
 * Original side-view art for things whose device emoji can't be sized fairly (a racket with the ball,
 * a three-quarter view, an upright cat, a die in perspective). Each drawing has the thing's real
 * proportions and nothing else in it, so its visible box is the thing itself. Coordinates have y
 * pointing down and the drawing stands on its lowest point.
 */
export interface ArtPart {
  d: string;
  fill?: string;
  stroke?: string;
  /** Stroke width, in drawing units. */
  width?: number;
}
export interface Art {
  /** The drawing's frame, in drawing units (the visible shape fills it, give or take a unit). */
  w: number;
  h: number;
  parts: ArtPart[];
}

const circle = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number): string => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const rect = (x: number, y: number, w: number, h: number, r = 0): string =>
  r ? `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z` : `M${x} ${y}h${w}v${h}h${-w}Z`;

/** A die seen face-on: 16 mm along each edge. */
export const DIE: Art = {
  w: 100,
  h: 100,
  parts: [
    { d: rect(0, 0, 100, 100, 14), fill: '#f4f4f0' },
    { d: [circle(25, 25, 9), circle(75, 25, 9), circle(50, 50, 9), circle(25, 75, 9), circle(75, 75, 9)].join(''), fill: '#20232b' },
  ],
};

/** A tennis ball, no racket. */
export const TENNIS_BALL: Art = {
  w: 100,
  h: 100,
  parts: [
    { d: circle(50, 50, 50), fill: '#cfe23a' },
    { d: 'M16 14C42 34 42 66 16 86M84 14C58 34 58 66 84 86', stroke: '#f7f7ee', width: 5 },
  ],
};

/** A blown-up party balloon and its knot, no string. */
export const BALLOON: Art = {
  w: 24,
  h: 30,
  parts: [
    { d: ellipse(12, 13, 12, 13), fill: '#e8384f' },
    { d: 'M9.5 30L12 25.6L14.5 30Z', fill: '#c42a3e' },
    { d: ellipse(7.5, 8, 2.2, 3.5), fill: 'rgba(255,255,255,0.45)' },
  ],
};

/** A house cat walking, side view: 75 units from nose to tail tip. */
export const CAT: Art = {
  w: 75,
  h: 30,
  parts: [
    { d: 'M17 13C9 14 4 12 3 4', stroke: '#8a8f99', width: 3.2 },
    { d: [ellipse(36, 15, 20, 7.5), rect(20, 18, 3.4, 12, 1), rect(27, 18, 3.4, 12, 1), rect(46, 18, 3.4, 12, 1), rect(52, 18, 3.4, 12, 1)].join(''), fill: '#8a8f99' },
    { d: 'M52 12L58 6L62 15L55 19Z' + circle(62, 10, 7) + ellipse(68, 12, 3.5, 3) + 'M56.5 6L57.5 0L62 3.5ZM63 3.2L67.5 0.2L68 6.5Z', fill: '#8a8f99' },
    { d: circle(65, 8.6, 1.1), fill: '#ffe066' },
  ],
};

/** A Labrador standing, side view: 110 units from nose to tail tip. */
export const DOG: Art = {
  w: 110,
  h: 65,
  parts: [
    { d: 'M22 22C12 24 6 28 3 36', stroke: '#d9a441', width: 4 },
    { d: [ellipse(48, 24, 27, 11), rect(26, 28, 6, 37, 2), rect(36, 28, 6, 37, 2), rect(62, 28, 6, 37, 2), rect(70, 28, 6, 37, 2)].join(''), fill: '#d9a441' },
    { d: 'M64 20L80 6L90 10L76 30Z' + ellipse(86, 9, 10, 8) + rect(92, 6, 14, 9, 3), fill: '#d9a441' },
    { d: ellipse(82, 13, 3.5, 7), fill: '#b8862f' },
    { d: circle(105, 8.5, 2) + circle(88, 6.5, 1.2), fill: '#2a2018' },
  ],
};

/** A saltwater crocodile on land, side view: 90 units long. */
export const CROCODILE: Art = {
  w: 90,
  h: 11,
  parts: [
    { d: 'M0 7.5C15 6 30 3 45 2.5L66 2.5C70 2.5 72 3 74 4L90 5.6L90 7.2L74 8L45 8.6C30 8.6 15 8.2 0 7.5Z', fill: '#4f7a3a' },
    { d: 'M30 8L28 11L33 11L34 8ZM56 8L54 11L59 11L60 8Z' + circle(70, 2.6, 1.4), fill: '#4f7a3a' },
    { d: 'M74 6.4L90 6.3', stroke: '#2f4d22', width: 0.5 },
  ],
};

/** A three-seater sofa seen from the front: 200 units wide. */
export const SOFA: Art = {
  w: 200,
  h: 85,
  parts: [
    { d: rect(18, 0, 164, 50, 10) + rect(0, 22, 34, 50, 10) + rect(166, 22, 34, 50, 10), fill: '#3d6fb6' },
    { d: rect(26, 44, 148, 26, 6), fill: '#4a80c8' },
    { d: rect(10, 66, 180, 8, 3), fill: '#2f5a96' },
    { d: rect(16, 73, 8, 12) + rect(176, 73, 8, 12), fill: '#5a3b22' },
  ],
};

/** A steam locomotive with its tender, side view: 200 units long. */
export const LOCOMOTIVE: Art = {
  w: 200,
  h: 45,
  parts: [
    { d: rect(0, 14, 48, 22, 2) + rect(52, 6, 30, 30) + rect(49, 3, 36, 4, 1) + rect(82, 14, 92, 20, 3) + rect(162, 4, 8, 12) + rect(160, 2, 12, 3, 1) + ellipse(128, 14, 7, 5), fill: '#2b2e36' },
    { d: rect(0, 34, 190, 3) + 'M180 30L196 41L180 41Z', fill: '#b23a3a' },
    { d: rect(58, 11, 8, 8) + rect(70, 11, 8, 8), fill: '#ffd36b' },
    { d: circle(12, 39, 6) + circle(36, 39, 6) + circle(98, 36, 9) + circle(120, 36, 9) + circle(142, 36, 9) + circle(168, 40, 5), fill: '#5b606b' },
  ],
};

/** A jumbo jet on its wheels, side view: 70 units long, 19 to the top of its tail. */
export const JET: Art = {
  w: 70,
  h: 19,
  parts: [
    { d: rect(34, 13, 1.2, 4.6) + circle(34.6, 18, 1) + rect(60, 13, 1, 4.6) + circle(60.5, 18, 1), fill: '#5b606b' },
    { d: 'M1 10.5C1 8.5 3 8 7 8L56 8C61 8 66 9 70 11C66 13 62 14 56 14L7 14C3 14 1 12.5 1 10.5ZM46 8.4C50 4.8 56 4.8 62 8.6ZM4 8.5L0 0L6 0L17 8.5Z', fill: '#e9edf3' },
    { d: 'M28 11.5L44 11.5L30 15.5L24 15.5ZM2 9L11 9L5 11.5Z' + ellipse(30, 15.4, 3.2, 1.2), fill: '#9aa6b5' },
    { d: rect(10, 9.6, 46, 0.9), fill: '#6f8fb8' },
  ],
};

/** A cruise ship, side view: 300 units long. */
export const CRUISE_SHIP: Art = {
  w: 300,
  h: 60,
  parts: [
    { d: rect(20, 22, 250, 12) + rect(30, 12, 220, 10) + rect(45, 4, 170, 8), fill: '#f2f4f7' },
    { d: rect(22, 26, 246, 2) + rect(32, 16, 216, 2) + rect(47, 7, 166, 2), fill: '#3f6ea8' },
    { d: 'M200 0L222 0L218 12L204 12Z', fill: '#d8a33a' },
    { d: 'M4 34L300 30L284 60L18 60Z', fill: '#1e3a5f' },
  ],
};

/** A great white shark, side view: 46 units long. */
export const SHARK: Art = {
  w: 46,
  h: 16,
  parts: [
    { d: 'M0 0L7 7.5L2 14L9 10C16 12.6 28 13 36 11.5C41 10.6 44.5 9.4 46 8.4C44 7 40 6 35 5.4L27 5L23 0L19 5C15 5.2 11 6 9 6.6Z', fill: '#7c8a99' },
    { d: 'M14 10.6C22 12.8 31 12.6 38 11C40 10.6 43 9.7 44.5 9.1C38 10 30 10.4 22 10.2Z', fill: '#dfe5ea' },
    { d: 'M24 11L20 16L28 11.6Z', fill: '#6b7887' },
    { d: circle(40, 7.6, 0.6), fill: '#111' },
  ],
};
