import { describe, expect, it } from 'vitest';
import { note, SONG_DEFS, SONGS, type SongId } from '../src/games/sigilfall/audio/songs';
import { REGIONS } from '../src/games/sigilfall/data/regions';

/**
 * The score (audio/songs.ts): every land plays a song of its own, everything a place or a story night asks
 * for exists, and every song is written so it can be played (bars the right length, notes in their scales).
 */

describe('Sigilfall music', () => {
  it('gives every land a song of its own', () => {
    const lands = Object.values(REGIONS).filter((r) => r.kind !== 'dungeon' && !r.interior);
    const songs = lands.map((r) => r.music);
    expect(new Set(songs).size, songs.join(', ')).toBe(lands.length);
    // and none of them is another's tune under a new name
    const tunes = lands.map((r) => SONG_DEFS[r.music].melody.replace(/\s+/g, ' '));
    expect(new Set(tunes).size).toBe(lands.length);
    for (const r of Object.values(REGIONS)) expect(SONGS[r.music], r.id).toBeDefined();
    for (const r of Object.values(REGIONS)) for (const st of r.states ?? []) if (st.music) expect(SONGS[st.music], `${r.id} ${st.id}`).toBeDefined();
  });

  it('writes every song so it plays', () => {
    expect(note('C4')).toBe(60);
    expect(note('F#3')).toBe(54);
    expect(note('Bb2')).toBe(46);
    for (const [id, d] of Object.entries(SONG_DEFS) as [SongId, (typeof SONG_DEFS)[SongId]][]) {
      const s = SONGS[id];
      const steps = s.meter * 2;
      // every bar of the melody is a whole bar
      for (const bar of d.melody.split('|')) expect(bar.trim().split(/\s+/), `${id}: ${bar}`).toHaveLength(steps);
      const tokens = d.melody.split('|').flatMap((b) => b.trim().split(/\s+/));
      expect(tokens[0], `${id} starts on a hold`).not.toBe('-');
      for (const t of tokens) if (t !== '.' && t !== '-') expect(Number(t), `${id}: degree ${t}`).toBeLessThan(s.scale.length);
      expect(s.melody.some((m) => m !== null), id).toBe(true);
      // chords of three notes or more, a bass for each
      for (const c of s.chords) expect(c.length, id).toBeGreaterThanOrEqual(3);
      expect(s.bass).toHaveLength(s.chords.length);
      // drums a sixteenth per letter, a bar long
      if (s.drums) {
        expect(s.drums, id).toHaveLength(s.meter * 4);
        expect(s.drums, id).toMatch(/^[kshtTKx.]+$/);
      }
      expect(s.bpm, id).toBeGreaterThanOrEqual(40);
      expect(s.bpm, id).toBeLessThanOrEqual(180);
      for (const v of [s.pad, s.wind, s.bells, s.callRate, s.echo]) expect(v, id).toBeGreaterThanOrEqual(0);
      expect(s.echo, id).toBeLessThan(0.7);
    }
  });

  it('sounds frightening where the land is', () => {
    // the dark lands breathe: slow, over a drone, with something out there in the dark
    for (const id of ['weeping-woods', 'greyfen', 'duskfen', 'gloamhollow', 'ashen-barrows', 'bonefields', 'hollowmere', 'blightwood', 'pale-reach'] as SongId[]) {
      const s = SONGS[id];
      expect(s.bpm, id).toBeLessThanOrEqual(84);
      expect(s.drone, id).not.toBeNull();
      expect(s.calls.length + (s.bells > 0 ? 1 : 0), id).toBeGreaterThan(0);
    }
  });
});
