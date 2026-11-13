import { useCallback, useEffect, useId, useState } from 'react';
import { cleanTitle, TITLE_FX, TITLE_MAX, titleFx, titleGoesAfter, type TitleFxId } from '../../catalog/titleFx';
import { TitleFx } from '../../components/TitleFx';
import { api, ApiError } from '../../platform/account';
import type { GmTitle } from '../../platform/apiTypes';
import './SigilTitles.css';

/**
 * Giving a member a Sigilfall title of the admin's own words (Admin › Sigilfall, on a player's page, and Admin › Ads &
 * shop, for any member): the words, the light they wear, picked by seeing every light on those very words, and which
 * side of the name they read on, with a line that reads as the player will see it. Under it, the titles already given,
 * each with Take back. Account-wide: any of the member's heroes can wear one (server/sigilfallTitles.ts).
 */

const when = (ms: number): string => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const errorText = (e: unknown, fallback: string): string => (e instanceof ApiError ? (e.message && e.message !== e.code ? e.message : fallback) : 'Network error. Try again.');

/** A title beside a name, as a player reads it: "Blooded Ash", "Ash the Kingslayer", "Ash, Champion of the Starfall". */
export function TitleLine({ name, title, fx, before }: { name: string; title: string; fx: string; before: boolean }) {
  const lit = <TitleFx fx={fx}>{title}</TitleFx>;
  if (before) {
    return (
      <>
        {lit} <span className="tg-name">{name}</span>
      </>
    );
  }
  return (
    <>
      <span className="tg-name">{name}</span>
      {/^(the|of) /i.test(title) ? ' ' : ', '}
      {lit}
    </>
  );
}

/** How fine a light is, 0 to 6, as pips. */
function Pips({ tier }: { tier: number }) {
  return (
    <span className="tg-pips" title={`Tier ${tier} of 6`} aria-label={`tier ${tier} of 6`}>
      {Array.from({ length: 6 }, (_, i) => (
        <i key={i} className={i < tier ? 'is-on' : ''} />
      ))}
    </span>
  );
}

export function TitleGiver({ userId, nickname, names }: { userId: string; nickname: string; names: string[] }) {
  const id = useId();
  const [titles, setTitles] = useState<GmTitle[] | null>(null);
  const [text, setText] = useState('');
  const [fx, setFx] = useState<TitleFxId>('gilded');
  // null until the admin picks a side: the words decide
  const [side, setSide] = useState<'before' | 'after' | null>(null);
  const [shownName, setShownName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const title = cleanTitle(text);
  const before = side ? side === 'before' : !titleGoesAfter(title);
  const choices = names.length ? names : [nickname];
  const shown = shownName && choices.includes(shownName) ? shownName : choices[0]!;

  const load = useCallback(
    () =>
      api<{ titles?: GmTitle[] }>(`/api/admin/sigilfall/titles?user=${encodeURIComponent(userId)}`).then(
        (r) => setTitles(r.titles ?? []),
        (e: unknown) => setMsg({ text: errorText(e, 'Could not load their titles.'), bad: true }),
      ),
    [userId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>, done: string): Promise<boolean> => {
    setBusy(true);
    setMsg(null);
    try {
      await api('/api/admin/sigilfall/titles', { body });
      setMsg({ text: done });
      await load();
      return true;
    } catch (e) {
      setMsg({ text: errorText(e, 'That didn’t work.'), bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const give = (): void => {
    if (!title || busy) return;
    void post({ action: 'grant', userId, name: title, fx, before }, `Given: “${title}”. Any of ${nickname}’s heroes can wear it once their game next loads their account.`).then((ok) => {
      if (!ok) return;
      setText('');
      setSide(null);
    });
  };
  const live = titles?.filter((t) => !t.revokedAt) ?? [];
  const gone = titles?.filter((t) => t.revokedAt) ?? [];

  return (
    <div className="tg">
      <form
        className="tg-form"
        onSubmit={(e) => {
          e.preventDefault();
          give();
        }}
      >
        <div className="tg-top">
          <label className="ag-field tg-words">
            <span>
              Title <small className="mono">{title.length}/{TITLE_MAX}</small>
            </span>
            <input className="field" value={text} maxLength={TITLE_MAX} onChange={(e) => setText(e.target.value)} placeholder="the Kingslayer, Blooded, Champion of the Ring…" />
          </label>
          <div className="ag-field">
            <span id={`${id}-side`}>Reads</span>
            <div className="seg tg-side" role="radiogroup" aria-labelledby={`${id}-side`}>
              {(['before', 'after'] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={before === (s === 'before')} className={before === (s === 'before') ? 'is-on' : ''} onClick={() => setSide(s)}>
                  {s === 'before' ? 'Before the name' : 'After the name'}
                </button>
              ))}
            </div>
          </div>
          {choices.length > 1 && (
            <label className="ag-field">
              <span>Shown on</span>
              <select className="field" value={shown} onChange={(e) => setShownName(e.target.value)}>
                {choices.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="tg-dark tg-preview" aria-label="Preview" aria-live="polite">
          {title ? <TitleLine name={shown} title={title} fx={fx} before={before} /> : <span className="tg-hint">Type a title to see it on {shown}.</span>}
        </p>
        {!side && title && <p className="info-small tg-why">{before ? 'Before the name' : 'After the name'}, from its words. Pick a side above to change it.</p>}
        <fieldset className="tg-lights">
          <legend className="ag-field">Light: {titleFx(fx).name}</legend>
          <div className="tg-grid">
            {TITLE_FX.map((f) => (
              <label key={f.id} className={`tg-light${fx === f.id ? ' is-on' : ''}`}>
                <input type="radio" className="sr-only" name={`${id}-fx`} value={f.id} checked={fx === f.id} onChange={() => setFx(f.id)} aria-label={`${f.name}, tier ${f.tier} of 6: ${f.blurb}`} />
                <span className="tg-dark tg-sample">
                  <TitleFx fx={f.id}>{title || f.name}</TitleFx>
                </span>
                <span className="tg-light-text">
                  <b>{f.name}</b> <Pips tier={f.tier} />
                  <small>{f.blurb}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="reset-row">
          <button className="btn btn-sm btn-primary" disabled={!title || busy}>
            {title ? `Give “${title}”` : 'Give the title'}
          </button>
        </div>
      </form>
      {msg && (
        <p className="info-small" role={msg.bad ? 'alert' : 'status'}>
          {msg.text}
        </p>
      )}
      <h3 className="admin-h3 tg-h">Given to {nickname} · {live.length}</h3>
      {titles === null ? (
        <p className="info-small">Loading…</p>
      ) : live.length === 0 ? (
        <p className="info-small">No titles given yet.</p>
      ) : (
        <ul className="tg-list" aria-label="Titles they hold">
          {live.map((t) => (
            <li key={t.id} className="tg-row">
              <span className="tg-dark tg-chip">
                <TitleLine name={shown} title={t.name} fx={t.fx} before={t.before} />
              </span>
              <small className="tg-meta">
                {titleFx(t.fx).name} · {t.before ? 'before' : 'after'} the name · {when(t.at)} · {t.by}
              </small>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Take “${t.name}” back from ${nickname}? None of their heroes can wear it after that.`)) void post({ action: 'revoke', id: t.id }, `Taken back: “${t.name}”.`);
                }}
              >
                Take back
              </button>
            </li>
          ))}
        </ul>
      )}
      {gone.length > 0 && (
        <details className="tg-gone">
          <summary className="info-small">Taken back · {gone.length}</summary>
          <ul className="tg-list" aria-label="Titles taken back">
            {gone.map((t) => (
              <li key={t.id} className="tg-row is-gone">
                <span className="tg-dark tg-chip">
                  <TitleFx fx={t.fx}>{t.name}</TitleFx>
                </span>
                <small className="tg-meta">
                  given {when(t.at)} · taken back {when(t.revokedAt!)}
                </small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
