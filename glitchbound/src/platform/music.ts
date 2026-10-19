import { useSyncExternalStore } from 'react';
import type { MusicEngine } from './musicEngine';
import type { Song, SongId, SongSynth } from './songs';

/**
 * GlitchBound lobby music: an original, upbeat chiptune-style arcade loop synthesized with Web Audio
 * (no downloads). Bouncy square-wave bass, sparkly 16th-note arpeggios, a catchy lead and a light
 * drum kit over a bright I-V-vi-IV style progression at 116 bpm. Kept quiet and dry so it sits
 * behind the page rather than on top of it.
 *
 * Browsers only allow audio after a user gesture, so it starts on the first click/tap/key if the
 * visitor has it switched on (default on, low volume). It pauses while a game is active, and when
 * the tab is hidden. Settings persist in localStorage. During a holiday look the lobby plays that
 * holiday's loop instead (platform/songs.ts).
 */

const KEY = 'glitchbound.music';
interface Settings {
  on: boolean;
  volume: number;
}

function load(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    if (v && typeof v.on === 'boolean' && typeof v.volume === 'number') return { on: v.on, volume: Math.min(1, Math.max(0, v.volume)) };
  } catch {
    /* ignore */
  }
  return { on: true, volume: 0.35 };
}

export interface MusicState {
  on: boolean;
  volume: number;
  /** Actually producing sound right now. */
  playing: boolean;
  /** Waiting for the first click before the browser allows audio. */
  waiting: boolean;
}

class Music {
  private settings: Settings = { on: true, volume: 0.35 };
  private gameActive = false;
  /** The synth (musicEngine.ts), loaded the first time music should play. */
  private engine: MusicEngine | null = null;
  private engineLoading = false;
  private firstCtx: AudioContext | null = null;
  /** The holiday loop to hand the engine (null = the everyday tune). */
  private song: Song | null = null;
  private player: ((synth: SongSynth, t: number, n: number, song: Song) => void) | null = null;
  private songId: SongId = 'default';
  private unlocked = false;
  private listeners = new Set<() => void>();
  state: MusicState = { on: true, volume: 0.35, playing: false, waiting: true };

  init(): void {
    if (typeof window === 'undefined' || this.listenersInstalled) return;
    this.listenersInstalled = true;
    this.settings = load();
    this.publish();
    const unlock = (): void => {
      this.unlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      this.sync();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => this.sync());
    // Fetch the synth while the page is idle, so it is ready by the first click.
    if (this.settings.on) {
      const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 2000));
      idle(() => void import('./musicEngine').catch(() => undefined));
    }
  }
  private listenersInstalled = false;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = (): MusicState => this.state;

  private publish(): void {
    const playing = !!this.engine?.running() && this.shouldPlay();
    this.state = { on: this.settings.on, volume: this.settings.volume, playing, waiting: this.settings.on && !this.unlocked };
    this.listeners.forEach((fn) => fn());
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
  }

  private shouldPlay(): boolean {
    return this.settings.on && this.unlocked && !this.gameActive && !document.hidden && this.settings.volume > 0;
  }

  toggle(): void {
    this.settings.on = !this.settings.on;
    this.unlocked = true; // the toggle itself is a user gesture
    this.save();
    this.sync();
  }

  setVolume(v: number): void {
    this.settings.volume = Math.min(1, Math.max(0, v));
    if (this.settings.volume > 0) this.settings.on = true;
    this.unlocked = true;
    this.save();
    this.engine?.setVolume(this.settings.volume);
    this.sync();
  }

  /** Switches to a holiday's loop ('default' = the everyday tune), from the next bar on. */
  setSong(id: SongId): void {
    if (id === this.songId) return;
    this.songId = id;
    if (id === 'default') {
      this.song = null;
      this.player = null;
      this.engine?.setSong(null, null);
      return;
    }
    // Holiday loops load on demand, so the first visit only downloads the everyday tune.
    void import('./songs').then((m) => {
      if (this.songId !== id) return;
      this.song = m.SONGS[id];
      this.player = m.playSongBar;
      this.engine?.setSong(this.song, this.player);
    });
  }

  /** Games bring their own sound: the lobby music steps aside while one is running. */
  setGameActive(active: boolean): void {
    this.gameActive = active;
    this.sync();
  }

  private sync(): void {
    if (this.shouldPlay()) this.start();
    else this.engine?.stop();
    this.publish();
  }

  private start(): void {
    if (this.engine) return this.engine.start(this.settings.volume);
    // First play: make the AudioContext now, inside the click or tap that allowed audio (iOS insists),
    // and hand it to the synth when its chunk arrives.
    if (!this.firstCtx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      this.firstCtx = AC ? new AC() : null;
      void this.firstCtx?.resume();
    }
    if (this.engineLoading) return;
    this.engineLoading = true;
    void import('./musicEngine')
      .then(({ MusicEngine }) => {
        this.engine = new MusicEngine(
          () => this.shouldPlay(),
          () => this.gameActive,
          () => this.publish(),
          this.firstCtx,
        );
        this.engine.setSong(this.song, this.player);
        this.sync();
      })
      .catch(() => {
        this.engineLoading = false;
      });
  }
}

export const music = new Music();

export function useMusic(): MusicState {
  return useSyncExternalStore(music.subscribe, music.get, music.get);
}
