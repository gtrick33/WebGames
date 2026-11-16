import { ARENA_H, ARENA_W, ENTRY_W, ENTRY_Y0, ENTRY_Y1, MAP_IDS, MAPS, type RingMap } from '../arena/maps';

/**
 * The Ring's arena choice (the owner: "can we make the arena [setup] ... a bit better visually please, they suck right
 * now, they need to be in style with the whole vibe"): the arena chosen as a card with a picture of its ground, and
 * the choice itself as a card for each, every one with its own picture.
 */

/** Each ground's colors: its floor, its stone (top and shadow), and the edge round it. */
const LOOK: Record<RingMap['theme'], { floor: [string, string]; top: string; side: string; edge: string; ring: string }> = {
  sands: { floor: ['#d9b47a', '#9c7444'], top: '#f4e2b8', side: '#7a5a34', edge: '#5a3e22', ring: 'rgb(122 74 30 / 0.45)' },
  frost: { floor: ['#d8ecf6', '#89b3cc'], top: '#ffffff', side: '#5d86a6', edge: '#3a5a78', ring: 'rgb(60 110 150 / 0.4)' },
  forge: { floor: ['#5a3426', '#2a1712'], top: '#9a6448', side: '#1c0f0a', edge: '#160a06', ring: 'rgb(255 130 60 / 0.4)' },
};

/** A ground seen from above: its floor, the entries at each end, the sigil's ring, every stone and the healing spheres. */
export function ArenaPicture({ id, className }: { id: string; className?: string }) {
  const map = MAPS[id];
  if (!map) return null;
  const k = LOOK[map.theme];
  const g = `rb-ar-floor-${id}`;
  return (
    <svg className={`rb-ar-pic${className ? ` ${className}` : ''}`} viewBox={`-8 -8 ${ARENA_W + 16} ${ARENA_H + 16}`} aria-hidden="true">
      <defs>
        <radialGradient id={g} cx="50%" cy="45%" r="75%">
          <stop offset="0" stopColor={k.floor[0]} />
          <stop offset="1" stopColor={k.floor[1]} />
        </radialGradient>
      </defs>
      <rect x="-8" y="-8" width={ARENA_W + 16} height={ARENA_H + 16} rx="22" fill={k.edge} />
      <rect x="0" y="0" width={ARENA_W} height={ARENA_H} rx="14" fill={`url(#${g})`} />
      {/* the entries, a recess at each end */}
      <rect x="0" y={ENTRY_Y0} width={ENTRY_W} height={ENTRY_Y1 - ENTRY_Y0} fill="rgb(70 130 220 / 0.35)" />
      <rect x={ARENA_W - ENTRY_W} y={ENTRY_Y0} width={ENTRY_W} height={ENTRY_Y1 - ENTRY_Y0} fill="rgb(220 70 70 / 0.35)" />
      {/* the sigil's ring in the middle */}
      <circle cx={ARENA_W / 2} cy={ARENA_H / 2} r="58" fill="none" stroke={k.ring} strokeWidth="7" />
      <circle cx={ARENA_W / 2} cy={ARENA_H / 2} r="30" fill="none" stroke={k.ring} strokeWidth="4" />
      {/* every stone: its shadow, then its top */}
      {map.pillars.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={p.y + 7} width={p.w} height={p.h} rx="3" fill={k.side} opacity={p.wall ? 0.7 : 0.85} />
          <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="3" fill={p.wall ? k.side : k.top} />
          {/* (the forge's furnaces burn) */}
          {map.theme === 'forge' && !p.wall && <circle cx={p.x + p.w / 2} cy={p.y + p.h / 2} r={Math.min(p.w, p.h) * 0.3} fill="#ff8a2a" />}
        </g>
      ))}
      {map.orbs.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="#7fe06a" stroke="#eaffd8" strokeWidth="3" />
      ))}
    </svg>
  );
}

/** "Any": the three grounds fanned like cards, and a question over them. */
function AnyPicture() {
  return (
    <span className="rb-ar-pic rb-ar-any" aria-hidden="true">
      {MAP_IDS.slice(0, 3).map((id, i) => (
        <ArenaPicture key={id} id={id} className={`is-fan is-fan-${i}`} />
      ))}
      <b>?</b>
    </span>
  );
}

export function ArenaChoice({ map, open, onOpen, onPick }: { map: string; open: boolean; onOpen: (open: boolean) => void; onPick: (id: string) => void }) {
  const chosen = MAPS[map];
  return (
    <div className="rb-ar" data-tut="arena">
      {!open ? (
        <button className="rb-ar-now" onClick={() => onOpen(true)} aria-expanded={false} aria-label={`Arena: ${chosen ? chosen.name : 'Any'}. Change`}>
          {chosen ? <ArenaPicture id={map} /> : <AnyPicture />}
          <span className="rb-ar-what">
            <small>Arena</small>
            <b>{chosen ? chosen.name : 'Any arena'}</b>
            <em>{chosen ? chosen.blurb : 'A different one each time.'}</em>
          </span>
          <span className="rb-rw-more">Change</span>
        </button>
      ) : (
        <div className="rb-ar-open">
          <h3>
            Choose an arena
            <button className="rb-linkbtn" onClick={() => onOpen(false)}>
              Done
            </button>
          </h3>
          <div className="rb-ar-cards" role="radiogroup" aria-label="Arena">
            {['random', ...MAP_IDS].map((id) => {
              const m = MAPS[id];
              return (
                // (the picture and the name: what each is like is said on the card once it is chosen, and on hover)
                <button key={id} role="radio" aria-checked={map === id} title={m ? m.blurb : 'A different arena every match.'} className={`rb-ar-card${map === id ? ' is-on' : ''}`} style={m ? { ['--c' as string]: m.color } : undefined} onClick={() => onPick(id)}>
                  {m ? <ArenaPicture id={id} /> : <AnyPicture />}
                  <strong>{m ? m.name : 'Any arena'}</strong>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
