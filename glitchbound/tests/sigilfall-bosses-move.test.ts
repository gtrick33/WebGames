import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { bossForm } from '../src/games/sigilfall/render3d/bossKit';
import { defaultMove } from '../src/games/sigilfall/render3d/bossMoves';
import { kitOf } from '../src/games/sigilfall/render3d/kits';
import { readPack } from './sigilfall-packs';

/**
 * Bosses move (the owner, 2026-11-24: "check all the act 1 bosses whether theyre not just floating and have actual
 * animations please, animate them if they lack them and keep that in mind for any future boss"). A boss that has been
 * through the pass has a clip of its skeleton for every attack the rules give it: on its form if it has a file of its
 * own (render3d/bossKit.ts), on its kit if it is drawn with a shared creature (render3d/kits.ts `moves`). It stands on
 * the ground unless its story has it drift. `node scripts/sigilfall-boss-shots.mjs --boss <id> --motion` is the other
 * half: it watches the running fight for a boss that moves without walking or attacks without its move.
 */

/** The bosses that have been through the pass: add each one here as it is done. */
const DONE = ['coffin-matron', 'ossric', 'morgrave', 'grimtusk', 'hangman', 'gnasher', 'varric', 'king-hrodric', 'sir-corvane', 'silas-vey', 'the-royal-auditor'];
/** The ones whose story has them off the ground (Morgrave drifts over his page: data/bosses.ts). */
const DRIFTS = new Set(['morgrave']);
/**
 * The ones that are off the ground because of what they are: Morgrave over his page, the wyrm on the wing, Ilvane
 * unmoored from the world (her name and her fight), the Herald who is not wholly here. Everyone else walks.
 */
const ALOFT = new Set(['morgrave', 'the-rime-wyrm', 'ilvane-the-unmoored', 'herald-in-the-spire']);
/** Clips any creature has for standing, going and being hurt: not a move. */
const PLAIN = new Set(['idle', 'walk', 'run', 'hit', 'die', 'dead']);

const rigs = readPack('rigs');

describe('Sigilfall: bosses move', () => {
  for (const id of DONE) {
    const boss = BOSSES[id]!;
    const kit = kitOf(boss.sprite, boss.id);
    const form = bossForm(kit.form);
    const moves = form?.moves ?? kit.moves;
    const patterns = [...new Set(boss.phases.flatMap((p) => [...(p.enter ?? []), ...p.patterns].map((u) => u.id)))];

    it(`${boss.name}: a move for every attack, each a clip its skeleton has`, () => {
      expect(moves, `${id} has no moves at all`).toBeTruthy();
      // (a beast built as the great mounts are moves on its animal's file; the rest on their own file or the shared rigs)
      const file = kit.steed ? null : readPack(`k/${kit.k}`);
      const rigName = file?.meshes.body!.rig;
      const rig = file && rigName ? (rigs.rigs[rigName] ?? file.rigs[rigName]) : null;
      for (const p of patterns) {
        const move = moves![p];
        expect(move, `${id} has no move for ${p}`).toBeTruthy();
        expect(PLAIN.has(move!.clip), `${id}: ${p} is only "${move!.clip}"`).toBe(false);
        if (rig) expect(rig.clips[move!.clip], `${id}: its skeleton has no "${move!.clip}" (for ${p})`).toBeTruthy();
      }
      // and it can walk and run: its skeleton has both
      if (rig) for (const c of ['idle', 'walk', 'run']) expect(rig.clips[c], `${id}: its skeleton has no ${c}`).toBeTruthy();
    });

    it(`${boss.name}: not every attack is the same move`, () => {
      const used = new Set(patterns.map((p) => moves?.[p]?.clip));
      if (patterns.length >= 3) expect(used.size, `${id}: ${patterns.length} attacks, ${[...used].join(', ')}`).toBeGreaterThanOrEqual(2);
    });

    it(`${boss.name}: stands on the ground${DRIFTS.has(id) ? ' (or drifts, as its story has it)' : ''}`, () => {
      if (!DRIFTS.has(id)) expect(kit.float ?? 0, `${id} is lifted off the ground`).toBe(0);
    });
  }

  // Every boss, whether or not it has been through the pass: where nobody has chosen its moves, each attack takes the
  // move of its kind from what its skeleton has (render3d/bossMoves.ts), so no boss makes one swing for everything.
  for (const boss of Object.values(BOSSES)) {
    const kit = kitOf(boss.sprite, boss.id);
    const form = bossForm(kit.form);
    const own = form?.moves ?? kit.moves;
    const patterns = [...new Set(boss.phases.flatMap((p) => [...(p.enter ?? []), ...p.patterns].map((u) => u.id)))];
    const file = readPack(`k/${kit.k}`);
    const rigName = file.meshes.body!.rig;
    const rig = kit.look ? rigs.rigs.medium! : rigName ? (rigs.rigs[rigName] ?? file.rigs[rigName])! : null;
    const has = (c: string): boolean => !!rig?.clips[c];
    const moveFor = (p: string): string | undefined => (own?.[p] ?? (form ? undefined : defaultMove(p, has, kit.atk)))?.clip;

    it(`${boss.name} (every boss): each attack has a move its skeleton has, and they are not all one`, () => {
      expect(rig, `${boss.id} has no skeleton`).toBeTruthy();
      for (const p of patterns) {
        const clip = moveFor(p);
        expect(clip, `${boss.id} has no move for ${p}`).toBeTruthy();
        expect(PLAIN.has(clip!), `${boss.id}: ${p} is only "${clip}"`).toBe(false);
        expect(has(clip!), `${boss.id}: its skeleton has no "${clip}" (for ${p})`).toBe(true);
      }
      const used = new Set(patterns.map(moveFor));
      if (patterns.length >= 3) expect(used.size, `${boss.id}: ${patterns.length} attacks, all "${[...used].join(', ')}"`).toBeGreaterThanOrEqual(2);
      for (const c of ['idle', 'walk']) expect(has(c), `${boss.id}: its skeleton has no ${c}`).toBe(true);
    });

    it(`${boss.name} (every boss): on the ground unless it is a thing that flies or drifts`, () => {
      if (!ALOFT.has(boss.id)) expect(kit.float ?? 0, `${boss.id} is lifted off the ground`).toBe(0);
    });
  }
});
