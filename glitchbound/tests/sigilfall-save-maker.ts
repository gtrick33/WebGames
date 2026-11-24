import { ACTS } from '../src/games/sigilfall/data/acts';
import { keyAffixes, riftDungeons, weekOf } from '../src/games/sigilfall/data/keystones';
import { QUESTS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { seasonAt } from '../src/games/sigilfall/data/seasons';
import { SPEC_LEVEL, TALENTS } from '../src/games/sigilfall/data/talents';
import type { ClassId, RegionId } from '../src/games/sigilfall/data/types';
import { bagSize, cantEquip, chooseSpec, equip, freePoints, HOME, learnTalent, newCharacter, questState, salvage, type Body, type Character } from '../src/games/sigilfall/progress/character';
import { compareGear } from '../src/games/sigilfall/progress/compare';
import { itemWorth } from '../src/games/sigilfall/progress/items';
import { paragonFree, spendParagon } from '../src/games/sigilfall/progress/paragon';
import { DEFAULT_SETTINGS, emptySave, saveText } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { flowField, flowStep, TILE } from '../src/games/sigilfall/sim/map';
import { endScene } from '../src/games/sigilfall/sim/scene';
import { World } from '../src/games/sigilfall/sim/world';
import { beat, enter, type Walk } from './sigilfall-walk';

/**
 * Makes the save fixtures of NINE_PLAN.md (tests/sigilfall-saves/): three heroes as the game stood before the pass to
 * 9/10 began, each saved by the game's own save code (`saveText`), so every later piece can show that an old save
 * still loads (tests/sigilfall-save-fixtures.test.ts). Run by scripts/sigilfall-save-fixtures.mjs.
 *
 * Each hero is walked through the real simulation the way the campaign test walks one (tests/sigilfall-walk.ts): by
 * the quest arrow, taking what the givers offer, fighting what the story sends. On top of that walk it does what a
 * player does and the walk doesn't: wears better gear as it comes, picks a specialization at 10 and spends talent
 * points; and what the engine notes as a hero plays (engine.ts): the lands and acts seen, things found, play time,
 * and where the hero stands. The walk's hero can't fall and strikes hard, so falls and kill counts are not a
 * player's; everything else in the file is what the rules wrote.
 */

/** When the fixtures' heroes were made and saved: fixed, so the files come out the same every time. */
export const MADE_AT = Date.UTC(2026, 10, 24, 12, 0, 0);

const DT = 1 / 60;

/** What a player does between fights. */
function upkeep(c: Character): void {
  if (c.level >= SPEC_LEVEL && c.spec === null) chooseSpec(c, 0);
  for (let guard = 0; c.spec !== null && freePoints(c) > 0 && guard < 80; guard++) {
    const node = [...TALENTS[c.cls]].sort((a, b) => (a.tree === c.spec ? 0 : 1) - (b.tree === c.spec ? 0 : 1) || a.row - b.row).find((n) => learnTalent(c, n.id));
    if (!node) break;
  }
  for (const it of [...c.bag]) if (!cantEquip(c, it) && compareGear(c, it).better) equip(c, it.uid);
  // the bag kept as a player keeps it: plain pieces that are no better than what is worn are melted down, and the
  // least of the rest when there is no room left for the next fight's loot
  for (const it of [...c.bag]) if ((it.r === 'common' || it.r === 'uncommon' || it.r === 'rare') && !compareGear(c, it).better) salvage(c, it.uid);
  for (const it of [...c.bag].sort((a, b) => itemWorth(a) - itemWorth(b))) if (c.bag.length > bagSize(c) - 8) salvage(c, it.uid);
  for (const line of ['might', 'vigor', 'precision', 'toughness'] as const) if (paragonFree(c.para) > 0) spendParagon(c.para, line, Math.ceil(paragonFree(c.para) / 2));
}

/** What the engine notes on the hero as they play (engine.ts: travel, actBegins, closeStory, hint, the loop's clock). */
function notes(c: Character, w: World, seconds: number): void {
  const add = (key: string): void => {
    if (!c.opened.includes(key)) c.opened.push(key);
  };
  if (!w.region.interior) add(`land:${w.region.id}`);
  for (const act of ACTS) if (questState(c, act.opens) !== 'locked' && questState(c, act.opens) !== 'offered') add(`act:${act.id}`);
  for (const q of QUESTS) if (q.find && questState(c, q.id) === 'done') add(`kept:${q.id}`);
  if (Object.keys(c.equip).length > 1) add('hint:equip');
  if (c.level >= 8) add('hint:ult');
  if (c.level >= SPEC_LEVEL) add('hint:spec');
  c.stats.time += seconds;
}

/** Where the hero stands, as the engine keeps it on every road taken (engine.ts travel). */
function place(c: Character, w: World): void {
  if (w.region.id === HOME) delete c.at;
  else c.at = { region: w.region.id, ...(w.tier ? { tier: w.tier } : {}), ...(w.region.kind === 'dungeon' ? (w.dungeonMark() ?? {}) : {}) };
}

/** A new hero, walked from the first night until `stop` says so (or the story and its side roads are done). */
function walked(cls: ClassId, name: string, slot: number, body: Body, stop: (c: Character, w: World) => boolean): Walk {
  const hero = newCharacter(cls, name, `hero${slot}`, MADE_AT, body);
  const walk: Walk = { hero, w: null as unknown as World, lost: [], barred: [], travels: 0, trail: [], blank: 0, deadEnds: [], beats: true };
  enter(walk, HOME);
  for (let beats = 0; beats < 400_000 && walk.travels < 3000; beats++) {
    // a scene the story stages is watched to its end the quick way (the Skip button), so its `scene:` mark is kept
    if (walk.w.scene) endScene(walk.w, true);
    notes(hero, walk.w, 15 * DT);
    if (beats % 8 === 0) upkeep(hero);
    if (stop(hero, walk.w) || !beat(walk)) break;
  }
  upkeep(hero);
  notes(hero, walk.w, 0);
  place(hero, walk.w);
  hero.updated = MADE_AT + Math.round(hero.stats.time * 1000);
  return walk;
}

/** One Riftstone run of a dungeon, room by room to its last boss, in the season and week of `MADE_AT`. */
function riftRun(hero: Character, region: RegionId, stone: number, seed: number): World {
  const season = seasonAt(MADE_AT)?.n;
  const w = new World({ region, tier: 2, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed, key: stone, affixes: keyAffixes(stone, weekOf(MADE_AT)), handIns: false, ...(season ? { season } : {}) });
  const p = w.player;
  for (let i = 0; i < 60 * 60 * 30 && !w.keyRun?.end; i++) {
    if (i % 15 === 0) {
      const foe = w.enemies.filter((e) => !e.dead && !e.dummy && e.state !== 'spawn').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      const room = w.encounters.find((e) => e.state === 'idle');
      const tiles = room ? (w.map.roomTiles[room.index] ?? []).filter((t) => !w.map.solid[t]) : [];
      const mid = tiles[Math.floor(tiles.length / 2)];
      const goal = w.encounters.some((e) => e.state === 'active') && foe ? foe : mid !== undefined ? { x: ((mid % w.map.w) + 0.5) * TILE, y: (Math.floor(mid / w.map.w) + 0.5) * TILE } : foe;
      if (goal && Math.hypot(goal.x - p.x, goal.y - p.y) > 60) {
        const f = flowField(w.map, Math.floor(goal.x / TILE), Math.floor(goal.y / TILE), 600);
        for (let k = 0; k < 12; k++) {
          const s = flowStep(w.map, f, p.x, p.y);
          if (!s) break;
          p.x += s.x * 8;
          p.y += s.y * 8;
        }
      }
    }
    p.hp = p.maxHp;
    for (const e of w.enemies) if (!e.dead && !e.dummy && e.state !== 'spawn' && Math.hypot(e.x - p.x, e.y - p.y) < 140) hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
    w.step(DT);
    hero.stats.time += DT;
  }
  w.collectAll();
  return w;
}

export interface MadeSave {
  /** The fixture's file name in tests/sigilfall-saves/. */
  file: string;
  /** What the hero is, for the fixture's test and its README. */
  about: { cls: ClassId; name: string; level: number; region: string; done: number; active: string[]; sigils: number; keystone: number; riftRuns?: { region: string; stone: number; up: number }[]; lost: string[] };
  /** The save as the game writes it to the device. */
  text: string;
}

function made(file: string, walk: Walk, extra: Partial<MadeSave['about']> = {}): MadeSave {
  const c = walk.hero;
  const save = emptySave();
  save.heroes[0] = c;
  save.saved = c.updated;
  save.settings = { ...DEFAULT_SETTINGS };
  const states = Object.entries(c.quests);
  return {
    file,
    about: {
      cls: c.cls,
      name: c.name,
      level: c.level,
      region: c.at?.region ?? HOME,
      done: states.filter(([, e]) => e.state === 'done').length,
      active: states.filter(([, e]) => e.state === 'active' || e.state === 'ready').map(([id]) => id),
      sigils: c.perks.filter((x) => x.startsWith('sigil-')).length,
      keystone: c.keystone,
      lost: [...walk.lost, ...walk.deadEnds],
      ...extra,
    },
    text: saveText(save),
  };
}

/** A mage on the first night: the chapel door is being held. */
export function midPrologue(): MadeSave {
  const walk = walked('mage', 'Ilse', 0, 'f', (c) => questState(c, 'briar-hold-the-door') === 'active');
  return made('mid-prologue.json', walk);
}

/** A ranger in the race for the sigils: the Sun is won, and the prince of the Thorn Court is next. */
export function midActThree(): MadeSave {
  const walk = walked('ranger', 'Corin', 0, 'm', (c, w) => questState(c, 'silvaines-song') === 'active' && w.region.id === 'glimmerwood');
  return made('mid-act-3.json', walk);
}

/** A warrior who has finished the story and every side road, and run the Riftstone: in the Riftward, in Rift gear. */
export function finishedInRiftward(): MadeSave {
  const walk = walked('warrior', 'Bryn', 0, 'f', () => false);
  const c = walk.hero;
  const runs: { region: string; stone: number; up: number }[] = [];
  // the Rift, as far as a dozen runs take it: each dungeon open at the hero's stone, at the deepest stone open there
  for (let n = 0; n < 12 && c.keystone > 0; n++) {
    const pool = riftDungeons(c.keystone);
    const region = pool[n % pool.length]!.id as RegionId;
    const stone = Math.max(1, c.stones[region] ?? 1);
    const w = riftRun(c, region, stone, 100 + n);
    runs.push({ region, stone, up: w.keyRun?.end?.up ?? -1 });
    upkeep(c);
  }
  if (!c.unlocked.includes('riftward')) c.unlocked.push('riftward');
  if (REGIONS.riftward && !c.opened.includes('land:riftward')) c.opened.push('land:riftward');
  c.at = { region: 'riftward' };
  c.updated = MADE_AT + Math.round(c.stats.time * 1000);
  return made('finished-riftward.json', walk, { riftRuns: runs });
}
