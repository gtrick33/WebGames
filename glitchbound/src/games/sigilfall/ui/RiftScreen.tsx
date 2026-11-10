import { useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { keyLevelFor, keyLoot, keyPar, keyScale, riftDungeons, riftTop } from '../data/keystones';
import { ECHOES, RIFT_CAP_UNFINISHED, WARDENS } from '../data/wardens';
import type { SigilEngine } from '../engine';
import { campaignDone } from '../progress/wardrobe';
import { RiftGuide } from './RiftGuide';
import { clockText } from '../sim/world';

/**
 * The Rift Trials, straight from the title: pick a stone and a dungeon as the Crown remembers it, at your own
 * level. No road to walk first. A trial gives gear, levels and fragments of the old story. A warden's title,
 * armor and drake only the campaign can give, and that is said here plainly.
 */
export function RiftScreen({ engine, slot, onBack }: { engine: SigilEngine; slot: number; onBack: () => void }) {
  const h = engine.save.heroes[slot]!;
  const top = riftTop(h);
  const [stone, setStone] = useState(Math.max(1, top));
  const pool = riftDungeons(top);
  const [region, setRegion] = useState(pool[0]!.id);
  const seen = ECHOES.filter((e) => top >= e.at);
  const next = ECHOES.find((e) => top < e.at);
  const done = campaignDone(h);
  const sc = keyScale(stone, h.level);
  const warden = WARDENS[h.cls];
  const picked = pool.find((r) => r.id === region) ?? pool[0]!;

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
          <p className="rb-rift-lead">The Ash Crown keeps everything it has fed on. Each stone opens a dungeon as the Crown remembers it, at your own strength, against the clock.</p>
          <div className="rb-key-row">
            <button className="rb-btn is-small" aria-label="One level lower" disabled={stone <= 1} onClick={() => setStone(stone - 1)}>
              −
            </button>
            <strong className="rb-key-lvl">Riftstone +{stone}</strong>
            <button className="rb-btn is-small" aria-label="One level higher" disabled={stone >= top} onClick={() => setStone(stone + 1)}>
              +
            </button>
          </div>
          <ul className="rb-rift-dungeons" role="radiogroup" aria-label="Dungeon">
            {pool.map((r) => (
              <li key={r.id}>
                <button role="radio" aria-checked={r.id === picked.id} className={r.id === picked.id ? 'is-on' : ''} onClick={() => setRegion(r.id)}>
                  <strong>{r.name}</strong>
                  <span className="rb-dim">Clock {clockText(keyPar(r))}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="rb-small rb-dim">
            Enemies at level {keyLevelFor(h.level)}, ×{sc.hp.toFixed(1)} health and ×{sc.dmg.toFixed(1)} damage. Loot of item level {keyLoot(stone, h.level)}. In time, the next stones open.
          </p>
          <button className="rb-btn is-gold is-big rb-gate-go" onClick={() => engine.startRift(slot, picked.id, stone)}>
            <span>Enter the Rift</span>
            <small>
              {h.name} · level {h.level}
            </small>
          </button>
        </section>
        <section className="rb-rift-echoes" aria-label="What the stones remember">
          <RiftGuide hero={h} open={top <= 1} />
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
          {!done && (
            <p className="rb-rift-warden">
              <b>{warden.title}.</b> Stones go no higher than +{RIFT_CAP_UNFINISHED} until you have stood before the Hallow King yourself. Finish the story as a {h.cls} to {warden.sigil ? `become a warden of the ${warden.sigil} Sigil` : 'take up the watch the songs left out, at the Gloam Gate'}: the title, the armor and the {warden.drake.name}.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
