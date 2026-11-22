import { useEffect, useMemo, useState } from 'react';
import { SKILLS } from '../data/skills';
import { TALENTS } from '../data/talents';
import { buildHero } from '../progress/build';
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
import { iconsReady } from '../render/art/gameIcons';
import { heldWeapon, heroDollUrl, heroLook, portraitUrl } from '../render/sprites';
import { clockText } from '../sim/world';
import { Doll } from './Doll';
import { SkillIcon } from './common';
import { RiftGuide } from './RiftGuide';
import { classEmblem } from './classEmblem';
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

/** Whether this device has opened the Trials before (the guide is open the first time, folded after). */
const SEEN_KEY = 'sigilfall.rift.seen';
function firstVisit(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY)) return false;
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* a browser that keeps nothing: the guide is open each time */
  }
  return true;
}
/** The dungeon chosen last, kept on this device. */
const LAND_KEY = 'sigilfall.rift.land';
function lastLand(): string | null {
  try {
    return localStorage.getItem(LAND_KEY);
  } catch {
    return null;
  }
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
/**
 * The Riftstone from the main menu: with one of your own heroes, who wakes in the Riftward and runs the stone there as in
 * the campaign, or with a calling's ready champion, as the Trials always were (the owner, 2026-11-22: "from the riftstone
 * mode from the main menu you should be able to select your existing character and use it, if you use personal
 * character, then just spawn them in the campaign at the zone, if you use premade char, keep the same logic").
 */
export function RiftScreen({ engine, onBack }: { engine: SigilEngine; onBack: () => void }) {
  const ready = engine.heroes().some((h) => !!h && h.unlocked.includes('riftward'));
  const [mode, setMode] = useState<'mine' | 'champion'>(ready ? 'mine' : 'champion');
  const tabs = (
    <div className="rb-seg rb-rlobby-mode" role="tablist" aria-label="Who goes in">
      <button role="tab" aria-selected={mode === 'mine'} className={mode === 'mine' ? 'is-on' : ''} onClick={() => setMode('mine')}>
        Your heroes
      </button>
      <button role="tab" aria-selected={mode === 'champion'} className={mode === 'champion' ? 'is-on' : ''} onClick={() => setMode('champion')}>
        Champions
      </button>
    </div>
  );
  if (mode === 'mine') return <OwnHeroes engine={engine} onBack={onBack} tabs={tabs} />;
  return <Champions engine={engine} onBack={onBack} tabs={tabs} />;
}

/** Your own heroes: whoever has finished the story is taken to the Riftward, where the Gate is; the others say what's left. */
function OwnHeroes({ engine, onBack, tabs }: { engine: SigilEngine; onBack: () => void; tabs: React.ReactNode }) {
  const heroes = engine.heroes();
  return (
    <ScreenGate label="Opening the Rift">
      <div className="rb-vlobby rb-rlobby" style={{ ['--land' as string]: '#a06aff', ['--cls' as string]: '#c58cff' }}>
        <header className="rb-vlobby-head">
          <button className="rb-iconbtn" onClick={onBack} aria-label="Back">
            ←
          </button>
          <div>
            <h2>The Riftstone</h2>
            <p>Take one of your own heroes to the Riftward, and run the stone at its Gate with everything they carry.</p>
          </div>
          {tabs}
          <GameMenuButton className="rb-iconbtn" />
        </header>
        <ul className="rb-rlobby-own">
          {heroes.map((h, slot) => {
            if (!h) return null;
            const open = h.unlocked.includes('riftward');
            const c = CLASSES[h.cls];
            return (
              <li key={slot} className={`rb-rlobby-own-card${open ? '' : ' is-locked'}`} style={{ ['--cls' as string]: c.colors.accent }}>
                <Doll className="rb-rlobby-own-doll" src={heroDollUrl(heroLook(h.cls, h.equip, undefined, h.body, h.face), 'down', 3, heldWeapon(h.cls, h.equip.weapon), h.cls === 'warrior' || h.cls === 'paladin')} alt="" />
                <span className="rb-rlobby-own-text">
                  <strong>{h.name}</strong>
                  <small>
                    Level {h.level} {c.name}
                    {h.keystone >= 1 ? ` · Riftstone +${h.keystone}` : ''}
                  </small>
                  {!open && <small className="rb-dim">Finish the story to open the Riftward.</small>}
                </span>
                <button className="rb-btn is-gold" disabled={!open} onClick={() => engine.playInRiftward(slot)}>
                  To the Riftward
                </button>
              </li>
            );
          })}
          {!heroes.some(Boolean) && <li className="rb-dim">You have no heroes yet. Make one in the hall, or take a champion in.</li>}
        </ul>
      </div>
    </ScreenGate>
  );
}

/** A calling's ready champion, at the stone that calling has reached on this account (the Rift Trials). */
function Champions({ engine, onBack, tabs }: { engine: SigilEngine; onBack: () => void; tabs: React.ReactNode }) {
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
  // the one played last, or (the first time) not the Chapel Crypt every story hero has just come out of
  const [region, setRegionState] = useState(() => {
    const last = lastLand();
    return pool.find((r) => r.id === last)?.id ?? (pool.find((r) => r.id !== 'crypt') ?? pool[0]!).id;
  });
  const setRegion = (id: RegionDef['id']): void => {
    setRegionState(id);
    try {
      localStorage.setItem(LAND_KEY, id);
    } catch {
      /* nothing kept */
    }
  };
  const [first] = useState(firstVisit);
  const picked = pool.find((r) => r.id === region) ?? pool[0]!;
  const c = CLASSES[pick.cls];
  const path = c.trees[pick.spec];
  const hero = useMemo(() => trialHero(pick.cls, pick.spec, top), [pick.cls, pick.spec, top]);
  // what the champion carries: the bar they fight with, and the talents that change it most (the ones naming a skill)
  const kit = useMemo(() => {
    const b = buildHero(hero);
    const bar = (['basic', 's1', 's2', 's3', 's4', 'ult'] as const).map((k) => b.bar[k]).filter((id): id is string => !!id && !!SKILLS[id]);
    const keys = TALENTS[pick.cls].filter((n) => n.tree === pick.spec && (hero.talents[n.id] ?? 0) > 0 && n.mods.some((m) => m.t !== 'stat')).sort((a, b) => b.row - a.row).slice(0, 3);
    return { bar, keys };
  }, [hero, pick.cls, pick.spec]);
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
          {tabs}
          <GameMenuButton className="rb-iconbtn" />
        </header>

        <section className="rb-vlobby-hero" aria-label="Your champion">
          <div className="rb-vlobby-classes" role="radiogroup" aria-label="Class">
            {CLASS_IDS.map((id) => {
              const open = classOpen(id, me);
              return (
                <button key={id} role="radio" aria-checked={id === pick.cls} className={`rb-vlobby-class${id === pick.cls ? ' is-on' : ''}${open ? '' : ' is-locked'}`} style={{ ['--c' as string]: CLASSES[id].colors.accent }} aria-disabled={!open} title={open ? `${CLASSES[id].name}: Riftstone +${trialStone(engine.save, id)}` : `${CLASSES[id].name}: unlock it in the shop`} onClick={() => open && choose(id, 0)}>
                  <img src={classEmblem(id)} alt="" draggable={false} />
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
            <div className="rb-rlobby-build" aria-label="What this champion carries">
              <span className="rb-rlobby-bar">
                {kit.bar.map((id) => (
                  <span key={id} title={`${SKILLS[id]!.name}: ${SKILLS[id]!.blurb}`}>
                    <SkillIcon id={id} size={30} />
                  </span>
                ))}
              </span>
              {kit.keys.length > 0 && (
                <ul className="rb-small">
                  {kit.keys.map((n) => (
                    <li key={n.id}>
                      <b style={{ color: path.color }}>{n.name}</b> {n.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
          {/* (open the first time the Trials are opened on this device, folded after) */}
          <RiftGuide hero={hero} open={first} />
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
