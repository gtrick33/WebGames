/**
 * The NEON RUSH attract-mode simulation, separate from drawing so it can be tested.
 *
 * Traffic arrives in rows. Every row leaves at least one lane free, and rows are spaced so the bot
 * can cross two lanes between them. The bot picks its lane only while no row is beside it, and that
 * lane is the free lane of the next row, so it never drives through a car.
 */
export const LANES = 3;
export const PLAYER_Y = 0.8; // fraction of screen height
export const ROW_SPEED = 0.42; // screen heights per second
const MIN_ROW_GAP = 0.5;
const COLORS = ['#ff5a6c', '#ffd12e', '#c4f034', '#ff6a1a', '#12c6b3', '#8b5cff'];

export interface Row {
  y: number;
  blocked: number[];
  colors: string[];
  free: number[];
  coins: boolean[];
  collected: boolean;
}

export interface Layout {
  laneW: number;
  roadL: number;
  cw: number;
  ch: number;
}

export function layout(w: number, h: number): Layout {
  const roadW = Math.min(w * 0.86, h * 0.62);
  const laneW = roadW / LANES;
  const cw = laneW * 0.5;
  return { laneW, roadL: (w - roadW) / 2, cw, ch: cw * 1.85 };
}

export class PreviewSim {
  rows: Row[] = [];
  playerLane: number;
  playerX: number;
  private seed: number;

  /** `carH` is the car height as a fraction of the screen height. */
  constructor(
    public carH: number,
    seed = 11,
  ) {
    this.seed = seed;
    this.rows.push(this.makeRow(0.1));
    while (this.rows.length < 4) this.rows.push(this.makeRow(this.rows[this.rows.length - 1]!.y - this.gap()));
    this.playerLane = this.rows[0]!.free[0]!;
    this.playerX = this.playerLane;
  }

  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** Rows must be far enough apart that the bot can cross two lanes between them. */
  gap(): number {
    return Math.max(MIN_ROW_GAP, this.carH * 2.3 + 0.28);
  }

  private makeRow(y: number): Row {
    const nBlocked = this.rnd() < 0.45 ? 2 : 1;
    const lanes = [0, 1, 2].sort(() => this.rnd() - 0.5);
    const blocked = lanes.slice(0, nBlocked);
    return {
      y,
      blocked,
      colors: blocked.map(() => COLORS[Math.floor(this.rnd() * COLORS.length)]!),
      free: lanes.slice(nBlocked),
      coins: [this.rnd() < 0.7, true, true],
      collected: false,
    };
  }

  step(dt: number): void {
    for (const r of this.rows) r.y += dt * ROW_SPEED;
    while (this.rows.length && this.rows[0]!.y > 1.25) this.rows.shift();
    while (this.rows[this.rows.length - 1]!.y > -0.3) this.rows.push(this.makeRow(this.rows[this.rows.length - 1]!.y - this.gap()));

    const beside = this.rows.some((r) => Math.abs(r.y - PLAYER_Y) < this.carH * 1.1);
    if (!beside) {
      const next = this.rows.filter((r) => r.y < PLAYER_Y).sort((a, b) => b.y - a.y)[0];
      if (next) {
        const from = this.playerLane;
        const options = [...next.free].sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || Number(next.coins[b]) - Number(next.coins[a]));
        this.playerLane = options[0] ?? from;
      }
    }
    this.playerX += (this.playerLane - this.playerX) * Math.min(1, dt * 8);
    for (const r of this.rows) {
      const lane = Math.round(this.playerX);
      if (!r.collected && Math.abs(r.y - PLAYER_Y) < 0.03 && r.free.includes(lane) && r.coins[lane]) r.collected = true;
    }
  }

  /** True when the player car's box overlaps any traffic car's box (lane units / screen fractions). */
  colliding(carWLanes = 0.5): boolean {
    return this.rows.some(
      (r) => Math.abs(r.y - PLAYER_Y) < this.carH && r.blocked.some((lane) => Math.abs(lane - this.playerX) < carWLanes),
    );
  }
}
