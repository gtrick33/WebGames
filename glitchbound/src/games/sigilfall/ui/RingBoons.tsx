import type { ReactNode, Ref } from 'react';
import { BOONS, type BoonLook, type Points } from '../arena/abilities';
import type { BoonOn } from '../arena/sim';
import { iconPicture } from '../render/art/gameIcons';

/**
 * What a fighter's combo is made of, on the player's own screen: the points they hold as pips over the bar, the boons
 * they carry as small chips beside them, and for a boon that lights an ability up for one use, a sign in its class's own
 * manner (the owner, 2026-11-16: "instant procs should have similar to wows fingers of frost screen visuals, make them
 * unique for each class"). The signs stand either side of the player's own hero and go where the hero goes, each
 * outlined in black (the owner, the same day, of signs that lit the edges of the whole screen: "visual cues for the
 * spells shouldnt be on the whole acreen but rather around the character and have black outlines so they can be
 * visible, for example the light green in the snowy arena is barely visible"). Only drawn here: nothing about the
 * match changes for it.
 */

/**
 * Each manner's shape, drawn for the hero's left in a box 100 wide and 260 high, bowed away from the hero (the right
 * side is the same, turned about): a warrior's gashes, a tongue of flame, shards of ice, a feather, a halo's arc
 * with its rays, a crescent of the void with an eye in it, half a sun, a hexer's arc of runes, the bones of a hand, a
 * vine in leaf, a moon with its stars, a pair of fangs.
 */
export const SHAPES: Record<BoonLook, ReactNode> = {
  slash: (
    <>
      <path d="M78 14 C38 68 32 152 62 240 C46 160 54 82 78 14 Z" />
      <path d="M54 30 C18 82 14 152 38 224 C28 156 34 90 54 30 Z" opacity="0.8" />
      <path d="M97 40 C68 88 64 148 84 216 C76 150 80 96 97 40 Z" opacity="0.65" />
    </>
  ),
  flame: (
    <>
      <path d="M70 252 C18 204 12 132 50 84 C48 110 60 122 68 104 C64 60 80 30 96 6 C92 50 106 70 96 112 C108 102 108 84 106 72 C126 120 114 202 70 252 Z" />
      <path d="M70 236 C40 204 38 160 58 130 C58 148 66 152 70 142 C72 120 80 104 86 92 C86 118 94 130 88 152 C100 176 92 214 70 236 Z" fill="#fff" opacity="0.45" />
    </>
  ),
  ice: (
    <>
      <path d="M62 4 L76 98 L52 122 Z" />
      <path d="M28 56 L58 130 L40 152 L16 108 Z" opacity="0.85" />
      <path d="M84 112 L68 190 L92 254 L99 170 Z" opacity="0.9" />
      <path d="M44 150 L66 198 L50 258 L28 200 Z" opacity="0.75" />
      <path d="M10 150 L30 176 L18 214 L4 184 Z" opacity="0.6" />
      <path d="M62 30 L66 96 L56 106 Z" fill="#fff" opacity="0.5" />
    </>
  ),
  feather: (
    <>
      <path d="M88 4 C44 40 20 100 22 160 L35 150 L28 190 L43 178 L40 216 L53 204 L56 254 C64 180 76 90 88 4 Z" />
      <path d="M84 22 C62 80 54 160 56 240" fill="none" stroke="#fff" strokeWidth="3" opacity="0.5" />
    </>
  ),
  halo: (
    <>
      <path d="M90 16 C26 64 26 196 90 244 L78 244 C24 194 24 66 78 16 Z" />
      <path d="M32 130 L0 122 L0 138 Z" opacity="0.85" />
      <path d="M38 80 L8 58 L16 76 Z" opacity="0.7" />
      <path d="M38 180 L8 202 L16 184 Z" opacity="0.7" />
      <path d="M52 40 L32 14 L36 34 Z" opacity="0.55" />
      <path d="M52 220 L32 246 L36 226 Z" opacity="0.55" />
    </>
  ),
  void: (
    <>
      <path d="M92 16 C16 48 8 204 92 244 C50 192 50 68 92 16 Z" />
      <path d="M40 58 C18 50 12 30 24 10 C22 32 30 44 46 50 Z" opacity="0.8" />
      <path d="M40 202 C18 210 12 230 24 250 C22 228 30 216 46 210 Z" opacity="0.8" />
      <ellipse cx="58" cy="130" rx="9" ry="17" fill="#fff" opacity="0.55" />
    </>
  ),
  sun: (
    <>
      <path d="M100 82 A48 48 0 0 0 100 178 L100 164 A34 34 0 0 1 100 96 Z" />
      <path d="M44 130 L0 120 L0 140 Z" />
      <path d="M52 100 L14 68 L22 90 Z" opacity="0.9" />
      <path d="M52 160 L14 192 L22 170 Z" opacity="0.9" />
      <path d="M72 76 L52 30 L52 56 Z" opacity="0.75" />
      <path d="M72 184 L52 230 L52 204 Z" opacity="0.75" />
    </>
  ),
  hex: (
    <>
      <path d="M92 20 C34 58 34 202 92 240 L84 240 C30 200 30 60 84 20 Z" />
      <path d="M26 112 L40 130 L26 148 L12 130 Z" />
      <path d="M44 56 L55 70 L44 84 L33 70 Z" opacity="0.8" />
      <path d="M44 176 L55 190 L44 204 L33 190 Z" opacity="0.8" />
      <path d="M26 122 L32 130 L26 138 L20 130 Z" fill="#fff" opacity="0.6" />
    </>
  ),
  skull: (
    <>
      <path d="M96 44 C54 40 28 62 20 104 L10 132 L30 116 C36 84 58 66 96 62 Z" />
      <path d="M96 118 C50 108 22 124 8 160 L2 190 L22 170 C34 146 58 136 96 136 Z" opacity="0.9" />
      <path d="M96 190 C58 180 34 194 24 224 L22 252 L38 232 C46 212 64 204 96 206 Z" opacity="0.8" />
    </>
  ),
  leaf: (
    <>
      <path d="M82 252 C28 200 28 70 82 8 L88 12 C38 72 38 198 88 248 Z" />
      <path d="M42 62 C20 52 10 32 12 12 C32 20 44 36 48 56 Z" />
      <path d="M34 132 C12 130 2 114 0 96 C20 98 34 110 40 126 Z" opacity="0.9" />
      <path d="M42 202 C24 210 8 202 2 186 C20 178 36 184 46 196 Z" opacity="0.8" />
    </>
  ),
  moon: (
    <>
      <path d="M86 36 C26 58 16 184 86 224 C52 182 52 78 86 36 Z" />
      <path d="M30 26 L33.5 36.5 L44 40 L33.5 43.5 L30 54 L26.5 43.5 L16 40 L26.5 36.5 Z" />
      <path d="M16 118 L18.5 127.5 L28 130 L18.5 132.5 L16 142 L13.5 132.5 L4 130 L13.5 127.5 Z" opacity="0.85" />
      <path d="M36 212 L38.5 221.5 L48 224 L38.5 226.5 L36 236 L33.5 226.5 L24 224 L33.5 221.5 Z" opacity="0.7" />
    </>
  ),
  fang: (
    <>
      <path d="M92 12 C38 38 16 100 34 154 C40 100 60 54 92 28 Z" />
      <path d="M92 248 C38 222 16 160 34 106 C40 160 60 206 92 232 Z" />
      <path d="M58 118 L68 130 L58 142 L48 130 Z" fill="#fff" opacity="0.5" />
    </>
  ),
};

/** The boons that light the screen: every one a fighter carries but a spell's own quiet while. */
const loud = (boons: readonly BoonOn[]): BoonOn[] => boons.filter((b) => BOONS[b.id] && !BOONS[b.id]!.quiet && b.n > 0);

/**
 * The signs beside the hero while a boon waits to be used. One that can be held twice stands at the left for the first
 * and at the right for the second; any other at both. `at` is the box the match screen moves to the hero each frame,
 * sized in the ground's own units (RingMatch's paint): without it (a test, a still) the signs stand where they are put.
 */
export function BoonFlares({ boons, at }: { boons: readonly BoonOn[]; at?: Ref<HTMLDivElement> }) {
  const lit = loud(boons);
  if (!lit.length) return null;
  return (
    <div className="rb-ring-flares" aria-hidden="true" ref={at}>
      {lit.map((b) => {
        const def = BOONS[b.id]!;
        const sides = (def.max ?? 1) > 1 ? Math.min(2, b.n) : 2;
        return [0, 1].slice(0, sides).map((side) => (
          <svg key={`${b.id}-${side}`} className={`rb-ring-flare is-${def.look}${side ? ' is-right' : ''}`} viewBox="0 0 100 260" style={{ color: def.color }} data-boon={b.id}>
            {SHAPES[def.look]}
          </svg>
        ));
      })}
    </div>
  );
}

/** The boons a fighter carries, each a small chip: its picture, its name, how many, and its time running down. */
export function BoonChips({ boons }: { boons: readonly BoonOn[] }) {
  const shown = boons.filter((b) => BOONS[b.id] && b.n > 0);
  if (!shown.length) return null;
  return (
    <span className="rb-ring-boons" role="status">
      {shown.map((b) => {
        const def = BOONS[b.id]!;
        return (
          <span key={b.id} className={`rb-ring-boon${def.quiet ? ' is-quiet' : ''}`} style={{ ['--bn' as string]: def.color, ['--left' as string]: Math.max(0, Math.min(1, b.t / def.dur)).toFixed(3) }} title={`${def.name}: ${def.text}`}>
            <img src={iconPicture(def.icon)} alt="" draggable={false} />
            <b>
              {def.name}
              {b.n > 1 ? ` ×${b.n}` : ''}
            </b>
            <i />
          </span>
        );
      })}
    </span>
  );
}

/** The points a fighter holds, as pips: lit for each one held, all of them bright when no more can be. */
export function Pips({ points, n }: { points: Points; n: number }) {
  return (
    <span className={`rb-ring-pips${n >= points.max ? ' is-full' : ''}`} style={{ ['--pt' as string]: points.color }} role="img" aria-label={`${n} of ${points.max} ${points.name}`} title={`${points.name}: ${n} of ${points.max}`}>
      {Array.from({ length: points.max }, (_, i) => (
        <i key={i} className={i < n ? 'is-on' : ''} />
      ))}
      <b>{points.name}</b>
    </span>
  );
}
