import { mixRGB, OUTLINE_RGB, Painter, ramp, rgb, type RGB } from './kit';

/**
 * Painted icons for skills and talents: a symbol (a flame, a snowflake, a paw…) lit from the top
 * left on a tile of its color. 24 × 24 art pixels; the UI shows them doubled or larger.
 */

export const ICON_SIZE = 24;

type Draw = (p: Painter, c: RGB) => void;

const C = 12;

/** Lines thicker than a pixel. */
function stroke(p: Painter, pts: [number, number][], w: number, c: RGB): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let k = 0; k <= n; k++) p.disc(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, w / 2, c);
  }
}

function star(p: Painter, cx: number, cy: number, r: number, r2: number, n: number, c: RGB, rot = -Math.PI / 2): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 ? r2 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  p.poly(pts, c);
}

const flame: Draw = (p, c) => {
  p.poly(
    [
      [12, 2],
      [17, 9],
      [19, 14],
      [17, 19],
      [12, 21],
      [7, 19],
      [5, 14],
      [8, 10],
      [10, 12],
    ],
    c,
  );
  p.poly(
    [
      [12, 10],
      [15, 15],
      [14, 19],
      [10, 19],
      [9, 15],
    ],
    rgb('#fff2b0'),
  );
};

const GLYPHS: Record<string, Draw> = {
  fire: flame,
  burn: flame,
  rage: (p, c) => {
    flame(p, c);
    stroke(
      p,
      [
        [8, 11],
        [11, 13],
      ],
      1.6,
      OUTLINE_RGB,
    );
    stroke(
      p,
      [
        [16, 11],
        [13, 13],
      ],
      1.6,
      OUTLINE_RGB,
    );
  },
  frost: (p, c) => {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      stroke(
        p,
        [
          [C - Math.cos(a) * 9, C - Math.sin(a) * 9],
          [C + Math.cos(a) * 9, C + Math.sin(a) * 9],
        ],
        2,
        c,
      );
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const x = C + Math.cos(a) * 6;
      const y = C + Math.sin(a) * 6;
      stroke(
        p,
        [
          [x, y],
          [x + Math.cos(a + 0.8) * 3, y + Math.sin(a + 0.8) * 3],
        ],
        1.5,
        c,
      );
      stroke(
        p,
        [
          [x, y],
          [x + Math.cos(a - 0.8) * 3, y + Math.sin(a - 0.8) * 3],
        ],
        1.5,
        c,
      );
    }
  },
  freeze: (p, c) => {
    p.poly(
      [
        [6, 5],
        [18, 5],
        [20, 18],
        [4, 18],
      ],
      c,
    );
    p.rect(7, 7, 3, 7, rgb('#ffffff'));
    p.rect(11, 8, 2, 4, rgb('#ffffff'));
  },
  bolt: (p, c) => {
    p.poly(
      [
        [14, 2],
        [6, 13],
        [11, 13],
        [8, 22],
        [18, 9],
        [13, 9],
      ],
      c,
    );
  },
  shock: (p, c) => {
    GLYPHS.bolt!(p, c);
    for (const [x, y] of [
      [5, 6],
      [19, 16],
      [18, 4],
    ] as const)
      p.rect(x, y, 2, 2, rgb('#ffffff'));
  },
  storm: (p, c) => {
    for (const [x, y, r] of [
      [8, 9, 5],
      [14, 7, 6],
      [18, 10, 4],
    ] as const)
      p.disc(x, y, r, rgb('#c8ccd8'));
    p.rect(5, 9, 16, 5, rgb('#c8ccd8'));
    p.poly(
      [
        [13, 13],
        [9, 19],
        [12, 19],
        [10, 23],
        [16, 16],
        [13, 16],
      ],
      c,
    );
  },
  shield: (p, c) => {
    p.poly(
      [
        [5, 4],
        [19, 4],
        [19, 12],
        [12, 21],
        [5, 12],
      ],
      c,
    );
    p.rect(11, 6, 2, 12, rgb('#fff2b0'));
    p.rect(7, 9, 10, 2, rgb('#fff2b0'));
  },
  heart: (p, c) => {
    p.disc(8.5, 9, 4.5, c);
    p.disc(15.5, 9, 4.5, c);
    p.poly(
      [
        [4, 10],
        [20, 10],
        [12, 20],
      ],
      c,
    );
    p.disc(7.5, 7.5, 1.5, rgb('#ffffff'));
  },
  heal: (p, c) => {
    p.rect(9, 4, 6, 16, c);
    p.rect(4, 9, 16, 6, c);
    p.rect(10, 5, 2, 6, rgb('#ffffff'));
  },
  drop: (p, c) => {
    p.disc(12, 14, 6, c);
    p.poly(
      [
        [12, 3],
        [17, 12],
        [7, 12],
      ],
      c,
    );
    p.rect(9, 12, 2, 3, rgb('#ffffff'));
  },
  bleed: (p, c) => {
    for (const [x, y, s] of [
      [8, 8, 1],
      [15, 11, 0.8],
      [10, 16, 0.7],
    ] as const) {
      p.disc(x, y + 3 * s, 3.5 * s, c);
      p.poly(
        [
          [x, y - 3 * s],
          [x + 3 * s, y + 2 * s],
          [x - 3 * s, y + 2 * s],
        ],
        c,
      );
    }
  },
  poison: (p, c) => {
    GLYPHS.drop!(p, c);
    p.disc(18, 6, 2, c);
    p.disc(5, 7, 1.5, c);
  },
  crit: (p, c) => {
    p.ellipse(C, C, 8, 8, (dx, dy) => (Math.hypot(dx, dy) > 0.72 ? c : null));
    p.ellipse(C, C, 3, 3, c);
    p.rect(11, 1, 2, 6, c);
    p.rect(11, 17, 2, 6, c);
    p.rect(1, 11, 6, 2, c);
    p.rect(17, 11, 6, 2, c);
  },
  mark: (p, c) => {
    GLYPHS.crit!(p, c);
  },
  eye: (p, c) => {
    p.ellipse(C, C, 9, 5, c);
    p.disc(C, C, 3.5, rgb('#1b1428'));
    p.disc(C, C, 1.5, c);
    p.rect(10, 9, 1, 1, rgb('#ffffff'));
  },
  power: (p, c) => {
    // an upward arrow
    p.poly(
      [
        [12, 2],
        [20, 11],
        [15, 11],
        [15, 21],
        [9, 21],
        [9, 11],
        [4, 11],
      ],
      c,
    );
  },
  clock: (p, c) => {
    p.disc(C, C, 9, c);
    p.disc(C, C, 7, rgb('#fff2d8'));
    stroke(
      p,
      [
        [12, 12],
        [12, 6],
      ],
      1.6,
      OUTLINE_RGB,
    );
    stroke(
      p,
      [
        [12, 12],
        [16, 14],
      ],
      1.6,
      OUTLINE_RGB,
    );
  },
  speed: (p, c) => {
    for (const x of [4, 10, 16])
      p.poly(
        [
          [x, 5],
          [x + 5, 12],
          [x, 19],
          [x + 2, 19],
          [x + 7, 12],
          [x + 2, 5],
        ].map(([a, b]) => [a!, b!] as [number, number]),
        c,
      );
  },
  dodge: (p, c) => {
    stroke(
      p,
      [
        [5, 17],
        [8, 9],
        [14, 5],
        [19, 6],
      ],
      3,
      c,
    );
    p.poly(
      [
        [16, 2],
        [22, 6],
        [17, 10],
      ],
      c,
    );
    for (const y of [12, 16, 20]) p.rect(1, y, 4, 1, c);
  },
  skull: (p, c) => {
    p.disc(12, 10, 7.5, c);
    p.rect(8, 15, 8, 5, c);
    p.disc(9, 10, 2.2, OUTLINE_RGB);
    p.disc(15, 10, 2.2, OUTLINE_RGB);
    p.rect(11, 13, 2, 2, OUTLINE_RGB);
    for (const x of [9, 12, 15]) p.rect(x, 18, 1, 2, OUTLINE_RGB);
  },
  curse: (p, c) => {
    // a spiral
    const pts: [number, number][] = [];
    for (let a = 0; a < 12; a += 0.3) pts.push([12 + Math.cos(a) * 0.7 * a, 12 + Math.sin(a) * 0.7 * a]);
    stroke(p, pts, 2.2, c);
  },
  shadow: (p, c) => {
    p.disc(12, 12, 9, c);
    p.disc(15, 9, 7, rgb('#1b1428'));
    p.disc(14, 10, 6, OUTLINE_RGB);
  },
  moon: (p, c) => {
    // a crescent: a disc with a second one cut out of it
    p.disc(12, 12, 9, c);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (Math.hypot(x + 0.5 - 16, y + 0.5 - 9) < 7.5) p.clear(x, y);
  },
  sun: (p, c) => {
    star(p, 12, 12, 11, 6, 8, c);
    p.disc(12, 12, 5.5, rgb('#fff2b0'));
  },
  holy: (p, c) => {
    star(p, 12, 12, 11, 4, 4, c);
    p.disc(12, 12, 3.5, rgb('#ffffff'));
  },
  star: (p, c) => {
    star(p, 12, 12.5, 10, 4.2, 5, c);
  },
  nature: (p, c) => {
    // a leaf
    p.ellipse(13, 11, 6, 9, c);
    stroke(
      p,
      [
        [6, 21],
        [13, 12],
        [15, 4],
      ],
      1.4,
      mixRGB(c, [20, 40, 10], 0.5),
    );
  },
  leaf: (p, c) => GLYPHS.nature!(p, c),
  root: (p, c) => {
    stroke(
      p,
      [
        [3, 20],
        [8, 14],
        [7, 8],
        [12, 4],
      ],
      2.4,
      c,
    );
    stroke(
      p,
      [
        [21, 20],
        [16, 14],
        [17, 8],
        [13, 5],
      ],
      2.4,
      c,
    );
    stroke(
      p,
      [
        [8, 14],
        [14, 13],
      ],
      1.6,
      c,
    );
  },
  paw: (p, c) => {
    p.ellipse(12, 15, 6, 5, c);
    for (const [x, y] of [
      [6, 8],
      [10, 5],
      [14, 5],
      [18, 8],
    ] as const)
      p.disc(x, y, 2.2, c);
  },
  claw: (p, c) => {
    for (const dx of [-5, 0, 5])
      stroke(
        p,
        [
          [8 + dx, 4],
          [16 + dx, 20],
        ],
        2.2,
        c,
      );
  },
  combo: (p, c) => GLYPHS.claw!(p, c),
  bear: (p, c) => {
    p.disc(12, 13, 8, c);
    p.disc(5.5, 6, 3, c);
    p.disc(18.5, 6, 3, c);
    p.ellipse(12, 16, 4, 3, mixRGB(c, [255, 240, 220], 0.4));
    p.disc(12, 14.5, 1.5, OUTLINE_RGB);
    p.disc(9, 10, 1.3, OUTLINE_RGB);
    p.disc(15, 10, 1.3, OUTLINE_RGB);
  },
  wolf: (p, c) => {
    p.poly(
      [
        [4, 3],
        [9, 8],
        [15, 8],
        [20, 3],
        [20, 12],
        [12, 22],
        [4, 12],
      ],
      c,
    );
    p.rect(8, 11, 2, 2, OUTLINE_RGB);
    p.rect(14, 11, 2, 2, OUTLINE_RGB);
    p.rect(11, 17, 2, 2, OUTLINE_RGB);
  },
  demon: (p, c) => {
    p.disc(12, 13, 7.5, c);
    p.poly(
      [
        [5, 9],
        [3, 1],
        [9, 7],
      ],
      c,
    );
    p.poly(
      [
        [19, 9],
        [21, 1],
        [15, 7],
      ],
      c,
    );
    p.rect(8, 11, 3, 2, rgb('#8bff6a'));
    p.rect(13, 11, 3, 2, rgb('#8bff6a'));
    p.rect(9, 16, 6, 1, OUTLINE_RGB);
  },
  chain: (p, c) => {
    for (const [x, y] of [
      [7, 7],
      [12, 12],
      [17, 17],
    ] as const)
      p.ellipse(x, y, 4.5, 3, (dx, dy) => (Math.hypot(dx, dy) > 0.55 ? c : null));
  },
  explode: (p, c) => {
    star(p, 12, 12, 11, 5, 9, c, 0.2);
    star(p, 12, 12, 6, 3, 7, rgb('#fff2b0'));
  },
  spread: (p, c) => {
    p.disc(12, 12, 3, c);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      p.disc(12 + Math.cos(a) * 8, 12 + Math.sin(a) * 8, 1.8, c);
    }
  },
  aoe: (p, c) => {
    for (const r of [10, 6.5, 3]) p.ellipse(C, C, r, r, (dx, dy) => (Math.hypot(dx, dy) > 1 - 1.8 / r ? c : null));
  },
  stun: (p, c) => {
    p.ellipse(12, 14, 9, 4, (dx, dy) => (Math.hypot(dx, dy) > 0.7 ? c : null));
    star(p, 6, 8, 4, 1.8, 5, c);
    star(p, 18, 7, 3.5, 1.5, 5, c);
    star(p, 12, 4, 3, 1.3, 5, c);
  },
  fear: (p, c) => {
    // a ghost
    p.disc(12, 10, 7, c);
    p.rect(5, 10, 14, 9, c);
    for (const x of [5, 10, 15]) p.poly([[x, 19], [x + 4, 19], [x + 2, 22]], c);
    p.ellipse(9.5, 10, 1.5, 2.5, OUTLINE_RGB);
    p.ellipse(14.5, 10, 1.5, 2.5, OUTLINE_RGB);
    p.ellipse(12, 15, 1.5, 2, OUTLINE_RGB);
  },
  drain: (p, c) => {
    stroke(
      p,
      [
        [3, 20],
        [9, 12],
        [14, 13],
        [21, 4],
      ],
      2.6,
      c,
    );
    for (const [x, y] of [
      [6, 9],
      [16, 18],
    ] as const)
      p.disc(x, y, 2, rgb('#ff5a7a'));
  },
  meteor: (p, c) => {
    stroke(
      p,
      [
        [3, 3],
        [12, 12],
      ],
      5,
      mixRGB(c, [255, 240, 180], 0.4),
    );
    p.disc(15, 15, 6, rgb('#7a6a5a'));
    p.disc(13.5, 13.5, 2, rgb('#a8988a'));
  },
  quake: (p, c) => {
    p.rect(2, 14, 20, 8, c);
    stroke(
      p,
      [
        [4, 14],
        [8, 18],
        [12, 15],
        [15, 21],
        [20, 16],
      ],
      1.6,
      OUTLINE_RGB,
    );
    for (const [x, y] of [
      [6, 9],
      [13, 7],
      [18, 10],
    ] as const)
      p.rect(x, y, 3, 3, c);
  },
  split: (p, c) => {
    stroke(
      p,
      [
        [12, 21],
        [12, 12],
      ],
      2.4,
      c,
    );
    for (const dx of [-7, 0, 7])
      stroke(
        p,
        [
          [12, 12],
          [12 + dx, 4],
        ],
        2.4,
        c,
      );
  },
  trap: (p, c) => {
    p.ellipse(12, 15, 9, 5, (dx, dy) => (Math.hypot(dx, dy) > 0.6 ? c : null));
    for (let x = 5; x <= 19; x += 3) p.poly([[x, 14], [x + 1.5, 9], [x + 3, 14]], c);
  },
  arrow: (p, c) => {
    stroke(
      p,
      [
        [4, 20],
        [18, 6],
      ],
      2,
      rgb('#c8a878'),
    );
    p.poly(
      [
        [20, 4],
        [14, 6],
        [18, 10],
      ],
      c,
    );
    p.poly(
      [
        [4, 20],
        [3, 14],
        [7, 17],
      ],
      rgb('#ffffff'),
    );
  },
  sword: (p, c) => {
    p.poly(
      [
        [18, 3],
        [21, 3],
        [21, 6],
        [9, 18],
        [6, 15],
      ],
      c,
    );
    stroke(
      p,
      [
        [4, 13],
        [11, 20],
      ],
      2.2,
      rgb('#ffcf5a'),
    );
    stroke(
      p,
      [
        [7, 17],
        [3, 21],
      ],
      2.4,
      rgb('#7a4a2a'),
    );
  },
  hammer: (p, c) => {
    stroke(
      p,
      [
        [5, 20],
        [14, 11],
      ],
      2.4,
      rgb('#8a5a3a'),
    );
    p.poly(
      [
        [10, 7],
        [16, 1],
        [23, 8],
        [17, 14],
      ],
      c,
    );
  },
  blink: (p, c) => {
    star(p, 15, 10, 7, 2.5, 4, c);
    for (const [x, y] of [
      [4, 17],
      [7, 20],
      [3, 21],
    ] as const)
      p.rect(x, y, 2, 2, c);
  },
  wings: (p, c) => {
    for (const s of [-1, 1]) {
      p.poly(
        [
          [12, 9],
          [12 + s * 10, 3],
          [12 + s * 9, 9],
          [12 + s * 11, 12],
          [12 + s * 8, 15],
          [12 + s * 9, 19],
          [12, 14],
        ],
        c,
      );
    }
    p.disc(12, 12, 2.5, rgb('#ffffff'));
  },
  book: (p, c) => {
    p.rect(4, 5, 16, 15, c);
    p.rect(11, 5, 2, 15, mixRGB(c, [0, 0, 0], 0.4));
    p.rect(6, 8, 4, 1, rgb('#fff2d8'));
    p.rect(14, 8, 4, 1, rgb('#fff2d8'));
    p.rect(6, 11, 4, 1, rgb('#fff2d8'));
  },
};

/** Talent icon names used before this set existed, and what they look like now. */
const ALIAS: Record<string, string> = { nova: 'frost', blood: 'bleed', whirl: 'aoe', armor: 'shield', counter: 'dodge', break: 'stun', fan: 'arrow', rain: 'arrow', fang: 'arrow' };

export const hasGlyph = (name: string): boolean => !!GLYPHS[ALIAS[name] ?? name];

/** A tile with a glyph, in a color. */
export function glyphIcon(name: string, color: string): Painter {
  const p = new Painter(ICON_SIZE, ICON_SIZE);
  const R = ramp(color);
  // the tile: deep at the edges, a soft light in the upper left
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      const corner = (x === 0 || x === ICON_SIZE - 1) && (y === 0 || y === ICON_SIZE - 1);
      if (corner) continue;
      const d = Math.hypot(x - 8, y - 7) / 22;
      p.set(x, y, mixRGB(mixRGB(R[4], [14, 10, 24], 0.55), R[3], Math.max(0, 0.55 - d)));
    }
  }
  // the glyph, drawn on its own layer, then lit and outlined
  const g = new Painter(ICON_SIZE, ICON_SIZE);
  (GLYPHS[ALIAS[name] ?? name] ?? GLYPHS.star!)(g, R[1]);
  const lit = new Painter(ICON_SIZE, ICON_SIZE);
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      if (!g.alpha(x, y)) continue;
      let c = g.color(x, y);
      // edges facing the light are brighter, the others darker
      if (!g.alpha(x - 1, y) || !g.alpha(x, y - 1)) c = mixRGB(c, [255, 255, 240], 0.35);
      else if (!g.alpha(x + 1, y) || !g.alpha(x, y + 1)) c = mixRGB(c, [20, 10, 40], 0.3);
      lit.set(x, y, c);
    }
  }
  lit.outline(OUTLINE_RGB);
  p.stamp(lit, 0, 0);
  // a thin frame
  for (let i = 1; i < ICON_SIZE - 1; i++) {
    p.set(i, 0, R[2]);
    p.set(0, i, R[2]);
    p.set(i, ICON_SIZE - 1, R[4]);
    p.set(ICON_SIZE - 1, i, R[4]);
  }
  return p;
}
