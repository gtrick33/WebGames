/**
 * The Ring's sound (the owner, 2026-11-18): "the sounds ... theyre currently kinda annoying, can we use more cartoony
 * cool and warm sounding effects please, the background music should also be per map and should be very cool
 * sounding and nice". Then, 2026-11-19: "the current sounds are awful, its like jungle bells ... make them similar to
 * wow pls, frost mage feels like santa claus with bells".
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/games/sigilfall/arena/maps';
import { RING_SOUNDS, SAMPLES } from '../src/games/sigilfall/audio/samples';
import { SONGS } from '../src/games/sigilfall/audio/songs';
import { MUSIC_CREDITS, RING_MUSIC, SEAM, TRACKS } from '../src/games/sigilfall/audio/tracks';
import { ringSchoolSounds, ringSound } from '../src/games/sigilfall/render/ring';

const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');

describe('The Ring sounds like itself', () => {
  it('every sound a match asks for is the Ring’s own, made for it, and its file ships', () => {
    const asked = new Set<string>(['victory', 'playerDie', 'checkpoint', ...ringSchoolSounds()]);
    for (const file of ['src/games/sigilfall/render/ring.ts', 'src/games/sigilfall/ui/RingMatch.tsx']) for (const m of read(file).matchAll(/\bsound\(\s*'([a-zA-Z-]+)'/g)) asked.add(m[1]!);
    for (const m of read('src/games/sigilfall/render/ring.ts').matchAll(/'(swing|swingBig|bow|shield|blink|buff|rift|heal|critBlade|clash|explode|hit)'/g)) asked.add(m[1]!);
    expect(asked.size).toBeGreaterThan(30);
    for (const id of asked) {
      expect(ringSound(id), id).toBe(`ring-${id}`);
      expect(SAMPLES[ringSound(id)], id).toBeTruthy();
    }
    for (const id of RING_SOUNDS) expect(existsSync(join(process.cwd(), `public/games/sigilfall/audio/ring-${id}.mp3`)), id).toBe(true);
    // (the match plays them through ringSound; the lobby's rank-up is the Ring's too)
    expect(read('src/games/sigilfall/ui/RingMatch.tsx')).toContain('engine.sound.play(ringSound(id), vol)');
    expect(read('src/games/sigilfall/ui/RingScreen.tsx')).not.toMatch(/sound\.play\('levelup'\)/);
  });

  it('no bells: frost crunches and hisses, and nothing chimes', () => {
    const script = read('scripts/sigilfall-ring-sounds.mjs');
    expect(script).not.toMatch(/function (bell|marimba|kalimba|tinkle)\b|\b(bell|marimba|kalimba|tinkle|brass)\(/);
    const sounds = script.slice(script.indexOf('const SOUNDS = {'));
    for (const id of ['freeze', 'shatter', 'shard', 'spear']) expect(sounds).toMatch(new RegExp(`\\b${id}: \\(\\) => [^\\n]*(crunch|frostHiss)`));
  });

  it('the campaign keeps its own sounds', () => {
    expect(ringSound('coin')).toBe('coin');
    expect(SAMPLES.hit!.files).not.toContain('ring-hit');
  });

  it('each arena has its own piece, credited, with its file and a seam; the siege’s score stands in if it can’t be had', () => {
    const themes = new Set(Object.values(MAPS).map((m) => m.theme));
    expect([...themes].sort()).toEqual(Object.keys(RING_MUSIC).sort());
    expect(new Set(Object.values(RING_MUSIC)).size).toBe(themes.size);
    for (const song of Object.values(RING_MUSIC)) {
      const track = TRACKS[song]!;
      expect(track, song).toBe(song);
      expect(SEAM[track], song).toBeGreaterThan(0);
      expect(existsSync(join(process.cwd(), `public/games/sigilfall/music/${track}.mp3`)), song).toBe(true);
      expect(SONGS[song], song).toBe(SONGS.siege);
    }
    for (const title of ['Desert City', 'Ice Flow', 'Volatile Reaction']) {
      expect(MUSIC_CREDITS).toContain(title);
      expect(read('src/games/sigilfall/CREDITS_AND_LICENSES.md')).toContain(`"${title}"`);
    }
    expect(read('src/games/sigilfall/ui/RingMatch.tsx')).toContain('engine.setModeMusic(RING_MUSIC[theme])');
  });
});
