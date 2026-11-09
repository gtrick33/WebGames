import { Suspense, lazy, useEffect, useState } from 'react';
import { LEAVER_K, liveGoing, readLive, type LiveMatch } from '../arena/live';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { priceText, productIn, PRODUCTS } from '../../../catalog/shop';
import { useAccount } from '../../../platform/account';
import { useLiveCatalog } from '../../../platform/liveCatalog';
import { classOpen, PAID_CLASSES } from '../progress/paidClasses';
import { CLASS_IDS, CLASSES } from '../data/classes';
import { SKILLS } from '../data/skills';
import { SPEC_LEVEL } from '../data/talents';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { cleanName, HAIRS, SKINS, type Body, type Face } from '../progress/character';
import { heldWeapon, heroDollUrl, heroLook } from '../render/sprites';
import { CharacterSelect } from './CharacterSelect';
import { SkillIcon } from './common';
import { RiftScreen } from './RiftScreen';
import { ScreenGate } from './ScreenGate';
import { SettingsPanel } from './Panels';

const VigilScreen = lazy(() => import('./VigilScreen').then((m) => ({ default: m.VigilScreen })));
const RingScreen = lazy(() => import('./RingScreen').then((m) => ({ default: m.RingScreen })));

/** While a mode's code comes down: the same veil its own screen opens behind. */
const LoadingScreen = () => (
  <div className="rb-veil" role="status" aria-label="Loading">
    <div className="rb-veil-small">
      <i className="rb-veil-sigil" aria-hidden="true" />
      <small>Loading</small>
    </div>
  </div>
);

/** Embers rising from the Rift on the title screen: spread across, each on its own clock. */
const EMBERS = Array.from({ length: 18 }, (_, i) => ({ x: (i * 53) % 100, delay: (i % 6) * 0.9, dur: 6 + (i % 5) * 1.7, size: 2 + (i % 3) }));

/**
 * The world behind the title: a night sky with an aurora and a moon, three ranges of mountains, a castle
 * on the far crag, fog in the valley and embers rising from the Rift. All CSS and one small drawing: it
 * paints at once, scales with the stage, and holds still for players who ask for less motion.
 */
function EpicSky() {
  return (
    <div className="rb-epic-sky" aria-hidden="true">
      <i className="rb-epic-stars" />
      <i className="rb-epic-stars is-far" />
      <i className="rb-epic-aurora" />
      <i className="rb-epic-moon" />
      <svg className="rb-epic-land" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice">
        <path className="rb-range-3" d="M0 250 L90 190 L170 230 L260 160 L340 215 L430 150 L520 210 L600 170 L690 225 L780 140 L870 205 L935 168 L950 158 L1066 158 L1130 186 L1200 200 L1200 400 L0 400 Z" />
        {/* the castle on the far crag, right of the name and the line under it at every width: keep, towers, banners */}
        <g className="rb-castle" transform="translate(150 0)">
          <path d="M800 160 L812 150 L812 98 L806 98 L806 86 L830 86 L830 98 L824 98 L824 150 L846 150 L846 112 L840 112 L840 100 L866 100 L866 112 L860 112 L860 150 L882 150 L882 92 L876 92 L876 78 L889 64 L902 78 L902 92 L896 92 L896 150 L912 160 Z" />
          <path className="rb-banner" d="M889 64 L889 44 L904 50 L889 56" />
          <rect className="rb-window" x="886" y="104" width="6" height="10" />
          <rect className="rb-window" x="850" y="122" width="5" height="8" />
          <rect className="rb-window" x="815" y="112" width="5" height="8" />
        </g>
        <path className="rb-range-2" d="M0 300 L120 230 L210 280 L330 215 L440 285 L560 240 L650 290 L760 245 L880 300 L990 235 L1100 285 L1200 250 L1200 400 L0 400 Z" />
        <path className="rb-range-1" d="M0 350 L150 300 L260 340 L380 290 L520 345 L640 310 L760 350 L900 300 L1030 345 L1200 305 L1200 400 L0 400 Z" />
      </svg>
      <i className="rb-epic-fog" />
      <i className="rb-epic-fog is-low" />
      {EMBERS.map((e, i) => (
        <i key={i} className="rb-epic-ember" style={{ ['--x' as string]: `${e.x}%`, ['--d' as string]: `${e.delay}s`, ['--t' as string]: `${e.dur}s`, ['--s' as string]: `${e.size}px` }} />
      ))}
    </div>
  );
}

/**
 * The title screen: the Wardens' Sanctum (CharacterSelect), with the Rift Trials and The Vigil off it. A friend's
 * invite is said here and joined once a hero is chosen.
 */
export function TitleScreen({ engine }: { engine: SigilEngine }) {
  const heroes = engine.heroes();
  const [settings, setSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [rift, setRift] = useState<number | null>(null);
  const [vigil, setVigil] = useState(false);
  const [ring, setRing] = useState(false);
  // a rated Ring match left while it was going: back to it, or a leaver's loss
  const [left, setLeft] = useState<LiveMatch | null>(() => readLive());
  const [resume, setResume] = useState<LiveMatch | null>(null);
  const [lost, setLost] = useState<number | null>(null);
  const forfeit = (l: LiveMatch): void => {
    void import('../arena/ladder').then((m) => {
      setLeft(null);
      setLost(m.forfeitLive(l));
    });
  };
  useEffect(() => {
    // (too long gone: the match is lost, and the screen says so)
    if (left && !liveGoing(left)) forfeit(left);
  }, [left]);
  const lastHero = heroes[engine.save.last];
  if (vigil) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <VigilScreen engine={engine} face={lastHero?.face} body={lastHero?.body} cls={lastHero?.cls} name={lastHero?.name} onBack={() => setVigil(false)} />
      </Suspense>
    );
  }
  if (ring) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <RingScreen
          engine={engine}
          face={lastHero?.face}
          body={lastHero?.body}
          cls={lastHero?.cls}
          name={lastHero?.name}
          resume={resume ?? undefined}
          onBack={() => {
            setResume(null);
            setRing(false);
          }}
        />
      </Suspense>
    );
  }
  if (rift !== null && heroes[rift]) {
    return (
      <div className="rb-title is-epic is-roster">
        <EpicSky />
        <RiftScreen engine={engine} slot={rift} onBack={() => setRift(null)} />
      </div>
    );
  }
  return (
    <div className="rb-title is-hall">
      <ScreenGate intro label="Opening the sanctum">
        <CharacterSelect engine={engine} onRift={setRift} onVigil={() => setVigil(true)} onRing={() => setRing(true)} onSettings={() => setSettings(true)} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
      </ScreenGate>
      {engine.ui.notice && <p className="rb-notice" role="status">{engine.ui.notice}</p>}
      {left && liveGoing(left) && (
        <div className="rb-ring-dialog-wrap is-blocking" role="alertdialog" aria-modal="true" aria-label="Your Ring match is still going">
          <div className="rb-ring-dialog">
            <h2>Your Ring match is still going</h2>
            <p>
              You left a rated {left.format}v{left.format} against {left.stakes.rival} before it ended. {!left.snap || left.snap.p === 'gates' ? 'Its gates hadn’t lifted yet, so giving it up costs nothing.' : `Go back to it now, or it counts as a leaver’s loss: −${Math.round(left.stakes.lose * LEAVER_K)} rating, half again a loss.`}
            </p>
            <div className="rb-vigil-actions">
              <button
                className="rb-btn is-gold"
                autoFocus
                onClick={() => {
                  setResume(left);
                  setLeft(null);
                  setRing(true);
                }}
              >
                Go back to the match
              </button>
              <button className="rb-btn is-danger" onClick={() => forfeit(left)}>
                Give it up
              </button>
            </div>
          </div>
        </div>
      )}
      {lost !== null && (
        <div className="rb-ring-dialog-wrap is-blocking" role="alertdialog" aria-modal="true" aria-label="Ring match lost">
          <div className="rb-ring-dialog">
            <h2>Ring match lost</h2>
            <p>{lost < 0 ? `You left a rated match and didn’t come back to it: a leaver’s loss, ${lost} rating.` : 'You left a match before its gates lifted: that costs nothing.'}</p>
            <div className="rb-vigil-actions">
              <button className="rb-btn is-gold" autoFocus onClick={() => setLost(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {engine.party && !engine.invite && <p className="rb-notice" role="status">You’re still in party {engine.party.link.code}. Choose a hero to go back to it.</p>}
      {engine.invite && (
        <p className="rb-notice is-invite" role="status">
          A friend invited you to their party (code {engine.invite}). Choose a hero, or make one, to join them.
        </p>
      )}
      {settings && (
        <div className="rb-modal">
          <SettingsPanel engine={engine} onClose={() => setSettings(false)} />
        </div>
      )}
    </div>
  );
}

const DIFFICULTY = ['', 'Easy to learn', 'Some practice', 'Takes skill'];

/** Choosing a class and a name. */
export function CreateScreen({ engine }: { engine: SigilEngine }) {
  const [cls, setCls] = useState<ClassId>('mage');
  const [body, setBody] = useState<Body>('m');
  const [face, setFace] = useState<Face>({ skin: 1, hair: 1, style: 'short', beard: false });
  const pick = (next: Partial<Face>): void => setFace({ ...face, ...next });
  const [name, setName] = useState(() => cleanName(engine.defaultName));
  const [askTips, setAskTips] = useState(false);
  const begin = (tips?: boolean): void => engine.createHero(engine.ui.createSlot, cls, cleanName(name), body, face, tips);
  const def = CLASSES[cls];
  const { me } = useAccount();
  const items = useLiveCatalog().raw.shopItems ?? PRODUCTS;
  // a class sold in the shop can be looked at here, and made once it's bought
  const priceOf = (id: ClassId): string | null => {
    const item = PAID_CLASSES[id];
    const p = item ? productIn(items, item) : undefined;
    return p ? priceText(p.cents) : null;
  };
  const open = classOpen(cls, me);
  return (
    <div className="rb-create">
      <div className="rb-create-head">
        <button className="rb-btn is-small is-ghost" onClick={() => engine.toTitle()}>
          ← Back
        </button>
        <h2>Choose your hero</h2>
        <GameMenuButton className="rb-iconbtn" />
      </div>
      <div className="rb-classes" role="radiogroup" aria-label="Class">
        {CLASS_IDS.map((id) => {
          const c = CLASSES[id];
          return (
            <button key={id} role="radio" aria-checked={cls === id} className={`rb-class${cls === id ? ' is-on' : ''}`} style={{ ['--cc' as string]: c.colors.main }} onClick={() => setCls(id)}>
              <img className="rb-class-doll" src={heroDollUrl(heroLook(id, {}, {}, body, face), 'down', 2, heldWeapon(id, undefined), id === 'warrior' || id === 'paladin')} alt="" draggable={false} />
              <strong>{c.name}</strong>
              <span className="rb-dim">{c.role}</span>
              {!classOpen(id, me) && <span className="rb-class-lock">Shop · {priceOf(id) ?? 'paid'}</span>}
              <span className="rb-dots" aria-label={DIFFICULTY[c.difficulty]}>
                {[1, 2, 3].map((n) => (
                  <i key={n} className={n <= c.difficulty ? 'is-on' : ''} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="rb-create-detail">
        <div className="rb-looks" aria-label="Your hero’s look">
          <div className="rb-swatches" role="radiogroup" aria-label="Skin">
            <span>Skin</span>
            {SKINS.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={face.skin === i} aria-label={`Skin ${i + 1}`} className={face.skin === i ? 'is-on' : ''} style={{ background: c }} onClick={() => pick({ skin: i })} />
            ))}
          </div>
          <div className="rb-swatches" role="radiogroup" aria-label="Hair color">
            <span>Hair</span>
            {HAIRS.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={face.hair === i} aria-label={`Hair color ${i + 1}`} className={face.hair === i ? 'is-on' : ''} style={{ background: c }} onClick={() => pick({ hair: i })} />
            ))}
          </div>
          <div className="rb-seg" role="radiogroup" aria-label="Hair style">
            {(['short', 'pony', 'long'] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={face.style === s} className={face.style === s ? 'is-on' : ''} onClick={() => pick({ style: s })}>
                {s === 'pony' ? 'Tied back' : s === 'long' ? 'Long' : 'Short'}
              </button>
            ))}
            {body === 'm' && (
              <button type="button" aria-pressed={face.beard} className={face.beard ? 'is-on' : ''} onClick={() => pick({ beard: !face.beard })}>
                Beard
              </button>
            )}
          </div>
        </div>
        <p>{def.blurb}</p>
        <div className="rb-create-skills">
          {[def.basic, ...def.skills, def.ult].map((id) => (
            <span key={id} className="rb-chip" title={SKILLS[id]!.blurb}>
              <SkillIcon id={id} size={24} />
              {SKILLS[id]!.name}
            </span>
          ))}
        </div>
        <p className="rb-dim">
          At level {SPEC_LEVEL} you choose a specialization:{' '}
          {def.trees.map((t, i) => (
            <span key={t.name}>
              {i > 0 && (i === def.trees.length - 1 ? ' or ' : ', ')}
              <b style={{ color: t.color }}>{t.name}</b> ({t.blurb.replace(/\.$/, '').toLowerCase()})
            </span>
          ))}
        </p>
        <form
          className="rb-create-go"
          onSubmit={(e) => {
            e.preventDefault();
            if (!open) return;
            if (engine.asksForTips) setAskTips(true);
            else begin();
          }}
        >
          <div className="rb-seg rb-body" role="radiogroup" aria-label="Hero">
            {(['m', 'f'] as const).map((b) => (
              <button key={b} type="button" role="radio" aria-checked={body === b} className={body === b ? 'is-on' : ''} onClick={() => setBody(b)}>
                {b === 'm' ? 'Male' : 'Female'}
              </button>
            ))}
          </div>
          <label>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} maxLength={16} placeholder={def.name} autoComplete="off" spellCheck={false} />
          </label>
          {open ? (
            <button className="rb-btn is-gold is-big" type="submit">
              Begin as {def.name}
            </button>
          ) : (
            <a className="rb-btn is-gold is-big" href="/shop">
              {me ? `Unlock the ${def.name} in the shop` : 'Sign in to unlock it in the shop'}
            </a>
          )}
        </form>
      </div>
      {askTips && (
        <div className="rb-ring-dialog-wrap rb-tip-ask" role="dialog" aria-modal="true" aria-labelledby="rb-tip-ask-title">
          <div className="rb-ring-dialog">
            <h2 id="rb-tip-ask-title">Show the tutorial hints?</h2>
            <p>Short hints pause the game to show this hero the controls, the bag, new skills and talents. You can change this any time in Settings.</p>
            <div className="rb-vigil-actions">
              <button className="rb-btn" onClick={() => begin(false)}>
                No, thanks
              </button>
              <button className="rb-btn is-gold" onClick={() => begin(true)} autoFocus>
                Yes, show me
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
