import { hudScale } from './render/camera';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { takeSavesLive } from '../../platform/syncGate';
import { SigilEngine } from './engine';
import { ArrivalCard } from './ui/Arrival';
import { GameScreen } from './ui/GameScreen';
import { isTurned, setTurned } from './ui/turn';
import { FullscreenContext } from './ui/fullscreen';
import { CreateScreen, TitleScreen } from './ui/Title';
import { warmPortraits } from './render3d/portrait';
import './Game.css';

/**
 * Sigilfall: a low-poly action RPG. The arcade bumps restartKey on Restart (a fresh mount reloads
 * the save); pauseKey asks for a pause when the player leaves full screen or scrolls away.
 */
export default function Game({ host, restartKey, pauseKey, playerName, enterFullscreen }: GameModuleProps) {
  return (
    <FullscreenContext.Provider value={enterFullscreen}>
      <Sigilfall key={restartKey} host={host} pauseKey={pauseKey} playerName={playerName ?? ''} />
    </FullscreenContext.Provider>
  );
}

function Sigilfall({ host, pauseKey, playerName }: { host: GameHost; pauseKey?: number; playerName: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<SigilEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const e = new SigilEngine(canvas, host, playerName);
    e.attach(stage);
    setEngine(e);
    // a copy from the player's other device is taken in while the game is open, not only once it closes: the hero
    // screen shows the account's heroes, never an older copy this browser kept
    const stopLive = takeSavesLive('sigilfall', () => e.takeArrivedSave());
    // a handle for automated play-testing on the dev server only (never in a build)
    if (import.meta.env.DEV) {
      (window as unknown as { __rb?: SigilEngine }).__rb = e;
      // review screenshots: the game view drawn at a chosen screen size (CSS px, at 1×), saved by the dev server;
      // `crop` keeps only a box of that many canvas pixels round the middle (a close look at the hero)
      (window as unknown as { __rbShot?: (name: string, size?: [number, number], touch?: boolean, crop?: [number, number]) => Promise<string> }).__rbShot = async (name, size, touch, crop) => {
        const r = e.renderer;
        if (size) r.resize(size[0], size[1], 1, touch ?? e.touchMode);
        if (e.world) r.draw(e.world, 0.016, performance.now() / 1000);
        let src: HTMLCanvasElement = r.canvas;
        if (crop) {
          src = document.createElement('canvas');
          src.width = crop[0];
          src.height = crop[1];
          const g = src.getContext('2d')!;
          g.imageSmoothingEnabled = false;
          g.drawImage(r.canvas, (r.canvas.width - crop[0]) / 2, (r.canvas.height - crop[1]) / 2 - crop[1] * 0.08, crop[0], crop[1], 0, 0, crop[0], crop[1]);
        }
        const blob = await new Promise<Blob | null>((ok) => src.toBlob(ok, name.endsWith('.jpg') ? 'image/jpeg' : 'image/png', 0.88));
        if (size) fit(true);
        const res = await fetch(`/__sigilfall/shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
        return res.text();
      };
    }
    // the site's pictures of the game, rendered from its own hall (render3d/keyArt.ts; scripts/sigilfall-key-art.mjs)
    if (import.meta.env.DEV) {
      (window as unknown as { __rbKeyArt?: (name: string) => Promise<string> }).__rbKeyArt = async (name) => {
        const { keyArt, KEY_ART_SHOTS } = await import('./render3d/keyArt');
        return keyArt(KEY_ART_SHOTS[name]!);
      };
    }
    host.report({ type: 'ready' });
    // A touch screen: nothing on the page is selected while the game is up. Tapping the game's buttons fast, the phone
    // took two taps for "select this word" (of the page round the game, or of the game's own words) and put its
    // Copy / Look Up bar over the fight (the owner: "if i spam on the buttons, sometimes this pop up appears"). The
    // page's CSS says no (Game.css), and a selection that starts all the same is let go at once. Not in a field.
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const inField = (n: Node | null): boolean => {
      const el = n instanceof Element ? n : (n?.parentElement ?? null);
      return !!el?.closest('input, textarea, [contenteditable="true"]');
    };
    const noSelection = (): void => {
      const sel = document.getSelection();
      if (sel && !sel.isCollapsed && !inField(sel.anchorNode)) sel.removeAllRanges();
    };
    const noMenu = (e: Event): void => {
      if (!inField(e.target as Node | null)) e.preventDefault();
    };
    if (coarse) {
      document.documentElement.classList.add('rb-touch-playing');
      document.addEventListener('selectionchange', noSelection);
      stage.addEventListener('contextmenu', noMenu);
    }
    // a field being typed in (a hero's name, a party code): the phone's keyboard shortens the screen meanwhile
    const typing = (): boolean => {
      const a = document.activeElement;
      return (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) && stage.contains(a);
    };
    // the canvas follows the stage's size; the view picks a crisp whole-number pixel scale
    let last = '';
    const fit = (force = false): void => {
      // a phone held upright with the game filling it: the game turns itself to landscape (ui/turn.ts); not
      // while the keyboard is up (it shortens the screen and would flip the layout under the field)
      const box = stage.parentElement ?? stage;
      const pw = box.clientWidth;
      const ph = box.clientHeight;
      const turn = typing() ? stage.classList.contains('is-turned') : e.touchMode && ph > pw * 1.15 && pw > 0;
      stage.classList.toggle('is-turned', turn);
      stage.style.setProperty('--turn-w', `${pw}px`);
      stage.style.setProperty('--turn-h', `${ph}px`);
      setTurned(turn ? stage : null);
      e.turned = turn;
      // its own layout size (a turned box's on-screen rectangle is the other way round)
      const r = { width: stage.offsetWidth, height: stage.offsetHeight };
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      // (Safari's bars coming and going resize the stage often: nothing to do when the size is the same)
      const key = `${r.width}x${r.height}@${dpr}:${e.touchMode}:${turn}`;
      if (key === last && !force) return;
      last = key;
      e.dpr = dpr;
      // how big the HUD is drawn: its own size up to a desk screen of 1366 by 768, and growing with the stage past
      // that (the owner, on a 2560 by 1440 monitor: "the ui gets small af ... it needs to scale with the resolution
      // of the display"). A touch screen's HUD is sized for thumbs already.
      const hud = hudScale(r.width, r.height, e.touchMode);
      stage.style.setProperty('--hud', String(hud));
      e.renderer.hud = hud;
      e.renderer.resize(r.width, r.height, dpr, e.touchMode);
      e.setToWorld((x, y) => e.renderer.toWorld(x, y, dpr));
      e.bump();
    };
    fit();
    // one fit a frame however many resizes come in it
    let frame = 0;
    const refit = (): void => {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        fit();
      });
    };
    const ro = new ResizeObserver(refit);
    ro.observe(stage);
    if (stage.parentElement) ro.observe(stage.parentElement);
    window.addEventListener('orientationchange', refit);
    // a field gets the keyboard: scroll it into view inside its own panel (never the page), once the keyboard is up
    let lift = 0;
    const onFocusIn = (ev: FocusEvent): void => {
      const t = ev.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
      const pane = t.closest<HTMLElement>('.rb-create, .rb-frame-body');
      if (!pane) return;
      clearTimeout(lift);
      lift = window.setTimeout(() => {
        const a = t.getBoundingClientRect();
        const b = pane.getBoundingClientRect();
        // in the pane's own axis (turned: the game's top is the screen's right)
        const top = isTurned() ? b.right - a.right : a.top - b.top;
        const h = isTurned() ? a.width : a.height;
        if (top < 0 || top + h > pane.clientHeight) pane.scrollTop += top - (pane.clientHeight - h) / 2;
      }, 350);
    };
    // the keyboard gone: the turn is worked out again
    const onFocusOut = (): void => refit();
    stage.addEventListener('focusin', onFocusIn);
    stage.addEventListener('focusout', onFocusOut);
    // switch between touch and mouse controls by what the player actually uses
    const onPointer = (ev: PointerEvent): void => {
      e.sound.unlock();
      const touch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
      if (touch !== e.touchMode && (touch || ev.type === 'pointerdown')) {
        e.touchMode = touch;
        fit();
      }
    };
    const onKey = (): void => e.sound.unlock();
    // (a phone lets sound start only from the end of a touch: its beginning doesn't count)
    const onTouchEnd = (): void => e.sound.unlock();
    stage.addEventListener('pointerdown', onPointer, true);
    stage.addEventListener('pointerup', onTouchEnd, true);
    stage.addEventListener('touchend', onTouchEnd, true);
    stage.addEventListener('click', onTouchEnd, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('rb-touch-playing');
      document.removeEventListener('selectionchange', noSelection);
      stage.removeEventListener('contextmenu', noMenu);
      stopLive();
      ro.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(lift);
      window.removeEventListener('orientationchange', refit);
      stage.removeEventListener('focusin', onFocusIn);
      stage.removeEventListener('focusout', onFocusOut);
      stage.removeEventListener('pointerdown', onPointer, true);
      stage.removeEventListener('pointerup', onTouchEnd, true);
      stage.removeEventListener('touchend', onTouchEnd, true);
      stage.removeEventListener('click', onTouchEnd, true);
      window.removeEventListener('keydown', onKey);
      e.detach();
      setTurned(null);
    };
    // the engine lives for this mount (restartKey remounts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the arcade asks for a pause
  const [pauseSeen, setPauseSeen] = useState(pauseKey);
  if (pauseSeen !== pauseKey) {
    setPauseSeen(pauseKey);
    engine?.hostPause();
  }

  return (
    <div className="rb" ref={stageRef}>
      <canvas ref={canvasRef} className="rb-canvas" aria-label="Sigilfall game view" />
      {engine && <Screens engine={engine} />}
      {engine && <ArrivalCard engine={engine} />}
    </div>
  );
}

function Screens({ engine }: { engine: SigilEngine }) {
  useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
  const ui = engine.ui;
  // the menus show the game's own models, so those come first (a moment, once a visit)
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    let on = true;
    const done = (): void => {
      if (on) setWarm(true);
    };
    warmPortraits().then(done, done);
    return () => {
      on = false;
    };
  }, []);
  if (!warm) return <div className="rb-warm" aria-label="Loading" />;
  if (ui.screen === 'title') return <TitleScreen engine={engine} />;
  if (ui.screen === 'create') return <CreateScreen engine={engine} />;
  return <GameScreen engine={engine} />;
}
