import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameHost, GameModuleProps } from '../../platform/contract';
import { RiftEngine } from './engine';
import { GameScreen } from './ui/GameScreen';
import { CreateScreen, TitleScreen } from './ui/Title';
import './Game.css';

/**
 * Riftbound: a pixel-art action RPG. The arcade bumps restartKey on Restart (a fresh mount reloads
 * the save); pauseKey asks for a pause when the player leaves full screen or scrolls away.
 */
export default function Game({ host, restartKey, pauseKey, playerName }: GameModuleProps) {
  return <Riftbound key={restartKey} host={host} pauseKey={pauseKey} playerName={playerName ?? ''} />;
}

function Riftbound({ host, pauseKey, playerName }: { host: GameHost; pauseKey?: number; playerName: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<RiftEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const e = new RiftEngine(canvas, host, playerName);
    e.attach(stage);
    setEngine(e);
    // a handle for automated play-testing on the dev server only (never in a build)
    if (import.meta.env.DEV) (window as unknown as { __rb?: RiftEngine }).__rb = e;
    host.report({ type: 'ready' });
    // the canvas follows the stage's size; the view picks a crisp whole-number pixel scale
    const fit = (): void => {
      const r = stage.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      e.dpr = dpr;
      e.renderer.resize(r.width, r.height, dpr, e.touchMode);
      e.setToWorld((x, y) => e.renderer.toWorld(x, y, dpr));
      e.bump();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    window.addEventListener('orientationchange', fit);
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
    stage.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', fit);
      stage.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey);
      e.detach();
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
      <canvas ref={canvasRef} className="rb-canvas" aria-label="Riftbound game view" />
      {engine && <Screens engine={engine} />}
    </div>
  );
}

function Screens({ engine }: { engine: RiftEngine }) {
  useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
  const ui = engine.ui;
  if (ui.screen === 'title') return <TitleScreen engine={engine} />;
  if (ui.screen === 'create') return <CreateScreen engine={engine} />;
  return <GameScreen engine={engine} />;
}
