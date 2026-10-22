import { useEffect, useRef, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { xpToNext } from '../data/classes';
import { NPCS } from '../data/quests';
import { REGIONS, TIERS } from '../data/regions';
import { SKILLS } from '../data/skills';
import type { SigilEngine } from '../engine';
import { freePoints, questProgress, trackedQuest } from '../progress/character';
import { modLines } from '../progress/describe';
import { itemMods, itemName, usableBy } from '../progress/items';
import { rarityColor } from '../render/renderer';
import type { World } from '../sim/world';
import { fmt, ItemIcon, Portrait } from './common';
import { DesktopBar } from './DesktopBar';
import { Panels } from './Panels';
import { Minimap } from './Minimap';
import { TouchControls } from './Touch';
import { uiIcon } from './uiIcons';

/** Registers a per-frame DOM update (no React render per frame). */
export function useFrame(engine: SigilEngine, fn: (w: World) => void): void {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const hook = (w: World): void => ref.current(w);
    engine.frameHooks.add(hook);
    return () => {
      engine.frameHooks.delete(hook);
    };
  }, [engine]);
}

export function GameScreen({ engine }: { engine: SigilEngine }) {
  const ui = engine.ui;
  const w = engine.world;
  const h = engine.hero;
  if (!w || !h) return null;
  const overlay = ui.panel || ui.dialogue || ui.travel || ui.pause || ui.death || ui.reward;
  return (
    <div className={`rb-ui${engine.touchMode ? ' is-touch' : ' is-mouse'}${engine.settings.lefty ? ' is-lefty' : ''}`}>
      <Hud engine={engine} />
      {ui.boss && <BossBar engine={engine} />}
      <Tracker engine={engine} />
      <Toasts engine={engine} />
      {ui.banner && (
        <div className="rb-banner" key={ui.banner.id} aria-live="polite">
          <strong>{ui.banner.text}</strong>
          {ui.banner.sub && <span>{ui.banner.sub}</span>}
        </div>
      )}
      {ui.levelUp && <LevelUp engine={engine} />}
      {!overlay && (engine.touchMode ? <TouchControls engine={engine} /> : <DesktopBar engine={engine} />)}
      {ui.dialogue && <Dialogue engine={engine} />}
      {ui.travel && <TravelConfirm engine={engine} />}
      {ui.pause && <PauseMenu engine={engine} />}
      {ui.death && <DeathScreen engine={engine} />}
      {ui.reward && <RewardScreen engine={engine} />}
      {ui.panel && (
        <div className="rb-modal" onPointerDown={(e) => e.target === e.currentTarget && engine.closePanel()}>
          <Panels engine={engine} />
        </div>
      )}
      <RotateHint engine={engine} />
    </div>
  );
}

/* ------------------------------------------------------------------ HUD */

function Hud({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const w = engine.world!;
  const hp = useRef<HTMLElement>(null);
  const hpText = useRef<HTMLElement>(null);
  const shield = useRef<HTMLElement>(null);
  const xp = useRef<HTMLElement>(null);
  const mp = useRef<HTMLElement>(null);
  const mpText = useRef<HTMLElement>(null);
  const enc = useRef<HTMLDivElement>(null);
  useFrame(engine, (world) => {
    const p = world.player;
    if (hp.current) hp.current.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    if (mp.current && p.maxMana > 0) mp.current.style.width = `${Math.max(0, (p.mana / p.maxMana) * 100)}%`;
    if (mpText.current && p.maxMana > 0) mpText.current.textContent = `${Math.floor(p.mana)}`;
    if (shield.current) shield.current.style.width = `${Math.min(100, (p.shield / p.maxHp) * 100)}%`;
    if (hpText.current) hpText.current.textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
    if (xp.current) xp.current.style.width = `${world.xpShare() * 100}%`;
    if (enc.current) {
      const a = world.activeEncounter();
      enc.current.hidden = !a;
      if (a) enc.current.textContent = `${a.title} · wave ${Math.max(1, a.wave)} of ${a.waves}`;
    }
  });
  const fresh = h.bag.filter((i) => i.fresh).length;
  const points = freePoints(h);
  const region = REGIONS[w.region.id];
  return (
    <>
      <div className="rb-hud-hero">
        <div className="rb-hud-face">
          <Portrait kind="hero" id={h.cls} equip={h.equip} size={34} />
          <span className="rb-lvl">{h.level}</span>
        </div>
        <div className="rb-hud-bars">
          <span className="rb-hp">
            <i ref={hp} />
            <b ref={shield} className="rb-shieldbar" />
            <em ref={hpText} />
          </span>
          {w.player.maxMana > 0 && (
            <span className="rb-mp" title="Mana: spells cost it, it comes back fast out of combat">
              <i ref={mp} />
              <em ref={mpText} />
            </span>
          )}
          <span className="rb-xp" title={`${fmt(h.xp)} / ${fmt(xpToNext(h.level))} XP`}>
            <i ref={xp} />
          </span>
          <span className="rb-region">
            {region.name}
            {w.tier > 0 && <b style={{ color: TIERS[w.tier]!.color }}> · {TIERS[w.tier]!.name}</b>}
          </span>
        </div>
        {!engine.touchMode && (
          <button className="rb-potion" onClick={() => engine.drinkPotion()} disabled={h.potions <= 0} aria-label={`Drink a potion (${h.potions} left)`}>
            <img src={uiIcon('potion', 3)} alt="" />
            <span>{h.potions}</span>
            <kbd>1</kbd>
          </button>
        )}
      </div>
      <div className="rb-hud-menu">
        <HudButton icon="bag" label="Hero & bag" badge={fresh || undefined} onClick={() => engine.openPanel('hero')} kbd="I" engine={engine} />
        <HudButton icon="star" label="Talents" badge={points || undefined} onClick={() => engine.openPanel('talents')} kbd="K" engine={engine} />
        <HudButton icon="skills" label="Skills" onClick={() => engine.openPanel('skills')} kbd="U" engine={engine} />
        <HudButton icon="scroll" label="Quests" onClick={() => engine.openPanel('quests')} kbd="J" engine={engine} />
        <HudButton icon="map" label="Map" onClick={() => engine.openPanel('map')} kbd="M" engine={engine} />
        <HudButton icon="pause" label="Pause" onClick={() => engine.togglePause()} kbd="Esc" engine={engine} />
        <GameMenuButton className="rb-hudbtn" />
      </div>
      <Minimap engine={engine} />
      <div className="rb-encounter" ref={enc} hidden />
    </>
  );
}

function HudButton({ icon, label, badge, onClick, kbd, engine }: { icon: string; label: string; badge?: number; onClick: () => void; kbd: string; engine: SigilEngine }) {
  return (
    <button className="rb-hudbtn" onClick={onClick} aria-label={badge ? `${label} (${badge} new)` : label} title={engine.touchMode ? label : `${label} (${kbd})`}>
      <img src={uiIcon(icon, 3)} alt="" />
      {badge ? <span className="rb-badge">{badge}</span> : null}
    </button>
  );
}

function BossBar({ engine }: { engine: SigilEngine }) {
  const bar = useRef<HTMLElement>(null);
  const lag = useRef<HTMLElement>(null);
  const shown = useRef(1);
  useFrame(engine, (w) => {
    const b = w.boss();
    const share = b ? Math.max(0, b.hp / b.maxHp) : 0;
    shown.current = Math.max(share, shown.current - 0.004);
    if (bar.current) bar.current.style.width = `${share * 100}%`;
    if (lag.current) lag.current.style.width = `${shown.current * 100}%`;
  });
  const boss = engine.ui.boss!;
  return (
    <div className="rb-bossbar" role="status">
      <strong>{boss.name}</strong>
      <span className="rb-boss-title">{boss.title}</span>
      <span className="rb-boss-track">
        <i ref={lag} className="rb-boss-lag" />
        <i ref={bar} className="rb-boss-fill" />
      </span>
    </div>
  );
}

function Tracker({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const q = trackedQuest(h);
  if (!q || engine.ui.boss) return null;
  const pr = questProgress(h, q);
  return (
    <button className="rb-tracker" onClick={() => engine.openPanel('quests')}>
      <strong>{q.name}</strong>
      <span>
        {q.objective.label}
        {pr.of > 1 ? ` ${pr.n}/${pr.of}` : ''}
      </span>
    </button>
  );
}

function Toasts({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  return (
    <div className="rb-toasts" aria-live="polite">
      {engine.ui.toasts.map((t) => {
        if (t.tone === 'loot' && t.item) {
          const item = t.item;
          const owned = h.bag.some((i) => i.uid === item.uid);
          const lines = modLines(itemMods(item));
          const canWear = usableBy(item, h.cls);
          return (
            <div key={t.id} className={`rb-toast is-loot is-${item.r}`} style={{ ['--rc' as string]: rarityColor(item.r) }}>
              <ItemIcon item={item} size={38} />
              <div className="rb-toast-text">
                <strong>{itemName(item)}</strong>
                {lines[0] ? <span className="rb-gold">{lines[0]}</span> : <span className="rb-dim">{item.r[0]!.toUpperCase() + item.r.slice(1)} · level {item.il}</span>}
              </div>
              {owned && canWear && (
                <button
                  className="rb-btn is-small is-gold"
                  onClick={() => {
                    if (engine.equipItem(item.uid)) {
                      engine.dismissToast(t.id);
                      const ml = modLines(itemMods(item));
                      if (ml.length) engine.toast(`Now: ${ml[0]}`, 'good');
                    }
                  }}
                >
                  Equip
                </button>
              )}
            </div>
          );
        }
        return (
          <div key={t.id} className={`rb-toast is-${t.tone}`} onClick={() => engine.dismissToast(t.id)}>
            <div className="rb-toast-text">
              <strong>{t.text}</strong>
              {t.sub && <span>{t.sub}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LevelUp({ engine }: { engine: SigilEngine }) {
  const l = engine.ui.levelUp!;
  return (
    <div className="rb-levelup" key={l.id} aria-live="polite">
      <strong>Level {l.level}</strong>
      <span>+1 talent point{l.skills.length ? ` · New: ${l.skills.map((s) => SKILLS[s]!.name).join(', ')}` : ''}</span>
    </div>
  );
}

/* ------------------------------------------------------------- overlays */

function Dialogue({ engine }: { engine: SigilEngine }) {
  const d = engine.ui.dialogue!;
  const npc = NPCS[d.npc]!;
  const last = d.i + 1 >= d.lines.length;
  return (
    <div className="rb-dialogue" onClick={() => !last && engine.nextLine()}>
      <div className="rb-dialogue-face">
        <Portrait kind="npc" id={d.npc} size={56} />
      </div>
      <div className="rb-dialogue-body">
        <strong>
          {npc.name} <span className="rb-dim">· {npc.title}</span>
        </strong>
        <p key={d.i}>{d.lines[d.i]}</p>
        <div className="rb-dialogue-actions">
          {npc.shop && (
            <button className="rb-btn is-small is-gold" onClick={() => engine.openShop(npc.shop!)}>
              Trade
            </button>
          )}
          {last && npc.service === 'respec' && (
            <button className="rb-btn is-small" onClick={() => engine.openPanel('talents')}>
              Talents
            </button>
          )}
          <button className={`rb-btn is-small${npc.shop ? '' : ' is-gold'}`} onClick={() => (last ? engine.closeDialogue() : engine.nextLine())} autoFocus={!npc.shop}>
            {last ? 'Farewell' : 'Next ▸'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TravelConfirm({ engine }: { engine: SigilEngine }) {
  const t = engine.ui.travel!;
  const region = REGIONS[t.to];
  return (
    <div className="rb-modal">
      <div className="rb-card" role="dialog" aria-modal="true" aria-label="Travel">
        <h2>{t.label}</h2>
        {t.locked ? (
          <>
            <p>{t.locked}</p>
            <button className="rb-btn is-gold" onClick={() => engine.cancelTravel()} autoFocus>
              OK
            </button>
          </>
        ) : (
          <>
            <p>
              Travel to <b>{region.name}</b>? <span className="rb-dim">{region.subtitle}.</span>
            </p>
            <div className="rb-row">
              <button className="rb-btn" onClick={() => engine.cancelTravel()}>
                Stay
              </button>
              <button className="rb-btn is-gold" onClick={() => engine.confirmTravel()} autoFocus>
                Go
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PauseMenu({ engine }: { engine: SigilEngine }) {
  const [leaving, setLeaving] = useState(false);
  const w = engine.world!;
  return (
    <div className="rb-modal">
      <div className="rb-card rb-pause" role="dialog" aria-modal="true" aria-label="Paused">
        <h2>Paused</h2>
        <button className="rb-btn is-gold is-big" onClick={() => engine.togglePause()} autoFocus>
          Resume
        </button>
        <button className="rb-btn" onClick={() => engine.openPanel('settings')}>
          Settings
        </button>
        {!w.region.safe &&
          (leaving ? (
            <button className="rb-btn is-danger" onClick={() => engine.returnHome()}>
              Leave the expedition? You keep everything you found.
            </button>
          ) : (
            <button className="rb-btn" onClick={() => setLeaving(true)}>
              Return to Emberwick
            </button>
          ))}
        <button className="rb-btn is-ghost" onClick={() => engine.toTitle()}>
          Save and quit to heroes
        </button>
        <p className="rb-dim rb-small">Progress saves by itself{engine.canSave ? '' : ' (not on this device right now)'}.</p>
      </div>
    </div>
  );
}

function DeathScreen({ engine }: { engine: SigilEngine }) {
  const w = engine.world!;
  return (
    <div className="rb-modal is-dark">
      <div className="rb-card rb-death" role="dialog" aria-modal="true" aria-label="You have fallen">
        <h2>You have fallen</h2>
        <p className="rb-dim">Everything you found is safe. The room you fell in resets.</p>
        <button className="rb-btn is-gold is-big" onClick={() => engine.respawn()} autoFocus>
          Rise again
        </button>
        {!w.region.safe && (
          <button className="rb-btn" onClick={() => engine.returnHome()}>
            Return to Emberwick
          </button>
        )}
      </div>
    </div>
  );
}

function RewardScreen({ engine }: { engine: SigilEngine }) {
  const r = engine.ui.reward!;
  const mins = Math.floor(r.seconds / 60);
  const secs = Math.floor(r.seconds % 60);
  const h = engine.hero!;
  return (
    <div className="rb-modal">
      <div className="rb-card rb-reward" role="dialog" aria-modal="true" aria-label="Rift closed">
        <span className="rb-kicker">{TIERS[r.tier]!.name} · {REGIONS[r.region].name}</span>
        <h2>The Rift is closed!</h2>
        <div className="rb-reward-stats">
          <span>
            <b>{fmt(r.xp)}</b> XP
          </span>
          <span>
            <b>{fmt(r.gold)}</b> gold
          </span>
          <span>
            <b>{r.kills}</b> foes
          </span>
          <span>
            <b>
              {mins}:{String(secs).padStart(2, '0')}
            </b>{' '}
            time
          </span>
        </div>
        {r.items.length > 0 && (
          <div className="rb-reward-items">
            {r.items.slice(-12).map((it) => (
              <ItemIcon key={it.uid} item={it} size={40} label={itemName(it)} />
            ))}
          </div>
        )}
        {h.tier > r.tier && <p className="rb-gold">{TIERS[h.tier]!.name} difficulty is now open: choose it at a waystone.</p>}
        <div className="rb-row">
          <button className="rb-btn" onClick={() => engine.closeReward()}>
            Look around
          </button>
          <button className="rb-btn is-gold" onClick={() => engine.returnHome()} autoFocus>
            Return to Emberwick
          </button>
        </div>
      </div>
    </div>
  );
}

/** Phones held upright: suggest turning sideways (never required). */
function RotateHint({ engine }: { engine: SigilEngine }) {
  const [portrait, setPortrait] = useState(() => typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia('(orientation: portrait)');
    const on = (): void => setPortrait(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  if (!portrait || !engine.touchMode || engine.settings.rotateSeen) return null;
  return (
    <div className="rb-modal is-dark">
      <div className="rb-card rb-rotate" role="dialog" aria-modal="true" aria-label="Turn your phone">
        <span className="rb-rotate-phone" aria-hidden="true" />
        <h2>Turn your phone sideways</h2>
        <p className="rb-dim">Sigilfall plays best in landscape: more room to see, a thumb on each side.</p>
        <button className="rb-btn" onClick={() => engine.setSettings({ rotateSeen: true })}>
          Play upright anyway
        </button>
      </div>
    </div>
  );
}

