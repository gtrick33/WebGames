import { useEffect, useState } from 'react';
import { formatCountdown, msUntilMidnight } from '../platform/dates';

/**
 * "Next daily in 07:12:45", ticking each second. Games show it once today's daily is used up:
 * every game's daily is one try a day.
 */
export function NextDaily({ className }: { className?: string }) {
  const [ms, setMs] = useState(() => msUntilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilMidnight()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className={className}>
      Next daily in <b style={{ fontFamily: 'var(--mono)' }}>{formatCountdown(ms)}</b>
    </span>
  );
}
