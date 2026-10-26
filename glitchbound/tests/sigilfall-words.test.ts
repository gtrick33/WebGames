/**
 * The Crown of Ash and Starlight's words everywhere a player reads (STORY_BIBLE.md §1, "Words players learn"):
 * the old story's Hollow Legion, Hollow King and Rift are gone from every registered quest, person, enemy,
 * boss, item, place and story event (ids keep the old words on purpose: saves depend on them), and the
 * text is in American spelling (project rule).
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { EVENTS } from '../src/games/sigilfall/data/events';
import { ITEMS } from '../src/games/sigilfall/data/items';
import { NPCS, QUESTS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';

const OLD = /Hollow Legion|Hollow King|\bLegion\b|\bRift\b|Rift-|Riftbound|Hollow gold/;
const BRITISH = /\b(armour|colour|honour|favour|neighbour|harbour|travell(?:er|ers|ing|ed)|whilst|amongst|centre|defence|plough|smoulder|mould)\b/i;

/** Every string a player can read, with where it came from. */
function texts(): [string, string][] {
  const out: [string, string][] = [];
  const add = (where: string, ...s: (string | undefined)[]): void => {
    for (const t of s) if (t) out.push([where, t]);
  };
  for (const q of QUESTS) add(`quest ${q.id}`, q.name, q.text, q.reward.text, 'label' in q.objective ? q.objective.label : undefined);
  for (const n of Object.values(NPCS)) add(`person ${n.id}`, n.name, n.title, n.shopName, ...n.talk.flatMap((t) => t.lines));
  for (const e of Object.values(ENEMIES)) add(`enemy ${e.id}`, e.name, e.blurb);
  for (const b of Object.values(BOSSES)) add(`boss ${b.id}`, b.name, b.title, b.intro, ...b.phases.map((p) => p.banner));
  for (const i of ITEMS) add(`item ${i.id}`, i.name, i.lore, ...i.mods.map((m) => ('proc' in m ? m.proc.text : undefined)));
  for (const r of Object.values(REGIONS)) {
    add(`region ${r.id}`, r.name, r.subtitle, r.blurb);
    for (const m of [...Object.values(r.markers), ...(r.placed ?? []).map((p) => p.marker)]) if (m.kind === 'exit' || m.kind === 'spot' || m.kind === 'building') add(`region ${r.id}`, 'label' in m ? m.label : m.name);
    for (const enc of r.encounters) add(`room ${r.id}:${enc.id}`, enc.title);
  }
  for (const ev of Object.values(EVENTS)) add(`event ${ev.id}`, ev.banner, ...[...(ev.start ?? []), ...(ev.end ?? []), ...(ev.retry ?? []), ...ev.waves.flatMap((w) => w.barks ?? [])].map((b) => b.text));
  return out;
}

describe('Sigilfall: the new story’s words', () => {
  it('no player-facing text uses the old story’s names', () => {
    const bad = texts().filter(([, t]) => OLD.test(t));
    expect(bad.map(([w, t]) => `${w}: ${t.slice(0, 90)}`)).toEqual([]);
  });

  it('player-facing text is in American spelling', () => {
    const bad = texts().filter(([, t]) => BRITISH.test(t));
    expect(bad.map(([w, t]) => `${w}: ${t.match(BRITISH)![0]}`)).toEqual([]);
  });
});
