import { useEffect, useRef, useState } from 'react';
import { music, useMusic } from '../platform/music';
import './MusicControl.css';

/** Floating lobby-music control: tap to mute/unmute, open to change the volume. */
export function MusicControl() {
  const m = useMusic();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => music.init(), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const label = !m.on ? 'Music off' : m.playing ? 'Music on' : m.waiting ? 'Music starts on your first click' : 'Music paused';
  return (
    <div className={`music${open ? ' is-open' : ''}`} ref={ref}>
      <button
        className={`music-btn${m.playing ? ' is-playing' : ''}${!m.on ? ' is-off' : ''}`}
        onClick={() => music.toggle()}
        aria-pressed={m.on}
        aria-label={m.on ? 'Mute music' : 'Play music'}
        title={label}
      >
        {m.on ? (
          <span className="eq" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM3 3l18 18" />
          </svg>
        )}
      </button>
      <button className="music-more" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Music volume">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
        </svg>
      </button>
      {open && (
        <div className="music-pop panel">
          <p className="mono">Lobby music</p>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(m.volume * 100)}
            onChange={(e) => music.setVolume(Number(e.target.value) / 100)}
            aria-label="Music volume"
          />
          <p className="music-note">{label}. It pauses while you play a game.</p>
        </div>
      )}
    </div>
  );
}
