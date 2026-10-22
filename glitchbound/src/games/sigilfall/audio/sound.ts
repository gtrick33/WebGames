/**
 * Sigilfall's sound: synthesized effects (no audio files) and a small procedural score per region,
 * with a boss theme. The AudioContext is created on the first tap or key (browsers block sound before
 * that), effects are rate-limited so a big fight never turns into noise, and everything follows the
 * master / music / effects volumes and the mute switch.
 */

export type MusicId = 'village' | 'forest' | 'crypt' | 'boss' | 'title' | null;

interface Voice {
  f: number;
  to?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  at?: number;
}

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** Effects: a few tones and noise bursts each. */
const SFX: Record<string, (s: Sound) => void> = {
  bolt: (s) => s.tones([{ f: 740, to: 420, dur: 0.09, gain: 0.05, type: 'triangle' }]),
  fireball: (s) => (s.noise(0.18, 0.06, 900, 'lowpass'), s.tones([{ f: 220, to: 110, dur: 0.18, gain: 0.05, type: 'sawtooth' }])),
  bow: (s) => (s.noise(0.06, 0.05, 3000, 'highpass'), s.tones([{ f: 300, to: 180, dur: 0.06, gain: 0.04, type: 'triangle' }])),
  zap: (s) => s.tones([{ f: 1400, to: 300, dur: 0.12, gain: 0.04, type: 'square' }, { f: 900, to: 1600, dur: 0.08, gain: 0.03, type: 'sawtooth', at: 0.03 }]),
  thunder: (s) => (s.noise(0.25, 0.09, 600, 'lowpass'), s.tones([{ f: 120, to: 50, dur: 0.25, gain: 0.06, type: 'sawtooth' }])),
  nova: (s) => (s.noise(0.3, 0.05, 2500, 'bandpass'), s.tones([{ f: 1200, to: 2400, dur: 0.25, gain: 0.03, type: 'sine' }])),
  freeze: (s) => s.tones([{ f: 2200, to: 1800, dur: 0.12, gain: 0.025, type: 'sine' }]),
  blink: (s) => s.tones([{ f: 400, to: 1600, dur: 0.12, gain: 0.04, type: 'sine' }, { f: 800, to: 2400, dur: 0.1, gain: 0.02, type: 'triangle', at: 0.04 }]),
  meteorCall: (s) => s.tones([{ f: 300, to: 900, dur: 0.6, gain: 0.03, type: 'sawtooth' }]),
  meteor: (s) => (s.noise(0.5, 0.14, 500, 'lowpass'), s.tones([{ f: 90, to: 35, dur: 0.45, gain: 0.1, type: 'sine' }])),
  explode: (s) => (s.noise(0.28, 0.08, 800, 'lowpass'), s.tones([{ f: 140, to: 50, dur: 0.22, gain: 0.06, type: 'sine' }])),
  swing: (s) => s.noise(0.08, 0.05, 2200, 'bandpass'),
  swingBig: (s) => (s.noise(0.12, 0.07, 1500, 'bandpass'), s.tones([{ f: 200, to: 120, dur: 0.1, gain: 0.03, type: 'triangle' }])),
  heavy: (s) => (s.noise(0.2, 0.09, 600, 'lowpass'), s.tones([{ f: 110, to: 55, dur: 0.2, gain: 0.08, type: 'square' }])),
  windup: (s) => s.tones([{ f: 200, to: 400, dur: 0.16, gain: 0.025, type: 'triangle' }]),
  whirl: (s) => s.noise(0.5, 0.05, 1800, 'bandpass'),
  dash: (s) => s.noise(0.15, 0.06, 1200, 'bandpass'),
  dodge: (s) => s.noise(0.12, 0.05, 2600, 'highpass'),
  quake: (s) => (s.noise(0.6, 0.12, 300, 'lowpass'), s.tones([{ f: 70, to: 40, dur: 0.6, gain: 0.08, type: 'sine' }])),
  volley: (s) => s.noise(0.3, 0.05, 3500, 'highpass'),
  arrowRain: (s) => s.noise(0.05, 0.02, 4000, 'highpass'),
  trapSet: (s) => s.tones([{ f: 600, dur: 0.04, gain: 0.04, type: 'square' }, { f: 900, dur: 0.04, gain: 0.03, type: 'square', at: 0.05 }]),
  trapSpring: (s) => (s.noise(0.2, 0.07, 1200, 'lowpass'), s.tones([{ f: 500, to: 200, dur: 0.15, gain: 0.04, type: 'square' }])),
  mark: (s) => s.tones([{ f: 1000, dur: 0.06, gain: 0.03, type: 'triangle' }, { f: 1500, dur: 0.08, gain: 0.03, type: 'triangle', at: 0.06 }]),
  hit: (s) => s.tones([{ f: 260, to: 140, dur: 0.05, gain: 0.04, type: 'square' }]),
  crit: (s) => (s.tones([{ f: 520, to: 260, dur: 0.07, gain: 0.05, type: 'square' }]), s.noise(0.06, 0.04, 3000, 'highpass')),
  die: (s) => s.tones([{ f: 300, to: 80, dur: 0.18, gain: 0.04, type: 'triangle' }]),
  hurt: (s) => (s.tones([{ f: 180, to: 90, dur: 0.15, gain: 0.07, type: 'sawtooth' }]), s.noise(0.08, 0.05, 1000, 'lowpass')),
  shield: (s) => s.tones([{ f: 600, to: 900, dur: 0.15, gain: 0.03, type: 'sine' }]),
  shieldBreak: (s) => s.noise(0.15, 0.05, 2500, 'highpass'),
  potion: (s) => s.tones([0, 1, 2].map((i) => ({ f: hz(72 + i * 4), dur: 0.1, gain: 0.03, type: 'sine' as OscillatorType, at: i * 0.06 }))),
  orb: (s) => s.tones([{ f: 880, to: 1320, dur: 0.1, gain: 0.03, type: 'sine' }]),
  coin: (s) => s.tones([{ f: 1320, dur: 0.05, gain: 0.025, type: 'square' }, { f: 1760, dur: 0.07, gain: 0.02, type: 'square', at: 0.05 }]),
  pickup: (s) => s.tones([{ f: 660, dur: 0.06, gain: 0.03, type: 'triangle' }, { f: 990, dur: 0.08, gain: 0.03, type: 'triangle', at: 0.06 }]),
  pickupBig: (s) => s.tones([0, 4, 7, 12].map((n, i) => ({ f: hz(72 + n), dur: 0.14, gain: 0.035, type: 'triangle' as OscillatorType, at: i * 0.07 }))),
  epic: (s) => s.tones([0, 3, 7, 10].map((n, i) => ({ f: hz(67 + n), dur: 0.2, gain: 0.03, type: 'sine' as OscillatorType, at: i * 0.08 }))),
  legendary: (s) => s.tones([0, 4, 7, 12, 16].map((n, i) => ({ f: hz(64 + n), dur: 0.35, gain: 0.04, type: 'triangle' as OscillatorType, at: i * 0.1 }))),
  shard: (s) => s.tones([{ f: 1500, to: 2200, dur: 0.15, gain: 0.03, type: 'sine' }, { f: 750, dur: 0.2, gain: 0.02, type: 'square', at: 0.05 }]),
  chest: (s) => (s.noise(0.12, 0.04, 800, 'lowpass'), s.tones([0, 4, 7].map((n, i) => ({ f: hz(69 + n), dur: 0.12, gain: 0.03, type: 'square' as OscillatorType, at: 0.1 + i * 0.07 })))),
  levelup: (s) => s.tones([0, 4, 7, 12, 7, 12, 16].map((n, i) => ({ f: hz(67 + n), dur: 0.16, gain: 0.04, type: 'square' as OscillatorType, at: i * 0.08 }))),
  reset: (s) => s.tones([{ f: 900, to: 1800, dur: 0.1, gain: 0.03, type: 'sine' }]),
  rift: (s) => (s.noise(0.3, 0.07, 1500, 'bandpass'), s.tones([{ f: 300, to: 900, dur: 0.25, gain: 0.03, type: 'sawtooth' }])),
  crumble: (s) => s.noise(0.5, 0.1, 400, 'lowpass'),
  discover: (s) => s.tones([0, 7, 12, 19].map((n, i) => ({ f: hz(72 + n), dur: 0.3, gain: 0.03, type: 'sine' as OscillatorType, at: i * 0.12 }))),
  doorSlam: (s) => (s.noise(0.25, 0.1, 300, 'lowpass'), s.tones([{ f: 80, to: 50, dur: 0.2, gain: 0.07, type: 'square' }])),
  doorOpen: (s) => s.tones([{ f: 200, to: 400, dur: 0.3, gain: 0.03, type: 'triangle' }]),
  summon: (s) => s.tones([{ f: 150, to: 600, dur: 0.4, gain: 0.03, type: 'sawtooth' }]),
  roar: (s) => (s.noise(0.7, 0.12, 400, 'lowpass'), s.tones([{ f: 110, to: 70, dur: 0.7, gain: 0.08, type: 'sawtooth' }])),
  slam: (s) => (s.noise(0.3, 0.12, 300, 'lowpass'), s.tones([{ f: 70, to: 40, dur: 0.3, gain: 0.09, type: 'sine' }])),
  snort: (s) => s.noise(0.15, 0.05, 600, 'bandpass'),
  rush: (s) => s.noise(0.25, 0.06, 500, 'lowpass'),
  spear: (s) => s.noise(0.1, 0.05, 2000, 'highpass'),
  soul: (s) => s.tones([{ f: 500, to: 300, dur: 0.25, gain: 0.03, type: 'triangle' }]),
  riftShot: (s) => s.tones([{ f: 700, to: 500, dur: 0.06, gain: 0.02, type: 'square' }]),
  beamCharge: (s) => s.tones([{ f: 200, to: 800, dur: 1, gain: 0.025, type: 'sawtooth' }]),
  beam: (s) => (s.noise(0.4, 0.09, 1200, 'bandpass'), s.tones([{ f: 400, to: 100, dur: 0.4, gain: 0.05, type: 'sawtooth' }])),
  bossDie: (s) => (s.noise(1.2, 0.12, 500, 'lowpass'), s.tones([{ f: 300, to: 40, dur: 1.2, gain: 0.07, type: 'sawtooth' }])),
  victory: (s) => s.tones([0, 4, 7, 12, 16, 19, 24].map((n, i) => ({ f: hz(60 + n), dur: 0.3, gain: 0.04, type: 'triangle' as OscillatorType, at: i * 0.11 }))),
  playerDie: (s) => s.tones([12, 7, 3, 0].map((n, i) => ({ f: hz(57 + n), dur: 0.3, gain: 0.04, type: 'triangle' as OscillatorType, at: i * 0.18 }))),
  enemyWindup: (s) => s.tones([{ f: 300, to: 380, dur: 0.12, gain: 0.015, type: 'square' }]),
  enemySwing: (s) => s.noise(0.08, 0.04, 1500, 'bandpass'),
  enemyBow: (s) => s.noise(0.05, 0.03, 2500, 'highpass'),
  sling: (s) => s.tones([{ f: 500, to: 250, dur: 0.06, gain: 0.025, type: 'triangle' }]),
  squish: (s) => s.tones([{ f: 180, to: 300, dur: 0.08, gain: 0.03, type: 'sine' }]),
  puff: (s) => s.noise(0.3, 0.05, 900, 'lowpass'),
  click: (s) => s.tones([{ f: 900, dur: 0.03, gain: 0.025, type: 'square' }]),
  equip: (s) => (s.noise(0.08, 0.04, 2000, 'bandpass'), s.tones([{ f: 440, to: 660, dur: 0.1, gain: 0.03, type: 'triangle', at: 0.04 }])),
  open: (s) => s.tones([{ f: 520, dur: 0.05, gain: 0.025, type: 'triangle' }, { f: 780, dur: 0.06, gain: 0.02, type: 'triangle', at: 0.04 }]),
  close: (s) => s.tones([{ f: 780, dur: 0.05, gain: 0.02, type: 'triangle' }, { f: 520, dur: 0.06, gain: 0.02, type: 'triangle', at: 0.04 }]),
  talent: (s) => s.tones([0, 7, 12].map((n, i) => ({ f: hz(76 + n), dur: 0.12, gain: 0.03, type: 'sine' as OscillatorType, at: i * 0.05 }))),
  checkpoint: (s) => s.tones([{ f: hz(79), dur: 0.2, gain: 0.03, type: 'sine' }, { f: hz(86), dur: 0.3, gain: 0.03, type: 'sine', at: 0.12 }]),
};

/* -------------------------------------------------------------- music */

interface Song {
  bpm: number;
  /** Bass notes per bar (MIDI). */
  bass: number[];
  /** Chord tones per bar for the arpeggio. */
  chords: number[][];
  /** Melody: per eighth note, scale index into `scale` or null. */
  melody: (number | null)[];
  scale: number[];
  lead: OscillatorType;
  drums: boolean;
  /** Pad gain (dark songs lean on it). */
  pad: number;
}

const SONGS: Record<Exclude<MusicId, null>, Song> = {
  title: { bpm: 84, bass: [45, 41, 43, 40], chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], melody: [4, null, 3, null, 2, null, 0, null, 1, null, 2, 3, 2, null, null, null], scale: [69, 71, 72, 74, 76, 79, 81], lead: 'triangle', drums: false, pad: 0.6 },
  village: {
    bpm: 100,
    bass: [48, 43, 45, 41],
    chords: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]],
    melody: [0, 2, 4, null, 5, 4, 2, null, 3, null, 2, 0, 1, null, null, null, 4, null, 5, 4, 2, null, 0, 1, 2, null, 1, null, 0, null, null, null],
    scale: [72, 74, 76, 77, 79, 81, 84],
    lead: 'square',
    drums: true,
    pad: 0.3,
  },
  forest: {
    bpm: 112,
    bass: [45, 45, 41, 43],
    chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    melody: [4, null, 2, 4, 5, null, 4, 2, 3, null, null, 1, 2, null, 0, null, 4, null, 2, 4, 6, null, 5, 4, 3, 2, 1, null, 0, null, null, null],
    scale: [69, 71, 72, 74, 76, 77, 79],
    lead: 'triangle',
    drums: true,
    pad: 0.35,
  },
  crypt: {
    bpm: 92,
    bass: [40, 40, 41, 39],
    chords: [[52, 55, 59], [52, 55, 58], [53, 56, 60], [51, 55, 58]],
    melody: [0, null, null, 1, 0, null, null, null, 2, null, 1, null, 0, null, null, null, 3, null, 2, null, 1, null, 0, null, 1, null, null, null, null, null, null, null],
    scale: [64, 65, 67, 68, 71, 72],
    lead: 'sine',
    drums: false,
    pad: 0.75,
  },
  boss: {
    bpm: 148,
    bass: [40, 40, 43, 38],
    chords: [[52, 55, 59], [52, 55, 59], [55, 58, 62], [50, 53, 57]],
    melody: [0, 0, 3, 0, 4, 3, 0, null, 0, 0, 5, 4, 3, null, 2, null, 0, 0, 3, 0, 4, 3, 5, null, 6, 5, 4, 3, 2, null, 1, null],
    scale: [64, 66, 67, 69, 71, 72, 74],
    lead: 'sawtooth',
    drums: true,
    pad: 0.25,
  },
};

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private last = new Map<string, number>();
  private music: MusicId = null;
  private wanted: MusicId = null;
  private nextBar = 0;
  private bar = 0;
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
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, len);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.timer = window.setInterval(() => this.schedule(), 90);
    }
    if (this.ctx.state === 'suspended' && !this.suspended) void this.ctx.resume().catch(() => undefined);
    if (this.wanted !== this.music) this.setMusic(this.wanted);
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
  }

  /** Pauses all sound (game paused, tab hidden). */
  suspend(on: boolean): void {
    this.suspended = on;
    if (!this.ctx) return;
    if (on) void this.ctx.suspend().catch(() => undefined);
    else void this.ctx.resume().catch(() => undefined);
  }

  play(id: string, vol = 1): void {
    if (!this.ctx || this.volumes.muted || this.suspended) return;
    const now = this.ctx.currentTime;
    // the same sound at most every 45 ms (hits in a crowd)
    const prev = this.last.get(id) ?? -1;
    if (now - prev < 0.045) return;
    this.last.set(id, now);
    this.volScale = vol;
    SFX[id]?.(this);
    this.volScale = 1;
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
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v.gain * this.volScale), t + 0.008);
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

  /* --------------------------------------------------------- the score */

  setMusic(id: MusicId): void {
    this.wanted = id;
    if (!this.ctx) return;
    if (this.music === id) return;
    this.music = id;
    this.bar = 0;
    this.nextBar = this.ctx.currentTime + 0.15;
  }

  private schedule(): void {
    const c = this.ctx;
    if (!c || !this.musicBus || !this.music || this.suspended) return;
    const song = SONGS[this.music];
    const beat = 60 / song.bpm;
    const barLen = beat * 4;
    while (this.nextBar < c.currentTime + 0.4) {
      this.playBar(song, this.nextBar, beat);
      this.nextBar += barLen;
      this.bar += 1;
    }
  }

  private note(f: number, t: number, dur: number, gain: number, type: OscillatorType): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private playBar(song: Song, t: number, beat: number): void {
    const i = this.bar % song.bass.length;
    const bass = song.bass[i]!;
    const chord = song.chords[i]!;
    // bass on the beats
    for (let b = 0; b < 4; b++) this.note(hz(bass - 12), t + b * beat, beat * 0.9, 0.05, 'triangle');
    // pad
    if (song.pad > 0) for (const n of chord) this.note(hz(n), t, beat * 3.9, 0.012 * song.pad, 'sine');
    // arpeggio on eighths
    for (let e = 0; e < 8; e++) this.note(hz(chord[e % chord.length]! + (e >= 4 ? 12 : 0)), t + e * beat * 0.5, beat * 0.45, 0.014, 'square');
    // melody: 8 eighths per bar, cycling through the phrase
    const phraseBars = Math.ceil(song.melody.length / 8);
    const start = (this.bar % phraseBars) * 8;
    for (let e = 0; e < 8; e++) {
      const m = song.melody[start + e];
      if (m === null || m === undefined) continue;
      this.note(hz(song.scale[m % song.scale.length]!), t + e * beat * 0.5, beat * 0.48, 0.022, song.lead);
    }
    // drums
    if (song.drums && this.noiseBuf) {
      for (let b = 0; b < 4; b++) {
        const tt = t + b * beat;
        // kick
        const o = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        o.frequency.setValueAtTime(140, tt);
        o.frequency.exponentialRampToValueAtTime(45, tt + 0.12);
        g.gain.setValueAtTime(b % 2 === 0 ? 0.08 : 0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.14);
        o.connect(g).connect(this.musicBus!);
        o.start(tt);
        o.stop(tt + 0.16);
        // hat / snare
        const src = this.ctx!.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = this.ctx!.createBiquadFilter();
        f.type = b % 2 ? 'bandpass' : 'highpass';
        f.frequency.value = b % 2 ? 1800 : 7000;
        const ng = this.ctx!.createGain();
        ng.gain.setValueAtTime(b % 2 ? 0.03 : 0.012, tt);
        ng.gain.exponentialRampToValueAtTime(0.0001, tt + (b % 2 ? 0.12 : 0.04));
        src.connect(f).connect(ng).connect(this.musicBus!);
        src.start(tt, Math.random() * 0.5);
        src.stop(tt + 0.15);
      }
    }
  }

  dispose(): void {
    window.clearInterval(this.timer);
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
