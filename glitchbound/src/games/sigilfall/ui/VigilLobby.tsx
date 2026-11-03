import { useEffect, useMemo, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { CLASSES, CLASS_IDS } from '../data/classes';
import type { ClassId } from '../data/types';
import { newCharacter, type Face } from '../progress/character';
import { iconPicture, iconsReady } from '../render/art/gameIcons';
import { creatureSprite, heroDollUrl, heroLook } from '../render/sprites';
import { CLASS_BODY, mapOpen, spellsOf, UNLOCK_HOLD, VIGIL_MAPS, type VigilMap } from '../vigil/kit';

const BEST_KEY = 'sigilfall.vigil.bests';
/** Before the lands, one number: the Whisperwood's. */
const OLD_BEST_KEY = 'sigilfall.vigil.best';

export function readBests(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as unknown;
    const out: Record<string, number> = {};
    if (raw && typeof raw === 'object') for (const [k, n] of Object.entries(raw)) if (typeof n === 'number' && n >= 0) out[k] = n;
    const old = Number(localStorage.getItem(OLD_BEST_KEY)) || 0;
    if (old > (out.whisperwood ?? 0)) out.whisperwood = old;
    return out;
  } catch {
    return {};
  }
}

export function saveBest(map: string, t: number): void {
  try {
    const all = readBests();
    all[map] = Math.max(all[map] ?? 0, Math.floor(t));
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    /* a browser that keeps nothing: the run still counted */
  }
}

const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const champions = new Map<string, string>();
/** A land's champion, as a picture for its card. */
function championUrl(sprite: string): string {
  const hit = champions.get(sprite);
  if (hit) return hit;
  const sp = creatureSprite(sprite, 0);
  const c = document.createElement('canvas');
  c.width = sp.width;
  c.height = sp.height;
  c.getContext('2d')!.drawImage(sp.c as CanvasImageSource, 0, 0);
  const url = c.toDataURL();
  champions.set(sprite, url);
  return url;
}

/** Choosing who keeps the watch, and where. */
export function VigilLobby({ face, body, cls, map, onBack, onBegin }: { face?: Face; body?: 'm' | 'f'; cls: ClassId; map?: VigilMap; onBack: () => void; onBegin: (cls: ClassId, map: VigilMap) => void }) {
  const [pick, setPick] = useState<ClassId>(cls);
  const bests = useMemo(() => readBests(), []);
  const [land, setLand] = useState<VigilMap>(() => {
    if (map) return map;
    // the furthest land open
    let at = 0;
    VIGIL_MAPS.forEach((_, i) => {
      if (mapOpen(i, bests)) at = i;
    });
    return VIGIL_MAPS[at]!;
  });
  const [spell, setSpell] = useState(0);
  const [, setIcons] = useState(false);
  useEffect(() => {
    void iconsReady.then(setIcons);
  }, []);
  const doll = useMemo(() => {
    const hero = newCharacter(pick, 'The Watch', 'vigil');
    return heroDollUrl(heroLook(pick, hero.equip, {}, body ?? 'm', face), 'down', 6);
  }, [pick, body, face]);
  const kit = spellsOf(pick);
  const shown = kit[spell] ?? kit[0]!;
  const c = CLASSES[pick];
  const stats = CLASS_BODY[pick];
  return (
    <div className="rb-vlobby" style={{ ['--land' as string]: land.color, ['--cls' as string]: c.colors.accent }}>
      <header className="rb-vlobby-head">
        <button className="rb-iconbtn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div>
          <h1>The Vigil</h1>
          <p>Hold the line. It always breaks in the end. How long is up to you.</p>
        </div>
        <GameMenuButton className="rb-iconbtn" />
      </header>

      <section className="rb-vlobby-hero" aria-label="Your hero">
        <div className="rb-vlobby-classes" role="radiogroup" aria-label="Class">
          {CLASS_IDS.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={id === pick}
              className={`rb-vlobby-class${id === pick ? ' is-on' : ''}`}
              style={{ ['--c' as string]: CLASSES[id].colors.accent }}
              onClick={() => {
                setPick(id);
                setSpell(0);
              }}
            >
              <img src={iconPicture(spellsOf(id)[0]!.icon)} alt="" draggable={false} />
              <span>{CLASSES[id].name}</span>
            </button>
          ))}
        </div>
        <div className="rb-vlobby-stage">
          <i className="rb-vlobby-dais" aria-hidden="true" />
          <img key={pick} className="rb-vlobby-doll" src={doll} alt={c.name} draggable={false} />
          <div className="rb-vlobby-name">
            <strong>{c.name}</strong>
            <small>
              {stats.hp} health · {stats.speed >= 84 ? 'quick on their feet' : stats.speed <= 74 ? 'heavy but sturdy' : 'steady'}
            </small>
          </div>
        </div>
        <div className="rb-vlobby-kit">
          <div className="rb-vlobby-spells">
            {kit.map((s, i) => (
              <button key={s.id} className={`rb-vlobby-spell${i === spell ? ' is-on' : ''}`} onClick={() => setSpell(i)} onMouseEnter={() => setSpell(i)} aria-label={s.name}>
                <img src={iconPicture(s.icon)} alt="" draggable={false} />
                {i === 0 && <em>First</em>}
              </button>
            ))}
          </div>
          <p className="rb-vlobby-about">
            <strong>{shown.name}</strong>
            {shown.text}
            {shown.evolve && (
              <span className="rb-vlobby-evolve">
                <img src={iconPicture(shown.evolve.icon)} alt="" draggable={false} />
                <span>
                  Evolves into <b>{shown.evolve.name}</b>. {shown.evolve.text}
                </span>
              </span>
            )}
          </p>
        </div>
      </section>

      <section className="rb-vlobby-lands" aria-label="Land">
        {VIGIL_MAPS.map((m, i) => {
          const open = mapOpen(i, bests);
          const best = bests[m.id] ?? 0;
          return (
            <button key={m.id} className={`rb-vlobby-land${m === land ? ' is-on' : ''}${open ? '' : ' is-locked'}`} style={{ ['--c' as string]: m.color }} disabled={!open} onClick={() => setLand(m)}>
              <img src={championUrl(m.champions[0]!.sprite)} alt="" draggable={false} />
              <span className="rb-vlobby-land-text">
                <strong>{m.name}</strong>
                {open ? <small>{m.blurb}</small> : <small>Hold {clock(UNLOCK_HOLD)} in {VIGIL_MAPS[i - 1]!.name} to open</small>}
              </span>
              {open && best > 0 && <b className="rb-vlobby-best">{clock(best)}</b>}
              {!open && (
                <b className="rb-vlobby-lock" aria-hidden="true">
                  ⛓
                </b>
              )}
            </button>
          );
        })}
      </section>

      <footer className="rb-vlobby-foot">
        <button className="rb-btn is-gold is-big" onClick={() => onBegin(pick, land)} autoFocus>
          Keep the watch in {land.name}
        </button>
      </footer>
    </div>
  );
}
