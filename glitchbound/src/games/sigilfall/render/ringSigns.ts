import { FIELD, FX, type Fx3D } from '../render3d/fx3d';
import { screenAngle, shortened } from './effects';

/**
 * Each ability's own look in the Ring (the owner, 2026-11-16: "go over every passive, every active spell and make sure
 * the animations, the effects and the visuals are mesmerizing, unique ... whether everything has its purpose"). Until
 * then an ability was drawn by its school alone: every fire spell the same burst, every frost spell the same ring of
 * shards, every blow the same white cut. Here each has a sign of its own for the moment it is used (`cast`, on its
 * user), the moment it lands (`land`, on whoever it hit) and, for what is placed, the moment its patch comes down
 * (`zone`), made of the same few shapes the rest of the game is drawn with (render3d/fx3d.ts), in its own colors.
 *
 * A sign says something about what the ability does: what stuns ends in a ring of force, what bleeds throws red, what
 * roots comes up out of the ground, what heals rises, what silences crosses out, a combo's payoff is bigger than its
 * setup. Nothing here changes a match: it is only drawn, from the match's events (render/ring.ts RingFx.take).
 */

export type SignKind = 'cast' | 'land' | 'zone';

/** A sign being drawn: which ability's, where (on a fighter, who may walk on, or a spot), which way, and how far along. */
export interface Sign {
  ab: string;
  k: SignKind;
  /** The fighter it is on, if it is on one: drawn where they are now. */
  on?: number;
  x: number;
  y: number;
  /** The way it faces along the ground: its user's facing for a cast, from its user to its target for a landing. */
  a: number;
  t: number;
  dur: number;
  seed: number;
  /** A placed ability's reach. */
  r?: number;
}

type Q = Parameters<Fx3D['put']>[0];

/** The brush a sign is painted with: where it is, how far along, and the few strokes signs are made of. */
class Brush {
  /** 0 to 1 along its time. */
  readonly u: number;
  /** The same, eased: fast out, slow to finish. */
  readonly e: number;
  readonly fade: number;
  constructor(
    private readonly q: Fx3D,
    readonly x: number,
    readonly y: number,
    readonly a: number,
    readonly s: Sign,
    readonly time: number,
  ) {
    this.u = Math.min(1, Math.max(0, s.t / s.dur));
    this.e = 1 - (1 - this.u) * (1 - this.u);
    this.fade = Math.max(0, 1 - this.u * this.u);
  }

  put(o: Omit<Q, 'x' | 'y'> & { dx?: number; dy?: number }): void {
    const { dx, dy, ...rest } = o;
    this.q.put({ x: this.x + (dx ?? 0), y: this.y + (dy ?? 0), ...rest } as Q);
  }

  /** A ring of force racing out along the ground. */
  shock(r: number, color: string, alpha = 1): void {
    this.put({ kind: FX.shock, flat: true, w: r * 2 * this.e, a: color, t: this.u, seed: this.s.seed, alpha });
  }

  /** A thin ring, out to `r`. */
  ring(r: number, color: string, from = 0.3): void {
    this.put({ kind: FX.ring, flat: true, w: r * 2 * (from + (1 - from) * this.e), a: color, t: this.u, alpha: this.fade, seed: this.s.seed });
  }

  /** The ground broken, lit from below. */
  crack(w: number, color: string): void {
    this.put({ kind: FX.crack, flat: true, w, a: color, b: '#1a0f0a', t: this.u * 0.85, seed: this.s.seed });
  }

  /** A magic circle underfoot. */
  circle(w: number, color: string, b = '#ffffff'): void {
    this.put({ kind: FX.rune, flat: true, w, a: color, b, t: this.u, seed: this.s.seed });
  }

  /** The ground itself taken by something for a moment: frost, a consecration, roots, a rift. */
  ground(pattern: number, r: number, a: string, b: string): void {
    this.put({ kind: FX.field, flat: true, w: r * 2, a, b, t: 1, alpha: Math.min(1, this.u * 6) * this.fade, seed: this.s.seed, p1: pattern });
  }

  /** A column standing up out of the ground. */
  pillar(w: number, h: number, a: string, b: string): void {
    this.put({ kind: FX.column, base: true, w, h, a, b, t: this.u, seed: this.s.seed });
  }

  /** A shaft of light from above. */
  shaft(w: number, h: number, a: string, b = '#ffffff'): void {
    this.put({ kind: FX.shaft, base: true, w, h, a, b, t: this.u, alpha: this.fade });
  }

  /** A soft light. */
  glow(w: number, color: string, alpha = 0.6, up = 10): void {
    this.put({ kind: FX.glow, up, w, a: color, alpha: alpha * this.fade });
  }

  /** A cut lying over the ground at body height: `turn` from the sign's own way, `arc` how far round it sweeps. */
  cut(turn: number, r: number, color: string, opts: { edge?: string; arc?: number; heavy?: boolean; up?: number; delay?: number; ox?: number } = {}): void {
    const d = opts.delay ?? 0;
    const u = (this.u - d) / Math.max(0.05, 1 - d);
    if (u < 0 || u > 1) return;
    const ox = opts.ox ?? 0;
    this.put({ kind: FX.slash, dx: Math.cos(this.a) * ox, dy: Math.sin(this.a) * ox, up: opts.up ?? 13, flat: true, w: (r * 2) / 0.82, rot: this.a + turn, a: color, b: opts.edge, t: u, p1: opts.arc ?? 1.6, p2: opts.heavy ? 1 : 0 });
  }

  /** Many of one thing thrown out round the middle, rising and falling as they go. */
  spray(kind: number, n: number, reach: number, w: number, a: string, opts: { b?: string; h?: number; rise?: number; spin?: number; up?: number; flatY?: number; from?: number } = {}): void {
    const from = opts.from ?? 0;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + this.s.seed + (i % 2) * 0.3;
      const r = reach * (from + (1 - from) * this.e) * (0.75 + ((i * 37) % 10) * 0.05);
      this.put({
        kind: kind as Q['kind'],
        dx: Math.cos(ang) * r,
        dy: Math.sin(ang) * r * (opts.flatY ?? 0.6),
        up: (opts.up ?? 10) + Math.sin(this.u * Math.PI) * (opts.rise ?? 12),
        w,
        h: opts.h,
        rot: opts.spin !== undefined ? ang + this.u * opts.spin : undefined,
        a,
        b: opts.b ?? '#ffffff',
        alpha: this.fade,
        t: this.u * 0.6,
        seed: this.s.seed + i,
      });
    }
  }

  /** Things standing in a ring round the middle, come up out of the ground: spikes of ice, thorns, roots. */
  stand(n: number, r: number, h: number, w: number, a: string, b: string, kind: number = FX.frost): void {
    const up = Math.min(1, this.u * 5);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + this.s.seed;
      const lean = Math.cos(ang) * 0.35;
      this.put({ kind: kind as Q['kind'], dx: Math.cos(ang) * r, dy: Math.sin(ang) * r * 0.6, up: (h * up) / 2, w: h * up, h: w, rot: Math.PI / 2 - lean, a, b, alpha: this.fade, seed: this.s.seed + i });
    }
  }

  /** Motes going up in a spiral round the middle: something given, something mending. */
  helix(n: number, r: number, h: number, w: number, a: string, b: string, kind: number = FX.spark): void {
    for (let i = 0; i < n; i++) {
      const ph = (this.u * 1.2 + i / n) % 1;
      const ang = ph * Math.PI * 4 + (i % 2) * Math.PI + this.s.seed;
      this.put({ kind: kind as Q['kind'], dx: Math.cos(ang) * r * (1 - ph * 0.4), dy: Math.sin(ang) * r * 0.55 * (1 - ph * 0.4), up: 3 + ph * h, w: w * (1 - ph * 0.5), h: kind === FX.leaf ? w * 0.6 : undefined, rot: kind === FX.leaf ? ang * 2 : undefined, a: i % 2 ? a : b, b, alpha: this.fade * (1 - ph * 0.6), t: 0.2, seed: this.s.seed + i });
    }
  }

  /** Something falling out of the sky onto the middle and gone as it lands. */
  drop(kind: number, w: number, h: number, a: string, b: string, from = 120): void {
    const k = Math.min(1, this.u * 3.2);
    if (k >= 1) return;
    this.put({ kind: kind as Q['kind'], dx: (1 - k) * 16, up: (1 - k) * (1 - k) * from + 12, w, h, rot: Math.PI / 2 - 0.25, a, b, seed: this.s.seed });
  }
}

const STEEL = '#fff4e0';
const BLOOD = '#d0283c';
const EMBER = '#ffb02e';
const FIRE = '#ff5a1e';
const ICE = '#7fd4ff';
const RIME = '#e0f8ff';
const GOLD = '#ffd257';
const SUN = '#fff2b0';
const VOID = '#7a3ad8';
const DUSK = '#b48cff';
const NIGHT = '#120a20';
const BLIGHT = '#9ae85a';
const LEAF = '#58c848';
const PETAL = '#ffb8e8';
const MOON = '#cfe0ff';
const TEAL = '#5ad8c8';
const DUST = '#d8c8a8';
const ROSE = '#c02a7a';

type Paint = (b: Brush) => void;
interface Look {
  /** How long each lasts, where the usual (0.5 for a cast, 0.6 for a landing, 0.8 for a patch) isn't right. */
  dur?: Partial<Record<SignKind, number>>;
  cast?: Paint;
  land?: Paint;
  zone?: Paint;
  /** Its landing is drawn as well as its school's own burst, not in place of it. */
  keep?: boolean;
}

/** Every ability's sign, by its id. */
const LOOKS: Record<string, Look> = {
  /* ---------------------------------------------------------------- warrior: steel, blood and broken ground */
  // Hew: one heavy cut down through them, and chips of it flying
  'w-hew': {
    land: (b) => {
      b.cut(0.5, 26, STEEL, { arc: 2.2, heavy: true });
      b.spray(FX.chip, 5, 20, 5, STEEL, { rise: 14 });
    },
  },
  // Festering Gash: three claws of red raked across them, and blood thrown wide: the wound the rest is built on
  'w-gash': {
    dur: { land: 0.75 },
    land: (b) => {
      for (let i = -1; i <= 1; i++) b.cut(1.2 + i * 0.16, 24 + Math.abs(i) * 2, BLOOD, { edge: '#ff8a8a', arc: 1.5, heavy: i === 0, delay: (i + 1) * 0.07, ox: i * 4 });
      b.spray(FX.spark, 9, 26, 6, BLOOD, { b: '#ff7a7a', rise: 6, up: 12 });
      b.ring(20, BLOOD);
    },
  },
  // Bull Rush: dust kicked up where they set off, and a hard knock where they arrive
  'w-rush': {
    cast: (b) => {
      b.spray(FX.smoke, 6, 22, 16, DUST, { rise: 4, up: 4 });
      b.shock(26, DUST, 0.7);
    },
    land: (b) => {
      b.put({ kind: FX.impact, up: 12, w: 46, a: STEEL, b: '#fffdf0', t: b.u, seed: b.s.seed });
      b.shock(30, DUST);
      b.spray(FX.smoke, 5, 18, 14, DUST, { rise: 3, up: 3 });
    },
  },
  // Hurled Maul: iron lands, the ground rings under it
  'w-hurl': {
    land: (b) => {
      b.put({ kind: FX.ball, up: 14 + b.u * 10, w: 13 * (1 - b.u * 0.4), a: '#8a8478', alpha: b.fade });
      b.shock(34, STEEL);
      b.crack(40, EMBER);
      b.spray(FX.chip, 7, 24, 5, '#b8b0a0', { rise: 16 });
    },
  },
  // Quakebreaker: the ground breaks all round, two rings of force and stone thrown up
  'w-super': {
    dur: { cast: 0.9 },
    cast: (b) => {
      b.crack(150, EMBER);
      b.shock(84, EMBER);
      if (b.u > 0.15) b.put({ kind: FX.shock, flat: true, w: 168 * ((b.u - 0.15) / 0.85), a: STEEL, t: (b.u - 0.15) / 0.85, seed: b.s.seed + 3 });
      b.spray(FX.chip, 14, 70, 7, '#a89880', { rise: 30 });
      b.spray(FX.smoke, 10, 60, 22, DUST, { rise: 8, up: 4 });
    },
    land: (b) => {
      b.crack(36, EMBER);
      b.spray(FX.chip, 5, 18, 5, '#a89880', { rise: 18 });
    },
  },
  // Hock Cut: low and quick, at the legs
  'w-hamstring': {
    land: (b) => {
      b.cut(-0.3, 20, STEEL, { arc: 1.3, up: 5 });
      b.spray(FX.spark, 4, 12, 4.5, BLOOD, { rise: 3, up: 5 });
    },
  },
  // Rending Cut: two cuts that cross, and the blood they open
  'w-bleed': {
    dur: { land: 0.7 },
    land: (b) => {
      b.cut(0.8, 24, BLOOD, { edge: '#ff9a9a', arc: 1.7, heavy: true });
      b.cut(-0.8, 24, BLOOD, { edge: '#ff9a9a', arc: 1.7, heavy: true, delay: 0.14 });
      b.spray(FX.spark, 8, 22, 5.5, BLOOD, { b: '#ff7a7a', rise: 4 });
    },
  },
  // Skull Crack: a blow to the head: a burst of light up there, and the ring of it
  'w-crack': {
    land: (b) => {
      b.put({ kind: FX.impact, up: 26, w: 40, a: '#ffe39a', b: '#ffffff', t: b.u, seed: b.s.seed });
      b.put({ kind: FX.holy, up: 28, w: 26 * (1 - b.u * 0.5), a: '#ffe39a', b: '#ffffff', alpha: b.fade, seed: b.s.seed });
      b.shock(24, '#ffe39a');
    },
  },
  // Run Them Down: red rage streaming off them as they go, and a fan of cuts where they arrive
  'w-super2': {
    dur: { cast: 0.7, land: 0.8 },
    cast: (b) => {
      b.put({ kind: FX.rain, base: true, w: 34, h: 54, a: '#ff465a', t: -1, seed: b.s.seed, alpha: b.fade });
      b.shock(36, '#ff465a');
    },
    land: (b) => {
      for (let i = -1; i <= 1; i++) b.cut(i * 0.7, 30, BLOOD, { edge: STEEL, arc: 2, heavy: true, delay: (i + 1) * 0.1 });
      b.crack(54, '#ff465a');
      b.spray(FX.spark, 10, 30, 6, BLOOD, { rise: 10 });
    },
  },

  /* ---------------------------------------------------------------- mage, the Pyre: fire that climbs */
  // Ember Lash: it wraps them in a ring of small flames and leaves embers going up: Kindled
  'm-lash': {
    land: (b) => {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + b.u * 3;
        b.put({ kind: FX.flame, dx: Math.cos(ang) * 11, dy: Math.sin(ang) * 6, up: 2, base: true, w: 9, h: 16 * (1 - b.u * 0.5), a: FIRE, b: EMBER, seed: i + b.s.seed, alpha: b.fade });
      }
      b.put({ kind: FX.rain, base: true, w: 22, h: 40, a: EMBER, t: b.u, seed: b.s.seed, alpha: b.fade });
    },
  },
  // Flashburn: a pillar of fire up through them and the ground scorched under it: the burst
  'm-burn': {
    dur: { land: 0.75 },
    land: (b) => {
      b.pillar(26, 70, FIRE, '#ffe08a');
      b.crack(56, FIRE);
      b.shock(34, EMBER);
      b.spray(FX.spark, 10, 30, 6, EMBER, { rise: 22 });
    },
  },
  // Flicker: a circle of runes where they stood, folding in on itself
  'm-blink': {
    cast: (b) => {
      b.circle(40, '#a05aff');
      b.put({ kind: FX.gather, up: 16, w: 44, a: '#c8a0ff', b: '#ffffff', t: b.u, seed: b.s.seed });
      b.spray(FX.spark, 8, 20, 5, '#e0c8ff', { rise: 20, from: 1 });
    },
  },
  // Toad Hex: a green puff of nonsense, bubbles and all
  'm-toad': {
    land: (b) => {
      b.spray(FX.smoke, 6, 16, 18, '#5ac878', { rise: 10, up: 8 });
      b.spray(FX.water, 6, 22, 6, '#8ae8c0', { b: '#e0fff0', rise: 26 });
      b.circle(34, '#5ac878', '#e0fff0');
    },
  },
  // Cinder Comet: where it comes down, a pillar of fire, the ground split and burning
  'm-super': {
    dur: { zone: 1 },
    zone: (b) => {
      const r = b.s.r ?? 40;
      b.pillar(r * 1.1, 130, FIRE, '#ffe08a');
      b.crack(r * 2.6, FIRE);
      b.shock(r * 1.5, EMBER);
      b.ground(FIELD.fire, r, FIRE, EMBER);
      b.spray(FX.chip, 12, r * 1.3, 7, '#5a3a2a', { rise: 36 });
    },
  },

  /* ---------------------------------------------------------------- mage, the Rime: ice that holds and breaks */
  // Rime Spear: it bursts into frost on them, and the ground under them whitens: slowed
  'm-spear': {
    land: (b) => {
      b.spray(FX.frost, 6, 18, 11, ICE, { b: RIME, h: 4, spin: 0, rise: 6 });
      b.ground(FIELD.frost, 13, ICE, RIME);
      b.spray(FX.flake, 5, 16, 6, RIME, { rise: 14 });
    },
  },
  // Frostfang: one fang of ice driven down into them; on the frozen it is Shatter, and the school's own burst follows
  'm-fang': {
    keep: true,
    land: (b) => {
      b.drop(FX.frost, 34, 9, ICE, RIME, 90);
      if (b.u > 0.3) {
        b.put({ kind: FX.frost, up: 14, w: 26 * (1 - (b.u - 0.3)), h: 8, rot: Math.PI / 2 - 0.25, a: ICE, b: RIME, alpha: b.fade });
        b.ring(18, RIME);
      }
    },
  },
  // Rimeglobe: thrown, it gathers cold as it goes
  'm-globe': {
    cast: (b) => {
      b.put({ kind: FX.gather, up: 18, w: 40, a: ICE, b: RIME, t: b.u, seed: b.s.seed });
      b.spray(FX.flake, 6, 18, 6, RIME, { rise: 16 });
    },
    land: (b) => {
      b.spray(FX.flake, 4, 12, 5, RIME, { rise: 10 });
    },
  },
  // Frostclasp: ice closes on them where they stand: shards up round their feet, a block of it over them, and the ring of a stun
  'm-ring': {
    dur: { land: 0.9 },
    cast: (b) => {
      b.put({ kind: FX.gather, up: 18, w: 34, a: ICE, b: RIME, t: b.u, seed: b.s.seed });
      b.ring(16, RIME);
    },
    land: (b) => {
      b.stand(7, 10, 26, 7, ICE, RIME);
      b.put({ kind: FX.bubble, up: 16, w: 30, a: ICE, alpha: 0.8 * b.fade });
      b.ground(FIELD.frost, 16, ICE, RIME);
      b.shock(24, RIME);
    },
  },
  // Winter's Grasp: winter itself: a column of cold, the ground iced far out, a storm of flakes
  'm-super2': {
    dur: { cast: 1.1 },
    cast: (b) => {
      b.pillar(40, 110, ICE, RIME);
      b.ground(FIELD.frost, 76 * Math.min(1, b.u * 3), ICE, RIME);
      b.stand(14, 66 * Math.min(1, b.u * 3), 28, 8, ICE, RIME);
      b.shock(84, RIME);
      b.spray(FX.flake, 16, 70, 8, RIME, { rise: 40, spin: 3 });
    },
    land: (b) => {
      b.stand(6, 10, 30, 7, ICE, RIME);
    },
  },

  /* ---------------------------------------------------------------- ranger, the Longbow: clean shots */
  // Swift Shot: a flick of feathers where it bites
  'r-swift': {
    land: (b) => {
      b.spray(FX.leaf, 4, 14, 6, '#f4f0e0', { h: 3, spin: 6, rise: 10 });
      b.put({ kind: FX.impact, up: 13, w: 22, a: STEEL, b: '#ffffff', t: b.u, seed: b.s.seed });
    },
  },
  // Long Draw: it goes through them: a ring of force, splinters, a long streak out the far side
  'r-aimed': {
    land: (b) => {
      b.shock(32, TEAL);
      b.put({ kind: FX.impact, up: 13, w: 44, a: TEAL, b: '#ffffff', t: b.u, seed: b.s.seed });
      for (let i = 1; i <= 4; i++) b.put({ kind: FX.spark, dx: Math.cos(b.a) * i * 9 * b.e, dy: Math.sin(b.a) * i * 9 * b.e, up: 13, w: 8 - i, a: TEAL, t: 0.2, alpha: b.fade });
      b.spray(FX.chip, 6, 22, 5, '#c8b890', { rise: 14 });
    },
  },
  // Spring Away: leaves and dust where they sprang from
  'r-leap': {
    cast: (b) => {
      b.spray(FX.leaf, 8, 24, 7, LEAF, { h: 4, spin: 8, rise: 18 });
      b.shock(24, DUST, 0.7);
    },
  },
  // Hawk's Dive: the hawk comes down on them out of the sky, feathers everywhere
  'r-hawk': {
    dur: { land: 0.75 },
    land: (b) => {
      b.drop(FX.leaf, 30, 14, '#8a6a3a', '#f4e8c8', 130);
      b.shaft(14, 90, TEAL);
      if (b.u > 0.28) {
        b.spray(FX.leaf, 9, 26, 8, '#c8a878', { b: '#f4e8c8', h: 3.5, spin: 9, rise: 20 });
        b.shock(24, TEAL);
      }
    },
  },
  // Skypierce Arrow: the great arrow: a column of wind where it hits, the ground split along its way
  'r-super': {
    dur: { land: 0.9 },
    land: (b) => {
      b.pillar(22, 90, TEAL, '#ffffff');
      b.shock(46, '#ffffff');
      b.crack(70, TEAL);
      for (let i = 1; i <= 6; i++) b.put({ kind: FX.spark, dx: Math.cos(b.a) * i * 12 * b.e, dy: Math.sin(b.a) * i * 12 * b.e, up: 13, w: 11 - i, a: '#e0fff8', t: 0.2, alpha: b.fade });
    },
  },

  /* ---------------------------------------------------------------- ranger, the Trapper: snares and venom */
  // Hobbling Shot: a snare of cord round the ankles
  'r-hobble': {
    land: (b) => {
      b.put({ kind: FX.web, flat: true, w: 30 * (0.5 + b.e * 0.5), a: '#c8b890', b: '#f4e8c8', t: b.u, alpha: b.fade, seed: b.s.seed });
      b.spray(FX.chip, 4, 12, 4, '#c8b890', { rise: 6, up: 4 });
    },
  },
  // Serpent Volley: the patch bristles with arrows and seeps green
  'r-wind': {
    dur: { zone: 0.9 },
    zone: (b) => {
      const r = b.s.r ?? 34;
      b.ground(FIELD.arrows, r, '#c8b890', BLIGHT);
      b.stand(12, r * 0.7, 16, 2.5, '#c8b890', '#f4e8c8');
      b.spray(FX.poison, 7, r * 0.8, 9, BLIGHT, { b: '#e8ffb0', rise: 8, up: 5 });
    },
    land: (b) => {
      b.spray(FX.poison, 4, 10, 7, BLIGHT, { b: '#e8ffb0', rise: 8 });
    },
  },
  // Adder's Kiss: two fang marks, and the green of it
  'r-venom': {
    land: (b) => {
      for (const side of [-1, 1]) b.put({ kind: FX.frost, dx: side * 4, up: 16 - b.u * 4, w: 10, h: 3, rot: Math.PI / 2 + side * 0.25, a: BLIGHT, b: '#e8ffb0', alpha: b.fade });
      b.spray(FX.poison, 5, 14, 7, BLIGHT, { b: '#e8ffb0', rise: 10 });
    },
  },
  // Snapjaw Trap: set down with a click; when it takes someone, iron shut on them
  'r-trap': {
    cast: (b) => {
      b.ring(16, '#e8c070');
      b.spray(FX.chip, 4, 10, 4, '#8a8478', { rise: 5, up: 3 });
    },
    land: (b) => {
      b.put({ kind: FX.trap, flat: true, w: 34, a: '#e8c070', t: 1, alpha: b.fade });
      b.shock(22, '#e8c070');
      b.spray(FX.chip, 8, 18, 5, '#8a8478', { rise: 14 });
    },
  },
  // Thicket of Snares: nets and vines come up over the whole patch
  'r-super2': {
    dur: { zone: 1.1 },
    zone: (b) => {
      const r = b.s.r ?? 50;
      b.ground(FIELD.nature, r, LEAF, '#b8ff8a');
      b.put({ kind: FX.web, flat: true, w: r * 2 * Math.min(1, b.u * 3), a: '#8ac86a', b: '#e8ffb0', t: b.u, alpha: b.fade, seed: b.s.seed });
      b.stand(12, r * 0.75, 20, 4, '#4a8a3a', '#b8ff8a');
      b.spray(FX.leaf, 12, r, 8, LEAF, { h: 4, spin: 7, rise: 22 });
    },
    land: (b) => {
      b.stand(5, 9, 18, 3.5, '#4a8a3a', '#b8ff8a');
    },
  },

  /* ---------------------------------------------------------------- priest, the Lifegiver: light that mends */
  // Knit Wounds: threads of light wound up round them
  'p-mend': {
    dur: { land: 0.8 },
    land: (b) => {
      b.helix(8, 11, 32, 7, '#b8ffb8', '#fff6d0');
      b.ring(16, '#b8ffb8');
    },
  },
  // Bright Rebuke: a lance of light let down on them from above
  'p-smite': {
    land: (b) => {
      b.shaft(9, 120, '#fff0a8');
      b.put({ kind: FX.holy, up: 14, w: 34 * (1 - b.u * 0.4), a: '#fff0a8', b: '#ffffff', alpha: b.fade, seed: b.s.seed });
      b.ring(22, '#fff0a8');
    },
  },
  // Ward of Faith: a consecrated circle under them as the ward closes
  'p-ward': {
    land: (b) => {
      b.ground(FIELD.holy, 16, SUN, '#ffffff');
      b.put({ kind: FX.bubble, up: 15, w: 30 + b.e * 16, a: SUN, alpha: b.fade });
    },
  },
  // Wail of Dread: the wail goes out as pale faces, and a ring of dark with it
  'p-wail': {
    dur: { cast: 0.8 },
    cast: (b) => {
      b.shock(58, '#b48cff');
      b.spray(FX.ghost, 6, 50, 18, '#e8dcff', { rise: 16, up: 14 });
      b.spray(FX.smoke, 8, 44, 20, '#3a1460', { rise: 6, up: 6 });
    },
  },
  // Dawnward: wings of light open over them
  'p-super': {
    dur: { land: 1 },
    land: (b) => {
      b.shaft(26, 120, SUN);
      b.ground(FIELD.holy, 24, SUN, '#ffffff');
      for (const side of [-1, 1]) b.put({ kind: FX.slash, up: 20, w: 70 * b.e, rot: Math.PI / 2 + side * (0.5 + b.e * 0.4), a: SUN, b: '#ffffff', t: b.u * 0.8, p1: 1.9, p2: 1 });
      b.helix(8, 14, 44, 8, SUN, '#ffffff');
    },
  },

  /* ---------------------------------------------------------------- priest, the Curse-speaker: words that rot */
  // Gnawing Word: two jaws of shadow close on them
  'p-gnaw': {
    land: (b) => {
      const gap = 12 * (1 - Math.min(1, b.u * 2.5));
      for (const side of [-1, 1]) b.put({ kind: FX.shadow, dx: Math.cos(b.a + Math.PI / 2) * side * (gap + 3), dy: Math.sin(b.a + Math.PI / 2) * side * (gap + 3) * 0.6, up: 14, w: 18, a: '#b06aff', b: NIGHT, alpha: b.fade, seed: b.s.seed + side });
      if (b.u > 0.35) b.spray(FX.shadow, 6, 16, 8, DUSK, { b: NIGHT, rise: 8 });
    },
  },
  // Word of Decay: a small tear opens over their head and drips
  'p-curse': {
    land: (b) => {
      b.put({ kind: FX.rift, up: 30, w: 22 * (0.5 + b.e * 0.5), a: VOID, b: '#d8b8ff', t: b.u, alpha: b.fade, seed: b.s.seed });
      for (let i = 0; i < 4; i++) {
        const ph = (b.u * 1.5 + i / 4) % 1;
        b.put({ kind: FX.shadow, dx: (i - 1.5) * 4, up: 28 - ph * 22, w: 6, a: DUSK, b: NIGHT, alpha: b.fade * (1 - ph), seed: i });
      }
    },
  },
  // Duskwalk: the dusk closes over them
  'p-dusk': {
    cast: (b) => {
      b.spray(FX.smoke, 8, 6, 22, '#3a1460', { rise: 14, up: 8, from: 3.5 });
      b.ring(28, DUSK, 1);
    },
  },
  // Word of Silence: crossed out
  'p-hush': {
    land: (b) => {
      b.put({ kind: FX.slash, up: 24, w: 30, rot: 0.8, a: '#d8b8ff', b: VOID, t: Math.min(1, b.u * 1.6), p1: 0.6, p2: 1 });
      b.put({ kind: FX.slash, up: 24, w: 30, rot: -0.8, a: '#d8b8ff', b: VOID, t: Math.min(1, Math.max(0, b.u * 1.6 - 0.2)), p1: 0.6, p2: 1 });
      b.ring(14, VOID, 1);
    },
  },
  // Voidburst: the void opens: a pillar of dark and the ground gone under it
  'p-super2': {
    dur: { zone: 1.1 },
    zone: (b) => {
      const r = b.s.r ?? 58;
      b.ground(FIELD.rift, r, VOID, '#d8b8ff');
      b.pillar(r * 0.8, 120, VOID, '#d8b8ff');
      b.shock(r * 1.3, DUSK);
      b.spray(FX.shadow, 12, r, 14, DUSK, { b: NIGHT, rise: 26 });
    },
  },

  /* ---------------------------------------------------------------- paladin: the sun, the oath, the hammer */
  // Dawn's Touch: a quick warm light, a few rays
  'd-flash': {
    land: (b) => {
      b.shaft(16, 60, SUN);
      b.put({ kind: FX.holy, up: 20, w: 22 * (1 - b.u * 0.4), a: SUN, b: '#ffffff', alpha: b.fade, seed: b.s.seed });
      b.put({ kind: FX.rain, base: true, w: 20, h: 36, a: '#b8ffb8', t: b.u, seed: b.s.seed, alpha: b.fade });
    },
  },
  // Verdict: light comes down on them like a gavel, and the ground takes its mark
  'd-judge': {
    dur: { land: 0.7 },
    land: (b) => {
      b.pillar(13, 80, GOLD, '#ffffff');
      b.crack(40, GOLD);
      b.ring(24, GOLD);
    },
  },
  // Laying On: the great heal: a broad shaft, the ground consecrated, light rising
  'd-hands': {
    dur: { land: 1 },
    land: (b) => {
      b.shaft(30, 130, SUN);
      b.ground(FIELD.holy, 22, SUN, '#ffffff');
      b.helix(10, 14, 46, 8, SUN, '#b8ffb8');
      b.shock(30, SUN, 0.8);
    },
  },
  // Hammer of Oaths: the hammer rings on them
  'd-hammer': {
    land: (b) => {
      b.put({ kind: FX.impact, up: 16, w: 46, a: GOLD, b: '#ffffff', t: b.u, seed: b.s.seed });
      b.shock(30, GOLD);
      b.spray(FX.holy, 5, 20, 9, GOLD, { rise: 12 });
    },
  },
  // Dawn's Covenant: dawn breaks over the whole side
  'd-super2': {
    dur: { cast: 1, land: 0.9 },
    cast: (b) => {
      b.ground(FIELD.holy, 60 * Math.min(1, b.u * 3), SUN, '#ffffff');
      b.shock(90, SUN);
      b.shaft(40, 140, SUN);
    },
    land: (b) => {
      b.shaft(20, 100, SUN);
      b.helix(8, 12, 40, 7, SUN, '#ffffff');
    },
  },
  // Oath Blow: a cut with light on its edge
  'd-blow': {
    land: (b) => {
      b.cut(0.4, 24, GOLD, { edge: '#ffffff', arc: 2, heavy: true });
      b.put({ kind: FX.holy, up: 15, w: 16 * (1 - b.u * 0.5), a: GOLD, b: '#ffffff', alpha: b.fade, seed: b.s.seed });
    },
  },
  // Hammerfall: the blade comes down like a hammer: a column of light, the ground split in gold
  'd-fall': {
    dur: { land: 0.8 },
    land: (b) => {
      b.pillar(20, 76, GOLD, '#ffffff');
      b.crack(60, GOLD);
      b.shock(36, GOLD);
      b.spray(FX.holy, 6, 26, 10, GOLD, { rise: 16 });
    },
  },
  // Dawnstride: gold underfoot and light streaming off them
  'd-stride': {
    cast: (b) => {
      b.ring(26, GOLD, 1);
      b.put({ kind: FX.rain, base: true, w: 30, h: 50, a: GOLD, t: b.u, seed: b.s.seed, alpha: b.fade });
      b.spray(FX.holy, 5, 18, 8, SUN, { rise: 18 });
    },
  },
  // Sunhammer: the sun itself brought down: a great column, two rings, the ground split wide
  'd-super': {
    dur: { land: 1.1 },
    land: (b) => {
      b.pillar(38, 140, GOLD, '#ffffff');
      b.crack(110, GOLD);
      b.shock(60, GOLD);
      if (b.u > 0.2) b.put({ kind: FX.shock, flat: true, w: 150 * ((b.u - 0.2) / 0.8), a: SUN, t: (b.u - 0.2) / 0.8, seed: b.s.seed + 2 });
      b.spray(FX.holy, 10, 44, 13, SUN, { rise: 30 });
    },
  },

  /* ---------------------------------------------------------------- warlock, the Hexer: blight that blooms */
  // Blight Dart: it spatters, sickly green
  'k-dart': {
    land: (b) => {
      b.spray(FX.poison, 6, 16, 8, BLIGHT, { b: '#e8ffb0', rise: 10 });
      b.ring(16, BLIGHT);
    },
  },
  // Hex Bloom: a flower of shadow opens on them, petal by petal, round a small rift
  'k-bloom': {
    dur: { land: 0.8 },
    land: (b) => {
      b.put({ kind: FX.rift, up: 14, w: 20 * (0.4 + b.e * 0.6), a: '#c88aff', b: BLIGHT, t: b.u, alpha: b.fade, seed: b.s.seed });
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2 + b.s.seed;
        const r = 16 * b.e;
        b.put({ kind: FX.shadow, dx: Math.cos(ang) * r, dy: Math.sin(ang) * r * 0.6, up: 14 + Math.sin(b.u * Math.PI) * 6, w: 14 * (1 - b.u * 0.3), a: i % 2 ? '#c88aff' : BLIGHT, b: NIGHT, alpha: b.fade, seed: i });
      }
      b.shock(28, '#c88aff', 0.8);
    },
  },
  // Dread Gaze: a pale face of dread goes through them
  'k-dread': {
    land: (b) => {
      b.put({ kind: FX.ghost, up: 16 + b.u * 22, w: 26, a: '#e8dcff', alpha: b.fade, seed: b.s.seed });
      b.shock(24, VOID);
      b.spray(FX.smoke, 5, 14, 14, '#3a1460', { rise: 8 });
    },
  },
  // Riftmaw: the maw: the ground torn open, dark standing up out of it
  'k-super': {
    dur: { zone: 1.1 },
    zone: (b) => {
      const r = b.s.r ?? 50;
      b.ground(FIELD.rift, r, '#c88aff', BLIGHT);
      b.put({ kind: FX.rift, up: 6, flat: true, w: r * 1.6, a: VOID, b: BLIGHT, t: b.u, alpha: b.fade, seed: b.s.seed });
      b.stand(9, r * 0.6, 34, 7, VOID, '#c88aff', FX.shadow);
      b.shock(r * 1.2, BLIGHT);
    },
  },

  /* ---------------------------------------------------------------- warlock, the Gravecaller: the dead and the dark */
  // Gloom Bolt: a knot of gloom bursts and a violet flame stands a moment where it hit
  'k-bolt': {
    land: (b) => {
      b.pillar(14, 46, VOID, '#d8b8ff');
      b.spray(FX.shadow, 7, 20, 11, DUSK, { b: NIGHT, rise: 12 });
      b.ring(22, VOID);
    },
  },
  // Grave Hunger: a green hunger lit under their master
  'k-frenzy': {
    cast: (b) => {
      b.shock(46, BLIGHT);
      b.put({ kind: FX.rain, base: true, w: 34, h: 50, a: BLIGHT, t: -1, seed: b.s.seed, alpha: b.fade });
      b.circle(44, BLIGHT, '#e8ffb0');
    },
  },
  // Grave Legion: the barrow empties: the ground breaks all round its caller
  'k-super2': {
    dur: { cast: 1 },
    cast: (b) => {
      b.crack(120, '#9a6ae0');
      b.shock(70, '#9a6ae0');
      b.ground(FIELD.shadow, 50, VOID, BLIGHT);
      b.spray(FX.shadow, 10, 50, 14, DUSK, { b: NIGHT, rise: 26 });
    },
  },

  /* ---------------------------------------------------------------- druid, the Grovekeeper: green that grows */
  // Green Mending: leaves wound up round them
  'l-regrow': {
    dur: { land: 0.9 },
    land: (b) => {
      b.helix(9, 12, 34, 8, LEAF, '#d8ffb0', FX.leaf);
      b.ring(16, LEAF);
    },
  },
  // Quick Bloom: a flower opens under them all at once
  'l-bloom': {
    dur: { land: 0.8 },
    land: (b) => {
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + b.s.seed;
        b.put({ kind: FX.leaf, dx: Math.cos(ang) * 13 * b.e, dy: Math.sin(ang) * 13 * b.e * 0.6, up: 4 + b.e * 6, w: 16, h: 8, rot: ang, a: PETAL, b: '#fff0f8', alpha: b.fade });
      }
      b.shaft(16, 60, PETAL);
      b.put({ kind: FX.rain, base: true, w: 22, h: 40, a: '#d8ffb0', t: b.u, seed: b.s.seed, alpha: b.fade });
    },
  },
  // Stinging Petals: a gust of petals turns round them and cuts
  'l-petal': {
    dur: { land: 0.8 },
    land: (b) => {
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + b.u * 7 + b.s.seed;
        const r = 8 + ((i * 5) % 9) + b.e * 6;
        b.put({ kind: FX.leaf, dx: Math.cos(ang) * r, dy: Math.sin(ang) * r * 0.6, up: 6 + ((i * 7) % 22), w: 8, h: 4.5, rot: ang * 2, a: i % 3 ? PETAL : '#ff7ab8', b: '#fff0f8', alpha: b.fade });
      }
      b.cut(0.6, 18, PETAL, { edge: '#ffffff', arc: 1.4, delay: 0.1 });
    },
  },
  // Grasping Roots: roots come up round their feet and close
  'l-roots': {
    dur: { land: 0.8 },
    land: (b) => {
      b.stand(7, 10 - b.e * 2, 20, 4, '#6a4a2a', '#b8ff8a');
      b.crack(34, LEAF);
      b.spray(FX.chip, 5, 14, 4.5, '#6a4a2a', { rise: 10, up: 3 });
    },
  },
  // Heart of the Grove: a great tree of light stands up over the whole side
  'l-super2': {
    dur: { cast: 1.1, land: 0.9 },
    cast: (b) => {
      b.pillar(30, 130, LEAF, '#d8ffb0');
      b.ground(FIELD.nature, 64 * Math.min(1, b.u * 3), LEAF, '#b8ff8a');
      b.shock(90, '#b8ff8a');
      b.spray(FX.leaf, 16, 70, 9, LEAF, { b: '#d8ffb0', h: 5, spin: 6, rise: 44 });
    },
    land: (b) => {
      b.helix(9, 13, 40, 8, LEAF, '#d8ffb0', FX.leaf);
    },
  },

  /* ---------------------------------------------------------------- druid, the Starseer: moon and stars */
  // Starlash: a star bursts on them, four long points
  'l-lash': {
    land: (b) => {
      b.put({ kind: FX.holy, up: 15, w: 40 * (1 - b.u * 0.4), a: MOON, b: '#ffffff', alpha: b.fade, seed: b.s.seed });
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        b.put({ kind: FX.spark, dx: Math.cos(ang) * 22 * b.e, dy: Math.sin(ang) * 22 * b.e * 0.6, up: 15, w: 9 * (1 - b.u * 0.5), a: '#ffffff', t: 0.2, alpha: b.fade });
      }
      b.ring(20, MOON);
    },
  },
  // Moonburn: a beam of the moon let down on them, a crescent on the ground
  'l-moon': {
    dur: { land: 0.8 },
    land: (b) => {
      b.shaft(11, 130, MOON);
      b.put({ kind: FX.slash, up: 3, flat: true, w: 44, rot: b.s.seed, a: MOON, b: '#ffffff', t: 0.35 + b.u * 0.3, p1: 2.6, p2: 0, alpha: b.fade });
      b.glow(34, MOON, 0.6, 4);
    },
  },
  // Stag's Bound: leaves and a ring of green where they break away
  'l-bound': {
    cast: (b) => {
      b.spray(FX.leaf, 9, 26, 8, LEAF, { b: '#d8ffb0', h: 4, spin: 8, rise: 16 });
      b.ring(26, LEAF, 1);
      b.put({ kind: FX.rain, base: true, w: 28, h: 46, a: '#b8ff8a', t: b.u, seed: b.s.seed, alpha: b.fade });
    },
  },
  // Thornstorm: thorns stand up out of the whole patch
  'l-super': {
    dur: { zone: 1 },
    zone: (b) => {
      const r = b.s.r ?? 44;
      b.ground(FIELD.nature, r, '#4a8a3a', '#b8ff8a');
      b.stand(14, r * 0.8, 30, 5, '#4a8a3a', '#d8ffb0');
      b.stand(7, r * 0.4, 38, 6, '#3a6a2a', '#d8ffb0');
      b.crack(r * 2.2, LEAF);
      b.shock(r * 1.2, '#b8ff8a');
    },
  },

  /* ---------------------------------------------------------------- gloamknight: its cuts are drawn where it swings
     (render/ring.ts RingFx.gloam); here, what they do to whoever they land on */
  // Gloam Cleave: the dark of the blade stays in the wound a moment
  'g-cleave': {
    land: (b) => {
      b.spray(FX.shadow, 5, 16, 9, DUSK, { b: NIGHT, rise: 8 });
      b.ring(18, VOID);
    },
  },
  // Night Reaping: a great crescent through them and a ring of rose and violet
  'g-reap': {
    dur: { land: 0.75 },
    land: (b) => {
      b.cut(0, 30, '#4a1f9e', { edge: '#d8bcff', arc: 2.8, heavy: true });
      b.shock(34, ROSE);
      b.spray(FX.shadow, 7, 24, 11, DUSK, { b: NIGHT, rise: 12 });
    },
  },
  // Grave Chain: links of grave-iron bite, and a ring where they are dragged from
  'g-chain': {
    land: (b) => {
      b.spray(FX.chip, 7, 16, 5, '#8a8498', { rise: 10 });
      b.ring(20, DUSK, 1);
      b.put({ kind: FX.impact, up: 13, w: 30, a: DUSK, b: '#ffffff', t: b.u, seed: b.s.seed });
    },
  },
  // Nightknife: a short stab: two thin marks crossing, low
  'g-knife': {
    land: (b) => {
      b.cut(0.9, 13, '#d8bcff', { arc: 0.7, up: 12 });
      b.cut(-0.9, 13, '#d8bcff', { arc: 0.7, up: 12, delay: 0.12 });
      b.spray(FX.spark, 3, 10, 4.5, BLOOD, { rise: 4 });
    },
  },
  // Closing Cut: the one deep cut: a long rose crescent right through them, the dark and the blood it lets out
  'g-cut': {
    dur: { land: 0.85 },
    land: (b) => {
      b.cut(0.25, 36, ROSE, { edge: '#ffd8ec', arc: 2.9, heavy: true });
      b.cut(-0.25, 30, '#4a1f9e', { edge: '#d8bcff', arc: 2.5, heavy: true, delay: 0.1 });
      b.shock(32, ROSE);
      b.spray(FX.spark, 10, 28, 6, BLOOD, { b: '#ff8ab8', rise: 8 });
      b.crack(40, ROSE);
    },
  },
  // Shroud of Dusk: the dusk folds over them
  'g-veil': {
    cast: (b) => {
      b.spray(FX.smoke, 9, 5, 22, '#3a1460', { rise: 16, up: 8, from: 4 });
      b.put({ kind: FX.gather, up: 16, w: 46, a: DUSK, b: NIGHT, t: b.u, seed: b.s.seed });
    },
  },
  // Dusk Ambush: out of nowhere: a burst of dark at their back and the knock of it
  'g-ambush': {
    land: (b) => {
      b.shock(26, DUSK);
      b.spray(FX.shadow, 8, 20, 11, DUSK, { b: NIGHT, rise: 12 });
      b.put({ kind: FX.impact, up: 14, w: 36, a: '#d8bcff', b: '#ffffff', t: b.u, seed: b.s.seed });
    },
  },
  // Eclipse Reaping: an eclipse: a dark disc ringed with light opens where it lands
  'g-super': {
    dur: { land: 1 },
    land: (b) => {
      b.put({ kind: FX.shadow, up: 4, flat: true, w: 80 * b.e, a: NIGHT, b: '#ffb8e8', t: b.u, alpha: b.fade, seed: b.s.seed });
      b.ring(44, '#ffd8ec', 0.2);
      b.shock(56, ROSE);
      b.crack(80, ROSE);
      b.spray(FX.shadow, 10, 40, 14, DUSK, { b: NIGHT, rise: 22 });
    },
  },
  // Night's Ruin: down out of the dark: a column of night, the ground broken, two rings
  'g-super2': {
    dur: { land: 1 },
    land: (b) => {
      b.pillar(30, 120, '#4a1f9e', '#d8bcff');
      b.crack(96, ROSE);
      b.shock(50, DUSK);
      if (b.u > 0.2) b.put({ kind: FX.shock, flat: true, w: 130 * ((b.u - 0.2) / 0.8), a: ROSE, t: (b.u - 0.2) / 0.8, seed: b.s.seed + 2 });
      b.spray(FX.shadow, 12, 44, 14, DUSK, { b: NIGHT, rise: 26 });
      b.spray(FX.chip, 8, 36, 6, '#3a2a4a', { rise: 30 });
    },
  },
};

const USUAL: Record<SignKind, number> = { cast: 0.5, land: 0.6, zone: 0.8 };

/** Whether an ability has a sign of its own for this moment. */
export const hasSign = (ab: string, k: SignKind): boolean => !!LOOKS[ab]?.[k];

/** Whether its landing is drawn in place of its school's own burst (most are) or with it. */
export const signAlone = (ab: string): boolean => !!LOOKS[ab]?.land && !LOOKS[ab]!.keep;

/** How long an ability's sign for this moment lasts. */
export const signTime = (ab: string, k: SignKind): number => LOOKS[ab]?.dur?.[k] ?? USUAL[k];

/** The abilities that have a sign, for the tests. */
export const signed = (): string[] => Object.keys(LOOKS);

/** One sign, as far along as it is, at (x, y). */
export function drawSign(q: Fx3D, s: Sign, x: number, y: number, time: number): void {
  const paint = LOOKS[s.ab]?.[s.k];
  if (!paint || s.t < 0) return;
  paint(new Brush(q, x, y, s.a, s, time));
}

/* ------------------------------------------------------------------ what a fighter carries: points and boons */

/** How a kind of points is shown round whoever holds them: what each is, and how they sit. */
interface Carried {
  kind: number;
  /** 'orbit': turning round the waist. 'crown': hanging in an arc over the shoulders. 'feet': lying round the feet. */
  how: 'orbit' | 'crown' | 'feet';
  w: number;
  h?: number;
  b: string;
  /** Its own color, where the points' own (the color of their pips) is too pale to be seen on snow or sand. */
  a?: string;
}
const POINT_LOOK: Record<string, Carried> = {
  // (small blades, turning point first)
  Nicks: { kind: FX.frost, how: 'orbit', w: 13, h: 3.5, a: '#ff3a8a', b: '#ffd8ec' },
  Notches: { kind: FX.chip, how: 'orbit', w: 6, b: STEEL },
  Ire: { kind: FX.flame, how: 'feet', w: 7, h: 12, b: EMBER },
  Embers: { kind: FX.flame, how: 'orbit', w: 7, h: 11, b: '#ffe08a' },
  Rimeshards: { kind: FX.frost, how: 'crown', w: 17, h: 5, a: '#2a8ae8', b: RIME },
  Tension: { kind: FX.spark, how: 'crown', w: 8, a: '#2ac8b0', b: '#ffffff' },
  Quills: { kind: FX.frost, how: 'crown', w: 13, h: 2.5, b: '#f4e8c8' },
  Prayers: { kind: FX.holy, how: 'crown', w: 9, b: '#ffffff' },
  Verses: { kind: FX.shadow, how: 'orbit', w: 8, b: NIGHT },
  Oaths: { kind: FX.holy, how: 'orbit', w: 10, b: '#ffffff' },
  Ardor: { kind: FX.holy, how: 'feet', w: 10, b: '#ffffff' },
  Rot: { kind: FX.poison, how: 'orbit', w: 8, b: '#e8ffb0' },
  Tithes: { kind: FX.spark, how: 'orbit', w: 6.5, b: '#ff8ab8' },
  Buds: { kind: FX.leaf, how: 'orbit', w: 9, h: 5, b: '#fff0f8' },
};

/**
 * The points a fighter holds, drawn on them for everyone to see: as many of their own kind as they hold, turning round
 * the waist, hanging over the shoulders or lying round the feet, and all of them brighter when no more can be held (a
 * Rime's shards hang beside them, as its talent says; a Nightblade's Nicks turn round them as small cuts). So a player
 * reads their own combo off their hero, and their enemy's off the enemy.
 */
export function drawPoints(q: Fx3D, x: number, y: number, name: string, n: number, max: number, color: string, time: number, seed: number): void {
  if (n <= 0) return;
  const look = POINT_LOOK[name] ?? { kind: FX.spark, how: 'orbit' as const, w: 6, b: '#ffffff' };
  const full = n >= max;
  const pulse = full ? 1 + Math.sin(time * 9) * 0.18 : 1;
  for (let i = 0; i < n; i++) {
    const quad: Q = { kind: look.kind as Q['kind'], x, y, w: look.w * pulse, h: look.h, a: look.a ?? color, b: look.b, seed: seed + i, alpha: full ? 1 : 0.9, t: 0.2 };
    if (look.how === 'orbit') {
      const ang = time * 2.2 + (i / max) * Math.PI * 2 + seed;
      quad.x = x + Math.cos(ang) * 12;
      quad.y = y + Math.sin(ang) * 6.5;
      quad.up = 15 + Math.sin(ang * 2 + i) * 2.5;
      // (a blade or a leaf turns with its place in the ring)
      if (look.kind === FX.frost) quad.rot = -ang + Math.PI / 2;
      else if (look.kind === FX.leaf) quad.rot = ang * 2;
    } else if (look.how === 'crown') {
      // an arc over the shoulders, left to right, bobbing each on its own beat
      const k = max > 1 ? i / (max - 1) : 0.5;
      const ang = Math.PI * (1.15 + 0.7 * k);
      quad.x = x + Math.cos(ang) * 15;
      quad.up = 27 + -Math.sin(ang) * 9 + Math.sin(time * 2.4 + i * 1.3) * 1.4;
      quad.rot = Math.PI / 2 + (k - 0.5) * 0.9;
    } else {
      const ang = (i / max) * Math.PI * 2 + seed + time * 0.5;
      quad.x = x + Math.cos(ang) * 11;
      quad.y = y + Math.sin(ang) * 6;
      quad.up = look.kind === FX.flame ? 1 : 4;
      if (look.kind === FX.flame) quad.base = true;
    }
    q.put(quad);
  }
  if (full) q.put({ kind: FX.ring, x, y, flat: true, w: 30, a: color, t: (time * 1.1) % 1, alpha: 0.8, seed });
}

/**
 * A boon carried, drawn on whoever carries it: a ring of its color breathing at their feet and motes of it going up,
 * two rings for one held twice. The player's own screen also shows its sign beside the hero (ui/RingBoons.tsx); this
 * is what the other side sees, so that a lit Frostfang can be read coming and hidden from.
 */
export function drawBoon(q: Fx3D, x: number, y: number, color: string, n: number, time: number, seed: number): void {
  const breath = 0.5 + Math.sin(time * 5 + seed) * 0.25;
  q.put({ kind: FX.mark, x, y, flat: true, w: 30, a: color, alpha: 0.55 + breath * 0.4 });
  if (n > 1) q.put({ kind: FX.ring, x, y, flat: true, w: 40, a: color, t: 0.5, alpha: 0.5 + breath * 0.3, seed });
  for (let i = 0; i < 3 + n; i++) {
    const ph = (time * 0.9 + i / (3 + n) + seed * 0.17) % 1;
    const ang = i * 2.39 + seed;
    q.put({ kind: FX.spark, x: x + Math.cos(ang) * 10, y: y + Math.sin(ang) * 5.5, up: 3 + ph * 30, w: 6 * (1 - ph * 0.6), a: color, t: 0.2, alpha: 1 - ph });
  }
}

/* ------------------------------------------------------------------ what is thrown, on its way */

/**
 * A thrown ability's own look in the air (the owner, 2026-11-17: "make the visual cue better for the different
 * spells"). Until then everything of one school flew alike: a Rime Spear and a Frostfang were the same shard of frost,
 * an Ember Lash and a Flashburn the same ball of fire, and nobody could tell which was coming. A mage's five are each
 * their own shape now; anything not named here still flies as its school does (render/effects.ts shot).
 *
 * (ux, uy) is the way it flies, `flown` how far it has come (only known for what lands at once), `strong` whether a
 * boon or points made it hit harder (a Rime Spear thrown while the globe is out).
 */
type Flight = (q: Fx3D, x: number, y: number, ux: number, uy: number, time: number, seed: number, flown: number, strong: boolean) => void;

const FLIGHTS: Record<string, Flight> = {
  // Ember Lash: a whip of fire: a bright head and a tail of flames snaking behind it
  'm-lash': (q, x, y, ux, uy, time, seed) => {
    for (let i = 4; i >= 1; i--) {
      const back = i * 6.5;
      const sway = Math.sin(time * 20 - i * 1.2 + seed) * (1 + i * 1.3);
      q.put({ kind: FX.flame, x: x - ux * back - uy * sway, y: y - uy * back + ux * sway, up: 13, w: 13 - i * 2, h: 16 - i * 2.4, a: '#ff6a1e', b: '#ffd24a', seed: seed + i, alpha: 1 - i * 0.17 });
    }
    q.put({ kind: FX.glow, x, y, up: 14, w: 26, a: '#ff7a1e', alpha: 0.5 });
    q.put({ kind: FX.orb, x, y, up: 14, w: 11, a: '#ffb040', b: '#fff6d0', seed });
  },
  // Flashburn: no ball at all: a white-hot line from the hand, there and gone, with a flare at its head
  'm-burn': (q, x, y, ux, uy, _time, seed, flown) => {
    const len = Math.min(Math.max(flown, 14), 84);
    q.put({ kind: FX.beam, x: x - (ux * len) / 2, y: y - (uy * len) / 2, up: 14, w: len * shortened(ux, uy), h: 9, rot: screenAngle(ux, uy), a: '#ff5a1e', b: '#fff6d0', seed });
    q.put({ kind: FX.beam, x: x - (ux * len) / 2, y: y - (uy * len) / 2, up: 14, w: len * shortened(ux, uy), h: 3.5, rot: screenAngle(ux, uy), a: '#fff6d0', b: '#ffffff', seed: seed + 1 });
    q.put({ kind: FX.impact, x, y, up: 14, w: 24, a: '#ffd24a', b: '#ffffff', t: 0.25, seed });
  },
  // Toad Hex: a fat green bubble wobbling over, with two motes of the hex going round it
  'm-toad': (q, x, y, _ux, _uy, time, seed) => {
    const wob = Math.sin(time * 14 + seed) * 1.6;
    q.put({ kind: FX.bubble, x, y, up: 14 + wob, w: 19 + wob, a: '#8ae85a', alpha: 0.95 });
    q.put({ kind: FX.poison, x, y, up: 14 + wob, w: 10, a: '#5ab82e', b: '#d8ff8a', seed });
    for (let i = 0; i < 2; i++) {
      const ang = time * 9 + i * Math.PI + seed;
      q.put({ kind: FX.spark, x: x + Math.cos(ang) * 10, y: y + Math.sin(ang) * 5, up: 14 + Math.sin(ang) * 5, w: 5, a: '#c8a0ff', t: 0.2 });
    }
  },
  // Rime Spear: a long spear of ice, point first, shedding flakes; thrown while the globe is out it is two, in a halo of cold
  'm-spear': (q, x, y, ux, uy, time, seed, _flown, strong) => {
    const rot = screenAngle(ux, uy);
    const k = shortened(ux, uy);
    const spear = (ox: number, w: number, alpha: number): void => {
      q.put({ kind: FX.frost, x: x - uy * ox - ux * w * 0.3, y: y + ux * ox - uy * w * 0.3, up: 14, w: w * k, h: 9, rot, a: '#2a8ae8', b: '#f0fbff', seed, alpha });
    };
    q.put({ kind: FX.trail, x: x - ux * 22, y: y - uy * 22, up: 14, w: 44 * k, h: strong ? 11 : 7, rot, a: '#4ab8ff', b: '#ffffff', seed });
    q.put({ kind: FX.glow, x, y, up: 14, w: 20, a: '#4ab8ff', alpha: 0.55 });
    if (strong) {
      spear(5, 38, 1);
      spear(-5, 38, 1);
      q.put({ kind: FX.ring, x, y, up: 14, w: 26, a: '#e0f8ff', t: 0.5, alpha: 0.9, seed });
      q.put({ kind: FX.glow, x, y, up: 14, w: 34, a: '#9fdcff', alpha: 0.6 });
    } else spear(0, 38, 1);
    for (let i = 1; i <= 3; i++) {
      const ph = (time * 3 + i * 0.37 + seed) % 1;
      q.put({ kind: FX.flake, x: x - ux * (10 + i * 9) - uy * (ph - 0.5) * 8, y: y - uy * (10 + i * 9) + ux * (ph - 0.5) * 8, up: 14 - ph * 8, w: 5, a: '#e0f8ff', alpha: 1 - ph, seed: seed + i });
    }
  },
  // Frostclasp: a ring of ice thrown flat, turning as it goes, to close on them
  'm-ring': (q, x, y, _ux, _uy, time, seed) => {
    q.put({ kind: FX.ring, x, y, up: 14, w: 20, a: '#e0f8ff', t: 0.5, seed });
    for (let i = 0; i < 4; i++) {
      const ang = time * 12 + (i / 4) * Math.PI * 2 + seed;
      q.put({ kind: FX.frost, x: x + Math.cos(ang) * 8, y: y + Math.sin(ang) * 4.5, up: 14, w: 10, h: 4, rot: ang, a: '#9fdcff', b: '#ffffff', seed: i });
    }
  },
  // Frostfang: a pair of short fangs side by side, closing on them as they go
  'm-fang': (q, x, y, ux, uy, _time, seed, flown) => {
    const rot = screenAngle(ux, uy);
    const gap = Math.max(1.5, 7 - flown * 0.05);
    for (const side of [-1, 1]) {
      q.put({ kind: FX.frost, x: x - uy * gap * side, y: y + ux * gap * side, up: 14, w: 15 * shortened(ux, uy), h: 5, rot: rot + side * 0.32, a: '#bfeaff', b: '#ffffff', seed: seed + side });
      q.put({ kind: FX.spark, x: x - uy * gap * side - ux * 9, y: y + ux * gap * side - uy * 9, up: 14, w: 4.5, a: '#ffffff', t: 0.2, alpha: 0.8 });
    }
  },
};

export const hasFlight = (ab: string): boolean => !!FLIGHTS[ab];

/** Draws a thrown ability on its way, in its own shape. False if it has none (it flies as its school does). */
export function drawFlight(q: Fx3D, ab: string, x: number, y: number, ux: number, uy: number, time: number, seed: number, flown = 0, strong = false): boolean {
  const paint = FLIGHTS[ab];
  if (!paint) return false;
  paint(q, x, y, ux, uy, time, seed, flown, strong);
  return true;
}

/**
 * A globe of rime out on the ground and hunting (Ability.field.seek): a ball of ice with shards wheeling round it, the
 * ground iced out to exactly where it lands, a ring of cold thrown out each time it does, and flakes shed behind it as
 * it goes after someone. `since` is how long ago it last landed (seconds), `left` fades it in its last moment.
 */
export function drawGlobe(q: Fx3D, x: number, y: number, r: number, vx: number, vy: number, since: number, left: number, time: number): void {
  const bob = Math.sin(time * 3 + x * 0.1) * 2;
  const up = 16 + bob;
  q.put({ kind: FX.field, x, y, flat: true, w: r * 2, a: '#4ab8ff', b: '#e0f8ff', t: 1, alpha: 0.36 * left, seed: 3, p1: FIELD.frost });
  q.put({ kind: FX.ring, x, y, flat: true, w: r * 2, a: '#e0f8ff', t: 0.5, alpha: 0.75 * left, seed: 1 });
  // (each landing: a ring of cold out to its edge)
  if (since < 0.45) q.put({ kind: FX.shock, x, y, flat: true, w: r * 2 * Math.min(1, since / 0.3), a: '#bfeaff', t: since / 0.45, alpha: left, seed: 2 });
  q.put({ kind: FX.glow, x, y, up, w: 44, a: '#4ab8ff', alpha: 0.7 * left });
  q.put({ kind: FX.orb, x, y, up, w: 17, a: '#4ab8ff', b: '#f0fbff', t: 0.3, seed: time * 0.5, alpha: left });
  for (let i = 0; i < 5; i++) {
    const ang = time * 3.4 + (i / 5) * Math.PI * 2;
    q.put({ kind: FX.frost, x: x + Math.cos(ang) * 13, y: y + Math.sin(ang) * 7, up: up + Math.sin(ang * 2 + i) * 3, w: 13, h: 5, rot: ang + Math.PI / 2, a: '#9fdcff', b: '#ffffff', alpha: left, seed: i });
  }
  // (what it sheds behind it as it goes, and a drift of flakes over its patch when it hangs still)
  const sp = Math.hypot(vx, vy);
  for (let i = 0; i < 6; i++) {
    const ph = (time * 1.3 + i / 6) % 1;
    if (sp > 4) {
      const back = 8 + ph * 34;
      const side = Math.sin(i * 2.4) * 9;
      q.put({ kind: FX.flake, x: x - (vx / sp) * back - (vy / sp) * side, y: y - (vy / sp) * back + (vx / sp) * side, up: up * (1 - ph), w: 6, a: '#e0f8ff', alpha: (1 - ph) * left, seed: i });
    } else {
      const ang = i * 1.05 + time * 0.6;
      q.put({ kind: FX.flake, x: x + Math.cos(ang) * r * 0.7, y: y + Math.sin(ang) * r * 0.55, up: 4 + (1 - ph) * 22, w: 6, a: '#e0f8ff', alpha: Math.sin(ph * Math.PI) * left, seed: i });
    }
  }
}

/**
 * Someone fades from sight where they stand (a mage's vanishing point): a circle that closes on the spot, a puff of
 * violet smoke going up and out, and motes left hanging. Both sides see it: it says "gone from here", not where to.
 */
export function drawFade(q: Fx3D, x: number, y: number, u: number, seed: number): void {
  const fade = Math.max(0, 1 - u * u);
  q.put({ kind: FX.rune, x, y, flat: true, w: 46 * (1 - u * 0.7), a: '#a05aff', b: '#ffffff', t: u, seed });
  q.put({ kind: FX.ring, x, y, flat: true, w: 54 * (0.3 + 0.7 * u), a: '#e0c8ff', t: u, alpha: fade, seed });
  q.put({ kind: FX.gather, x, y, up: 16, w: 50, a: '#c8a0ff', b: '#ffffff', t: Math.min(1, u * 1.4), seed });
  q.put({ kind: FX.glow, x, y, up: 16, w: 44, a: '#a05aff', alpha: 0.55 * fade });
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + seed;
    const out = 4 + u * 20;
    q.put({ kind: FX.smoke, x: x + Math.cos(ang) * out, y: y + Math.sin(ang) * out * 0.6, up: 8 + u * 26 + (i % 3) * 5, w: 20 + u * 10, a: '#5a2a9a', alpha: fade * 0.9, t: u * 0.6, seed: seed + i });
  }
  for (let i = 0; i < 6; i++) {
    const ang = i * 2.39 + seed;
    q.put({ kind: FX.spark, x: x + Math.cos(ang) * 12, y: y + Math.sin(ang) * 7, up: 6 + u * 34 + i * 2, w: 5 * (1 - u * 0.5), a: '#e0c8ff', t: 0.2, alpha: fade });
  }
}
