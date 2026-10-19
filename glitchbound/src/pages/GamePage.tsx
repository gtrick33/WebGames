import { lazy, Suspense, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { tGame, useT } from '../i18n';
import { relatedGames } from '../catalog/catalog';
import { CATEGORIES, type GameEntry } from '../catalog/types';
import { AdSlot } from '../components/AdSlot';
import { Burst } from '../components/Burst';
import { DailyCard } from '../components/DailyCard';
import { GameStage } from '../components/GameStage';
import { GameTile } from '../components/GameTile';
import { Icon } from '../components/Icon';
import { reportError, track } from '../platform/analytics';
import { account, api, ApiError, useAccount } from '../platform/account';
import { useLiveCatalog } from '../platform/liveCatalog';
import { SCORES_EVENT } from '../platform/challenge';
import { challengeSpecOf, useChallengeRun } from '../platform/useChallengeRun';
import { ChallengeFriends, inviteToChallenge, startChallenge } from '../components/ChallengeFriends';

// The challenge dock and scoreboard load only on challenge links (/games/<slug>?challenge=<id>).
const ChallengeDock = lazy(fresh(() => import('../components/Challenge').then((m) => ({ default: m.ChallengeDock }))));
const ChallengeScores = lazy(fresh(() => import('../components/Challenge').then((m) => ({ default: m.ChallengeScores }))));
import type { RunEndResult } from '../platform/apiTypes';
import { FavoriteButton } from '../components/FavoriteButton';
// The leaderboard tab loads its data from the network anyway, so its code comes with it (its styles stay
// in the main sheet: admin tables share them).
import '../components/Leaderboard.css';
const MiniLeaderboard = lazy(fresh(() => import('../components/Leaderboard').then((m) => ({ default: m.MiniLeaderboard }))));
import { openSignIn } from '../components/openSignIn';
import { setGuestName, usePlayerName } from '../platform/playerName';
import { music } from '../platform/music';
import { openFeedback } from '../platform/feedback';
import type { EndEvent, GameEvent } from '../platform/contract';
import { challengeForDay, fmt } from '../platform/daily';
import { dayKey } from '../platform/dates';
import { SITE_URL } from '../platform/env';
import { usePageMeta } from '../platform/meta';
import type { GameRecord, RoundResult } from '../platform/save';
import { saveStore, useSave } from '../platform/store';
import { parseBeatParam, shareOrCopy } from '../platform/share';
import { GAMES } from '../catalog/games';
import { Link, navigate, useLocation } from '../router/router';
import './GamePage.css';
import { fresh } from '../platform/freshBuild';

interface LastRound {
  event: EndEvent;
  result: RoundResult;
  n: number;
  /** Server result for signed-in players (rank, verified new best). */
  server?: RunEndResult | null;
}

/** Stops pinch/double-tap zoom while a game fills the screen (restored afterwards). */
function lockZoom(on: boolean): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const base = 'width=device-width, initial-scale=1, viewport-fit=cover';
  meta.setAttribute('content', on ? `${base}, maximum-scale=1, user-scalable=no` : base);
}

/**
 * Real fullscreen where the browser allows it on an element; otherwise (iPhone Safari) an
 * "immersive" mode that pins the stage over the whole screen. Either way the page stops scrolling
 * and zooming while playing.
 */
function usePlayMode(ref: RefObject<HTMLElement | null>, onLeave?: () => void): { active: boolean; enter: () => void; exit: () => void } {
  const [mode, setMode] = useState<'none' | 'fullscreen' | 'immersive'>('none');
  const modeRef = useRef(mode);
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  });

  const apply = useCallback(
    (next: 'none' | 'fullscreen' | 'immersive') => {
      if (next === 'none' && modeRef.current !== 'none') onLeaveRef.current?.();
      modeRef.current = next;
      const el = ref.current;
      el?.classList.toggle('stage-immersive', next === 'immersive');
      document.documentElement.classList.toggle('game-focus', next !== 'none');
      lockZoom(next !== 'none');
      setMode(next);
    },
    [ref],
  );

  useEffect(() => {
    const onChange = (): void => {
      if (document.fullscreenElement === ref.current && ref.current) apply('fullscreen');
      else if (!document.fullscreenElement) apply('none');
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.documentElement.classList.remove('game-focus');
      lockZoom(false);
    };
  }, [ref, apply]);

  const enter = (): void => {
    const el = ref.current;
    if (!el) return;
    // Must run inside the click handler: browsers only allow fullscreen from a user gesture.
    if (document.fullscreenEnabled && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(() => apply('immersive'));
    } else {
      apply('immersive');
    }
  };
  const exit = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    apply('none');
  };

  useEffect(() => {
    if (mode !== 'immersive') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') apply('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, apply]);

  return { active: mode !== 'none', enter, exit };
}

/**
 * Full-screen controls as a small tab on the left edge, where game HUDs rarely sit: tap to open
 * Exit full screen / Exit game; it folds away again after a few seconds.
 */
function StageMenu({ slug, onExitFullscreen, onExitGame }: { slug: string; onExitFullscreen: () => void; onExitGame: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setOpen(false), 4000);
    return () => window.clearTimeout(id);
  }, [open]);
  return (
    <div className={`stage-menu${open ? ' is-open' : ''}`}>
      <button className="stage-menu-tab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('Game menu')}>
        <Icon name="menu" size={16} />
      </button>
      {open && (
        <div className="stage-menu-items">
          <button className="stage-exit" onClick={onExitFullscreen}>
            <Icon name="shrink" size={16} /> {t('Exit full screen')}
          </button>
          <button className="stage-exit" onClick={onExitGame}>
            <Icon name="close" size={16} /> {t('Exit game')}
          </button>
          <button
            className="stage-exit"
            onClick={() => {
              onExitFullscreen();
              navigate(`/me/bugs?game=${slug}`);
            }}
          >
            <Icon name="bug" size={16} /> {t('Report a bug')}
          </button>
        </div>
      )}
    </div>
  );
}

export function GamePage({ game }: { game: GameEntry }) {
  const t = useT();
  const { search } = useLocation();
  const beat = parseBeatParam(search);
  const challengeId = game.challenge ? new URLSearchParams(search).get('challenge') : null;
  const save = useSave();
  const record = save.games[game.slug];
  const stageRef = useRef<HTMLDivElement>(null);
  // Leaving full screen (Escape, the browser's own exit, or the menu) pauses the game and its music.
  const [pauseSignal, setPauseSignal] = useState(0);
  const play = usePlayMode(stageRef, () => setPauseSignal((n) => n + 1));
  const frameRef = useRef<HTMLIFrameElement>(null);
  const player = usePlayerName();
  const chal = useChallengeRun(challengeId, game, player.name);
  const finishChallenge = useRef(chal.finish);
  useEffect(() => {
    finishChallenge.current = chal.finish;
  });
  // The challenge scoreboard on the stage: opens by itself when your score is in, or from the dock.
  const [scoresOpen, setScoresOpen] = useState(false);
  // The games' own "See the scoreboard" buttons open it too.
  useEffect(() => {
    const open = (): void => setScoresOpen(true);
    window.addEventListener(SCORES_EVENT, open);
    return () => window.removeEventListener(SCORES_EVENT, open);
  }, []);
  const chalStatus = chal.state.status;
  const [lastStatus, setLastStatus] = useState(chalStatus);
  if (lastStatus !== chalStatus) {
    setLastStatus(chalStatus);
    if (chalStatus === 'sent' || chalStatus === 'closed' || chalStatus === 'gone') setScoresOpen(true);
    if (chalStatus === 'ready') setScoresOpen(false);
  }
  const [renaming, setRenaming] = useState(false);
  const [renameMsg, setRenameMsg] = useState('');
  // Remounting the stage resets the game: autoStart restarts it, otherwise it closes back to the poster.
  const [stageRun, setStageRun] = useState({ key: 0, autoStart: false });
  const [playing, setPlaying] = useState(false);
  const [last, setLast] = useState<LastRound | null>(null);
  const [burst, setBurst] = useState(0);
  // The round the stage plays. Before Play it follows the challenge; a running game keeps its round
  // (a rematch shows "Play round N" in the dock instead of yanking the game away).
  const liveSpec = challengeSpecOf(chal.state);
  const [stageSpec, setStageSpec] = useState(liveSpec);
  if (stageSpec !== liveSpec && liveSpec && (!playing || !stageSpec)) {
    setStageSpec(liveSpec);
    // Play was pressed before the challenge loaded: restart the game straight in the challenge round.
    if (playing) setStageRun((r) => ({ key: r.key + 1, autoStart: true }));
  }
  const stageSpecRef = useRef(stageSpec);
  useEffect(() => {
    stageSpecRef.current = stageSpec;
  }, [stageSpec]);
  const playRound = (): void => {
    setStageSpec(liveSpec);
    setScoresOpen(false);
    setStageRun((r) => ({ key: r.key + 1, autoStart: true }));
  };

  const [shareMsg, setShareMsg] = useState('');
  const live = useLiveCatalog();
  const related = relatedGames(game, 4, live.games);
  const isDailyGame = challengeForDay(dayKey(), GAMES)?.game.slug === game.slug;
  const { me } = useAccount();
  const settings = live.settings(game.slug);
  // An admin paused the game: players see the message instead of the stage (admins and QA can still test it).
  const paused = !!settings.maintenance && !me?.role;
  const runRef = useRef<Promise<string | null> | null>(null);
  const [boardKey, setBoardKey] = useState(0);

  usePageMeta({ title: `Play ${game.title}`, description: `${game.tagline} Free to play in your browser on GlitchBound.`, path: `/games/${game.slug}`, image: `/games/${game.slug}/og.jpg` });

  useEffect(() => {
    track('game_view', { game: game.slug });
  }, [game.slug]);

  // The lobby music steps aside while a game is loaded on this page.
  useEffect(() => {
    music.setGameActive(playing);
    return () => music.setGameActive(false);
  }, [playing]);

  const onEvent = useCallback(
    (e: GameEvent) => {
      const signedIn = !!account.state.me;
      if (e.type === 'ready') {
        // Coins from GlitchBound (QA or an admin) for an embedded game's wallet: handed over once it listens.
        if (signedIn && game.wallet) void import('../platform/coins').then((m) => m.handOver(game, frameRef.current));
        return;
      }
      if (e.type === 'start') {
        track('game_start', { game: game.slug });
        // Members: the server timestamps the start so the finished score can be checked.
        runRef.current = signedIn
          ? api<{ runId: string }>('/api/runs/start', { body: { game: game.slug } })
              .then((r) => r.runId)
              .catch(() => null)
          : null;
        return;
      }
      // A friends' challenge round: send the score to the challenge too. Embedded games (NEON RUSH)
      // only know the seed, so the page names the round for them.
      const round = stageSpecRef.current;
      const ended = !e.challenge && round && game.runtime.kind === 'embed' ? { ...e, challenge: { id: round.id, round: round.round } } : e;
      if (ended.challenge) finishChallenge.current(ended);
      const result = saveStore.record(game, e);
      let n = 0;
      setLast((prev) => {
        n = (prev?.n ?? 0) + 1;
        return { event: e, result, n, server: signedIn ? undefined : null };
      });
      const pending = runRef.current;
      runRef.current = null;
      if (pending) {
        void pending.then(async (runId) => {
          if (!runId) return;
          try {
            const server = await api<RunEndResult>('/api/runs/end', { body: { runId, score: e.score, stats: e.stats ?? {}, day: dayKey() } });
            account.setQuests(server.quests);
            setLast((prev) => (prev && prev.n === n ? { ...prev, server } : prev));
            setBoardKey((k) => k + 1);
            if (server.newBest) setBurst((b) => b + 1);
          } catch (err) {
            // A round the server refuses (too short, implausible score) comes back as a 422 with the reason.
            const server = err instanceof ApiError && err.status === 422 ? ({ ok: false, error: err.code } as RunEndResult) : null;
            setLast((prev) => (prev && prev.n === n ? { ...prev, server } : prev));
          }
        });
      }
      track('game_end', { game: game.slug, score: e.score });
      if (result.dailyCompleted) track('daily_complete', { game: game.slug, day: dayKey() });
      if (result.gameDailyCompleted) track('daily_complete', { game: game.slug, day: dayKey(), kind: 'game' });
      if (result.dailyCompleted || result.gameDailyCompleted || result.newBests.includes('score') || (beat !== null && e.score > beat)) setBurst((b) => b + 1);
    },
    [game, beat],
  );

  const restart = (): void => {
    track('replay_click', { game: game.slug, where: 'toolbar' });
    setStageRun((r) => ({ key: r.key + 1, autoStart: true }));
  };

  /** Closes the game and unloads everything it loaded (iframe or module chunk state, canvases, sounds). */
  const close = (): void => {
    track('game_close', { game: game.slug });
    play.exit();
    setPlaying(false);
    setStageRun((r) => ({ key: r.key + 1, autoStart: false }));
  };

  const share = async (kind: 'game' | 'score' | 'challenge'): Promise<void> => {
    track('share_click', { game: game.slug, what: kind });
    const score = last?.event.score ?? 0;
    const url = kind === 'challenge' ? `${SITE_URL}/games/${game.slug}?beat=${score}` : `${SITE_URL}/games/${game.slug}`;
    const text =
      kind === 'game'
        ? `${game.title}: ${tGame(game.tagline)}`
        : kind === 'score'
          ? t('I scored {score} in {game} on GlitchBound.', { score: fmt(score), game: game.title })
          : t('I scored {score} in {game}. Can you beat it?', { score: fmt(score), game: game.title });
    const outcome = await shareOrCopy({ title: game.title, text, url });
    flashShare(outcome === 'copied' ? t('Link copied to your clipboard.') : outcome === 'shared' ? t('Shared!') : outcome === 'failed' ? t('Could not share from this browser.') : '');
  };
  const flashShare = (msg: string): void => {
    setShareMsg(msg);
    window.setTimeout(() => setShareMsg(''), 4000);
  };

  /**
   * After a round: a real friends' challenge (a fresh round for everyone, played right here) and its
   * invite sheet. In an open challenge it invites to that one; games without challenges keep the
   * old ?beat=<score> link.
   */
  const [challenging, setChallenging] = useState(false);
  const challengeFriend = async (): Promise<void> => {
    if (!game.challenge) return share('challenge');
    const view = 'view' in chal.state ? chal.state.view : undefined;
    if (challengeId && view && !view.closed) {
      track('share_click', { game: game.slug, what: 'challenge_invite' });
      return inviteToChallenge(game, view, t);
    }
    track('share_click', { game: game.slug, what: 'challenge_new' });
    setChallenging(true);
    const err = await startChallenge(game, 'fresh', player.name, t);
    setChallenging(false);
    if (err) flashShare(err);
  };

  return (
    <div className="game-page" data-accent={game.accent}>
      <div className="wrap game-toolbar">
        <Link href="/#arcade" className="btn btn-sm btn-ghost back-link" aria-label={t('Back to the arcade')}>
          <Icon name="arrowLeft" size={18} /> <span className="hide-sm">{t('Arcade')}</span>
        </Link>
        <div className="game-heading">
          <h1>{game.title}</h1>
          <span className="chip">{t(CATEGORIES[game.categories[0]].label)}</span>
        </div>
        <div className="game-actions">
          <FavoriteButton slug={game.slug} title={game.title} />
          {playing && (
            <button className="btn btn-sm" onClick={restart} title={t('Reload the game')}>
              <Icon name="restart" size={18} /> <span className="hide-sm">{t('Restart')}</span>
            </button>
          )}
          {playing && (
            <button className="btn btn-sm btn-icon" onClick={play.enter} aria-label={t('Fullscreen')} title={t('Fullscreen')}>
              <Icon name="expand" size={18} />
            </button>
          )}
          {playing && (
            <button className="btn btn-sm" onClick={close} title={t('Close the game and free its memory')}>
              <Icon name="close" size={18} /> <span className="hide-sm">{t('Exit game')}</span>
            </button>
          )}
          <button className="btn btn-sm btn-icon" onClick={() => void share('game')} aria-label={t('Share {game}', { game: game.title })} title={t('Share')}>
            <Icon name="share" size={18} />
          </button>
        </div>
      </div>

      <div className="wrap game-layout">
        <div className="game-stage-col">
          {me?.role && (settings.hidden || settings.maintenance) && (
            <p className="admin-preview" role="note">
              <Icon name="crown" size={16} /> Preview: {settings.hidden ? 'this game is hidden from players.' : `players see "${settings.maintenance}" instead of the game.`}{' '}
              {me.isAdmin && <Link href="/admin?tab=games">Edit in Admin</Link>}
            </p>
          )}
          {challengeId && (
            <Suspense fallback={null}>
              <ChallengeDock run={chal} game={game} stageRound={playing ? (stageSpec?.round ?? null) : null} onPlayRound={playRound} onScores={() => setScoresOpen((o) => !o)} scoresOpen={scoresOpen} />
            </Suspense>
          )}
          {paused ? (
            <div className="stage stage-paused" style={{ background: game.art.bg }}>
              <img src={game.art.tile} alt="" className="stage-poster-art" />
              <div className="stage-paused-msg">
                <strong>{t('Taking a short break')}</strong>
                <span>{settings.maintenance}</span>
                <Link href="/" className="btn btn-primary">
                  {t('Play something else')}
                </Link>
              </div>
            </div>
          ) : (
          <GameStage
            key={stageRun.key}
            autoStart={stageRun.autoStart}
            pauseSignal={pauseSignal}
            game={game}
            challenge={stageSpec}
            onEvent={onEvent}
            stageRef={stageRef}
            frameRef={frameRef}
            playerName={player.name}
            onPlayClick={play.enter}
            overlay={
              <>
                {challengeId && scoresOpen && (
                  <Suspense fallback={null}>
                    <ChallengeScores run={chal} game={game} onClose={() => setScoresOpen(false)} />
                  </Suspense>
                )}
                {play.active && <StageMenu slug={game.slug} onExitFullscreen={play.exit} onExitGame={close} />}
              </>
            }
            onPhase={(p) => {
              setPlaying(p === 'loading' || p === 'ready');
              if (p === 'error') {
                track('game_error', { game: game.slug });
                reportError('game_load_failed', `${game.title} did not load`, game.slug);
              }
            }}
          />
          )}
          {burst > 0 && <Burst key={burst} />}
        </div>

        <aside className="game-side" aria-label={t('{game} details', { game: game.title })}>
          <p className="game-share-msg" role="status">
            {shareMsg}
          </p>

          {beat !== null && (
            <div className={`panel friend ${last && last.event.score > beat ? 'is-beaten' : ''}`}>
              <p className="eyebrow">{t('Friend challenge')}</p>
              {last && last.event.score > beat ? (
                <p className="friend-text">{t('You beat {a} with {b}. Send it back!', { a: fmt(beat), b: fmt(last.event.score) })}</p>
              ) : (
                <p className="friend-text">{t('A friend scored {n}. Beat it.', { n: fmt(beat) })}</p>
              )}
            </div>
          )}

          {last && (
            <div key={last.n} className="panel last-round">
              <p className="eyebrow">{t('Last round')}</p>
              <p className="last-score">
                {fmt(last.event.score)} <span>{t('points')}</span>
              </p>
              <ul className="last-tags">
                {last.server?.rank && (
                  <li className="sticker" data-tone="cyan">
                    {t('Rank #{n}', { n: last.server.rank })}
                  </li>
                )}
                {last.result.newBests.includes('score') && <li className="sticker" data-tone="lime">{t('New best')}</li>}
                {last.result.firstPlay && <li className="sticker">{t('First record')}</li>}
                {last.result.dailyCompleted && <li className="sticker" data-tone="orange">{t('Daily cleared')}</li>}
                {last.result.gameDailyCompleted && <li className="sticker" data-tone="orange">{t('{label} done', { label: t(game.ownDaily?.label ?? 'Daily') })}</li>}
              </ul>
              {!me && (
                <button className="last-signin" onClick={() => openSignIn(t('Sign in to put your scores on the leaderboard.'))}>
                  <Icon name="crown" size={16} /> {t('Sign in to put scores like this on the leaderboard')}
                </button>
              )}
              {me && last.server === undefined && <p className="mono last-saving">{t('Saving to the leaderboard…')}</p>}
              {me && last.server && !last.server.ok && <p className="mono last-saving">{t('This round was not ranked ({reason}).', { reason: t(last.server.error === 'too_fast' ? 'too short to count' : 'score too high for the time played') })}</p>}
              <div className="last-actions">
                <button className="btn btn-primary btn-sm" onClick={() => void challengeFriend()} disabled={challenging}>
                  <Icon name={game.challenge ? 'bolt' : 'link'} size={18} /> {t('Challenge a friend')}
                </button>
                <button className="btn btn-sm" onClick={() => void share('score')}>
                  <Icon name="share" size={18} /> {t('Share score')}
                </button>
              </div>
            </div>
          )}

          {game.challenge && !challengeId && <ChallengeFriends game={game} />}

          {isDailyGame && <DailyCard variant="compact" headingLevel={2} />}

          <GameInfo game={game} record={record} boardKey={boardKey} />

          <div className="player-line">
            <span className="mono">{t('Playing as')}</span>
            {renaming && !player.member ? (
              <form
                className="rename-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const err = setGuestName(String(new FormData(e.currentTarget).get('name') ?? ''));
                  setRenameMsg(err ?? '');
                  if (!err) setRenaming(false);
                }}
              >
                <input className="field" name="name" defaultValue={player.name} maxLength={14} aria-label={t('Player name')} autoFocus />
                <button className="btn btn-primary btn-sm">{t('Save')}</button>
              </form>
            ) : (
              <>
                <strong>{player.name}</strong>
                {player.member ? (
                  <Link href="/me" className="link-btn">
                    {t('Change')}
                  </Link>
                ) : (
                  <button className="link-btn" onClick={() => setRenaming(true)}>
                    {t('Change')}
                  </button>
                )}
                {!player.member && (
                  <button className="link-btn player-keep" onClick={() => openSignIn(t('Sign in to keep your name and scores on every device.'))}>
                    {t('Sign in to keep it on every device.')}
                  </button>
                )}
              </>
            )}
            {renameMsg && <p className="side-muted">{renameMsg}</p>}
          </div>

          <div className="game-help">
            <button className="game-help-btn" onClick={() => openFeedback(game.slug)}>
              <Icon name="star" size={16} /> {t('Rate this game')}
            </button>
            <Link href={`/me/bugs?game=${game.slug}`} className="game-help-btn">
              <Icon name="bug" size={16} /> {t('Report a bug')}
            </Link>
          </div>

          <AdSlot placement="game" />
        </aside>
      </div>

      <section className="wrap game-about" aria-labelledby="about-title">
        <div className="game-about-copy">
          <p className="eyebrow">{t('About the game')}</p>
          <h2 id="about-title">{game.title}</h2>
          <p>{tGame(game.description)}</p>
        </div>
        {game.highlights && (
          <ul className="latest-list game-highlights">
            {game.highlights.map((h) => (
              <li key={h}>{tGame(h)}</li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className="wrap section" aria-labelledby="related-title">
          <div className="section-head">
            <h2 id="related-title">{t('Play next')}</h2>
          </div>
          <div className="related-grid">
            {related.map((g, i) => (
              <GameTile key={g.slug} game={g} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type InfoTab = 'how' | 'board' | 'bests';

/**
 * How to play, the leaderboard and your bests share one panel with tabs, so the column next to the
 * game stays short: newcomers start on How to play, returning players on the leaderboard.
 */
function GameInfo({ game, record, boardKey }: { game: GameEntry; record: GameRecord | undefined; boardKey: number }) {
  const t = useT();
  const [tab, setTab] = useState<InfoTab>(record ? 'board' : 'how');
  const tabs: { id: InfoTab; icon: 'keyboard' | 'crown' | 'trophy'; label: string }[] = [
    { id: 'how', icon: 'keyboard', label: t('How to play') },
    { id: 'board', icon: 'crown', label: t('Leaderboard') },
    { id: 'bests', icon: 'trophy', label: t('Your bests') },
  ];
  return (
    <section className="panel side-block game-info" aria-labelledby={`gi-${tab}`}>
      <div className="gi-tabs" role="tablist" aria-label={t('{game} details', { game: game.title })}>
        {tabs.map((x) => (
          <button key={x.id} id={`gi-${x.id}`} role="tab" aria-selected={tab === x.id} aria-controls="gi-panel" className={`gi-tab${tab === x.id ? ' is-on' : ''}`} onClick={() => setTab(x.id)}>
            <Icon name={x.icon} size={16} /> {x.label}
          </button>
        ))}
      </div>
      <div key={tab} id="gi-panel" role="tabpanel" className="gi-panel">
        {tab === 'how' && (
          <>
            <h2 className="sr-only">{t('How to play')}</h2>
            {game.controls.keyboard && (
              <div className="controls">
                <p className="controls-head">
                  <Icon name="keyboard" /> {t('Keyboard')}
                </p>
                <ul>
                  {game.controls.keyboard.map((c) => (
                    <li key={c}>{tGame(c)}</li>
                  ))}
                </ul>
              </div>
            )}
            {game.controls.touch && (
              <div className="controls">
                <p className="controls-head">
                  <Icon name="touch" /> {t('Touch')}
                </p>
                <ul>
                  {game.controls.touch.map((c) => (
                    <li key={c}>{tGame(c)}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {tab === 'board' && (
          <Suspense fallback={<p className="side-muted">{t('Loading…')}</p>}>
            <MiniLeaderboard game={game} refreshKey={boardKey} embedded />
          </Suspense>
        )}
        {tab === 'bests' &&
          (record ? (
            <dl className="bests">
              {game.stats.map((st) => (
                <div key={st.key}>
                  <dt>{t(st.label)}</dt>
                  <dd className="mono">
                    {record.best[st.key] !== undefined ? fmt(record.best[st.key]!) : '–'}
                    {st.unit && record.best[st.key] !== undefined ? ` ${st.unit}` : ''}
                  </dd>
                </div>
              ))}
              <div>
                <dt>{t('Rounds played here')}</dt>
                <dd className="mono">{fmt(record.plays)}</dd>
              </div>
            </dl>
          ) : (
            <p className="side-muted">{t('Finish a round to set your first record. Bests are saved on this device only.')}</p>
          ))}
      </div>
    </section>
  );
}
