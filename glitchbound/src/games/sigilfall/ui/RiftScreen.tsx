import { useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { useAccount } from '../../../platform/account';
import { CLASS_IDS, CLASSES, MAX_LEVEL } from '../data/classes';
import { KEY_DEATH, keyLevelFor, keyLoot, keyParFor, keyScale, riftDungeons } from '../data/keystones';
import type { ClassId } from '../data/types';
import { ECHOES } from '../data/wardens';
import type { SigilEngine } from '../engine';
import { classOpen } from '../progress/paidClasses';
import { trialStone } from '../progress/trial';
import { clockText } from '../sim/world';

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

/**
 * The Rift Trials, straight from the title: a calling, one of its three paths, a stone and a dungeon as the Crown
 * remembers it. They are played with the calling's own ready hero (progress/trial.ts), the same for everyone, not
 * with a hero of the story; each calling keeps the stone it has reached, and that is all a Trial leaves behind.
 */
export function RiftScreen({ engine, onBack }: { engine: SigilEngine; onBack: () => void }) {
  const { me } = useAccount();
  const [pick, setPick] = useState(() => {
    const last = lastPick();
    return classOpen(last.cls, me) ? last : { cls: 'warrior' as ClassId, spec: 0 as 0 | 1 | 2 };
  });
  const top = trialStone(engine.save, pick.cls);
  const [stone, setStone] = useState(top);
  const at = Math.max(1, Math.min(top, stone));
  const pool = riftDungeons(top);
  const [region, setRegion] = useState(pool[0]!.id);
  const picked = pool.find((r) => r.id === region) ?? pool[0]!;
  const seen = ECHOES.filter((e) => top >= e.at);
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
    <div className="rb-rift">
      <div className="rb-create-head">
        <button className="rb-btn is-small is-ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>The Rift Trials</h2>
        <GameMenuButton className="rb-iconbtn" />
      </div>
      <div className="rb-rift-cols">
        <section className="rb-rift-pick">
          <p className="rb-rift-lead">The Ash Crown keeps everything it has fed on. Each stone opens a dungeon as the Crown remembers it, against the clock. You go in as a calling’s own champion, the same for everyone: what counts is how you play.</p>
          <div className="rb-rift-classes" role="radiogroup" aria-label="Calling">
            {CLASS_IDS.map((id) => {
              const open = classOpen(id, me);
              return (
                <button key={id} role="radio" aria-checked={id === pick.cls} aria-disabled={!open} className={`rb-rift-class${id === pick.cls ? ' is-on' : ''}${open ? '' : ' is-locked'}`} style={{ ['--c' as string]: CLASSES[id].colors.accent }} title={open ? undefined : `${CLASSES[id].name}: unlock it in the shop`} onClick={() => open && choose(id, 0)}>
                  <strong>{CLASSES[id].name}</strong>
                  <span>+{trialStone(engine.save, id)}</span>
                </button>
              );
            })}
          </div>
          <div className="rb-seg rb-rift-paths" role="radiogroup" aria-label="Path">
            {CLASSES[pick.cls].trees.map((t, i) => (
              <button key={t.name} role="radio" aria-checked={i === pick.spec} className={i === pick.spec ? 'is-on' : ''} style={{ color: t.color }} title={t.blurb} onClick={() => choose(pick.cls, i as 0 | 1 | 2)}>
                {t.name}
              </button>
            ))}
          </div>
          <p className="rb-small rb-dim">
            {CLASSES[pick.cls].trees[pick.spec].role}: {CLASSES[pick.cls].trees[pick.spec].blurb}
          </p>
          <div className="rb-key-row">
            <button className="rb-btn is-small" aria-label="One level lower" disabled={at <= 1} onClick={() => setStone(at - 1)}>
              −
            </button>
            <strong className="rb-key-lvl">Riftstone +{at}</strong>
            <button className="rb-btn is-small" aria-label="One level higher" disabled={at >= top} onClick={() => setStone(at + 1)}>
              +
            </button>
          </div>
          <ul className="rb-rift-dungeons" role="radiogroup" aria-label="Dungeon">
            {pool.map((r) => (
              <li key={r.id}>
                <button role="radio" aria-checked={r.id === picked.id} className={r.id === picked.id ? 'is-on' : ''} onClick={() => setRegion(r.id)}>
                  <strong>{r.name}</strong>
                  <span className="rb-dim">Clock {clockText(keyParFor(r, MAX_LEVEL))}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="rb-small rb-dim">
            Enemies at level {keyLevelFor(MAX_LEVEL)}, ×{sc.hp.toFixed(1)} health and ×{sc.dmg.toFixed(1)} damage. Beat the clock and the {CLASSES[pick.cls].name}’s stone rises; it is kept for next time. Nothing else leaves the Rift (a story hero’s own Riftstones, at level {MAX_LEVEL}, are where gear of item level {keyLoot(at, MAX_LEVEL)} is won).
          </p>
          <button className="rb-btn is-gold is-big rb-gate-go" onClick={() => engine.startRiftTrial(pick.cls, pick.spec, picked.id, at)}>
            <span>Enter the Rift</span>
            <small>
              {CLASSES[pick.cls].name} · {CLASSES[pick.cls].trees[pick.spec].name} · Riftstone +{at}
            </small>
          </button>
        </section>
        <section className="rb-rift-echoes" aria-label="What the stones remember">
          <details className="rb-rift-guide" open={top <= 1}>
            <summary>How the Trials work</summary>
            <div className="rb-rift-guide-body">
              <section>
                <h3>Who you are</h3>
                <p>A calling’s own champion on the path you pick: level {MAX_LEVEL}, a full set of epic gear, every talent spent. Everyone who picks that calling and path gets the same hero.</p>
              </section>
              <section>
                <h3>How a run is won</h3>
                <p>Clear the dungeon before its clock runs out. Every fall costs {KEY_DEATH} seconds. In time, that calling’s stone rises by one (two inside 80% of the clock, three inside 60%). Late, the stone stays where it is.</p>
              </section>
              <section>
                <h3>What you keep</h3>
                <p>Each calling’s stone, for next time. Nothing a Trial’s hero finds leaves the Rift: gear, Sigil Marks and titles are won by your story heroes with their own Riftstones, at level {MAX_LEVEL}.</p>
              </section>
            </div>
          </details>
          <h2>What the stones remember</h2>
          {seen.map((e) => (
            <article key={e.at}>
              <h3>
                <span className="rb-gold">+{e.at}</span> {e.title}
              </h3>
              <p>{e.text}</p>
            </article>
          ))}
          {next && <p className="rb-small rb-dim">The next memory waits at Riftstone +{next.at}.</p>}
        </section>
      </div>
    </div>
  );
}
