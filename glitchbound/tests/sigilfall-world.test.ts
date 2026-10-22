import { afterEach, describe, expect, it } from 'vitest';
import { CLASS_IDS, xpToNext } from '../src/games/sigilfall/data/classes';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { NPCS, QUEST_DEFS, QUESTS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { QuestDef } from '../src/games/sigilfall/data/types';
import { generateZone } from '../src/games/sigilfall/data/zonegen';
import { bagSize, potionCap, startQuests } from '../src/games/sigilfall/progress/character';
import { validateCharacter } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { K, parseRegion } from '../src/games/sigilfall/sim/map';
import { objectiveTarget } from '../src/games/sigilfall/sim/objective';
import { nextRegion, npcRegion, spotRegion } from '../src/games/sigilfall/sim/routes';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { COMPANION_ART } from '../src/games/sigilfall/render/art/companions';
import { FOE_ART } from '../src/games/sigilfall/render/art/foes';
import { TOWNSFOLK_LOOKS } from '../src/games/sigilfall/render/art/townsfolk';
import { ZONE_ART } from '../src/games/sigilfall/render/art/zones';
import { CREATURE_ART } from '../src/games/sigilfall/render/artdata';
import { newWorld, play, readyHero } from './sigilfall-bot';

const step = (w: World, seconds: number, each?: (w: World) => void) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    each?.(w);
    w.input = emptyInput();
    w.step(1 / 60);
  }
};

/** A quest added for one test only. */
const temp: QuestDef[] = [];
function addQuest(q: QuestDef): QuestDef {
  QUESTS.push(q);
  QUEST_DEFS[q.id] = q;
  temp.push(q);
  return q;
}
afterEach(() => {
  for (const q of temp.splice(0)) {
    QUESTS.splice(QUESTS.indexOf(q), 1);
    delete QUEST_DEFS[q.id];
  }
});

describe('sigilfall zone generator', () => {
  it('makes the same zone from the same spec, with a town, its people, ways out and packs leveled by distance', () => {
    const a = REGIONS.thornvale;
    const m = parseRegion(a);
    // generated once and kept: asking again gives the same map
    expect(REGIONS.thornvale.map).toBe(a.map);
    const kinds = m.markers.map((x) => x.marker.kind);
    expect(kinds.filter((k) => k === 'waystone')).toHaveLength(1);
    for (const npc of ['reeve-aldous', 'hanna', 'tobin', 'sefa', 'pim']) expect(m.markers.some((x) => x.marker.kind === 'npc' && x.marker.npc === npc), npc).toBe(true);
    const exits = m.markers.filter((x) => x.marker.kind === 'exit');
    expect(exits.map((x) => (x.marker as { to: string }).to).sort()).toEqual(['emberwick', 'gallows-keep', 'greyfen', 'saltmarsh']);
    // ways out to other zones sit on the edge of the map
    for (const x of exits) if ((x.marker as { to: string }).to !== 'gallows-keep') expect(x.tx === 0 || x.ty === 0 || x.tx === m.w - 1 || x.ty === m.h - 1).toBe(true);
    const packs = m.markers.filter((x) => x.marker.kind === 'pack').map((x) => ({ ...x, level: (x.marker as { level: number }).level }));
    expect(packs.length).toBeGreaterThan(50);
    for (const p of packs) {
      expect(p.level).toBeGreaterThanOrEqual(8);
      expect(p.level).toBeLessThanOrEqual(15);
    }
    // nearer the way in, lower levels
    const near = packs.filter((p) => p.ty < m.h * 0.3).map((p) => p.level);
    const far = packs.filter((p) => p.ty > m.h * 0.7).map((p) => p.level);
    const avg = (l: number[]) => l.reduce((s, v) => s + v, 0) / l.length;
    expect(avg(far)).toBeGreaterThan(avg(near) + 2);
    // no enemy stands in the town
    const town = m.markers.find((x) => x.marker.kind === 'waystone')!;
    for (const p of packs) expect(Math.hypot(p.tx - town.tx, p.ty - town.ty)).toBeGreaterThan(12);
  });

  it('is deterministic and different seeds make different land', () => {
    const base = {
      w: 70,
      h: 50,
      seed: 5,
      levels: [3, 6] as [number, number],
      from: [0.1, 0.5] as [number, number],
      forest: 0.3,
      scatter: { trees: 2, bushes: 1, rocks: 1, flowers: 4 },
      water: { kind: 'lakes' as const, amount: 0.3 },
      hubs: [{ at: [0.4, 0.5] as [number, number], npcs: ['a', 'b'], houses: 3 }],
      exits: [{ side: 'w' as const, at: 0.5, to: 'emberwick' as const, label: 'Out' }],
      pois: [{ at: [0.8, 0.3] as [number, number], r: 7, kind: 'camp' as const, packs: [['moss-slime']], spot: { id: 'x', name: 'X' } }],
      wild: [{ band: [0, 1] as [number, number], packs: [['moss-slime', 'moss-slime']] }],
      wildCount: 10,
    };
    expect(generateZone(base)).toEqual(generateZone(base));
    expect(generateZone({ ...base, seed: 6 }).map).not.toEqual(generateZone(base).map);
  });
});

describe('sigilfall routes between regions', () => {
  it('knows the way across the world and where people and places are', () => {
    expect(nextRegion('emberwick', 'saltmarsh')).toBe('thornvale');
    expect(nextRegion('thornvale', 'saltmarsh')).toBe('saltmarsh');
    expect(nextRegion('saltmarsh', 'crypt')).toBe('thornvale');
    expect(nextRegion('emberwick', 'emberwick')).toBeNull();
    expect(npcRegion('reeve-aldous')).toBe('thornvale');
    expect(npcRegion('maren')).toBe('emberwick');
    expect(spotRegion('gull-cliffs')).toBe('saltmarsh');
    // secrets are not on the map
    expect(spotRegion('hidden-grove')).toBeUndefined();
  });

  it('points the quest marker at the way out toward a quest in another region', () => {
    const w = newWorld('emberwick', readyHero('mage', 9));
    const h = w.hero;
    for (const id of Object.keys(h.quests)) h.quests[id]!.state = 'done';
    addQuest({ id: 't-talk', name: 'T', giver: 'maren', text: '', objective: { kind: 'talk', npc: 'reeve-aldous', label: 'Talk' }, reward: { xp: 1, gold: 1 } });
    h.quests['t-talk'] = { state: 'active', n: 0 };
    const t = objectiveTarget(w)!;
    const south = w.exits.find((e) => e.to === 'thornvale')!;
    expect(t).toEqual({ x: south.x, y: south.y, soft: false });
  });
});

describe('sigilfall in the wilds', () => {
  it('a wiped-out pack comes back after a while, but never in front of the hero', () => {
    const w = newWorld('thornvale', readyHero('warrior', 12));
    const p = w.player;
    const pack = w.packs.find((st) => Math.hypot(st.x - p.x, st.y - p.y) > 500)!;
    const ids = [...pack.ids];
    for (const e of w.enemies) if (ids.includes(e.id)) hitEnemy(w, e, 1e7, 'physical', { depth: 0 });
    expect(pack.respawnT).toBeGreaterThan(60);
    // standing right there, it stays gone
    p.x = pack.x;
    p.y = pack.y;
    pack.respawnT = 0.01;
    step(w, 1, (x) => {
      x.player.iframe = 1;
    });
    expect(w.enemies.some((e) => e.pack === pack.index && !e.dead)).toBe(false);
    // away from it, it is back
    const far = w.packs.find((st) => Math.hypot(st.x - pack.x, st.y - pack.y) > 700)!;
    p.x = far.x;
    p.y = far.y + 40;
    step(w, 0.5, (x) => {
      x.player.iframe = 1;
    });
    expect(w.enemies.filter((e) => e.pack === pack.index && !e.dead)).toHaveLength(ids.length);
  });

  it('enemies far from the hero sleep, near ones keep moving', () => {
    const w = newWorld('thornvale', readyHero('warrior', 12));
    const p = w.player;
    const far = w.enemies.find((e) => Math.abs(e.x - p.x) > 600)!;
    const fx = far.x;
    const fy = far.y;
    far.t = -1;
    step(w, 3);
    expect([far.x, far.y]).toEqual([fx, fy]);
  });

  it('walking near a sight discovers it once, for a little experience and explore quests', () => {
    const w = newWorld('thornvale', readyHero('warrior', 10));
    const h = w.hero;
    addQuest({ id: 't-explore', name: 'T', giver: 'maren', text: '', objective: { kind: 'explore', spot: 'wolfrun', label: 'Find it' }, reward: { xp: 1, gold: 1 } });
    h.quests['t-explore'] = { state: 'active', n: 0 };
    const spot = w.spots.find((s) => s.id === 'wolfrun')!;
    const xp = h.xp;
    w.player.x = spot.x;
    w.player.y = spot.y;
    for (const e of w.enemies) e.state = 'idle';
    step(w, 0.1, (x) => {
      x.player.iframe = 1;
    });
    expect(h.opened).toContain('spot:thornvale:wolfrun');
    expect(h.quests['t-explore']!.state).toBe('done');
    expect(h.xp).toBeGreaterThanOrEqual(xp + Math.round(xpToNext(10) * 0.03) - 1);
    const xp2 = h.xp;
    step(w, 0.1);
    expect(h.xp).toBe(xp2);
  });

  it('loot objectives drop their things from the right enemies only', () => {
    const w = newWorld('thornvale', readyHero('warrior', 12));
    const h = w.hero;
    const q = addQuest({ id: 't-loot', name: 'T', giver: 'maren', text: '', zone: 'thornvale', objective: { kind: 'loot', region: 'thornvale', item: 'Wolf Pelt', from: ['hill-wolf'], chance: 1, count: 2, label: 'Pelts' }, reward: { xp: 1, gold: 1 } });
    h.quests[q.id] = { state: 'active', n: 0 };
    const p = w.player;
    const kill = (id: string) => hitEnemy(w, w.addEnemy(id, p.x + 400, p.y, 10, { room: -1, pack: -1 }), 1e7, 'physical', { depth: 0 });
    kill('bandit-cutthroat');
    expect(h.quests[q.id]!.n).toBe(0);
    kill('hill-wolf');
    kill('hill-wolf');
    expect(h.quests[q.id]!.state).toBe('done');
  });

  it('kill objectives can count only some enemies', () => {
    const w = newWorld('thornvale', readyHero('warrior', 12));
    const h = w.hero;
    const q = addQuest({ id: 't-kill', name: 'T', giver: 'maren', text: '', objective: { kind: 'kill', region: 'thornvale', count: 1, enemies: ['thornback-spider'], label: 'Spiders' }, reward: { xp: 1, gold: 1 } });
    h.quests[q.id] = { state: 'active', n: 0 };
    const p = w.player;
    hitEnemy(w, w.addEnemy('hill-wolf', p.x + 400, p.y, 10, { room: -1, pack: -1 }), 1e7, 'physical', { depth: 0 });
    expect(h.quests[q.id]!.state).toBe('active');
    hitEnemy(w, w.addEnemy('thornback-spider', p.x + 400, p.y, 10, { room: -1, pack: -1 }), 1e7, 'physical', { depth: 0 });
    expect(h.quests[q.id]!.state).toBe('done');
  });

  it('roads to new lands warn heroes who are too young; old roads still need their quests', () => {
    const young = newWorld('emberwick', readyHero('mage', 5));
    const south = young.exits.find((e) => e.to === 'thornvale')!;
    young.player.x = south.x;
    young.player.y = south.y - 4;
    young.step(1 / 60);
    expect(young.interactable).toMatchObject({ kind: 'exit', to: 'thornvale' });
    expect((young.interactable as { locked: string }).locked).toMatch(/level 7/);
    const ready = newWorld('emberwick', readyHero('mage', 8));
    ready.player.x = south.x;
    ready.player.y = south.y - 4;
    ready.step(1 / 60);
    expect((ready.interactable as { locked: string | null }).locked).toBeNull();
  });

  it('zone quests start once the hero has been there and is of their level', () => {
    const c = readyHero('mage', 8);
    const q = addQuest({ id: 't-zone', name: 'T', giver: 'maren', text: '', zone: 'saltmarsh', level: 9, objective: { kind: 'talk', npc: 'maren', label: 'x' }, reward: { xp: 1, gold: 1 } });
    startQuests(c);
    expect(c.quests[q.id]).toBeUndefined();
    c.unlocked.push('saltmarsh');
    startQuests(c);
    expect(c.quests[q.id]).toBeUndefined();
    c.level = 9;
    startQuests(c);
    expect(c.quests[q.id]?.state).toBe('active');
  });
});

describe('sigilfall perks', () => {
  it('the satchel and the flask raise the limits; saves keep perks and drop unknown ones', () => {
    const c = readyHero('mage', 5);
    expect(bagSize(c)).toBe(30);
    expect(potionCap(c)).toBe(5);
    c.perks.push('satchel', 'flask');
    expect(bagSize(c)).toBe(36);
    expect(potionCap(c)).toBe(6);
    const back = validateCharacter(JSON.parse(JSON.stringify({ ...c, perks: ['satchel', 'jetpack'], potions: 6 })), 0)!;
    expect(back.perks).toEqual(['satchel']);
    expect(back.potions).toBe(5);
  });

  it('the mount is faster outside fights, and not in dungeons', () => {
    const speed = (region: 'emberwick' | 'crypt', mount: boolean, calm: number) => {
      const c = readyHero('mage', 8);
      if (mount) c.perks.push('mount');
      c.unlocked.push('crypt');
      const w = newWorld(region, c);
      w.enemies = [];
      const p = w.player;
      const x0 = p.x;
      for (let i = 0; i < 30; i++) {
        p.calm = calm;
        w.input = { ...emptyInput(), mx: 1, my: 0 };
        w.step(1 / 60);
      }
      return p.x - x0;
    };
    expect(speed('emberwick', true, 10)).toBeGreaterThan(speed('emberwick', false, 10) * 1.2);
    expect(speed('emberwick', true, 0)).toBeCloseTo(speed('emberwick', false, 0), 0);
    expect(speed('crypt', true, 10)).toBeCloseTo(speed('crypt', false, 10), 0);
  });
});

describe('sigilfall enemy behaviour', () => {
  it('a healer mends a hurt friend instead of attacking', () => {
    const w = newWorld('thornvale', readyHero('warrior', 12));
    w.enemies = [];
    const p = w.player;
    const witch = w.addEnemy('hedge-witch', p.x + 90, p.y, 10, { room: -1, pack: 1 });
    const friend = w.addEnemy('bandit-enforcer', p.x + 110, p.y + 10, 10, { room: -1, pack: 1 });
    friend.hp = friend.maxHp * 0.3;
    for (const e of [witch, friend]) {
      e.aggro = true;
      e.state = 'chase';
    }
    witch.atkCd = 0;
    const before = friend.hp;
    step(w, 2, (x) => {
      x.player.iframe = 1;
      friend.atkCd = 9;
    });
    expect(friend.hp).toBeGreaterThan(before + friend.maxHp * 0.2);
  });

  it('archers lead a moving hero; webs slow', () => {
    const w = newWorld('thornvale', readyHero('warrior', 12));
    w.enemies = [];
    const p = w.player;
    const archer = w.addEnemy('bandit-archer', p.x + 100, p.y, 10, { room: -1, pack: 1 });
    archer.aggro = true;
    archer.state = 'chase';
    archer.atkCd = 0;
    let shot: number | null = null;
    for (let i = 0; i < 120 && shot === null; i++) {
      p.iframe = 1;
      w.input = { ...emptyInput(), my: 1 };
      w.step(1 / 60);
      const pr = w.projectiles.find((x) => x.hostile);
      if (pr) shot = Math.atan2(pr.vy, pr.vx);
    }
    expect(shot).not.toBeNull();
    // the hero runs down the screen: the arrow aims below where they are
    const straight = Math.atan2(p.y - archer.y, p.x - archer.x);
    expect(shot!).toBeLessThan(straight);
    // a web
    w.projectiles = [];
    w.spawnProjectile({ x: p.x + 20, y: p.y, vx: -150, vy: 0, r: 3, life: 100, dmg: 1, type: 'physical', spec: null, depth: 0, pierce: 0, bounce: 0, hit: [], look: 'web', color: '#fff', hostile: true, child: false, knock: 0, status: ENEMIES['thornback-spider']!.shot!.status });
    p.iframe = 0;
    step(w, 0.3);
    expect(p.statuses.some((s) => s.id === 'chill')).toBe(true);
  });

  it('a harpy marks its swoop on the ground before it comes', () => {
    const w = newWorld('saltmarsh', readyHero('warrior', 16));
    w.enemies = [];
    const p = w.player;
    const harpy = w.addEnemy('cliff-harpy', p.x + 100, p.y, 15, { room: -1, pack: 1 });
    harpy.aggro = true;
    harpy.state = 'chase';
    harpy.atkCd = 0;
    let marked = false;
    for (let i = 0; i < 90 && !marked; i++) {
      p.iframe = 1;
      w.step(1 / 60);
      marked = w.telegraphs.some((t) => t.shape === 'line');
    }
    expect(marked).toBe(true);
  });
});

describe('sigilfall enemy tricks', () => {
  const base = ENEMIES['bandit-cutthroat']!;
  const def = (id: string, extra: Partial<typeof base>) => {
    ENEMIES[id] = { ...base, id, name: id, ...extra };
    return id;
  };
  afterEach(() => {
    for (const id of ['t-exploder', 't-necro', 't-shade', 't-troll']) delete ENEMIES[id];
  });
  const arena = () => {
    const w = newWorld('thornvale', readyHero('warrior', 12));
    w.enemies = [];
    return w;
  };
  const engage = (e: World['enemies'][number]) => {
    e.aggro = true;
    e.state = 'chase';
    e.atkCd = 0;
  };

  it('an exploder swells beside the hero and bursts, gone for good', () => {
    const w = arena();
    const p = w.player;
    const e = w.addEnemy(def('t-exploder', { ai: 'exploder', windup: 0.6, burst: { radius: 26, pool: 3 } }), p.x + 30, p.y, 10, { room: -1, pack: 1 });
    engage(e);
    const hp = p.hp;
    const xp = w.hero.xp;
    step(w, 2);
    expect(e.dead).toBe(true);
    expect(p.hp).toBeLessThan(hp);
    expect(w.fields.some((f) => f.hostile && f.look === 'poison')).toBe(true);
    // bursting itself pays nothing
    expect(w.hero.xp).toBe(xp);
  });

  it('a necromancer raises its minions, never more than its limit', () => {
    const w = arena();
    const p = w.player;
    const e = w.addEnemy(def('t-necro', { ai: 'caster', windup: 0.4, keep: 110, summons: { enemy: 'skeleton', count: 2, max: 3 } }), p.x + 100, p.y, 10, { room: -1, pack: 1 });
    engage(e);
    step(w, 10, (x) => {
      x.player.iframe = 1;
      e.atkCd = Math.min(e.atkCd, 0);
    });
    const minions = w.enemies.filter((o) => o.master === e.id && !o.dead);
    expect(minions.length).toBeGreaterThanOrEqual(2);
    expect(minions.length).toBeLessThanOrEqual(3);
  });

  it('a shade blinks away from a hero who closes in, then waits before the next', () => {
    const w = arena();
    const p = w.player;
    const e = w.addEnemy(def('t-shade', { ai: 'caster', blink: 80, keep: 100 }), p.x + 30, p.y, 10, { room: -1, pack: 1 });
    engage(e);
    e.atkCd = 5;
    step(w, 0.1, (x) => {
      x.player.iframe = 1;
    });
    expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeGreaterThan(55);
    expect(e.blinkT).toBeGreaterThan(3);
  });

  it('a troll knits back together once it hasn’t been hit for a while', () => {
    const w = arena();
    const p = w.player;
    const e = w.addEnemy(def('t-troll', { regen: 0.05 }), p.x + 300, p.y, 10, { room: -1, pack: 1 });
    e.hp = e.maxHp * 0.5;
    e.hurtT = 0;
    step(w, 2);
    expect(e.hp).toBeCloseTo(e.maxHp * 0.5, 0);
    step(w, 6);
    expect(e.hp).toBeGreaterThan(e.maxHp * 0.55);
  });
});

describe('sigilfall map kinds', () => {
  it('sand is ground you walk on', () => {
    const m = parseRegion(REGIONS.saltmarsh);
    const i = [...m.kind].findIndex((k) => k === K.Sand);
    expect(i).toBeGreaterThan(0);
    expect(m.solid[i]).toBe(0);
  });
});

describe('sigilfall wild zones, played', () => {
  // every class, at the zone's lower levels, fights its way through the packs around the town
  const ZONES = [
    { region: 'brackenridge', level: 6 },
    { region: 'thornvale', level: 9 },
    { region: 'greyfen', level: 12 },
    { region: 'saltmarsh', level: 15 },
    { region: 'amberfield', level: 17 },
    { region: 'duskfen', level: 19 },
    { region: 'ironpeak', level: 21 },
    { region: 'ashen-barrows', level: 24 },
    { region: 'stormwatch', level: 27 },
  ] as const;
  for (const z of ZONES) {
    for (const cls of CLASS_IDS) {
      it(`${cls}: holds its own in ${z.region} at level ${z.level}`, { timeout: 30_000 }, () => {
        const w = newWorld(z.region, readyHero(cls, z.level, 'common', 5));
        const r = play(w, { seconds: 240, done: (x) => x.run.kills >= 25 });
        expect(r.stuck).toBe(false);
        expect(r.kills).toBeGreaterThanOrEqual(25);
        expect(r.deaths).toBeLessThanOrEqual(1);
      });
    }
  }
});

describe('sigilfall art', () => {
  it('every sprite and townsfolk look is drawn once, and every enemy, boss and person has one', () => {
    // zone art files are merged into one table, so a repeated id would silently replace another
    const drawn = new Set<string>();
    for (const table of [CREATURE_ART, COMPANION_ART, FOE_ART, ...ZONE_ART.map((z) => z.foes)]) {
      for (const id of Object.keys(table)) {
        expect(drawn.has(id), `sprite ${id} is drawn twice`).toBe(false);
        drawn.add(id);
      }
    }
    for (const e of Object.values(ENEMIES)) expect(drawn.has(e.sprite), `${e.id} has no sprite ${e.sprite}`).toBe(true);
    for (const b of Object.values(BOSSES)) expect(drawn.has(b.sprite), `${b.id} has no sprite ${b.sprite}`).toBe(true);
    const looks = new Set<string>();
    for (const table of [TOWNSFOLK_LOOKS, ...ZONE_ART.map((z) => z.looks)]) {
      for (const id of Object.keys(table)) {
        expect(looks.has(id), `look ${id} is defined twice`).toBe(false);
        looks.add(id);
      }
    }
    for (const n of Object.values(NPCS)) expect(looks.has(n.id) || drawn.has(n.sprite), `${n.id} has no look`).toBe(true);
  });
});
