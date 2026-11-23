import { useRef, useState } from 'react';
import type { SigilEngine } from '../engine';
import { BOON_BY_ID, ECHO_EVERY, heartRank, HEARTS, HUNT_MAX, KINSHIP_EXTRA, SHRINES, STREAK_DMG, STREAK_MAX, type ShrineId } from '../data/seasons';
import { setsWorn } from '../progress/build';
import { itemName } from '../progress/items';
import { blessingsLit, borrowedItem, heartOf, seasonOf } from '../progress/season';
import { SKILLS } from '../data/skills';
import type { World } from '../sim/world';
import { say } from './hudWrite';
import { useFrame } from './GameScreen';

/** What the season's line on a run's clock says, and in what color, as the run stands (data/seasons.ts). */
function lineOf(engine: SigilEngine, w: World): { text: string; color: string } | null {
  const run = w.seasonRun;
  const h = engine.hero;
  if (!run || !h) return null;
  const n = w.season;
  switch (run.mechanic) {
    case 'heart': {
      const heart = heartOf(h, n);
      return heart ? { text: `${HEARTS[heart].name} · rank ${heartRank(seasonOf(h, n).best)}`, color: HEARTS[heart].color } : { text: 'No Season Heart chosen', color: '#b8a8c8' };
    }
    case 'shrines': {
      const on = w.player.buffs.find((b) => b.def.id.startsWith('shrine-'));
      if (on) {
        const d = SHRINES[on.def.id.slice(7) as ShrineId];
        return { text: `${d.name} · ${Math.ceil(on.t)} s`, color: d.color };
      }
      const left = run.shrines.filter((s) => !s.taken).length;
      return { text: left ? `${left} ${left === 1 ? 'shrine stands' : 'shrines stand'} in this run` : 'Every shrine taken', color: '#c8b8ff' };
    }
    case 'kinship': {
      const best = setsWorn(h.equip).filter((s) => s.worn >= 2).sort((a, b) => b.worn - a.worn)[0];
      return best ? { text: `Kinship: ${best.set.name} ${best.worn} → ${Math.min(6, best.worn + KINSHIP_EXTRA)}`, color: '#36e0a8' } : { text: 'Kinship: wear two pieces of a set', color: '#8ad8b8' };
    }
    case 'borrowed': {
      const it = borrowedItem(h, n);
      return it ? { text: `Borrowed: ${itemName(it)}`, color: '#ff9a2a' } : { text: 'No legend borrowed', color: '#c8a878' };
    }
    case 'boons':
      return run.boons.length ? { text: run.boons.map((id) => BOON_BY_ID[id]?.name ?? id).join(' · '), color: '#ffe066' } : { text: 'A boon after every boss', color: '#e8d48a' };
    case 'altar':
      return { text: `Blessings ${blessingsLit(h, n).length} of 10`, color: '#c8a8ff' };
    case 'bloodlust': {
      const s = run.streak;
      const live = s.n > 0 && w.time - s.last <= 3;
      return live ? { text: `Streak ${s.n} · +${Math.min(STREAK_MAX, s.n) * STREAK_DMG}% damage`, color: '#ff4a5a' } : { text: 'Kill to start a streak', color: '#d88a8a' };
    }
    case 'twin': {
      const t = seasonOf(h, n).twin;
      return t ? { text: `Twin path: ${SKILLS[t.skill]?.name ?? t.skill}`, color: '#6ad8a0' } : { text: 'No twin path chosen', color: '#8ab8a0' };
    }
    case 'nemesis': {
      const hu = run.hunter;
      const won = Math.min(HUNT_MAX, seasonOf(h, n).hunted ?? 0);
      if (hu?.state === 'out') return { text: 'The Hunter is here', color: '#ff4a4a' };
      if (hu?.state === 'down') return { text: `Hunter beaten · +${won}% damage`, color: '#ffd84a' };
      return { text: `The Hunter stalks you · +${won}% damage`, color: '#d88a8a' };
    }
    case 'echoes': {
      const left = ECHO_EVERY - (run.casts % ECHO_EVERY);
      return { text: left === ECHO_EVERY ? 'Echo!' : `Echo in ${left} ${left === 1 ? 'cast' : 'casts'}`, color: '#8ae0ff' };
    }
  }
}

/** The season's line on a Riftstone run's clock: what its mechanic is doing for the hero right now. */
export function SeasonLine({ engine }: { engine: SigilEngine }) {
  const el = useRef<HTMLSpanElement>(null);
  useFrame(engine, (w) => {
    const l = lineOf(engine, w);
    if (!el.current) return;
    say(el.current, l?.text ?? '');
    if (l && el.current.style.color !== l.color) el.current.style.color = l.color;
  });
  return <span ref={el} className="rb-small rb-season-line" />;
}

/**
 * The Season of Boons' choice after a boss (sim/season.ts seasonBossDown): three boons on cards, the run waiting for the
 * pick. A tap takes one for the rest of the run.
 */
export function BoonOffer({ engine }: { engine: SigilEngine }) {
  const [offer, setOffer] = useState<string[] | null>(null);
  useFrame(engine, (w) => {
    const o = w.seasonRun?.offer ?? null;
    if ((o?.join() ?? '') !== (offer?.join() ?? '')) setOffer(o ? [...o] : null);
  });
  if (!offer) return null;
  return (
    <div className="rb-modal is-dark rb-boons" role="dialog" aria-modal="true" aria-label="Choose a boon">
      <div className="rb-boons-box">
        <span className="rb-kicker">The boss is down · choose a boon for the rest of the run</span>
        <div className="rb-boons-cards">
          {offer.map((id, i) => {
            const b = BOON_BY_ID[id]!;
            return (
              <button key={id} className="rb-boon" style={{ ['--boon' as string]: b.color }} onClick={() => engine.takeSeasonBoon(i)}>
                <strong>{b.name}</strong>
                <span>{b.text}</span>
              </button>
            );
          })}
        </div>
        <span className="rb-small rb-dim">The clock waits while you choose.</span>
      </div>
    </div>
  );
}
