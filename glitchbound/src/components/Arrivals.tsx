import { useEffect, useRef, useState } from 'react';
import { useAccount } from '../platform/account';
import { arrivalInfo, type ArrivalInfo } from '../platform/arrivalItems';
import { arrivalsClaimed, markShown, pendingArrivals, subscribeArrivals, type Arrival } from '../platform/arrivals';
import { useLiveCatalog } from '../platform/liveCatalog';
import { Link, matchRoute, useLocation } from '../router/router';
import { Burst } from './Burst';
import { Icon } from './Icon';
import { BannerArt, FramedAvatar } from './Looks';
import { itemPicture } from './SigilPicture';
import { TitleFx } from './TitleFx';
import './Arrivals.css';

/** How long a card stays, unless the pointer or the keys are on it. */
const STAY_MS = 9000;

/** Not now: the tab is hidden, or a game fills the screen (its full screen would hide the card anyway). */
const held = (): boolean => document.hidden || document.documentElement.classList.contains('game-focus');

/**
 * "It's yours!": a small card for something a member receives while the site is open (platform/arrivals.ts), a
 * purchase or a gift, once and on its own: it never takes the focus, goes by itself after a few seconds, and waits
 * while a game fills the screen. Sigilfall's things are left to the game's own card while it is open, and on its page
 * (coming back from a checkout the game sent the buyer to, the game is still loading when the item arrives).
 */
export function Arrivals() {
  const items = useLiveCatalog().raw.shopItems;
  const route = matchRoute(useLocation().pathname);
  const page = route.name === 'section' || route.name === 'game' ? route.slug : null;
  const [current, setCurrent] = useState<{ a: Arrival; info: ArrivalInfo } | null>(null);
  const showing = !!current;
  // (one at a time, however often the effect below runs before the card is drawn)
  const onScreen = useRef(false);
  // the next one, as soon as it can be seen
  useEffect(() => {
    if (showing) return;
    const take = (): void => {
      if (onScreen.current || held()) return;
      onScreen.current = true;
      for (;;) {
        const next = pendingArrivals().find((a) => !a.game || (!arrivalsClaimed(a.game) && a.game !== page));
        if (!next) break;
        // (shown now: never again, here or in another tab)
        markShown(next.key);
        const info = arrivalInfo(next, items, 'site');
        if (info) {
          setCurrent({ a: next, info });
          return;
        }
      }
      onScreen.current = false;
    };
    take();
    const stop = subscribeArrivals(take);
    document.addEventListener('visibilitychange', take);
    const watch = new MutationObserver(take);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      stop();
      document.removeEventListener('visibilitychange', take);
      watch.disconnect();
    };
  }, [showing, page, items]);
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (!current || still) return;
    const t = window.setTimeout(() => {
      onScreen.current = false;
      setCurrent(null);
    }, STAY_MS);
    return () => window.clearTimeout(t);
  }, [current, still]);
  if (!current) return null;
  const { a, info } = current;
  const close = (): void => {
    setStill(false);
    onScreen.current = false;
    setCurrent(null);
  };
  const to = info.sort === 'border' || info.sort === 'banner' || info.sort === 'icon' ? '/me#looks' : a.game === 'sigilfall' ? '/sigilfall?play=1' : null;
  return (
    <aside
      key={a.key}
      className={`arrival is-${info.sort}`}
      role="status"
      aria-atomic="true"
      onPointerEnter={() => setStill(true)}
      onPointerLeave={() => setStill(false)}
      onFocus={() => setStill(true)}
      onBlur={() => setStill(false)}
    >
      <Art a={a} info={info} />
      <div className="arrival-words">
        <p className="arrival-head">{info.head}</p>
        {a.kind === 'title' ? (
          <p className="arrival-name arrival-title">
            <TitleFx fx={a.fx}>{info.name}</TitleFx>
          </p>
        ) : (
          <p className="arrival-name">{info.name}</p>
        )}
        <p className="arrival-line">{info.line}</p>
        {info.where && (
          <p className="arrival-where">
            {to ? (
              <Link href={to} onClick={close}>
                {info.where}
              </Link>
            ) : (
              info.where
            )}
          </p>
        )}
      </div>
      <button type="button" className="arrival-close" onClick={close} aria-label="Close">
        <Icon name="close" size={16} />
      </button>
      {/* (how long it stays: held while the pointer or the keys are on it, from the start again once they leave) */}
      {!still && <i className="arrival-time" style={{ animationDuration: `${STAY_MS}ms` }} aria-hidden="true" />}
      <Burst />
    </aside>
  );
}

/** The thing as it looks: its picture, the look on the member's own picture, or a sign for it. */
function Art({ a, info }: { a: Arrival; info: ArrivalInfo }) {
  const { me } = useAccount();
  const p = info.product;
  if (p?.look?.kind === 'banner') return <BannerArt spec={p.look} className="arrival-art arrival-banner" />;
  if (p?.look) {
    return (
      <span className="arrival-art arrival-face">
        <FramedAvatar name={me?.nickname ?? 'GlitchBound'} src={me?.avatar} size={60} border={p.look.kind === 'border' ? p.look : undefined} icon={p.look.kind === 'icon' ? p.look : undefined} />
      </span>
    );
  }
  const pic = p ? itemPicture(p) : null;
  if (pic) {
    return (
      <span className="arrival-art arrival-pic">
        <img src={pic} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className={`arrival-art arrival-sign${a.game === 'sigilfall' ? ' is-sigil' : ''}`} aria-hidden="true">
      <Icon name={a.kind === 'title' ? 'crown' : info.sort === 'ad-free' ? 'heart' : 'star'} size={30} />
    </span>
  );
}
