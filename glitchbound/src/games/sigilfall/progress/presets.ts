import { xpToNext } from '../data/classes';
import { QUEST_DEFS } from '../data/quests';
import { REGIONS } from '../data/regions';
import type { RegionId } from '../data/types';
import { addXp, startQuests, type Character } from './character';

/**
 * Review presets (blueprint Prompt 9 and §14.3): jump a hero straight to a story beat — the story behind it
 * done, the beat itself under way, a level that suits it — so a scene, an event or a world state can be
 * looked at without playing there. Offered on the dev server and with `?review`; a hero who has used one
 * is a review hero from then on and no longer sends scores to the arcade.
 */

export interface Preset {
  id: string;
  label: string;
  region: RegionId;
  /** The quest under way (everything it comes after is done). */
  active?: string;
  /** Quests done as well (with what they come after). */
  done?: string[];
  level: number;
}

export const PRESETS: Preset[] = [
  { id: 'prologue-dusk', label: 'Prologue: dusk at the gate', region: 'briarhollow', active: 'briar-dusk', level: 1 },
  { id: 'prologue-raid', label: 'Prologue: the raid', region: 'briarhollow', active: 'briar-nightfall', level: 3 },
  { id: 'prologue-toll', label: 'Prologue: the bell tolls by itself (scene)', region: 'briarhollow', active: 'briar-nightfall', level: 2 },
  { id: 'prologue-rider', label: 'Prologue: the courier comes up the road (scene)', region: 'briarhollow', active: 'briar-the-rider', level: 3 },
  { id: 'camp-dawn', label: 'Prologue: dawn, the camp (scene)', region: 'briarhollow', active: 'camp-scouts', level: 7 },
  { id: 'hearthstead', label: 'Act I: the Defense of Hearthstead', region: 'amberfield', active: 'hearth-the-riders-come', level: 17 },
  { id: 'hearth-morning', label: 'Act I: Hearthstead the morning after (scene)', region: 'amberfield', active: 'hearth-the-shrine', level: 18 },
  { id: 'lantern-relit', label: 'Act II: Lantern Hill alight (scene)', region: 'ashen-barrows', done: ['the-last-lamp'], level: 26 },
  { id: 'crown-city', label: 'Act II: the Regent (scene)', region: 'emberwick', active: 'the-kings-design', level: 28 },
  { id: 'night-of-knives', label: 'Act II: the Night of Knives', region: 'emberwick', active: 'festival-the-knives', level: 29 },
  { id: 'after-knives', label: 'Act II: the morning after (scene)', region: 'emberwick', active: 'festival-the-catacombs', level: 29 },
  { id: 'the-tear', label: 'Act III: the Pale Herald at the Tear', region: 'shattered-vale', active: 'the-heralds-ambush', level: 40 },
  { id: 'elyra-gone', label: 'Act III: Elyra taken (scene)', region: 'briarhollow', active: 'fern-retaken', level: 41 },
  { id: 'fern-home', label: 'Act III: Fernstead home again (scene)', region: 'brackenridge', done: ['fern-retaken'], level: 42 },
  { id: 'highwall', label: 'Act IV: Highwall’s relief', region: 'highwall', active: 'mara-commands', level: 44 },
  { id: 'highwall-holds', label: 'Act IV: Highwall holds (scene)', region: 'briarhollow', done: ['the-long-night-ends'], level: 48 },
  { id: 'nyx-returns', label: 'Act IV: Nyx comes back (scene)', region: 'highwall', active: 'gate-the-prison-map', level: 44 },
  { id: 'gloam-cells', label: 'Act IV: the cells under the Gloam Gate', region: 'gloamhollow', active: 'gloam-the-cells', level: 47 },
  { id: 'elyra-free', label: 'Act IV: Elyra out of the dark (scene)', region: 'gloamhollow', active: 'the-gatewarden', level: 48 },
  { id: 'muster-hall', label: 'Act IV: the field before the Muster Hall', region: 'bonefields', active: 'muster-the-field', level: 50 },
  { id: 'ysane-echo', label: 'Act V: the queen at the door (scene)', region: 'weeping-woods', active: 'wood-the-children', level: 49 },
  { id: 'orren-shore', label: 'Act V: the lake answers Orren', region: 'hollowmere', active: 'orren-on-the-shore', level: 55 },
  { id: 'last-march', label: 'Act VI: every banner (scene)', region: 'pale-reach', active: 'the-kings-kennels', level: 56 },
  { id: 'siege-mages', label: 'Act VI: the siege mages before the wall', region: 'pale-reach', active: 'march-the-siege-mages', level: 58 },
  { id: 'keep-the-door', label: 'Act VI: Mara keeps the door (scene)', region: 'pale-reach', active: 'the-duskspire-gate', level: 59 },
  { id: 'crownfall-throne', label: 'Crownfall: the throne', region: 'duskspire', active: 'the-hollow-king', level: 60 },
  { id: 'crownfall-memory', label: 'Crownfall: Vaelmoor whole (scene)', region: 'vaelmoor-remembered', active: 'crownfall-vaelmoor', level: 60 },
  { id: 'crownfall-ash-crown', label: 'Crownfall: the Ash Crown', region: 'vaelmoor-remembered', active: 'crownfall-the-ash-crown', done: ['crownfall-break-it'], level: 60 },
  { id: 'the-bell', label: 'Epilogue: the bell (scene)', region: 'briarhollow', active: 'epilogue-the-bell', level: 60 },
  { id: 'mythic-plus', label: 'Postgame: the Riftstone (+1)', region: 'briarhollow', done: ['postgame-crownfall-mythic'], level: 60 },
];

/** Puts a hero at a preset's beat: its story done, the beat under way, raised to its level, its lands open. */
export function applyPreset(c: Character, p: Preset): void {
  const done = (id: string): void => {
    const q = QUEST_DEFS[id];
    if (!q || c.quests[id]?.state === 'done') return;
    for (const a of q.after ?? []) done(a);
    // a choice already answered another way stays as it is; otherwise the beat counts as played
    if (!q.choice || !Object.values(QUEST_DEFS).some((o) => o.choice === q.choice && o.id !== id && c.quests[o.id]?.state === 'done')) c.quests[id] = { state: 'done', n: 1 };
  };
  for (const id of p.done ?? []) done(id);
  if (p.active) {
    for (const a of QUEST_DEFS[p.active]?.after ?? []) done(a);
    c.quests[p.active] = { state: 'active', n: 0 };
  }
  for (let guard = 0; c.level < p.level && guard < 100; guard++) addXp(c, xpToNext(c.level));
  for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r) && REGIONS[r].levels[0] <= c.level + 2) c.unlocked.push(r);
  if (!c.unlocked.includes(p.region)) c.unlocked.push(p.region);
  // the scenes of the beat play again
  c.opened = c.opened.filter((o) => !o.startsWith('scene:'));
  // the story's gifts that the beats done would have paid (the tier, the Riftstone)
  for (const [id, e] of Object.entries(c.quests)) {
    const r = e.state === 'done' ? QUEST_DEFS[id]?.reward : undefined;
    if (r?.tier !== undefined) c.tier = Math.max(c.tier, r.tier);
    if (r?.keystone) c.keystone = Math.max(c.keystone, r.keystone);
  }
  c.review = true;
  startQuests(c);
}
