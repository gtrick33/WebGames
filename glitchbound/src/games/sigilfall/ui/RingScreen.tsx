import { usePlayedMode } from './playedMode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GameMenuButton } from '../../../components/GameMenuButton';
import { fullBar, PRESETS, SLOTS, styleOfBar, type Ability } from '../arena/abilities';
import { fullTalents } from '../arena/talents';
import { afterMatch, clearLive, COMPS, drawOpponents, LEAVER_K, mateSkill, mmrOf, namedApart, nameFor, readLive, readRing, rivalFor, setsOf, skillAt, stakesOf, standingOf, writeLive, writeRing, type ClassSets, type Comp, type LiveMatch, type RingSave, barredFrom, BARRED_WHY, styleFor } from '../arena/ladder';
import { MAP_IDS, MAPS } from '../arena/maps';
import { bestRating, FORMATS, rankOf, seasonOf, type Format, type Standing } from '../arena/ranks';
import { NOTE_WORDS, partyRating, peopleMatchId, type MatchStats, type Report } from '../arena/ranked';
import { rankedApi, rankedStanding, readRanked, reportAndSettle, sendReport, writeRanked, type RankedCopy, type ShownStanding } from '../net/ranked';
import { friendsApi } from '../../../platform/friends';
import { InviteDialog, PlayLayer, type Ladder, type PartyShown } from './RingPlay';
import { InviteCards } from './Friends';
import { rewardsBetween } from '../arena/rewards';
import { GATES_SOLO, type FighterSetup, type MatchSetup } from '../arena/sim';
import { CLASS_EASE, CLASS_WAY, EASE_WORD } from '../arena/styles';
import { LOBBY_STEPS, tutorialSetup } from '../arena/tutorial';
import { Coach, useLabels, useSpot, useTutLock } from './RingCoach';
import { CLASS_IDS, CLASSES } from '../data/classes';
import { useAccount } from '../../../platform/account';
import { classOpen } from '../progress/paidClasses';
import type { ClassId } from '../data/types';
import type { SigilEngine } from '../engine';
import { Link, type LinkState } from '../net/link';
import { Seek, type SeekHandlers, type SeekLook } from '../net/ringSeek';
import { rivalsOf } from '../arena/queue';
import type { Action as RoomAction, Pick as RoomPick, View as RoomView } from '../net/ringRoom';
import { newCharacter, type Face } from '../progress/character';
import { heldWeapon, heroDollUrl, heroLook } from '../render/sprites';
import { RingMatch, type MatchHints, type MatchResult, type MatchStakes, type RingInbox } from './RingMatch';
import { RingResult, type RatingOutcome } from './RingResult';
import { AbilityCard, BarRow, RingHelp, SetupEditor } from './RingSetup';
import { wearOf, WearPicker } from './wear';
import { LooksDialog, plainWorn, RewardsDialog, ringTitle } from './RingRewards';
import { wornLooks } from '../progress/wardrobe';
import { Titled } from './Titled';
import { ScreenGate } from './ScreenGate';
import { Doll } from './Doll';
import { classEmblem } from './classEmblem';
import { choiceFromWord, choicesFor, choiceWord, fillSide, slotsFor, specOf, type MateChoice, type Spec } from '../arena/teammates';
import { cleanTitle, isTitleFx } from '../../../catalog/titleFx';
import { rankFx, type TitleShown } from '../progress/titles';
import { frameOf, framesOwned, recordMatch, trackGain, turnSeason, type TrackGain } from '../arena/record';
import { ProgressDialog, RecordBar, type ProgressTab } from './RingProgress';

const roomErrors: Record<string, string> = { full: 'That room is full.', in_run: 'That room is already in a match.' };
/** The same, for a party joined by a friend's invitation. */
const partyErrors: Record<string, string> = { full: 'That party is full, or already looking for a match. Ask your friend to stop the search and invite you again.', in_run: 'That party is in a match right now. Join them when it ends.' };
/** How long after inviting a friend the leader's Find waits for them, once, before going without them. */
const INVITE_WAIT_MS = 90_000;
/**
 * The party's leader pressed Find: should it wait for a friend they asked a moment ago, who isn't here yet (`room`:
 * the party has a place for them)? The first press says so; a second, within a while, goes without them.
 */
export function waitForFriend(asked: Record<string, number>, warned: { current: number }, room: boolean, now = Date.now()): boolean {
  const pending = room && Object.values(asked).some((at) => now - at < INVITE_WAIT_MS);
  if (pending && now - warned.current > 15_000) {
    warned.current = now;
    return true;
  }
  warned.current = 0;
  return false;
}
/** The player's numbers in a match that ended, sent with its ranked report for the admin to see (arena/ranked.ts MatchStats). */
function matchStats(r: MatchResult): MatchStats | undefined {
  const me = r.match.fighters[r.myId];
  if (!me) return undefined;
  const sc = me.score;
  return { cls: me.cls, secs: Math.round(r.match.clock), dmg: Math.round(sc.dmg), heal: Math.round(sc.heal), cc: Math.round(sc.cc), kicks: sc.kicks, combos: sc.combos ?? 0, supers: sc.supers ?? 0 };
}

/** One of the arenas, at random. */
const anyMap = (): string => MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)]!;

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

/**
 * The Ring's two pages: its main screen (the class, the hero, and how they fight: the playstyle and its talents, all in
 * sight), and a room with friends. What kind of fight to find (the format, the teammates, the arena, the rank and the
 * rewards) is a layer over the main screen, opened from the fight it has chosen beside the button that finds one (the
 * owner, 2026-11-17: "the only way to select a playstyle is if i click on change style and talents, i want playstyle to
 * be visible at all times and basically that screen to be the main screen, the play mode, partners, and etc could be a
 * different layer/pop up").
 */
type Page = 'play' | 'friends';


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
          <button key={c} role="radio" aria-checked={c === pick} aria-disabled={!classOpen(c, me)} aria-label={`${CLASSES[c].name}: ${CLASS_WAY[c]}, ${EASE_WORD[CLASS_EASE[c]]}`} title={classOpen(c, me) ? `${CLASSES[c].name}: ${CLASS_WAY[c]}, ${EASE_WORD[CLASS_EASE[c]]}` : `${CLASSES[c].name}: unlock it in the shop`} className={`rb-vlobby-class${c === pick ? ' is-on' : ''}${classOpen(c, me) ? '' : ' is-locked'}`} style={{ ['--c' as string]: CLASSES[c].colors.accent }} onClick={() => classOpen(c, me) && onPick(c)}>
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
          title={classOpen(c, me) ? `${CLASSES[c].name}: ${CLASS_WAY[c]}, ${EASE_WORD[CLASS_EASE[c]]}` : `${CLASSES[c].name}: unlock it in the shop`}
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

/** The computer's teammates chosen for a 2v2's or a 3v3's empty places, in two words, for the fight shown at the foot. */
const matesWord = (kept: unknown, format: Format): string =>
  choicesFor(kept, format).every((x) => x === 'random') ? 'Best-fit teammates' : 'Your teammates';

const setupName = (s: Spec): string => `${CLASSES[s.cls].name} (${PRESETS[s.cls][s.preset]!.name})`;

/**
 * The Ring, as three plain pages: Play (who, what kind of fight, go), Setup (what you bring), and With friends. A
 * match and its result lie beyond them, and every page has one way back.
 */
export function RingScreen({ engine, face, body, cls, name, onBack, resume, party: invitedTo }: { engine: SigilEngine; face?: Face; body?: 'm' | 'f'; cls?: ClassId; name?: string; onBack: () => void; resume?: LiveMatch; party?: string }) {
  usePlayedMode(engine, 'ring');
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
  /** The layer of what kind of fight to find, over the main screen; and the setup over a room with friends. */
  const [playOpen, setPlayOpen] = useState(!!invitedTo);
  const [setupOpen, setSetupOpen] = useState(false);
  const [format, setFormat] = useState<Format>(1);
  const { me } = useAccount();

  /* -------------------------------------------------- the ranked ladder */
  // A signed-in player's standing is the server's (net/ranked.ts): asked for as the Ring opens, shown from this
  // device's copy until it answers, and moved only by the server as matches are settled. A guest's is a practice
  // rating kept on this device, as before.
  const user = me?.id ?? null;
  const [rk, setRk] = useState<RankedCopy | null>(() => readRanked(user));
  const rkRef = useRef(rk);
  const [ladderState, setLadderState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const putRanked = (season: number, standings: Partial<Record<string, ShownStanding>>): void => {
    if (!user) return;
    const was = rkRef.current?.user === user ? rkRef.current : null;
    const next: RankedCopy = { user, at: Date.now(), season, standings: { ...was?.standings, ...standings } };
    rkRef.current = next;
    writeRanked(next);
    setRk(next);
  };
  useEffect(() => {
    if (!user) return;
    let on = true;
    rankedApi.me().then(
      (r) => {
        if (!on) return;
        if (r.signedIn && r.standings) {
          // (a copy of another account's, on this device, is no use)
          if (rkRef.current?.user !== user) rkRef.current = null;
          putRanked(r.season ?? seasonOf(Date.now()), r.standings);
          setLadderState('ready');
        } else setLadderState('offline');
      },
      () => on && setLadderState('offline'),
    );
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const ladder: Ladder = !user ? 'guest' : ladderState === 'ready' ? 'ranked' : ladderState === 'loading' ? 'loading' : 'offline';
  /** A format's standing: the ranked ladder's (signed in), or the practice rating on this device. */
  const standingIn = (f: Format): Standing => (user ? rankedStanding(rkRef.current?.user === user ? rkRef.current : null, f) : standingOf(latest.current, f));
  const [seasonAtOpen] = useState(() => seasonOf(Date.now()));
  const seasonNow = rk?.season ?? seasonAtOpen;
  /** This account's copy of its ranked standings, if the copy is this account's. */
  const rkMine = rk?.user === user ? rk : null;
  const [pick, setPick] = useState<ClassId>(cls && classOpen(cls, me) ? cls : 'warrior');
  const [map, setMap] = useState<string>('random');
  const [help, setHelp] = useState(false);
  // the tutorial (arena/tutorial.ts): its step over the lobby, if it's being taken, and its practice match
  const [tut, setTut] = useState<number | null>(null);
  const [tutFight, setTutFight] = useState<{ setup: MatchSetup } | null>(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  /** The record's window, open on one of its pages (the main screen's record bar opens each on its own). */
  const [progressOpen, setProgressOpen] = useState<ProgressTab | false>(false);
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
  const [fight, setFight] = useState<{ setup: MatchSetup; rival: Comp; skill: number; mates?: number; rivalRating: number; stakes: MatchStakes; format: Format; snap?: LiveMatch['snap']; ticket?: string; unrated?: boolean } | null>(() => (resume ? { ...resume, stakes: resume.stakes } : null));
  // (`matched`: found by a search, not a room of friends: there is no room to go back to when it ends, and it is
  // rated, `live` being what is kept of it while it goes, as for a match against the computer's teams)
  // (`party`: found by the party's own search, from its room: the room stays the party's when it ends)
  const [roomFight, setRoomFight] = useState<{ setup: MatchSetup; mine: number; host: boolean; matched?: boolean; party?: boolean; live?: LiveMatch } | null>(null);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ r: MatchResult; rating: RatingOutcome | null; rival?: string; kind: 'solo' | 'matched' | 'room' | 'tutorial'; track?: TrackGain | null; party?: boolean; why?: string } | null>(null);
  // a search for other players (net/ringSeek.ts): what its waiting screen shows, and a word left by one that ended badly
  const [look, setLook] = useState<SeekLook | null>(null);
  const [seekNote, setSeekNote] = useState('');
  const seekRef = useRef<Seek | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [linkState, setLinkState] = useState<LinkState | 'none'>(invitedTo ? 'connecting' : 'none');
  const [roomErr, setRoomErr] = useState('');
  const [codeIn, setCodeIn] = useState('');
  const linkRef = useRef<Link<RoomView, RoomAction> | null>(null);
  const inbox = useRef<RingInbox | null>(null);
  /** The run of a room's match last begun here. */
  const runSeen = useRef(0);
  /**
   * What the room the player is in is for: a custom game with friends (its own page, no rating) or a party that queues
   * ranked as one team (the layer where the fight is chosen). Opened by a friend's invitation (`invitedTo`): straight
   * into their party. The ref is what the room's handlers read (they are made once, with the room).
   */
  const [roomMode, setMode] = useState<'custom' | 'party' | null>(invitedTo ? 'party' : null);
  const modeRef = useRef<'custom' | 'party' | null>(invitedTo ? 'party' : null);
  const [partyCode, setPartyCode] = useState(invitedTo ?? '');
  /** The party's room's latest view, handled with this render's state (set after every render). */
  const partyRef = useRef<((v: RoomView) => void) | null>(null);
  useEffect(
    () => () => {
      seekRef.current?.stop();
      // (a party left with the Ring: its seat goes, so the others aren't left waiting for this player)
      if (modeRef.current === 'party') linkRef.current?.send({ t: 'bye' });
      linkRef.current?.close();
      linkRef.current = null;
    },
    [],
  );
  /** A friend's party was just joined: its first word says whether anyone is still in it. */
  const joining = useRef(false);

  const hero = name ?? 'You';
  // (what other people see: a player with no campaign hero goes by their arcade name, not as somebody else's "You")
  const shownAs = name ?? (engine.defaultName.trim() || 'You');
  const standing = user ? rankedStanding(rkMine, format) : standingOf(save, format);
  const rank = rankOf(standing.best);
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
    setSetupOpen(false);
    if (page !== st.page) setPage(st.page);
    // (a step about the fight to find opens its layer; any other puts it away)
    setPlayOpen(st.layer === 'play');
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
    setPlayOpen(false);
    setRun((r) => r + 1);
    setTutFight({ setup: tutorialSetup(me, seed) });
  };
  /** One-time hints in a real match (arena/lessons.ts), unless the game's tutorial hints are off. */
  const hints: MatchHints | undefined = engine.settings.tutorial ? { seen: learn.hints ?? [], onSeen: (id) => putLearn((l) => ({ ...l, hints: [...new Set([...(l.hints ?? []), id])] })) } : undefined;

  const enter = async (): Promise<void> => {
    // (a bar not yet whole: the main screen it is on says so)
    if (!ready) return;
    // (a healer with 1v1 chosen: nothing to find, and the page already says why)
    if (barred) return;
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const { comp, fighters } = drawOpponents(format, seed);
    const fill = fillSide(format, [specOf(pick, bar)], mates, seed);
    const team: FighterSetup[] = [{ team: 0, cls: pick, name: hero, bar, talents, ult, human: true, ...frameOn }, ...fill.map((x, i) => ({ team: 0 as const, cls: x.cls, name: nameFor(x.cls, seed + i + 11), bar: PRESETS[x.cls][x.preset]!.bar, talents: PRESETS[x.cls][x.preset]!.talents }))];
    // the other side's rating lands either way of your matchmaking rating, up to 150 (what it pays and costs follows:
    // stakesOf), and how sharp the computer plays follows it; your own side's play to yours. On the ranked ladder the
    // server draws it, and writes the match down before the gates open (a ticket: arena/ranked.ts)
    let rivalRating = rivalFor(standing, seed);
    let wl = stakesOf(standing, rivalRating);
    let ticket: string | undefined;
    let note: string | undefined;
    let unrated = false;
    if (user) {
      const t = await rankedApi.bots(format).catch(() => null);
      if (t) {
        ticket = t.match;
        rivalRating = t.rival;
        wl = t.stakes;
        if (t.note) note = NOTE_WORDS[t.note];
        putRanked(t.standing.season, { [format]: t.standing });
      } else {
        // (the ladder can't be reached: the match is played, and counts for nothing)
        unrated = true;
        wl = { win: 0, lose: 0 };
        note = NOTE_WORDS.offline;
      }
    }
    const st = standingIn(format);
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
      mates: mateSkill(mmrOf(st)),
      rivalRating,
      format,
      stakes: { format, rating: st.rating, rank: rankOf(st.best).name, color: rankOf(st.best).color, ...wl, rival: comp.name, blurb: comp.blurb, rivalRating, ...(note ? { note } : {}) },
      ...(ticket ? { ticket } : {}),
      ...(unrated ? { unrated } : {}),
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

  /**
   * A match on the ranked ladder is over for this player: their report, and, once the ladder has settled it (a match
   * against people waits for everyone's), what it did, handed to `done`. Still waiting after a while: `pending`, and the
   * ladder settles it without them (it is asked again as the Ring next opens).
   */
  const settleRanked = (ticket: string, report: Report, f: Format, done: (o: RatingOutcome) => void, stats?: MatchStats): void => {
    clearLive();
    const wasBest = bestRating();
    const was = standingIn(f);
    const waiting: RatingOutcome = { before: was.rating, after: was.rating, bestBefore: was.best, bestAfter: was.best, rankUp: null, streak: was.streak, pending: true };
    reportAndSettle(ticket, report, undefined, undefined, stats).then(
      (got) => {
        if (!('settled' in got)) return done(waiting);
        putRanked(got.standing.season, { [f]: got.standing });
        void engine.reportRanks();
        done({ before: got.standing.rating - got.change, after: got.standing.rating, bestBefore: was.best, bestAfter: got.standing.best, rankUp: got.rankUp ?? null, streak: got.standing.streak, rewards: rewardsBetween(wasBest, bestRating()), ...(got.note ? { note: NOTE_WORDS[got.note] } : {}) });
      },
      () => done(waiting),
    );
  };
  /** A ranked match left: a leaver's loss once the gates have lifted (the ladder has the last word on who left). */
  const leaveRanked = (ticket: string, f: Format, started: boolean): void => {
    clearLive();
    sendReport(ticket, started ? 'left' : 'void').then(
      (got) => {
        if ('settled' in got) putRanked(got.standing.season, { [f]: got.standing });
      },
      () => undefined,
    );
  };

  /** Out of a search, or of the match it found (`soon`: this end ran the match, and lets its last word arrive first). */
  const endSeek = (soon = false): void => {
    if (soon) seekRef.current?.stopSoon();
    else seekRef.current?.stop();
    seekRef.current = null;
    // (a party's room is its own: it stays)
    if (modeRef.current !== 'party') linkRef.current = null;
    setLook(null);
  };

  /**
   * A match found by a search, or by the party's own (`party`), has begun: against people, rated as a match against
   * the computer's teams is, against the other side's rating (the owner: "same logic as the leaver penalty"), kept
   * while it goes so that walking out of it, or closing it, is a leaver's loss. Signed in, it is a match on the ranked
   * ladder, by its room's roster (net/ranked.ts): what it stands for comes from the server a moment later.
   */
  const beginMatched = (v: RoomView, link: Link<RoomView, RoomAction>, party: boolean): void => {
    const { setup: s, mine } = setupFromRoom(v);
    runSeen.current = v.run;
    if (mine < 0) {
      if (!party) {
        endSeek();
        void enter();
      }
      return;
    }
    const st = standingIn(v.format);
    const them = rivalsOf(v);
    const rivalRating = them.rating ?? mmrOf(st);
    // (each player's own matchmaking rating against the other side's mean: in a team far apart, the stronger one
    // wins little and loses a lot, the weaker one the other way round)
    const ourRating = mmrOf(st);
    const rival = listed(them.names) || 'the other team';
    const rk = rankOf(st.best);
    const ticket = user ? peopleMatchId(v.code, v.run, v.runSeed) : undefined;
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
      ...(ticket ? { ticket } : {}),
    };
    writeLive(live);
    linkRef.current = link;
    setLook(null);
    setResult(null);
    setRun((r) => r + 1);
    setRoomFight({ setup: s, mine, host: v.host === v.you, matched: true, party, live });
    if (ticket)
      rankedApi.people(v.code, v.run).then(
        (p) => {
          const next: LiveMatch = { ...live, rivalRating: p.rival, ourRating: p.ours, stakes: { ...live.stakes, win: p.stakes.win, lose: p.stakes.lose, rivalRating: p.rival, ...(p.note ? { note: NOTE_WORDS[p.note] } : {}) } };
          if (readLive()?.ticket === ticket) writeLive(next);
          setRoomFight((f) => (f?.live?.ticket === ticket ? { ...f, live: next } : f));
        },
        () => undefined,
      );
  };

  /** What a search does with what it finds (for a party's search as for anyone's). */
  const seekHandlers = (party: boolean): SeekHandlers => ({
    onLook: setLook,
    onRun: (v, link) => beginMatched(v, link, party),
    onBots: () => {
      seekRef.current = null;
      setLook(null);
      void enter();
    },
    onRelay: (n, d) => inbox.current?.(n, d),
    onGone: () => {
      seekRef.current = null;
      // (someone else left: on the ranked ladder, the room's own record says who, and they take the loss)
      const l = readLive();
      if (l?.ticket) void rankedApi.report(l.ticket, 'void').catch(() => undefined);
      clearLive();
      if (party) {
        if (linkRef.current?.view?.host === linkRef.current?.view?.you) linkRef.current?.send({ t: 'end' });
      } else linkRef.current = null;
      setRoomFight(null);
      setSeekNote('That match ended because a player left it. Your rating is as it was, and the leaver takes the loss.');
    },
    onCancel: (why) => {
      seekRef.current = null;
      setLook(null);
      if (why) setSeekNote(why);
    },
  });

  /**
   * "Find a match": other players first, for ten seconds, then the computer's teams (the owner: "try to find existing
   * players for a while and after 10 secs of loading screen, load bots if noone is queing"). In a party, its leader
   * puts the party's room in the queue instead, and the others wait with them.
   */
  const findMatch = (): void => {
    if (!ready) return;
    // (a healer with 1v1 chosen: nothing to find, and the page already says why)
    if (barred) return;
    setResult(null);
    setPage('play');
    setSeekNote('');
    seekRef.current?.stop();
    seekRef.current = null;
    const ground = map === 'random' ? anyMap() : map;
    const myPickNow = { cls: pick, bar, talents, ult, rating: mmrOf(standing), mates: mates.map(choiceWord), ...pickTitle(myTitle), ...frameOn };
    if (modeRef.current === 'party') {
      const v = linkRef.current?.view;
      // (only the leader starts the party's search; everyone else waits for it, the layer says so)
      if (!v || v.host !== v.you || !linkRef.current) return;
      // (a friend asked a moment ago and not here yet: the first press waits for them, a second goes without them)
      if (waitForFriend(asked, warnedAt, partySeats(v).length < v.format)) {
        setSeekNote('Your friend hasn’t joined yet. Wait for them, or press Find again to go without them.');
        return;
      }
      const ratings = partySeats(v).map((x) => x.pick!.rating ?? mmrOf(standing));
      // (however far apart: the party is matched at its median, and each player wins and loses by their own rating)
      setPlayOpen(false);
      seekRef.current = new Seek({ format: v.format, map: ground, name: shownAs, pick: myPickNow, party: linkRef.current, rating: partyRating(ratings) }, seekHandlers(true));
      return;
    }
    setPlayOpen(false);
    seekRef.current = new Seek({ format, map: ground, name: shownAs, pick: myPickNow }, seekHandlers(false));
  };

  /* -------------------------------------------------- the room: a custom game, or a party */
  /**
   * What the room the player is in is for: a custom game with friends (its own page, no rating) or a party that queues
   * ranked as one team (the layer where the fight is chosen).
   */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [asked, setAsked] = useState<Record<string, number>>({});
  /** When the leader was told a friend they asked isn't here yet (a second press within a while goes without them). */
  const warnedAt = useRef(0);
  const roomMates = view ? choicesFor(save.mates?.[view.format], view.format) : [];
  const roomWords = roomMates.map(choiceWord).join(' ');
  // (the title worn, sent to the room so everyone sees it over this player's head)
  const tText = myTitle?.text ?? '';
  const tFx = myTitle?.fx ?? 'plain';
  const tBefore = myTitle?.before ?? true;
  // (in a party, the rating it searches at is worked from everyone's: arena/ranked.ts partyRating)
  const partyMmr = roomMode === 'party' && view ? mmrOf(user ? rankedStanding(rkMine, view.format as Format) : standingOf(save, view.format as Format)) : null;
  const myPick = useMemo((): RoomPick => ({ team: view?.seats.find((s) => s.you)?.pick?.team ?? 0, cls: pick, bar, talents, ult, ...(partyMmr !== null ? { rating: partyMmr } : {}), ...(roomWords ? { mates: roomWords.split(' ') } : {}), ...(tText ? { title: { text: tText, fx: tFx, before: tBefore } } : {}), ...(myFrame ? { frame: myFrame } : {}) }), [view, pick, bar, talents, ult, partyMmr, roomWords, tText, tFx, tBefore, myFrame]);
  /** The party's room said something new (its handlers are made once: this is read through a ref, always the latest). */
  const partyView = (v: RoomView): void => {
    // (an invitation outlives its party: a friend who left it, or opened another, left nobody here to play with)
    if (joining.current) {
      joining.current = false;
      if (!v.seats.some((x) => !x.you)) {
        leaveRoom();
        setSeekNote('That party has closed: nobody is in it any more. Ask your friend to invite you again.');
        return;
      }
    }
    seekRef.current?.seen();
    const leader = v.host === v.you;
    if (v.phase === 'lobby') {
      // (the party's format is its leader's; never 1v1)
      if (leader && v.queued === null && v.format !== Math.max(2, format)) linkRef.current?.send({ t: 'setup', format: Math.max(2, format), map: v.map });
      if (!leader && v.format !== format) setFormat(v.format as Format);
      // the leader put the party in the queue: everyone else waits with them
      if (!leader && v.queued !== null && !seekRef.current && v.seats.find((x) => x.you)?.pick && linkRef.current) {
        seekRef.current = new Seek({ format: v.format, map: v.map, name: shownAs, pick: myPick, party: linkRef.current }, seekHandlers(true));
      }
      return;
    }
    // a match began that this end wasn't waiting for (it came back just as it did): in, all the same
    if (v.run !== runSeen.current && !seekRef.current && linkRef.current && v.seats.find((x) => x.you)?.pick) beginMatched(v, linkRef.current, true);
  };
  /**
   * The room's handlers, for one connection. Only the connection the Ring is on now is listened to: one that was let go
   * (a party left for a friend's, a room closed for a party) still says it closed a moment later, and that word must
   * not take the new party down with it (it did: the player stayed seated in their friend's room, but their game had
   * let go of it, so the friend's match began without them).
   */
  const linkHandlers = (): { h: typeof handlers; mine: (l: Link<RoomView, RoomAction>) => Link<RoomView, RoomAction> } => {
    let me: Link<RoomView, RoomAction> | null = null;
    const live = (): boolean => !!me && linkRef.current === me;
    return {
      h: {
        onView: (v: RoomView) => {
          if (live()) handlers.onView(v);
        },
        onRelay: (n: number, d: unknown) => {
          if (live()) handlers.onRelay(n, d);
        },
        onState: (st: LinkState, why?: string) => {
          if (live()) handlers.onState(st, why);
        },
        onError: (msg: string) => {
          if (live()) handlers.onError(msg);
        },
      },
      mine: (l) => (me = l),
    };
  };
  /** Connects to a room by its code (a friend's party, a room of friends), as the connection the Ring is on. */
  const connect = (code: string): Link<RoomView, RoomAction> => {
    const b = linkHandlers();
    const l = new Link<RoomView, RoomAction>(code, shownAs, b.h);
    linkRef.current = b.mine(l);
    return l;
  };
  /** Opens a new room of the Ring's and connects to it, as the connection the Ring is on. */
  const create = async (): Promise<Link<RoomView, RoomAction>> => {
    const b = linkHandlers();
    const l = await Link.create<RoomView, RoomAction>(shownAs, b.h, 'sigilfall-ring');
    linkRef.current = b.mine(l);
    return l;
  };
  const handlers = {
    onView: (v: RoomView) => {
      // a code from another game's room: it can't be played here
      if (v.game !== 'sigilfall-ring') {
        linkRef.current?.close();
        linkRef.current = null;
        setView(null);
        setLinkState('none');
        setMode(null);
        setRoomErr('That code is for a different game’s room.');
        return;
      }
      setView(v);
      if (modeRef.current === 'party') return partyRef.current?.(v);
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
        const was = modeRef.current;
        setView(null);
        setRoomFight(null);
        setMode(null);
        linkRef.current = null;
        if (was === 'party') {
          seekRef.current?.stop();
          seekRef.current = null;
          setLook(null);
          setSeekNote(why ? (partyErrors[why] ?? why) : 'The party has closed.');
        } else setRoomErr(why ? (roomErrors[why] ?? why) : 'The room has closed.');
      }
    },
    onError: (msg: string) => (modeRef.current === 'party' ? undefined : setRoomErr(roomErrors[msg] ?? '')),
  };
  const openRoom = async (): Promise<void> => {
    if (modeRef.current === 'party') leaveRoom();
    setRoomErr('');
    setLinkState('connecting');
    modeRef.current = 'custom';
    setMode('custom');
    try {
      await create();
    } catch (e) {
      setLinkState('none');
      setMode(null);
      setRoomErr(e instanceof Error ? e.message : 'Could not open a room.');
    }
  };
  const joinRoom = (): void => {
    const code = codeIn.trim().toUpperCase();
    if (!code) return;
    if (modeRef.current === 'party') leaveRoom();
    setRoomErr('');
    setLinkState('connecting');
    modeRef.current = 'custom';
    setMode('custom');
    connect(code);
  };
  const leaveRoom = (): void => {
    if (modeRef.current === 'party') {
      seekRef.current?.stop();
      seekRef.current = null;
      setLook(null);
    }
    linkRef.current?.send({ t: 'bye' });
    linkRef.current?.close();
    linkRef.current = null;
    setView(null);
    setLinkState('none');
    setRoomFight(null);
    modeRef.current = null;
    setMode(null);
    setPartyCode('');
    // (a new party asks its friends anew)
    setAsked({});
  };

  /** A party of this player's own, opened to invite a friend into (or the one they are in). Its code, or null. */
  const openParty = async (): Promise<string | null> => {
    if (modeRef.current === 'party' && linkRef.current) return linkRef.current.code;
    if (linkRef.current) leaveRoom();
    setSeekNote('');
    modeRef.current = 'party';
    setMode('party');
    setLinkState('connecting');
    // (a party is a team: 2v2, unless 3v3 was chosen)
    if (format === 1) setFormat(2);
    try {
      const l = await create();
      setPartyCode(l.code);
      return l.code;
    } catch {
      setMode(null);
      setLinkState('none');
      setSeekNote('A party couldn’t be opened right now. Try again in a moment.');
      return null;
    }
  };
  /** Joins a friend's party by its code: the invitation they sent, or the code they gave. */
  const joinParty = (code: string): void => {
    if (!/^[A-Z]{4,8}$/.test(code)) return;
    if (linkRef.current) leaveRoom();
    setSeekNote('');
    modeRef.current = 'party';
    setMode('party');
    setPartyCode(code);
    setLinkState('connecting');
    setPage('play');
    setInviteOpen(false);
    setPlayOpen(true);
    joining.current = true;
    connect(code);
  };
  /** Asks a friend into the party (opening one first): their invitation arrives wherever they are in Sigilfall. */
  const inviteFriend = async (id: string): Promise<void> => {
    setAsked((a) => ({ ...a, [id]: Date.now() }));
    const code = await openParty();
    const failed = (): void => {
      setAsked(({ [id]: _gone, ...rest }) => rest);
      setSeekNote('The invitation didn’t go out. Try again in a moment.');
    };
    if (!code) return failed();
    await friendsApi.invite(id, 'sigilfall-ring', code).catch(failed);
  };
  /** A friend's invitation to team up, taken here in the Ring. */
  const takeInvite = (id: number, code: string): void => {
    engine.acceptInvite(id);
    joinParty(code.toUpperCase());
  };

  // our choices go to the room as they change (a player without a side takes the first one with room)
  const sentPick = useRef('');
  useEffect(() => {
    if (!view || view.phase !== 'lobby' || !ready || !linkRef.current) return;
    const seated = view.seats.find((s) => s.you)?.pick;
    const team = seated ? seated.team : view.seats.filter((s) => s.pick?.team === 0).length < view.format ? 0 : 1;
    // (said again in each room, and to each seat: a player who comes from another room with the same choices must
    // still sit down in this one, or their party never sees them and its match begins without them)
    const say = JSON.stringify({ room: view.code, seat: view.you, run: view.run, ...myPick, team });
    if (say !== sentPick.current || !seated) {
      sentPick.current = say;
      linkRef.current.send({ t: 'pick', pick: { ...myPick, team } });
    }
  }, [view, myPick, ready]);

  /** The party as the layer shows it: everyone on its side, you first (in the queue: the party's own seats). */
  const partyShown: PartyShown | null =
    roomMode === 'party'
      ? {
          code: view?.code ?? partyCode,
          leader: !view || view.host === view.you,
          connecting: linkState === 'connecting' || !view,
          members: view
            ? partySeats(view)
                .sort((a, b) => Number(b.you) - Number(a.you))
                .map((x) => ({ n: x.n, name: x.name, cls: CLASS_IDS.includes(x.pick!.cls as ClassId) ? (x.pick!.cls as ClassId) : null, bar: x.pick!.bar, rating: x.pick!.rating ?? null, you: x.you, online: x.online }))
            : [],
        }
      : null;
  // a friend joins or leaves the party: said on the Ring's own screen, wherever the player is looking
  const memberNames = partyShown ? partyShown.members.filter((m) => !m.you).map((m) => m.name) : null;
  const memberKey = memberNames ? memberNames.join('\n') : null;
  const knownMembers = useRef<string[] | null>(null);
  useEffect(() => {
    const was = knownMembers.current;
    const now = memberKey === null ? null : memberKey ? memberKey.split('\n') : [];
    knownMembers.current = now;
    if (!was || !now) return;
    const came = now.filter((n) => !was.includes(n));
    const went = was.filter((n) => !now.includes(n));
    const say = came.length ? `${listed(came)} joined your party.` : went.length ? `${listed(went)} left your party.` : '';
    if (!say) return;
    if (came.length) engine.sound.play('ring-buff');
    setSeekNote(say);
    // (news for a moment, not a note that stays)
    const t = window.setTimeout(() => setSeekNote((n) => (n === say ? '' : n)), 6000);
    return () => window.clearTimeout(t);
  }, [memberKey, engine]);
  // (in a party the format is the room's: its leader's choice)
  const fightFormat: Format = roomMode === 'party' && view ? (view.format as Format) : format;

  /** In a party, someone other than its leader: the leader chooses the fight and starts the search. */
  const follower = !!partyShown && !partyShown.leader;
  /** The format chosen: in a party, its leader's, for the whole party (never 1v1: a party is a team). */
  const chooseFormat = (f: Format): void => {
    if (modeRef.current === 'party') {
      const v = linkRef.current?.view;
      if (f === 1 || !v || v.host !== v.you || v.queued !== null) return;
      linkRef.current?.send({ t: 'setup', format: f, map: v.map });
    }
    setFormat(f);
  };

  /* -------------------------------------------------- back, one level at a time */
  const back = (): void => {
    // (going back is leaving the tutorial, if one is being read)
    setTut(null);
    if (setupOpen) setSetupOpen(false);
    else if (inviteOpen) setInviteOpen(false);
    else if (playOpen) setPlayOpen(false);
    else if (page === 'friends') {
      if (view) leaveRoom();
      setRoomErr('');
      setPage('play');
    } else {
      // (leaving the Ring leaves the party)
      if (modeRef.current === 'party') leaveRoom();
      onBack();
    }
  };

  /**
   * A ranked match is over: the result on screen at once, saying it is being checked, and what the ladder made of it
   * (and the match into the history, the challenges and the season) as soon as it has settled it.
   */
  const endRanked = (r: MatchResult, ticket: string, f: Format, rival: string, kind: 'solo' | 'matched', party?: boolean): void => {
    const was = standingIn(f);
    setResult({ r, rating: { before: was.rating, after: was.rating, bestBefore: was.best, bestAfter: was.best, rankUp: null, streak: was.streak, pending: true }, rival, kind, track: null, party });
    setFight(null);
    setRoomFight(null);
    settleRanked(
      ticket,
      r.draw ? 'draw' : r.won ? 'won' : 'lost',
      f,
      (rating) => {
        if (rating.rankUp) engine.sound.play('ring-levelup');
        const track = keepMatch(r, f, rating.pending ? null : rating, rival);
        setResult((now) => (now && now.r === r ? { ...now, rating, track } : now));
      },
      matchStats(r),
    );
  };

  useEffect(() => {
    modeRef.current = roomMode;
  }, [roomMode]);
  useEffect(() => {
    partyRef.current = partyView;
  });
  // the Ring opened by a friend's invitation, taken anywhere in the game: into their party (the layer is open on it)
  useEffect(() => {
    if (invitedTo && /^[A-Z]{4,8}$/.test(invitedTo) && linkRef.current?.code !== invitedTo) {
      joining.current = true;
      connect(invitedTo);
    }
    // (once, as the Ring opens)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          if (fight.ticket) leaveRanked(fight.ticket, fight.format, started);
          else if (started && !fight.unrated) settle(false, LEAVER_K);
          else clearLive();
          setFight(null);
        }}
        onDone={(r) => {
          if (fight.ticket) return endRanked(r, fight.ticket, fight.format, fight.rival.name, 'solo');
          const was = standingOf(latest.current, fight.format);
          clearLive();
          // (played signed in while the ladder couldn't be reached: kept in the history, and counted for nothing)
          if (fight.unrated) {
            setResult({ r, rating: null, rival: fight.rival.name, kind: 'solo', track: keepMatch(r, fight.format, null, fight.rival.name), why: NOTE_WORDS.offline });
            setFight(null);
            return;
          }
          const rating: RatingOutcome = r.draw ? { before: was.rating, after: was.rating, bestBefore: was.best, bestAfter: was.best, rankUp: null, streak: 0 } : settle(r.won);
          if (rating.rankUp) engine.sound.play('ring-levelup');
          const track = keepMatch(r, fight.format, rating, fight.rival.name);
          setResult({ r, rating, rival: fight.rival.name, kind: 'solo', track });
          setFight(null);
        }}
      />
    );
  }
  if (roomFight) {
    const relay = (d: unknown): void => linkRef.current?.relay(d);
    const rtt = (): number => linkRef.current?.rtt ?? 0;
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
        role={roomFight.host ? { kind: 'host', skill: 0.6, send: relay, listen, rtt } : { kind: 'client', send: relay, listen, rtt }}
        sets={sets}
        stakes={live?.stakes ?? null}
        hints={hints}
        onSets={putSets}
        onSnap={live ? (snap) => writeLive({ ...live, snap, at: Date.now() }) : undefined}
        onLeave={(started) => {
          // (walking out of a match against people: a leaver's loss, and the match ends for the others)
          if (live?.ticket) leaveRanked(live.ticket, live.format, started);
          else if (live && started) settleFor(live.format, live.rivalRating, false, LEAVER_K, live.ourRating);
          else if (live) clearLive();
          // (out of a party's match is out of the party: the others see a player leave, and the room says who)
          if (roomFight.party) leaveRoom();
          else if (roomFight.matched) endSeek();
          else if (roomFight.host) linkRef.current?.send({ t: 'end' });
          setRoomFight(null);
        }}
        onDone={(r) => {
          const after = (): void => {
            if (roomFight.party) {
              // (the party's room goes back to its lobby, the party still in it: a moment after, so that the last
              // word reaches everyone before their match is over)
              seekRef.current?.stop();
              seekRef.current = null;
              const link = linkRef.current;
              if (roomFight.host) window.setTimeout(() => link?.send({ t: 'end' }), 4000);
            } else if (roomFight.matched) endSeek(roomFight.host);
            else if (roomFight.host) linkRef.current?.send({ t: 'end' });
          };
          if (live?.ticket) {
            endRanked(r, live.ticket, live.format, live.rival.name, 'matched', roomFight.party);
            after();
            return;
          }
          let rating: RatingOutcome | null = null;
          if (live) {
            const was = standingOf(latest.current, live.format);
            clearLive();
            rating = r.draw ? { before: was.rating, after: was.rating, bestBefore: was.best, bestAfter: was.best, rankUp: null, streak: 0 } : settleFor(live.format, live.rivalRating, r.won, 1, live.ourRating);
            if (rating.rankUp) engine.sound.play('ring-levelup');
          }
          const track = keepMatch(r, live?.format ?? (Math.max(1, Math.min(3, Math.ceil(roomFight.setup.fighters.length / 2))) as Format), rating, live?.rival.name);
          setResult({ r, rating, rival: live?.rival.name, kind: roomFight.matched ? 'matched' : 'room', track, party: roomFight.party });
          after();
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
        why={result.why}
        againLabel={result.kind === 'room' ? 'Back to the room' : result.kind === 'tutorial' ? 'Find a real match' : result.party && !partyShown?.leader ? 'Back to the party' : 'Fight again'}
        onAgain={() => {
          if (result.kind === 'room') {
            setResult(null);
            setPage('friends');
          } else if (result.party && !partyShown?.leader) {
            // (the party's leader starts its next search: everyone else waits for it, with the fight's layer open)
            setResult(null);
            setPlayOpen(true);
          } else findMatch();
        }}
        onSetup={() => {
          setResult(null);
          // (the main screen is the setup; in a room, the setup opens over it)
          if (result.kind === 'room') {
            setPage('friends');
            setSetupOpen(true);
          } else setPage('play');
        }}
        onExit={() => {
          setResult(null);
          if (result.kind === 'room') leaveRoom();
          setPage('play');
        }}
      />
    );
  }

  const title = page === 'friends' ? 'Custom game' : 'The Ring';
  const sub = page === 'friends' ? 'A private room for friends, on any sides. No rating changes hands here: for ranked as a team, invite friends from the fight’s window.' : `Your class, your playstyle, your talents. ${me ? 'Saved to your account as you go.' : 'Saved on this device. Sign in to keep it on every device.'}`;
  // (the main screen is laid out as the Vigil's lobby and the Rift Trials' are, in their styles (rb-vlobby): the
  // classes, the hero large on a dais, and beside them how the hero fights, the playstyles, the bar and the talents,
  // always in sight; at the foot the fight chosen and one gold button. The owner: "make the ui selection in the ring
  // similar to the vigil and riftstones, currently the character feels way too small on mobile", and 2026-11-17, "i
  // want playstyle to be visible at all times and basically that screen to be the main screen". The room with friends
  // keeps the Ring's own page)
  const lobby = page === 'play';
  const arenaName = MAPS[map]?.name ?? 'Any arena';
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
          {/* (the record at a glance, each part a way into its page: challenges, mastery, the season, history, rewards) */}
          {lobby && <RecordBar record={save.record ?? {}} best={bestRating()} onOpen={setProgressOpen} onRewards={() => setRewardsOpen(true)} />}
          {page !== 'play' && (
            <button className="rb-btn is-small rb-rp-back" onClick={back}>
              {view ? 'Leave room' : 'Back to the ladder'}
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
                  <span className="rb-ringvl-way">
                    {CLASS_WAY[pick]} · <b className={`rb-ease-word is-${CLASS_EASE[pick]}`}>{EASE_WORD[CLASS_EASE[pick]]}</b>
                  </span>
                  {/* (with no title worn, the rank reached in this format is shown before the name: "Unblooded Guitartrick") */}
                  <Titled className="rb-rp-whoname" name={wear ? wear.name : hero} title={myTitle} orRank={rank} />
                  <div className="rb-rp-looks rb-ringvl-looks">
                    <WearPicker engine={engine} cls={pick} onChange={() => setWearN((n) => n + 1)} />
                    <button className="rb-btn is-small" onClick={() => setLooksOpen(true)}>
                      Title & armor
                    </button>
                  </div>
                </div>
              </div>
              {/* how the hero fights: the playstyles, the bar and its combos, the talents, and one box that reads them */}
              <div className="rb-vlobby-kit rb-ringvl-build" data-tut="loadout">
                <SetupEditor key={pick} cls={pick} sets={sets} onSets={putSets} />
                {!ready && <p className="rb-rp-warn">Your bar needs {SLOTS - bar.length} more.</p>}
              </div>
            </section>

            <footer className={`rb-vlobby-foot rb-ringvl-go${partyShown ? ' has-party' : ''}`}>
              {/* the party, in sight on the Ring's own screen (not only in the layer where the fight is chosen) */}
              {partyShown && (
                <div className="rb-ringvl-party" role="group" aria-label="Your party">
                  <span className="rb-ringvl-party-title">
                    Party <b>{partyShown.code}</b>
                  </span>
                  <span className="rb-ringvl-party-who">
                    {partyShown.connecting ? (
                      <em>Connecting…</em>
                    ) : (
                      partyShown.members.map((m) => (
                        <span key={m.n} className={`rb-ringvl-party-member${m.online ? '' : ' is-away'}`}>
                          {m.you ? 'You' : m.name}
                          {m.cls && <small> {CLASSES[m.cls].name}</small>}
                          {!m.you && m.n === view?.host && <small> · leader</small>}
                        </span>
                      ))
                    )}
                    {!partyShown.connecting && partyShown.members.length < 2 && <em>Waiting for your friend to join…</em>}
                  </span>
                  {partyShown.leader && (
                    <button className="rb-linkbtn" onClick={() => setInviteOpen(true)}>
                      Invite
                    </button>
                  )}
                  <button className="rb-linkbtn" onClick={leaveRoom}>
                    Leave
                  </button>
                </div>
              )}
              {/* the fight chosen, always in sight; pressed, the layer where it is chosen (PlayLayer) */}
              <button className="rb-ringvl-mode" onClick={() => setPlayOpen(true)} data-tut="fight" aria-haspopup="dialog" aria-label={`${ladder === 'guest' ? 'Practice' : 'Ranked'} ${fightFormat}v${fightFormat}, rating ${standing.rating}, ${rank.name}, ${arenaName}. Change the fight`}>
                <b>
                  {fightFormat}v{fightFormat}
                </b>
                <span>
                  <em>{standing.rating}</em> {rank.name}
                </span>
                <small>{partyShown ? `Party of ${Math.max(1, partyShown.members.length)} · ${arenaName}` : fightFormat > 1 ? `${matesWord(save.mates?.[fightFormat], fightFormat)} · ${arenaName}` : arenaName}</small>
                <i aria-hidden="true">Change</i>
              </button>
              <button className={`rb-btn is-gold is-big${barred || follower ? ' is-barred' : ''}`} onClick={() => (follower ? setPlayOpen(true) : findMatch())} aria-disabled={barred || undefined} data-tut="go">
                {!ready ? `Choose ${SLOTS - bar.length} more abilities` : barred ? 'No healers in 1v1' : follower ? 'Waiting for the party leader' : `Find a ${ladder === 'guest' ? '' : 'ranked '}${fightFormat}v${fightFormat} match`}
              </button>
            </footer>
            {(barred || seekNote) && !playOpen && (
              <p className="rb-rp-error rb-ringvl-note" role="status">
                {barred ? BARRED_WHY : seekNote}
              </p>
            )}
          </>
        )}

        {page === 'friends' && <FriendsPage view={view} state={linkState} err={roomErr} ready={ready} codeIn={codeIn} setCodeIn={setCodeIn} onOpen={() => void openRoom()} onJoin={joinRoom} send={(a) => linkRef.current?.send(a)} myPick={myPick} pick={pick} onPick={choose} onSetup={() => setSetupOpen(true)} bar={bar} mates={roomMates} onRead={setReading} />}

        {playOpen && page === 'play' && (
          <PlayLayer
            format={fightFormat}
            onFormat={chooseFormat}
            standing={(f) => (user ? rankedStanding(rkMine, f) : standingOf(save, f))}
            ladder={ladder}
            season={seasonNow}
            pick={pick}
            bar={bar}
            mates={mates}
            onMates={putMates}
            map={map}
            onMap={setMap}
            note={barred ? BARRED_WHY : seekNote}
            ready={ready}
            barred={barred}
            party={partyShown}
            onInvite={() => setInviteOpen(true)}
            onLeaveParty={leaveRoom}
            onFind={findMatch}
            onCustom={() => {
              // (a custom game is a room of its own: out of the party first)
              if (roomMode === 'party') leaveRoom();
              setPlayOpen(false);
              setPage('friends');
            }}
            onTutorial={beginTutorial}
            onClose={() => setPlayOpen(false)}
          />
        )}
        {inviteOpen && page === 'play' && <InviteDialog engine={engine} format={fightFormat} code={partyShown?.code || null} asked={asked} onInvite={(id) => void inviteFriend(id)} onJoin={joinParty} onClose={() => setInviteOpen(false)} />}
        {/* (a friend's invitation to team up here is answered here, where the player is looking) */}
        {page === 'play' && !look && <InviteCards engine={engine} only="sigilfall-ring" onTake={takeInvite} hide={(inv) => inv.code?.toUpperCase() === partyShown?.code || !!memberNames?.includes(inv.from)} />}
        {setupOpen && (
          <div className="rb-ring-dialog-wrap rb-ringvl-setupwrap" role="dialog" aria-modal="true" aria-label="Your setup" onClick={() => setSetupOpen(false)}>
            <div className="rb-ring-dialog rb-ringvl-setupdialog" onClick={(e) => e.stopPropagation()}>
              <h2>{CLASSES[pick].name}: your setup</h2>
              <SetupEditor key={pick} cls={pick} sets={sets} onSets={putSets} />
              <button className="rb-btn is-gold" onClick={() => setSetupOpen(false)} autoFocus>
                Done
              </button>
            </div>
          </div>
        )}

        {look && <Seeking look={look} format={fightFormat} cls={pick} member={follower} onCancel={() => (follower ? leaveRoom() : endSeek())} />}
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
            nextLabel={tut < LOBBY_STEPS.length - 1 ? 'Next' : 'Start the practice fight'}
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
        {progressOpen && <ProgressDialog record={save.record ?? {}} tab={progressOpen} onClose={() => setProgressOpen(false)} />}
        {looksOpen && <LooksDialog engine={engine} cls={pick} wear={wear} plain={save.plain} doll={doll} shown={<Titled name={wear ? wear.name : hero} title={myTitle} />} onPlain={(p) => commit((now) => ({ ...now, plain: p }))} onChange={() => setWearN((n) => n + 1)} onClose={() => setLooksOpen(false)} frames={framesOwned(save.record ?? {})} frame={myFrame} onFrame={(id) => commit((now) => ({ ...now, frame: id ?? undefined }))} />}
      </div>
    </ScreenGate>
  );
}

const listed = (names: string[]): string => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`);

/** A party's seats in its room: while it is in the queue, those it went in with; before, everyone on the player's side. */
function partySeats(v: RoomView): RoomView['seats'] {
  const mine = v.seats.find((x) => x.you)?.pick?.team ?? 0;
  return v.seats.filter((x) => x.pick && (v.queued !== null ? v.party.includes(x.n) : x.pick.team === mine));
}

/** The waiting screen of a search: who has turned up, how long is left, and a way out. */
function Seeking({ look, format, cls, member, onCancel }: { look: SeekLook; format: Format; cls: ClassId; member?: boolean; onCancel: () => void }) {
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
            {member ? 'Leave the party' : 'Cancel'}
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
