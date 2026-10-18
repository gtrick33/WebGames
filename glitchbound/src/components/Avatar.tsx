import { useState } from 'react';
import './Avatar.css';

/** A member's picture, or their initial when there is none (or it fails to load). */
export function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {src && !failed ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initial}
    </span>
  );
}
