import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useAdFree } from '../platform/adFree';
import { prepareRewarded } from '../platform/rewarded';
import { Icon } from './Icon';

/**
 * After a daily: one more try, for a short ad the player chooses to watch. Nothing shows unless Google has an ad ready,
 * and the ad only plays from this button. Someone with the ad-free purchase gets the try without the ad.
 */
export function AdRetry({ name, onRetry }: { name: string; onRetry: () => void }) {
  const t = useT();
  const adFree = useAdFree();
  const [show, setShow] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (adFree) return;
    prepareRewarded(name, {
      onReady: (fn) => setShow(() => fn),
      onReward: onRetry,
      onDone: () => setShow(null),
    });
    // (one offer per finished round)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, adFree]);

  if (!adFree && !show) return null;
  return (
    <div className="ad-retry">
      <button className="btn btn-sm" onClick={adFree ? onRetry : (show ?? undefined)}>
        <Icon name="restart" size={18} /> {adFree ? t('One more try') : t('Watch a short ad for one more try')}
      </button>
      <p className="side-muted">{t('This extra try doesn’t count for the boards.')}</p>
    </div>
  );
}
