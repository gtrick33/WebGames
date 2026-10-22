import { hash2, noise2 } from '../../core/math';
import { OUTLINE_RGB, Painter, ramp, rgb, type Ramp, type RGB } from './kit';

/**
 * The capital's buildings, painted at art resolution: taverns and inns in timber and plaster, shops
 * with striped awnings, the smithy's open forge, the temple's columns and dome, the keep's towers and
 * battlements, watchtowers on the walls. A building stands on a footprint of tiles (solid ground); its
 * walls fill the lower part of the picture and its roof rises above. Positions are in art pixels.
 */

export type BuildingStyle = 'house' | 'tavern' | 'inn' | 'shop' | 'smithy' | 'temple' | 'keep' | 'tower' | 'hall';

const T = 32;

const ROOFS: Ramp[] = ['#b03a30', '#3a5aa8', '#3a8a4a', '#6a4a8a', '#8a5a2a'].map((c) => ramp(c));
const PLASTER = ramp('#efe0c0');
const TIMBER = ramp('#6a4424');
const STONE = ramp('#a8a8b4');
const DARK_STONE = ramp('#7a7a8a');
const GLASS: RGB = rgb('#ffd86b');
const GLASS_HI: RGB = rgb('#fff2b8');
const FRAME: RGB = rgb('#4a2e18');

/** How tall a style's picture is above its footprint (art px), so the scenery can place it. */
export function buildingRise(style: BuildingStyle, h: number): number {
  return style === 'keep' ? 110 : style === 'tower' ? 96 : style === 'temple' ? 96 : style === 'hall' ? 70 : h * 10 + 36;
}

export function building(style: BuildingStyle, w: number, h: number, seed: number): Painter {
  const W = w * T;
  const rise = buildingRise(style, h);
  const H = h * T + rise;
  const p = new Painter(W + 8, H + 2);
  const r = (n: number): number => hash2(seed, n, 401);
  const ox = 4;
  // the front wall: from the footprint's back third down to the ground
  const ground = H;
  const front = Math.round(h * T * 0.62);
  const wallTop = ground - front - (style === 'tavern' || style === 'inn' ? 34 : style === 'keep' || style === 'temple' || style === 'tower' ? 52 : 20);
  const stone = style === 'temple' || style === 'keep' || style === 'tower' || style === 'smithy' || style === 'hall';
  const roof = ROOFS[Math.floor(r(1) * ROOFS.length)]!;

  const wallRect = (x0: number, y0: number, x1: number, y1: number, mat: Ramp, timbered: boolean): void => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        let c = mat[2]!;
        if (stone || mat === STONE || mat === DARK_STONE) {
          // stone blocks with mortar lines, lit at the top
          const row = Math.floor((y - y0) / 8);
          const off = row % 2 ? 6 : 0;
          const bx = (x - x0 + off) % 12;
          const by = (y - y0) % 8;
          c = by === 0 || bx === 0 ? mat[4]! : by === 1 ? mat[1]! : hash2(Math.floor((x + off) / 12), row, 403 + seed) < 0.3 ? mat[3]! : mat[2]!;
        } else {
          if (noise2(x / 5, y / 5, 405) > 0.7) c = mat[1]!;
          if (timbered) {
            // a timber frame: beams at the edges, every so often, and a cross brace
            const lx = x - x0;
            const ly = y - y0;
            const beam = lx < 3 || x1 - x <= 3 || lx % 28 < 3 || ly < 3 || (ly >= 30 && ly < 33);
            if (beam) c = lx % 28 < 1 || ly < 1 ? TIMBER[1]! : TIMBER[2]!;
          }
        }
        p.set(x, y, c);
      }
    }
    // shade where the wall meets the ground
    for (let x = x0; x < x1; x++) for (let y = y1 - 3; y < y1; y++) p.set(x, y, mat[3]!);
  };

  const window = (x: number, y: number, ww: number, wh: number): void => {
    p.rect(x - 1, y - 1, ww + 2, wh + 2, FRAME);
    p.rect(x, y, ww, wh, GLASS);
    p.rect(x, y, Math.max(2, ww >> 1), Math.max(2, wh >> 2), GLASS_HI);
    p.rect(x + (ww >> 1), y, 1, wh, FRAME);
    p.rect(x, y + (wh >> 1), ww, 1, FRAME);
    p.rect(x - 2, y + wh + 1, ww + 4, 2, TIMBER[2]!);
  };

  const door = (cx: number, dw: number, dh: number, arch = false): void => {
    const x0 = cx - (dw >> 1);
    p.rect(x0 - 2, ground - dh - 2, dw + 4, dh + 2, FRAME);
    for (let y = ground - dh; y < ground; y++) {
      for (let x = x0; x < x0 + dw; x++) {
        if (arch && y < ground - dh + dw / 2 && Math.hypot(x + 0.5 - cx, y - (ground - dh + dw / 2)) > dw / 2) continue;
        p.set(x, y, (x - x0) % 5 === 0 ? TIMBER[3]! : TIMBER[1]!);
      }
    }
    p.set(cx + (dw >> 2), ground - (dh >> 1), rgb('#ffcf5a'));
  };

  /** A pitched roof over [x0, x1), its eave at `eave`, rising to a ridge. */
  const pitched = (x0: number, x1: number, eave: number, height: number, R: Ramp): void => {
    for (let y = 0; y < height; y++) {
      const inset = Math.round(((height - y) / height) * Math.min(26, (x1 - x0) * 0.22));
      const yy = eave - y;
      for (let x = x0 - 3 + inset; x < x1 + 3 - inset; x++) {
        const shingle = (y % 6 === 0 ? 3 : (x + (Math.floor(y / 6) % 2) * 4) % 8 === 0 ? 3 : 2) as 2 | 3;
        p.set(x, yy, y > height - 3 ? R[1]! : R[shingle]!);
      }
    }
    for (let x = x0 - 3; x < x1 + 3; x++) p.set(x, eave + 1, R[4]!);
  };

  const chimney = (x: number, top: number, hgt: number): void => {
    for (let y = top; y < top + hgt; y++) for (let xx = x; xx < x + 10; xx++) p.set(xx, y, (y - top) % 6 === 0 ? DARK_STONE[4]! : xx < x + 3 ? DARK_STONE[1]! : DARK_STONE[2]!);
    p.rect(x - 1, top, 12, 3, DARK_STONE[3]!);
  };

  const sign = (x: number, y: number, kind: 'mug' | 'bed' | 'bag' | 'anvil'): void => {
    p.rect(x - 1, y - 4, 16, 1, TIMBER[3]!);
    p.rect(x, y - 4, 1, 4, TIMBER[3]!);
    p.rect(x + 13, y - 4, 1, 4, TIMBER[3]!);
    p.rect(x - 1, y, 16, 14, TIMBER[1]!);
    p.rect(x, y + 1, 14, 12, TIMBER[2]!);
    const ink = rgb('#3a2414');
    const gold = rgb('#ffcf5a');
    if (kind === 'mug') {
      p.rect(x + 3, y + 3, 6, 8, gold);
      p.rect(x + 9, y + 5, 2, 4, gold);
      p.rect(x + 3, y + 3, 6, 2, rgb('#ffffff'));
    } else if (kind === 'bed') {
      p.rect(x + 2, y + 7, 10, 3, ink);
      p.rect(x + 2, y + 5, 3, 2, rgb('#ffffff'));
      p.rect(x + 2, y + 10, 1, 2, ink);
      p.rect(x + 11, y + 10, 1, 2, ink);
    } else if (kind === 'bag') {
      p.disc(x + 7, y + 8, 4, gold);
      p.rect(x + 5, y + 2, 4, 3, gold);
    } else {
      p.rect(x + 2, y + 5, 10, 3, ink);
      p.rect(x + 5, y + 8, 4, 3, ink);
      p.rect(x + 3, y + 11, 8, 2, ink);
    }
  };

  const battlements = (x0: number, x1: number, y: number, mat: Ramp): void => {
    for (let x = x0; x < x1; x++) {
      const merlon = Math.floor((x - x0) / 7) % 2 === 0;
      for (let yy = y - (merlon ? 8 : 3); yy < y + 2; yy++) p.set(x, yy, yy < y - 6 ? mat[1]! : mat[2]!);
    }
  };

  const banner = (x: number, y: number, color: string): void => {
    const B = ramp(color);
    p.rect(x, y - 4, 1, 34, TIMBER[3]!);
    for (let yy = y; yy < y + 22; yy++) {
      const cut = yy > y + 16 ? (yy - (y + 16)) : 0;
      for (let xx = x + 1 + cut; xx < x + 11 - cut; xx++) p.set(xx, yy, xx < x + 4 ? B[1]! : B[2]!);
    }
    p.disc(x + 6, y + 8, 2, rgb('#ffcf5a'));
  };

  switch (style) {
    case 'house':
    case 'tavern':
    case 'inn':
    case 'shop': {
      const timbered = style !== 'shop';
      wallRect(ox + 2, wallTop, ox + W - 2, ground, PLASTER, timbered);
      const floors = style === 'tavern' || style === 'inn' ? 2 : 1;
      // windows on each floor
      const span = W - 16;
      const count = Math.max(2, Math.floor(span / 34));
      for (let f = 0; f < floors; f++) {
        const wy = f === 0 ? ground - 30 : wallTop + 10;
        for (let i = 0; i < count; i++) {
          const wx = ox + 10 + Math.round((i * (span - 14)) / Math.max(1, count - 1));
          if (f === 0 && Math.abs(wx + 7 - (ox + W / 2)) < 16) continue;
          window(wx, wy, 14, 12);
        }
      }
      door(ox + Math.round(W / 2), 14, 24, style === 'inn');
      pitched(ox + 2, ox + W - 2, wallTop - 1, Math.min(rise - 4, 26 + h * 6), roof);
      if (r(2) < 0.8) chimney(ox + Math.round(W * (r(3) < 0.5 ? 0.25 : 0.7)), wallTop - Math.min(rise - 4, 26 + h * 6) - 2, 16);
      if (style === 'tavern') sign(ox + Math.round(W / 2) + 12, ground - 52, 'mug');
      if (style === 'inn') sign(ox + Math.round(W / 2) + 12, ground - 52, 'bed');
      if (style === 'shop') {
        // a striped awning over the front
        const A = ramp(r(4) < 0.5 ? '#c9473b' : '#3a7ac0');
        for (let y = ground - 40; y < ground - 32; y++) for (let x = ox + 6; x < ox + W - 6; x++) p.set(x, y, Math.floor((x - ox) / 6) % 2 ? A[2]! : rgb('#f2ead8'));
        for (let x = ox + 6; x < ox + W - 6; x += 6) p.rect(x, ground - 32, 3, 2, A[3]!);
        sign(ox + 8, ground - 58, 'bag');
      }
      break;
    }
    case 'smithy': {
      wallRect(ox + 2, wallTop, ox + W - 2, ground, STONE, false);
      // the open forge front: a dark bay with the fire's glow
      const bx = ox + 10;
      const bw = Math.round(W * 0.45);
      p.rect(bx, ground - 30, bw, 30, rgb('#2a1a14'));
      for (let y = ground - 14; y < ground; y++) for (let x = bx + 4; x < bx + bw - 4; x++) p.set(x, y, hash2(x, y, 409) < 0.5 ? rgb('#ff7a2a') : rgb('#ffcf5a'));
      p.rect(bx - 2, ground - 32, bw + 4, 3, TIMBER[2]!);
      window(ox + W - 30, ground - 30, 14, 12);
      pitched(ox + 2, ox + W - 2, wallTop - 1, 24 + h * 4, ROOFS[4]!);
      chimney(ox + W - 26, wallTop - 30 - h * 4, 22);
      sign(ox + W - 30, ground - 56, 'anvil');
      break;
    }
    case 'temple': {
      const S = ramp('#e8e0d0');
      // a portico: a shadowed hall behind a row of columns, on steps, under a pediment and a dome
      for (let y = wallTop; y < ground - 10; y++) for (let x = ox + 10; x < ox + W - 10; x++) p.set(x, y, y < wallTop + 8 ? rgb('#4a4254') : rgb('#5e566a'));
      for (let s2 = 0; s2 < 3; s2++) p.rect(ox + 4 + s2 * 4, ground - 10 + s2 * 3, W - 8 - s2 * 8, 3, S[s2 === 0 ? 1 : 2]!);
      const cols = Math.max(4, Math.floor(W / 30));
      for (let i = 0; i < cols; i++) {
        const cx = ox + 14 + Math.round((i * (W - 36)) / (cols - 1));
        for (let y = wallTop + 4; y < ground - 10; y++) for (let x = cx; x < cx + 8; x++) p.set(x, y, x < cx + 2 ? S[0]! : x > cx + 5 ? S[3]! : (x + y) % 9 === 0 ? S[2]! : S[1]!);
        p.rect(cx - 2, wallTop + 2, 12, 3, S[2]!);
        p.rect(cx - 2, ground - 13, 12, 3, S[2]!);
      }
      door(ox + Math.round(W / 2), 18, 34, true);
      p.rect(ox + 6, wallTop - 4, W - 12, 6, S[2]!);
      p.rect(ox + 6, wallTop + 1, W - 12, 1, S[3]!);
      const peak = wallTop - 30;
      for (let y = peak; y < wallTop - 4; y++) {
        const inset = Math.round(((wallTop - 4 - y) / (wallTop - 4 - peak)) * (W / 2 - 8));
        for (let x = ox + 6 + inset; x < ox + W - 6 - inset; x++) p.set(x, y, y > wallTop - 7 ? S[3]! : x < ox + W / 2 ? S[1]! : S[2]!);
      }
      p.disc(ox + W / 2, wallTop - 14, 5, rgb('#ffd86b'));
      // the dome rises behind the pediment
      p.ellipse(ox + W / 2, peak - 2, 30, 24, (dx, dy) => (dy > 2 ? null : rgb(dx < -10 && dy < -8 ? '#9ac8f0' : dx > 12 ? '#3a6aa8' : '#4a7ab8')));
      p.rect(ox + Math.round(W / 2) - 1, peak - 40, 3, 16, rgb('#ffcf5a'));
      p.disc(ox + W / 2, peak - 40, 4, rgb('#ffcf5a'));
      break;
    }
    case 'keep':
    case 'hall': {
      const M = style === 'keep' ? DARK_STONE : STONE;
      const towerW = style === 'keep' ? 34 : 0;
      wallRect(ox + towerW - 4, wallTop, ox + W - towerW + 4, ground, M, false);
      battlements(ox + towerW - 4, ox + W - towerW + 4, wallTop, M);
      // towers at the corners, taller, with pointed roofs
      if (towerW) {
        for (const tx of [ox, ox + W - towerW]) {
          wallRect(tx, wallTop - 40, tx + towerW, ground, M, false);
          pitched(tx + 2, tx + towerW - 2, wallTop - 41, 34, ROOFS[1]!);
          window(tx + 12, wallTop - 20, 10, 14);
          window(tx + 12, ground - 50, 10, 14);
        }
        banner(ox + towerW + 14, wallTop + 10, '#c9473b');
        banner(ox + W - towerW - 26, wallTop + 10, '#c9473b');
      } else {
        pitched(ox + 2, ox + W - 2, wallTop - 4, 30, roof);
      }
      // the great gate
      const gw = style === 'keep' ? 30 : 20;
      door(ox + Math.round(W / 2), gw, style === 'keep' ? 42 : 30, true);
      const n = Math.floor((W - towerW * 2) / 40);
      for (let i = 0; i < n; i++) {
        const wx = ox + towerW + 16 + i * 40;
        if (Math.abs(wx + 5 - (ox + W / 2)) < gw) continue;
        window(wx, wallTop + 22, 10, 16);
      }
      break;
    }
    case 'tower': {
      wallRect(ox + 4, wallTop, ox + W - 4, ground, STONE, false);
      battlements(ox + 2, ox + W - 2, wallTop, STONE);
      window(ox + Math.round(W / 2) - 5, wallTop + 18, 10, 14);
      p.rect(ox + Math.round(W / 2) - 1, wallTop - 30, 2, 22, TIMBER[3]!);
      for (let y = wallTop - 30; y < wallTop - 18; y++) for (let x = ox + Math.round(W / 2) + 1; x < ox + Math.round(W / 2) + 14 - (y - (wallTop - 30)) / 2; x++) p.set(x, y, rgb('#c9473b'));
      break;
    }
  }
  p.outline(OUTLINE_RGB);
  return p;
}
