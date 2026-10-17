import { LANES, PLAYER } from './config';
import type { Row, World } from './world';

/**
 * A simple planner that drives the car using the spawner's row data.
 * Used for the attract-mode demo behind the title screen and for automated fairness tests.
 */
export class Autopilot {
  private cooldown = 0;

  constructor(private readonly reactionTime = 0) {}

  update(world: World, dt: number): void {
    this.cooldown -= dt;
    if (this.cooldown > 0 || world.player.changeT < 1) return;
    const target = this.targetLane(world);
    if (target === null) return;
    const lane = world.player.lane;
    if (target === lane) return;
    const dir = target > lane ? 1 : -1;
    // While alongside a row, only step into a lane that row leaves open.
    if (this.alongsideMask(world) & (1 << (lane + dir))) return;
    world.steer(dir);
    this.cooldown = this.reactionTime;
  }

  /** Lanes blocked by rows currently beside the player. */
  private alongsideMask(world: World): number {
    const pTop = world.player.y - PLAYER.hitH / 2;
    const pBottom = world.player.y + PLAYER.hitH / 2;
    let mask = 0;
    for (const r of world.rows) if (r.top < pBottom + 10 && r.top + r.len > pTop - 10) mask |= r.mask;
    return mask;
  }

  targetLane(world: World): number | null {
    const pTop = world.player.y - PLAYER.hitH / 2;
    const margin = 10;
    const rows = world.rows.filter((r) => r.top + r.len <= pTop - margin).sort((a, b) => b.top - a.top);
    if (rows.length === 0) return null;
    // Backward pass: lanes from which every later row is still reachable.
    let good = (rows[rows.length - 1] as Row).reach;
    for (let i = rows.length - 2; i >= 0; i--) {
      const r = rows[i] as Row;
      const next = rows[i + 1] as Row;
      let g = 0;
      for (let a = 0; a < LANES; a++) {
        if (!(r.reach & (1 << a))) continue;
        for (let b = 0; b < LANES; b++) {
          if (good & (1 << b) && Math.abs(a - b) <= next.shift) {
            g |= 1 << a;
            break;
          }
        }
      }
      good = g || r.reach;
    }
    const lane = world.player.lane;
    let best = -1;
    for (let l = 0; l < LANES; l++) {
      if (!(good & (1 << l))) continue;
      if (best < 0 || Math.abs(l - lane) < Math.abs(best - lane)) best = l;
    }
    return best < 0 ? null : best;
  }
}
