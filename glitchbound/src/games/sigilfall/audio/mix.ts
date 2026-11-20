import { TILE } from '../sim/map';
import type { World } from '../sim/world';

/**
 * The mix (POLISH_PLAN.md piece 24): how far the music steps back for the story, and how far a fight brings it forward.
 *
 * `duck` is the music's share (1 as it is): under a scene, a conversation or a page of the story it steps well back,
 * so every word is heard; under a line shouted in play, a little. `fight` is how much of a fight is on round the hero,
 * 0 to 1: out of one the music is a touch softer and darker (a low-pass), in one it comes forward, bright and full, so
 * a fight is heard beginning before it is seen. Only a rule: audio/sound.ts carries it out, gliding from one to the next.
 */
export interface Mix {
  duck: number;
  fight: number;
}

/** What steps the music back: the story taking the stage (a scene, a talk, a page) or a line said in play. */
export const DUCK_STORY = 0.42;
export const DUCK_SHOUT = 0.78;

/** How far off a foe coming at the hero brings the fight into the music (eight tiles). */
const FIGHT_REACH = TILE * 8;

export function mixFor(w: World | null, ui: { dialogue: unknown; story: unknown; reward: unknown }): Mix {
  if (!w) return { duck: 1, fight: 0 };
  const story = !!w.scene || !!ui.dialogue || !!ui.story || !!ui.reward;
  const said = w.story.speech.length > 0;
  const duck = story ? DUCK_STORY : said ? DUCK_SHOUT : 1;
  // a fight: a boss up, the hero struck or striking a moment ago, or foes after them close by
  const p = w.player;
  const boss = w.boss();
  let fight = boss && !boss.dead ? 1 : 0;
  if (!fight && !p.dead && !w.scene) {
    let n = 0;
    for (const e of w.enemies) {
      if (e.dead || e.dummy || e.def.prop) continue;
      if (e.state !== 'chase' && e.state !== 'windup' && e.state !== 'act' && e.state !== 'recover') continue;
      if (Math.abs(e.x - p.x) > FIGHT_REACH || Math.abs(e.y - p.y) > FIGHT_REACH) continue;
      n++;
    }
    fight = Math.min(1, n / 3 + (p.calm < 3 ? 0.4 : 0));
  }
  return { duck, fight };
}
