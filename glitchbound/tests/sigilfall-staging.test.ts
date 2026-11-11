/**
 * The story as it is watched. Every scene is played through and looked at the way the camera looks at it: whoever
 * speaks is in the picture (fifteen scenes used to have lines spoken from off the screen, one from sixty tiles
 * away), nobody of a memory stands in a wall, and nobody is waited on for a ten-second walk. And the titles a hero
 * can carry for the rare things they did.
 */
import { describe, expect, it } from 'vitest';
import { RANKS } from '../src/games/sigilfall/arena/ranks';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import { WARDENS, CAMPAIGN_END } from '../src/games/sigilfall/data/wardens';
import { applyPreset, PRESETS } from '../src/games/sigilfall/progress/presets';
import { chooseTitle, earnedTitles, newTitles, titled, TITLES, wornTitle } from '../src/games/sigilfall/progress/titles';
import { migrate, SAVE_VERSION } from '../src/games/sigilfall/progress/save';
import { inSight } from '../src/games/sigilfall/sim/scene';
import { holds } from '../src/games/sigilfall/sim/story';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { TILE } from '../src/games/sigilfall/sim/map';
import { newWorld, readyHero } from './sigilfall-bot';

const DT = 1 / 30;
function holdsFor(p: (typeof PRESETS)[number], id: string): boolean {
  const c = readyHero('mage', 2);
  applyPreset(c, p);
  const when = SCENES.find((s) => s.id === id)!.when;
  return !!when && holds(c, when);
}
function atScene(id: string) {
  const preset = PRESETS.find((p) => p.label.includes('(scene)') && SCENES.find((s) => s.id === id)!.region === p.region && holdsFor(p, id))!;
  const c = readyHero('mage', preset.level);
  applyPreset(c, preset);
  return c;
}
const where = (w: World, who: string): { x: number; y: number } | null => (who === 'hero' ? w.player : (w.npcs.find((x) => x.id === who) ?? w.pets.find((x) => !x.dead && x.def.id === who) ?? null));

describe('Sigilfall: every scene, as the camera sees it', () => {
  it('whoever speaks is in the picture, nobody stands in a wall, and no walk is waited on', { timeout: 600_000 }, () => {
    const wrong: string[] = [];
    let lines = 0;
    for (const def of SCENES.filter((d) => d.when)) {
      const w = newWorld(def.region, atScene(def.id));
      for (const s of SCENES) if (s.id !== def.id && s.region === def.region && !w.hero.opened.includes(`scene:${s.id}`)) w.hero.opened.push(`scene:${s.id}`);
      w.enemies = [];
      const at = def.near ? (w.places[def.near] ?? w.spots.find((sp) => sp.id === def.near) ?? w.npcs.find((n) => n.id === def.near)) : null;
      if (at) {
        w.player.x = at.x;
        w.player.y = at.y + 20;
      }
      for (let t = 0; t < 0.6; t += DT) {
        w.input = emptyInput();
        w.step(DT);
      }
      expect(w.scene?.def.id, def.id).toBe(def.id);
      let time = 0;
      let stepAt = 0;
      let last = -1;
      const said = new Set<number>();
      while (w.scene && time < 120) {
        w.input = emptyInput();
        w.step(DT);
        time += DT;
        const sc = w.scene;
        if (!sc) break;
        if (sc.step !== last) {
          last = sc.step;
          stepAt = time;
        }
        const st = def.steps[sc.step];
        if (!st) continue;
        // (a `follow` is a ride watched on purpose, for as long as it says)
        if ('move' in st && time - stepAt > 7) wrong.push(`${def.id} step ${sc.step}: ${st.move} takes over 7 s to walk to ${st.to}`);
        if (!('say' in st) || !sc.begun || said.has(sc.step) || time - stepAt < 0.4) continue;
        said.add(sc.step);
        lines++;
        const who = where(w, st.say);
        if (!who) {
          wrong.push(`${def.id} step ${sc.step}: ${st.say} is not there to speak`);
          continue;
        }
        if (!inSight(sc.focus ?? w.player, who)) wrong.push(`${def.id} step ${sc.step}: ${st.say} speaks out of the picture`);
        if (w.map.solid[Math.floor(who.y / TILE) * w.map.w + Math.floor(who.x / TILE)]) wrong.push(`${def.id} step ${sc.step}: ${st.say} stands in a wall`);
      }
      expect(w.scene, `${def.id} ends`).toBeNull();
    }
    expect([...new Set(wrong)]).toEqual([]);
    expect(lines).toBeGreaterThan(300);
  });
});

describe('Sigilfall: titles', () => {
  const hero = () => readyHero('warlock', 60, 'epic', 5);

  it('are earned by what the hero’s record says, and by nothing else', () => {
    const c = hero();
    expect(earnedTitles(c).map((t) => t.id)).toEqual(['deathless']);
    c.stats.deaths = 3;
    expect(earnedTitles(c)).toEqual([]);
    c.bosses.vaelor = 1;
    c.keystone = 6;
    expect(earnedTitles(c).map((t) => t.id)).toEqual(['kingslayer', 'riftwalker']);
    // the Ring's ranks, by the best rating reached
    expect(earnedTitles(c, RANKS[2]!.at).map((t) => t.name)).toContain(RANKS[2]!.name);
    expect(earnedTitles(c, RANKS[2]!.at).map((t) => t.name)).not.toContain(RANKS[3]!.name);
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
    for (const t of TITLES) expect(t.how.length, t.id).toBeGreaterThan(8);
  });

  it('one is worn at a time: the one chosen, else the warden’s once the story is done, else none', () => {
    const c = hero();
    c.stats.deaths = 3;
    expect(wornTitle(c)).toBeNull();
    c.quests[CAMPAIGN_END] = { state: 'done', n: 1 };
    expect(wornTitle(c)).toBe(WARDENS.warlock.title);
    // not earned: refused
    expect(chooseTitle(c, 'kingslayer')).toBe(false);
    c.bosses.vaelor = 1;
    expect(chooseTitle(c, 'kingslayer')).toBe(true);
    expect(wornTitle(c)).toBe('the Kingslayer');
    // none, on purpose
    expect(chooseTitle(c, '')).toBe(true);
    expect(wornTitle(c)).toBeNull();
    expect(chooseTitle(c, 'no-such-title')).toBe(false);
  });

  it('reads after the name the way a title does', () => {
    expect(titled('Ash', 'the Kingslayer')).toBe('Ash the Kingslayer');
    expect(titled('Ash', 'of Briarhollow')).toBe('Ash of Briarhollow');
    expect(titled('Ash', 'Stablemaster')).toBe('Ash, Stablemaster');
    expect(titled('Ash', null)).toBe('Ash');
  });

  it('a new one is told once, and the choice is kept with the hero', () => {
    const c = hero();
    c.stats.deaths = 3;
    c.bosses.vaelor = 1;
    expect(newTitles(c).map((t) => t.id)).toEqual(['kingslayer']);
    expect(newTitles(c)).toEqual([]);
    chooseTitle(c, 'kingslayer');
    const back = migrate(JSON.parse(JSON.stringify({ v: SAVE_VERSION, heroes: [c], last: 0, settings: {}, saved: 0 })))!;
    expect(back.heroes[0]?.title).toBe('kingslayer');
  });
});
