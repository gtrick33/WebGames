/**
 * How a blow feels (POLISH_PLAN.md piece 5): what it meets is heard under it, the foe is knocked back along it as far
 * as it was hard, a big or finishing blow's number rises bigger, a blow turned aside by armor is told in a cooler
 * color, and the hero struck sees red at the screen's edge and feels the camera shoved.
 */
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { deathSound, hitSound } from '../src/games/sigilfall/data/voices';
import { SAMPLES } from '../src/games/sigilfall/audio/samples';
import { hitEnemy, hurtPlayer, RESISTED } from '../src/games/sigilfall/sim/combat';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/** A clear field, no crits by chance (a crit is its own case), the hero struck as soon as struck. */
function arena(): World {
  const w = newWorld('whisperwood', readyHero('warrior', 12));
  w.enemies = [];
  w.rand = () => 0.999;
  w.player.iframe = 0;
  return w;
}
const foe = (w: World, id: string, dx = 30) => w.addEnemy(id, w.player.x + dx, w.player.y, w.hero.level, { room: -1, pack: -1 });
const sounds = (w: World): string[] => w.events.flatMap((e) => (e.t === 'sfx' ? [e.id] : []));

describe('Sigilfall: a blow is heard as what it meets', () => {
  it('every kind of foe has a struck sound, and every one is a recording the game has', () => {
    for (const def of Object.values(ENEMIES)) {
      const id = hitSound(def);
      expect(SAMPLES[id], `${def.id}: ${id}`).toBeDefined();
    }
    expect(hitSound({ id: 'skeleton', sprite: 'skeleton' })).toBe('hitBone');
    expect(hitSound({ id: 'moss-slime', sprite: 'slime' })).toBe('hitSlime');
    // (a creature no kind fits is struck as flesh, as it falls as a person)
    expect(deathSound({ id: 'a-person', sprite: 'person' })).toBe('die');
    expect(hitSound({ id: 'a-person', sprite: 'person' })).toBe('hitFlesh');
  });

  it('the direct blow is laid over what it meets; what a blow splits into is not', () => {
    const w = arena();
    const e = foe(w, 'skeleton');
    w.events.length = 0;
    hitEnemy(w, e, 5, 'physical', { depth: 0, fromX: w.player.x, fromY: w.player.y });
    expect(sounds(w)).toContain('hitBone');
    w.events.length = 0;
    hitEnemy(w, e, 5, 'physical', { depth: 1, fromX: w.player.x, fromY: w.player.y });
    expect(sounds(w)).not.toContain('hitBone');
  });
});

describe('Sigilfall: a blow is seen as hard as it was', () => {
  it('knocks the foe back along it, further the harder it was', () => {
    const w = arena();
    const a = foe(w, 'skeleton', 30);
    const b = foe(w, 'skeleton', -30);
    hitEnemy(w, a, 2, 'physical', { depth: 0, fromX: w.player.x, fromY: w.player.y });
    hitEnemy(w, b, b.maxHp * 0.25, 'physical', { depth: 0, fromX: w.player.x, fromY: w.player.y });
    expect(a.hitT).toBe(w.time);
    // struck from the hero's side: one to the east goes east, one to the west goes west
    expect(Math.cos(a.hitA!)).toBeGreaterThan(0.9);
    expect(Math.cos(b.hitA!)).toBeLessThan(-0.9);
    expect(b.hitK!).toBeGreaterThan(a.hitK!);
    expect(b.hitK!).toBeLessThanOrEqual(1);
  });

  it('a big blow’s number rises bigger, and one that finishes the foe bigger still', () => {
    const w = arena();
    const e = foe(w, 'skeleton');
    hitEnemy(w, e, 1, 'physical', { depth: 0, fromX: w.player.x, fromY: w.player.y });
    const small = w.texts.find((t) => t.src === e.id)!;
    expect(small.scale ?? 1).toBeLessThan(1.05);
    const f = foe(w, 'skeleton', 40);
    hitEnemy(w, f, f.maxHp * 5, 'physical', { depth: 0, fromX: w.player.x, fromY: w.player.y });
    const big = w.texts.find((t) => t.src === f.id)!;
    expect(big.scale).toBeGreaterThan(1.4);
    expect(big.scale).toBeLessThanOrEqual(1.6);
  });

  it('a blow armor turned much of aside is told in a cooler color', () => {
    const armored = Object.values(ENEMIES).find((d) => (d.armor ?? 0) >= 0.25 && !d.prop)!;
    const w = arena();
    const e = foe(w, armored.id);
    hitEnemy(w, e, 3, 'physical', { depth: 0, fromX: w.player.x, fromY: w.player.y });
    expect(w.texts.find((t) => t.src === e.id)!.color).toBe(RESISTED);
    // fire goes round armor: a clean hit
    const g = foe(w, armored.id, 50);
    hitEnemy(w, g, 3, 'fire', { depth: 0, fromX: w.player.x, fromY: w.player.y });
    if (!(armored.resist?.fire ?? 0)) expect(w.texts.find((t) => t.src === g.id)!.color).toBe('#ffffff');
  });

  it('a finishing blow pushes the camera along it; nothing pushes it with the screen’s shake off', () => {
    const w = arena();
    const e = foe(w, 'skeleton', 30);
    hitEnemy(w, e, e.maxHp * 3, 'physical', { depth: 0, fromX: w.player.x, fromY: w.player.y });
    const k = w.takeKick();
    expect(k.x).toBeGreaterThan(0);
    expect(w.takeKick()).toEqual({ x: 0, y: 0 });
    w.settings.shake = false;
    const f = foe(w, 'skeleton', 30);
    hitEnemy(w, f, f.maxHp * 3, 'physical', { depth: 0, fromX: w.player.x, fromY: w.player.y });
    expect(w.takeKick()).toEqual({ x: 0, y: 0 });
  });
});

describe('Sigilfall: the hero struck', () => {
  it('sees red at the screen’s edge, deeper for a harder blow, fading, and the camera is shoved away from the blow', () => {
    const w = arena();
    const p = w.player;
    hurtPlayer(w, p.maxHp * 0.05, { fromX: p.x + 20, fromY: p.y });
    const light = w.hurtPulse;
    expect(light).toBeGreaterThan(0.3);
    expect(w.takeKick().x).toBeLessThan(0);
    w.hurtPulse = 0;
    p.iframe = 0;
    hurtPlayer(w, p.maxHp * 0.2, { fromX: p.x + 20, fromY: p.y });
    expect(w.hurtPulse).toBeGreaterThan(light);
    for (let i = 0; i < 60; i++) w.step(1 / 60);
    expect(w.hurtPulse).toBe(0);
  });
});
