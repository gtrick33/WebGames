import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { procsNow } from './comboMark';
import { bossPips, phaseTicks, sixWords, windingUp } from './bossbar';
import { mechanicDue, mechanicShown } from '../progress/tips';
import type { Callout } from '../sim/types';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { MAX_LEVEL, xpToNext } from '../data/classes';
import { KEY_AFFIXES, KEY_DEATH, keyUpgrade } from '../data/keystones';
import { NPCS, QUEST_DEFS } from '../data/quests';
import { REGIONS, TIERS } from '../data/regions';
import { SKILLS } from '../data/skills';
import type { ResourceDef } from '../data/types';
import type { SigilEngine } from '../engine';
import { currentObjective, freePoints, HOME, levelGated, questProgress, questState, SLOT_LEVELS, trackedQuest } from '../progress/character';
import { SPEC_LEVEL } from '../data/talents';
import { modLines } from '../progress/describe';
import { isMainQuest, questSteps, turnInNpc } from '../progress/handin';
import { questRewards } from '../progress/rewards';
import { wornLooks } from '../progress/wardrobe';
import { paragonFree, paragonXp } from '../progress/paragon';
import { itemMods, itemName, usableBy } from '../progress/items';
import { TONES } from '../render/effects';
import { rarityColor } from '../render/renderer';
import { clockText, type World } from '../sim/world';
import { sceneDark } from '../sim/scene';
import { fmt, ItemIcon, Portrait } from './common';
import { hudBoxOf, useHudBox } from './hudBoxes';
import { boxesMeet } from '../render/speech';
import { DesktopBar } from './DesktopBar';
import { InviteCards } from './Friends';
import { Panels } from './Panels';
import { Minimap } from './Minimap';
import { TipOverlay } from './Tips';
import { TouchControls } from './Touch';
import { uiIcon } from './uiIcons';
import { mapIconUrl } from './mapIcons';

/** Registers a per-frame DOM update (no React render per frame). */
/** A scene playing (sim/scene.ts): bars top and bottom over a clean picture (the HUD steps aside), and a way to skip it. */
function SceneBars({ engine }: { engine: SigilEngine }) {
  const ref = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const black = useRef<HTMLDivElement>(null);
  const memory = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLElement>(null);
  const hint = useRef<HTMLSpanElement>(null);
  const shown = useRef('');
  const told = useRef('');
  useFrame(engine, (w) => {
    if (!ref.current) return;
    // (how to take the next line, while there is one to take)
    hint.current?.classList.toggle('is-on', !!w.scene && w.story.speech.some((sp) => sp.staged));
    // a fade to black, and a memory: the picture pale and tinted, its caption in the upper bar (clear of anyone's lines)
    if (black.current) black.current.style.opacity = String(sceneDark(w.scene));
    const v = w.scene?.vision;
    if (memory.current) {
      memory.current.classList.toggle('is-on', !!v);
      caption.current?.classList.toggle('is-on', !!v);
      if (v && v.text !== told.current) {
        told.current = v.text;
        memory.current.style.setProperty('--tint', v.tint);
        if (caption.current) caption.current.textContent = v.text;
      }
    }
    ref.current.classList.toggle('is-on', !!w.scene);
    ref.current.parentElement?.classList.toggle('is-scene', !!w.scene);
    // a battle's or a boss's name, over the lower bar (it fades out with the bars)
    const t = w.scene?.title;
    const key = t ? `${t.text}|${t.sub ?? ''}` : '';
    if (title.current && key && key !== shown.current) {
      shown.current = key;
      title.current.firstElementChild!.textContent = t!.text;
      title.current.lastElementChild!.textContent = t!.sub ?? '';
    }
    title.current?.classList.toggle('is-on', !!t);
  });
  return (
    <div className="rb-scene" ref={ref} aria-hidden={!engine.world?.scene}>
      <div className="rb-scene-vision" ref={memory} />
      <div className="rb-scene-black" ref={black} />
      <div className="rb-scene-bar" />
      <div className="rb-scene-bar is-low" />
      <em className="rb-scene-caption" ref={caption} />
      <div className="rb-scene-title" ref={title}>
        <strong />
        <span />
      </div>
      {/* the whole picture takes the next line; Skip, over it, ends the scene */}
      <button className="rb-scene-next" aria-label="Next line" tabIndex={-1} onClick={() => engine.sceneNext()} />
      <span className="rb-scene-hint" ref={hint}>
        {engine.touchMode ? 'Tap for the next line' : 'Click or Space for the next line'}
      </span>
      <button className="rb-scene-skip" onClick={() => engine.skipScene()}>
        Skip scene {engine.touchMode ? '›' : '(Esc)'}
      </button>
    </div>
  );
}

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

/**
 * The announcements (a land's name, a banner, a level gained). Words someone is saying are written on the picture,
 * under the HUD: an announcement that lies across them steps aside until they are said (the owner: "the big land
 * title is drawn over Mara's speech bubble").
 */
function Announce({ engine, children }: { engine: SigilEngine; children: ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  useFrame(engine, () => {
    const el = strip.current;
    const r = engine.renderer as SigilEngine['renderer'] | undefined;
    if (!el || !r) return;
    for (const child of el.children) {
      if (!(child instanceof HTMLElement)) continue;
      const at = r.speechBoxes.length ? hudBoxOf(r.canvas, child, r.viewW, r.viewH) : null;
      child.classList.toggle('is-under-speech', !!at && r.speechBoxes.some((s) => boxesMeet(s, at, 4)));
    }
  });
  return (
    <div className="rb-announce" ref={strip}>
      {children}
    </div>
  );
}

export function GameScreen({ engine }: { engine: SigilEngine }) {
  const ui = engine.ui;
  const w = engine.world;
  const h = engine.hero;
  if (!w || !h) return null;
  const overlay = ui.panel || ui.dialogue || ui.travel || ui.pause || ui.death || ui.reward;
  return (
    <div className={`rb-ui${engine.touchMode ? ' is-touch' : ' is-mouse'}${engine.settings.lefty ? ' is-lefty' : ''}${engine.storyTalk() ? ' is-talk' : ''}${ui.card?.act ? ' is-act' : ''}${ui.boss ? ' is-boss' : ''}`}>
      <Hud engine={engine} />
      <CastBar engine={engine} />
      <ProcAura engine={engine} />
      {ui.boss && <BossBar engine={engine} />}
      {engine.world?.keyRun ? <KeyClock engine={engine} /> : <Tracker engine={engine} />}
      {!ui.dialogue && <Toasts engine={engine} />}
      {/* a friend asking the player into their party (ui/Friends.tsx): over everything, a menu too */}
      {!engine.world?.scene && <InviteCards engine={engine} />}
      {/* (on touch the announcements stack in a strip along the top, clear of the hero; on a mouse each keeps its place) */}
      <Announce engine={engine}>
        {ui.banner && (
          <div className="rb-banner" key={`banner:${ui.banner.id}`} aria-live="polite">
            <strong>{ui.banner.text}</strong>
            {ui.banner.sub && <span>{ui.banner.sub}</span>}
          </div>
        )}
        {ui.levelUp && <LevelUpBanner engine={engine} />}
        {ui.card && (
          <div className={`rb-tcard${ui.card.act ? ' is-act' : ''}`} key={`card:${ui.card.id}`} aria-live="polite">
            <div className="rb-tcard-text">
              <span className="rb-tcard-over">{ui.card.over}</span>
              <strong>{ui.card.text}</strong>
              <i className="rb-tcard-rule" />
              {ui.card.sub && <span className="rb-tcard-sub">{ui.card.sub}</span>}
            </div>
          </div>
        )}
      </Announce>
      {!overlay && (engine.touchMode ? <TouchControls engine={engine} /> : <DesktopBar engine={engine} />)}
      <SceneBars engine={engine} />
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
      {/* (not across the death screen: a hint about the bag came up over "You fell", two texts in one place) */}
      {ui.tip && !ui.death && <TipOverlay engine={engine} />}
      <RotateHint engine={engine} />
    </div>
  );
}

/* ------------------------------------------------------------------ HUD */

const RESOURCE_HELP: Record<ResourceDef['kind'], string> = {
  mana: 'Mana: spells cost it, it comes back fast out of combat',
  rage: 'Rage: hitting and being hit build it, your big skills spend it, it fades out of combat',
  energy: 'Energy: skills spend it, it comes back quickly',
  focus: 'Focus: shots spend it, it comes back quickly',
  holy: 'Zeal: some skills build it (up to 5), others spend 3',
};

function Hud({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const w = engine.world!;
  const hp = useRef<HTMLElement>(null);
  const hpText = useRef<HTMLElement>(null);
  const shield = useRef<HTMLElement>(null);
  const xp = useRef<HTMLElement>(null);
  const mp = useRef<HTMLElement>(null);
  const mpText = useRef<HTMLElement>(null);
  const pips = useRef<HTMLSpanElement>(null);
  const enc = useRef<HTMLDivElement>(null);
  useFrame(engine, (world) => {
    const p = world.player;
    if (hp.current) hp.current.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    if (mp.current && p.maxMana > 0) mp.current.style.width = `${Math.max(0, (p.mana / p.maxMana) * 100)}%`;
    if (mpText.current && p.maxMana > 0) mpText.current.textContent = `${Math.floor(p.mana)}`;
    if (pips.current) for (let i = 0; i < pips.current.children.length; i++) pips.current.children[i]!.classList.toggle('is-on', i < Math.floor(p.mana + 1e-6));
    if (shield.current) shield.current.style.width = `${Math.min(100, (p.shield / p.maxHp) * 100)}%`;
    if (hpText.current) hpText.current.textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
    if (xp.current) xp.current.style.width = `${world.xpShare() * 100}%`;
    if (enc.current) {
      const a = world.activeEncounter();
      enc.current.hidden = !a;
      if (a) enc.current.textContent = `${a.title} · wave ${Math.max(1, a.wave)} of ${a.waves}`;
    }
  });
  const res = w.build.resource;
  const fresh = h.bag.filter((i) => i.fresh).length;
  const points = freePoints(h);
  const region = REGIONS[w.region.id];
  return (
    <>
      <div className="rb-hud-hero">
        <div className="rb-hud-face">
          <span className="rb-hud-pic">
            <Portrait kind="hero" id={h.cls} equip={h.equip} worn={wornLooks(h)} body={h.body} face={h.face} size={34} />
          </span>
          <span className="rb-lvl" aria-label={`Level ${h.level}`}>
            {h.level}
          </span>
          {h.para.l > 0 && (
            <span className={`rb-para${paragonFree(h.para) > 0 ? ' is-free' : ''}`} title={`Paragon ${h.para.l}`}>
              P{h.para.l}
            </span>
          )}
        </div>
        <div className="rb-hud-bars">
          <span className="rb-hp">
            <i ref={hp} />
            <b ref={shield} className="rb-shieldbar" />
            <em ref={hpText} />
          </span>
          {res?.kind === 'holy' ? (
            <span ref={pips} className="rb-pips" title={RESOURCE_HELP.holy} aria-label="Zeal">
              {Array.from({ length: res.base }, (_, i) => (
                <i key={i} />
              ))}
            </span>
          ) : (
            res && (
              <span className={`rb-mp is-${res.kind}`} title={RESOURCE_HELP[res.kind]}>
                <i ref={mp} />
                <em ref={mpText} />
              </span>
            )
          )}
          <span className={`rb-xp${h.level >= MAX_LEVEL ? ' is-paragon' : ''}`} title={h.level >= MAX_LEVEL ? `Paragon ${h.para.l}: ${fmt(h.para.x)} / ${fmt(paragonXp(h.para.l))} XP` : `${fmt(h.xp)} / ${fmt(xpToNext(h.level))} XP`}>
            <i ref={xp} />
          </span>
          <span className="rb-region">
            <b className="rb-region-lv">
              Lv {h.level}
              {h.para.l > 0 ? ` P${h.para.l}` : ''}
            </b>
            {' · '}
            {region.name}
            {w.keyRun ? <b className="rb-mplus"> · Riftstone +{w.keyRun.key}</b> : w.tier > 0 && <b style={{ color: TIERS[w.tier]!.color }}> · {TIERS[w.tier]!.name}</b>}
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
      {w.coop && <PartyFrames engine={engine} />}
      <div className="rb-hud-menu">
        {/* in a party, how many are here; otherwise the way to start one or join a friend's (any level) */}
        {engine.party ? (
          <button className="rb-hudbtn rb-party-chip" onClick={() => engine.openPanel('party')} aria-label="Your party" title={engine.touchMode ? 'Your party' : 'Your party (O)'}>
            Party {engine.party.view ? engine.party.view.seats.filter((x) => x.online).length : '…'}
          </button>
        ) : (
          <HudButton icon="party" label="Play together" onClick={() => engine.openPanel('party')} kbd="O" engine={engine} />
        )}
        <HudButton icon="bag" label="Hero & bag" badge={fresh || undefined} onClick={() => engine.openPanel('hero')} kbd="I" engine={engine} />
        <HudButton icon="star" label="Talents" badge={points || undefined} onClick={() => engine.openPanel('talents')} kbd="K" engine={engine} />
        {/* spare: a tab of the Hero panel too, so a narrow screen can do without the button */}
        <HudButton icon="skills" label="Skills" onClick={() => engine.openPanel('skills')} kbd="U" engine={engine} spare />
        {/* on touch the tracker opens the quests and the minimap the map (and both are tabs of the Hero panel) */}
        <HudButton icon="scroll" label="Quests" onClick={() => engine.openPanel('quests')} kbd="J" engine={engine} spare />
        <HudButton icon="map" label="Map" onClick={() => engine.openPanel('map')} kbd="M" engine={engine} spare />
        <HudButton icon="pause" label="Pause" onClick={() => engine.togglePause()} kbd="Esc" engine={engine} />
        <GameMenuButton className="rb-hudbtn" />
      </div>
      <Minimap engine={engine} />
      <div className="rb-encounter" ref={enc} hidden />
    </>
  );
}

/** The party's other heroes: a name and a health bar each, under the hero's own. */
function PartyFrames({ engine }: { engine: SigilEngine }) {
  const bars = useRef<(HTMLElement | null)[]>([]);
  useFrame(engine, (w) => {
    const list = w.coop?.ghosts ?? [];
    list.forEach((g, i) => {
      const b = bars.current[i];
      if (b) b.style.width = `${g.dead ? 0 : Math.max(0, Math.min(1, g.hp / g.maxHp)) * 100}%`;
    });
  });
  const ghosts = engine.world?.coop?.ghosts ?? [];
  return (
    <ul className="rb-party-frames" aria-label="Your party">
      {ghosts.map((g, i) => (
        <li key={g.n}>
          <span>{g.name}</span>
          <span className="rb-party-hp">
            <i
              ref={(el) => {
                bars.current[i] = el;
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function HudButton({ icon, label, badge, onClick, kbd, engine, spare }: { icon: string; label: string; badge?: number; onClick: () => void; kbd: string; engine: SigilEngine; spare?: boolean }) {
  return (
    <button className={`rb-hudbtn is-${icon}${spare ? ' is-spare' : ''}`} onClick={onClick} aria-label={badge ? `${label} (${badge} new)` : label} title={engine.touchMode ? label : `${label} (${kbd})`}>
      <img src={uiIcon(icon, 3)} alt="" />
      {badge ? <span className="rb-badge">{badge}</span> : null}
    </button>
  );
}

/** The seven points of the Hallow King's crown (World.crown), in the order the bar shows them, and their colors. */
const CROWN_POINTS: [string, string, string][] = [
  ['stone', 'Stone', '#c8b898'],
  ['embers', 'Embers', '#ff7a3d'],
  ['sun', 'the Sun', '#ffd84d'],
  ['thorns', 'Thorns', '#6ad05a'],
  ['frost', 'Frost', '#bfe8ff'],
  ['veil', 'the Veil', '#c58cff'],
  ['tides', 'Tides', '#4ab8ff'],
];

/** What a boss's standing order says (World.order: Hallvor's watch), under its bar. */
const ORDER_SAY = { hold: 'Hold your post: don’t move', march: 'Walk the round: keep moving' } as const;

function BossBar({ engine }: { engine: SigilEngine }) {
  const bar = useRef<HTMLElement>(null);
  const lag = useRef<HTMLElement>(null);
  const order = useRef<HTMLSpanElement>(null);
  const orderSay = useRef<HTMLElement>(null);
  const orderFill = useRef<HTMLElement>(null);
  const ward = useRef<HTMLElement>(null);
  const wardFill = useRef<HTMLElement>(null);
  const wardTop = useRef(0);
  const crown = useRef<HTMLSpanElement>(null);
  const crownSaid = useRef('');
  const shown = useRef(1);
  const cast = useRef<HTMLSpanElement>(null);
  const castFill = useRef<HTMLElement>(null);
  const pips = useRef<HTMLSpanElement>(null);
  const pipsSaid = useRef('');
  const call = useRef<HTMLSpanElement>(null);
  const callSay = useRef<HTMLElement>(null);
  const callFill = useRef<HTMLElement>(null);
  const callHint = useRef<HTMLElement>(null);
  const shoutSeen = useRef<Callout | null>(null);
  // (a caption drawn on the picture keeps out from under the call: render/renderer.ts)
  useHudBox(engine, 'call', call);
  useFrame(engine, (w) => {
    const b = w.boss();
    const share = b ? Math.max(0, b.hp / b.maxHp) : 0;
    shown.current = Math.max(share, shown.current - 0.004);
    if (bar.current) bar.current.style.width = `${share * 100}%`;
    if (lag.current) lag.current.style.width = `${shown.current * 100}%`;
    // a ward over the boss (Prior Vessant's will while he sings): its own bar, emptying as it is broken
    const sh = b && b.shield > 0 ? b.shield : 0;
    wardTop.current = sh > 0 ? Math.max(wardTop.current, sh) : 0;
    if (ward.current) ward.current.hidden = sh <= 0;
    if (wardFill.current && sh > 0) wardFill.current.style.width = `${(sh / wardTop.current) * 100}%`;
    // the Hallow King's crown: a point lit for each sigil it holds
    const c = crown.current;
    if (c) {
      const said = w.crown ? w.crown.join(',') : '';
      if (said !== crownSaid.current) {
        crownSaid.current = said;
        c.hidden = !w.crown;
        for (const [i, el] of [...c.querySelectorAll('i')].entries()) el.dataset.on = w.crown?.includes(CROWN_POINTS[i]![0]) ? '1' : '0';
        c.title = w.crown ? `The Crown holds: ${w.crown.map((id) => `the Sigil of ${CROWN_POINTS.find((x) => x[0] === id)?.[1] ?? id}`).join(', ')}` : '';
      }
    }
    // what it is winding up, if that takes a second or more
    const wind = b ? windingUp(w) : null;
    if (cast.current) cast.current.hidden = !wind;
    if (wind && castFill.current) castFill.current.style.width = `${wind.k * 100}%`;
    // its state, in words (rebuilt only when it changes)
    const list = b ? bossPips(b) : [];
    const key = list.map((p) => p.id + p.label).join('|');
    if (pips.current && key !== pipsSaid.current) {
      pipsSaid.current = key;
      pips.current.replaceChildren(
        ...list.map((p) => {
          const el = document.createElement('i');
          el.dataset.tone = p.tone;
          el.textContent = p.label;
          return el;
        }),
      );
    }
    // what it is doing, called out: a few words, a bar running down, and what to do about it the first time
    const s = w.shout;
    if (call.current && callSay.current && callFill.current && callHint.current) {
      call.current.hidden = !s;
      if (s) {
        if (s !== shoutSeen.current) {
          shoutSeen.current = s;
          callSay.current.textContent = sixWords(s.text);
          call.current.style.setProperty('--call', s.color);
          const due = !!s.hint && mechanicDue(w.hero, engine.settings.tutorial, s.text);
          callHint.current.hidden = !due;
          callHint.current.textContent = due ? s.hint! : '';
          if (due) mechanicShown(w.hero, s.text);
        }
        callFill.current.style.width = `${Math.max(0, 1 - s.t / s.dur) * 100}%`;
      } else shoutSeen.current = null;
    }
    // the order: called (it pulses until it holds), then holding (its time running out)
    const o = w.order;
    const el = order.current;
    if (!el || !orderSay.current || !orderFill.current) return;
    el.hidden = !o;
    if (!o) return;
    const on = w.time >= o.from;
    el.dataset.kind = o.kind;
    el.dataset.on = on ? '1' : '0';
    orderSay.current.textContent = ORDER_SAY[o.kind];
    orderFill.current.style.width = `${on ? Math.max(0, (o.until - w.time) / (o.until - o.from)) * 100 : 100}%`;
  });
  const boss = engine.ui.boss!;
  const def = engine.world?.boss()?.boss?.def;
  const ticks = def ? phaseTicks(def) : [];
  return (
    <div className="rb-bossbar" role="status">
      <strong>{boss.name}</strong>
      <span className="rb-boss-title">{boss.title}</span>
      <span className="rb-boss-track">
        <i ref={lag} className="rb-boss-lag" />
        <i ref={bar} className="rb-boss-fill" />
        {ticks.map((at) => (
          <u key={at} className="rb-boss-tick" style={{ left: `${at * 100}%` }} />
        ))}
      </span>
      <span ref={pips} className="rb-boss-pips" />
      <span ref={cast} className="rb-boss-cast" hidden aria-label="Winding up">
        <i ref={castFill} />
      </span>
      <span ref={ward} className="rb-boss-ward" hidden>
        <i ref={wardFill} />
      </span>
      <span ref={crown} className="rb-boss-crown" hidden aria-label="The sigils in the Hallow King’s crown">
        {CROWN_POINTS.map(([id, , color]) => (
          <i key={id} style={{ '--pt': color } as CSSProperties} data-on="0" />
        ))}
      </span>
      <span ref={order} className="rb-boss-order" hidden>
        <b ref={orderSay} />
        <i ref={orderFill} />
      </span>
      <span ref={call} className="rb-boss-call" hidden>
        <span className="rb-boss-call-line">
          <em aria-hidden="true">!</em>
          <b ref={callSay} />
        </span>
        <i className="rb-boss-call-time">
          <i ref={callFill} />
        </i>
        <small ref={callHint} hidden />
      </span>
    </div>
  );
}

/**
 * The hero's cast bar (a spell with a cast time: sim/cast.ts updateCasting), pinned under the hero where the eye
 * already is: the spell's name over a bar that fills in its element's color. When the spell goes the bar
 * flashes full; when the cast is stopped it says so; either way it fades out.
 */
/** How tall the hero stands, in world pixels, for the glow round them. */
const HERO_TALL = 28;
/** The last seconds of a proc: its glow flickers, as a warning that it is about to go. */
const PROC_ENDING = 1.5;

/**
 * A proc waiting on the hero (an instant Flame Pillar, a free Multishot, a specialization's combo): two crescents of
 * its color either side of the hero, where the eye already is, instead of a chip in the corner (the owner: "the
 * flame pillar instant proc on mages (and any other proc) is currently below the quest, make it so that its a visual
 * ... around the character"). A proc with charges lights one side a charge; one that builds in stacks glows fainter
 * until it is whole; a whole one pulses, and the last moments flicker.
 */
function ProcAura({ engine }: { engine: SigilEngine }) {
  const el = useRef<HTMLDivElement>(null);
  const said = useRef('');
  const grad = useId().replace(/:/g, '');
  useFrame(engine, (w) => {
    const d = el.current;
    if (!d) return;
    const c = procsNow(w)[0];
    const p = w.player;
    d.hidden = !c || p.dead || !!w.scene;
    if (d.hidden || !c) {
      said.current = '';
      return;
    }
    const key = `${c.id}|${c.n}|${c.of}|${c.full}`;
    if (key !== said.current) {
      said.current = key;
      d.style.setProperty('--proc', c.color);
      d.style.setProperty('--fill', String(c.stacks ? Math.max(0.15, Math.min(1, c.n / Math.max(1, c.of))) : 1));
      d.dataset.state = c.full ? 'full' : 'building';
      // (a proc of several casts shows what it has left: both sides for two or more, one for the last)
      d.dataset.sides = !c.stacks && c.of > 1 && c.n < 2 ? 'one' : 'both';
      d.setAttribute('aria-label', c.stacks ? `${c.name}: ${c.n} of ${c.of}` : c.of > 1 ? `${c.name}: ${c.n} left` : c.name);
    }
    d.dataset.ending = c.full && c.secs < PROC_ENDING ? '1' : '0';
    d.dataset.calm = engine.settings.reducedMotion ? '1' : '0';
    // round the hero's body: from the feet to the top of the head, wherever the camera is and however near
    const foot = engine.renderer.toScreenAt(p.x, p.y, 0);
    const head = engine.renderer.toScreenAt(p.x, p.y, HERO_TALL);
    const tall = Math.max(22, Math.min(160, foot.y - head.y));
    d.style.setProperty('--h', `${Math.round(tall)}px`);
    d.style.transform = `translate(${Math.round((foot.x + head.x) / 2)}px, ${Math.round((foot.y + head.y) / 2)}px)`;
  });
  const wing = (side: 'l' | 'r') => (
    <svg className={`rb-proc-wing is-${side}`} viewBox="0 0 40 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${grad}-${side}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="0.7" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* a crescent, and shards along its outer edge */}
      <path fill={`url(#${grad}-${side})`} d="M35 2 C8 22 6 78 35 98 C21 80 19 20 35 2 Z" />
      <path fill="currentColor" opacity="0.85" d="M15 21 L3 13 L11 30 Z M9 41 L-1 37 L8 51 Z M9 60 L-1 64 L9 70 Z M15 80 L5 90 L18 87 Z" />
      <path fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.4" strokeLinecap="round" d="M33 6 C12 25 11 75 33 94" />
    </svg>
  );
  return (
    <div ref={el} className="rb-proc" hidden role="status">
      {wing('l')}
      {wing('r')}
    </div>
  );
}

function CastBar({ engine }: { engine: SigilEngine }) {
  const ref = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLElement>(null);
  const shown = useRef('');
  useFrame(engine, (w) => {
    const el = ref.current;
    if (!el || !name.current || !fill.current) return;
    const p = w.player;
    const c = p.casting;
    const end = w.castEnd;
    const ending = !c && !!end && w.time - end.at < 0.5 && shown.current !== '';
    el.hidden = !c && !ending;
    if (el.hidden) {
      shown.current = '';
      return;
    }
    if (c) {
      if (shown.current !== c.spec.id) {
        shown.current = c.spec.id;
        name.current.textContent = SKILLS[c.spec.id]?.name ?? '';
        const tone = TONES[c.spec.dmgType] ?? TONES.arcane!;
        el.style.setProperty('--cast-a', tone.a);
        el.style.setProperty('--cast-b', tone.b);
      }
      el.dataset.state = 'casting';
      fill.current.style.width = `${Math.min(1, c.t / c.total) * 100}%`;
    } else {
      el.dataset.state = end!.fired ? 'done' : 'stopped';
      if (end!.fired) fill.current.style.width = '100%';
      else if (shown.current !== '-') {
        // (not a spell's id: casting the same spell again names it again)
        shown.current = '-';
        name.current.textContent = 'Interrupted';
      }
      el.style.opacity = `${Math.max(0, 1 - (w.time - end!.at) / 0.5)}`;
    }
    if (c) el.style.opacity = '';
    // under the hero's feet, kept inside the view
    const at = engine.renderer.toScreen(p.x, p.y);
    const host = el.offsetParent as HTMLElement | null;
    const bw = el.offsetWidth;
    const maxX = (host?.clientWidth ?? 800) - bw - 8;
    const maxY = (host?.clientHeight ?? 400) - el.offsetHeight - 8;
    el.style.left = `${Math.round(Math.max(8, Math.min(maxX, at.x - bw / 2)))}px`;
    el.style.top = `${Math.round(Math.max(8, Math.min(maxY, at.y + 40)))}px`;
  });
  return (
    <div className="rb-castbar" ref={ref} hidden role="status" aria-label="Casting">
      <span className="rb-castbar-name" ref={name} />
      <span className="rb-castbar-track">
        <i ref={fill} />
      </span>
    </div>
  );
}

/** A Riftstone run's clock: time so far (falls included) against the dungeon's, the rooms done, the week's affixes. */
function KeyClock({ engine }: { engine: SigilEngine }) {
  const k = engine.world!.keyRun!;
  const time = useRef<HTMLElement>(null);
  const bar = useRef<HTMLElement>(null);
  const rooms = useRef<HTMLElement>(null);
  const pace = useRef<HTMLElement>(null);
  useFrame(engine, (world) => {
    const run = world.keyRun;
    if (!run) return;
    const t = run.end ? run.end.time : run.t + run.deaths * KEY_DEATH;
    // what the run is racing for: three stones inside 60% of the clock, two inside 80%, one inside it
    if (pace.current) {
      const up = keyUpgrade(t, run.par);
      const text = run.end ? (up > 0 ? `In time: +${up}` : 'Out of time') : up === 3 ? 'Racing for +3' : up === 2 ? 'Racing for +2' : up === 1 ? 'Racing for +1' : 'Out of time: finish for marks';
      if (pace.current.textContent !== text) {
        pace.current.textContent = text;
        pace.current.className = `rb-keypace is-up${Math.max(0, up)}`;
      }
    }
    if (time.current) {
      time.current.textContent = `${clockText(t)} / ${clockText(run.par)}`;
      time.current.classList.toggle('is-late', t > run.par);
    }
    if (bar.current) bar.current.style.width = `${Math.min(100, (t / run.par) * 100)}%`;
    if (rooms.current) {
      const done = world.encounters.filter((e) => e.state === 'cleared').length;
      rooms.current.textContent = `Rooms ${done}/${world.encounters.length}${run.deaths ? ` · ${run.deaths} fall${run.deaths === 1 ? '' : 's'} (−${run.deaths * KEY_DEATH} s)` : ''}`;
    }
  });
  return (
    <div className="rb-tracker rb-keyclock" role="timer" aria-label={`Riftstone +${k.key} clock`}>
      <strong>Riftstone +{k.key}</strong>
      <b ref={time} className="rb-keytime" />
      <span className="rb-keybar">
        <i ref={bar} />
        <em style={{ left: '60%' }} />
        <em style={{ left: '80%' }} />
      </span>
      <span ref={pace} className="rb-keypace" />
      <span ref={rooms} className="rb-small" />
      {k.affixes.length > 0 && <span className="rb-small rb-dim">{k.affixes.map((a) => KEY_AFFIXES[a].name).join(' · ')}</span>}
    </div>
  );
}

/** Whether the quest tracker is folded on touch (kept while playing; the quest stays marked on the map). */
const trackerFold = { folded: false };
const rememberFold = (to: boolean): void => {
  trackerFold.folded = to;
};

function Tracker({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const [folded, setFolded] = useState(trackerFold.folded);
  const fold = (to: boolean): void => {
    rememberFold(to);
    setFolded(to);
  };
  // someone speaking across it (a phone on its side: the quest sits under the hero's bars, where a shout from the
  // left of the picture is written). The renderer writes the line beside the quest when there is room for it there;
  // where there isn't, the words win, and the quest fades until they are said
  const box = useRef<HTMLElement>(null);
  const setBox = (el: HTMLElement | null): void => {
    box.current = el;
  };
  useHudBox(engine, 'quest', box);
  useFrame(engine, () => {
    const el = box.current;
    if (!el) return;
    const r = engine.renderer as SigilEngine['renderer'] | undefined;
    const at = r?.hudBoxes.get('quest');
    el.classList.toggle('is-under-speech', !!r && !!at && r.speechBoxes.some((s) => boxesMeet(s, at, 2)));
  });
  const q = trackedQuest(h, engine.world?.region.id);
  if (engine.ui.boss) return null;
  // the main story waiting for a level: said, so it never just stops (PROGRESSION_BALANCE.md G)
  const storyOn = !!q && isMainQuest(q.id);
  const gate = storyOn ? undefined : levelGated(h).find((x) => isMainQuest(x.id));
  if (!q) {
    return gate ? (
      <div ref={setBox} className="rb-tracker is-main is-gated">
        <strong>
          <img src={mapIconUrl('offer', 2)} alt="" />
          {gate.name}
        </strong>
        <span>Opens at level {gate.level}</span>
      </div>
    ) : null;
  }
  const pr = questProgress(h, q);
  const ready = questState(h, q.id) === 'ready';
  const who = ready ? turnInNpc(q) : null;
  const main = isMainQuest(q.id);
  const icon = mapIconUrl(ready ? (main ? 'handin' : 'handinSide') : main ? 'offer' : 'offerSide', 2);
  // on touch a tap folds it to its mark (the quest stays on the map), and a tap opens it again
  if (engine.touchMode && folded)
    return (
      <button ref={setBox} className={`rb-tracker is-folded${main ? ' is-main' : ' is-side'}`} onClick={() => fold(false)} aria-label={`Quest: ${q.name}. Tap to show`}>
        <img src={icon} alt="" />
      </button>
    );
  return (
    <button ref={setBox} className={`rb-tracker${main ? ' is-main' : ' is-side'}`} onClick={() => (engine.touchMode ? fold(true) : engine.showOnMap(q.id))} title={engine.touchMode ? 'Tap to fold' : 'Show on the map'}>
      <strong>
        <img src={icon} alt="" />
        {q.name}
      </strong>
      <span>
        {ready ? `Return to ${who ? NPCS[who]?.name : 'them'}` : currentObjective(h, q).label}
        {!ready && pr.of > 1 ? ` ${pr.n}/${pr.of}` : ''}
      </span>
      {gate && <em className="rb-tracker-gate">Next story quest opens at level {gate.level}</em>}
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
          // (on touch a plain drop isn't a card over the fight: the bag button counts what's new)
          if (engine.touchMode && t.text === itemName(item) && item.r !== 'legendary') return null;
          const owned = h.bag.some((i) => i.uid === item.uid);
          const lines = modLines(itemMods(item));
          const canWear = usableBy(item, h.cls);
          return (
            <div key={t.id} className={`rb-toast is-loot is-${item.r}`} style={{ ['--rc' as string]: rarityColor(item.r) }}>
              <ItemIcon item={item} size={38} />
              <div className="rb-toast-text">
                {t.text !== itemName(item) ? (
                  // news about an item (not a drop): its own words first, the item under them
                  <>
                    <strong>{t.text}</strong>
                    <span style={{ color: 'var(--rc)' }}>{itemName(item)}</span>
                  </>
                ) : (
                  <>
                    <strong>{itemName(item)}</strong>
                    {lines[0] ? <span className="rb-gold">{lines[0]}</span> : <span className="rb-dim">{item.r[0]!.toUpperCase() + item.r.slice(1)} · level {item.il}</span>}
                  </>
                )}
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

export function LevelUpBanner({ engine }: { engine: SigilEngine }) {
  const l = engine.ui.levelUp!;
  // talent points start with the specialization at level 10 (data/talents.ts): before that a level brings
  // health and new skills, never a point
  const gains = [
    l.level === SPEC_LEVEL ? 'Talents open: choose your specialization' : l.level > SPEC_LEVEL ? '+1 talent point' : '',
    l.skills.length ? `New: ${l.skills.map((s) => SKILLS[s]!.name).join(', ')}` : '',
    (SLOT_LEVELS as readonly number[]).includes(l.level) ? 'New skill slot' : '',
  ].filter(Boolean);
  return (
    <div className="rb-levelup" key={`lvl:${l.id}`} aria-live="polite">
      <strong>Level {l.level}</strong>
      <span>{gains.length ? gains.join(' · ') : 'More health'}</span>
    </div>
  );
}

/* ------------------------------------------------------------- overlays */

function Dialogue({ engine }: { engine: SigilEngine }) {
  const d = engine.ui.dialogue!;
  const npc = NPCS[d.npc]!;
  const page = engine.dialoguePage();
  const last = d.i + 1 >= d.lines.length + d.pages.length;
  return (
    <div className={`rb-dialogue${page ? ' is-quest' : ''}`} onClick={() => !last && !page && engine.nextLine()}>
      <div className="rb-dialogue-face">
        <Portrait kind="npc" id={d.npc} size={56} />
      </div>
      <div className="rb-dialogue-body">
        <strong>
          {npc.name} <span className="rb-dim">· {npc.title}</span>
        </strong>
        {page ? <QuestPage engine={engine} kind={page.kind} id={page.quest} last={last} /> : <p key={d.i}>{d.lines[d.i]}</p>}
        {!page && (
          <div className="rb-dialogue-actions">
            {npc.shop && (
              <button className="rb-btn is-small is-gold" onClick={() => engine.openShop(npc.shop!, npc.id)}>
                Trade
              </button>
            )}
            {last && npc.service === 'respec' && (
              <button className="rb-btn is-small" onClick={() => engine.openPanel('talents')}>
                Talents
              </button>
            )}
            {/* (the box itself also turns the page on a click: the button's click stops here, or it would turn two) */}
            <button
              className={`rb-btn is-small${npc.shop ? '' : ' is-gold'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (last) engine.closeDialogue();
                else engine.nextLine();
              }}
              autoFocus={!npc.shop}
            >
              {last ? 'Farewell' : 'Next ▸'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A quest in a conversation, as WoW shows it: offered (its story, its steps, what it pays; Accept), handed in
 * (the thanks and the reward; Complete), or a talk quest just paid.
 */
function QuestPage({ engine, kind, id, last }: { engine: SigilEngine; kind: 'offer' | 'handin' | 'paid'; id: string; last: boolean }) {
  const h = engine.hero!;
  const q = QUEST_DEFS[id]!;
  const main = isMainQuest(id);
  const rewards = questRewards(h, q);
  const lines = kind === 'offer' ? (q.offer ?? [q.text]) : kind === 'handin' ? (q.thanks ?? [q.reward.text ?? 'You did what was asked. Thank you.']) : [q.reward.text ?? 'That is what I needed to hear.'];
  return (
    <div className="rb-qpage" key={`${kind}:${id}`}>
      <span className={`rb-qpage-title${main ? ' is-main' : ' is-side'}`}>
        <img src={mapIconUrl(kind === 'offer' ? (main ? 'offer' : 'offerSide') : main ? 'handin' : 'handinSide', 2)} alt="" />
        {kind === 'offer' ? '' : 'Complete: '}
        {q.name}
        <em>{main ? 'Story' : 'Side quest'}</em>
      </span>
      <div className="rb-qpage-text">
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        {kind === 'offer' && (
          <ul className="rb-qpage-steps">
            {questSteps(q).map((o, i) => (
              <li key={i}>{o.label}</li>
            ))}
            {turnInNpc(q) && <li className="rb-dim">Return to {NPCS[turnInNpc(q)!]?.name}</li>}
          </ul>
        )}
      </div>
      {rewards.length > 0 && (
        <div className="rb-qpage-rewards">
          <span className="rb-kicker">{kind === 'offer' ? 'Reward' : 'You receive'}</span>
          {rewards.map((r, i) => (
            <span key={i} className={`rb-qreward is-${r.kind}`} style={r.rarity ? { ['--rc' as string]: rarityColor(r.rarity) } : undefined}>
              {r.text}
            </span>
          ))}
        </div>
      )}
      <div className="rb-dialogue-actions">
        {kind === 'offer' ? (
          <>
            <button className="rb-btn is-small" onClick={() => (last ? engine.closeDialogue() : engine.nextLine())}>
              Not now
            </button>
            <button className="rb-btn is-small is-gold" onClick={() => engine.acceptOffer()} autoFocus>
              Accept
            </button>
          </>
        ) : kind === 'handin' ? (
          <button className="rb-btn is-small is-gold" onClick={() => engine.completeHandIn()} autoFocus>
            Complete quest
          </button>
        ) : (
          <button className="rb-btn is-small is-gold" onClick={() => (last ? engine.closeDialogue() : engine.nextLine())} autoFocus>
            {last ? 'Farewell' : 'Next ▸'}
          </button>
        )}
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
  // in a party the world goes on behind this menu; the leader's leaving ends the run for everyone
  const party = !!engine.coop;
  const leads = engine.coop?.role === 'host' && engine.party?.view?.mode === 'rift';
  return (
    <div className="rb-modal">
      <div className="rb-card rb-pause" role="dialog" aria-modal="true" aria-label={party ? 'Menu' : 'Paused'}>
        <h2>{party ? 'Menu' : 'Paused'}</h2>
        {party && <p className="rb-dim rb-small">Not paused: your party fights on.</p>}
        <button className="rb-btn is-gold is-big" onClick={() => engine.togglePause()} autoFocus>
          Resume
        </button>
        <button className="rb-btn" onClick={() => engine.openPanel('settings')}>
          Settings
        </button>
        {!w.safe &&
          engine.canGoHome &&
          (leaving ? (
            <button className="rb-btn is-danger" onClick={() => engine.returnHome()}>
              {leads ? 'End the run for the whole party? You keep everything you found.' : 'Leave the expedition? You keep everything you found.'}
            </button>
          ) : (
            <button className="rb-btn" onClick={() => setLeaving(true)}>
              Return to {REGIONS[HOME].name}
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
        <p className="rb-dim">{engine.coop ? 'Everything you found is safe. Your party fights on: rise beside them.' : 'Everything you found is safe. The room you fell in resets.'}</p>
        <button className="rb-btn is-gold is-big" onClick={() => engine.respawn()} autoFocus>
          Rise again
        </button>
        {!w.safe && engine.canGoHome && (
          <button className="rb-btn" onClick={() => engine.returnHome()}>
            Return to {REGIONS[HOME].name}
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
      <div className="rb-card rb-reward" role="dialog" aria-modal="true" aria-label="Dungeon cleared">
        <span className="rb-kicker">{r.key ? `Riftstone +${r.key.key}` : TIERS[r.tier]!.name} · {REGIONS[r.region].name}</span>
        <h2>{r.key ? (r.key.up > 0 ? 'In time!' : 'Out of time') : r.region === 'crypt' ? 'The Rift is closed!' : `${REGIONS[r.region].name} cleared!`}</h2>
        {r.key && (
          <div className={`rb-keyend${r.key.up > 0 ? ' is-in' : ' is-late'}`}>
            <span className="rb-keytime">
              {clockText(r.key.time)} <span className="rb-dim">/ {clockText(r.key.par)}</span>
            </span>
            <span>
              {r.key.up > 0
                ? `${r.key.up === 3 ? 'Under 60% of the clock' : r.key.up === 2 ? 'Under 80% of the clock' : 'Inside the clock'}: Riftstone +${r.key.key + r.key.up} is open${r.key.stone > r.key.key + r.key.up ? ` (your highest is +${r.key.stone})` : ''}.`
                : 'Late: the run still pays, and nothing is lost. Try it again, or a level lower.'}
              {r.key.best ? ' A new best here.' : ''}
            </span>
            <span className="rb-small rb-dim">
              {r.key.deaths ? `${r.key.deaths} fall${r.key.deaths === 1 ? '' : 's'} (−${r.key.deaths * KEY_DEATH} s) · ` : ''}+{r.key.marks} Sigil Marks
            </span>
          </div>
        )}
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
          {!r.key && (
            <span>
              <b>
                {mins}:{String(secs).padStart(2, '0')}
              </b>{' '}
              time
            </span>
          )}
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
          {r.key && !engine.party && (
            <button className="rb-btn" onClick={() => engine.keyAgain()}>
              Riftstone +{h.keystone} here
            </button>
          )}
          {engine.canGoHome && (
            <button className="rb-btn is-gold" onClick={() => engine.returnHome()} autoFocus>
              Return to {REGIONS[HOME].name}
            </button>
          )}
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
  if (!portrait || !engine.touchMode || engine.turned || engine.settings.rotateSeen) return null;
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

