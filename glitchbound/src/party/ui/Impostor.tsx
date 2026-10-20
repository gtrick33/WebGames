import { IMPOSTOR_THEMES } from '../content/impostor';
import { freshRng } from '../engine';
import { dealImpostor, scoreImpostor, themeById, type ImpostorDeal, type ImpostorOutcome } from '../impostor';
import type { PartySession } from '../session';
import type { Player } from '../types';
import { Avatar, byId, ModeBar, PassPhone, Timer, tNodes } from './shared';
import { t } from '../../i18n';

/** Impostor on one phone: the settings and where the round is (kept in the session, so a refresh resumes). */
export interface ImpostorLocal {
  settings: { themes: string[]; impostors: 1 | 2; hint: boolean; talk: number };
  deal: ImpostorDeal | null;
  stage: 'setup' | 'pass' | 'card' | 'talk' | 'vote' | 'guess' | 'result';
  /** Whose card is next (index into the players). */
  turn: number;
  voted: string | null;
  guess: string | null;
  outcome: ImpostorOutcome | null;
  gained: Record<string, number>;
  round: number;
}

export const newImpostor = (): ImpostorLocal => ({ settings: { themes: [], impostors: 1, hint: true, talk: 0 }, deal: null, stage: 'setup', turn: 0, voted: null, guess: null, outcome: null, gained: {}, round: 0 });

const TALK = [
  [0, 'No timer'],
  [120, '2 min'],
  [180, '3 min'],
  [300, '5 min'],
] as const;

/** Pass-the-phone Impostor: everyone peeks at their card in turn, talks, votes, and the impostor gets one guess. */
export function ImpostorMode({ session, update, onExit, onRoom }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void; onRoom: () => void }) {
  const st = session.active?.mode === 'impostor' ? (session.active.state as ImpostorLocal) : newImpostor();
  const players = session.players;
  const set = (patch: Partial<ImpostorLocal>): void => update((s) => ({ ...s, active: { mode: 'impostor', state: { ...st, ...patch } } }));
  const ids = players.map((p) => p.id);
  const d = st.deal;
  const themeName = d ? (themeById(d.theme)?.name ?? '') : '';

  const start = (): void => {
    const dealt = dealImpostor(ids, st.settings.themes, session.used.impostor ?? [], freshRng(), st.settings.impostors);
    update((s) => ({ ...s, used: { ...s.used, impostor: dealt.used.slice(-400) }, active: { mode: 'impostor', state: { ...st, deal: dealt.deal, stage: 'pass', turn: 0, voted: null, guess: null, outcome: null, gained: {}, round: st.round + 1 } } }));
  };

  const finish = (voted: string | null, guess: string | null): void => {
    if (!d) return;
    const { outcome, points } = scoreImpostor(d, ids, voted, guess);
    update((s) => {
      const scores = { ...s.scores };
      for (const [id, n] of Object.entries(points)) scores[id] = (scores[id] ?? 0) + n;
      return { ...s, scores, active: { mode: 'impostor', state: { ...st, voted, guess, outcome, gained: points, stage: 'result' } } };
    });
  };

  const bar = <ModeBar title={t('Impostor')} progress={st.round ? `Round ${st.round}` : undefined} onExit={onExit} />;

  if (st.stage === 'setup' || !d) {
    const s = st.settings;
    const setS = (patch: Partial<ImpostorLocal['settings']>): void => set({ settings: { ...s, ...patch } });
    const all = s.themes.length === 0;
    return (
      <div className="pt-screen">
        {bar}
        <section className="pt-panel pt-imp-intro">
          <p className="pt-imp-badge">🕵️</p>
          <h2>{t('Find the impostor')}</h2>
          <p className="pt-muted">{t('Everyone gets the secret word, except the impostor, who only gets a hint. Go round saying one word about it. Too obvious and the impostor catches on; too vague and you look guilty. Then vote.')}</p>
          <button className="pt-link" onClick={onRoom}>
            {t('🌐 Rather play on everyone’s own phone? Open a room')}
          </button>
        </section>
        <section className="pt-panel">
          <h3>{t('Themes')}</h3>
          <div className="pt-picker">
            <button className={`pt-chip${all ? ' is-on' : ''}`} aria-pressed={all} onClick={() => setS({ themes: [] })}>
              {t('🎲 Mix them all')}
            </button>
            {IMPOSTOR_THEMES.map((t) => {
              const on = s.themes.includes(t.id);
              return (
                <button key={t.id} className={`pt-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setS({ themes: on ? s.themes.filter((x) => x !== t.id) : [...s.themes, t.id] })}>
                  {t.emoji} {t.name}
                </button>
              );
            })}
          </div>
          <p className="pt-label">{t('Impostors')}</p>
          <div className="pt-seg" role="radiogroup">
            <button role="radio" aria-checked={s.impostors === 1 || players.length < 7} onClick={() => setS({ impostors: 1 })}>
              {t('One')}
            </button>
            <button role="radio" aria-checked={s.impostors === 2 && players.length >= 7} onClick={() => setS({ impostors: 2 })} disabled={players.length < 7}>
              {t('Two')}{' '}<small>{t('7+ players')}</small>
            </button>
          </div>
          <p className="pt-label">{t('The impostor gets')}</p>
          <div className="pt-seg" role="radiogroup">
            <button role="radio" aria-checked={s.hint} onClick={() => setS({ hint: true })}>
              {t('A hint word')}
            </button>
            <button role="radio" aria-checked={!s.hint} onClick={() => setS({ hint: false })}>
              {t('Only the theme')}{' '}<small>{t('harder')}</small>
            </button>
          </div>
          <p className="pt-label">{t('Talking time')}</p>
          <div className="pt-seg" role="radiogroup">
            {TALK.map(([secs, label]) => (
              <button key={secs} role="radio" aria-checked={s.talk === secs} onClick={() => setS({ talk: secs })}>
                {label}
              </button>
            ))}
          </div>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={start} disabled={players.length < 3}>
            {t('Deal the cards')}
          </button>
          {players.length < 3 && <p className="pt-warn">{t('Impostor needs at least 3 players.')}</p>}
        </section>
      </div>
    );
  }

  const current = players[st.turn];

  if (st.stage === 'pass' && current) {
    return (
      <div className="pt-screen">
        {bar}
        <PassPhone player={current} note={t('{n} of {total}. Nobody else looks!', { n: st.turn + 1, total: players.length })} onReady={() => set({ stage: 'card' })} />
      </div>
    );
  }

  if (st.stage === 'card' && current) {
    const impostor = d.impostors.includes(current.id);
    const next = (): void => (st.turn + 1 < players.length ? set({ stage: 'pass', turn: st.turn + 1 }) : set({ stage: 'talk' }));
    return (
      <div className="pt-screen">
        {bar}
        <SecretCard impostor={impostor} theme={themeName} word={d.word} hint={st.settings.hint ? d.hint : null} />
        <button className="pt-btn pt-btn-big" onClick={next}>
          {st.turn + 1 < players.length ? t('Hide it, pass the phone') : t('Hide it: everyone has seen')}
        </button>
      </div>
    );
  }

  if (st.stage === 'talk') {
    const starter = byId(players, d.starter);
    return (
      <div className="pt-screen">
        {bar}
        <section className="pt-panel pt-imp-talk">
          <p className="pt-kicker">{t('Theme')}</p>
          <h2 className="pt-imp-theme">
            {themeById(d.theme)?.emoji} {themeName}
          </h2>
          {starter && (
            <p className="pt-imp-starter">
              <Avatar player={starter} size={34} /> {tNodes('{who} starts. Go round, one word each. Never say the word!', {}, { who: <b>{starter.name}</b> })}
            </p>
          )}
          {st.settings.talk > 0 && <Timer seconds={st.settings.talk} onEnd={() => set({ stage: 'vote' })} />}
          <p className="pt-muted">{t('Two or three rounds of words is usually enough. When you’re ready, vote: point at your suspect on three.')}</p>
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={() => set({ stage: 'vote' })}>
            {t('🗳️ Time to vote')}
          </button>
        </section>
      </div>
    );
  }

  if (st.stage === 'vote') {
    return (
      <div className="pt-screen">
        {bar}
        <section className="pt-panel">
          <h2>{t('Who did the group vote out?')}</h2>
          <p className="pt-muted">{t('Everyone points at their suspect on three. Tap the player with the most fingers.')}</p>
          <div className="pt-imp-vote">
            {players.map((p) => (
              <button key={p.id} className="pt-imp-suspect" style={{ ['--pc' as string]: p.color }} onClick={() => (d.impostors.includes(p.id) ? set({ stage: 'guess', voted: p.id }) : finish(p.id, null))}>
                <Avatar player={p} size={44} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <button className="pt-btn" onClick={() => finish(null, null)}>
            {t('It’s a tie: nobody goes')}
          </button>
        </section>
      </div>
    );
  }

  if (st.stage === 'guess' && st.voted) {
    const caught = byId(players, st.voted);
    return (
      <div className="pt-screen">
        {bar}
        <section className="pt-panel pt-imp-guess">
          <p className="pt-imp-badge">🚨</p>
          <h2>{t('{name} was the impostor!', { name: caught?.name ?? '' })}</h2>
          <p>
            {d.impostors.length > 1 ? t('Hand {name} the phone. One guess at the secret word steals the round for them:', { name: caught?.name ?? '' }) : t('Hand {name} the phone. One guess at the secret word steals the round:', { name: caught?.name ?? '' })}
          </p>
          <div className="pt-imp-options">
            {d.options.map((w) => (
              <button key={w} className="pt-btn" onClick={() => finish(st.voted, w)}>
                {w}
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // Result.
  const impostors = d.impostors.map((id) => byId(players, id)).filter((p): p is Player => !!p);
  const headline = st.outcome === 'escaped' ? `🕵️ The impostor${impostors.length > 1 ? 's' : ''} got away!` : st.outcome === 'stole' ? '😈 Caught, but they guessed the word!' : '🎉 Impostor caught!';
  const ranked = [...players].sort((a, b) => (session.scores[b.id] ?? 0) - (session.scores[a.id] ?? 0));
  return (
    <div className="pt-screen">
      {bar}
      <section className="pt-panel pt-imp-result">
        <h2>{headline}</h2>
        <p className="pt-imp-word">
          {t('The word was')}{' '}<b>{d.word}</b>
          <small>
            {themeById(d.theme)?.emoji} {themeName} · {t('hint “{hint}”', { hint: d.hint ?? '' })}
          </small>
        </p>
        <div className="pt-imp-reveal">
          {impostors.map((p) => (
            <span key={p.id} className="pt-name-chip" style={{ ['--pc' as string]: p.color }}>
              <Avatar player={p} size={26} /> {p.name} 🕵️
            </span>
          ))}
        </div>
        {st.guess && (
          <p className="pt-muted">
            {t('Their guess: “{guess}”', { guess: st.guess })} {st.outcome === 'stole' ? '✅' : '❌'}
          </p>
        )}
        <ol className="pt-imp-scores">
          {ranked.map((p) => (
            <li key={p.id}>
              <Avatar player={p} size={26} />
              <span>{p.name}</span>
              {st.gained[p.id] ? <em>+{st.gained[p.id]}</em> : null}
              <b>{session.scores[p.id] ?? 0}</b>
            </li>
          ))}
        </ol>
        <div className="pt-row">
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={start}>
            {t('Next round')}
          </button>
          <button className="pt-btn" onClick={() => set({ stage: 'setup' })}>
            {t('Change settings')}
          </button>
        </div>
        <p className="pt-muted">
          {d.impostors.length > 1
            ? t('Scoring: if no impostor is voted out, both get 2 points. If one is, everyone who isn’t an impostor gets 1, unless the caught impostor then guesses the word and steals 1.')
            : t('Scoring: if the impostor isn’t voted out, they get 2 points. If they are, everyone else gets 1, unless the impostor then guesses the word and steals 1.')}
        </p>
      </section>
    </div>
  );
}

/** A player's private card: the word, or the impostor's hint. */
export function SecretCard({ impostor, theme, word, hint }: { impostor: boolean; theme: string; word: string | null; hint: string | null }) {
  return (
    <div className={`pt-imp-card${impostor ? ' is-impostor' : ''}`}>
      <p className="pt-kicker">{t('Theme: {theme}', { theme })}</p>
      {impostor ? (
        <>
          <p className="pt-imp-role">{t('🕵️ You are the impostor')}</p>
          {hint ? (
            <p className="pt-imp-secret">
              <small>{t('Your hint')}</small>
              {hint}
            </p>
          ) : (
            <p className="pt-imp-secret">
              <small>{t('No hint this time')}</small>{t('Blend in!')}
            </p>
          )}
          <p className="pt-muted">{t('Everyone else knows the word. Listen, then say something vague enough to pass.')}</p>
        </>
      ) : (
        <>
          <p className="pt-imp-role">{t('The secret word')}</p>
          <p className="pt-imp-secret">{word}</p>
          <p className="pt-muted">{t('One of you doesn’t know it. Hint at it without giving it away.')}</p>
        </>
      )}
    </div>
  );
}
