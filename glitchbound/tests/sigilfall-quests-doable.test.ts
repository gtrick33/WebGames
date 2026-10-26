/**
 * Every quest can be finished: the sight it sends you to is on the map, the enemies it wants killed (or
 * carrying its loot) live where it says, the person to talk to stands somewhere, the boss has a room, and the
 * quests it follows exist. A quest that can't be finished stops its whole chain, so this guards the story.
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { NPCS, QUEST_DEFS, QUESTS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { Marker, RegionDef } from '../src/games/sigilfall/data/types';

const allMarkers = (r: RegionDef): Marker[] => [
  ...Object.values(r.markers),
  ...(r.placed ?? []).map((p) => p.marker),
];

/** Every enemy that can appear in a region: its packs, rares, waves and bosses' summons aside. */
function enemiesOf(r: RegionDef): Set<string> {
  const out = new Set<string>();
  for (const m of allMarkers(r))
    if (m.kind === 'pack') m.enemies.forEach((e) => out.add(e));
  for (const enc of r.encounters)
    for (const wave of enc.waves) wave.enemies.forEach((e) => out.add(e));
  // enemies that call others bring them along
  for (const id of [...out]) {
    const s = ENEMIES[id]?.summons?.enemy;
    if (s) out.add(s);
  }
  return out;
}

describe('sigilfall quests can be finished', () => {
  const regions = Object.values(REGIONS);
  const spots = new Map<string, string[]>();
  const npcs = new Set<string>();
  const bosses = new Set<string>();
  for (const r of regions) {
    for (const m of allMarkers(r)) {
      // sights, and shrines (the Whisperwood's hidden grove)
      if (m.kind === 'spot' || m.kind === 'shrine') spots.set(m.id, [...(spots.get(m.id) ?? []), r.id]);
      if (m.kind === 'npc') npcs.add(m.npc);
      if (m.kind === 'boss') bosses.add(m.boss);
    }
    for (const enc of r.encounters) if (enc.boss) bosses.add(enc.boss);
    for (const n of (r as RegionDef & { npcs?: string[] }).npcs ?? [])
      npcs.add(n);
  }

  for (const q of QUESTS) {
    it(`${q.id}`, () => {
      for (const a of q.after ?? [])
        expect(
          QUEST_DEFS[a],
          `${q.id} follows unknown quest ${a}`,
        ).toBeTruthy();
      if (q.giver)
        expect(NPCS[q.giver], `${q.id}: unknown giver ${q.giver}`).toBeTruthy();
      const o = q.objective;
      if (o.kind === 'explore') {
        const where = spots.get(o.spot) ?? [];
        expect(
          where.length,
          `${q.id}: no region has the sight ${o.spot}`,
        ).toBeGreaterThan(0);
        if (q.zone)
          expect(
            where,
            `${q.id}: the sight ${o.spot} isn't in ${q.zone}`,
          ).toContain(q.zone);
      } else if (o.kind === 'talk') {
        expect(NPCS[o.npc], `${q.id}: unknown person ${o.npc}`).toBeTruthy();
        expect(npcs.has(o.npc), `${q.id}: ${o.npc} stands nowhere`).toBe(true);
      } else if (o.kind === 'boss') {
        expect(BOSSES[o.boss], `${q.id}: unknown boss ${o.boss}`).toBeTruthy();
        expect(bosses.has(o.boss), `${q.id}: no room holds ${o.boss}`).toBe(
          true,
        );
      } else if (o.kind === 'kill' || o.kind === 'loot') {
        const r = REGIONS[o.region];
        expect(r, `${q.id}: unknown region ${o.region}`).toBeTruthy();
        const there = enemiesOf(r);
        const want = o.kind === 'loot' ? o.from : o.enemies;
        if (want)
          expect(
            want.some((e) => there.has(e)),
            `${q.id}: none of ${want.join(', ')} live in ${o.region}`,
          ).toBe(true);
      } else if (o.kind === 'clear') {
        expect(
          REGIONS[o.region]?.kind,
          `${q.id}: ${o.region} is not a dungeon`,
        ).toBe('dungeon');
      }
    });
  }
});

describe('sigilfall: a place found early still counts', () => {
  it('a sight found before its quest was given finishes the quest when the hero goes back', async () => {
    const { newWorld, readyHero } = await import('./sigilfall-bot');
    const { TILE } = await import('../src/games/sigilfall/sim/map');
    const hero = readyHero('warrior', 30, 'uncommon');
    hero.unlocked.push('ashen-barrows');
    const w = newWorld('ashen-barrows', hero);
    const mound = w.spots.find((s) => s.id === 'kings-mound')!;
    const stand = (): void => {
      w.player.x = mound.x;
      w.player.y = mound.y;
      w.player.iframe = 99;
      w.step(1 / 60);
    };
    // found while the quest that wants it isn't given yet
    stand();
    expect(hero.opened.some((k) => k.endsWith(':kings-mound'))).toBe(true);
    expect(hero.quests['the-kings-mound']?.state).not.toBe('done');
    // later the quest is given; going back finishes it
    hero.quests['the-kings-mound'] = { state: 'active', n: 0 };
    w.player.x = mound.x + mound.r * TILE * 3;
    w.step(1 / 60);
    stand();
    expect(hero.quests['the-kings-mound']?.state).toBe('done');
    expect(TILE).toBeGreaterThan(0);
  });
});
