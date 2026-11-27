/** The menu: play online, today's daily level, the solo level select, how to play. */
import { useState } from 'react';
import { GameMenuButton } from '../../components/GameMenuButton';
import { OnlinePlay } from '../../components/OnlinePlay';
import { shareOrCopy } from '../../platform/share';
import { COLOR_IDS, PALS } from './critters';
import { LEVELS } from './levels';
import { PalFace } from './PalFace';
import { LEVEL_COUNT, packLevels, PACKS } from './rules';
import { dailyLevel, dailyNumber, unlocked, type Mode, type Save } from './store';

export function Menu({
  save,
  commit,
  today,
  name,
  hasSiteName,
  muted,
  onMute,
  onPlay,
  onOpenRoom,
  onJoinRoom,
}: {
  save: Save;
  commit: (fn: (s: Save) => Save) => void;
  today: string;
  name: string;
  hasSiteName: boolean;
  muted: boolean;
  onMute: () => void;
  onPlay: (m: Mode, level: number) => void;
  onOpenRoom: (listed: boolean) => Promise<string | null>;
  onJoinRoom: (code: string) => Promise<string | null>;
}) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const daily = save.daily[today];
  const dl = dailyLevel(today);
  const pack = save.pack;
  const set = packLevels(pack);
  const cleared = Object.keys(save.levels).length;
  return (
    <div className="pri-scroll">
      <div className="pri-panel">
        <div className="pri-toprow">
          <span />
          <div className="pri-tools">
            <button className="pri-icon" onClick={onMute} aria-label={muted ? 'Sound on' : 'Sound off'}>
              {muted ? '🔇' : '🔊'}
            </button>
            <GameMenuButton className="pri-icon" />
          </div>
        </div>
        <header className="pri-hero">
          <div className="pri-hero-pals" aria-hidden="true">
            {COLOR_IDS.map((c, i) => (
              <PalFace key={c} color={c} size={i === 1 || i === 2 ? 60 : 50} flip={i > 1} />
            ))}
          </div>
          <h2 className="pri-name">Prism Pals</h2>
          <p className="pri-tagline">Color blocks hold up only their own pal, goo is safe only for its own color, and plates open gates for the others. Get every pal to the door together.</p>
        </header>

        <section className="pri-card">
          <h3>
            Play with friends <small>live, 2 to 4</small>
          </h3>
          <div className="pri-colors" role="radiogroup" aria-label="Your favorite pal">
            {COLOR_IDS.map((c) => (
              <button key={c} role="radio" aria-checked={save.color === c} className={`pri-color${save.color === c ? ' is-on' : ''}`} style={{ ['--c' as string]: PALS[c].color }} onClick={() => commit((s) => ({ ...s, color: c }))}>
                <PalFace color={c} size={36} />
                <small>{PALS[c].name}</small>
              </button>
            ))}
          </div>
          <label className="pri-field">
            <span>Your name in the room</span>
            <input value={save.name} placeholder={hasSiteName ? name : 'Pick a name'} maxLength={20} onChange={(e) => commit((s) => ({ ...s, name: e.target.value }))} />
          </label>
          <OnlinePlay game="prism-pals" busyLabel="Opening…" onCreate={onOpenRoom} onJoin={(c) => onJoinRoom(c)} />
          <form
            className="pri-join"
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (!/^[A-HJKMNP-Z]{5}$/.test(c)) return setErr('Room codes are five letters.');
              void onJoinRoom(c).then((x) => setErr(x ?? ''));
            }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={5} aria-label="Room code" className="pri-mono" />
            <button className="pri-ghost">Join</button>
          </form>
          {err && <p className="pri-err">{err}</p>}
        </section>

        <section className="pri-card pri-daily">
          <h3>
            Daily level #{dailyNumber(today)} <small>{LEVELS[dl]!.name}</small>
          </h3>
          <p className="pri-sub">The same level for everyone today, played solo: you run every pal. Fast and every gem scores most.</p>
          {daily && (
            <p className="pri-sub">
              Best today: <b>{daily.best}</b> ({daily.tries} {daily.tries === 1 ? 'try' : 'tries'}) {daily.line}
            </p>
          )}
          <button className="pri-cta" onClick={() => onPlay('daily', dl)}>
            {daily ? 'Play again' : 'Play today’s level'}
          </button>
        </section>

        <section className="pri-card">
          <h3>
            Solo <small>{cleared} of {LEVEL_COUNT} cleared</small>
          </h3>
          <div className="pri-seg" role="radiogroup" aria-label="Pals in the level">
            {PACKS.map((p) => (
              <button key={p} role="radio" aria-checked={pack === p} className={pack === p ? 'is-on' : ''} onClick={() => commit((s) => ({ ...s, pack: p }))}>
                {p} pals
              </button>
            ))}
          </div>
          <div className="pri-levels">
            {set.map((i, k) => {
              const open = unlocked(save, i);
              const b = save.levels[i];
              return (
                <button key={i} className={`pri-level${b ? ' is-done' : ''}`} disabled={!open} onClick={() => onPlay('solo', i)} aria-label={`Level ${k + 1}: ${LEVELS[i]!.name}${b ? `, best ${b.best}` : open ? '' : ', locked'}`}>
                  <b>{open ? k + 1 : '🔒'}</b>
                  <span>{LEVELS[i]!.name}</span>
                  <small>{b ? `★ ${b.best} · 💎 ${b.gems}` : open ? 'New' : 'Locked'}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="pri-card pri-how">
          <h3>How to play</h3>
          <ul>
            <li>
              <b>Walk</b> with ← → (or A D), <b>jump</b> with ↑, W or Space. <b>Tab</b> or <b>Q</b> switches pals, <b>E</b> or <b>↓</b> pulls a lever, <b>R</b> restarts.
            </li>
            <li>Color blocks are solid only for the pal of that color: the others fall straight through.</li>
            <li>Goo is safe only for its own color. Plates open the gates of their color while that pal stands on them.</li>
            <li>Each pal picks up only gems of its color. Push crates, bounce on springs, ride lifts, pull levers. When one pal falls, the whole team starts over.</li>
          </ul>
        </section>
        <p className="pri-totals">
          Levels cleared {cleared} · Rounds {save.runs} · Best level score {save.best}
        </p>
      </div>
    </div>
  );
}

export function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button className="pri-ghost" onClick={() => void shareOrCopy({ title: 'Prism Pals', text }).then((o) => setMsg(o === 'copied' ? 'Copied!' : ''))}>
      {msg || 'Share'}
    </button>
  );
}
