import type { Rarity } from '../../data/types';
import { mixRGB, OUTLINE_RGB, Painter, ramp, rgb, tone, type Ramp, type RGB } from './kit';

/**
 * The paper-doll hero: a body painted at art resolution with every worn piece drawn on it, so a new
 * helm, robe, pair of trousers, gloves or boots shows on the character. Pieces are drawn from their
 * style (hood, helm, robe, plate…), material (cloth, leather, mail, plate, gold), color and rarity
 * (rare pieces get a light trim, epic ones gold, legendary ones gold and a glowing gem). Three views
 * (front, back, side facing right), each with a standing frame and two walking frames.
 */

export type Mat = 'cloth' | 'leather' | 'mail' | 'plate' | 'gold';
export type HeadStyle = 'hood' | 'helm' | 'cap' | 'crown' | 'wizard';
export type ChestStyle = 'robe' | 'tunic' | 'plate';
export type LegStyle = 'trousers' | 'greaves';
export type HandStyle = 'gloves' | 'gauntlets';
export type FeetStyle = 'shoes' | 'boots' | 'sabatons';

export interface Piece<S extends string = string> {
  style: S;
  mat: Mat;
  tint: string;
  r: Rarity;
}

export interface HeroLook {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'pony' | 'long';
  head: Piece<HeadStyle> | null;
  chest: Piece<ChestStyle>;
  legs: Piece<LegStyle>;
  hands: Piece<HandStyle> | null;
  feet: Piece<FeetStyle>;
  /** A quiver on the back (its color). */
  quiver: string | null;
  /** A cape (its color), worn with epic and legendary armor. */
  cape: string | null;
  /** Townsfolk extras: a beard, an apron (their colors). */
  beard?: string | null;
  apron?: string | null;
}

export type View = 'down' | 'up' | 'side';

/** Art size of a hero picture; the feet stand on the bottom row but one. */
export const HERO_W = 34;
export const HERO_H = 60;

const EYE = rgb('#2a1a3a');
const EYE_HI = rgb('#ffffff');
const GOLD = ramp('#ffcf5a');
const BELT = ramp('#6a4428');
const ARROW = { shaft: rgb('#c8a878'), fletch: rgb('#f2ece0'), fletch2: rgb('#d84a4a') };

/** Skin shades toward a warm brown, not through red (the generic ramp is too saturated for faces). */
function skinRamp(hex: string): Ramp {
  const c = rgb(hex);
  return [mixRGB(c, [255, 250, 240], 0.35), mixRGB(c, [255, 245, 230], 0.15), c, mixRGB(c, [150, 80, 70], 0.28), mixRGB(c, [90, 45, 50], 0.5)];
}

/** The trim a piece's rarity gives it (null: none). */
function trimOf(p: Piece): RGB | null {
  if (p.r === 'epic' || p.r === 'legendary') return GOLD[1];
  if (p.r === 'rare') return tone(rgb(p.tint), 0.5);
  return null;
}

/** A material's ramp: metals are shinier (a brighter top, a deeper shadow). */
function matRamp(p: Piece): Ramp {
  const r = ramp(p.tint);
  if (p.mat === 'plate' || p.mat === 'gold') return [tone(rgb(p.tint), 0.7), r[0], r[2], r[3], r[4]];
  return r;
}

/**
 * Paints the color of a surface pixel: lit on the left, shaded on the right (light from the top
 * left), with the material's texture.
 */
function surf(R: Ramp, mat: Mat, x: number, y: number, x0: number, x1: number, extra = 0): RGB {
  const t = (x - x0) / Math.max(1, x1 - x0);
  let i = t < 0.2 ? 1 : t > 0.78 ? 3 : 2;
  i += extra;
  if (mat === 'mail' && i === 2 && (x + y) % 2 === 0 && y % 2 === 0) i = 3;
  if (mat === 'mail' && i === 1 && (x + y) % 2 === 0) i = 2;
  if (mat === 'plate' && t > 0.25 && t < 0.38) i = 0;
  return R[Math.max(0, Math.min(4, i))]!;
}

interface Pose {
  view: View;
  /** Walking frame: 0 standing, 1 and 2 stepping. */
  f: number;
}

export function paintHero(look: HeroLook, view: View, frame: number): Painter {
  const p = new Painter(HERO_W, HERO_H);
  const pose: Pose = { view, f: frame };
  if (view === 'side') side(p, look, pose);
  else front(p, look, pose);
  p.outline(OUTLINE_RGB);
  return p;
}

/* ------------------------------------------------------------ front & back */

const CX = 17;

function front(p: Painter, l: HeroLook, pose: Pose): void {
  const back = pose.view === 'up';
  const skin = skinRamp(l.skin);
  const hair = ramp(l.hair);
  // a step lifts one foot and swings the arms a little
  const liftL = pose.f === 1 ? 2 : 0;
  const liftR = pose.f === 2 ? 2 : 0;
  const armL = pose.f === 1 ? 1 : pose.f === 2 ? -1 : 0;
  const armR = -armL;
  const robe = l.chest.style === 'robe';

  // the cape and the quiver hang behind (front view) or over the back (back view)
  if (l.cape && !back) {
    const C = ramp(l.cape);
    p.rect(7, 31, 2, 20, C[3]);
    p.rect(25, 31, 2, 20, C[4]);
  }
  if (l.quiver && !back) {
    // fletchings over the right shoulder
    const Q = ramp(l.quiver);
    p.rect(24, 24, 3, 6, Q[2]);
    p.rect(24, 24, 1, 6, Q[1]);
    for (const [x, c] of [
      [24, ARROW.fletch],
      [26, ARROW.fletch2],
      [25, ARROW.fletch],
    ] as const) {
      p.rect(x, 20, 1, 4, c);
      p.set(x, 19, ARROW.shaft);
    }
  }

  // legs and feet
  legsFront(p, l, liftL, liftR, robe);

  // arms (behind the torso's edges)
  armFront(p, l, 7, 30 + armL, false);
  armFront(p, l, 25, 30 + armR, true);

  // torso
  chestFront(p, l, back);
  if (l.apron && !back) {
    const A = ramp(l.apron);
    p.rect(14, 31, 7, 3, A[2]);
    p.poly(
      [
        [12, 34],
        [22, 34],
        [23, 51],
        [11, 51],
      ],
      (x, y) => (y === 50 ? A[3] : x <= 12 ? A[1] : x >= 22 ? A[3] : (x === 15 || x === 19) && y > 40 ? A[3] : A[2]),
    );
    p.rect(14, 41, 7, 3, A[3]);
    p.rect(15, 42, 5, 1, A[4]);
  } else if (l.apron) {
    // the apron's strings tied at the back
    p.rect(10, 38, 15, 1, ramp(l.apron)[3]);
    p.rect(CX - 1, 38, 3, 3, ramp(l.apron)[2]);
  }

  if (l.cape && back) {
    const C = ramp(l.cape);
    p.poly(
      [
        [9, 30],
        [25, 30],
        [27, 52],
        [7, 52],
      ],
      (x, y) => (y > 50 ? C[4] : x < 11 ? C[1] : x > 23 ? C[3] : (x - 9) % 5 === 0 ? C[3] : C[2]),
    );
    const t = trimOf(l.chest);
    if (t) p.rect(8, 51, 18, 1, t);
  }
  if (l.quiver && back) {
    // across the back, from the right shoulder down to the left hip
    const Q = ramp(l.quiver);
    for (let i = 0; i < 14; i++) {
      const x = 22 - Math.round(i * 0.6);
      const y = 27 + i;
      p.rect(x - 2, y, 5, 1, i === 0 ? Q[1] : Q[2]);
      p.set(x - 2, y, Q[1]);
      p.set(x + 2, y, Q[3]);
    }
    for (const [dx, c] of [
      [-2, ARROW.fletch],
      [0, ARROW.fletch2],
      [2, ARROW.fletch],
    ] as const) {
      p.rect(22 + dx, 22, 1, 5, c);
      p.set(22 + dx, 21, ARROW.shaft);
    }
  }
  if (l.quiver && !back) {
    // the strap across the chest
    const S = BELT;
    for (let i = 0; i < 12; i++) p.set(23 - i, 30 + i, i % 3 === 0 ? S[1] : S[2]);
  }

  // head
  headFront(p, l, skin, hair, back);
}

function legsFront(p: Painter, l: HeroLook, liftL: number, liftR: number, robe: boolean): void {
  const L = l.legs;
  const R = matRamp(L);
  const F = l.feet;
  const FR = matRamp(F);
  for (const [x0, lift, isRight] of [
    [12, liftL, false],
    [19, liftR, true],
  ] as const) {
    const top = robe ? 50 : 43;
    const bottom = 52 - lift;
    // the leg
    if (bottom > top) {
      for (let y = top; y < bottom; y++) {
        for (let x = x0; x < x0 + 4; x++) {
          let c = surf(R, L.mat, x, y, x0, x0 + 3, isRight ? 0 : 0);
          if (L.style === 'greaves' && (y === 47 || y === 48) && x > x0 && x < x0 + 3) c = y === 47 ? R[0] : R[1];
          if (L.mat === 'leather' && x === x0 + 1 && y % 3 === 0) c = R[1];
          p.set(x, y, c);
        }
      }
    }
    // the foot
    const fx = isRight ? x0 : x0 - 1;
    const fTop = (F.style === 'shoes' ? 55 : F.style === 'boots' ? 50 : 51) - lift;
    const fBottom = 58 - lift;
    for (let y = fTop; y <= fBottom; y++) {
      for (let x = fx; x < fx + 5; x++) {
        let c = surf(FR, F.mat, x, y, fx, fx + 4);
        if (y === fBottom) c = FR[4];
        if (F.style === 'boots' && y <= fTop + 1) c = y === fTop ? FR[1] : FR[2];
        if (F.style === 'sabatons' && (y - fTop) % 3 === 2) c = FR[3];
        p.set(x, y, c);
      }
    }
    const t = trimOf(F);
    if (t && F.style !== 'shoes') p.rect(fx, fTop, 5, 1, t);
    const lt = trimOf(L);
    if (lt && L.style === 'greaves' && !robe) p.rect(x0, 46, 4, 1, lt);
  }
}

function armFront(p: Painter, l: HeroLook, x0: number, y0: number, right: boolean): void {
  const C = l.chest;
  const CR = matRamp(C);
  const skin = skinRamp(l.skin);
  const sleeveEnd = C.style === 'tunic' && C.mat === 'cloth' ? y0 + 5 : y0 + 8;
  for (let y = y0; y < y0 + 9; y++) {
    for (let x = x0; x < x0 + 3; x++) {
      // the outer edge of the left arm catches the light; the right arm's outer edge is in shade
      const lit = !right && x === x0;
      const dark = right && x === x0 + 2;
      let c: RGB;
      if (y < sleeveEnd) c = CR[lit ? 1 : dark ? 3 : 2]!;
      else c = skin[lit ? 1 : dark ? 3 : 2]!;
      if (C.mat === 'mail' && y < sleeveEnd && (x + y) % 2 === 0) c = CR[3];
      p.set(x, y, c);
    }
  }
  // robe sleeves flare at the cuff
  if (C.style === 'robe') {
    p.rect(x0 - (right ? 0 : 1), y0 + 6, 4, 2, CR[right ? 3 : 2]);
    const t = trimOf(C);
    if (t) p.rect(x0 - (right ? 0 : 1), y0 + 7, 4, 1, t);
  }
  // shoulder plates
  if (C.style === 'plate') {
    p.ellipse(right ? x0 + 1.5 : x0 + 1.5, y0 + 1.5, 3.5, 2.8, (dx, dy) => (dy < -0.3 ? CR[0] : dx > 0.4 ? CR[3] : CR[1]));
    const t = trimOf(C);
    if (t) p.rect(x0 - 1, y0 + 3, 5, 1, t);
  }
  // the hand
  const H = l.hands;
  const hy = y0 + 9;
  if (!H) {
    p.rect(x0, hy, 3, 3, skin[2]);
    p.set(right ? x0 + 2 : x0, hy + 2, skin[3]);
  } else {
    const HR = matRamp(H);
    // the cuff, a little wider
    p.rect(x0 - 1, hy - 2, 5, 2, H.style === 'gauntlets' ? HR[1] : HR[2]);
    p.rect(x0, hy, 3, 3, HR[2]);
    p.set(right ? x0 : x0 + 2, hy, HR[1]);
    p.set(right ? x0 + 2 : x0, hy + 2, HR[3]);
    if (H.style === 'gauntlets') p.rect(x0, hy, 3, 1, HR[0]);
    const t = trimOf(H);
    if (t) p.rect(x0 - 1, hy - 2, 5, 1, t);
  }
}

function chestFront(p: Painter, l: HeroLook, back: boolean): void {
  const C = l.chest;
  const R = matRamp(C);
  const t = trimOf(C);
  if (C.style === 'robe') {
    p.poly(
      [
        [10, 29],
        [24, 29],
        [26, 56],
        [8, 56],
      ],
      (x, y) => {
        const half = 7 + ((y - 29) / 27) * 2;
        let c = surf(R, C.mat, x, y, CX - half, CX + half);
        // folds in the skirt
        if (y > 43 && (x === 12 || x === 17 || x === 22) && y % 4 !== 0) c = R[3];
        if (y === 55) c = R[4];
        return c;
      },
    );
    if (!back) {
      // the collar: a V of the robe's lining
      for (let i = 0; i < 5; i++) {
        p.set(CX - 3 + i, 29 + i, R[3]);
        p.set(CX + 3 - i, 29 + i, R[3]);
      }
      p.rect(CX - 1, 29, 3, 3, skinRamp(l.skin)[3]);
      if (t)
        for (let i = 0; i < 5; i++) {
          p.set(CX - 4 + i, 29 + i, t);
          p.set(CX + 4 - i, 29 + i, t);
        }
    }
    // the sash
    const S = t ? ramp(t) : ramp(tone(R[2], -0.35));
    p.rect(10, 40, 15, 2, S[2]);
    p.rect(10, 40, 15, 1, S[1]);
    if (!back) p.rect(CX - 1, 40, 2, 4, S[3]);
    if (t) p.rect(8, 54, 19, 1, t);
    gem(p, l.chest, CX, 36, back);
    return;
  }
  // tunic and plate stop at the hips, with a skirt below the belt
  const bottom = 42;
  p.poly(
    [
      [10, 29],
      [24, 29],
      [24, bottom],
      [10, bottom],
    ],
    (x, y) => surf(R, C.mat, x, y, 10, 24),
  );
  if (C.style === 'plate') {
    // the breastplate: a ridge down the middle, a rim at the neck
    if (!back) {
      for (let y = 31; y < bottom; y++) p.set(CX, y, R[0]);
      p.rect(13, 29, 9, 1, R[3]);
    }
    // faulds: overlapping plates below the belt (mail: a mail skirt)
    for (let y = bottom + 1; y < bottom + 6; y++) {
      for (let x = 10; x <= 24; x++) {
        let c = surf(R, C.mat, x, y, 10, 24);
        if (C.mat === 'plate' && (y - bottom) % 2 === 0) c = R[3];
        p.set(x, y, c);
      }
    }
  } else {
    // a tunic: laces (leather) or a plain collar (cloth), and a skirt
    if (!back) {
      if (C.mat === 'leather') {
        for (let y = 31; y < 39; y++) p.set(CX + (y % 2 ? 0 : -1), y, R[4]);
        for (let y = 31; y < 39; y += 2) p.set(CX - 2, y, R[1]);
      }
      p.rect(CX - 2, 29, 5, 2, skinRamp(l.skin)[3]);
    }
    for (let y = bottom + 1; y < bottom + 4; y++) for (let x = 10; x <= 24; x++) p.set(x, y, surf(R, C.mat, x, y, 10, 24, y === bottom + 3 ? 1 : 0));
    if (C.mat === 'leather') for (let x = 11; x < 24; x += 2) p.set(x, bottom + 3, R[1]);
  }
  if (t) {
    p.rect(10, bottom + (C.style === 'plate' ? 5 : 3), 15, 1, t);
    if (!back) p.rect(13, 29, 9, 1, t);
  }
  // the belt and its buckle
  p.rect(10, bottom - 1, 15, 2, BELT[2]);
  p.rect(10, bottom - 1, 15, 1, BELT[1]);
  if (!back) {
    p.rect(CX - 1, bottom - 1, 3, 2, GOLD[2]);
    p.set(CX - 1, bottom - 1, GOLD[0]);
  }
  gem(p, l.chest, CX, 34, back);
}

/** Legendary pieces carry a glowing stone. */
function gem(p: Painter, piece: Piece, x: number, y: number, hidden: boolean): void {
  if (piece.r !== 'legendary' || hidden) return;
  const G = ramp('#ff9a3d');
  p.rect(x - 1, y - 1, 3, 3, G[2]);
  p.set(x - 1, y - 1, G[0]);
  p.set(x + 1, y + 1, G[3]);
}

function headFront(p: Painter, l: HeroLook, skin: Ramp, hair: Ramp, back: boolean): void {
  const H = l.head;
  // neck
  p.rect(CX - 2, 27, 5, 3, skin[3]);
  // long hair falls behind the shoulders
  if (l.hairStyle === 'long' && H?.style !== 'hood' && H?.style !== 'helm') {
    if (back) p.rect(10, 20, 15, 12, hair[2]);
    else {
      p.rect(8, 19, 3, 13, hair[2]);
      p.rect(24, 19, 3, 13, hair[3]);
    }
  }
  if (l.hairStyle === 'pony' && back && H?.style !== 'hood') {
    p.rect(CX - 1, 24, 3, 9, hair[2]);
    p.set(CX - 1, 24, hair[1]);
  }
  // the head
  p.ellipse(CX, 21, 7.5, 7.5, (dx, dy) => {
    if (back) return dy < 0.2 ? hair[2] : hair[3];
    return dx < -0.55 ? skin[1] : dx > 0.6 || dy > 0.75 ? skin[3] : skin[2];
  });
  if (H?.style === 'hood') {
    hoodFront(p, l, H, skin, back);
    return;
  }
  // hair, with a jagged fringe in front
  p.ellipse(CX, 18.5, 8, 6.5, (dx, dy, x, y) => {
    if (!back && y >= 19 + (x % 3 === 0 ? 1 : 0) && dx > -0.85 && dx < 0.85) return null;
    return dy < -0.5 ? hair[1] : dx > 0.5 ? hair[3] : hair[2];
  });
  if (!back) {
    p.rect(9, 19, 2, 5, hair[2]);
    p.rect(24, 19, 2, 5, hair[3]);
  }
  if (!back) face(p, skin, 0);
  if (l.beard && !back) {
    const B = ramp(l.beard);
    p.ellipse(CX, 28, 5.6, 4.6, (dx, dy) => (dy < -0.4 ? B[1] : dx > 0.4 ? B[3] : B[2]));
    p.rect(CX - 3, 23, 7, 3, B[2]);
    p.rect(CX - 2, 25, 5, 1, skin[4]);
  }
  if (!H) return;
  const R = matRamp(H);
  const t = trimOf(H);
  switch (H.style) {
    case 'wizard': {
      // a wide brim and a tall bent cone
      p.ellipse(CX, 17.5, 11.5, 2.6, (dx, dy) => (dy < 0 ? R[2] : dx > 0.3 ? R[4] : R[3]));
      p.poly(
        [
          [10, 17],
          [24, 17],
          [21, 7],
          [26, 1],
          [18, 5],
        ],
        (x, y) => surf(R, H.mat, x, y, 10 + (17 - y) * 0.3, 24 - (17 - y) * 0.4),
      );
      p.rect(11, 14, 13, 2, t ?? GOLD[2]);
      p.rect(11, 14, 13, 1, t ? tone(t, 0.3) : GOLD[1]);
      gem(p, H, CX, 15, back);
      break;
    }
    case 'helm': {
      p.ellipse(CX, 19, 8.6, 7.6, (_dx, dy, x, y) => (y > 21 ? null : surf(R, H.mat, x, y, 8, 26, dy < -0.6 ? -1 : 0)));
      p.rect(8, 20, 19, 2, R[3]);
      if (t) p.rect(8, 20, 19, 1, t);
      if (!back) {
        // cheek guards and a nose guard; the face shows between
        p.rect(8, 22, 3, 6, R[2]);
        p.rect(24, 22, 3, 6, R[3]);
        p.rect(CX - 1, 21, 2, 4, R[1]);
      } else {
        p.rect(9, 22, 17, 4, R[3]);
        p.rect(9, 22, 17, 1, R[2]);
      }
      // a plume on the better ones
      if (H.r === 'epic' || H.r === 'legendary' || H.r === 'rare') {
        const P = ramp(H.r === 'rare' ? '#c9473b' : H.r === 'epic' ? '#8a4ae6' : '#ff8a3d');
        p.ellipse(CX + 1, 9.5, 2.2, 3.5, (dx) => (dx < 0 ? P[1] : P[3]));
        p.rect(CX, 11, 2, 2, P[2]);
      }
      gem(p, H, CX, 17, back);
      break;
    }
    case 'cap': {
      p.ellipse(CX, 17.5, 8.4, 5.5, (_dx, dy, x, y) => (y > 19 ? null : surf(R, H.mat, x, y, 9, 26, dy < -0.5 ? -1 : 0)));
      p.rect(9, 18, 17, 2, R[3]);
      if (t) p.rect(9, 18, 17, 1, t);
      if (H.r !== 'common') {
        // a feather
        const F = ramp(H.r === 'uncommon' ? '#e8e0c8' : H.r === 'rare' ? '#4ab0e0' : H.r === 'epic' ? '#c94aa8' : '#ff8a3d');
        for (let i = 0; i < 8; i++) {
          p.set(23 + Math.round(i * 0.5), 15 - i, F[i < 2 ? 3 : 1]);
          if (i > 1 && i < 7) p.set(24 + Math.round(i * 0.5), 15 - i, F[2]);
        }
      }
      break;
    }
    case 'crown': {
      // a circlet with points and a stone
      const G = H.mat === 'gold' ? GOLD : R;
      for (let x = 10; x <= 24; x++) {
        const y = 15 + Math.round(Math.abs(x - CX) * 0.12);
        p.set(x, y, G[1]);
        p.set(x, y + 1, G[3]);
      }
      for (const x of [11, 14, 17, 20, 23]) {
        const hgt = x === 17 ? 4 : x === 14 || x === 20 ? 3 : 2;
        p.rect(x, 15 - hgt, 1, hgt, G[x < 17 ? 1 : 2]);
      }
      const gemC = ramp(H.r === 'legendary' ? '#ff9a3d' : H.r === 'epic' ? '#c94aff' : H.r === 'rare' ? '#4ab0ff' : '#e84a5a');
      if (!back) {
        p.rect(CX - 1, 14, 2, 2, gemC[2]);
        p.set(CX - 1, 14, gemC[0]);
      }
      break;
    }
    default:
      break;
  }
}

function hoodFront(p: Painter, l: HeroLook, H: Piece, skin: Ramp, back: boolean): void {
  const R = matRamp(H);
  // the mantle over the shoulders
  p.poly(
    [
      [9, 26],
      [25, 26],
      [27, 33],
      [7, 33],
    ],
    (x, y) => surf(R, H.mat, x, y, 7, 27, y === 32 ? 1 : 0),
  );
  // the hood around the head, with a point at the top
  p.ellipse(CX, 20, 9, 9.5, (_dx, dy, x, y) => surf(R, H.mat, x, y, 8, 26, dy < -0.6 ? -1 : 0));
  p.poly(
    [
      [14, 12],
      [20, 12],
      [CX, 8],
    ],
    R[1],
  );
  if (!back) {
    // the face in the opening, shadowed under the brim
    p.ellipse(CX, 23, 5.6, 5.4, (dx, dy) => (dy < -0.45 ? skin[4] : dy < -0.1 ? skin[3] : dx < -0.5 ? skin[1] : skin[2]));
    face(p, skin, 1);
    const t = trimOf(H);
    if (t) p.ellipse(CX, 23, 6.4, 6.2, (dx, dy) => (Math.sqrt(dx * dx + dy * dy) > 0.86 ? t : null));
  } else {
    // a seam down the back
    for (let y = 13; y < 30; y++) p.set(CX, y, R[3]);
  }
  void l;
}

/** Eyes, a mouth and a little blush. `dy` moves the face down (under a hood). */
function face(p: Painter, skin: Ramp, dy: number): void {
  for (const ex of [13, 20]) {
    p.rect(ex, 22 + dy, 2, 3, EYE);
    p.set(ex + 1, 22 + dy, EYE_HI);
  }
  p.set(CX - 1, 26 + dy, skin[4]);
  p.set(CX, 26 + dy, skin[4]);
  const blush = mixRGB(skin[2], [230, 110, 110], 0.35);
  p.set(11, 25 + dy, blush);
  p.set(23, 25 + dy, blush);
}

/* ---------------------------------------------------------------- side view */

function side(p: Painter, l: HeroLook, pose: Pose): void {
  const skin = skinRamp(l.skin);
  const hair = ramp(l.hair);
  const C = l.chest;
  const CR = matRamp(C);
  const robe = C.style === 'robe';
  // stride: the front leg and the back leg swing apart
  const s = pose.f === 1 ? 1 : pose.f === 2 ? -1 : 0;
  const swing = s * 3;

  if (l.cape) {
    const K = ramp(l.cape);
    p.poly(
      [
        [11, 30],
        [15, 30],
        [12 - s, 51],
        [7 - s, 51],
      ],
      (x) => (x < 10 ? K[3] : K[2]),
    );
  }
  if (l.quiver) {
    const Q = ramp(l.quiver);
    p.rect(9, 28, 4, 14, Q[2]);
    p.rect(9, 28, 1, 14, Q[1]);
    p.rect(12, 28, 1, 14, Q[3]);
    for (const [x, c] of [
      [9, ARROW.fletch],
      [11, ARROW.fletch2],
      [10, ARROW.fletch],
    ] as const) {
      p.rect(x, 23, 1, 5, c);
      p.set(x, 22, ARROW.shaft);
    }
  }

  // the back arm, darker, swinging the other way
  armSide(p, l, -swing, true);
  // legs: the back one first
  legSide(p, l, -swing, true, robe);
  legSide(p, l, swing, false, robe);

  // torso
  if (robe) {
    p.poly(
      [
        [12, 29],
        [22, 29],
        [24, 56],
        [10, 56],
      ],
      (x, y) => {
        let c = surf(CR, C.mat, x, y, 12 - (y - 29) * 0.07, 22 + (y - 29) * 0.07);
        if (y > 44 && x === 15 + s && y % 4 !== 0) c = CR[3];
        if (y === 55) c = CR[4];
        return c;
      },
    );
    const t = trimOf(C);
    const S = t ? ramp(t) : ramp(tone(CR[2], -0.35));
    p.rect(12, 40, 11, 2, S[2]);
    p.rect(12, 40, 11, 1, S[1]);
    if (t) p.rect(10, 54, 15, 1, t);
  } else {
    p.rect(12, 29, 11, 13, CR[2]);
    for (let y = 29; y < 42; y++) {
      p.set(12, y, CR[1]);
      p.set(22, y, CR[3]);
      if (C.mat === 'mail') for (let x = 13; x < 22; x++) if ((x + y) % 2 === 0 && y % 2 === 0) p.set(x, y, CR[3]);
    }
    if (C.style === 'plate') for (let y = 31; y < 41; y++) p.set(20, y, CR[0]);
    const skirt = C.style === 'plate' ? 5 : 3;
    for (let y = 43; y < 43 + skirt; y++) for (let x = 12; x <= 22; x++) p.set(x, y, surf(CR, C.mat, x, y, 12, 22, C.mat === 'plate' && y % 2 === 0 ? 1 : 0));
    p.rect(12, 41, 11, 2, BELT[2]);
    p.rect(12, 41, 11, 1, BELT[1]);
    p.rect(20, 41, 2, 2, GOLD[2]);
    const t = trimOf(C);
    if (t) p.rect(12, 42 + skirt, 11, 1, t);
  }
  if (C.style === 'plate') {
    p.ellipse(17, 31, 4, 3, (dx, dy) => (dy < -0.3 ? CR[0] : dx > 0.4 ? CR[3] : CR[1]));
  }

  // head
  p.rect(16, 27, 4, 3, skin[3]);
  const H = l.head;
  if (H?.style === 'hood') {
    const R = matRamp(H);
    p.poly(
      [
        [11, 26],
        [23, 26],
        [24, 33],
        [10, 33],
      ],
      (x, y) => surf(R, H.mat, x, y, 10, 24, y === 32 ? 1 : 0),
    );
    p.ellipse(17, 20, 8.6, 9.4, (_dx, dy, x, y) => surf(R, H.mat, x, y, 8, 26, dy < -0.6 ? -1 : 0));
    p.poly(
      [
        [10, 14],
        [15, 11],
        [7, 9],
      ],
      R[2],
    );
    // the face turned right, in the opening
    p.ellipse(21, 23, 4.4, 5.2, (_dx, dy) => (dy < -0.45 ? skin[4] : dy < -0.1 ? skin[3] : skin[2]));
    p.rect(22, 23, 2, 3, EYE);
    p.set(23, 23, EYE_HI);
    p.set(25, 25, skin[3]);
    const t = trimOf(H);
    if (t) for (let y = 17; y < 29; y++) p.set(16, y, t);
  } else {
    if (l.hairStyle === 'long' && H?.style !== 'helm') p.rect(10, 20, 6, 12, hair[3]);
    if (l.hairStyle === 'pony' && H?.style !== 'helm') {
      p.rect(9, 21, 3, 9, hair[2]);
      p.set(9, 21, hair[1]);
    }
    p.ellipse(18, 21, 7.2, 7.5, (dx, dy) => (dx < -0.55 ? skin[2] : dy > 0.75 ? skin[3] : dx > 0.55 ? skin[1] : skin[2]));
    // the nose
    p.set(25, 23, skin[2]);
    p.set(25, 24, skin[3]);
    // hair over the back and top of the head
    p.ellipse(17.2, 19, 7.8, 6.8, (dx, dy, x, y) => {
      if (x >= 18 && y >= 19 + (x % 3 === 0 ? 1 : 0)) return null;
      if (x >= 22 && y > 15) return null;
      return dy < -0.5 ? hair[1] : dx < -0.5 ? hair[3] : hair[2];
    });
    p.rect(11, 19, 4, 6, hair[3]);
    // the eye and the mouth
    p.rect(21, 22, 2, 3, EYE);
    p.set(22, 22, EYE_HI);
    p.set(23, 26, skin[4]);
    p.set(20, 25, mixRGB(skin[2], [230, 110, 110], 0.35));
    if (l.beard) {
      const B = ramp(l.beard);
      p.ellipse(21, 28, 4, 3.6, (_dx, dy) => (dy < -0.3 ? B[1] : B[2]));
      p.rect(19, 24, 6, 2, B[2]);
    }
    if (H) {
      const R = matRamp(H);
      const t = trimOf(H);
      switch (H.style) {
        case 'wizard': {
          p.ellipse(18, 17.5, 11, 2.4, (_dx, dy) => (dy < 0 ? R[2] : R[3]));
          p.poly(
            [
              [11, 17],
              [24, 17],
              [20, 7],
              [13, 2],
              [16, 7],
            ],
            (x, y) => surf(R, H.mat, x, y, 11 + (17 - y) * 0.3, 24 - (17 - y) * 0.4),
          );
          p.rect(12, 14, 12, 2, t ?? GOLD[2]);
          p.rect(12, 14, 12, 1, t ? tone(t, 0.3) : GOLD[1]);
          break;
        }
        case 'helm': {
          p.ellipse(17.5, 19, 8.4, 7.6, (_dx, dy, x, y) => (y > 21 ? null : surf(R, H.mat, x, y, 9, 26, dy < -0.6 ? -1 : 0)));
          p.rect(9, 20, 17, 2, R[3]);
          p.rect(10, 22, 7, 6, R[3]);
          p.rect(22, 21, 3, 3, R[2]);
          if (t) p.rect(9, 20, 17, 1, t);
          if (H.r === 'epic' || H.r === 'legendary' || H.r === 'rare') {
            const P = ramp(H.r === 'rare' ? '#c9473b' : H.r === 'epic' ? '#8a4ae6' : '#ff8a3d');
            p.ellipse(14, 10, 4, 2.2, (_dx, dy) => (dy < 0 ? P[1] : P[3]));
          }
          break;
        }
        case 'cap': {
          p.ellipse(17, 17.5, 8.2, 5.4, (_dx, dy, x, y) => (y > 19 ? null : surf(R, H.mat, x, y, 9, 26, dy < -0.5 ? -1 : 0)));
          p.rect(9, 18, 18, 2, R[3]);
          p.rect(24, 19, 3, 1, R[3]);
          if (t) p.rect(9, 18, 16, 1, t);
          if (H.r !== 'common') {
            const F = ramp(H.r === 'uncommon' ? '#e8e0c8' : H.r === 'rare' ? '#4ab0e0' : H.r === 'epic' ? '#c94aa8' : '#ff8a3d');
            for (let i = 0; i < 8; i++) p.set(11 - Math.round(i * 0.6), 16 - i, F[i < 2 ? 3 : 1]);
          }
          break;
        }
        case 'crown': {
          const G = H.mat === 'gold' ? GOLD : R;
          p.rect(11, 15, 13, 1, G[1]);
          p.rect(11, 16, 13, 1, G[3]);
          for (const x of [12, 16, 20, 23]) p.rect(x, 12 + (x === 16 ? 0 : 1), 1, x === 16 ? 3 : 2, G[1]);
          break;
        }
        default:
          break;
      }
    }
  }

  // the front arm, over the body
  armSide(p, l, swing, false);
}

function legSide(p: Painter, l: HeroLook, swing: number, behind: boolean, robe: boolean): void {
  const L = l.legs;
  const R = matRamp(L);
  const F = l.feet;
  const FR = matRamp(F);
  const dark = behind ? 1 : 0;
  const hip = { x: behind ? 15 : 17, y: 43 };
  const foot = { x: hip.x + swing, y: 52 };
  if (!robe) {
    for (let y = hip.y; y < foot.y; y++) {
      const k = (y - hip.y) / (foot.y - hip.y);
      const x0 = Math.round(hip.x + (foot.x - hip.x) * k) - 1;
      for (let x = x0; x < x0 + 4; x++) {
        let c = R[Math.min(4, (x === x0 ? 1 : x === x0 + 3 ? 3 : 2) + dark)]!;
        if (L.style === 'greaves' && y >= 46 && y <= 47 && x === x0 + 2) c = R[dark];
        if (L.mat === 'mail' && (x + y) % 2 === 0) c = R[Math.min(4, 3 + dark)]!;
        p.set(x, y, c);
      }
    }
  }
  // the foot points right
  const fTop = F.style === 'shoes' ? 55 : F.style === 'boots' ? 50 : 51;
  const fx = foot.x - 2;
  for (let y = fTop; y <= 58; y++) {
    const toe = y >= 55 ? 2 : 0;
    for (let x = fx; x < fx + 4 + toe; x++) {
      let c = FR[Math.min(4, (x === fx ? 1 : 2) + dark)]!;
      if (y === 58) c = FR[4];
      if (F.style === 'boots' && y === fTop) c = FR[Math.min(4, 1 + dark)]!;
      if (F.style === 'sabatons' && (y - fTop) % 3 === 2) c = FR[3];
      p.set(x, y, c);
    }
  }
  const t = trimOf(F);
  if (t && F.style !== 'shoes' && !behind) p.rect(fx, fTop, 4, 1, t);
}

function armSide(p: Painter, l: HeroLook, swing: number, behind: boolean): void {
  const C = l.chest;
  const CR = matRamp(C);
  const skin = skinRamp(l.skin);
  const dark = behind ? 1 : 0;
  const sx = behind ? 16 : 18;
  const sy = 30;
  const hx = sx + swing;
  const hy = 40;
  const sleeveEnd = C.style === 'tunic' && C.mat === 'cloth' ? 35 : 38;
  for (let y = sy; y < hy; y++) {
    const k = (y - sy) / (hy - sy);
    const x0 = Math.round(sx + (hx - sx) * k) - 1;
    for (let x = x0; x < x0 + 3; x++) {
      const i = Math.min(4, (x === x0 ? 1 : x === x0 + 2 ? 3 : 2) + dark);
      p.set(x, y, y < sleeveEnd ? CR[i]! : skin[i]!);
    }
  }
  const H = l.hands;
  const HR = H ? matRamp(H) : skin;
  if (H) p.rect(hx - 2, hy - 2, 5, 2, HR[Math.min(4, 2 + dark)]!);
  p.rect(hx - 1, hy, 3, 3, HR[Math.min(4, 2 + dark)]!);
  p.set(hx + 1, hy + 2, HR[3]);
  if (C.style === 'robe' && !behind) {
    p.rect(hx - 2, hy - 3, 5, 2, CR[2]);
    const t = trimOf(C);
    if (t) p.rect(hx - 2, hy - 2, 5, 1, t);
  }
}
