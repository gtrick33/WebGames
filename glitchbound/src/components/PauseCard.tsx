import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { trapTab, useFocusReturn } from './focusTrap';
import './PauseCard.css';

/**
 * One "Paused" card every game can reuse (over its own frame, like the Coach): a title, an optional
 * line (what is kept, "Your clock is stopped"), Resume, and any extra buttons the game passes (Restart,
 * Menu) as `children`. Resume takes the focus, so Enter or Space picks the game up again; Escape
 * resumes too, and Tab stays on the card. The game passes its texts in its own language. Set
 * `--pause-accent` on a parent to give the Resume button the game's color.
 */
export function PauseCard({ onResume, title = 'Paused', line, resume = 'Resume', children }: { onResume: () => void; title?: string; line?: string; resume?: string; children?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useFocusReturn();
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' && e.key !== 'Tab') return;
    // the game behind hears neither
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onResume();
    } else trapTab(e, box.current);
  };
  return (
    <div ref={box} className="pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-card-title" onKeyDown={onKey}>
      <div className="pause-card-box">
        <span className="pause-card-icon" aria-hidden="true">
          <i />
          <i />
        </span>
        <h2 id="pause-card-title">{title}</h2>
        {line && <p className="pause-card-line">{line}</p>}
        <div className="pause-card-row">
          <button type="button" className="pause-card-btn pause-card-go" onClick={onResume} autoFocus>
            {resume}
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
