import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '../../platform/account';
import type { AdminMember } from '../../platform/apiTypes';
import './PlayerPicker.css';

/** When a member was last seen, in a few words. */
export const seenAgo = (ms: number, now = Date.now()): string => {
  if (!ms) return 'never seen';
  const min = Math.floor((now - ms) / 60_000);
  if (min < 2) return 'seen just now';
  if (min < 60) return `seen ${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `seen ${h} h ago`;
  const d = Math.floor(h / 24);
  return d < 60 ? `seen ${d} days ago` : `seen ${new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

const looksLikeEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/**
 * A member, picked from a list rather than typed out: before anything is typed it offers the members seen last, and as
 * the admin types, the ones whose nickname or email has those letters (GET /api/admin/members). Each shows its nickname,
 * email and when it was last seen. Arrow keys and Enter work too. Once one is picked it shows as a card with Change.
 * Used wherever an admin acts on a member: Admin › Ads & shop's gifts and Sigilfall titles, and QA team invitations,
 * where `allowEmail` also offers an address no member has yet (picked with an empty id).
 */
export function PlayerPicker({
  value,
  onChange,
  label,
  placeholder = 'Type a nickname or email, or pick from the list',
  allowEmail = false,
}: {
  value: AdminMember | null;
  onChange: (member: AdminMember | null) => void;
  label: string;
  placeholder?: string;
  allowEmail?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<{ q: string; members: AdminMember[] } | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const asked = useRef(0);
  const refocus = useRef(false);
  const q = text.trim();

  // what matches, asked for a moment after typing stops (straight away for the members seen last); a late answer to an
  // older question is dropped
  useEffect(() => {
    if (!open) return;
    const n = ++asked.current;
    const t = window.setTimeout(
      () =>
        api<{ members?: AdminMember[] }>(`/api/admin/members?q=${encodeURIComponent(q)}`).then(
          (r) => {
            if (n !== asked.current) return;
            setFound({ q, members: r.members ?? [] });
            setActive(0);
            setError('');
          },
          () => n === asked.current && setError('Could not load the members. Try again.'),
        ),
      q ? 200 : 0,
    );
    return () => window.clearTimeout(t);
  }, [q, open]);

  // after Change, the box is back: put the cursor in it
  useEffect(() => {
    if (!value && refocus.current) {
      refocus.current = false;
      input.current?.focus();
    }
  }, [value]);

  const pick = (m: AdminMember): void => {
    onChange(m);
    setOpen(false);
    setText('');
  };

  if (value) {
    return (
      <div className="pp" role="group" aria-label={label}>
        <span className="pp-label">{label}</span>
        <div className="pp-picked">
          <span className="pp-avatar" aria-hidden="true">
            {(value.nickname || value.email).slice(0, 1).toUpperCase()}
          </span>
          <span className="pp-who">
            <b>{value.nickname || value.email}</b>
            <small>{value.id ? value.email : 'No member has this address yet'}</small>
          </span>
          <small className="pp-seen">{value.id ? seenAgo(value.lastSeen) : ''}</small>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              refocus.current = true;
              onChange(null);
              setOpen(true);
            }}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  const members = found?.members ?? [];
  // an address typed out that no member has, when that's allowed, as the last choice
  const typed = allowEmail && found?.q === q && looksLikeEmail(q) && !members.some((m) => m.email.toLowerCase() === q.toLowerCase());
  const options: AdminMember[] = typed ? [...members, { id: '', nickname: '', email: q, lastSeen: 0 }] : members;
  const shown = open && found !== null;
  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (options.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
    } else if (e.key === 'Enter') {
      // (never sends the form around it: Enter picks)
      e.preventDefault();
      const m = shown ? options[active] : undefined;
      if (m) pick(m);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };
  let note = 'Seen lately';
  if (found?.q) note = members.length ? `${members.length >= 20 ? 'First 20' : members.length} found` : `No member matches “${found.q}”`;
  return (
    <div className="pp">
      <label className="pp-label" htmlFor={`${id}-q`}>
        {label}
      </label>
      <div className="pp-box">
        <input
          ref={input}
          id={`${id}-q`}
          className="field"
          role="combobox"
          aria-expanded={shown}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={shown && options[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={text}
          maxLength={80}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
        />
        {open && (
          <div className="pp-pop">
            {error ? (
              <p className="pp-note" role="alert">
                {error}
              </p>
            ) : !found ? (
              <p className="pp-note">Looking…</p>
            ) : (
              <>
                <p className="pp-note mono">{note}</p>
                <ul id={`${id}-list`} role="listbox" aria-label={`${label}: members`} className="pp-list">
                  {options.map((m, i) => (
                    <li
                      key={m.id || `email:${m.email}`}
                      id={`${id}-${i}`}
                      role="option"
                      aria-label={m.id ? `${m.nickname}, ${m.email}, ${seenAgo(m.lastSeen)}` : `${m.email}, no member has this address yet`}
                      aria-selected={i === active}
                      className={`pp-option${i === active ? ' is-on' : ''}`}
                      // (the box keeps its focus, so the click lands)
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(m)}
                    >
                      <span className="pp-avatar" aria-hidden="true">
                        {(m.nickname || m.email).slice(0, 1).toUpperCase()}
                      </span>
                      <span className="pp-who">
                        <b>{m.nickname || m.email}</b>
                        <small>{m.id ? m.email : 'No member has this address yet: use it anyway'}</small>
                      </span>
                      <small className="pp-seen">{m.id ? seenAgo(m.lastSeen) : ''}</small>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
