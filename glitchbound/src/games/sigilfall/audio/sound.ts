import type { Mix } from './mix';
import { firstFiles, laterFiles, SAMPLES, type AmbienceId, type SampleDef } from './samples';
import { Score } from './score';
import { SONGS, type SongId } from './songs';
import { SEAM, TRACKS, type TrackId } from './tracks';

/**
 * Sigilfall's sound: recorded effects (audio/samples.ts; a handful with no recording are synthesized below), the air
 * of each place under them (audio/ambience.ts), and a soundtrack of recorded pieces (audio/tracks.ts) with a
 * procedural score standing in if one can't be had (audio/songs.ts, played by audio/score.ts). The AudioContext is
 * created on the first tap or key (browsers block sound before that), effects are rate-limited so a big fight never
 * turns into noise, and everything follows the master / music / effects volumes and the mute switch.
 */

const AUDIO_BASE = '/games/sigilfall/audio/';
/** Bump when the built files change, so a browser doesn't keep old ones. */
const AUDIO_VERSION = '4';
/** How many recordings sound at once, at most (a phone has its limits, and past this nobody can tell). */
const MAX_VOICES = 24;
const MUSIC_BASE = '/games/sigilfall/music/';
const MUSIC_VERSION = '2';
/** A piece that comes in at this level sits where the procedural score does. */
const TRACK_GAIN = 1;
/** How long one land's music takes to give way to the next, in seconds. */
const CROSSFADE = 1.5;
/** How loud the air of a place is under everything (it follows the effects volume), and how long it takes to change. */
const AMBIENCE_GAIN = 0.55;
const AMBIENCE_FADE = 2.5;
/** How long one pass of a place's air overlaps the next, so the loop has no seam (never more than a third of it). */
const AMBIENCE_SEAM = 1.5;
/** A sound of nothing at all: playing it during a tap wins an audio element the right to play later (phones). */
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/** One of the two players the soundtrack crossfades between. A piece streams from memory, not held decoded. */
interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  track: TrackId | null;
}

export type MusicId = SongId | null;

interface Voice {
  f: number;
  to?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  at?: number;
  /** Seconds to swell in (else a strike), and to hold full before it dies away (a horn's call). */
  attack?: number;
  hold?: number;
}

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/**
 * The few sounds with no recording (audio/samples.ts has the rest): a few soft tones each. Kept low and round, so
 * they sit with the recordings and not on top of them.
 */
export const SFX: Record<string, (s: Sound) => void> = {
  // a war horn across a field: a long low call, a breath, and the call again a fifth higher
  warhorn: (s) => (
    s.noise(0.4, 0.02, 500, 'lowpass'),
    s.tones([
      { f: hz(41), to: hz(43), dur: 1.4, gain: 0.045, type: 'sawtooth', attack: 0.18, hold: 0.8 },
      { f: hz(53), to: hz(55), dur: 1.4, gain: 0.016, type: 'triangle', attack: 0.18, hold: 0.8 },
      { f: hz(43), dur: 2, gain: 0.05, type: 'sawtooth', at: 1.6, attack: 0.15, hold: 1.2 },
      { f: hz(50), dur: 2, gain: 0.03, type: 'sawtooth', at: 1.6, attack: 0.15, hold: 1.2 },
      { f: hz(62), dur: 2, gain: 0.014, type: 'triangle', at: 1.6, attack: 0.15, hold: 1.2 },
    ])
  ),
  // a scene begins: two soft low notes under the letterbox
  scene: (s) => s.tones([{ f: hz(55), dur: 0.6, gain: 0.03, type: 'sine' }, { f: hz(62), dur: 0.8, gain: 0.025, type: 'sine', at: 0.25 }]),
};

/** The music's low-pass by how much of a fight is on: a little dark out of one (3.2 kHz), wide open in one. */
const toneOf = (fight: number): number => 3200 * Math.pow(18000 / 3200, Math.max(0, Math.min(1, fight)));
/** The music's share by the mix: stepped back for the story, a touch softer out of a fight. */
const musicGainOf = (m: Mix): number => m.duck * (0.86 + 0.14 * Math.max(0, Math.min(1, m.fight)));

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  /** The mix (audio/mix.ts): the music's tone (a low-pass, opening in a fight) and its step back for the story. */
  private musicTone: BiquadFilterNode | null = null;
  private musicDuck: GainNode | null = null;
  private ambDuck: GainNode | null = null;
  private mixNow: Mix = { duck: 1, fight: 0 };
  private noiseBuf: AudioBuffer | null = null;
  private last = new Map<string, number>();
  /** The recordings that have come in, by file. */
  private readonly recordings = new Map<string, AudioBuffer>();
  private fetching = false;
  /** Which file each sound played last (not the same one twice running). */
  private readonly lastFile = new Map<string, string>();
  private voices = 0;
  /** The air of the place: what is wanted, what is sounding (one pass after another, overlapped), and the loops had so far. */
  private ambBus: GainNode | null = null;
  private ambWanted: AmbienceId | null = null;
  private amb: { id: AmbienceId; out: GainNode; buf: AudioBuffer; next: number } | null = null;
  private readonly airs = new Map<AmbienceId, Promise<AudioBuffer>>();
  /** The soundtrack's two players, and which of them is live. */
  private decks: [Deck, Deck] | null = null;
  private live = 0;
  /** The pieces fetched so far (a small file each, ready to start at once). */
  private readonly pieces = new Map<TrackId, Promise<string>>();
  /** What the music should be playing now (a piece may arrive after the land has changed again). */
  private wantedTrack: TrackId | null = null;
  private music: MusicId = null;
  private wanted: MusicId = null;
  private score: Score | null = null;
  private timer = 0;
  private suspended = false;
  volumes = { master: 0.8, music: 0.55, sfx: 0.8, muted: false };

  /** Call from a user gesture: creates or resumes the audio context. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      // (so that a hundred blows at once are loud, not broken)
      const limit = this.ctx.createDynamicsCompressor();
      limit.threshold.value = -14;
      limit.knee.value = 10;
      limit.ratio.value = 5;
      limit.attack.value = 0.003;
      limit.release.value = 0.2;
      this.sfxBus.connect(limit).connect(this.master);
      // the music through its tone and its step back (audio/mix.ts), the air through a step back of its own
      this.musicTone = this.ctx.createBiquadFilter();
      this.musicTone.type = 'lowpass';
      this.musicTone.Q.value = 0.5;
      this.musicTone.frequency.value = toneOf(this.mixNow.fight);
      this.musicDuck = this.ctx.createGain();
      this.musicDuck.gain.value = musicGainOf(this.mixNow);
      this.musicBus.connect(this.musicTone).connect(this.musicDuck).connect(this.master);
      this.ambBus = this.ctx.createGain();
      this.ambDuck = this.ctx.createGain();
      this.ambBus.connect(this.ambDuck).connect(this.master);
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, len);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.timer = window.setInterval(() => this.schedule(), 90);
      this.fetchRecordings();
      this.makeDecks();
    }
    // stopped by the browser rather than by the game (a phone's 'interrupted' after it was put away): a touch
    // or a key starts it again
    if (this.ctx.state !== 'running' && !this.suspended) void this.ctx.resume().catch(() => undefined);
    if (this.wanted !== this.music) this.setMusic(this.wanted);
    if (this.ambWanted !== (this.amb?.id ?? null)) this.setAmbience(this.ambWanted);
  }

  /**
   * The mix as it should be now (audio/mix.ts mixFor), called every frame: only a change acts, and the music glides to
   * it, stepping back quickly for words and coming forward again slowly, opening as a fight starts and closing after.
   */
  setMix(m: Mix): void {
    const was = this.mixNow;
    if (Math.abs(m.duck - was.duck) < 0.01 && Math.abs(m.fight - was.fight) < 0.05) return;
    this.mixNow = m;
    const c = this.ctx;
    if (!c || !this.musicDuck || !this.musicTone) return;
    const t = c.currentTime;
    const back = m.duck < was.duck;
    this.musicDuck.gain.setTargetAtTime(musicGainOf(m), t, back ? 0.12 : 0.6);
    this.musicTone.frequency.setTargetAtTime(toneOf(m.fight), t, m.fight > was.fight ? 0.25 : 1.2);
    this.ambDuck?.gain.setTargetAtTime(m.duck < 1 ? 0.6 + 0.4 * m.duck : 1, t, back ? 0.12 : 0.6);
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }): void {
    this.volumes = { ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.muted ? 0 : this.volumes.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.55, t, 0.05);
    this.ambBus?.gain.setTargetAtTime(this.volumes.sfx * AMBIENCE_GAIN, t, 0.05);
  }

  /** Pauses all sound (game paused, tab hidden); called every frame with what should be, so only a change acts. */
  suspend(on: boolean): void {
    if (on === this.suspended) {
      // playing, but the browser stopped it (a phone put away): try again now and then (a touch also does)
      if (!on && this.ctx && this.ctx.state !== 'running' && performance.now() - this.retried > 1000) {
        this.retried = performance.now();
        void this.ctx.resume().catch(() => undefined);
      }
      return;
    }
    this.suspended = on;
    if (!this.ctx) return;
    if (on) void this.ctx.suspend().catch(() => undefined);
    else void this.ctx.resume().catch(() => undefined);
    for (const d of this.decks ?? []) {
      if (!d.track) continue;
      if (on) d.el.pause();
      else void d.el.play().catch(() => undefined);
    }
  }

  private retried = 0;

  play(id: string, vol = 1): void {
    if (!this.ctx || this.volumes.muted || this.suspended) return;
    const now = this.ctx.currentTime;
    // the same sound at most every 45 ms (hits in a crowd)
    const prev = this.last.get(id) ?? -1;
    if (now - prev < 0.045) return;
    this.last.set(id, now);
    // a recorded sound is only ever its recording (silent until the file has come in, never a beep in its place)
    const def = SAMPLES[id];
    if (def) {
      this.playRecording(id, def, vol);
      return;
    }
    this.volScale = vol;
    SFX[id]?.(this);
    this.volScale = 1;
  }

  /**
   * Brings the recordings in, a few at a time, behind everything else, most used first: what a fight needs, then what
   * comes after it (the footsteps). One that fails is silent.
   */
  private fetchRecordings(): void {
    const c = this.ctx;
    if (!c || this.fetching) return;
    this.fetching = true;
    const files = [...firstFiles(), ...laterFiles()];
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < files.length && this.ctx === c) {
        const file = files[next++]!;
        try {
          const res = await fetch(`${AUDIO_BASE}${file}.mp3?v=${AUDIO_VERSION}`);
          if (res.ok) this.recordings.set(file, await c.decodeAudioData(await res.arrayBuffer()));
        } catch {
          // (silent, then)
        }
      }
    };
    for (let i = 0; i < 3; i++) void worker();
  }

  private playRecording(id: string, def: SampleDef, vol: number): boolean {
    const c = this.ctx;
    if (!c || !this.sfxBus) return false;
    const ready = def.files.filter((f) => this.recordings.has(f));
    if (!ready.length) return false;
    // (full up: it is lost in the din anyway)
    if (this.voices >= MAX_VOICES) return true;
    const fresh = ready.length > 1 ? ready.filter((f) => f !== this.lastFile.get(id)) : ready;
    const file = fresh[Math.floor(Math.random() * fresh.length)]!;
    this.lastFile.set(id, file);
    const src = c.createBufferSource();
    src.buffer = this.recordings.get(file)!;
    src.playbackRate.value = def.rate[0] + Math.random() * (def.rate[1] - def.rate[0]);
    const g = c.createGain();
    g.gain.value = def.gain * vol;
    src.connect(g).connect(this.sfxBus);
    this.voices++;
    src.onended = (): void => {
      this.voices--;
      src.disconnect();
      g.disconnect();
    };
    src.start();
    return true;
  }

  private volScale = 1;

  tones(list: Voice[]): void {
    const c = this.ctx;
    if (!c || !this.sfxBus) return;
    for (const v of list) {
      const t = c.currentTime + (v.at ?? 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = v.type ?? 'sine';
      o.frequency.setValueAtTime(v.f, t);
      if (v.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, v.to), t + v.dur);
      const peak = Math.max(0.0002, v.gain * this.volScale);
      const up = v.attack ?? 0.008;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + up);
      if (v.hold) g.gain.setValueAtTime(peak, t + up + v.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
      o.connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + v.dur + 0.03);
    }
  }

  noise(dur: number, gain: number, freq: number, type: BiquadFilterType): void {
    const c = this.ctx;
    if (!c || !this.sfxBus || !this.noiseBuf) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.5 + Math.random();
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain * this.volScale, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /* ----------------------------------------------------- the air of a place */

  /** The air of the place the hero is in (null: none, indoors and on the title). It fades to the next. */
  setAmbience(id: AmbienceId | null): void {
    this.ambWanted = id;
    const c = this.ctx;
    if (!c || !this.ambBus) return;
    if ((this.amb?.id ?? null) === id) return;
    const t = c.currentTime;
    const old = this.amb;
    this.amb = null;
    if (old) {
      old.out.gain.cancelScheduledValues(t);
      old.out.gain.setValueAtTime(Math.max(0.0001, old.out.gain.value), t);
      old.out.gain.linearRampToValueAtTime(0.0001, t + AMBIENCE_FADE);
      window.setTimeout(() => old.out.disconnect(), AMBIENCE_FADE * 1000 + 200);
    }
    if (!id) return;
    let air = this.airs.get(id);
    if (!air) {
      air = fetch(`${AUDIO_BASE}amb-${id}.mp3?v=${AUDIO_VERSION}`).then(async (res) => {
        if (!res.ok) throw new Error(id);
        return c.decodeAudioData(await res.arrayBuffer());
      });
      air.catch(() => this.airs.delete(id));
      this.airs.set(id, air);
    }
    air
      .then((buf) => {
        if (this.ambWanted !== id || this.amb || this.ctx !== c || !this.ambBus) return;
        const out = c.createGain();
        const now = c.currentTime;
        out.gain.setValueAtTime(0.0001, now);
        out.gain.linearRampToValueAtTime(1, now + AMBIENCE_FADE);
        out.connect(this.ambBus);
        this.amb = { id, out, buf, next: now };
        this.airPass();
      })
      .catch(() => undefined);
  }

  /** Starts the next pass of the air when its time is near: each fades in under the end of the one before. */
  private airPass(): void {
    const c = this.ctx;
    const a = this.amb;
    if (!c || !a || a.next - c.currentTime > 1) return;
    const seam = Math.min(AMBIENCE_SEAM, a.buf.duration / 3);
    const at = Math.max(a.next, c.currentTime);
    const src = c.createBufferSource();
    src.buffer = a.buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(1, at + seam);
    g.gain.setValueAtTime(1, at + a.buf.duration - seam);
    g.gain.linearRampToValueAtTime(0.0001, at + a.buf.duration);
    src.connect(g).connect(a.out);
    src.onended = (): void => {
      src.disconnect();
      g.disconnect();
    };
    src.start(at);
    a.next = at + a.buf.duration - seam;
  }

  /* --------------------------------------------------------- the score */

  setMusic(id: MusicId): void {
    this.wanted = id;
    if (!this.ctx || !this.musicBus || !this.noiseBuf) return;
    if (this.music === id) return;
    this.music = id;
    const track = id ? TRACKS[id] ?? null : null;
    this.wantedTrack = track;
    if (track && this.decks) {
      // (the same piece goes on playing across lands that share it)
      if (this.decks[this.live]!.track === track) this.stopScore();
      else this.playPiece(track, id!);
      return;
    }
    this.fadeOutDecks();
    this.startScore(id);
  }

  /** The procedural score for this song: the last one fades out under it, then lets go. */
  private startScore(id: MusicId): void {
    if (!this.ctx || !this.musicBus || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const old = this.score;
    this.stopScore();
    this.score = id ? new Score(this.ctx, this.musicBus, this.noiseBuf, SONGS[id], t + (old ? 0.5 : 0.1)) : null;
  }

  private stopScore(): void {
    const old = this.score;
    if (!old || !this.ctx) return;
    old.stop(this.ctx.currentTime);
    window.setTimeout(() => old.out.disconnect(), 6000);
    this.score = null;
  }

  private makeDecks(): void {
    const c = this.ctx;
    if (!c || !this.musicBus || this.decks || typeof Audio === 'undefined' || !c.createMediaElementSource) return;
    const deck = (): Deck => {
      const el = new Audio();
      el.preload = 'auto';
      const gain = c.createGain();
      gain.gain.value = 0;
      c.createMediaElementSource(el).connect(gain).connect(this.musicBus!);
      // (still inside the tap that made the sound possible: this is what lets it play later on a phone)
      el.src = SILENCE;
      void el.play().catch(() => undefined);
      return { el, gain, track: null };
    };
    this.decks = [deck(), deck()];
  }

  private piece(track: TrackId): Promise<string> {
    let p = this.pieces.get(track);
    if (!p) {
      p = fetch(`${MUSIC_BASE}${track}.mp3?v=${MUSIC_VERSION}`).then(async (res) => {
        if (!res.ok) throw new Error(track);
        return URL.createObjectURL(await res.blob());
      });
      p.catch(() => this.pieces.delete(track));
      this.pieces.set(track, p);
    }
    return p;
  }

  /** Brings a piece in, crossfading from whatever is playing; if it can't be had, the song's score plays instead. */
  private playPiece(track: TrackId, id: MusicId): void {
    this.piece(track)
      .then((url) => {
        if (this.wantedTrack !== track || !this.decks) return;
        if (this.decks[this.live]!.track === track) return;
        this.swapTo(track, url, CROSSFADE);
        this.stopScore();
      })
      .catch(() => {
        if (this.wantedTrack === track && this.music === id) {
          this.fadeOutDecks();
          this.startScore(id);
        }
      });
  }

  /** Starts a piece on the idle deck and crossfades to it. */
  private swapTo(track: TrackId, url: string, fade: number): void {
    const c = this.ctx;
    if (!c || !this.decks) return;
    const from = this.decks[this.live]!;
    const to = this.decks[1 - this.live]!;
    const t = c.currentTime;
    to.track = track;
    to.el.src = url;
    to.el.currentTime = 0;
    to.gain.gain.cancelScheduledValues(t);
    to.gain.gain.setValueAtTime(0.0001, t);
    to.gain.gain.linearRampToValueAtTime(TRACK_GAIN, t + fade);
    void to.el.play().catch(() => {
      // (refused or broken: the song's score)
      if (this.wantedTrack === track) {
        to.track = null;
        this.startScore(this.music);
      }
    });
    this.fadeOut(from, fade);
    this.live = 1 - this.live;
  }

  private fadeOut(d: Deck, fade: number): void {
    const c = this.ctx;
    if (!c || !d.track) return;
    const t = c.currentTime;
    const was = d.el.src;
    d.gain.gain.cancelScheduledValues(t);
    d.gain.gain.setValueAtTime(Math.max(0.0001, d.gain.gain.value), t);
    d.gain.gain.linearRampToValueAtTime(0.0001, t + fade);
    d.track = null;
    // (once it has gone quiet, unless it has been given something new since)
    window.setTimeout(() => {
      if (!d.track && d.el.src === was) d.el.pause();
    }, fade * 1000 + 100);
  }

  private fadeOutDecks(): void {
    for (const d of this.decks ?? []) this.fadeOut(d, CROSSFADE);
  }

  private schedule(): void {
    const c = this.ctx;
    if (!c || this.suspended) return;
    this.score?.schedule(c.currentTime + 0.4);
    this.airPass();
    // a piece coming to its end overlaps its own beginning, so it goes round without a gap
    const d = this.decks?.[this.live];
    if (!d?.track || !Number.isFinite(d.el.duration)) return;
    // (stopped by the phone rather than by the game, a call or the app put away: back on when it can be)
    if (d.el.paused && performance.now() - this.retried > 1000) {
      this.retried = performance.now();
      void d.el.play().catch(() => undefined);
    }
    const seam = SEAM[d.track];
    if (d.el.duration - d.el.currentTime <= seam) this.swapTo(d.track, d.el.src, seam);
  }

  dispose(): void {
    window.clearInterval(this.timer);
    for (const d of this.decks ?? []) {
      d.el.pause();
      d.el.removeAttribute('src');
    }
    this.decks = null;
    for (const p of this.pieces.values()) void p.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
    this.pieces.clear();
    this.amb = null;
    this.airs.clear();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
