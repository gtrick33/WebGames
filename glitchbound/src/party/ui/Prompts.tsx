import { useState } from 'react';
import { CHALLENGES } from '../content/challenges';
import { cardConsequence, draw, fillChallenge, filterContent, freshRng, intensityWeights, noteParticipation, type Rng } from '../engine';
import type { PartySession } from '../session';
import type { Challenge, ChallengeKind, Player } from '../types';
import { ModeBar, Name, PlayerPicker, Results, Timer } from './shared';

const KIND_LABEL: Record<ChallengeKind, { label: string; color: string }> = {
  truth: { label: 'Truth', color: '#3d7bff' },
  dare: { label: 'Dare', color: '#ff5a6c' },
  vote: { label: 'Most likely to', color: '#a45cff' },
  challenge: { label: 'Challenge', color: '#ff8a1f' },
  duel: { label: 'Duel', color: '#e64c9a' },
  rule: { label: 'New rule', color: '#12c6b3' },
  question: { label: 'Who knows whom', color: '#2fd1a0' },
  group: { label: 'Everyone', color: '#ffb020' },
};

const INTENSITY_BADGE = { casual: '😊 Casual', spicy: '🌶️ Spicy', afterdark: '🔞 After Dark' } as const;

/** Custom prompts become "challenge" cards; {A}/{B} work like in built-in cards. */
export function customChallenges(lines: readonly string[]): Challenge[] {
  return lines
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `custom-${i}-${text.length}`, kind: 'challenge' as const, intensity: 'casual' as const, text, target: text.includes('{B}') ? ('two' as const) : text.includes('{A}') ? ('one' as const) : ('everyone' as const) }));
}

/** All cards this session may draw. */
export function promptDeck(s: PartySession): Challenge[] {
  return [...filterContent(CHALLENGES, s.settings), ...customChallenges(s.custom.challenges)];
}

/** Deals the next card into the session (pure apart from the random source). */
export function dealPrompt(s: PartySession, r: Rng): PartySession {
  const st = s.active?.mode === 'prompts' ? s.active : { mode: 'prompts' as const, count: 0, limit: 30 };
  const w = intensityWeights(s.settings);
  // The group's own cards always come up at full rate.
  const d = draw(promptDeck(s), s.used.challenges ?? [], r, (c) => (c.id.startsWith('custom-') ? 1 : w[c.intensity]));
  if (!d.item) return { ...s, active: { ...st, card: undefined } };
  const f = fillChallenge(d.item, s.players, { part: s.part, scores: s.scores, r, avoid: st.card?.players[0] });
  const card = { c: d.item, text: f.text, players: f.players.map((p) => p.id), teams: f.teams ? ([f.teams[0].map((p) => p.id), f.teams[1].map((p) => p.id)] as [string[], string[]]) : undefined };
  return { ...s, used: { ...s.used, challenges: d.used }, part: noteParticipation(s.part, f.players), active: { ...st, count: st.count + 1, card } };
}

export function PromptsMode({ session, update, onExit }: { session: PartySession; update: (fn: (s: PartySession) => PartySession) => void; onExit: () => void }) {
  const [r] = useState(freshRng);
  const deck = promptDeck(session);
  const active = session.active?.mode === 'prompts' ? session.active : null;
  const [picked, setPicked] = useState<string[]>([]);
  const [paid, setPaid] = useState<string | null>(null);
  const [timerOn, setTimerOn] = useState(false);

  const next = (): void => {
    update((cur) => dealPrompt(cur, r));
    setPicked([]);
    setPaid(null);
    setTimerOn(false);
  };

  const award = (ids: string[], n: number): void => update((s) => ({ ...s, scores: Object.fromEntries(s.players.map((p) => [p.id, (s.scores[p.id] ?? 0) + (ids.includes(p.id) ? n : 0)])) }));
  const penalize = (id: string, units = 1): void => {
    setPaid(id);
    if (session.settings.consequence === 'points') award([id], -units);
  };

  if (!active) return null;
  if (!deck.length) {
    return (
      <div className="pt-screen">
        <ModeBar title="Party Prompts" onExit={onExit} />
        <p className="pt-empty">No cards match your filters. Turn some categories back on in setup.</p>
      </div>
    );
  }
  if (active.count > active.limit) {
    return (
      <Results
        title="That’s a wrap!"
        players={session.players}
        scores={session.scores}
        onAgain={() => update((s) => dealPrompt({ ...s, scores: {}, active: { mode: 'prompts', count: 0, limit: active.limit } }, r))}
        onMenu={onExit}
      />
    );
  }
  const card = active.card;
  if (!card) {
    return (
      <div className="pt-screen">
        <ModeBar title="Party Prompts" onExit={onExit} />
        <button className="pt-btn pt-btn-go pt-btn-big" onClick={next}>
          Deal a card
        </button>
      </div>
    );
  }

  const c = card.c;
  const pl = (ids: string[]) => ids.map((id) => session.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const f = { text: card.text, players: pl(card.players), teams: card.teams ? ([pl(card.teams[0]), pl(card.teams[1])] as [Player[], Player[]]) : undefined };
  const kind = KIND_LABEL[c.kind];
  const stakes = c.stakes ?? 1;
  // Seeded by the card, so the task named on the card is the one the outcome asks for.
  const cons = cardConsequence(session.settings.consequence, stakes, `${c.id}:${active.count}`);
  const paidPlayer = session.players.find((p) => p.id === paid);

  return (
    <div className="pt-screen">
      <ModeBar title="Party Prompts" progress={`${Math.min(active.count, active.limit)}/${active.limit}`} onExit={onExit} />
      <article className="pt-card" style={{ ['--kc' as string]: kind.color }} key={c.id + active.count}>
        <div className="pt-card-head">
          <span className="pt-kind">{kind.label}</span>
          <span className="pt-intensity">{INTENSITY_BADGE[c.intensity]}</span>
        </div>
        <p className="pt-card-text">{f.text}</p>
        {c.note && <p className="pt-card-note">{c.note}</p>}
        {f.teams && (
          <p className="pt-muted">
            Team 1: {f.teams[0].map((p) => p.name).join(', ')} · Team 2: {f.teams[1].map((p) => p.name).join(', ')}
          </p>
        )}
        {c.seconds && (timerOn ? <Timer seconds={c.seconds} onEnd={() => navigator.vibrate?.(200)} /> : (
          <button className="pt-btn pt-btn-sm" onClick={() => setTimerOn(true)}>
            ⏱ Start {c.seconds}s timer
          </button>
        ))}
        <p className="pt-cons">
          {c.kind === 'rule' ? 'Break the rule:' : 'Skip or lose:'} <b>{cons}</b>
        </p>
      </article>

      {paid !== null ? (
        <div className="pt-outcome">
          {paidPlayer ? (
            <p>
              <Name player={paidPlayer} />, {cons}.
            </p>
          ) : (
            <p>Nobody pays up this time.</p>
          )}
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={next}>
            Next card →
          </button>
        </div>
      ) : c.kind === 'vote' || c.kind === 'group' ? (
        <div className="pt-actions">
          <p className="pt-muted">{c.kind === 'vote' ? 'Count to 3 and point. Who got the most votes?' : 'Who lost (or did it worst)?'}</p>
          <PlayerPicker players={session.players} selected={picked} label="Pick a player" onToggle={(id) => penalize(id, stakes)} />
          <button className="pt-btn pt-btn-ghost" onClick={() => setPaid('')}>
            {c.kind === 'vote' ? 'It’s a tie: skip' : 'Nobody, next'}
          </button>
        </div>
      ) : c.kind === 'duel' || f.teams ? (
        <div className="pt-actions">
          <p className="pt-muted">{f.teams ? 'Which team won?' : 'Who won?'}</p>
          {f.teams ? (
            <div className="pt-row">
              {f.teams.map((t, i) => (
                <button
                  key={i}
                  className="pt-btn"
                  onClick={() => {
                    award(
                      t.map((p) => p.id),
                      1,
                    );
                    setPaid('');
                  }}
                >
                  Team {i + 1}
                </button>
              ))}
            </div>
          ) : (
            <PlayerPicker
              players={f.players}
              selected={picked}
              label="Winner"
              onToggle={(id) => {
                setPicked([id]);
                award([id], 1);
                const loser = f.players.find((p) => p.id !== id);
                if (loser) penalize(loser.id, stakes);
                else setPaid('');
              }}
            />
          )}
        </div>
      ) : c.kind === 'rule' ? (
        <div className="pt-actions">
          <button className="pt-btn pt-btn-go pt-btn-big" onClick={next}>
            Rule is on! Next card →
          </button>
        </div>
      ) : (
        <div className="pt-actions">
          <button
            className="pt-btn pt-btn-go pt-btn-big"
            onClick={() => {
              award(
                (c.kind === 'question' ? f.players.slice(1, 2) : f.players.slice(0, 1)).map((p) => p.id),
                1,
              );
              setPaid('');
            }}
          >
            {c.kind === 'question' ? 'They got it right (+1)' : 'Done! (+1)'}
          </button>
          <button className="pt-btn" onClick={() => penalize((c.kind === 'question' ? f.players[1] : f.players[0])?.id ?? '', stakes)}>
            {c.kind === 'question' ? 'Wrong guess' : 'Skip'}
          </button>
        </div>
      )}
    </div>
  );
}
