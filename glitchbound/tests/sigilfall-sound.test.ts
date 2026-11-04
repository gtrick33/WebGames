import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAMPLES, sampleFiles } from '../src/games/sigilfall/audio/samples';
import { SFX } from '../src/games/sigilfall/audio/sound';
import { SONGS } from '../src/games/sigilfall/audio/songs';
import { SEAM, TRACKS } from '../src/games/sigilfall/audio/tracks';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
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
    const named = new Set(sampleFiles());
    expect(readdirSync(AUDIO).filter((f) => !named.has(f.replace(/\.mp3$/, '')))).toEqual([]);
  });

  it('the recordings are small', () => {
    const total = readdirSync(AUDIO).reduce((a, f) => a + statSync(join(AUDIO, f)).size, 0);
    expect(total).toBeLessThan(1024 * 1024);
  });

  it('every recorded sound has a synthesized one for when its file has not come', () => {
    expect(Object.keys(SAMPLES).filter((id) => !SFX[id])).toEqual([]);
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
    expect(total).toBeLessThan(20 * 1024 * 1024);
  });

  it('a creature falls with the sound of its kind', () => {
    const of = (id: string): string => deathSound(ENEMIES[id]!);
    expect(of('skeleton')).toBe('dieBone');
    expect(of('legion-smith')).toBe('dieBone');
    expect(of('moss-slime')).toBe('dieSlime');
    expect(of('bandit-cutthroat')).toBe('die');
    for (const e of Object.values(ENEMIES)) expect(SFX[deathSound(e)], e.id).toBeTruthy();
  });
});
