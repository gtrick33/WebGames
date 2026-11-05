/**
 * Profile looks: a border around a member's picture, a banner behind their name and an icon in place of their picture,
 * on their profile, in the header, on the boards and in friends lists. Each is a shop item (src/catalog/shop.ts) that
 * carries a `look`: one of the styles below, drawn by src/components/Looks.css and LookIcons.tsx, in its own colors or
 * in colors an admin picked. So Admin › Ads & shop can make a new look without a code change. They only change how a
 * member looks, never what they can do.
 */
export type LookKind = 'border' | 'banner' | 'icon';

export const LOOK_KINDS: readonly LookKind[] = ['border', 'banner', 'icon'];

/** How a look is drawn: a style this site knows, and up to four colors (#rrggbb) that replace the style's own. */
export interface LookSpec {
  kind: LookKind;
  style: string;
  colors?: string[];
}

export interface LookStyle {
  id: string;
  /** For the admin's style picker. */
  label: string;
  /** The style's own colors, in the order it uses them (what an admin's new look starts from). */
  colors: string[];
}

/** Every style the site can draw. A style's CSS class is `look-<kind>-<id>`. */
export const STYLES: Record<LookKind, readonly LookStyle[]> = {
  border: [
    { id: 'neon-halo', label: 'Halo: a turning ring with a glow and a spark', colors: ['#22e4ff', '#8b5cff', '#ff3fd2', '#ffd12e'] },
    { id: 'solar-flare', label: 'Flare: a molten ring with a corona of rays', colors: ['#ff3b1f', '#ff6a1a', '#ffc928', '#fff1a8'] },
    { id: 'glitch', label: 'Glitch: a split ring that jumps out of line', colors: ['#f6f1ff', '#22e4ff', '#ff3fd2'] },
    { id: 'frost', label: 'Frost: an ice ring with crystal shards and sparkles', colors: ['#e8fbff', '#7fd6ff', '#3d7bff', '#ffffff'] },
    { id: 'orbit', label: 'Orbit: a fine double ring with two moons going round', colors: ['#8b5cff', '#22e4ff', '#ffd12e', '#ff3fd2'] },
    { id: 'crown', label: 'Crown: a gold ring with jewels and a little crown', colors: ['#ffd84a', '#b8860b', '#ff3f6c', '#22e4ff'] },
  ],
  banner: [
    { id: 'sunset-grid', label: 'Sunset grid: a striped sun over a rolling grid', colors: ['#0d0230', '#ff3fd2', '#ffc928', '#22e4ff'] },
    { id: 'aurora', label: 'Aurora: light curtains over dark mountains', colors: ['#3cf5b0', '#8b5cff', '#06173a', '#0d2446'] },
    { id: 'nebula', label: 'Nebula: drifting clouds and a ringed planet', colors: ['#ff3fd2', '#8b5cff', '#22e4ff', '#ff8a5c'] },
    { id: 'neon-city', label: 'Neon city: a skyline with lit windows and passing lights', colors: ['#120634', '#ff3fd2', '#ffd12e', '#22e4ff'] },
    { id: 'deep-sea', label: 'Deep sea: light rays, rising bubbles and swaying weed', colors: ['#021a3a', '#0a6a8a', '#7ff0ff', '#0d4f3c'] },
    { id: 'ember-field', label: 'Ember field: sparks rising off a glowing ground', colors: ['#14030a', '#ff4d1a', '#ffc928', '#5a0a1e'] },
  ],
  icon: [
    { id: 'fox', label: 'Fox', colors: ['#2a0f5e', '#7b4dff', '#ff7a1a', '#fff4e6'] },
    { id: 'owl', label: 'Owl', colors: ['#06233f', '#12c6b3', '#6b4bd6', '#ffd12e'] },
    { id: 'skull', label: 'Skull with glowing eyes', colors: ['#1a0b2e', '#ff3fd2', '#f6f1ff', '#22e4ff'] },
    { id: 'rocket', label: 'Rocket', colors: ['#0d1b4a', '#3d5bff', '#f6f1ff', '#ff3f6c'] },
    { id: 'crown', label: 'Crown', colors: ['#3a0a2e', '#ff3fd2', '#ffd84a', '#22e4ff'] },
    { id: 'bolt', label: 'Lightning bolt', colors: ['#1d1238', '#7b4dff', '#ffe14a', '#22e4ff'] },
  ],
};

export const styleOf = (kind: LookKind, id: string): LookStyle | undefined => STYLES[kind].find((s) => s.id === id);

const HEX = /^#[0-9a-f]{6}$/;

/** A look as an admin sent it, or null when it isn't one the site can draw. */
export function sanitizeLook(v: unknown): LookSpec | null {
  const o = (typeof v === 'object' && v ? v : {}) as Record<string, unknown>;
  const kind = LOOK_KINDS.find((k) => k === o.kind);
  const style = kind && typeof o.style === 'string' ? styleOf(kind, o.style) : undefined;
  if (!kind || !style) return null;
  const colors = Array.isArray(o.colors) ? o.colors.slice(0, 4).map((c) => (typeof c === 'string' ? c.trim().toLowerCase() : '')) : [];
  return { kind, style: style.id, ...(colors.length && colors.every((c) => HEX.test(c)) ? { colors } : {}) };
}

/** The look a shop item carries, from a list of items (the live catalog's, or the starting one). */
export function lookOf(id: unknown, items: readonly { id: string; look?: LookSpec }[]): LookSpec | undefined {
  return typeof id === 'string' && id ? items.find((p) => p.id === id)?.look : undefined;
}

export const isLookIn = (id: unknown, kind: LookKind, items: readonly { id: string; look?: LookSpec }[]): id is string => lookOf(id, items)?.kind === kind;

/** What a member wears. Empty means nothing. */
export interface Worn {
  border: string;
  banner: string;
  icon: string;
}

export const WEARS_NOTHING: Worn = { border: '', banner: '', icon: '' };

/** What a member chose, kept only where it's a look of that kind they still own (a refund takes it off). */
export function wornFrom(chosen: Partial<Record<LookKind, string | null>>, owned: readonly string[], items: readonly { id: string; look?: LookSpec }[]): Worn {
  const keep = (kind: LookKind): string => {
    const id = chosen[kind];
    return isLookIn(id, kind, items) && owned.includes(id) ? id : '';
  };
  return { border: keep('border'), banner: keep('banner'), icon: keep('icon') };
}

/** The CSS custom properties that recolor a style: --c1 … --c4. */
export function lookVars(spec: LookSpec | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  spec?.colors?.forEach((c, i) => (vars[`--c${i + 1}`] = c));
  return vars;
}
