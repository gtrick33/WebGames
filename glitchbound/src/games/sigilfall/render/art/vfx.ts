import type { DmgType } from '../../data/types';
import { circleArt, fxArt, stripOf, type FxArt } from './atlas';
import { DETAIL } from '../pixel';

/**
 * Spell effects from Magic Spells VFX (64 px frames) and Magic Circles (96 px frames), picked by the
 * damage type's element, so a fire skill always reads orange and a holy one gold (VISUAL_BIBLE §5).
 * The simulation names an effect on an Fx (`sprite: 'impact:fire'`, `'cast:holy'`...); this resolves
 * it to a sheet and draws the frame of the moment. Without the art, nothing is drawn here and the
 * renderer's own pixel effects stand in.
 */

export type Element = 'fire' | 'ice' | 'lightning' | 'arcane' | 'nature' | 'poison' | 'holy' | 'shadow' | 'water' | 'blood';

const ELEMENT: Record<DmgType, Element | null> = {
  physical: null,
  fire: 'fire',
  frost: 'ice',
  lightning: 'lightning',
  arcane: 'arcane',
  poison: 'poison',
  shadow: 'shadow',
  holy: 'holy',
  nature: 'nature',
};

export const elementOf = (t: string): Element | null => ELEMENT[t as DmgType] ?? null;

/** The sheet for an effect in an element, else the effect's original colors, else null. */
function sheet(art: FxArt, effect: string, el: Element | null): FxArt['fx'][string] | null {
  if (el) {
    const hit = art.fx[`elements/${el}/${effect}_${el}`];
    if (hit) return hit;
  }
  return art.fx[effect] ?? null;
}

/**
 * What an Fx's `sprite` asks for, as [effect, element, scale]: `impact:fire` is the impact in fire,
 * `blast:frost` the big burst, `cast:holy` the glow at the caster's feet, `buff:nature` a buff rising.
 */
const KINDS: Record<string, { effect: string; scale: number; core?: string }> = {
  impact: { effect: 'impact', scale: 0.75 },
  blast: { effect: 'fire_impact', scale: 1.5, core: 'fire_impact' },
  cast: { effect: 'cast', scale: 1 },
  buff: { effect: 'buff', scale: 1 },
  heal: { effect: 'buff', scale: 1, core: 'heal' },
  shield: { effect: 'shield_up', scale: 1 },
  summon: { effect: 'summon', scale: 1.25 },
  teleport: { effect: 'teleport', scale: 1 },
  charge: { effect: 'charge', scale: 1.25 },
  debuff: { effect: 'debuff', scale: 0.75 },
  shatter: { effect: 'ice_shatter', scale: 1 },
  thunder: { effect: 'thunder', scale: 1.25 },
};

/** How long an effect named by an Fx sprite plays, in seconds (null: not a sheet effect, or no art yet). */
export function vfxLength(sprite: string): number | null {
  const art = fxArt();
  if (!art) return null;
  const [kind, type] = sprite.split(':');
  const k = KINDS[kind ?? ''];
  if (!k) return null;
  const s = (k.core && !elementOf(type ?? '') ? art.fx[k.core] : null) ?? sheet(art, k.effect, elementOf(type ?? ''));
  return s ? (s.n * s.ms) / 1000 : null;
}

/**
 * Draws an Fx's sheet effect centered at (x, y) in world pixels, `t` seconds in; `size` (world px)
 * scales blasts to their radius. Returns false when it isn't a sheet effect or the art isn't loaded.
 */
export function drawVfx(g: CanvasRenderingContext2D, sprite: string, x: number, y: number, t: number, size = 0): boolean {
  const art = fxArt();
  if (!art) return false;
  const [kind, type] = sprite.split(':');
  const k = KINDS[kind ?? ''];
  if (!k) return false;
  const el = elementOf(type ?? '');
  const s = (k.core && !el ? art.fx[k.core] : null) ?? sheet(art, k.effect, el);
  if (!s) return false;
  const frame = Math.floor((t * 1000) / s.ms);
  if (frame >= s.n) return true;
  const F = art.frame;
  // whole multiples of the 64 px frame keep the pixels square; blasts grow with their radius
  const scale = kind === 'blast' && size > 0 ? Math.max(1, Math.round((size * 2 * DETAIL) / F)) : k.scale >= 1.25 ? 2 : 1;
  const half = k.scale < 1 && kind !== 'blast' ? 0.5 : 1;
  const wpx = (F * scale * half) / DETAIL;
  // casts and buffs stand on the ground: their frame's bottom is at the feet
  const grounded = kind === 'cast' || kind === 'buff' || kind === 'heal' || kind === 'shield' || kind === 'summon' || kind === 'charge' || kind === 'thunder';
  const dy = grounded ? y - wpx * 0.85 : y - wpx / 2;
  // what plays on the caster is see-through, so the hero stays readable inside their own spell
  if (grounded) g.globalAlpha = 0.6;
  g.drawImage(stripOf(art, s), frame * F, 0, F, F, Math.round((x - wpx / 2) * DETAIL) / DETAIL, Math.round(dy * DETAIL) / DETAIL, wpx, wpx);
  g.globalAlpha = 1;
  return true;
}

/** Looks with an arcane star's colors whatever their damage type. */
const STARRY = new Set(['starfire', 'starsurge', 'wrath']);

/**
 * A friendly spell bolt (any elemental projectile the renderer has no special picture for) as a bolt
 * of its element, its head on (x, y), turned along its flight. Returns false for physical shots and
 * while the art isn't loaded.
 */
export function drawBolt(g: CanvasRenderingContext2D, look: string, type: string, x: number, y: number, angle: number, age: number, r: number): boolean {
  if (!elementOf(type) && !STARRY.has(look)) return false;
  const art = fxArt();
  if (!art) return false;
  const el = look === 'chaosbolt' ? 'fire' : STARRY.has(look) ? 'arcane' : elementOf(type);
  const s = sheet(art, 'bolt', el);
  if (!s) return false;
  const F = art.frame;
  const frame = Math.floor((age * 1000) / s.ms) % s.n;
  // big bolts (a fireball, a comet) at the full frame, ordinary ones at half
  const wpx = (F * (r >= 4 ? 1 : 0.5)) / DETAIL;
  g.save();
  g.translate(Math.round(x * DETAIL) / DETAIL, Math.round(y * DETAIL) / DETAIL);
  g.rotate(angle);
  // the sheet's head sits right of center: put it on the projectile
  g.drawImage(stripOf(art, s), frame * F, 0, F, F, -wpx * 0.75, -wpx / 2, wpx, wpx);
  g.restore();
  return true;
}

/** A rune circle on the ground (boss wind-ups, the ultimate): fire, ice or arcane; `t` seconds into it. */
export function drawCircle(g: CanvasRenderingContext2D, el: 'fire' | 'ice' | 'arcane', x: number, y: number, radius: number, t: number, alpha = 1): boolean {
  const art = circleArt();
  if (!art) return false;
  const s = art.fx[`${el}_ground_loop`];
  if (!s) return false;
  const F = art.frame;
  const frame = Math.floor((t * 1000) / s.ms) % s.n;
  const w = radius * 2;
  const h = w * 0.6;
  g.globalAlpha = alpha;
  g.drawImage(stripOf(art, s), frame * F, 0, F, F, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  g.globalAlpha = 1;
  return true;
}

/** The rune circle that suits a damage type. */
export const circleOf = (t: string): 'fire' | 'ice' | 'arcane' => (t === 'fire' ? 'fire' : t === 'frost' ? 'ice' : 'arcane');
