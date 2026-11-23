import { useState } from 'react';
import type { SigilEngine } from '../engine';
import { SETS } from '../data/riftgear';
import { HEART_IDS, HEART_MAX, heartRank, HEARTS, SEASON_EPOCH, seasonDef } from '../data/seasons';
import { journeyOf, journeySets, seasonOf } from '../progress/season';
import { Frame } from './common';

/** Days (or hours, under one) from one time to another, as a few words. */
function until(ms: number, from: number): string {
  const left = Math.max(0, ms - from);
  const days = Math.floor(left / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const hours = Math.max(1, Math.ceil(left / 3_600_000));
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * The season's page, from its keeper in the Riftward (data/seasons.ts, progress/season.ts): what the season is and
 * how long it runs, its power (the Season of Hearts: the hearts to choose from), the hero's Journey through it, and
 * what it all gives. Kept to taps: one choice for the heart, one button a chapter.
 */
export function SeasonPanel({ engine }: { engine: SigilEngine }) {
  const h = engine.hero!;
  const now = engine.season;
  const [set, setSet] = useState<string>(() => journeySets(h)[0] ?? '');
  // (the time, once, as the page opens: a countdown in days needs no ticking)
  const [at] = useState(() => Date.now());
  if (!now) {
    const first = seasonDef(1);
    return (
      <Frame title="Rift Seasons" onClose={() => engine.closePanel()} wide className="rb-panel-season">
        <div className="rb-season">
          <p className="rb-season-lede">
            The first season of the Rift, <strong>{first.name}</strong>, begins on 1 December ({until(SEASON_EPOCH, at)}).
          </p>
          <p className="rb-dim">{first.short}</p>
          <p className="rb-dim rb-small">Every month brings a new season: a power of its own in the Riftstones, a Journey that gives a whole Rift set and a title, and a ladder of the season’s best stones. The campaign is as it was.</p>
        </div>
      </Frame>
    );
  }
  const s = seasonOf(h, now.n);
  const journey = journeyOf(h, now.n);
  const rank = heartRank(s.best);
  const inRun = !!engine.world?.keyRun;
  const setNow = s.set ?? set;
  return (
    <Frame title={`Rift Season ${now.n} · ${now.def.name}`} onClose={() => engine.closePanel()} wide className="rb-panel-season">
      <div className="rb-season">
        <p className="rb-season-lede">
          Ends in {until(now.end, at)} · your best this season: {s.best ? <strong>Riftstone +{s.best}</strong> : 'none yet'}
        </p>
        <p className="rb-dim rb-small">{now.def.short}</p>

        {now.def.mechanic === 'heart' && (
          <section className="rb-season-sec" aria-label="Season Heart">
            <span className="rb-kicker">
              Season Heart · rank {rank} of {HEART_MAX}
              {rank < HEART_MAX ? ` · next rank at Riftstone +${rank * 5}` : ''}
            </span>
            <div className="rb-hearts">
              {HEART_IDS.map((id) => {
                const d = HEARTS[id];
                const on = s.heart === id;
                return (
                  <button key={id} className={`rb-heart${on ? ' is-on' : ''}`} style={{ ['--heart' as string]: d.color }} disabled={inRun} onClick={() => engine.chooseSeasonHeart(id)} aria-pressed={on}>
                    <strong>{d.name}</strong>
                    <span>{d.text(rank)}</span>
                    <em>{on ? 'Beating for you' : inRun ? 'Choose out of a run' : 'Choose'}</em>
                  </button>
                );
              })}
            </div>
            <p className="rb-dim rb-small">Works in every Riftstone run this season, and nowhere else. Change it whenever you like, out of a run.</p>
          </section>
        )}
        {!now.def.built && (
          <section className="rb-season-sec">
            <p className="rb-dim">This season’s power comes with the next update; its Journey and ladder are open now.</p>
          </section>
        )}

        <section className="rb-season-sec" aria-label="Journey">
          <span className="rb-kicker">The season’s Journey</span>
          <ol className="rb-journey">
            {journey.map((c, i) => {
              const r = c.chapter.reward;
              const gives = [r.marks ? `${r.marks} Sigil Marks` : '', r.pieces ? `2 pieces of ${s.set ? SETS[s.set]!.name : 'a Rift set of your choice'}` : '', r.title ? `the title “${now.def.title.name}” and its mount` : ''].filter(Boolean).join(' and ');
              return (
                <li key={i} className={`rb-chapter${c.claimed ? ' is-claimed' : c.ready ? ' is-ready' : ''}`}>
                  <span className="rb-chapter-head">
                    Chapter {i + 1}
                    {c.claimed ? ' · claimed' : ''}
                  </span>
                  <ul>
                    {c.goals.map((g) => (
                      <li key={g.id} className={g.done ? 'is-done' : ''}>
                        <span className="rb-goal-mark" aria-hidden>
                          {g.done ? '✔' : '•'}
                        </span>
                        {g.text}
                        {!g.done && g.need > 1 ? <span className="rb-dim"> ({g.have}/{g.need})</span> : null}
                      </li>
                    ))}
                  </ul>
                  <span className="rb-small rb-dim">Gives {gives}.</span>
                  {c.ready && r.pieces && !s.set && (
                    <label className="rb-season-set">
                      <span className="rb-small">The set:</span>
                      <select value={set} onChange={(e) => setSet(e.target.value)}>
                        {journeySets(h).map((id) => (
                          <option key={id} value={id}>
                            {SETS[id]!.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {c.ready && (
                    <button className="rb-btn is-small is-gold" onClick={() => engine.claimSeasonChapter(i, r.pieces ? setNow : undefined)}>
                      Claim
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rb-season-sec">
          <span className="rb-kicker">The ladder</span>
          <p className="rb-dim rb-small">Your best stone this season goes on the season’s ladder, calling by calling (Rankings, in the hall). The ladder starts again with each season; the stones you open stay open.</p>
        </section>
      </div>
    </Frame>
  );
}
