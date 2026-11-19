/**
 * Voices (POLISH_PLAN.md piece 26): the hero's efforts, cries and fall in the voice of the body chosen, the companions'
 * shouts in a fight, all free recordings that ship, none left to chance, and none while Settings has them off.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../src/games/sigilfall/audio/samples';
import { voiceSound, type VoiceKind } from '../src/games/sigilfall/audio/voice';
import { DEFAULT_SETTINGS, validateSettings } from '../src/games/sigilfall/progress/save';
import { castVoice } from '../src/games/sigilfall/sim/cast';
import { hurtPlayer } from '../src/games/sigilfall/sim/combat';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

const KINDS: VoiceKind[] = ['attack', 'big', 'hurt', 'death', 'jump', 'victory'];
const voices = (w: World): string[] => w.events.flatMap((e) => (e.t === 'voice' ? [`${e.who}:${e.kind}`] : []));

describe('Sigilfall: voices', () => {
  it('every voice named is a recording that ships', () => {
    for (const who of ['hero', 'mara', 'elyra', 'nyx', 'cael', 'orren']) {
      for (const body of ['m', 'f'] as const) {
        for (const kind of KINDS) {
          const id = voiceSound(who, kind, body);
          if (!id) continue;
          expect(SAMPLES[id], `${who} ${kind}`).toBeDefined();
          for (const f of SAMPLES[id]!.files) expect(existsSync(`public/games/sigilfall/audio/${f}.mp3`), f).toBe(true);
        }
      }
    }
  });

  it('the hero speaks in the voice of the body chosen; a companion in their own; a passer-by not at all', () => {
    expect(voiceSound('hero', 'attack', 'm')).toBe('voMAttack');
    expect(voiceSound('hero', 'attack', 'f')).toBe('voF1Attack');
    expect(voiceSound('hero', 'death', 'f')).toBe('voF1Death');
    expect(voiceSound('mara', 'attack', 'm')).toBe('voF2Attack');
    expect(voiceSound('cael', 'attack', 'm')).toBe('voMShout');
    expect(voiceSound('a-villager', 'attack', 'm')).toBeNull();
    // (a companion only shouts)
    expect(voiceSound('mara', 'hurt', 'm')).toBeNull();
  });

  it('every ultimate, every other dodge, every third long skill; never the basic attack', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 12));
    w.events.length = 0;
    const spec = (cooldown: number) => ({ cooldown }) as never;
    for (let i = 0; i < 3; i++) castVoice(w, 'ult', spec(60));
    for (let i = 0; i < 4; i++) castVoice(w, 'dodge', spec(5));
    for (let i = 0; i < 6; i++) castVoice(w, 's1', spec(8));
    for (let i = 0; i < 6; i++) castVoice(w, 's2', spec(1));
    for (let i = 0; i < 9; i++) castVoice(w, 'basic', spec(0));
    expect(voices(w).filter((v) => v === 'hero:big')).toHaveLength(3);
    expect(voices(w).filter((v) => v === 'hero:jump')).toHaveLength(2);
    expect(voices(w).filter((v) => v === 'hero:attack')).toHaveLength(2);
  });

  it('cries out at a blow worth it, and not at every one of a flurry', () => {
    const w = newWorld('whisperwood', readyHero('warrior', 12));
    const p = w.player;
    p.iframe = 0;
    w.events.length = 0;
    // (blows past the hero's armor, each landing as the last did: no moment's grace between them)
    const blow = (share: number): void => {
      p.iframe = 0;
      hurtPlayer(w, p.maxHp * share, { pierce: true });
    };
    blow(0.01);
    expect(voices(w)).toEqual([]);
    blow(0.15);
    blow(0.15);
    expect(voices(w)).toEqual(['hero:hurt']);
  });

  it('Settings keep them on by default, and remember them off', () => {
    expect(DEFAULT_SETTINGS.voice).toBe(true);
    expect(validateSettings({ ...DEFAULT_SETTINGS, voice: false }).voice).toBe(false);
    expect(validateSettings({}).voice).toBe(true);
  });
});
