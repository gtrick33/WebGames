/**
 * The Ring after the owner's notes on how a match looks: "the cast bar is in the middle of the screen, you can add it a
 * bit more to the bottom", "remove the momentum pop up if possible at all", "if u have title, in the nameplates your
 * name is invisible ... a rolling carousel where it shows your name, the title and keeps rolling indefinitely, like the
 * reel on a slot machine", and the warlock's raised dead: "they are currently floating and not animated, please use a
 * different model for them - skeleton would be nice, add animation attacks as well".
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/games/sigilfall/arena/abilities';
import { GATES, Match, type FighterSetup, type MatchEvent } from '../src/games/sigilfall/arena/sim';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { comboWord, RingFx } from '../src/games/sigilfall/render/ring';
import { hasKit, kitOf } from '../src/games/sigilfall/render3d/kits';
import { THRALL_BLOWS, THRALL_RUN, THRALL_SPRITE, thrallPose } from '../src/games/sigilfall/render3d/thrall';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CSS = read('src/games/sigilfall/Game.css');
/** The body of every CSS rule with exactly this selector. */
const rules = (selector: string): string[] => {
  const out: string[] = [];
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of CSS.matchAll(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`, 'g'))) out.push(m[1]!);
  return out;
};

const fighter = (team: 0 | 1, cls: ClassId, bar?: string[]): FighterSetup => ({ team, cls, name: cls, bar: bar ?? PRESETS[cls][0]!.bar } as FighterSetup);

/** A built 3D file's header (scripts/sigilfall-3d-assets.mjs): its meshes and rigs, without the numbers. */
function packHead(file: string): { meshes: Record<string, { min: number[]; max: number[]; rig?: string; skin?: number }>; rigs: Record<string, { clips: Record<string, unknown> }> } {
  const bytes = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'public/games/sigilfall/3d', file)));
  const len = bytes.readUInt32LE(0);
  return JSON.parse(bytes.subarray(4, 4 + len).toString('utf8'));
}

describe('The Ring: your own cast bar sits low, under the fight', () => {
  it('on a touch screen it is at the bottom, between the stick and the thumb cluster, not a third of the way down', () => {
    const touch = rules('.rb-ring.is-touch .rb-ring-mycast').join('\n');
    expect(touch).toMatch(/bottom:\s*calc\(10px \+ var\(--sa-b, 0px\)\)/);
    expect(touch).not.toMatch(/top:\s*34%/);
    // clear of the stick at rest (its ring at most 28 + 2 × 84 points in from the left) and of the cluster's lowest
    // buttons (the Ring's own, laid out flatter: the Swift Step, 175 + 44 in from the right, past its 6-point margin)
    const left = Number(/left:\s*calc\((\d+)px/.exec(touch)![1]);
    const right = Number(/right:\s*calc\((\d+)px/.exec(touch)![1]);
    expect(left).toBeGreaterThanOrEqual(28 + 2 * 84);
    expect(right).toBeGreaterThanOrEqual(6 + 175 + 44);
  });

  it('with a mouse it stays just over the ability bar, as before', () => {
    const desk = rules('.rb-ring-mycast').join('\n');
    expect(desk).toMatch(/bottom:\s*6px/);
  });
});

describe('The Ring: no momentum pop-up', () => {
  it('the match screen shows no chain of combos, and its styles are gone', () => {
    const match = read('src/games/sigilfall/ui/RingMatch.tsx');
    expect(match).not.toMatch(/rb-ring-momentum|\.streak|MOMENTUM_/);
    expect(CSS).not.toMatch(/rb-ring-momentum|rb-momentum-in/);
  });

  it('a combo is called out by its name alone, without the chain the rules count onto it', () => {
    expect(comboWord('Gloomfire ×3')).toBe('Gloomfire');
    expect(comboWord('Executioner ×2')).toBe('Executioner');
    expect(comboWord('Gloomfire')).toBe('Gloomfire');
    const m = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, 'warlock'), fighter(1, 'warrior')] });
    const fx = new RingFx();
    m.events.push({ k: 'word', id: 1, word: 'Gloomfire ×3', combo: true });
    fx.take(m, () => {}, 0);
    const words = fx.pops.filter((p) => p.word).map((p) => p.text);
    expect(words).toEqual(['Gloomfire!']);
  });

  it('the rules still keep the chain (only the picture of it went)', () => {
    const sim = read('src/games/sigilfall/arena/sim.ts');
    expect(sim).toMatch(/export const MOMENTUM_MAX/);
  });
});

describe('The Ring: nameplates show the class; titles stand over the fighters', () => {
  const match = read('src/games/sigilfall/ui/RingMatch.tsx');
  it('every nameplate and the target card carry the class’s emblem, not a doll’s face (the owner: "hunter and priest look a lot alike")', () => {
    expect(match).toMatch(/<Frame key=\{f\.id\} f=\{f\} m=\{m\} me=\{me\} doll=\{classEmblem\(f\.cls\)\}/);
    expect(match).toMatch(/<Frame key=\{f\.id\} flip f=\{f\} m=\{m\} me=\{me\} doll=\{classEmblem\(f\.cls\)\}/);
    expect(match).toContain('const dollOf = (f: Fighter): string => classEmblem(m.masterOf(f).cls);');
    expect(match).toContain('className="rb-ring-face is-emblem"');
  });

  it('a nameplate says the name whole, with no title rolling through it', () => {
    expect(match).toContain("<b>{f.id === me?.id ? 'You' : f.name}</b>");
    expect(match).not.toMatch(/NameReel/);
    expect(CSS).not.toMatch(/rb-ring-reel/);
  });

  it('a title stands over its fighter’s bar in its own light, the pictures of what is on them lifted over it', () => {
    expect(match).toMatch(/<span[\s\S]{0,200}className="rb-ring-overhead"[\s\S]{0,80}<TitleFx fx=\{t\.fx\}>\{t\.text\}<\/TitleFx>/);
    expect(match).toContain('drawRing(m, fx, myId, time, view, aim, (f) => raise[f.id] ?? 0);');
    const ring = read('src/games/sigilfall/render/ring.ts');
    expect(ring).toContain('const py = by - pip - 2.6 - raise;');
    expect(rules('.rb-ring-overhead').join('\n')).toMatch(/white-space:\s*nowrap/);
  });
});

describe('The Ring: the ashbound dead are skeleton soldiers that stand, run and strike', () => {
  it('are a skeleton of the campaign’s own, on the heroes’ rig, made standing on the ground and not floating', () => {
    expect(hasKit(THRALL_SPRITE)).toBe(true);
    const kit = kitOf(THRALL_SPRITE);
    expect(kit.k).not.toBe('sk_minion');
    expect(kit.k).toMatch(/^sk_/);
    expect(kit.float ?? 0).toBe(0);
    expect(kit.look).toBeUndefined();
    const body = packHead(`k/${kit.k}.pack`).meshes.body!;
    expect(body.rig).toBe('medium');
    expect(body.skin).toBeTypeOf('number');
    expect(body.min[1]).toBe(0);
    // every clip they play is one the rig has
    const clips = packHead('rigs.pack').rigs.medium!.clips;
    for (const c of [THRALL_RUN, ...THRALL_BLOWS, 'idle', 'hit', 'die']) expect(clips[c], c).toBeDefined();
  });

  it('run while they move, stand while they don’t, and every claw starts a blow, a cut and a slice in turn', () => {
    expect(thrallPose(0, 0, false, false, false, true)).toEqual({ clip: THRALL_RUN, loop: true, blow: false });
    expect(thrallPose(0, 0, false, false, false, false)).toEqual({ clip: 'idle', loop: true, blow: false });
    expect(thrallPose(0, 1, false, false, false, true)).toEqual({ clip: THRALL_BLOWS[0], loop: false, blow: true });
    expect(thrallPose(1, 2, true, false, false, false)).toEqual({ clip: THRALL_BLOWS[1], loop: false, blow: true });
    // a blow plays out, unless the next claw comes first
    expect(thrallPose(1, 1, true, false, false, true).clip).toBeNull();
    expect(thrallPose(1, 1, false, false, true, false).clip).toBe('hit');
    expect(thrallPose(3, 3, false, true, false, true)).toEqual({ clip: 'die', loop: false, blow: false });
  });

  it('in a match each claw the rules land is a new blow on the picture', () => {
    const m = new Match({ seed: 3, map: 'sands', fighters: [fighter(0, 'warlock', ['k-raise', 'k-bolt']), fighter(1, 'warrior', ['w-hew'])] });
    m.step(GATES + 0.01, {});
    Object.assign(m.fighters[0]!, { x: 160, y: 125, dirX: 1, dirY: 0, target: 1 });
    Object.assign(m.fighters[1]!, { x: 230, y: 125 });
    expect(m.press(0, 'k-raise')).toBeNull();
    const pets = m.fighters.filter((f) => f.pet);
    const seen = new Map(pets.map((p) => [p.id, 0]));
    const ran = new Set<number>();
    let blows = 0;
    let claws = 0;
    for (let i = 0; i < 5 * 30; i++) {
      m.step(1 / 30, {});
      claws += m.events.filter((e: MatchEvent) => e.k === 'claw').length;
      m.events.length = 0;
      for (const p of pets) {
        const pose = thrallPose(seen.get(p.id)!, p.pet!.hits, false, p.dead, false, Math.hypot(p.vx, p.vy) > 1);
        if (pose.blow) blows++;
        if (pose.clip === THRALL_RUN) ran.add(p.id);
        seen.set(p.id, p.pet!.hits);
      }
    }
    expect(claws).toBeGreaterThanOrEqual(4);
    expect(blows).toBe(claws);
    expect(ran.size).toBe(pets.length);
  });
});
