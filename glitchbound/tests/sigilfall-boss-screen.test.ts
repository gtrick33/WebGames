import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { isRetired } from '../src/games/sigilfall/data/retired';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { SigilEngine } from '../src/games/sigilfall/engine';
import { HOME } from '../src/games/sigilfall/progress/character';
import { aimReach, AUTO_AIM_REACH, seekReach } from '../src/games/sigilfall/sim/cast';
import { newWorld, readyHero } from './sigilfall-bot';

describe("Sigilfall: the portal out of a dungeon", () => {
  const dungeons = (Object.keys(REGIONS) as RegionId[]).filter((id) => REGIONS[id].kind === 'dungeon' && !isRetired(id));

  it('leads to the land the dungeon is entered from, for a hero who has been there', () => {
    let led = 0;
    let doors = 0;
    for (const id of dungeons) {
      const c = readyHero('warrior', REGIONS[id].level + 1);
      for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r)) c.unlocked.push(r);
      const w = newWorld(id, c);
      const way = w.portalWay();
      const out = w.exits.find((x) => !x.door && !isRetired(x.to));
      if (!out || out.to === HOME) {
        expect(way.to, id).toBe(HOME);
        continue;
      }
      led++;
      expect(way.to, id).toBe(out.to);
      expect(way.label, id).toContain(REGIONS[out.to].name);
      // and that land has the dungeon's door in it, which is where the hero is set down (World: `from`); a door the
      // story opens (the catacomb stair, the tear over Duskspire) isn't there for this hero, who hasn't lived it
      if (newWorld(out.to, c).exits.some((x) => x.to === id)) doors++;
    }
    expect(led).toBeGreaterThan(5);
    expect(doors).toBeGreaterThanOrEqual(led - 3);
  });

  it('leads to Briarhollow for a hero who has never found that land (a Riftstone run is entered from anywhere)', () => {
    const id = dungeons.find((d) => {
      const out = REGIONS[d];
      return !!out && d !== 'crypt';
    })!;
    const c = readyHero('warrior', REGIONS[id].level + 1);
    c.unlocked = [HOME, id];
    expect(newWorld(id, c).portalWay().to).toBe(HOME);
  });

  it('the cleared card goes where the portal goes, not always Briarhollow (2026-11-22)', () => {
    const src = readFileSync('src/games/sigilfall/ui/GameScreen.tsx', 'utf8');
    const card = src.slice(src.indexOf('function RewardScreen'), src.indexOf('function RotateHint'));
    expect(card).toContain('engine.leaveCleared()');
    expect(card).toContain('portalWay()');
    expect(card).not.toContain('engine.returnHome()');
    let went: unknown[] = [];
    const setUi = (): void => undefined;
    const world = { tier: 0, mods: [], region: { id: 'crypt' }, portalWay: () => ({ to: 'whisperwood', label: '' }) };
    SigilEngine.prototype.leaveCleared.call({ world, setUi, travel: (...a: unknown[]) => ((went = a), true) } as unknown as SigilEngine);
    expect(went.slice(0, 4)).toEqual(['whisperwood', 0, [], 'crypt']);
  });
});

describe('Sigilfall: how far a tapped spell looks for its target', () => {
  it('is half as far again as the spell reaches, for a spell thrown or set down', () => {
    expect(AUTO_AIM_REACH).toBeCloseTo(1.5);
    const specs = Object.values(SKILLS).map((s) => s.base);
    const thrown = specs.filter((s) => s.cast === 'projectile' || s.cast === 'ground');
    expect(thrown.length).toBeGreaterThan(10);
    for (const s of thrown) expect(seekReach(s), s.id).toBeCloseTo(aimReach(s) * 1.5);
  });

  it('is no further than a swing, a dash or a spell that must touch its target can reach', () => {
    for (const s of Object.values(SKILLS).map((x) => x.base)) {
      if (s.cast === 'melee' || s.cast === 'dash' || s.cast === 'chain' || s.cast === 'mark' || s.cast === 'drain') expect(seekReach(s), s.id).toBe(aimReach(s));
    }
  });
});

describe('Sigilfall: the screen in a boss fight', () => {
  const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
  const screen = readFileSync('src/games/sigilfall/ui/GameScreen.tsx', 'utf8');

  it('is marked while the boss bar is up, and only then', () => {
    expect(screen).toContain("${ui.boss ? ' is-boss' : ''}");
  });

  it('puts away the menu but Pause, the land, the experience bar, the notices and the room label', () => {
    for (const sel of ['.rb-ui.is-boss .rb-hud-menu > :not(.is-pause)', '.rb-ui.is-boss .rb-hud-hero .rb-region', '.rb-ui.is-boss .rb-hud-hero .rb-xp', '.rb-ui.is-boss .rb-toasts', '.rb-ui.is-boss .rb-encounter']) expect(css, sel).toContain(sel);
    // the hero's own bars, the skills and the map are not among them
    const rule = css.slice(css.indexOf('.rb-ui.is-boss .rb-hud-menu > :not(.is-pause)'));
    const hidden = rule.slice(0, rule.indexOf('}'));
    for (const kept of ['.rb-hp', '.rb-mp', '.rb-minimap', '.rb-touch', '.rb-deskbar']) expect(hidden, kept).not.toContain(kept);
  });

  it('has the Pause button named so it can be kept', () => {
    expect(screen).toContain('rb-hudbtn is-${icon}');
    expect(screen).toContain('icon="pause"');
  });

  it('never writes a hint across the death screen', () => {
    expect(screen).toContain('ui.tip && !ui.death && <TipOverlay');
  });
});

describe('Sigilfall: the boss bar and the Riftstone clock', () => {
  const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');
  const engine = readFileSync('src/games/sigilfall/engine.ts', 'utf8');
  const rule = (sel: string): string => {
    const at = css.lastIndexOf(`\n${sel} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
  };

  it('the boss bar is at the top of the screen and in its middle, the hero\'s bars narrowed to make room beside it', () => {
    const r = rule('  .rb-ui.is-boss .rb-bossbar');
    expect(r).toContain('left: 50%');
    expect(r).toContain('translateX(-50%)');
    expect(r).toContain('top: calc(4px + var(--sa-t))');
    expect(rule('  .rb-ui.is-boss .rb-hud-bars')).toContain('50cqw - min(23cqw, 230px)');
  });

  it('a boss\'s name is said once, on its bar: no banner of it under the bar, across what the boss calls', () => {
    expect(engine).toContain('banner: w.scene ? this.ui.banner : null };');
  });

  // (the owner, 2026-11-23: "the riftstone ui covers part of the other text": on a phone on its side the clock moved
  // from the quest's place down a little, clear of the line under the hero's bars)
  it('the clock is a fifth smaller, and on a phone on its side sits just under the line beneath the hero’s bars', () => {
    expect(rule('.rb-tracker.rb-keyclock')).toContain('scale(0.8)');
    const phone = rule('  .rb-ui.is-touch .rb-tracker.rb-keyclock');
    expect(phone).toContain('left: calc(8px + var(--sa-l))');
    expect(phone).toContain('top: calc(68px + var(--sa-t))');
    // the quest keeps its own place there, a little higher
    expect(rule('  .rb-ui.is-touch .rb-tracker:not(.rb-keyclock)')).toContain('top: calc(62px + var(--sa-t))');
  });

  it('a run shows the clock and not the quest, which is back when the run is over', () => {
    expect(readFileSync('src/games/sigilfall/ui/GameScreen.tsx', 'utf8')).toContain('{engine.world?.keyRun ? <KeyClock engine={engine} /> : <Tracker engine={engine} />}');
  });
});

describe('Sigilfall: the quest being followed is plain words', () => {
  const css = readFileSync('src/games/sigilfall/Game.css', 'utf8');

  it('has no panel behind it: no fill, no border, an edge of dark round the letters (the clock and the folded mark keep theirs)', () => {
    const at = css.lastIndexOf('\n.rb-tracker:not(.rb-keyclock):not(.is-folded) {');
    expect(at).toBeGreaterThan(0);
    const rule = css.slice(at, css.indexOf('\n}', at));
    expect(rule).toContain('background: none;');
    expect(rule).toContain('border-color: transparent;');
    expect(rule).toContain('text-shadow:');
    // it stands on its own at the top level, not inside a block for one size of screen
    const before = css.slice(0, at);
    expect((before.match(/\{/g) ?? []).length).toBe((before.match(/\}/g) ?? []).length);
  });
});
