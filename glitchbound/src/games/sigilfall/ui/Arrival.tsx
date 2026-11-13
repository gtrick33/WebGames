import { useEffect, useRef, useState } from 'react';
import { itemPicture } from '../../../components/SigilPicture';
import { TitleFx } from '../../../components/TitleFx';
import { arrivalInfo, type ArrivalInfo } from '../../../platform/arrivalItems';
import { claimArrivals, markShown, pendingArrivals, subscribeArrivals, type Arrival } from '../../../platform/arrivals';
import { useLiveCatalog } from '../../../platform/liveCatalog';
import type { SigilEngine } from '../engine';
import { uiIcon } from './uiIcons';
import './Arrival.css';

/** How long the card stays, unless the pointer or the keys are on it. */
const STAY_MS = 8000;
/** Where it waits: a fight in the Ring or a night of the Vigil, and a screen still behind its veil. */
const BUSY = '.rb-ring-stage, .rb-vigil-world, .rb-veil, .rb-warm';
/** Back in the tab, or something arrived from the account: a Game Master's orders are looked for, unless they just were. */
const GM_AGAIN_MS = 15_000;

/**
 * Something the player received, said in the game as it arrives (platform/arrivals.ts): a mount, a Wardrobe look or the
 * Gloamknight Pack bought in the shop or given by the team, a title an admin gave, a Game Master's gift. A small card
 * at the top, wherever the player is (the title, the world, the Ring's and the Vigil's halls), never over a fight in
 * the Ring or the Vigil: it waits for the fight to end. It never takes the keys, and goes by itself. While the game is
 * open the site's own card leaves Sigilfall's things to this one.
 */
export function ArrivalCard({ engine }: { engine: SigilEngine }) {
  const slot = useRef<HTMLDivElement>(null);
  const items = useLiveCatalog().raw.shopItems;
  useEffect(() => claimArrivals('sigilfall'), []);

  // what arrives from the account (a gift from the team, a title) often comes with a Game Master's orders: they are
  // looked for at once, and when the player comes back to the tab, rather than at the game's next minute
  useEffect(() => {
    let at = Date.now();
    let seen = '';
    const look = (): void => {
      const fromAccount = pendingArrivals().find((a) => a.game === 'sigilfall' && a.kind !== 'gm')?.key ?? '';
      const fresh = fromAccount !== '' && fromAccount !== seen;
      seen = fromAccount || seen;
      if (document.hidden || (!fresh && Date.now() - at < GM_AGAIN_MS)) return;
      at = Date.now();
      void engine.checkGm();
    };
    const stop = subscribeArrivals(look);
    document.addEventListener('visibilitychange', look);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', look);
    };
  }, [engine]);

  const [current, setCurrent] = useState<{ a: Arrival; info: ArrivalInfo } | null>(null);
  const showing = !!current;
  // (one at a time, however often the effect below runs before the card is drawn)
  const onScreen = useRef(false);
  // the next one, once it can be seen: the tab in view, no fight on, nothing still loading
  useEffect(() => {
    if (showing) return;
    const take = (): void => {
      if (onScreen.current || document.hidden) return;
      if (!pendingArrivals().some((a) => a.game === 'sigilfall')) return;
      const stage = slot.current?.parentElement;
      if (!stage || stage.querySelector(BUSY)) return;
      onScreen.current = true;
      for (;;) {
        const next = pendingArrivals().find((a) => a.game === 'sigilfall');
        if (!next) break;
        markShown(next.key);
        const info = arrivalInfo(next, items, 'game');
        if (info) {
          setCurrent({ a: next, info });
          // (as the game's own new mounts and titles sound)
          engine.sound.play('epic');
          return;
        }
      }
      onScreen.current = false;
    };
    take();
    const stop = subscribeArrivals(take);
    const t = window.setInterval(take, 1000);
    document.addEventListener('visibilitychange', take);
    return () => {
      stop();
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', take);
    };
  }, [showing, items, engine]);

  const [still, setStill] = useState(false);
  useEffect(() => {
    if (!current || still) return;
    const t = window.setTimeout(() => {
      onScreen.current = false;
      setCurrent(null);
    }, STAY_MS);
    return () => window.clearTimeout(t);
  }, [current, still]);
  const close = (): void => {
    setStill(false);
    onScreen.current = false;
    setCurrent(null);
  };

  return (
    <div className="rb-arrival-slot" ref={slot}>
      {current && (
        <div
          key={current.a.key}
          className={`rb-arrival is-${current.info.sort}`}
          role="status"
          aria-atomic="true"
          onPointerEnter={() => setStill(true)}
          onPointerLeave={() => setStill(false)}
          onFocus={() => setStill(true)}
          onBlur={() => setStill(false)}
        >
          <Art a={current.a} info={current.info} />
          <div className="rb-arrival-words">
            <span className="rb-arrival-head">{current.info.head}</span>
            <strong className="rb-arrival-name">{current.a.kind === 'title' ? <TitleFx fx={current.a.fx}>{current.info.name}</TitleFx> : current.info.name}</strong>
            <span className="rb-arrival-line">{current.info.line}</span>
            {current.info.where && <span className="rb-arrival-where">{current.info.where}</span>}
          </div>
          <button type="button" className="rb-x is-small rb-arrival-x" onClick={close} aria-label="Close">
            ✕
          </button>
          {!still && <i className="rb-arrival-time" style={{ animationDuration: `${STAY_MS}ms` }} aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}

/** Its picture from the shop, or the game's own sign for it. */
function Art({ a, info }: { a: Arrival; info: ArrivalInfo }) {
  const pic = info.product ? itemPicture(info.product) : null;
  if (pic) {
    return (
      <span className="rb-arrival-art is-pic">
        <img src={pic} alt="" draggable={false} />
      </span>
    );
  }
  const sign = info.sort === 'mount' || info.sort === 'gm-mount' ? 'horseshoe' : info.sort === 'gm-item' ? 'bag' : a.kind === 'item' ? 'store' : 'star';
  let src = '';
  try {
    src = uiIcon(sign, 4);
  } catch {
    /* no canvas to paint it with: the card goes without its sign */
  }
  return (
    <span className="rb-arrival-art" aria-hidden="true">
      {src && <img src={src} alt="" draggable={false} />}
    </span>
  );
}
