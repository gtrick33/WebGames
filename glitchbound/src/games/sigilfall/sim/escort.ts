import { rng, TAU } from '../core/math';
import { after, all, is, not } from '../data/cond';
import type { StoryCond } from '../data/types';
import type { Character } from '../progress/character';
import { castRay } from './map';
import { placePet } from './pets';
import { holds } from './story';
import type { World } from './world';

/**
 * A companion at the hero's side on the road (POLISH_PLAN.md piece 21): Mara, Elyra and Nyx walk and fight with the
 * hero in the stretch of the story that is theirs, not only in its staged fights, and say a word now and then when
 * the road is quiet. One at a time, by where the story is (STORY_BIBLE.md §3, the cast):
 *
 *   Mara    the Prologue's hunt in the Whisperwood and the Chapel Crypt, till the hero takes the west road (Act I);
 *   Elyra   Act I, till Nyx comes along after the Bandit King;
 *   Nyx     from the Bandit King to the Tear, where she sells the party's road to the Herald for her brother;
 *   Nyx     again from the day she comes back to the relief camp with the Herald's prison map, to the Gloam Gate;
 *   Elyra   from the Gloam Gate, where she is freed, to the end.
 *
 * Between the Tear and Nyx's return nobody walks with the hero: Elyra is the Herald's, and Nyx is gone.
 *
 * Only out on the road and below ground: never in a town (the companions have their own places there), nor in a
 * Riftstone run, a Trial, a party's run or the Ring. A story fight that brings the same companion in takes the one
 * walking with the hero (sim/pets.ts placePet), and once it is over the escort comes back to the hero's side.
 */
export interface EscortDef {
  who: string;
  when: StoryCond;
}

export const ESCORTS: readonly EscortDef[] = [
  { who: 'mara', when: all(is('into-the-wood', 'started'), not(is('west-road', 'started'))) },
  { who: 'elyra', when: all(is('west-road', 'started'), not(after('the-bandit-king'))) },
  { who: 'nyx', when: all(after('the-bandit-king'), not(after('the-tear'))) },
  { who: 'nyx', when: all(is('gate-the-prison-map', 'started'), not(after('the-gloam-gate'))) },
  { who: 'elyra', when: after('the-gloam-gate') },
];

/** Who walks with this hero now, if anyone. */
export function escortOf(h: Character): string | null {
  return ESCORTS.find((e) => holds(h, e.when))?.who ?? null;
}

/** Whether a companion walks with the hero in this world at all: out on the road or below ground, alone, in the story. */
export function escortsHere(w: World): boolean {
  const r = w.region;
  return !r.safe && r.kind !== 'town' && !r.interior && !w.keyRun && !w.coop && !w.puppet && !w.noLoot;
}

/**
 * What each says on a quiet road, by the stretch of the story they walk in (the escort's own: `late` once they have
 * come back). Short, in their own voices (DIALOGUE_STYLE.md): Mara plain and practical, Elyra thoughtful and losing
 * small things, Nyx quick and wry.
 */
export const ROAD_LINES: Readonly<Record<string, { early: readonly string[]; late?: readonly string[] }>> = {
  mara: {
    early: [
      'Keep your blade low and your eyes up. Beasts like a trail like this.',
      'Briarhollow will have its bells again. I’ll ring the first one myself.',
      'I don’t trust magic. I trust Elyra. That’s not the same thing.',
      'Two hundred people sleep behind our gate. I count them every night.',
      'My father kept this road for twenty years. I mean to keep it longer.',
      'If you hear a horn, it’s ours. If you hear a drum, come find me.',
    ],
  },
  elyra: {
    early: [
      'The sigil hums when we walk north. I wish I knew what it was saying.',
      'Thessa says a hedge-mage mends small things. Nothing is small anymore.',
      'Look, wild thyme. Thessa would have filled her apron with it.',
      'The light comes easier every time I call it. That frightens me more than the Host.',
      'Nyx would hate this road. Too open. Nobody to rob.',
    ],
    late: [
      'There was a word for the smell of rain on hot stone. I can’t find it anymore.',
      'If I forget your name one day, tell it to me again. I’ll be glad to hear it.',
      'Five sigils, and every one took something small. I keep a list of what I still have.',
      'The Herald talked to me for nine days. I won’t tell you what he said. Not yet.',
      'Walk on my left. The sigils are louder on my right.',
    ],
  },
  nyx: {
    early: [
      'Wren would love this. He climbs anything taller than a fence.',
      'Quiet road. Quiet roads cost the most.',
      'If we pass a gallows, we go around it. Old habit.',
      'I counted the coins in your purse while you weren’t looking. Relax. I put them back. Most of them.',
      'The grey coin weighs nothing. I want to meet whoever mints it.',
    ],
    late: [
      'I know. I sold your road at the Tear. You can say it.',
      'Wren’s in that prison, and now we have the map. That’s all I think about.',
      'You let me walk beside you again. I won’t waste it.',
      'The Herald keeps his word. That’s the worst thing about him.',
      'Watch the ridges. I would have put an archer up there. So would he.',
    ],
  },
};

/** Seconds between a companion's words on a quiet road, at the least and the most. */
const TALK_EVERY: readonly [number, number] = [75, 140];

/** The escort's state in a world: when it was last looked to, when it may speak next, the lines it has said. */
interface EscortState {
  next: number;
  look: number;
  said: Set<string>;
  /** Its own dice (where they come in, what they say): the fight's are left as they were. */
  rand: () => number;
}
const states = new WeakMap<World, EscortState>();

/**
 * Keeps the escort at the hero's side and lets them speak: called with the world's step. A companion down in a fight
 * gets back up (PetDef.rally); one left behind in another land is met again at the hero's side here.
 */
export function updateEscort(w: World): void {
  let st = states.get(w);
  if (!st) {
    const rand = rng(w.map.w * 7919 + w.map.h * 104729);
    st = { next: w.time + 20 + rand() * 30, look: 0, said: new Set(), rand };
    states.set(w, st);
  }
  const rand = st.rand;
  if (w.time < st.look) return;
  st.look = w.time + 1;
  const who = escortsHere(w) ? escortOf(w.hero) : null;
  // (one walking with the hero who no longer should: gone, unless a story fight holds them)
  for (const p of w.pets) if (p.escort && p.def.id !== who && !p.dead) p.dead = true;
  if (!who || w.scene || w.player.dead) return;
  const here = w.pets.find((p) => !p.dead && p.def.id === who);
  if (!here) {
    // (a story pet: a story fight that brings them in takes this one as its ally, sim/story.ts ally; it comes in fading)
    const at = castRay(w.map, w.player.x, w.player.y, 6, rand() * TAU, 20);
    const pet = placePet(w, who, at.x, at.y);
    if (pet) pet.escort = true;
    return;
  }
  // a story fight over that had them: they go on with the hero instead of leaving with it, once its last words are said
  if (here.life !== Infinity && !w.story.fighting && !w.story.talking) {
    here.life = Infinity;
    here.goal = undefined;
    here.escort = true;
  }
  // a word on a quiet road: no fight, no one else talking, the hero not hurt a moment ago
  if (!here.escort || w.time < st.next || w.story.fighting || w.story.talking || w.player.calm < 8 || w.enemies.some((e) => e.aggro && !e.dead)) return;
  const set = ROAD_LINES[who];
  const late = (who === 'elyra' && holds(w.hero, after('the-gloam-gate'))) || (who === 'nyx' && holds(w.hero, is('gate-the-prison-map', 'started')));
  const lines = (late && set?.late) || set?.early || [];
  const fresh = lines.filter((l) => !st.said.has(l));
  const line = (fresh.length ? fresh : lines)[Math.floor(rand() * Math.max(1, fresh.length || lines.length))];
  if (!line) return;
  st.said.add(line);
  w.story.speakNow({ who, text: line }, Math.min(7, 2.5 + line.length * 0.05));
  st.next = w.time + TALK_EVERY[0] + rand() * (TALK_EVERY[1] - TALK_EVERY[0]);
}
