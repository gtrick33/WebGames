import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { shareRequests } from '../platform/share';
import { fresh } from '../platform/freshBuild';

const ShareSheet = lazy(fresh(() => import('./ShareSheet')));

/**
 * Mounted once by the app: shows the share sheet when anything asks to share. It renders into the
 * full-screen element when a game is full screen (anything outside it would be invisible).
 */
export function ShareHost() {
  const req = useSyncExternalStore(shareRequests.subscribe, shareRequests.get, shareRequests.get);
  useEffect(() => shareRequests.attach(), []);
  if (!req) return null;
  return createPortal(
    <Suspense fallback={null}>
      <ShareSheet key={req.data.text} data={req.data} />
    </Suspense>,
    document.fullscreenElement ?? document.body,
  );
}
