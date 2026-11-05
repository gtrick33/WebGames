import { describe, expect, it } from 'vitest';
import { ITEM_DEFS } from '../src/games/sigilfall/data/items';
import { MOUNT_DEFS, MOUNTS } from '../src/games/sigilfall/data/mounts';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { PERKS, addItem, salvage, type Character } from '../src/games/sigilfall/progress/character';
import { buildHero } from '../src/games/sigilfall/progress/build';
import { makeItem, rollGear } from '../src/games/sigilfall/progress/items';
import { migrate, SAVE_VERSION } from '../src/games/sigilfall/progress/save';
import { BARE_LOOK, chooseMount, FIRST_RIDE, grantMounts, hasMount, learnLooks, lookId, lookOf, mountEarned, ridingOpen, setShelfPoints, wearLook, wornLooks } from '../src/games/sigilfall/progress/wardrobe';
import { CAMPAIGN_END } from '../src/games/sigilfall/data/wardens';
import { MOUNT_FRAMES, MOUNT_WALK_FRAMES, paintMount, paintRiderLegs, RIDER_HIP } from '../src/games/sigilfall/render/art/mount';
import { heldWeapon, heroLook } from '../src/games/sigilfall/render/sprites';
import { hurtPlayer } from '../src/games/sigilfall/sim/combat';
import { emptyInput, MOUNT_SPEED, SUMMON_TIME, type World } from '../src/games/sigilfall/sim/world';
import type { Cast, Motion } from '../src/games/sigilfall/render3d/cast';
import { WorldCast } from '../src/games/sigilfall/render3d/worldCast';
import { rng } from '../src/games/sigilfall/core/math';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The Wardrobe and the mounts (blueprint §6.11): looks change only what is drawn and are kept for good;
 * saves can't inject what wasn't owned; a mount is called standing still, gets the hero down when they fight,
 * and is never ridden in a dungeon or into the story's fights.
 */

const DT = 1 / 60;
const run = (w: World, s: number, input = emptyInput()): void => {
  for (let t = 0; t < s; t += DT) {
    w.input = { ...input, casts: [...input.casts] };
    input.casts = [];
    w.step(DT);
  }
};
const item = (id: string) => makeItem(id, 20, rng(3))!;
const roundTrip = (c: Character, patch: Record<string, unknown> = {}, v = SAVE_VERSION): Character => migrate(JSON.parse(JSON.stringify({ v, heroes: [{ ...c, ...patch }], last: 0, settings: {}, saved: 0 })))!.heroes[0]!;

describe('Sigilfall: the Wardrobe', () => {
  it('a look id belongs to head, chest and weapon pieces only, and names what shows', () => {
    expect(lookId(item('saltbeard-tricorn'))).toBe('saltbeard-tricorn');
    expect(lookId(item('zephyr-boots'))).toBeNull();
    const robe = rollGear('mage', 10, 'rare', rng(1), 'chest');
    const id = lookId(robe)!;
    expect(id).toMatch(/^gen:[a-z-]+:rare:[0-9a-f]{6}$/);
    expect(lookOf(id)).toMatchObject({ slot: 'chest', r: 'rare', authored: false });
    expect(lookOf(id)!.name).toMatch(/^Trimmed /);
    expect(lookOf('gen:no-such-base:rare:ffffff')).toBeNull();
    expect(lookOf('gen:silk-robe:mythic:ffffff')).toBeNull();
    expect(lookOf('not-an-item')).toBeNull();
  });

  it('found gear keeps its rarity in the Wardrobe: each one looks different, and a look from an old save still works', () => {
    const names = (['common', 'uncommon', 'rare', 'epic', 'legendary'] as const).map((r) => lookOf(lookId(rollGear('mage', 10, r, rng(1), 'chest'))!));
    expect(names.map((l) => l?.r)).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
    expect(lookOf('gen:silk-robe:rare:5a4ab0')).toMatchObject({ r: 'rare' });
    expect(lookOf('gen:silk-robe:common:5a4ab0')).toMatchObject({ r: 'common' });
  });

  it('only the wardens wear a set', () => {
    expect(lookOf('warden-mage-chest')).toMatchObject({ set: 'mage', r: 'legendary' });
    expect(lookOf('warden-druid-head')).toMatchObject({ set: 'druid' });
    expect(lookOf('saltbeard-tricorn')?.set).toBeUndefined();
  });

  it('owning a piece keeps its look for good: picked up, bought, melted down', () => {
    const c = readyHero('mage', 20);
    const hat = item('saltbeard-tricorn');
    expect(addItem(c, hat)).toBe(true);
    expect(c.looks).toContain('saltbeard-tricorn');
    salvage(c, hat.uid);
    expect(c.bag.some((i) => i.uid === hat.uid)).toBe(false);
    expect(c.looks).toContain('saltbeard-tricorn');
    // learning twice adds nothing
    expect(learnLooks(c, [item('saltbeard-tricorn')])).toEqual([]);
  });

  it('a worn look changes the picture and never the build', () => {
    const c = readyHero('mage', 20, 'rare');
    learnLooks(c, [item('saltbeard-tricorn'), item('ember-staff')]);
    const before = JSON.stringify(buildHero(c));
    const plain = heroLook(c.cls, c.equip, wornLooks(c));
    expect(wearLook(c, 'head', 'saltbeard-tricorn')).toBe(true);
    expect(wearLook(c, 'weapon', 'ember-staff')).toBe(true);
    const dressed = heroLook(c.cls, c.equip, wornLooks(c));
    expect(dressed.head?.tint).toBe(ITEM_DEFS['saltbeard-tricorn']!.tint);
    expect(dressed.head).not.toEqual(plain.head);
    expect(heldWeapon(c.cls, c.equip.weapon, wornLooks(c).weapon).tint).toBe(ITEM_DEFS['ember-staff']!.tint);
    expect(JSON.stringify(buildHero(c))).toBe(before);
    // bare: the class's own head, whatever is worn there
    expect(wearLook(c, 'head', BARE_LOOK)).toBe(true);
    expect(heroLook(c.cls, c.equip, wornLooks(c)).head).toEqual(heroLook(c.cls, {}).head);
    expect(wearLook(c, 'weapon', BARE_LOOK)).toBe(false);
    // clearing shows the equipped piece again
    expect(wearLook(c, 'head', null)).toBe(true);
    expect(heroLook(c.cls, c.equip, wornLooks(c)).head).toEqual(plain.head);
    expect(JSON.stringify(buildHero(c))).toBe(before);
  });

  it('refuses looks not owned, for another slot, or for another class', () => {
    const c = readyHero('mage', 20);
    expect(wearLook(c, 'head', 'saltbeard-tricorn')).toBe(false);
    learnLooks(c, [item('saltbeard-tricorn'), item('cleaverfang')]);
    expect(wearLook(c, 'chest', 'saltbeard-tricorn')).toBe(false);
    // a warrior's axe never goes into a mage's hands (another animation family)
    expect(wearLook(c, 'weapon', 'cleaverfang')).toBe(false);
    expect(wearLook(c, 'head', 'saltbeard-tricorn')).toBe(true);
  });

  it('a save backs up only what can be proven: worn and carried pieces, owned and fitting looks', () => {
    const c = readyHero('mage', 20);
    const crown = item('twin-flame-circlet');
    c.bag.push(crown);
    // a version 7 save had no Wardrobe: what is worn and carried is owned
    const raw = JSON.parse(JSON.stringify(c));
    delete raw.looks;
    delete raw.worn;
    delete raw.mounts;
    delete raw.mount;
    const old = roundTrip(raw, {}, 7);
    expect(old.looks).toContain('twin-flame-circlet');
    for (const slot of ['head', 'chest', 'weapon'] as const) expect(old.looks).toContain(lookId(c.equip[slot]!));
    // injected: a look never owned, a warrior's, nonsense; the item under a cleared look stays
    const back = roundTrip(c, { looks: [...old.looks, 'cleaverfang', 'gen:x:y:z'], worn: { head: 'saltbeard-tricorn', weapon: 'cleaverfang', chest: 'twin-flame-circlet' } });
    expect(back.looks).not.toContain('gen:x:y:z');
    expect(back.worn.head).toBeUndefined();
    expect(back.worn.weapon).toBeUndefined();
    expect(back.worn.chest).toBeUndefined();
    expect(back.equip.head?.uid).toBe(c.equip.head!.uid);
    // a fitting, owned look survives
    const kept = roundTrip(c, { looks: [...old.looks], worn: { head: 'twin-flame-circlet' } });
    expect(kept.worn.head).toBe('twin-flame-circlet');
  });
});

describe('Sigilfall: mounts', () => {
  it('every mount has a source that exists, and one speed', () => {
    expect(new Set(MOUNTS.map((m) => m.id)).size).toBe(MOUNTS.length);
    for (const m of MOUNTS) {
      const s = m.source;
      if (s.kind === 'quest') expect(QUEST_DEFS[s.quest], `${m.id}: ${s.quest}`).toBeDefined();
      else if (s.kind === 'perk') expect(PERKS[s.perk]).toBeDefined();
      else if (s.kind === 'clears') for (const r of s.regions) expect(REGIONS[r]?.kind, `${m.id}: ${r}`).toBe('dungeon');
    }
    expect(MOUNT_SPEED).toBeGreaterThan(1);
  });

  it('every mount is painted in three views and five frames, with a seat on the animal', () => {
    for (const m of MOUNTS) {
      for (const view of ['down', 'up', 'side'] as const) {
        const F = MOUNT_FRAMES[view];
        const [sx, sy] = F.seat[m.body];
        for (let f = 0; f <= MOUNT_WALK_FRAMES; f++) {
          const { back, front } = paintMount(m, view, f);
          const solid = (p: typeof back): number => {
            let n = 0;
            for (let i = 3; i < p.d.length; i += 4) if (p.d[i]! > 0) n++;
            return n;
          };
          expect(solid(back) + solid(front), `${m.id} ${view} ${f}`).toBeGreaterThan(400);
          expect(back.w).toBe(F.w);
          // something of the animal is under the seat (the rider never floats)
          let under = false;
          for (let y = sy; y < sy + 8 && !under; y++) under = back.alpha(sx, y) > 0 || front.alpha(sx, y) > 0;
          expect(under, `${m.id} ${view} ${f}`).toBe(true);
        }
      }
      expect(RIDER_HIP).toBeGreaterThan(30);
    }
    const legs = paintRiderLegs('side', 'horse', { style: 'trousers', mat: 'cloth', tint: '#3a5a8a', r: 'common' }, { style: 'boots', mat: 'leather', tint: '#5a3a22', r: 'common' });
    expect(legs.w).toBe(MOUNT_FRAMES.side.w);
  });

  it('mounts are earned by their sources and kept; the Strider comes with the old perk', () => {
    const c = readyHero('ranger', 20);
    expect(grantMounts(c)).toEqual([]);
    c.quests['camp-riders'] = { state: 'done', n: 1 };
    expect(grantMounts(c).map((m) => m.id)).toEqual(['briarhollow-chestnut']);
    expect(c.mount).toBe('briarhollow-chestnut');
    c.clears['barrow-of-kings:0'] = 1;
    expect(mountEarned(c, MOUNT_DEFS['ashen-nightmare']!)).toBe(false);
    c.clears['barrow-of-kings:2'] = 1;
    expect(mountEarned(c, MOUNT_DEFS['ashen-nightmare']!)).toBe(true);
    // an old save with the perk gets the Strider (once riding is open); a mount id that isn't real is dropped
    const old = readyHero('ranger', 20);
    old.perks.push('mount');
    old.quests['camp-riders'] = { state: 'done', n: 1 };
    const back = roundTrip(old, { mounts: ['pegasus'], mount: 'pegasus' });
    expect(back.mounts).toEqual(['briarhollow-chestnut', 'gullport-strider']);
    expect(back.mount).toBe('briarhollow-chestnut');
  });

  it('riding opens with Riders for Briarhollow, at level 20: no mount of any source comes before it', () => {
    expect(FIRST_RIDE).toBe('camp-riders');
    expect(QUEST_DEFS[FIRST_RIDE]!.level).toBe(20);
    expect(MOUNT_DEFS['briarhollow-chestnut']!.source).toEqual({ kind: 'quest', quest: FIRST_RIDE });
    expect(new Set(MOUNTS.map((m) => m.source.kind))).toEqual(new Set(['quest', 'perk', 'clears', 'shelf', 'campaign']));
    setShelfPoints(1000);
    try {
      for (const m of MOUNTS) {
        const s = m.source;
        // a hero who has met this mount's source in every other way
        const c = readyHero(s.kind === 'campaign' ? s.cls : 'ranger', 20);
        if (s.kind === 'campaign') c.quests[CAMPAIGN_END] = { state: 'done', n: 1 };
        if (s.kind === 'quest' && s.quest !== FIRST_RIDE) c.quests[s.quest] = { state: 'done', n: 1 };
        if (s.kind === 'perk') c.perks.push(s.perk);
        if (s.kind === 'clears') for (const r of s.regions) c.clears[`${r}:${s.tier}`] = 1;
        expect(ridingOpen(c)).toBe(false);
        expect(mountEarned(c, m), m.id).toBe(false);
        expect(grantMounts(c), m.id).toEqual([]);
        expect(c.mount).toBeNull();
        c.quests[FIRST_RIDE] = { state: 'done', n: 1 };
        expect(mountEarned(c, m), m.id).toBe(true);
        expect(grantMounts(c).map((x) => x.id), m.id).toContain(m.id);
        expect(hasMount(c)).toBe(true);
      }
    } finally {
      setShelfPoints(0);
    }
  });

  it('an old save with a mount and the riders not come keeps the mount, and can neither choose it nor ride', () => {
    const c = readyHero('ranger', 14);
    c.perks.push('mount');
    const back = roundTrip(c, { mounts: ['gullport-strider', 'cabinet-courser'], mount: 'gullport-strider' });
    expect(back.mounts).toEqual(['gullport-strider', 'cabinet-courser']);
    expect(back.mount).toBe('gullport-strider');
    expect(hasMount(back)).toBe(false);
    expect(chooseMount(back, 'cabinet-courser')).toBe(false);
    expect(back.mount).toBe('gullport-strider');
    // the mount key is refused, and says why
    const w = newWorld('emberwick', back);
    w.enemies = [];
    w.player.calm = 10;
    expect(w.mountRefusal()).toBe('Riding opens with Riders for Briarhollow (level 20).');
    w.toggleMount();
    expect(w.player.summon).toBe(0);
    run(w, SUMMON_TIME + 0.1);
    expect(w.player.riding).toBeNull();
    // a call already under way stops too
    w.player.summon = 0.001;
    run(w, SUMMON_TIME + 0.1);
    expect(w.player.riding).toBeNull();
    // the riders come: the same mounts, and now they ride
    back.quests[FIRST_RIDE] = { state: 'done', n: 1 };
    expect(grantMounts(back).map((m) => m.id)).toEqual(['briarhollow-chestnut']);
    expect(chooseMount(back, 'cabinet-courser')).toBe(true);
    expect(w.mountRefusal()).toBeNull();
    w.toggleMount();
    run(w, SUMMON_TIME + 0.05);
    expect(w.player.riding).toBe('cabinet-courser');
  });

  it('nobody starts on a horse: the Trophy Shelf\u2019s mount waits for the first one the story gives', () => {
    setShelfPoints(150);
    try {
      const c = readyHero('ranger', 1);
      expect(grantMounts(c)).toEqual([]);
      expect(c.mount).toBeNull();
      // a hero who was given it before the story had any horses keeps it, but rides only when the riders come
      const early = roundTrip(c, { mounts: ['cabinet-courser'], mount: 'cabinet-courser' });
      expect(early.mounts).toEqual(['cabinet-courser']);
      expect(hasMount(early)).toBe(false);
      c.quests['camp-riders'] = { state: 'done', n: 1 };
      expect(grantMounts(c).map((m) => m.id).sort()).toEqual(['briarhollow-chestnut', 'cabinet-courser']);
      // the first ridden is the story's
      expect(c.mount).toBe('briarhollow-chestnut');
    } finally {
      setShelfPoints(0);
    }
    // not enough points: only the story's
    const d = readyHero('ranger', 20);
    d.quests['camp-riders'] = { state: 'done', n: 1 };
    expect(grantMounts(d).map((m) => m.id)).toEqual(['briarhollow-chestnut']);
  });

  it('the mount is called standing still; moving cancels the call', () => {
    const c = readyHero('mage', 20);
    c.perks.push('mount');
    c.quests['camp-riders'] = { state: 'done', n: 1 };
    grantMounts(c);
    chooseMount(c, 'gullport-strider');
    const w = newWorld('emberwick', c);
    w.enemies = [];
    w.player.calm = 10;
    w.toggleMount();
    run(w, SUMMON_TIME / 2);
    expect(w.player.summon).toBeGreaterThan(0);
    run(w, 0.1, { ...emptyInput(), mx: 1 });
    expect(w.player.summon).toBe(0);
    expect(w.player.riding).toBeNull();
    w.toggleMount();
    run(w, SUMMON_TIME + 0.05);
    expect(w.player.riding).toBe('gullport-strider');
    // the key again gets down
    w.toggleMount();
    expect(w.player.riding).toBeNull();
  });

  it('mounting up: the hero casts with no animal beside them, then is in the saddle at once, on every kind of mount', () => {
    for (const body of ['horse', 'deer', 'boar', 'drake'] as const) {
      const def = MOUNTS.find((m) => m.body === body)!;
      const c = readyHero('mage', 20);
      c.quests[FIRST_RIDE] = { state: 'done', n: 1 };
      c.mounts.push(def.id);
      c.mount = def.id;
      const w = newWorld('emberwick', c);
      w.enemies = [];
      w.player.calm = 10;
      // what the 3D cast is told to draw, frame by frame (a stand-in: only the hero and the animal are looked at)
      let drawn: { mounts: { id: string; x: number; y: number }[]; hero: { clip: string; t: number; seated: boolean }[]; fetched: string[] } = { mounts: [], hero: [], fetched: [] };
      const cast = new Proxy({} as Record<string | symbol, unknown>, {
        get: (_o, k) => {
          if (k === 'wardrobe') return { medium: { clips: { cast: { start: 1, n: 14, fps: 15 } } } };
          if (k === 'mountReady') return (m: { id: string }) => (drawn.fetched.push(m.id), true);
          if (k === 'mount') return (m: { id: string }, x: number, y: number) => (drawn.mounts.push({ id: m.id, x, y }), { x, y, high: 1, tip: 0 });
          if (k === 'person') return (_l: unknown, _h: unknown, _s: unknown, x: number, y: number, _r: number, m: Motion, o?: { hipsAt?: number }) => x === w.player.x && y === w.player.y && drawn.hero.push({ clip: m.clip, t: m.t, seated: o?.hipsAt !== undefined });
          if (k === 'creature') return () => ({});
          return () => undefined;
        },
      }) as unknown as Cast;
      const wc = new WorldCast();
      const o = { look: {} as never, weapon: {} as never, folk: 0, landOnly: false };
      let time = 0;
      const frame = (s: number): typeof drawn => {
        drawn = { mounts: [], hero: [], fetched: [] };
        run(w, s);
        time += s;
        wc.sync(cast, w, s, time, o);
        return drawn;
      };
      frame(0.1);
      w.toggleMount();
      let castT = 0;
      for (let t = 0.1; t < SUMMON_TIME - 0.05; t += 0.1) {
        const f = frame(0.1);
        expect(w.player.riding, body).toBeNull();
        // the call: the hero's cast, running on through it, and no animal anywhere
        expect(f.mounts, body).toEqual([]);
        expect(f.hero.map((h) => h.clip), body).toEqual(['cast']);
        expect(f.hero[0]!.t, body).toBeGreaterThan(castT);
        castT = f.hero[0]!.t;
        // (its model is fetched while they call)
        expect(f.fetched, body).toContain(def.id);
      }
      // the call's end: in the saddle that frame, the animal under them, and a flash
      const up = frame(0.1);
      expect(w.player.riding, body).toBe(def.id);
      expect(up.mounts, body).toEqual([{ id: def.id, x: w.player.x, y: w.player.y }]);
      expect(up.hero, body).toEqual([{ clip: 'ride', t: expect.any(Number), seated: true }]);
      expect(w.fx.some((f) => f.kind === 'burst' && f.x === w.player.x && f.y === w.player.y), body).toBe(true);
      // and off again: on their feet where they were, no animal left behind
      w.toggleMount();
      const down = frame(0.1);
      expect(down.mounts, body).toEqual([]);
      expect(down.hero.map((h) => h.seated), body).toEqual([false]);
    }
  });

  it('a hit or an attack gets the hero down; there is no riding in a fight or a dungeon', () => {
    const c = readyHero('warrior', 20);
    c.perks.push('mount');
    c.quests['camp-riders'] = { state: 'done', n: 1 };
    grantMounts(c);
    c.unlocked.push('crypt');
    const w = newWorld('emberwick', c);
    w.enemies = [];
    const mount = (): void => {
      w.player.calm = 10;
      w.toggleMount();
      run(w, SUMMON_TIME + 0.05);
    };
    mount();
    expect(w.player.riding).not.toBeNull();
    hurtPlayer(w, 5);
    expect(w.player.riding).toBeNull();
    // just hit: still in the fight
    w.toggleMount();
    expect(w.player.summon).toBe(0);
    mount();
    expect(w.player.riding).not.toBeNull();
    run(w, DT, { ...emptyInput(), casts: [{ slot: 'basic', angle: 0, dist: null, assist: 0 }] });
    expect(w.player.riding).toBeNull();
    const d = newWorld('crypt', c);
    d.player.calm = 10;
    d.toggleMount();
    run(d, SUMMON_TIME + 0.1);
    expect(d.player.riding).toBeNull();
  });

  it('the story’s fights put the hero on foot', () => {
    const c = readyHero('mage', 30);
    const done = (id: string): void => {
      if (c.quests[id]) return;
      c.quests[id] = { state: 'done', n: 1 };
      for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
    };
    for (const a of QUEST_DEFS['hearth-the-riders-come']!.after ?? []) done(a);
    c.quests['hearth-the-riders-come'] = { state: 'active', n: 0 };
    c.perks.push('mount');
    grantMounts(c);
    for (const r of Object.keys(REGIONS) as (keyof typeof REGIONS)[]) if (!c.unlocked.includes(r)) c.unlocked.push(r);
    const w = newWorld('amberfield', c);
    // riding in on the siege night (the Host's packs about make calling the mount there a fight)
    w.player.riding = 'gullport-strider';
    const at = w.places['hearth-square']!;
    w.player.x = at.x;
    w.player.y = at.y + 8;
    run(w, 0.3);
    expect(w.story.run?.def.id).toBe('hearth-riders');
    expect(w.player.riding).toBeNull();
  });
});
