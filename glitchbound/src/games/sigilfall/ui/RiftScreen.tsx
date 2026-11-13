import { useEffect, useMemo, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { useAccount } from '../../../platform/account';
import { BOSSES } from '../data/bosses';
import { CLASS_IDS, CLASSES, MAX_LEVEL } from '../data/classes';
import { KEY_DEATH, keyLevelFor, keyParFor, keyScale, riftDungeons } from '../data/keystones';
import type { ClassId, RegionDef } from '../data/types';
import { ECHOES } from '../data/wardens';
import type { SigilEngine } from '../engine';
import { classOpen } from '../progress/paidClasses';
import { trialHero, trialStone } from '../progress/trial';
import { iconPicture, iconsReady } from '../render/art/gameIcons';
import { heldWeapon, heroDollUrl, heroLook, portraitUrl } from '../render/sprites';
import { clockText } from '../sim/world';
import { spellsOf } from '../vigil/kit';
import { Doll } from './Doll';
import { ScreenGate } from './ScreenGate';

/** The calling and the path played last, kept on this device (which stone each has reached is in the save). */
const LAST_KEY = 'sigilfall.rift.last';
function lastPick(): { cls: ClassId; spec: 0 | 1 | 2 } {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as { cls?: string; spec?: number } | null;
    if (v && typeof v.cls === 'string' && v.cls in CLASSES && (v.spec === 0 || v.spec === 1 || v.spec === 2)) return { cls: v.cls as ClassId, spec: v.spec };
  } catch {
    /* nothing kept */
  }
  return { cls: 'warrior', spec: 0 };
}

/** A dungeon's face on its card: its last boss. */
function bossOf(r: RegionDef): string | null {
  const id = [...r.encounters].reverse().find((e) => !!e.boss)?.boss;
  return id ? (BOSSES[id]?.sprite ?? null) : null;
}

/**
 * The Rift Trials, straight from the title: a calling, one of its three paths, a stone and a dungeon as the Crown
 * remembers it. They are played with the calling's own ready hero (progress/trial.ts), the same for everyone, not
 * with a hero of the story; each calling keeps the stone it has reached, and that is all a Trial leaves behind.
 *
 * It is laid out as the Vigil's lobby and the Ring's are (the owner: "ui of the riftstones should be similar to the
 * ring and the vigil"): the callings across the top, the champion on a dais with what they are beside them, the
 * dungeons to choose from, and one gold button at the foot. It wears the Vigil lobby's own styles (rb-vlobby).
 */
export function RiftScreen({ engine, onBack }: { engine: SigilEngine; onBack: () => void }) {
  const { me } = useAccount();
  const [pick, setPick] = useState(() => {
    const last = lastPick();
    return classOpen(last.cls, me) ? last : { cls: 'warrior' as ClassId, spec: 0 as 0 | 1 | 2 };
  });
  const [, setIcons] = useState(false);
  useEffect(() => {
    void iconsReady.then(setIcons);
  }, []);
  const top = trialStone(engine.save, pick.cls);
  const [stone, setStone] = useState(top);
  const at = Math.max(1, Math.min(top, stone));
  const pool = riftDungeons(top);
  const [region, setRegion] = useState(pool[0]!.id);
  const picked = pool.find((r) => r.id === region) ?? pool[0]!;
  const c = CLASSES[pick.cls];
  const path = c.trees[pick.spec];
  const hero = useMemo(() => trialHero(pick.cls, pick.spec, top), [pick.cls, pick.spec, top]);
  const doll = useMemo(() => heroDollUrl(heroLook(pick.cls, hero.equip), 'down', 6, heldWeapon(pick.cls, hero.equip.weapon), pick.cls === 'warrior' || pick.cls === 'paladin'), [pick.cls, hero]);
  const next = ECHOES.find((e) => top < e.at);
  const sc = keyScale(at, MAX_LEVEL);
  const choose = (cls: ClassId, spec: 0 | 1 | 2): void => {
    setPick({ cls, spec });
    setStone(trialStone(engine.save, cls));
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ cls, spec }));
    } catch {
      /* a browser that keeps nothing */
    }
  };

  return (
    <ScreenGate label="Opening the Rift">
      <div className="rb-vlobby rb-rlobby" style={{ ['--land' as string]: '#ff8a3d', ['--cls' as string]: c.colors.accent }}>
        <header className="rb-vlobby-head">
          <button className="rb-iconbtn" onClick={onBack} aria-label="Back">
            ←
          </button>
          <div>
            <h2>The Rift Trials</h2>
            <p>A dungeon as the Crown remembers it, against the clock. Beat it and your stone rises.</p>
          </div>
          <GameMenuButton className="rb-iconbtn" />
        </header>

        <section className="rb-vlobby-hero" aria-label="Your champion">
          <div className="rb-vlobby-classes" role="radiogroup" aria-label="Class">
            {CLASS_IDS.map((id) => {
              const open = classOpen(id, me);
              return (
                <button key={id} role="radio" aria-checked={id === pick.cls} className={`rb-vlobby-class${id === pick.cls ? ' is-on' : ''}${open ? '' : ' is-locked'}`} style={{ ['--c' as string]: CLASSES[id].colors.accent }} aria-disabled={!open} title={open ? `${CLASSES[id].name}: Riftstone +${trialStone(engine.save, id)}` : `${CLASSES[id].name}: unlock it in the shop`} onClick={() => open && choose(id, 0)}>
                  <img src={iconPicture(spellsOf(id)[0]!.icon)} alt="" draggable={false} />
                  <span>{CLASSES[id].name}</span>
                  <b className="rb-rlobby-stone">+{trialStone(engine.save, id)}</b>
                </button>
              );
            })}
          </div>
          <div className="rb-vlobby-stage">
            <i className="rb-vlobby-dais" aria-hidden="true" />
            <Doll key={`${pick.cls}${pick.spec}`} className="rb-vlobby-doll" src={doll} alt={c.name} />
            <div className="rb-vlobby-name">
              <strong>{c.name}</strong>
              <small className="rb-wear-who" style={{ color: path.color }}>
                {path.name}
              </small>
              <small>
                Level {MAX_LEVEL} · epic gear · the same champion for everyone
              </small>
            </div>
          </div>
          <div className="rb-vlobby-kit">
            <div className="rb-seg rb-rlobby-paths" role="radiogroup" aria-label="Path">
              {c.trees.map((t, i) => (
                <button key={t.name} role="radio" aria-checked={i === pick.spec} className={i === pick.spec ? 'is-on' : ''} style={{ color: t.color }} onClick={() => choose(pick.cls, i as 0 | 1 | 2)}>
                  {t.name}
                </button>
              ))}
            </div>
            <p className="rb-vlobby-about">
              <strong>{path.role}</strong>
              {path.blurb}
            </p>
            <div className="rb-key-row rb-rlobby-key">
              <button className="rb-btn is-small" aria-label="One level lower" disabled={at <= 1} onClick={() => setStone(at - 1)}>
                −
              </button>
              <strong className="rb-key-lvl">Riftstone +{at}</strong>
              <button className="rb-btn is-small" aria-label="One level higher" disabled={at >= top} onClick={() => setStone(at + 1)}>
                +
              </button>
            </div>
            <p className="rb-small rb-dim">
              Enemies at level {keyLevelFor(MAX_LEVEL)}, ×{sc.hp.toFixed(1)} health, ×{sc.dmg.toFixed(1)} damage. A fall costs {KEY_DEATH} seconds. In time, the {c.name}’s stone rises (two inside 80% of the clock, three inside 60%) and is kept. Nothing else leaves the Rift.
              {next ? ` The next memory waits at +${next.at}.` : ''}
            </p>
          </div>
        </section>

        <section className="rb-vlobby-lands" aria-label="Dungeon">
          {pool.map((r) => {
            const boss = bossOf(r);
            return (
              <button key={r.id} className={`rb-vlobby-land${r.id === picked.id ? ' is-on' : ''}`} style={{ ['--c' as string]: '#ff8a3d' }} onClick={() => setRegion(r.id)}>
                {boss && <img src={portraitUrl('creature', boss, 4)} alt="" draggable={false} />}
                <span className="rb-vlobby-land-text">
                  <strong>{r.name}</strong>
                  <small>{r.encounters.filter((e) => !!e.boss).length} bosses</small>
                </span>
                <b className="rb-vlobby-best">{clockText(keyParFor(r, MAX_LEVEL))}</b>
              </button>
            );
          })}
        </section>

        <footer className="rb-vlobby-foot">
          <button className="rb-btn is-gold is-big" onClick={() => engine.startRiftTrial(pick.cls, pick.spec, picked.id, at)} autoFocus>
            Enter {picked.name} · Riftstone +{at}
          </button>
        </footer>
      </div>
    </ScreenGate>
  );
}
