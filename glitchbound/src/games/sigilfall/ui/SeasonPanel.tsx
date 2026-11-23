import { useState, type CSSProperties, type ReactNode } from 'react';
import type { SigilEngine } from '../engine';
import { CLASSES } from '../data/classes';
import { SETS } from '../data/riftgear';
import {
  BLESSINGS,
  BOONS,
  ECHO_EVERY,
  HEART_IDS,
  HEART_MAX,
  heartRank,
  HEARTS,
  HUNT_MAX,
  HUNTER_AFTER,
  HUNTER_HP,
  KINSHIP_EXTRA,
  SEASON_EPOCH,
  seasonDef,
  SHRINE_IDS,
  SHRINE_TIME,
  SHRINES,
  SHRINES_PER_RUN,
  STREAK_DMG,
  STREAK_MAX,
  STREAK_SPEED,
  STREAK_TIME,
  STREAK_TIME_EVERY,
  STREAK_WINDOW,
  type SeasonDef,
} from '../data/seasons';
import { SKILLS } from '../data/skills';
import { SPEC_LEVEL } from '../data/talents';
import { setsWorn } from '../progress/build';
import { slotOpen, SLOT_LEVELS, type Character } from '../progress/character';
import { modLines } from '../progress/describe';
import { itemMods, itemName } from '../progress/items';
import { borrowedItem, journeyOf, journeySets, lendable, nextBlessing, seasonOf, twinSkills, wearing, type RiftSeason } from '../progress/season';
import { Bar, fmt, Frame, ItemIcon, SkillIcon } from './common';

/** Days (or hours, under one) from one time to another, as a few words. */
function until(ms: number, from: number): string {
  const left = Math.max(0, ms - from);
  const days = Math.floor(left / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const hours = Math.max(1, Math.ceil(left / 3_600_000));
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** A color for a card or a light (the CSS reads it as `--tone`). */
const tone = (color: string): CSSProperties => ({ ['--tone' as string]: color });

/** What every season's section is handed. */
interface Part {
  engine: SigilEngine;
  h: Character;
  n: number;
  s: RiftSeason;
  /** In a Riftstone run: the choices wait until it is over. */
  inRun: boolean;
}

/** A section of the page: a kicker over what it holds. */
function Sec({ label, kicker, children }: { label: string; kicker: ReactNode; children: ReactNode }) {
  return (
    <section className="rb-season-sec" aria-label={label}>
      <span className="rb-kicker">{kicker}</span>
      {children}
    </section>
  );
}

/** The rules of a season that has nothing to choose, as numbered lines. */
function Rules({ lines }: { lines: ReactNode[] }) {
  return (
    <ol className="rb-srules">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ol>
  );
}

/* --------------------------------------------------------------- the season's power, one section a mechanic */

function HeartPart({ engine, s, inRun }: Part) {
  const rank = heartRank(s.best);
  return (
    <Sec label="Season Heart" kicker={<>Season Heart · rank {rank} of {HEART_MAX}{rank < HEART_MAX ? ` · next rank at Riftstone +${rank * 5}` : ''}</>}>
      <div className="rb-scards">
        {HEART_IDS.map((id) => {
          const d = HEARTS[id];
          const on = s.heart === id;
          return (
            <button key={id} className={`rb-scard${on ? ' is-on' : ''}`} style={tone(d.color)} disabled={inRun} onClick={() => engine.chooseSeasonHeart(id)} aria-pressed={on}>
              <strong>{d.name}</strong>
              <span>{d.text(rank)}</span>
              <em>{on ? 'Beating for you' : inRun ? 'Choose out of a run' : 'Choose'}</em>
            </button>
          );
        })}
      </div>
      <p className="rb-dim rb-small">Works in every Riftstone run this season, and nowhere else. Change it whenever you like, out of a run.</p>
    </Sec>
  );
}

function ShrinesPart({ s }: Part) {
  return (
    <Sec label="The shrines" kicker={<>The shrines · {SHRINES_PER_RUN} rise in every run</>}>
      <div className="rb-scards">
        {SHRINE_IDS.map((id) => {
          const d = SHRINES[id];
          return (
            <div key={id} className="rb-scard is-shrine" style={tone(d.color)}>
              <i className="rb-sorb" aria-hidden style={{ ['--core' as string]: d.core }} />
              <strong>{d.name}</strong>
              <span>{d.text}</span>
            </div>
          );
        })}
      </div>
      <p className="rb-dim rb-small">
        They stand in rooms along the way, a pillar of light you can see from the door. Walk through one to take its power for {SHRINE_TIME} s. Shrines taken this season: <strong>{s.shrines ?? 0}</strong>.
      </p>
    </Sec>
  );
}

function KinshipPart({ h }: Part) {
  const worn = setsWorn(h.equip).sort((a, b) => b.worn - a.worn);
  return (
    <Sec label="Kinship" kicker={<>Kinship · every set you wear counts {KINSHIP_EXTRA} pieces more</>}>
      {worn.length ? (
        <div className="rb-kins">
          {worn.map(({ set, worn: on }) => {
            const as = on >= 2 ? Math.min(6, on + KINSHIP_EXTRA) : on;
            return (
              <div key={set.id} className="rb-kin">
                <span className="rb-kin-head">
                  <strong>{set.name}</strong>
                  <span className="rb-kin-pips" aria-label={`${on} worn, counts as ${as}`}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <i key={i} className={i < on ? 'is-worn' : i < as ? 'is-kin' : ''} />
                    ))}
                  </span>
                  <span className="rb-small rb-dim">
                    {on} worn{as > on ? ` · counts as ${as}` : on < 2 ? ' · two make it count' : ''}
                  </span>
                </span>
                <ul>
                  {set.bonuses.map((b) => (
                    <li key={b.need} className={b.need <= on ? 'is-on' : b.need <= as ? 'is-kin' : ''}>
                      <span className="rb-kin-need">{b.need}</span>
                      <span>
                        {b.text}
                        {b.need > on && b.need <= as ? <em> · by Kinship</em> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rb-dim">You wear no piece of a Rift set. Sets come out of the Riftstones, and the Journey below gives one.</p>
      )}
      <p className="rb-dim rb-small">Two pieces on count as four, and four as six, in every Riftstone run this season. Out of them, a set is what you wear.</p>
    </Sec>
  );
}

function BorrowedPart({ engine, h, n, inRun }: Part) {
  const items = lendable(h);
  const lent = borrowedItem(h, n);
  return (
    <Sec label="Borrowed legend" kicker={lent ? <>Borrowed legend · {itemName(lent)}</> : 'Borrow a legend'}>
      {items.length ? (
        <div className="rb-lends">
          {items.map((it) => {
            const on = lent?.uid === it.uid;
            const worn = wearing(h, it.uid);
            return (
              <button key={it.uid} className={`rb-lend${on ? ' is-on' : ''}`} disabled={inRun} aria-pressed={on} onClick={() => engine.chooseSeasonBorrowed(it.uid)}>
                <ItemIcon item={it} size={46} />
                <span className="rb-lend-text">
                  <strong>{itemName(it)}</strong>
                  <span>{modLines(itemMods(it)).join(' · ')}</span>
                  <em>{on ? (worn ? 'Borrowed, but worn: wear another piece to feel it' : 'Lending you its power') : worn ? 'Worn: its power is yours already' : inRun ? 'Choose out of a run' : 'Borrow'}</em>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rb-dim">You own no legendary of your calling yet. They come out of the Riftstones, and one in your bag will do.</p>
      )}
      <p className="rb-dim rb-small">Its power works in every Riftstone run this season as if you wore it, beside what you do wear. Change it whenever you like, out of a run.</p>
    </Sec>
  );
}

function BoonsPart({ s }: Part) {
  return (
    <Sec label="The boons" kicker="The boons · three offered after every boss">
      <div className="rb-scards is-small">
        {BOONS.map((b) => (
          <div key={b.id} className="rb-scard" style={tone(b.color)}>
            <strong>{b.name}</strong>
            <span>{b.text}</span>
          </div>
        ))}
      </div>
      <p className="rb-dim rb-small">
        The clock waits while you choose. A boon lasts the rest of the run, and the next run starts bare. Boons taken this season: <strong>{s.boons ?? 0}</strong>.
      </p>
    </Sec>
  );
}

function AltarPart({ engine, h, n, s, inRun }: Part) {
  const lit = s.altar ?? 0;
  const next = nextBlessing(h, n);
  return (
    <Sec label="The altar" kicker={<>The altar · {lit} of {BLESSINGS.length} blessings lit</>}>
      <ol className="rb-altar">
        {BLESSINGS.map((b, i) => (
          <li key={i} className={i < lit ? 'is-lit' : i === lit ? 'is-next' : ''}>
            <i className="rb-candle" aria-hidden />
            <span>{b.text}</span>
            <span className="rb-altar-cost">{i < lit ? 'Lit' : `${b.cost} marks`}</span>
          </li>
        ))}
      </ol>
      {next ? (
        <div className="rb-altar-offer">
          <button className="rb-btn is-gold" disabled={inRun || h.marks < next.cost} onClick={() => engine.offerSeasonAltar()}>
            Offer {next.cost} Sigil Marks
          </button>
          <span className="rb-small rb-dim">{inRun ? 'The altar waits until the run is over.' : `You have ${fmt(h.marks)} Sigil Marks.`}</span>
        </div>
      ) : (
        <p className="rb-season-done">All ten burn for you until the season ends.</p>
      )}
      <p className="rb-dim rb-small">They are lit in order, and every one works in every Riftstone run until the season ends.</p>
    </Sec>
  );
}

function BloodlustPart({ s }: Part) {
  const best = s.streak ?? 0;
  return (
    <Sec label="Bloodlust" kicker={<>Bloodlust · your longest streak this season: {best}</>}>
      <div className="rb-streak" style={tone('#ff4a5a')}>
        <Bar value={Math.min(STREAK_MAX, best)} max={STREAK_MAX} color="linear-gradient(90deg, #a81a2a, #ff4a5a)" label="Longest streak" />
        <span className="rb-small">{best >= STREAK_MAX ? `Full Bloodlust: +${STREAK_MAX * STREAK_DMG}% damage` : `${STREAK_MAX} kills for full Bloodlust`}</span>
      </div>
      <Rules
        lines={[
          `Each kill within ${STREAK_WINDOW} s of the last adds a stack: +${STREAK_DMG}% damage and +${STREAK_SPEED}% speed, up to ${STREAK_MAX}.`,
          `Every ${STREAK_TIME_EVERY} kills in one streak take ${STREAK_TIME} s off the clock.`,
          `Go ${STREAK_WINDOW} s without a kill and the streak is gone.`,
        ]}
      />
    </Sec>
  );
}

function TwinPart({ engine, h, s, inRun }: Part) {
  const def = CLASSES[h.cls];
  const skills = twinSkills(h);
  const t = s.twin && skills.includes(s.twin.skill) ? s.twin : null;
  if (!skills.length)
    return (
      <Sec label="Twin path" kicker="Twin path">
        <p className="rb-dim">{h.level < SPEC_LEVEL ? `Choose a specialization at level ${SPEC_LEVEL}: then another’s skill can join your bar.` : 'Choose a specialization first: then another’s skill can join your bar.'}</p>
      </Sec>
    );
  // where it goes by default: the last slot the hero has open
  const open = [0, 1, 2, 3].filter((i) => slotOpen(h, i as 0));
  const slot = t?.slot ?? open[open.length - 1] ?? 0;
  const specOf = (id: string) => def.trees.find((x) => x.skill === id);
  return (
    <Sec label="Twin path" kicker={t ? <>Twin path · {SKILLS[t.skill]?.name}</> : 'Choose a twin path'}>
      <span className="rb-small rb-dim">The skill</span>
      <div className="rb-twins">
        {skills.map((id) => {
          const sp = specOf(id);
          const on = t?.skill === id;
          return (
            <button key={id} className={`rb-twin${on ? ' is-on' : ''}`} style={tone(sp?.color ?? '#6ad8a0')} disabled={inRun} aria-pressed={on} onClick={() => engine.chooseSeasonTwin(id, slot)}>
              <SkillIcon id={id} size={40} />
              <span>
                <strong>{SKILLS[id]?.name}</strong>
                <em>{sp?.name}</em>
              </span>
            </button>
          );
        })}
      </div>
      <span className="rb-small rb-dim">Its place on your bar</span>
      <div className="rb-twin-slots">
        {[0, 1, 2, 3].map((i) => {
          const ok = slotOpen(h, i as 0);
          const mine = h.skills[i];
          const here = t && t.slot === i;
          return (
            <button key={i} className={`rb-twin-slot${here ? ' is-on' : ''}`} disabled={inRun || !ok} aria-pressed={!!here} onClick={() => engine.chooseSeasonTwin(t?.skill ?? skills[0]!, i)}>
              <span className="rb-twin-key">{i + 1}</span>
              {here ? <SkillIcon id={t.skill} size={36} /> : mine && ok ? <SkillIcon id={mine} size={36} /> : <i className="rb-twin-empty" aria-hidden />}
              <em>{!ok ? `Level ${SLOT_LEVELS[i]}` : here ? 'Twin' : mine ? SKILLS[mine]?.name : 'Empty'}</em>
            </button>
          );
        })}
      </div>
      <p className="rb-dim rb-small">In every Riftstone run this season the skill takes that place on your bar, shaped by your own talents and gear. Out of the runs, your bar is your own.</p>
    </Sec>
  );
}

function HunterPart({ s }: Part) {
  const beaten = s.hunted ?? 0;
  const won = Math.min(HUNT_MAX, beaten);
  return (
    <Sec label="The Hunter" kicker={<>The Hunter · beaten {beaten} {beaten === 1 ? 'time' : 'times'} this season</>}>
      <div className="rb-streak" style={tone('#ff4a4a')}>
        <Bar value={won} max={HUNT_MAX} color="linear-gradient(90deg, #8a1a1a, #ffd84a)" label="Hunter trophies" />
        <span className="rb-small">
          +{won}% damage in the Riftstones{won < HUNT_MAX ? ` (at most +${HUNT_MAX}%)` : ' · the most there is'}
        </span>
      </div>
      <Rules
        lines={[
          `About ${HUNTER_AFTER} s into every run, out of a boss’s room, the Hunter finds you: the dungeon’s strongest foe, ${HUNTER_HP} times as hard and marked in red.`,
          'Beat it for two items and a trophy: +1% damage in every Riftstone run for the rest of the season.',
          'It comes once a run. Fall to it and it is still there when you rise.',
        ]}
      />
    </Sec>
  );
}

function EchoesPart({ s }: Part) {
  return (
    <Sec label="Echoes" kicker={<>Echoes · {s.echoes ?? 0} heard this season</>}>
      <div className="rb-echoes" aria-hidden>
        {Array.from({ length: ECHO_EVERY }, (_, i) => (
          <i key={i} className={i === ECHO_EVERY - 1 ? 'is-echo' : ''}>
            {i + 1}
          </i>
        ))}
      </div>
      <Rules
        lines={[
          `Every ${ECHO_EVERY}th skill you cast in a Riftstone run comes again by itself a moment later, as strong as the first.`,
          'Your bar’s four skills count. Basic attacks, dodges and ultimates do not.',
          'The clock in the run shows how many casts are left before the next echo.',
        ]}
      />
    </Sec>
  );
}

const PARTS: Record<SeasonDef['mechanic'], (p: Part) => ReactNode> = {
  heart: HeartPart,
  shrines: ShrinesPart,
  kinship: KinshipPart,
  borrowed: BorrowedPart,
  boons: BoonsPart,
  altar: AltarPart,
  bloodlust: BloodlustPart,
  twin: TwinPart,
  nemesis: HunterPart,
  echoes: EchoesPart,
};

/**
 * The season's page, from its keeper in the Riftward (data/seasons.ts, progress/season.ts): what the season is and
 * how long it runs, its power (a section a season: hearts to choose, shrines to know, a legend to borrow, an altar to
 * light), the hero's Journey through it, and what it all gives. Kept to taps.
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
  const def = now.def;
  const s = seasonOf(h, now.n);
  const journey = journeyOf(h, now.n);
  const inRun = !!engine.world?.keyRun;
  const setNow = s.set ?? set;
  const Power = PARTS[def.mechanic];
  return (
    <Frame title={`Rift Season ${now.n} · ${def.name}`} onClose={() => engine.closePanel()} wide className="rb-panel-season">
      <div className="rb-season" style={tone(def.keeper.pal.O ?? '#c8a8ff')}>
        <div className="rb-season-head">
          <span className="rb-season-glyph" aria-hidden />
          <div>
            <p className="rb-season-lede">
              Ends in {until(now.end, at)} · your best this season: {s.best ? <strong>Riftstone +{s.best}</strong> : 'none yet'}
            </p>
            <p className="rb-small rb-season-short">{def.short}</p>
            <p className="rb-small rb-season-keeper">
              “{def.keeper.lines[0]}” <span>— {def.keeper.name}, {def.keeper.title}</span>
            </p>
          </div>
        </div>

        {def.built ? (
          <Power engine={engine} h={h} n={now.n} s={s} inRun={inRun} />
        ) : (
          <section className="rb-season-sec">
            <p className="rb-dim">This season’s power comes with the next update; its Journey and ladder are open now.</p>
          </section>
        )}

        <Sec label="Journey" kicker="The season’s Journey">
          <ol className="rb-journey">
            {journey.map((c, i) => {
              const r = c.chapter.reward;
              const gives = [r.marks ? `${r.marks} Sigil Marks` : '', r.pieces ? `2 pieces of ${s.set ? SETS[s.set]!.name : 'a Rift set of your choice'}` : '', r.title ? `the title “${def.title.name}” and its mount` : ''].filter(Boolean).join(' and ');
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
        </Sec>

        <Sec label="The ladder" kicker="The ladder">
          <p className="rb-dim rb-small">Your best stone this season goes on the season’s ladder, calling by calling (Rankings, in the hall). The ladder starts again with each season; the stones you open stay open.</p>
        </Sec>
      </div>
    </Frame>
  );
}
