/**
 * The story as it is watched. Every scene is played through and looked at the way the camera looks at it: whoever
 * speaks is in the picture (fifteen scenes used to have lines spoken from off the screen, one from sixty tiles
 * away), the camera doesn't swing over to someone who already was, nobody of a memory stands in a wall, and nobody is
 * waited on for a ten-second walk. And the titles a hero
 * can carry for the rare things they did.
 */
import { describe, expect, it } from 'vitest';
import { RANKS } from '../src/games/sigilfall/arena/ranks';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import { WARDENS, CAMPAIGN_END } from '../src/games/sigilfall/data/wardens';
import { applyPreset, PRESETS } from '../src/games/sigilfall/progress/presets';
import { allTitles, chooseTitle, earnedTitles, newTitles, RING_TITLES, setGivenTitles, titled, TITLES, wornTitle, wornTitleShown } from '../src/games/sigilfall/progress/titles';
import { isTitleFx, TITLE_FX, titleFx } from '../src/catalog/titleFx';
import { migrate, SAVE_VERSION } from '../src/games/sigilfall/progress/save';
import { inSight, TALK_ZOOM } from '../src/games/sigilfall/sim/scene';
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
  it('whoever speaks is in the picture (and the camera stays put for one who is), nobody stands in a wall, and no walk is waited on', { timeout: 600_000 }, () => {
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
      let cam = { x: w.player.x, y: w.player.y };
      while (w.scene && time < 120) {
        w.input = emptyInput();
        const before = cam;
        w.step(DT);
        time += DT;
        const sc = w.scene;
        if (!sc) break;
        if (sc.step !== last) {
          last = sc.step;
          stepAt = time;
        }
        const st = def.steps[sc.step];
        cam = sc.focus ? { ...sc.focus } : { x: w.player.x, y: w.player.y };
        if (!st) continue;
        // the camera goes to a speaker only when they were out of the picture (the owner: "the camera keeps pointing at
        // something and then suddenly change dirextion to the tapking npcs, remove such redundant transitions")
        const speaker = 'say' in st ? where(w, st.say) : null;
        const z = sc.zoom ?? TALK_ZOOM;
        if (speaker && Math.hypot(cam.x - before.x, cam.y - before.y) > TILE && inSight(before, speaker, { side: 6.2 * z, up: 4 * z, down: 3.2 * z })) wrong.push(`${def.id} step ${sc.step}: the camera swings to ${st.say}, who was already in the picture`);
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

  it('stands before the name, unless it names what it is of (the owner: "Unblooded Guitartrick, Blooded Guitartrick")', () => {
    expect(titled('Ash', 'the Kingslayer')).toBe('Ash the Kingslayer');
    expect(titled('Ash', 'of Briarhollow')).toBe('Ash of Briarhollow');
    expect(titled('Ash', 'Champion of the Starfall')).toBe('Ash, Champion of the Starfall');
    expect(titled('Ash', 'Stablemaster')).toBe('Stablemaster Ash');
    expect(titled('Ash', 'Blooded')).toBe('Blooded Ash');
    expect(titled('Ash', null)).toBe('Ash');
    // the Ring's ranks always stand before it, even one with "of" in it
    const c = hero();
    c.stats.deaths = 3;
    expect(chooseTitle(c, 'ring-1900', 1900)).toBe(true);
    expect(titled(c.name, wornTitleShown(c, 1900))).toBe(`Warden of the Ring ${c.name}`);
  });

  it('each wears a light, finer the harder it is, and the finest is the top of the Ring', () => {
    for (const t of TITLES) expect(isTitleFx(t.fx), t.id).toBe(true);
    const tier = (id: string): number => titleFx(TITLES.find((t) => t.id === id)!.fx).tier;
    const top = Math.max(...TITLE_FX.map((f) => f.tier));
    expect(TITLES.filter((t) => titleFx(t.fx).tier === top).map((t) => t.id)).toEqual(['ring-2100']);
    // the Ring's climb never steps down
    const ring = RING_TITLES.map((t) => tier(t.id));
    expect(ring).toEqual([...ring].sort((a, b) => a - b));
    expect(TITLES.every((t) => t.fx !== 'plain')).toBe(true);
  });

  it('one an admin gave the account can be worn by any hero of it, while the account has it', () => {
    const c = hero();
    c.stats.deaths = 3;
    setGivenTitles([{ id: 'g1', name: '  Friend\u202e of the  Ring  ', fx: 'void', before: false, at: 1 }, { id: '', name: 'x', fx: 'void', before: true, at: 1 }, { id: 'g2', name: '', fx: 'gleam', before: true, at: 1 }]);
    expect(allTitles().filter((t) => t.given).map((t) => t.name)).toEqual(['Friend of the Ring']);
    expect(chooseTitle(c, 'given-g1')).toBe(true);
    expect(wornTitleShown(c)).toEqual({ text: 'Friend of the Ring', fx: 'void', before: false });
    expect(titled(c.name, wornTitleShown(c))).toBe(`${c.name}, Friend of the Ring`);
    // never told of once per hero: the site tells of it when it arrives
    expect(newTitles(c).some((t) => t.given)).toBe(false);
    setGivenTitles([]);
    expect(wornTitle(c)).toBeNull();
    setGivenTitles([{ id: 'g3', name: 'Blessed', fx: 'nonsense' as never, before: true, at: 1 }]);
    expect(allTitles().find((t) => t.given)?.fx).toBe('gleam');
    setGivenTitles(undefined);
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
