import { useEffect, useMemo, useRef, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { fullBar, PRESETS, SLOTS, styleOfBar, type Ability } from '../arena/abilities';
import { fullTalents } from '../arena/talents';
import { afterMatch, clearLive, COMPS, drawOpponents, LEAVER_K, mateSkill, mmrOf, namedApart, nameFor, readRing, rivalFor, setsOf, skillAt, stakesOf, standingOf, writeLive, writeRing, type ClassSets, type Comp, type LiveMatch, type RingSave, barredFrom, BARRED_WHY, styleFor } from '../arena/ladder';
import { MAP_IDS, MAPS } from '../arena/maps';
import { bestRating, FORMATS, nextRank, rankOf, type Format } from '../arena/ranks';
import { rewardsBetween } from '../arena/rewards';
import { GATES_SOLO, type FighterSetup, type MatchSetup } from '../arena/sim';
import { CLASS_EASE, CLASS_WAY, EASE_WORD, playstyleOf } from '../arena/styles';
import { LOBBY_STEPS, tutorialSetup } from '../arena/tutorial';
import { Coach, useLabels, useSpot, useTutLock } from './RingCoach';
import { CLASS_IDS, CLASSES } from '../data/classes';
import { useAccount } from '../../../platform/account';
import { classOpen } from '../progress/paidClasses';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { Link, type LinkState } from '../net/link';
import { Seek, type SeekLook } from '../net/ringSeek';
import { rivalsOf } from '../arena/queue';
import type { Action as RoomAction, Pick as RoomPick, View as RoomView } from '../net/ringRoom';
import { newCharacter, type Face } from '../progress/character';
import { heldWeapon, heroDollUrl, heroLook } from '../render/sprites';
import { RingMatch, type MatchHints, type MatchResult, type MatchStakes, type RingInbox } from './RingMatch';
import { RingResult, type RatingOutcome } from './RingResult';
import { AbilityCard, BarRow, RingHelp, SetupChips, SetupEditor } from './RingSetup';
import { wearOf, WearPicker } from './wear';
import { LooksDialog, plainWorn, RewardsDialog, RewardStrip, ringTitle } from './RingRewards';
import { wornLooks } from '../progress/wardrobe';
import { Titled } from './Titled';
import { ScreenGate } from './ScreenGate';
import { Doll } from './Doll';
import { classEmblem } from './classEmblem';
import { bestFits, bestPreset, choiceFromWord, choicesFor, choiceWord, fillSide, healerSpec, honored, slotsFor, specOf, type MateChoice, type Spec } from '../arena/teammates';
import { cleanTitle, isTitleFx } from '../../../catalog/titleFx';
import { rankFx, type TitleShown } from '../progress/titles';
import { frameOf, framesOwned, recordMatch, trackGain, turnSeason, type TrackGain } from '../arena/record';
import { ProgressDialog, ProgressLink } from './RingProgress';
import { ArenaChoice } from './RingArena';

const roomErrors: Record<string, string> = { full: 'That room is full.', in_run: 'That room is already in a match.' };

/** A title from another player's game, as this one draws it: its words tidied, its light one this game has (else plain). */
function shownTitle(t: RoomPick['title']): FighterSetup['title'] | undefined {
  const text = cleanTitle(t?.text);
  return text ? { text, fx: isTitleFx(t?.fx) ? t.fx : 'plain', before: t?.before ?? true } : undefined;
}

/** What a title is sent to a room as. */
const pickTitle = (t: TitleShown | null): { title?: RoomPick['title'] } => (t ? { title: { text: t.text, fx: t.fx, before: t.before } } : {});

/**
 * Both ends of a room build the same match from the room's own word. Empty places go to the computer: on a side with
 * people, the teammates the first of them chose (arena/teammates.ts); on a side with nobody, one of the computer's teams.
 */
export function setupFromRoom(v: RoomView): { setup: MatchSetup; mine: number } {
  const fighters: FighterSetup[] = [];
  for (const team of [0, 1] as const) {
    const on = v.seats.filter((s) => s.pick?.team === team).slice(0, v.format);
    for (const s of on) {
      const known = CLASS_IDS.includes(s.pick!.cls as ClassId);
      const cls = (known ? s.pick!.cls : 'warrior') as ClassId;
      // (whatever bar a player's game sent, from before a playstyle's abilities were its own or after, is read as the
      // playstyle nearest it: its four, its super, and its own talents in any row where theirs are no longer talents)
      // (and a healer's, in a 1v1, as their class's other one: this game never sends that, one from before may)
      const sent = styleOfBar(cls, s.pick!.bar);
      const style = styleFor(v.format, cls, sent);
      const bar = [...style.bar];
      const title = shownTitle(s.pick!.title);
      const frame = frameOf(s.pick!.frame);
      fighters.push({ team, cls, name: s.name, bar, talents: fullTalents(cls, style.id, style === sent ? s.pick!.talents : [], style.talents), ult: style.ult, seat: s.n, ...(title ? { title } : {}), ...(frame ? { frame: frame.id } : {}) });
    }
    const list = COMPS[v.format];
    const comp = list[(v.runSeed + team) % list.length]!;
    const people = fighters.filter((f) => f.team === team);
    const fill: Spec[] = people.length
      ? fillSide(
          v.format,
          people.map((f) => specOf(f.cls, f.bar)),
          (on[0]!.pick!.mates ?? []).map(choiceFromWord),
          v.runSeed + team,
        )
      : comp.team.slice(0, v.format);
    fill.forEach((t, k) => {
      const i = on.length + k;
      fighters.push({ team, cls: t.cls, name: nameFor(t.cls, v.runSeed + i + team * 7), bar: PRESETS[t.cls][t.preset]!.bar, talents: PRESETS[t.cls][t.preset]!.talents });
    });
  }
  return { setup: { seed: v.runSeed, map: MAPS[v.map] ? v.map : 'sands', fighters: namedApart(fighters) }, mine: fighters.findIndex((f) => f.seat === v.you) };
}

type Page = 'play' | 'setup' | 'friends';


/**
 * The classes to fight as. One from the shop can be picked once it's bought (progress/paidClasses.ts). On the Play page
 * (`lobby`) they are the Vigil lobby's list of callings, each with its name, beside the hero on the dais; in a room, a
 * row of emblems.
 */
function ClassRow({ pick, onPick, lobby }: { pick: ClassId; onPick: (c: ClassId) => void; lobby?: boolean }) {
  const { me } = useAccount();
  if (lobby) {
    return (
      <div className="rb-vlobby-classes" role="radiogroup" aria-label="Class" data-tut="classes">
        {CLASS_IDS.map((c) => (
          <button key={c} role="radio" aria-checked={c === pick} aria-disabled={!classOpen(c, me)} aria-label={`${CLASSES[c].name}: ${CLASS_WAY[c].toLowerCase()}, ${EASE_WORD[CLASS_EASE[c]].toLowerCase()} to learn`} title={classOpen(c, me) ? `${CLASSES[c].name}: ${CLASS_WAY[c].toLowerCase()}, ${EASE_WORD[CLASS_EASE[c]].toLowerCase()} to learn` : `${CLASSES[c].name}: unlock it in the shop`} className={`rb-vlobby-class${c === pick ? ' is-on' : ''}${classOpen(c, me) ? '' : ' is-locked'}`} style={{ ['--c' as string]: CLASSES[c].colors.accent }} onClick={() => classOpen(c, me) && onPick(c)}>
            <img src={classEmblem(c)} alt="" draggable={false} />
            <span>
              {CLASSES[c].name}
              {/* (one still to be bought says so where it can be seen, not only in a pointer's tooltip a phone never shows) */}
              {classOpen(c, me) ? <small className={`rb-ringvl-tag is-${CLASS_EASE[c]}`}>{EASE_WORD[CLASS_EASE[c]]}</small> : <small className="rb-ringvl-tag is-shop">In the shop</small>}
            </span>
            {!classOpen(c, me) && <Padlock />}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="rb-rp-classes" role="radiogroup" aria-label="Class">
      {CLASS_IDS.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={c === pick}
          aria-disabled={!classOpen(c, me)}
          aria-label={CLASSES[c].name}
          title={classOpen(c, me) ? `${CLASSES[c].name}: ${CLASS_WAY[c].toLowerCase()}, ${EASE_WORD[CLASS_EASE[c]].toLowerCase()} to learn` : `${CLASSES[c].name}: unlock it in the shop`}
          className={`rb-rp-class${c === pick ? ' is-on' : ''}${classOpen(c, me) ? '' : ' is-locked'}`}
          style={{ ['--c' as string]: CLASSES[c].colors.accent }}
          onClick={() => classOpen(c, me) && onPick(c)}
        >
          <img src={classEmblem(c)} alt="" draggable={false} />
          {!classOpen(c, me) && <Padlock />}
        </button>
      ))}
    </div>
  );
}

/** A small padlock over a class still to be bought. */
function Padlock() {
  return (
    <svg className="rb-ring-padlock" viewBox="0 0 12 14" aria-hidden="true">
      <path d="M3.2 6V4.2a2.8 2.8 0 0 1 5.6 0V6" fill="none" stroke="#ffd257" strokeWidth="1.6" />
      <rect x="1.5" y="6" width="9" height="7" rx="1.4" fill="#ffd257" />
    </svg>
  );
}

const setupName = (s: Spec): string => `${CLASSES[s.cls].name} (${PRESETS[s.cls][s.preset]!.name})`;

/**
 * The computer's teammates for a 2v2's or a 3v3's empty places: a class and one of its ready-made setups each, or
 * Random, the team that wins most beside the player's own setup (arena/teammates.ts). A friend who joins takes a place
 * first.
 */
function MatesPicker({ format, cls, bar, mates, onMates }: { format: Format; cls: ClassId; bar: string[]; mates: MateChoice[]; onMates: (m: MateChoice[]) => void }) {
  const shown = honored(cls, mates);
  const me = specOf(cls, bar);
  // what Random picks between, the places chosen kept where they are
  const fits = bestFits(format, [me], shown);
  const set = (i: number, c: MateChoice): void => onMates(shown.map((x, j) => (j === i ? c : x)));
  const comps = COMPS[format].filter((c) => c.team.some((t) => t.cls === cls));
  return (
    <div className="rb-rp-block">
      <h3>Your {format === 2 ? 'teammate' : 'teammates'}</h3>
      <div className="rb-rp-mates">
        {shown.map((x, i) => {
          const could = fits.map((t) => t[i]).filter((t): t is Spec => !!t);
          const names = [...new Set(could.map(setupName))];
          const heals = could.filter(healerSpec).length;
          // (one team clearly best: it is named; several as good: what kind of teammate they all are)
          const role = names.length === 1 ? names[0] : heals === could.length ? 'A healer' : heals === 0 ? 'Damage' : 'Healer or damage';
          return (
            <span key={i} className={`rb-rp-mate${x === 'random' ? ' is-any' : ''}`} style={{ ['--c' as string]: x === 'random' ? '#ffe39a' : CLASSES[x.cls].colors.accent }}>
              {x === 'random' ? (
                <i className="rb-rp-mate-any" aria-hidden="true">
                  ?
                </i>
              ) : (
                <img src={classEmblem(x.cls)} alt="" draggable={false} />
              )}
              <select
                aria-label={`Teammate ${i + 1}`}
                value={x === 'random' ? 'random' : x.cls}
                onChange={(e) => {
                  const v = e.target.value;
                  set(i, v === 'random' ? 'random' : { cls: v as ClassId, preset: bestPreset(me, v as ClassId) });
                }}
              >
                <option value="random">Random</option>
                {CLASS_IDS.filter((c) => c !== cls).map((c) => (
                  <option key={c} value={c} disabled={shown.some((o, j) => j !== i && o !== 'random' && o.cls === c)}>
                    {CLASSES[c].name}
                  </option>
                ))}
              </select>
              {x === 'random' ? (
                <small className="rb-rp-mate-fit" title={`Best beside your ${PRESETS[cls][me.preset]!.name}: ${names.join(', ')}`}>
                  {role}, best fit
                </small>
              ) : (
                <select aria-label={`Teammate ${i + 1}'s build`} value={x.preset} onChange={(e) => set(i, { cls: x.cls, preset: Number(e.target.value) })}>
                  {PRESETS[x.cls].map((p, n) => (
                    <option key={p.id} value={n}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </span>
          );
        })}
      </div>
      <small className="rb-rp-matehint">
        {format === 3 ? 'Random brings one healer and one damage dealer, the pair that wins most beside your setup.' : 'Random brings the healer or damage dealer that wins most beside your setup.'} A friend who joins takes a place first.
      </small>
      {comps.length > 0 && (
        <div className="rb-rp-comps">
          <small>Teams that work:</small>
          {comps.map((c) => (
            <button key={c.name} title={c.blurb} className="rb-rs-build" onClick={() => onMates(c.team.filter((t) => t.cls !== cls).map((t) => ({ cls: t.cls, preset: t.preset })))}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The Ring, as three plain pages: Play (who, what kind of fight, go), Setup (what you bring), and With friends. A
 * match and its result lie beyond them, and every page has one way back.
 */
export function RingScreen({ engine, face, body, cls, name, onBack, resume }: { engine: SigilEngine; face?: Face; body?: 'm' | 'f'; cls?: ClassId; name?: string; onBack: () => void; resume?: LiveMatch }) {
  const [save, setSave] = useState<RingSave>(readRing);
  const latest = useRef(save);
  const commit = (fn: (s: RingSave) => RingSave): void => {
    const next = fn(latest.current);
    latest.current = next;
    setSave(next);
    writeRing(next);
  };
  // another device's copy came down while the Ring is open (cloud saves merged it into storage): take it in, so that
  // this screen's next change doesn't write its older copy back over the account's
  useEffect(
    () =>
      engine.onArrived(() => {
        const fresh = readRing();
        if (JSON.stringify(fresh) === JSON.stringify(latest.current)) return;
        latest.current = fresh;
        setSave(fresh);
      }),
    [engine],
  );
  const [page, setPage] = useState<Page>('play');
  const [setupFrom, setSetupFrom] = useState<Page>('play');
  const [format, setFormat] = useState<Format>(1);
  const { me } = useAccount();
  const [pick, setPick] = useState<ClassId>(cls && classOpen(cls, me) ? cls : 'warrior');
  const [map, setMap] = useState<string>('random');
  const [mapsOpen, setMapsOpen] = useState(false);
  const [help, setHelp] = useState(false);
  // the tutorial (arena/tutorial.ts): its step over the lobby, if it's being taken, and its practice match
  const [tut, setTut] = useState<number | null>(null);
  const [tutFight, setTutFight] = useState<{ setup: MatchSetup } | null>(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  // a season that turned since the player last came: its bests put by, each rating halfway back toward 1000
  // (arena/record.ts turnSeason; a record that never saw a season starts in this one, with nothing changed)
  useEffect(() => {
    const t = turnSeason(latest.current.record, latest.current.standings, Date.now());
    if (t.record !== latest.current.record || t.turned) commit((now) => ({ ...now, record: t.record, standings: t.standings }));
    // (once, as the Ring opens)
  }, []);
  /** A match that ended (not the tutorial): into the history, and a rated one into the challenges, mastery and season. */
  /** Returns what it did to the season track, for the result screen (nothing for a match that moved it none). */
  const keepMatch = (r: MatchResult, f: Format, rating: RatingOutcome | null, rival?: string): TrackGain | null => {
    const me = r.match.fighters[r.myId];
    if (!me) return null;
    const sc = me.score;
    const now = Date.now();
    const was = latest.current.record;
    const next = recordMatch(
      was,
      { at: now, format: f, cls: me.cls, won: r.won, draw: r.draw, change: rating ? rating.after - rating.before : null, rating: rating ? rating.after : null, dmg: Math.round(sc.dmg), heal: Math.round(sc.heal), combos: sc.combos ?? 0, kicks: sc.kicks, ...(sc.best ? { best: sc.best } : {}), ...(rival ? { rival } : {}) },
      { won: r.won, format: f, cls: me.cls, dmg: sc.dmg, heal: sc.heal, combos: sc.combos ?? 0, kicks: sc.kicks, supers: sc.supers ?? 0 },
      now,
    );
    commit((s) => ({ ...s, record: next }));
    return trackGain(was, next);
  };
  const [looksOpen, setLooksOpen] = useState(false);
  const [fight, setFight] = useState<{ setup: MatchSetup; rival: Comp; skill: number; mates?: number; rivalRating: number; stakes: MatchStakes; format: Format; snap?: LiveMatch['snap'] } | null>(() => (resume ? { ...resume, stakes: resume.stakes } : null));
  // (`matched`: found by a search, not a room of friends: there is no room to go back to when it ends, and it is
  // rated, `live` being what is kept of it while it goes, as for a match against the computer's teams)
  const [roomFight, setRoomFight] = useState<{ setup: MatchSetup; mine: number; host: boolean; matched?: boolean; live?: LiveMatch } | null>(null);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ r: MatchResult; rating: RatingOutcome | null; rival?: string; kind: 'solo' | 'matched' | 'room' | 'tutorial'; track?: TrackGain | null } | null>(null);
  // a search for other players (net/ringSeek.ts): what its waiting screen shows, and a word left by one that ended badly
  const [look, setLook] = useState<SeekLook | null>(null);
  const [seekNote, setSeekNote] = useState('');
  const seekRef = useRef<Seek | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [linkState, setLinkState] = useState<LinkState | 'none'>('none');
  const [roomErr, setRoomErr] = useState('');
  const [codeIn, setCodeIn] = useState('');
  const linkRef = useRef<Link<RoomView, RoomAction> | null>(null);
  const inbox = useRef<RingInbox | null>(null);
  useEffect(
    () => () => {
      linkRef.current?.close();
      seekRef.current?.stop();
    },
    [],
  );

  const hero = name ?? 'You';
  // (what other people see: a player with no campaign hero goes by their arcade name, not as somebody else's "You")
  const shownAs = name ?? (engine.defaultName.trim() || 'You');
  const standing = standingOf(save, format);
  const rank = rankOf(standing.best);
  const next = nextRank(standing.best);
  // (a campaign hero of the class, worn: their gear, their Wardrobe and their title)
  const [wearN, setWearN] = useState(0);
  // (asked again whenever the game changes: a copy of the save from the account puts new heroes in place)
  const saved = engine.getVersion();
  const wear = useMemo(() => (wearN >= 0 && saved >= 0 ? wearOf(engine, pick) : null), [engine, pick, wearN, saved]);
  // (in plain clothes: the Ring armor and the Ring title chosen, kept with the standing)
  const worn = useMemo(() => (wear ? undefined : plainWorn(save.plain)), [wear, save.plain]);
  const myTitle = ringTitle(wear, save.plain);
  // (the nameplate frame worn, while it is one the season track gave)
  const myFrame = save.frame && framesOwned(save.record ?? {}).some((f) => f.id === save.frame) ? save.frame : null;
  const frameOn = myFrame ? { frame: myFrame } : {};
  const doll = useMemo(() => {
    const plain = newCharacter(pick, 'Ring', 'ring');
    const w = wear;
    const look = w ? heroLook(pick, w.equip, wornLooks(w), w.body, w.face) : heroLook(pick, plain.equip, worn ?? {}, body ?? 'm', face);
    const held = w ? heldWeapon(pick, w.equip.weapon, wornLooks(w).weapon) : heldWeapon(pick, plain.equip.weapon);
    // (drawn at the Vigil lobby's size: the hero stands as tall on the dais here as there)
    return heroDollUrl(look, 'down', 6, held, pick === 'warrior' || pick === 'paladin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, body, face, wear, worn, wearN]);
  const sets = setsOf(save, pick);
  const setup = sets.list[sets.active]!;
  const { bar, talents, ult } = setup;
  /** An ability of the setup being read, from its bar on the main screen (RingSetup AbilityCard, only to read). */
  const [reading, setReading] = useState<Ability | null>(null);
  const ready = bar.length === SLOTS;
  /** A healer's playstyle with 1v1 chosen: no match to find (arena/ladder.ts barredFrom). */
  const barred = barredFrom(format, bar);
  const choose = (c: ClassId): void => setPick(c);
  // the computer's teammates for this format's empty places, kept with the standing (arena/teammates.ts)
  const mates = choicesFor(save.mates?.[format], format);
  const putMates = (list: MateChoice[]): void => commit((now) => ({ ...now, mates: { ...now.mates, [format]: list } }));
  // (stamped, so that this device's change and another's are joined by which came last: platform/mergeRules.ts; and
  // with how many abilities a bar holds now, so that a bar still being filled isn't taken for one kept from before)
  const putSets = (s: ClassSets): void => commit((now) => ({ ...now, sets: { ...now.sets, [pick]: { ...s, at: Date.now(), n: SLOTS } } }));
  const openSetup = (from: Page): void => {
    setSetupFrom(from);
    setPage('setup');
  };

  /* -------------------------------------------------- the tutorial */
  const learn = save.learn ?? {};
  // (offered once, on a first visit: nobody who has fought here, or has been asked, is asked again)
  const firstVisit = !learn.asked && !learn.done && FORMATS.every((f) => standingOf(save, f).wins + standingOf(save, f).losses === 0);
  const putLearn = (fn: (l: NonNullable<RingSave['learn']>) => NonNullable<RingSave['learn']>): void => commit((now) => ({ ...now, learn: fn(now.learn ?? {}) }));
  // (a step is read only over its own page: should the page under it change all the same, it says nothing rather
  // than talk about a page that is not there. It stood over the wrong page with the last step's words)
  const tutAt = tut === null ? null : (LOBBY_STEPS[tut] ?? null);
  const tutStep = tutAt && tutAt.page === page ? tutAt : null;
  useSpot(tutStep?.spot ?? null);
  useLabels(tutStep?.labels);
  // (while a step is read, only what it is about can be used: nothing else on the page answers)
  useTutLock(!!tutStep, tutStep?.allow);
  const goTut = (i: number): void => {
    const st = LOBBY_STEPS[i];
    if (!st) return;
    // (anything read or opened over the page is put away first: the step has the screen)
    setReading(null);
    setHelp(false);
    setRewardsOpen(false);
    setProgressOpen(false);
    if (st.page === 'setup' && page !== 'setup') openSetup('play');
    else if (st.page === 'play' && page !== 'play') setPage('play');
    setTut(i);
  };
  const beginTutorial = (): void => {
    putLearn((l) => ({ ...l, asked: true }));
    setHelp(false);
    setFormat(1);
    goTut(0);
  };
  /** The practice match: as this class is set up now, against the sparring partner. Not rated, not kept as a live match. */
  const startTutorialMatch = (): void => {
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const me: FighterSetup = { team: 0, cls: pick, name: hero, bar: fullBar(pick, bar), talents, ult, human: true, ...frameOn };
    setTut(null);
    setResult(null);
    setPage('play');
    setRun((r) => r + 1);
    setTutFight({ setup: tutorialSetup(me, seed) });
  };
  /** One-time hints in a real match (arena/lessons.ts), unless the game's tutorial hints are off. */
  const hints: MatchHints | undefined = engine.settings.tutorial ? { seen: learn.hints ?? [], onSeen: (id) => putLearn((l) => ({ ...l, hints: [...new Set([...(l.hints ?? []), id])] })) } : undefined;

  const enter = (): void => {
    if (!ready) {
      openSetup('play');
      return;
    }
    // (a healer with 1v1 chosen: nothing to find, and the page already says why)
    if (barred) return;
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const { comp, fighters } = drawOpponents(format, seed);
    const fill = fillSide(format, [specOf(pick, bar)], mates, seed);
    const team: FighterSetup[] = [{ team: 0, cls: pick, name: hero, bar, talents, ult, human: true, ...frameOn }, ...fill.map((x, i) => ({ team: 0 as const, cls: x.cls, name: nameFor(x.cls, seed + i + 11), bar: PRESETS[x.cls][x.preset]!.bar, talents: PRESETS[x.cls][x.preset]!.talents }))];
    // the other side's rating lands either way of your matchmaking rating, up to 150 (what it pays and costs follows:
    // stakesOf), and how sharp the computer plays follows it; your own side's play to yours
    const rivalRating = rivalFor(standing, seed);
    // (the other side wears the rank of its rating over their heads, as a player wears a title: "Pit Veteran")
    const rivalRank = rankOf(rivalRating);
    const rivals = rivalRank.at > 0 ? fighters.map((f) => ({ ...f, title: { text: rivalRank.name, fx: rankFx(rivalRank.at), before: true } })) : fighters;
    setResult(null);
    setPage('play');
    setRun((r) => r + 1);
    const next = {
      setup: { seed, map: map === 'random' ? MAP_IDS[seed % MAP_IDS.length]! : map, fighters: namedApart([...team, ...rivals]), gates: GATES_SOLO },
      rival: comp,
      skill: skillAt(rivalRating),
      mates: mateSkill(mmrOf(standing)),
      rivalRating,
      format,
      stakes: { format, rating: standing.rating, rank: rankOf(standing.best).name, color: rankOf(standing.best).color, ...stakesOf(standing, rivalRating), rival: comp.name, blurb: comp.blurb, rivalRating },
    };
    // (kept as it goes: a player who leaves it while it's going can come back to it, or lose as a leaver)
    writeLive({ ...next, at: Date.now() });
    setFight(next);
  };

  /** A rated match is settled: the standing moves, and what the climb has earned is worked out. */
  const settleFor = (f: Format, rivalRating: number, won: boolean, k = 1, ours?: number): RatingOutcome => {
    clearLive();
    const was = standingOf(latest.current, f);
    const out = afterMatch(was, rivalRating, won, k, ours ?? mmrOf(was));
    // (what the climb has earned: the best of all three formats counts, so a reward is given once)
    const bestWas = bestRating();
    commit((now) => ({ ...now, standings: { ...now.standings, [f]: out.next } }));
    // (the new standing goes to the rankings now, not only when the title screen is next seen)
    void engine.reportRanks();
    return { before: was.rating, after: out.next.rating, bestBefore: was.best, bestAfter: out.next.best, rankUp: out.rankUp, streak: out.next.streak, rewards: rewardsBetween(bestWas, bestRating()) };
  };

  /** Out of a search, or of the match it found (`soon`: this end ran the match, and lets its last word arrive first). */
  const endSeek = (soon = false): void => {
    if (soon) seekRef.current?.stopSoon();
    else seekRef.current?.stop();
    seekRef.current = null;
    linkRef.current = null;
    setLook(null);
  };

  /**
   * "Find a match": other players first, for ten seconds, then the computer's teams (the owner: "try to find existing
   * players for a while and after 10 secs of loading screen, load bots if noone is queing").
   */
  const findMatch = (): void => {
    if (!ready) {
      openSetup('play');
      return;
    }
    // (a healer with 1v1 chosen: nothing to find, and the page already says why)
    if (barred) return;
    setResult(null);
    setPage('play');
    setSeekNote('');
    seekRef.current?.stop();
    const ground = map === 'random' ? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)]! : map;
    seekRef.current = new Seek(
      { format, map: ground, name: shownAs, pick: { cls: pick, bar, talents, ult, rating: mmrOf(standing), mates: mates.map(choiceWord), ...pickTitle(myTitle), ...frameOn } },
      {
        onLook: setLook,
        onRun: (v, link) => {
          const { setup: s, mine } = setupFromRoom(v);
          if (mine < 0) {
            endSeek();
            enter();
            return;
          }
          // rated as a match against the computer's teams is, against the other side's own rating (the owner: "same
          // logic as the leaver penalty"): kept while it goes, so that walking out of it, or closing it, is a
          // leaver's loss
          const st = standingOf(latest.current, v.format);
          const them = rivalsOf(v);
          const rivalRating = them.rating ?? mmrOf(st);
          // (2v2 and 3v3: worked from the two sides' means, as rated arenas do; 1v1: that is just your own. A search
          // says the searcher's matchmaking rating, so these are matchmaking ratings)
          const ourRating = them.ours ?? mmrOf(st);
          const rival = listed(them.names) || 'the other team';
          const rk = rankOf(st.best);
          const live: LiveMatch = {
            setup: s,
            rival: { name: rival, blurb: '', team: [] },
            skill: 0,
            rivalRating,
            ourRating,
            format: v.format,
            stakes: { format: v.format, rating: st.rating, rank: rk.name, color: rk.color, ...stakesOf(st, rivalRating, ourRating), rival, blurb: '', rivalRating },
            at: Date.now(),
            people: true,
          };
          writeLive(live);
          linkRef.current = link;
          setLook(null);
          setRun((r) => r + 1);
          setRoomFight({ setup: s, mine, host: v.host === v.you, matched: true, live });
        },
        onBots: () => {
          seekRef.current = null;
          setLook(null);
          enter();
        },
        onRelay: (n, d) => inbox.current?.(n, d),
        onGone: () => {
          seekRef.current = null;
          linkRef.current = null;
          clearLive();
          setRoomFight(null);
          setSeekNote('That match ended because a player left it. Your rating is as it was.');
        },
      },
    );
  };

  /* -------------------------------------------------- the room */
  const roomMates = view ? choicesFor(save.mates?.[view.format], view.format) : [];
  const roomWords = roomMates.map(choiceWord).join(' ');
  // (the title worn, sent to the room so everyone sees it over this player's head)
  const tText = myTitle?.text ?? '';
  const tFx = myTitle?.fx ?? 'plain';
  const tBefore = myTitle?.before ?? true;
  const myPick = useMemo((): RoomPick => ({ team: view?.seats.find((s) => s.you)?.pick?.team ?? 0, cls: pick, bar, talents, ult, ...(roomWords ? { mates: roomWords.split(' ') } : {}), ...(tText ? { title: { text: tText, fx: tFx, before: tBefore } } : {}), ...(myFrame ? { frame: myFrame } : {}) }), [view, pick, bar, talents, ult, roomWords, tText, tFx, tBefore, myFrame]);
  const runSeen = useRef(0);
  const handlers = {
    onView: (v: RoomView) => {
      // a code from another game's room: it can't be played here
      if (v.game !== 'sigilfall-ring') {
        linkRef.current?.close();
        linkRef.current = null;
        setView(null);
        setLinkState('none');
        setRoomErr('That code is for a different game’s room.');
        return;
      }
      setView(v);
      if (v.phase === 'lobby') {
        setRoomFight((f) => (f ? null : f));
      } else if (v.run !== runSeen.current) {
        // the host said go
        runSeen.current = v.run;
        const { setup: s, mine } = setupFromRoom(v);
        if (mine >= 0) {
          setResult(null);
          setRun((r) => r + 1);
          setRoomFight({ setup: s, mine, host: v.host === v.you });
        }
      }
    },
    onRelay: (_n: number, d: unknown) => inbox.current?.(_n, d),
    onState: (s: LinkState, why?: string) => {
      setLinkState(s);
      if (s === 'gone') {
        setView(null);
        setRoomFight(null);
        setRoomErr(why ? (roomErrors[why] ?? why) : 'The room has closed.');
        linkRef.current = null;
      }
    },
    onError: (msg: string) => setRoomErr(roomErrors[msg] ?? ''),
  };
  const openRoom = async (): Promise<void> => {
    setRoomErr('');
    setLinkState('connecting');
    try {
      linkRef.current = await Link.create<RoomView, RoomAction>(shownAs, handlers, 'sigilfall-ring');
    } catch (e) {
      setLinkState('none');
      setRoomErr(e instanceof Error ? e.message : 'Could not open a room.');
    }
  };
  const joinRoom = (): void => {
    const code = codeIn.trim().toUpperCase();
    if (!code) return;
    setRoomErr('');
    setLinkState('connecting');
    linkRef.current = new Link<RoomView, RoomAction>(code, shownAs, handlers);
  };
  const leaveRoom = (): void => {
    linkRef.current?.send({ t: 'bye' });
    linkRef.current?.close();
    linkRef.current = null;
    setView(null);
    setLinkState('none');
    setRoomFight(null);
  };
  // our choices go to the room as they change (a player without a side takes the first one with room)
  const sentPick = useRef('');
  useEffect(() => {
    if (!view || view.phase !== 'lobby' || !ready || !linkRef.current) return;
    const seated = view.seats.find((s) => s.you)?.pick;
    const team = seated ? seated.team : view.seats.filter((s) => s.pick?.team === 0).length < view.format ? 0 : 1;
    const say = JSON.stringify({ ...myPick, team });
    if (say !== sentPick.current) {
      sentPick.current = say;
      linkRef.current.send({ t: 'pick', pick: { ...myPick, team } });
    }
  }, [view, myPick, ready]);

  /* -------------------------------------------------- back, one level at a time */
  const back = (): void => {
    // (going back is leaving the tutorial, if one is being read)
    setTut(null);
    if (page === 'setup') setPage(setupFrom);
    else if (page === 'friends') {
      if (view) leaveRoom();
      setRoomErr('');
      setPage('play');
    } else onBack();
  };

  if (tutFight) {
    return (
      <RingMatch
        key={run}
        engine={engine}
        setup={tutFight.setup}
        myId={0}
        face={face}
        wear={wear}
        worn={worn}
        title={myTitle}
        body={body}
        role={{ kind: 'solo', skill: 0 }}
        sets={sets}
        stakes={null}
        tutorial
        onSets={putSets}
        onLeave={() => setTutFight(null)}
        onDone={(r) => {
          putLearn((l) => ({ ...l, asked: true, done: true }));
          setResult({ r, rating: null, rival: 'your sparring partner', kind: 'tutorial' });
          setTutFight(null);
        }}
      />
    );
  }
  if (fight) {
    const settle = (won: boolean, k = 1): RatingOutcome => settleFor(fight.format, fight.rivalRating, won, k);
    return (
      <RingMatch
        key={run}
        engine={engine}
        setup={fight.setup}
        myId={0}
        face={face}
        wear={wear}
        worn={worn}
        title={myTitle}
        body={body}
        role={{ kind: 'solo', skill: fight.skill, ...(fight.mates !== undefined ? { mates: fight.mates } : {}) }}
        sets={sets}
        stakes={fight.stakes}
        hints={hints}
        onSets={putSets}
        resume={fight.snap}
        onSnap={(snap) => writeLive({ ...fight, snap, at: Date.now() })}
        onLeave={(started) => {
          if (started) settle(false, LEAVER_K);
          else clearLive();
          setFight(null);
        }}
        onDone={(r) => {
          const was = standingOf(latest.current, fight.format);
          clearLive();
          const rating: RatingOutcome = r.draw ? { before: was.rating, after: was.rating, bestBefore: was.best, bestAfter: was.best, rankUp: null, streak: 0 } : settle(r.won);
          if (rating.rankUp) engine.sound.play('levelup');
          const track = keepMatch(r, fight.format, rating, fight.rival.name);
          setResult({ r, rating, rival: fight.rival.name, kind: 'solo', track });
          setFight(null);
        }}
      />
    );
  }
  if (roomFight) {
    const relay = (d: unknown): void => linkRef.current?.relay(d);
    const live = roomFight.live;
    const listen = (fn: RingInbox | null): void => {
      inbox.current = fn;
    };
    return (
      <RingMatch
        key={run}
        engine={engine}
        setup={roomFight.setup}
        myId={roomFight.mine}
        face={face}
        wear={wear}
        worn={worn}
        title={myTitle}
        body={body}
        role={roomFight.host ? { kind: 'host', skill: 0.6, send: relay, listen } : { kind: 'client', send: relay, listen }}
        sets={sets}
        stakes={live?.stakes ?? null}
        hints={hints}
        onSets={putSets}
        onSnap={live ? (snap) => writeLive({ ...live, snap, at: Date.now() }) : undefined}
        onLeave={(started) => {
          // (walking out of a match against people: a leaver's loss, and the match ends for the others)
          if (live && started) settleFor(live.format, live.rivalRating, false, LEAVER_K, live.ourRating);
          else if (live) clearLive();
          if (roomFight.matched) endSeek();
          else if (roomFight.host) linkRef.current?.send({ t: 'end' });
          setRoomFight(null);
        }}
        onDone={(r) => {
          let rating: RatingOutcome | null = null;
          if (live) {
            const was = standingOf(latest.current, live.format);
            clearLive();
            rating = r.draw ? { before: was.rating, after: was.rating, bestBefore: was.best, bestAfter: was.best, rankUp: null, streak: 0 } : settleFor(live.format, live.rivalRating, r.won, 1, live.ourRating);
            if (rating.rankUp) engine.sound.play('levelup');
          }
          const track = keepMatch(r, live?.format ?? (Math.max(1, Math.min(3, Math.ceil(roomFight.setup.fighters.length / 2))) as Format), rating, live?.rival.name);
          setResult({ r, rating, rival: live?.rival.name, kind: roomFight.matched ? 'matched' : 'room', track });
          if (roomFight.matched) endSeek(roomFight.host);
          else if (roomFight.host) linkRef.current?.send({ t: 'end' });
          setRoomFight(null);
        }}
      />
    );
  }
  if (result) {
    return (
      <RingResult
        match={result.r.match}
        myId={result.r.myId}
        won={result.r.won}
        draw={result.r.draw}
        rating={result.rating}
        rival={result.rival}
        dolls={result.r.dolls}
        lesson={result.r.lesson}
        track={result.track ?? null}
        tutorial={result.kind === 'tutorial'}
        againLabel={result.kind === 'room' ? 'Back to the room' : result.kind === 'tutorial' ? 'Find a real match' : 'Fight again'}
        onAgain={() => {
          if (result.kind !== 'room') findMatch();
          else {
            setResult(null);
            setPage('friends');
          }
        }}
        onSetup={() => {
          setResult(null);
          openSetup(result.kind === 'room' ? 'friends' : 'play');
        }}
        onExit={() => {
          setResult(null);
          if (result.kind === 'room') leaveRoom();
          setPage('play');
        }}
      />
    );
  }

  const title = page === 'setup' ? 'Your setup' : page === 'friends' ? 'With friends' : 'The Ring';
  const sub = page === 'setup' ? `${CLASSES[pick].name}. ${me ? 'Saved to your account as you go.' : 'Saved on this device. Sign in to keep them on every device.'}` : page === 'friends' ? 'A private room. Friendly matches don’t change your rating.' : 'Pick your hero and your fight. Use the stone.';
  // (the Play page is laid out as the Vigil's lobby and the Rift Trials' are, in their styles (rb-vlobby): the classes,
  // the hero large on a dais with what they bring beside them, the fight to choose, and one gold button at the foot.
  // The owner: "make the ui selection in the ring similar to the vigil and riftstones, currently the character feels
  // way too small on mobile". The setup and the room keep the Ring's own pages)
  const lobby = page === 'play';
  return (
    <ScreenGate label="Opening the Ring">
      <div className={lobby ? 'rb-vlobby rb-ringvl' : 'rb-ringlobby'} style={{ ['--cls' as string]: CLASSES[pick].colors.accent, ['--r' as string]: rank.color, ['--land' as string]: rank.color }}>
        <header className={lobby ? 'rb-vlobby-head' : 'rb-rp-head'}>
          <button className="rb-iconbtn" onClick={back} aria-label={page === 'play' ? 'Back to your heroes' : 'Back'}>
            ←
          </button>
          <div className="rb-rp-title">
            <h2>{title}</h2>
            <p>{sub}</p>
          </div>
          {page !== 'play' && (
            <button className="rb-btn is-small rb-rp-back" onClick={back}>
              {page === 'setup' ? 'Done' : view ? 'Leave room' : 'Back to the ladder'}
            </button>
          )}
          <button className="rb-iconbtn" onClick={() => setHelp(true)} aria-label="How The Ring works" title="How The Ring works">
            ?
          </button>
          <GameMenuButton className="rb-iconbtn" />
        </header>

        {page === 'play' && (
          <>
            <section className="rb-vlobby-hero" aria-label="Your hero">
              <ClassRow lobby pick={pick} onPick={choose} />
              <div className="rb-vlobby-stage">
                <i className="rb-vlobby-dais" aria-hidden="true" />
                <Doll key={pick} className="rb-vlobby-doll" src={doll} alt={CLASSES[pick].name} />
                <div className="rb-vlobby-name">
                  <strong>{CLASSES[pick].name}</strong>
                  <span className={`rb-ringvl-way is-${CLASS_EASE[pick]}`}>
                    {CLASS_WAY[pick]} · {EASE_WORD[CLASS_EASE[pick]]} to learn
                  </span>
                  {/* (with no title worn, the rank reached in this format is shown before the name: "Unblooded Guitartrick") */}
                  <Titled className="rb-rp-whoname" name={wear ? wear.name : hero} title={myTitle} orRank={rank} />
                </div>
              </div>
              <div className="rb-vlobby-kit rb-rp-setup" data-tut="loadout">
                <div className="rb-rp-looks">
                  <WearPicker engine={engine} cls={pick} onChange={() => setWearN((n) => n + 1)} />
                  <button className="rb-btn is-small" onClick={() => setLooksOpen(true)}>
                    Title & armor
                  </button>
                </div>
                <div className="rb-rp-setup-head">
                  <h3>
                    {playstyleOf(pick, bar)}
                  </h3>
                  <button className="rb-btn is-small" onClick={() => openSetup('play')}>
                    Change playstyle & talents
                  </button>
                </div>
                {/* (each one opens to be read: what it does, when to press it, what it combines with) */}
                <BarRow bar={bar} cls={pick} ult={ult} onPick={setReading} />
                <SetupChips cls={pick} setup={setup} />
                {!ready && <p className="rb-rp-warn">Your bar needs {SLOTS - bar.length} more.</p>}
              </div>
            </section>

            <section className="rb-vlobby-lands rb-ringvl-fight" aria-label="Your fight">
              <div className="rb-rp-formats" role="radiogroup" aria-label="Format" data-tut="formats">
                {FORMATS.map((f) => {
                  const st = standingOf(save, f);
                  const r = rankOf(st.best);
                  return (
                    <button key={f} role="radio" aria-checked={f === format} className={`rb-rp-format${f === format ? ' is-on' : ''}`} style={{ ['--r' as string]: r.color }} onClick={() => setFormat(f)}>
                      <strong>
                        {f}v{f}
                      </strong>
                      <b>{st.rating}</b>
                      <small>{r.name}</small>
                    </button>
                  );
                })}
              </div>

              <div className="rb-rp-rank" data-tut="rank">
                <span>
                  <b>{rank.name}</b> · {standing.wins} wins, {standing.losses} losses
                  {standing.streak >= 2 ? ` · ${standing.streak} in a row` : ''}
                </span>
                {next && (
                  <span className="rb-rp-next">
                    <i style={{ width: `${Math.max(0, Math.min(100, ((standing.best - rank.at) / (next.at - rank.at)) * 100))}%` }} />
                    <small>
                      {next.name} at {next.at}
                    </small>
                  </span>
                )}
              </div>
              <RewardStrip best={bestRating()} onOpen={() => setRewardsOpen(true)} />
              <ProgressLink record={save.record ?? {}} onOpen={() => setProgressOpen(true)} />

              {format > 1 && <MatesPicker format={format} cls={pick} bar={bar} mates={mates} onMates={putMates} />}

              <ArenaChoice
                map={map}
                open={mapsOpen}
                onOpen={setMapsOpen}
                onPick={(id) => {
                  setMap(id);
                  setMapsOpen(false);
                }}
              />

              {(barred || seekNote) && (
                <p className="rb-rp-error" role="status">
                  {barred ? BARRED_WHY : seekNote}
                </p>
              )}
            </section>

            <footer className="rb-vlobby-foot">
              <button className={`rb-btn is-gold is-big${barred ? ' is-barred' : ''}`} onClick={findMatch} aria-disabled={barred || undefined}>
                {!ready ? `Choose ${SLOTS - bar.length} more abilities` : barred ? 'No healers in 1v1' : `Find a ${format}v${format} match`}
              </button>
              <button className="rb-btn" onClick={() => setPage('friends')}>
                With friends
              </button>
              <button className="rb-btn" onClick={beginTutorial} data-tut="tutorial">
                Tutorial
              </button>
            </footer>
          </>
        )}

        {page === 'setup' && (
          <div className="rb-rp-setuppage">
            <SetupEditor key={pick} cls={pick} sets={sets} onSets={putSets} />
          </div>
        )}

        {page === 'friends' && <FriendsPage view={view} state={linkState} err={roomErr} ready={ready} codeIn={codeIn} setCodeIn={setCodeIn} onOpen={() => void openRoom()} onJoin={joinRoom} send={(a) => linkRef.current?.send(a)} myPick={myPick} pick={pick} onPick={choose} onSetup={() => openSetup('friends')} bar={bar} mates={roomMates} onRead={setReading} />}

        {look && <Seeking look={look} format={format} cls={pick} onCancel={() => endSeek()} />}
        {help && <RingHelp onClose={() => setHelp(false)} touch={engine.touchMode} engine={engine} onTutorial={beginTutorial} />}
        {reading && <AbilityCard key={reading.id} ab={reading} cls={pick} bar={bar} talents={talents} onClose={() => setReading(null)} />}
        {tutStep && tut !== null && (
          <Coach
            n={tut + 1}
            of={LOBBY_STEPS.length}
            title={tutStep.title}
            text={tutStep.text(pick)}
            at={tutStep.at}
            onBack={tut > 0 ? () => goTut(tut - 1) : undefined}
            onNext={tut < LOBBY_STEPS.length - 1 ? () => goTut(tut + 1) : startTutorialMatch}
            nextLabel={tut < LOBBY_STEPS.length - 1 ? (tutStep.id === 'welcome' ? 'Open my setup' : 'Next') : 'Start the practice fight'}
            onSkip={() => setTut(null)}
          />
        )}
        {firstVisit && tut === null && page === 'play' && !look && (
          <div className="rb-ring-dialog-wrap" role="dialog" aria-modal="true" aria-label="New to the Ring?">
            <div className="rb-ring-dialog rb-ring-welcome">
              <h2>New to the Ring?</h2>
              <p>Take the tutorial: about five minutes, from picking a class to your first fight. It shows you everything, and it doesn’t touch your rating.</p>
              <div className="rb-vigil-actions">
                <button className="rb-btn is-gold" onClick={beginTutorial} autoFocus>
                  Start the tutorial
                </button>
                <button className="rb-btn" onClick={() => putLearn((l) => ({ ...l, asked: true }))}>
                  Not now
                </button>
              </div>
              <small>You can take it any time from the Tutorial button or from the ? button.</small>
            </div>
          </div>
        )}
        {rewardsOpen && <RewardsDialog best={bestRating()} onClose={() => setRewardsOpen(false)} />}
        {progressOpen && <ProgressDialog record={save.record ?? {}} onClose={() => setProgressOpen(false)} />}
        {looksOpen && <LooksDialog engine={engine} cls={pick} wear={wear} plain={save.plain} doll={doll} shown={<Titled name={wear ? wear.name : hero} title={myTitle} />} onPlain={(p) => commit((now) => ({ ...now, plain: p }))} onChange={() => setWearN((n) => n + 1)} onClose={() => setLooksOpen(false)} frames={framesOwned(save.record ?? {})} frame={myFrame} onFrame={(id) => commit((now) => ({ ...now, frame: id ?? undefined }))} />}
      </div>
    </ScreenGate>
  );
}

const listed = (names: string[]): string => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`);

/** The waiting screen of a search: who has turned up, how long is left, and a way out. */
function Seeking({ look, format, cls, onCancel }: { look: SeekLook; format: Format; cls: ClassId; onCancel: () => void }) {
  const here = listed(look.others);
  const more = format * 2 - 1 - look.others.length;
  return (
    <div className="rb-ring-dialog-wrap rb-rp-seek" role="dialog" aria-modal="true" aria-label="Looking for a match">
      <div className="rb-ring-dialog">
        <i className={`rb-rp-seek-ring${look.full ? ' is-found' : ''}`} style={{ ['--c' as string]: CLASSES[cls].colors.accent }} aria-hidden="true">
          <b>{look.full ? '✓' : look.left}</b>
        </i>
        <h2>{look.full ? 'Match found' : 'Looking for players'}</h2>
        <p role="status">
          {look.full
            ? `${here}. The gates are opening.`
            : look.others.length
              ? `${here} ${look.others.length === 1 ? 'is' : 'are'} here. Waiting for ${more} more; the computer takes any place left empty.`
              : `A ${format}v${format} match. If nobody turns up in ${look.left} ${look.left === 1 ? 'second' : 'seconds'}, you fight the computer’s teams.`}
        </p>
        {!look.full && (
          <button className="rb-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function FriendsPage({ view, state, err, ready, codeIn, setCodeIn, onOpen, onJoin, send, myPick, pick, onPick, onSetup, bar, mates, onRead }: { view: RoomView | null; state: LinkState | 'none'; err: string; ready: boolean; codeIn: string; setCodeIn: (s: string) => void; onOpen: () => void; onJoin: () => void; send: (a: RoomAction) => void; myPick: RoomPick; pick: ClassId; onPick: (c: ClassId) => void; onSetup: () => void; bar: string[]; mates: MateChoice[] ; onRead: (ab: Ability) => void}) {
  const [copied, setCopied] = useState(false);
  if (!view) {
    return (
      <div className="rb-rp-friends">
        <div className="rb-rp-doors">
          <section className="rb-rp-door">
            <h3>Start a room</h3>
            <p>You get a code to share. Up to six players on two teams, and the computer fills any empty place.</p>
            <button className="rb-btn is-gold is-big" onClick={onOpen} disabled={state === 'connecting'}>
              {state === 'connecting' ? 'Connecting…' : 'Open a room'}
            </button>
          </section>
          <section className="rb-rp-door">
            <h3>Join a friend</h3>
            <p>Got a code from a friend? Type it here.</p>
            <form
              className="rb-rp-join"
              onSubmit={(e) => {
                e.preventDefault();
                onJoin();
              }}
            >
              <input value={codeIn} onChange={(e) => setCodeIn(e.target.value.toUpperCase())} placeholder="CODE" aria-label="Room code" maxLength={8} autoComplete="off" spellCheck={false} />
              <button type="submit" className="rb-btn" disabled={!codeIn.trim() || state === 'connecting'}>
                Join
              </button>
            </form>
          </section>
        </div>
        {err && (
          <p className="rb-rp-error" role="alert">
            {err}
          </p>
        )}
      </div>
    );
  }
  const host = view.host === view.you;
  /** A 1v1 room with a healer seated: it can't start until they change, or the format does (arena/ladder.ts barredFrom). */
  const healerIn = view.seats.some((s) => s.pick && barredFrom(view.format, s.pick.bar));
  const team = (t: 0 | 1): RoomView['seats'] => view.seats.filter((s) => s.pick?.team === t);
  const seated = !!view.seats.find((s) => s.you)?.pick;
  return (
    <div className="rb-rp-friends is-room">
      <section className="rb-rp-roomside">
        <div className="rb-rp-code">
          <small>Share this code</small>
          <strong>{view.code}</strong>
          <button
            className="rb-btn is-small"
            onClick={() => {
              void navigator.clipboard?.writeText(view.code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              });
            }}
          >
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </div>
        {state === 'reconnecting' && <p className="rb-rp-error">Reconnecting…</p>}
        <div className="rb-rp-block">
          <h3>You bring</h3>
          <ClassRow pick={pick} onPick={onPick} />
          <BarRow bar={bar} cls={pick} ult={myPick.ult} onPick={onRead} />
          <button className="rb-btn is-small" onClick={onSetup}>
            Change playstyle & talents
          </button>
        </div>
      </section>
      <section className="rb-rp-roommain">
        {host ? (
          <div className="rb-rp-roomsetup">
            <label>
              <small>Format</small>
              <select value={view.format} onChange={(e) => send({ t: 'setup', format: Number(e.target.value), map: view.map })}>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}v{f}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <small>Arena</small>
              <select value={view.map} onChange={(e) => send({ t: 'setup', format: view.format, map: e.target.value })}>
                {MAP_IDS.map((id) => (
                  <option key={id} value={id}>
                    {MAPS[id]!.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="rb-rp-roomnote">
            {view.format}v{view.format} on {MAPS[view.map]?.name}. The host chooses.
          </p>
        )}
        <div className="rb-rp-sides">
          {([0, 1] as const).map((t) => (
            <div key={t} className={`rb-rp-side is-t${t}`}>
              <h4>{t === 0 ? 'Blue team' : 'Red team'}</h4>
              {team(t).map((s) => (
                <span key={s.n} className={`rb-rp-seat${s.online ? '' : ' is-away'}${s.you ? ' is-you' : ''}`}>
                  <b style={{ color: CLASSES[s.pick!.cls as ClassId]?.colors.accent }}>
                    {s.name}
                    {s.you ? ' (you)' : ''}
                  </b>
                  <small>
                    {CLASSES[s.pick!.cls as ClassId]?.name}
                    {s.host ? ' · host' : ''}
                    {barredFrom(view.format, s.pick!.bar) ? ' · a healer: not in 1v1' : ''}
                  </small>
                </span>
              ))}
              {/* (the computer's places on your side hold the teammates you chose for this format, when you sat down first) */}
              {(team(t)[0]?.you ? slotsFor(view.format, team(t).map((s) => s.pick!.cls as ClassId), mates) : Array.from({ length: Math.max(0, view.format - team(t).length) }, () => null)).map((c, i) => (
                <span key={`e${i}`} className="rb-rp-seat is-empty">
                  <small>{c === null ? 'Computer, unless someone joins' : c === 'random' ? 'Computer: best fit, unless someone joins' : `Computer: ${setupName(c)}, unless someone joins`}</small>
                </span>
              ))}
              {myPick.team !== t && team(t).length < view.format && (
                <button className="rb-btn is-small" onClick={() => send({ t: 'pick', pick: { ...myPick, team: t } })}>
                  Move here
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="rb-rp-go">
          {host ? (
            <button className="rb-btn is-gold is-big" disabled={!ready || !seated || healerIn} onClick={() => send({ t: 'start' })}>
              {!ready ? `Choose ${SLOTS - bar.length} more abilities` : healerIn ? 'No healers in 1v1' : 'Start the match'}
            </button>
          ) : (
            <span className="rb-rp-waiting">Waiting for the host to start</span>
          )}
        </div>
        {healerIn && (
          <p className="rb-rp-error" role="status">
            {barredFrom(view.format, bar) ? BARRED_WHY : 'Healers can’t enter 1v1: someone seated has to change playstyle, or the host can choose 2v2 or 3v3.'}
          </p>
        )}
        {err && (
          <p className="rb-rp-error" role="alert">
            {err}
          </p>
        )}
      </section>
    </div>
  );
}
