import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { QUEST_DEFS, QUESTS } from '../src/games/sigilfall/data/quests';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import type { Objective, QuestDef, RegionId, StoryCond } from '../src/games/sigilfall/data/types';
import { needsAccept, type Character } from '../src/games/sigilfall/progress/character';
import { questSteps, turnInNpc } from '../src/games/sigilfall/progress/handin';
import { parseRegion } from '../src/games/sigilfall/sim/map';
import { bossRegion, npcRegion, spotRegion } from '../src/games/sigilfall/sim/routes';
import { holds } from '../src/games/sigilfall/sim/story';

/**
 * Every quest at its latest reachable moment, not only its earliest (SFS-04, SFS-05). For each quest step, offer
 * and hand-in, and each quest the maps' conditions read: with the quest's prerequisites done and that other quest
 * done (or under way), whoever or whatever the step needs stands somewhere, and the quest arrow points to the land
 * where it stands. Someone may be away only while another quest is under way (a defense, a raid), never for good.
 */

type Placed = { region: RegionId; cond: StoryCond | null };
type Hero = Pick<Character, 'quests'> & Partial<Character>;

function mapIndex() {
  const npc = new Map<string, Placed[]>();
  const spot = new Map<string, Placed[]>();
  const boss = new Map<string, Placed[]>();
  const place = new Map<string, Placed[]>();
  const packs: { region: RegionId; cond: StoryCond | null; enemies: string[] }[] = [];
  const waveFoes = new Map<RegionId, Set<string>>();
  const gating = new Set<string>();
  const push = (m: Map<string, Placed[]>, k: string, v: Placed): void => void m.set(k, [...(m.get(k) ?? []), v]);
  const collect = (c: StoryCond | null): void => {
    if (!c) return;
    if ('all' in c) c.all.forEach(collect);
    else if ('any' in c) c.any.forEach(collect);
    else if ('not' in c) collect(c.not);
    else gating.add(c.quest);
  };
  for (const id of REGION_IDS) {
    const r = REGIONS[id];
    for (const pm of parseRegion(r).markers) {
      const cond = pm.when ?? r.when?.[pm.ch] ?? null;
      const mk = pm.marker;
      if (['npc', 'spot', 'shrine', 'pack', 'boss', 'place'].includes(mk.kind)) collect(cond);
      if (mk.kind === 'npc') push(npc, mk.npc, { region: id, cond });
      else if (mk.kind === 'spot' || mk.kind === 'shrine') push(spot, mk.id, { region: id, cond });
      else if (mk.kind === 'pack') packs.push({ region: id, cond, enemies: mk.enemies });
      else if (mk.kind === 'boss') push(boss, mk.boss, { region: id, cond });
      else if (mk.kind === 'place') push(place, mk.id, { region: id, cond });
    }
    const foes = new Set<string>();
    for (const enc of r.encounters) {
      for (const w of enc.waves) w.enemies.forEach((e) => foes.add(e));
      if (enc.boss) push(boss, enc.boss, { region: id, cond: null });
    }
    for (const e of [...foes]) {
      const su = ENEMIES[e]?.summons?.enemy;
      if (su) foes.add(su);
    }
    waveFoes.set(id, foes);
  }
  return { npc, spot, boss, place, packs, waveFoes, gating };
}

describe('Sigilfall quest windows', () => {
  it('what every quest step needs stands somewhere, and the arrow points there', { timeout: 300_000 }, () => {
    const M = mapIndex();
    const shownIn = (list: Placed[] | undefined, h: Hero): RegionId[] => [...new Set((list ?? []).filter((x) => !x.cond || holds(h as Character, x.cond)).map((x) => x.region))];
    const foesIn = (region: RegionId, want: string[] | undefined, h: Hero): boolean =>
      !!(want ? want.some((e) => M.waveFoes.get(region)?.has(e)) : M.waveFoes.get(region)?.size) ||
      M.packs.some((p) => p.region === region && (!p.cond || holds(h as Character, p.cond)) && (!want || p.enemies.some((e) => want.includes(e) || want.includes(ENEMIES[e]?.summons?.enemy ?? ''))));
    const need = (q: QuestDef, kind: 'offer' | 'step' | 'ready', o: Objective | null, h: Hero): { what: string; at: RegionId[]; arrow?: RegionId } | null => {
      const c = h as Character;
      if (kind === 'offer') return { what: `giver ${q.giver}`, at: shownIn(M.npc.get(q.giver), h) };
      if (kind === 'ready') {
        const who = turnInNpc(q);
        return who ? { what: `hand-in ${who}`, at: shownIn(M.npc.get(who), h), arrow: npcRegion(who, c) } : null;
      }
      switch (o!.kind) {
        case 'talk':
          return { what: `talk ${o!.npc}`, at: shownIn(M.npc.get(o!.npc), h), arrow: npcRegion(o!.npc, c) };
        case 'explore':
          return { what: `spot ${o!.spot}`, at: shownIn(M.spot.get(o!.spot), h), arrow: spotRegion(o!.spot) ?? q.zone };
        case 'boss':
          return { what: `boss ${o!.boss}`, at: shownIn(M.boss.get(o!.boss), h), arrow: bossRegion(o!.boss) ?? q.zone };
        case 'kill':
        case 'loot': {
          const want = o!.kind === 'loot' ? o!.from : o!.enemies;
          return { what: `${o!.kind} in ${o!.region}`, at: foesIn(o!.region, want, h) ? [o!.region] : [], arrow: o!.region };
        }
        case 'event': {
          const ev = EVENTS[o!.event];
          if (!ev) return null;
          const at = [...shownIn(M.place.get(ev.at), h), ...shownIn(M.spot.get(ev.at), h)].filter((r) => r === ev.region);
          return { what: `event ${o!.event}`, at, arrow: ev.region };
        }
        default:
          return null;
      }
    };
    // the quests after each one, and before it, all the way
    const next = new Map<string, string[]>(QUESTS.map((q) => [q.id, []]));
    for (const q of QUESTS) for (const a of q.after ?? []) next.get(a)?.push(q.id);
    const closure = (id: string, step: (x: string) => string[]): Set<string> => {
      const out = new Set<string>();
      const st = [...step(id)];
      while (st.length) {
        const x = st.pop()!;
        if (out.has(x)) continue;
        out.add(x);
        st.push(...step(x));
      }
      return out;
    };
    const AFTER = new Map(QUESTS.map((q) => [q.id, closure(q.id, (x) => next.get(x) ?? [])]));
    const BEFORE = new Map(QUESTS.map((q) => [q.id, closure(q.id, (x) => QUEST_DEFS[x]?.after ?? [])]));
    const choices = new Map<string, string[]>();
    for (const q of QUESTS) if (q.choice) choices.set(q.choice, [...(choices.get(q.choice) ?? []), q.id]);
    const heroWith = (done: Set<string>, extra: Character['quests']): Hero => {
      const quests: Character['quests'] = {};
      for (const id of done) quests[id] = { state: 'done', n: 1 };
      // of a choice's answers, one was taken: the others are paths not taken
      for (const ids of choices.values()) ids.filter((i) => quests[i]).slice(1).forEach((i) => (quests[i] = { state: 'done', n: -1 }));
      return { quests: { ...quests, ...extra } };
    };
    const missing = new Set<string>();
    const wrongLand = new Set<string>();
    let checks = 0;
    for (const q of QUESTS) {
      const steps = questSteps(q);
      const states: ['offer' | 'step' | 'ready', Objective | null, Character['quests'][string]][] = [];
      if (needsAccept(q)) states.push(['offer', null, { state: 'offered', n: 0 }]);
      steps.forEach((o, i) => states.push(['step', o, { state: 'active', n: 0, ...(i ? { step: i } : {}) }]));
      states.push(['ready', steps[steps.length - 1]!, { state: 'ready', n: 1e6, ...(steps.length > 1 ? { step: steps.length - 1 } : {}) }]);
      const later = AFTER.get(q.id)!;
      for (const x of [null, ...M.gating]) {
        if (x === q.id) continue;
        // x must be reachable with q where it is: not after q, not needing q, not the other answer to q's choice
        if (x && (later.has(x) || BEFORE.get(x)!.has(q.id) || [...BEFORE.get(x)!].some((p) => later.has(p)))) continue;
        if (x && q.choice && QUEST_DEFS[x]?.choice === q.choice) continue;
        for (const xs of x ? (BEFORE.get(q.id)!.has(x) ? [] : (['done', 'active'] as const)) : (['none'] as const)) {
          const done = new Set([...BEFORE.get(q.id)!, ...(x ? BEFORE.get(x)! : []), ...(x && xs === 'done' ? [x] : [])]);
          for (const [kind, o, entry] of states) {
            const extra: Character['quests'] = { [q.id]: entry, ...(x && xs === 'active' ? { [x]: { state: 'active', n: 0 } } : {}) };
            if (q.choice && kind !== 'offer') for (const other of choices.get(q.choice)!) if (other !== q.id) extra[other] = { state: 'done', n: -1 };
            const h = heroWith(done, extra);
            const n = need(q, kind, o, h);
            if (!n) continue;
            checks++;
            const tag = `${q.id} ${kind}: ${n.what} (${x ? `${x} ${xs}` : 'prerequisites only'})`;
            // away for a while (another quest under way) is fine; away for good is not
            if (!n.at.length && xs !== 'active') missing.add(tag);
            else if (n.at.length && n.arrow && !n.at.includes(n.arrow)) wrongLand.add(`${tag}: arrow to ${n.arrow}, stands in ${n.at.join(', ')}`);
          }
        }
      }
    }
    expect(checks).toBeGreaterThan(10_000);
    expect([...missing]).toEqual([]);
    expect([...wrongLand]).toEqual([]);
  });
});
