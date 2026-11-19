/**
 * The placement editor's data (POLISH_PLAN.md piece 15): what a land's file may hold, a hand-placed prop standing
 * exactly where it was put with the land's own giving way, and a land stood again in place without its foes coming
 * twice. The editor itself is on the dev server only (ui/PlaceEditor.tsx).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { HAND_PLACED, handMarkers, validPlaced, type HandPlaced } from '../src/games/sigilfall/data/placed';
import { propReach, propStandsUp } from '../src/games/sigilfall/data/props';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { K, parseRegion, TILE } from '../src/games/sigilfall/sim/map';
import { newWorld, readyHero } from './sigilfall-bot';

const DIR = 'src/games/sigilfall/data/placed';
const files = (): string[] => {
  try {
    return readdirSync(DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
};

/** The ground the editor lets a prop down on (ui/PlaceEditor.tsx OPEN). */
const OPEN = new Set<number>([K.Floor, K.Deco, K.Path, K.Cobble, K.Sand, K.Tree, K.Bush, K.Rock, K.Bramble, K.Prop]);

describe('Sigilfall: the placement editor', () => {
  const was = new Map<string, HandPlaced[] | undefined>();
  const hold = (land: string, list: HandPlaced[]): void => {
    if (!was.has(land)) was.set(land, HAND_PLACED[land]);
    HAND_PLACED[land] = list;
  };
  afterEach(() => {
    for (const [land, list] of was) {
      if (list) HAND_PLACED[land] = list;
      else delete HAND_PLACED[land];
    }
    was.clear();
  });

  it('takes only what can stand: a known prop at a whole tile, its front one of the four ways', () => {
    expect(validPlaced({ tx: 3, ty: 4, prop: 'barrel' })).toBe(true);
    expect(validPlaced({ tx: 3, ty: 4, prop: 'barrel', face: 'e', solid: true })).toBe(true);
    expect(validPlaced({ tx: 3, ty: 4, prop: 'giant-skull:#8e7a70' })).toBe(true);
    for (const bad of [
      null,
      'barrel',
      { tx: 3.5, ty: 4, prop: 'barrel' },
      { tx: -1, ty: 4, prop: 'barrel' },
      { tx: 3, ty: 4, prop: 'no-such-prop' },
      { tx: 3, ty: 4, prop: 'barrel:red' },
      { tx: 3, ty: 4, prop: 'barrel', face: 's' },
      { tx: 3, ty: 4, prop: 'barrel', solid: 'yes' },
      { tx: 3, ty: 4, prop: 'barrel', when: { quest: 'x', is: 'done' } },
    ])
      expect(validPlaced(bad)).toBe(false);
  });

  it('a hand-placed prop is a prop marker, solid and turned as it was set down', () => {
    expect(handMarkers('x', { x: [{ tx: 1, ty: 2, prop: 'barrel', solid: true, face: 'w' }, { tx: 2, ty: 2, prop: 'rug' }] })).toEqual([
      { tx: 1, ty: 2, marker: { kind: 'prop', prop: 'barrel', solid: true, face: 'w' } },
      { tx: 2, ty: 2, marker: { kind: 'prop', prop: 'rug' } },
    ]);
    expect(handMarkers('nowhere')).toEqual([]);
  });

  it('stands exactly where it was put, and what the land generated there makes way', () => {
    const def = REGIONS.whisperwood;
    const bare = parseRegion(def, []);
    // a big thing the land set down itself: a hand-placed one goes on its very tile
    const big = bare.markers.find((pm) => pm.marker.kind === 'prop' && !pm.when && propStandsUp(pm.marker.prop) && (propReach(pm.marker.prop)?.w ?? 0) >= 26);
    expect(big).toBeTruthy();
    const { tx, ty } = big!;
    const hand = [{ tx, ty, marker: { kind: 'prop' as const, prop: 'menhir', solid: true } }];
    const placed = parseRegion(def, hand);
    const here = placed.markers.filter((pm) => pm.tx === tx && pm.ty === ty && pm.marker.kind === 'prop');
    expect(here.map((pm) => (pm.marker.kind === 'prop' ? pm.marker.prop : ''))).toEqual(['menhir']);
    // (the land's own thing moved aside onto clear ground, or went: it isn't left standing in the hand-placed one)
    const own = big!.marker.kind === 'prop' ? big!.marker.prop : '';
    const count = (m: typeof bare): number => m.markers.filter((pm) => pm.marker.kind === 'prop' && pm.marker.prop === own && !pm.when).length;
    expect(count(placed)).toBeGreaterThanOrEqual(count(bare) - 1);
    expect(count(placed)).toBeLessThanOrEqual(count(bare));
    expect(placed.kind[ty * placed.w + tx]).toBe(K.Prop);
    expect(placed.solid[ty * placed.w + tx]).toBe(1);
  });

  it('a land stood again in place shows what was placed and brings no foe back', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 3));
    const foes = w.enemies.length;
    const at = { x: w.player.x, y: w.player.y };
    const tx = Math.floor(w.player.x / TILE) + 2;
    const ty = Math.floor(w.player.y / TILE);
    hold('whisperwood', [{ tx, ty, prop: 'lamp', solid: true }]);
    w.remap();
    expect(w.props.some((p) => p.prop === 'lamp' && Math.floor(p.x / TILE) === tx && Math.floor(p.y / TILE) === ty)).toBe(true);
    expect(w.enemies.length).toBe(foes);
    expect({ x: w.player.x, y: w.player.y }).toEqual(at);
    // and taken up again
    hold('whisperwood', []);
    w.remap();
    expect(w.props.some((p) => p.prop === 'lamp' && Math.floor(p.x / TILE) === tx && Math.floor(p.y / TILE) === ty)).toBe(false);
    expect(w.enemies.length).toBe(foes);
  });

  it('every land file names a land, every entry in it stands on open ground there, and moves none of the story’s own', () => {
    for (const f of files()) {
      const land = f.replace(/\.json$/, '');
      const def = (REGIONS as Record<string, (typeof REGIONS)[keyof typeof REGIONS]>)[land];
      expect(def, `${f}: no such land`).toBeTruthy();
      const raw = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as unknown[];
      expect(raw.length, `${f}: an entry the game can't stand`).toBe((HAND_PLACED[land] ?? []).length);
      const bare = parseRegion(def!, []);
      // what the story brings and takes (a tent with the refugees, a banner after the ram) keeps its own place: what
      // is set down by hand may move the land's dressing aside, never the story's
      const storyOf = (m: ReturnType<typeof parseRegion>): string[] =>
        m.markers
          .filter((pm) => pm.when)
          .map((pm) => `${pm.marker.kind}:${JSON.stringify(pm.marker)}@${pm.tx},${pm.ty}`)
          .sort();
      expect(storyOf(parseRegion(def!)), `${f}: a story marker moved`).toEqual(storyOf(bare));
      // nor stands in one: a cot low enough to be stepped over still mustn't lie inside the refugees' tent
      const foot = (pm: { tx: number; ty: number; marker: { kind: string } }): { x: number; y: number; w: number; d: number } => {
        const r = pm.marker.kind === 'prop' ? propReach((pm.marker as { prop: string }).prop) : null;
        return { x: (pm.tx + 0.5) * TILE, y: (pm.ty + 0.5) * TILE, w: r?.w ?? TILE, d: r?.d ?? TILE };
      };
      const meet = (a: ReturnType<typeof foot>, b: ReturnType<typeof foot>): boolean => (a.w + b.w) / 2 - Math.abs(a.x - b.x) > 6 && (a.d + b.d) / 2 - Math.abs(a.y - b.y) > 6;
      for (const h of handMarkers(land)) {
        for (const st of bare.markers.filter((pm) => pm.when && (pm.marker.kind === 'prop' || pm.marker.kind === 'npc' || pm.marker.kind === 'place' || pm.marker.kind === 'spot'))) {
          expect(meet(foot(h), foot(st)), `${f}: ${(h.marker as { prop: string }).prop} at ${h.tx},${h.ty} stands in the story's ${st.marker.kind} at ${st.tx},${st.ty}`).toBe(false);
        }
      }
      const tiles = new Set<number>();
      for (const p of HAND_PLACED[land] ?? []) {
        expect(p.tx < bare.w && p.ty < bare.h, `${f}: ${p.prop} at ${p.tx},${p.ty} is off the map`).toBe(true);
        const i = p.ty * bare.w + p.tx;
        expect(OPEN.has(bare.kind[i]!), `${f}: ${p.prop} at ${p.tx},${p.ty} is on the land's own ${bare.kind[i]}`).toBe(true);
        expect(tiles.has(i), `${f}: two things at ${p.tx},${p.ty}`).toBe(false);
        tiles.add(i);
      }
    }
  });

  it('is on the dev server only: the game page loads it only there, and the server only writes a land file', () => {
    const screen = readFileSync('src/games/sigilfall/ui/GameScreen.tsx', 'utf8');
    expect(screen).toContain("const PlaceEditor = import.meta.env.DEV ? lazy(() => import('./PlaceEditor')) : null;");
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain("name: 'sigilfall-placement-editor',\n    apply: 'serve',");
    expect(config).toContain("'src/games/sigilfall/data/placed', `${land}.json`");
    expect(config).toContain('!/^[a-z0-9-]+$/.test(land)');
  });
});
