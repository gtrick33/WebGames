import { afterEach, describe, expect, it } from 'vitest';
import { breaksRules, isBuiltIn, MAX_CENTS, MIN_CENTS, PRODUCTS, productIn, sanitizeProducts, type Product } from '../src/catalog/shop';
import { MOUNT_EXTRAS, sanitizeSigil, SIGIL_BODIES, SIGIL_SETS, type SigilMountSpec } from '../src/catalog/sigilItems';
import type { ClassId } from '../src/games/sigilfall/data/types';
import type { Character } from '../src/games/sigilfall/progress/character';
import { migrate, SAVE_VERSION } from '../src/games/sigilfall/progress/save';
import { goodsFrom, ownedShopLooks, ownedShopMounts, setShopGoods, shopMountOf } from '../src/games/sigilfall/progress/shopGoods';
import { canRide, chooseMount, grantMounts, hasLook, mountDef, riddenMount, wearLook, wornId, wornLooks } from '../src/games/sigilfall/progress/wardrobe';
import { paintMount } from '../src/games/sigilfall/render/art/mount';
import { heroLook } from '../src/games/sigilfall/render/sprites';
import { dressedMesh, type Wardrobe } from '../src/games/sigilfall/render3d/dress';
import { mountModel } from '../src/games/sigilfall/render3d/mountKit';
import { shapeOf } from '../src/games/sigilfall/render3d/mountLook';
import type { Pack } from '../src/games/sigilfall/render3d/pack';
import { addRideClip, CAPE_JOINTS } from '../src/games/sigilfall/render3d/ride';
import { rigAnimOf } from '../src/games/sigilfall/render3d/toon';
import { MOUNT_SPEED } from '../src/games/sigilfall/sim/world';
import { readyHero } from './sigilfall-bot';
import { readPack } from './sigilfall-packs';

/**
 * Sigilfall's items from the site's shop: mounts and Wardrobe looks, made from the shop's list and owned while the
 * account's purchase stands. Never in the save, so a refund takes them away and a save can't bring one in.
 */

const SIGIL = PRODUCTS.filter((p) => p.sigil);
const MOUNTS = SIGIL.filter((p) => p.sigil!.kind === 'mount');
const LOOKS = SIGIL.filter((p) => p.sigil!.kind === 'look');
const WYRM = 'sigilfall-crownforged-wyrm';
const HELM = 'sigilfall-crownforged-helm';
const PLATE = 'sigilfall-crownforged-plate';

const roundTrip = (c: Character, patch: Record<string, unknown> = {}): Character => migrate(JSON.parse(JSON.stringify({ v: SAVE_VERSION, heroes: [{ ...c, ...patch }], last: 0, settings: {}, saved: 0 })))!.heroes[0]!;
/** A hero the story has given horses to (Act I), with the first one. */
const rider = (cls: ClassId = 'ranger'): Character => {
  const c = readyHero(cls, 20);
  c.quests['camp-riders'] = { state: 'done', n: 1 };
  grantMounts(c);
  return c;
};
const owning = (...ids: string[]): void => setShopGoods(PRODUCTS, ids);

afterEach(() => setShopGoods([], []));

describe('Sigilfall in the shop: the items', () => {
  it('five mounts and three sets of a helmet and armor, each following the shop’s rules and saying it’s only a look', () => {
    expect(MOUNTS).toHaveLength(5);
    expect(LOOKS).toHaveLength(6);
    for (const set of SIGIL_SETS) for (const slot of ['head', 'chest']) expect(LOOKS.filter((p) => p.sigil?.kind === 'look' && p.sigil.set === set.id && p.sigil.slot === slot), `${set.id} ${slot}`).toHaveLength(1);
    for (const p of SIGIL) {
      expect(p.later, p.id).toBeUndefined();
      expect(isBuiltIn(p.id), p.id).toBe(true);
      expect(p.id, p.id).toMatch(/^sigilfall-[a-z0-9-]{1,30}$/);
      expect(p.name.length, p.id).toBeLessThanOrEqual(40);
      expect(p.blurb.length, p.id).toBeLessThanOrEqual(240);
      expect(breaksRules(`${p.name} ${p.blurb}`), p.id).toBe(false);
      expect(p.blurb, p.id).toMatch(/Only a look/);
      expect(p.cents, p.id).toBeGreaterThanOrEqual(MIN_CENTS);
      expect(p.cents, p.id).toBeLessThanOrEqual(MAX_CENTS);
      // the built-in list is already as clean as a saved one
      expect(sanitizeSigil(p.sigil), p.id).toEqual(p.sigil);
    }
    // the drake costs the most; never a horse
    expect(productIn(PRODUCTS, WYRM)).toMatchObject({ cents: 599, sigil: { kind: 'mount', body: 'drake' } });
    expect(Math.max(...MOUNTS.map((p) => p.cents))).toBe(599);
    for (const p of MOUNTS) expect(['drake', 'deer', 'boar'], p.id).toContain((p.sigil as SigilMountSpec).body);
  });

  it('keeps the built-in items as the code draws them, whatever a saved list says, and drops the old placeholders', () => {
    const saved = sanitizeProducts([
      { id: WYRM, name: 'Wyrm', blurb: 'Cheaper now. Only a look.', cents: 499, sigil: { kind: 'mount', body: 'drake', coat: '#ffffff', mane: '#ffffff', tack: '#ffffff', extras: [] } },
      { id: 'sigilfall-mounts', name: 'Mounts', blurb: 'Planned.', cents: 299, later: true },
      { id: 'sigilfall-looks', name: 'Looks', blurb: 'Planned.', cents: 199, later: true },
    ]);
    expect(productIn(saved, WYRM)).toEqual({ ...productIn(PRODUCTS, WYRM)!, name: 'Wyrm', blurb: 'Cheaper now. Only a look.', cents: 499 });
    expect(productIn(saved, 'sigilfall-mounts')).toBeUndefined();
    expect(productIn(saved, 'sigilfall-looks')).toBeUndefined();
    for (const p of SIGIL) expect(productIn(saved, p.id), p.id).toBeDefined();
  });
});

describe('Sigilfall in the shop: what an admin makes', () => {
  const mount = { kind: 'mount', body: 'drake', coat: '#112233', mane: '#AABBCC', tack: '#000000', plate: '#808080', extras: ['crown', 'veins', 'antlers', 'crown'], glow: { kind: 'sparks', color: '#00ffee' } };

  it('a mount: one of the three bodies the shop may sell, its colors, its body’s own extras and a glow', () => {
    expect(sanitizeSigil(mount)).toEqual({ kind: 'mount', body: 'drake', coat: '#112233', mane: '#aabbcc', tack: '#000000', plate: '#808080', extras: ['crown', 'veins'], glow: { kind: 'sparks', color: '#00ffee' } });
    // never a horse, nor anything it can't draw
    expect(sanitizeSigil({ ...mount, body: 'horse' })).toBeNull();
    expect(sanitizeSigil({ ...mount, coat: 'red' })).toBeNull();
    expect(sanitizeSigil({ ...mount, kind: 'pet' })).toBeNull();
    expect(sanitizeSigil(null)).toBeNull();
    // a hart has one pair of antlers; a glow it doesn't know is no glow; a missing plate color gets one
    expect(sanitizeSigil({ ...mount, body: 'deer', extras: ['flame-antlers', 'crystal-antlers', 'plates', 'veins'], glow: { kind: 'lasers', color: '#ffffff' }, plate: 'x' })).toEqual({
      kind: 'mount',
      body: 'deer',
      coat: '#112233',
      mane: '#aabbcc',
      tack: '#000000',
      plate: '#6e7280',
      extras: ['flame-antlers', 'plates'],
    });
  });

  it('a look: one of the shop’s sets, a helmet or armor, in its own colors or four new ones', () => {
    expect(sanitizeSigil({ kind: 'look', slot: 'chest', set: 'celestine', colors: ['#111111', '#222222', '#333333', '#444444'] })).toEqual({ kind: 'look', slot: 'chest', set: 'celestine', colors: ['#111111', '#222222', '#333333', '#444444'] });
    expect(sanitizeSigil({ kind: 'look', slot: 'head', set: 'gloamquill', colors: ['#111111', 'nope'] })).toEqual({ kind: 'look', slot: 'head', set: 'gloamquill' });
    expect(sanitizeSigil({ kind: 'look', slot: 'legs', set: 'gloamquill' })).toBeNull();
    expect(sanitizeSigil({ kind: 'look', slot: 'head', set: 'warrior' })).toBeNull();
  });

  it('comes through a saved list working, and the game makes it at once', () => {
    const items = sanitizeProducts([
      { id: 'sigilfall-ember-drake', name: 'Ember Drake', blurb: 'A drake of embers. Only a look.', cents: 349, sigil: mount },
      { id: 'sigilfall-gold-cowl', name: 'Gold Cowl', blurb: 'A gold cowl. Only a look.', cents: 199, sigil: { kind: 'look', slot: 'head', set: 'gloamquill', colors: ['#aa8800', '#ffd700', '#553300', '#ffffff'] } },
      { id: 'sigilfall-both', name: 'Both', blurb: 'A border, not a mount.', cents: 99, look: { kind: 'border', style: 'glitch' }, sigil: mount },
    ]);
    expect(productIn(items, 'sigilfall-ember-drake')!.sigil).toMatchObject({ kind: 'mount', body: 'drake', extras: ['crown', 'veins'] });
    expect(productIn(items, 'sigilfall-both')!.sigil).toBeUndefined();
    setShopGoods(items, ['sigilfall-ember-drake', 'sigilfall-gold-cowl']);
    expect(ownedShopMounts().map((m) => m.id)).toEqual(['sigilfall-ember-drake']);
    expect(ownedShopLooks()[0]).toMatchObject({ id: 'sigilfall-gold-cowl', slot: 'head', set: 'gloamquill', colors: ['#aa8800', '#ffd700', '#553300', '#ffffff'], shop: true });
    const c = rider();
    expect(chooseMount(c, 'sigilfall-ember-drake')).toBe(true);
    expect(wearLook(c, 'head', 'sigilfall-gold-cowl')).toBe(true);
  });
});

describe('Sigilfall in the shop: owned while the purchase stands', () => {
  it('a mount is there only while the account owns it, and the hero’s own choice is still there after a refund', () => {
    const c = rider();
    const own = c.mount!;
    expect(own).toBe('briarhollow-chestnut');
    owning();
    expect(canRide(c, WYRM)).toBe(false);
    expect(chooseMount(c, WYRM)).toBe(false);
    owning(WYRM);
    expect(canRide(c, WYRM)).toBe(true);
    expect(chooseMount(c, WYRM)).toBe(true);
    expect(riddenMount(c)).toBe(WYRM);
    expect(mountDef(WYRM)).toMatchObject({ body: 'drake', tier: 'shop', source: { kind: 'shop', item: WYRM } });
    // never among the hero's own
    expect(c.mounts).not.toContain(WYRM);
    expect(grantMounts(c)).toEqual([]);
    // refunded: gone, and the hero rides their own again
    owning();
    expect(canRide(c, WYRM)).toBe(false);
    expect(riddenMount(c)).toBe(own);
    // bought again: the choice comes back with it
    owning(WYRM);
    expect(riddenMount(c)).toBe(WYRM);
    // choosing one of the hero's own puts the shop's away
    expect(chooseMount(c, own)).toBe(true);
    expect(riddenMount(c)).toBe(own);
  });

  it('a shop mount waits, like every mount, for the story to have horses in it', () => {
    owning(WYRM);
    const c = readyHero('mage', 1);
    expect(canRide(c, WYRM)).toBe(false);
    expect(chooseMount(c, WYRM)).toBe(false);
    c.quests['camp-riders'] = { state: 'done', n: 1 };
    expect(chooseMount(c, WYRM)).toBe(true);
  });

  it('a look is worn by any class while it’s owned, and comes off with a refund, leaving the hero’s own look', () => {
    for (const cls of ['warrior', 'mage', 'priest'] as const) {
      const c = rider(cls);
      owning();
      expect(hasLook(c, HELM)).toBe(false);
      expect(wearLook(c, 'head', HELM)).toBe(false);
      owning(HELM, PLATE);
      expect(wearLook(c, 'head', HELM)).toBe(true);
      expect(wearLook(c, 'chest', PLATE)).toBe(true);
      // a helmet isn't armor
      expect(wearLook(c, 'chest', HELM)).toBe(false);
      const worn = wornLooks(c);
      expect(worn.head).toMatchObject({ id: HELM, set: 'crownforged', shop: true });
      expect(worn.chest).toMatchObject({ id: PLATE, set: 'crownforged' });
      // it shows on the hero: the set's own models
      const look = heroLook(cls, c.equip, worn);
      expect(look.head?.set).toBe('crownforged');
      expect(look.chest.set).toBe('crownforged');
      expect(c.looks).not.toContain(HELM);
      // refunded
      wearLook(c, 'head', 'bare');
      wearLook(c, 'head', HELM);
      owning(PLATE);
      expect(wornLooks(c).head).toBe('bare');
      expect(wornId(c, 'head')).toBe('bare');
      expect(wornLooks(c).chest).toMatchObject({ id: PLATE });
      owning();
      expect(wornLooks(c).chest).toBeUndefined();
    }
  });

  it('a save can choose a shop item but never bring one in: what shows is what the account owns', () => {
    owning(WYRM, HELM);
    const c = rider();
    chooseMount(c, WYRM);
    wearLook(c, 'head', HELM);
    // the choice is kept, and nothing else
    const back = roundTrip(c);
    expect(back.shopMount).toBe(WYRM);
    expect(back.shopWorn).toEqual({ head: HELM });
    expect(riddenMount(back)).toBe(WYRM);
    // on a device (or account) that doesn't own them, they don't show
    owning();
    expect(riddenMount(back)).toBe('briarhollow-chestnut');
    expect(wornLooks(back).head).toBeUndefined();
    // a save that writes them in among the hero's own gets nowhere either
    const smuggled = roundTrip(rider(), { mounts: ['briarhollow-chestnut', WYRM], mount: WYRM, looks: [HELM, PLATE], worn: { head: HELM, chest: PLATE }, shopWorn: { head: HELM, chest: 'Not An Id!', legs: PLATE }, shopMount: WYRM });
    expect(smuggled.mounts).toEqual(['briarhollow-chestnut']);
    expect(smuggled.mount).toBe('briarhollow-chestnut');
    expect(smuggled.looks).not.toContain(HELM);
    expect(smuggled.worn).toEqual({});
    expect(smuggled.shopWorn).toEqual({ head: HELM });
    expect(riddenMount(smuggled)).toBe('briarhollow-chestnut');
    expect(wornLooks(smuggled)).toEqual({});
    expect(canRide(smuggled, WYRM)).toBe(false);
  });

  it('a guest owns nothing, and an item no longer sold stays with whoever owns it (the admin list keeps it, hidden)', () => {
    const goods = goodsFrom(PRODUCTS, []);
    expect(goods.owned.size).toBe(0);
    const hidden: Product = { ...productIn(PRODUCTS, WYRM)!, hidden: true };
    setShopGoods([hidden], [WYRM]);
    expect(canRide(rider(), WYRM)).toBe(true);
  });
});

describe('Sigilfall in the shop: how they look', () => {
  const packs = new Map<string, Pack>();
  const packOf = (kit: string): Pack => {
    let p = packs.get(kit);
    if (!p) packs.set(kit, (p = readPack(`k/${kit}`)));
    return p;
  };
  const sound = (def: ReturnType<typeof shopMountOf>): void => {
    const { mesh, rig } = mountModel(def, packOf(shapeOf(def).kit));
    expect(mesh.n, def.id).toBeLessThan(65536);
    expect(mesh.idx.length % 3, def.id).toBe(0);
    let off = 0;
    for (let v = 0; v < mesh.n * 3; v += 3) if (mesh.skin![v]! >= rig.joints.length || mesh.skin![v + 1]! >= rig.joints.length) off++;
    expect(off, def.id).toBe(0);
    expect(mesh.pos.every(Number.isFinite), def.id).toBe(true);
    for (const r of [rig.has('idle'), rig.has('walk'), rig.has('run')]) expect(r, def.id).toBe(true);
  };

  it('every shop mount builds whole, more than a recolor of its body, and is painted for the plain renderer too', () => {
    for (const p of MOUNTS) {
      const spec = p.sigil as SigilMountSpec;
      const def = shopMountOf(p.id, p.name, p.blurb, spec);
      sound(def);
      // what's built onto it is real geometry: more than the same body with none of it
      const plain = mountModel({ ...def, id: `${def.id}-plain`, extras: [], barding: undefined }, packOf(shapeOf(def).kit)).mesh.n;
      expect(mountModel(def, packOf(shapeOf(def).kit)).mesh.n, p.id).toBeGreaterThan(plain + 200);
      const { back, front } = paintMount(def, 'side', 0);
      expect(back.w + front.w, p.id).toBeGreaterThan(0);
    }
  });

  it('every body an admin can pick builds with every extra and glow it allows', () => {
    for (const { id: body } of SIGIL_BODIES) {
      const plain = MOUNT_EXTRAS[body].filter((x) => !x.group).map((x) => x.id);
      // (each of a group in turn: a hart's elk, flame and crystal antlers)
      const choices = [null, ...MOUNT_EXTRAS[body].filter((x) => x.group).map((x) => x.id)];
      for (const choice of choices) {
        const spec = sanitizeSigil({ kind: 'mount', body, coat: '#445566', mane: '#ddeeff', tack: '#221100', plate: '#888888', extras: choice ? [choice, ...plain] : plain, glow: { kind: 'motes', color: '#ffffff' } }) as SigilMountSpec;
        expect(spec.extras).toHaveLength(plain.length + (choice ? 1 : 0));
        sound(shopMountOf(`sigilfall-test-${body}-${choice ?? 'x'}`, 'Test', 'Test', spec));
      }
    }
  });

  it('every mount, the shop’s too, runs at the one pace: the mount never changes the speed', () => {
    expect(MOUNT_SPEED).toBeGreaterThan(1);
    for (const p of MOUNTS) expect(Object.keys(shopMountOf(p.id, p.name, p.blurb, p.sigil as SigilMountSpec)).some((k) => /speed|pace|stat/i.test(k)), p.id).toBe(false);
  });

  it('each set dresses every class whole, in its own colors or an admin’s, and differs from the rest', () => {
    const hero = readPack('hero');
    const rigs = readPack('rigs');
    addRideClip(rigs.rigs.medium!);
    const w: Wardrobe = { hero, rigs, medium: rigAnimOf(rigs, 'medium', CAPE_JOINTS), large: rigAnimOf(rigs, 'large') };
    const print = (items: Product[], cls: ClassId): string => {
      setShopGoods(items, items.map((p) => p.id));
      const worn = Object.fromEntries(ownedShopLooks().map((l) => [l.slot, l]));
      const m = dressedMesh(w, heroLook(cls, {}, worn), null);
      expect(m.n).toBeLessThan(65536);
      expect(m.pos.every(Number.isFinite)).toBe(true);
      let off = 0;
      for (let v = 0; v < m.n * 3; v += 3) if (m.skin![v]! >= w.medium.joints.length) off++;
      expect(off).toBe(0);
      let h = 0;
      for (let i = 0; i < m.n * 3; i += 7) h = (Math.imul(h, 31) + m.col[i]! + Math.round(m.pos[i]! * 100)) | 0;
      return `${m.n}:${h}`;
    };
    const CLASSES = ['warrior', 'mage', 'ranger', 'priest', 'paladin', 'warlock', 'druid'] as const;
    const bySet = new Map<string, string[]>();
    for (const set of SIGIL_SETS) {
      const pieces = LOOKS.filter((p) => p.sigil?.kind === 'look' && p.sigil.set === set.id);
      bySet.set(set.id, CLASSES.map((cls) => print(pieces, cls)));
      // an admin's colors make a different figure
      const recolored = pieces.map((p) => ({ ...p, id: `${p.id}-x`, sigil: { ...p.sigil!, colors: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'] } }) as Product);
      expect(print(recolored, 'warrior')).not.toBe(print(pieces, 'warrior'));
    }
    // on any class, no two sets look alike
    CLASSES.forEach((_, i) => expect(new Set(SIGIL_SETS.map((set) => bySet.get(set.id)![i])).size).toBe(SIGIL_SETS.length));
  });
});
