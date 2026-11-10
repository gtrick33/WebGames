import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ambienceOf } from '../src/games/sigilfall/audio/ambience';
import { AMBIENCE_FILES, SAMPLES, sampleFiles } from '../src/games/sigilfall/audio/samples';
import { SFX } from '../src/games/sigilfall/audio/sound';
import { SONGS } from '../src/games/sigilfall/audio/songs';
import { SEAM, TRACKS } from '../src/games/sigilfall/audio/tracks';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionDef } from '../src/games/sigilfall/data/types';
import { deathSound } from '../src/games/sigilfall/data/voices';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { newWorld, readyHero } from './sigilfall-bot';

const AUDIO = 'public/games/sigilfall/audio';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe('Sigilfall: its sounds', () => {
  it('every recording the table names has shipped, and nothing ships unused', () => {
    for (const f of sampleFiles()) expect(existsSync(join(AUDIO, `${f}.mp3`)), f).toBe(true);
    for (const a of AMBIENCE_FILES) expect(existsSync(join(AUDIO, `amb-${a}.mp3`)), a).toBe(true);
    const named = new Set([...sampleFiles(), ...AMBIENCE_FILES.map((a) => `amb-${a}`)]);
    expect(readdirSync(AUDIO).filter((f) => !named.has(f.replace(/\.mp3$/, '')))).toEqual([]);
  });

  it('the recordings are small', () => {
    const total = readdirSync(AUDIO).reduce((a, f) => a + statSync(join(AUDIO, f)).size, 0);
    expect(total).toBeLessThan(3 * 1024 * 1024);
    // (what a fight needs comes in first and is a small part of it: the air of a place is fetched when wanted)
    const fight = sampleFiles().reduce((a, f) => a + statSync(join(AUDIO, `${f}.mp3`)).size, 0);
    expect(fight).toBeLessThan(1.3 * 1024 * 1024);
  });

  it('a sound is a recording or, for the very few with none, synthesized: never a beep standing in for a recording', () => {
    expect(Object.keys(SAMPLES).filter((id) => SFX[id])).toEqual([]);
    expect(Object.keys(SFX).sort()).toEqual(['scene', 'warhorn']);
    // (what is heard most is recorded: blows, hurts, the menus, the moments)
    for (const id of ['hit', 'crit', 'hurt', 'swing', 'enemyWindup', 'buff', 'heal', 'levelup', 'quest', 'questDone', 'click', 'open', 'close', 'coin', 'pickup']) expect(SAMPLES[id], id).toBeTruthy();
  });

  it('a recording is mixed within reason: never louder than full, and its pitch never wanders far', () => {
    for (const [id, d] of Object.entries(SAMPLES)) {
      expect(d.files.length, id).toBeGreaterThan(0);
      expect(d.gain, id).toBeGreaterThan(0.15);
      expect(d.gain, id).toBeLessThanOrEqual(0.8);
      expect(d.rate[0], id).toBeLessThanOrEqual(d.rate[1]);
      expect(d.rate[0], id).toBeGreaterThanOrEqual(0.4);
      expect(d.rate[1], id).toBeLessThanOrEqual(1.7);
    }
  });

  it('every land out of doors has its air, and no building has the wind in it', () => {
    const lands = Object.values(REGIONS) as RegionDef[];
    for (const r of lands) {
      if (r.interior) expect(ambienceOf(r.music), r.id).toBeNull();
      else if (r.music !== 'siege') expect(ambienceOf(r.music), r.id).not.toBeNull();
    }
    for (const r of lands.filter((x) => x.kind === 'dungeon' && !x.interior && x.music !== 'siege' && x.music !== 'village' && x.music !== 'riftscar' && x.music !== 'ironpeak')) expect(ambienceOf(r.music), r.id).toBe('cave');
  });

  it('every sound the game asks for exists', () => {
    const asked = new Set<string>();
    for (const file of sources('src/games/sigilfall')) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\b(?:sfx|sound|play)\(\s*'([a-zA-Z-]+)'/g)) asked.add(m[1]!);
      for (const m of text.matchAll(/\bsfx: '([a-zA-Z-]+)'/g)) asked.add(m[1]!);
    }
    expect(asked.size).toBeGreaterThan(40);
    expect([...asked].filter((id) => !SFX[id] && !SAMPLES[id])).toEqual([]);
  });

  it('in a fight: steel when a blade lands, nothing of the kind from a spell, and bones when a skeleton falls', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 20));
    const sounds = (): string[] => w.events.flatMap((ev) => (ev.t === 'sfx' ? [ev.id] : []));
    const foe = w.addEnemy('skeleton', w.player.x + 30, w.player.y, 1, { room: -1, pack: -1, spawn: false })!;
    foe.hp = foe.maxHp = 1e6;
    w.events.length = 0;
    hitEnemy(w, foe, 1, 'physical', { depth: 0, blade: true });
    expect(sounds().some((id) => id === 'clash' || id === 'critBlade')).toBe(true);
    w.events.length = 0;
    hitEnemy(w, foe, 1, 'fire', { depth: 0 });
    expect(sounds().some((id) => id === 'clash' || id === 'critBlade')).toBe(false);
    w.events.length = 0;
    hitEnemy(w, foe, 1e8, 'physical', { depth: 0 });
    expect(sounds()).toContain('dieBone');
  });

  it('every land has a piece of music, every piece has shipped and is played, and the soundtrack stays small', () => {
    const MUSIC = 'public/games/sigilfall/music';
    expect(Object.keys(SONGS).filter((id) => !(id in TRACKS))).toEqual([]);
    const used = new Set(Object.values(TRACKS));
    for (const t of used) expect(existsSync(join(MUSIC, `${t}.mp3`)), t).toBe(true);
    expect(readdirSync(MUSIC).map((f) => f.replace(/\.mp3$/, '')).sort()).toEqual(Object.keys(SEAM).sort());
    expect([...used].sort()).toEqual(Object.keys(SEAM).sort());
    const total = readdirSync(MUSIC).reduce((a, f) => a + statSync(join(MUSIC, f)).size, 0);
    expect(total).toBeLessThan(36 * 1024 * 1024);
    // (one piece is what a player waits for on entering a land)
    for (const f of readdirSync(MUSIC)) expect(statSync(join(MUSIC, f)).size, f).toBeLessThan(1.7 * 1024 * 1024);
  });

  it('a creature falls with the sound of its kind', () => {
    const of = (id: string): string => deathSound(ENEMIES[id]!);
    expect(of('skeleton')).toBe('dieBone');
    expect(of('legion-smith')).toBe('dieBone');
    expect(of('moss-slime')).toBe('dieSlime');
    expect(of('bandit-cutthroat')).toBe('die');
    for (const e of Object.values(ENEMIES)) expect(SAMPLES[deathSound(e)], e.id).toBeTruthy();
  });
});
