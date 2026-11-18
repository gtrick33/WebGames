/**
 * The Ring's fight layer after the owner's notes of 2026-11-18 (a phone held sideways): "check the pic and see how its
 * cut on the left side", "redesign this screen ... keep the whole thing on one page preferably", "in the partner
 * section where you choose a partner, there should be option to invite a friend", and "the with friends section acts
 * as a custom game mode where you shouldnt gain any rating".
 */
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRESETS } from '../src/games/sigilfall/arena/abilities';
import { NEW_STANDING, type Format, type Standing } from '../src/games/sigilfall/arena/ranks';
import { PlayLayer, type Ladder, type PartyShown } from '../src/games/sigilfall/ui/RingPlay';

const css = fs.readFileSync(path.resolve(__dirname, '../src/games/sigilfall/Game.css'), 'utf8');
const rule = (sel: string): string => {
  const at = css.indexOf(`${sel} {`);
  expect(at, sel).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};

const bar = PRESETS.warrior[0]!.bar;
const st = (rating: number): Standing => ({ ...NEW_STANDING, rating, best: rating, wins: 20, losses: 10, mmr: rating });

function layer(o: { ladder?: Ladder; format?: Format; party?: PartyShown | null; onInvite?: () => void; onCustom?: () => void; onFind?: () => void } = {}) {
  return render(
    <PlayLayer
      format={o.format ?? 2}
      onFormat={() => undefined}
      standing={(f) => st(f === 2 ? 1555 : 1126)}
      ladder={o.ladder ?? 'ranked'}
      season={1}
      pick="warrior"
      bar={[...bar]}
      mates={['random']}
      onMates={() => undefined}
      map="random"
      onMap={() => undefined}
      note=""
      ready
      barred={false}
      party={o.party ?? null}
      onInvite={o.onInvite ?? (() => undefined)}
      onLeaveParty={() => undefined}
      onFind={o.onFind ?? (() => undefined)}
      onCustom={o.onCustom ?? (() => undefined)}
      onTutorial={() => undefined}
      onClose={() => undefined}
    />,
  );
}

describe('The Ring: choosing a fight', () => {
  afterEach(cleanup);

  it('keeps every dialog over the Ring clear of a phone’s island and notch, on every side', () => {
    const wrap = rule('.rb-ring-dialog-wrap');
    for (const side of ['--sa-t', '--sa-r', '--sa-b', '--sa-l']) expect(wrap).toContain(side);
    expect(rule('.rb-ring-dialog.rb-ringvl-play')).toContain('--sa-b');
  });

  it('says it is ranked, with an invite in each teammate’s place, and a custom game beside the ranked match', () => {
    const invite = vi.fn();
    const custom = vi.fn();
    layer({ onInvite: invite, onCustom: custom });
    expect(screen.getByText('Ranked')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Find a ranked 2v2 match' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Invite a friend' }));
    expect(invite).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Custom game' }));
    expect(custom).toHaveBeenCalled();
    // (the old "With friends" is the custom game now)
    expect(screen.queryByText('With friends')).toBeNull();
    // and how ranked is kept fair is a press away
    fireEvent.click(screen.getByRole('button', { name: 'Fair play' }));
    expect(screen.getByRole('dialog', { name: 'Fair play in ranked' }).textContent).toMatch(/friend/);
  });

  it('a guest plays for a practice rating, and is offered ranked by signing in; no invites without an account', () => {
    layer({ ladder: 'guest' });
    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in for ranked' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Invite a friend' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Find a 2v2 match' })).toBeTruthy();
  });

  it('in a party: the friend takes a place, 1v1 is shut, and only the leader starts the search', () => {
    const find = vi.fn();
    const party: PartyShown = {
      code: 'PARTY',
      leader: false,
      connecting: false,
      members: [
        { n: 2, name: 'Me', cls: 'warrior', bar: [...bar], rating: 1555, you: true, online: true },
        { n: 1, name: 'Ana', cls: 'priest', bar: [...PRESETS.priest[0]!.bar], rating: 1500, you: false, online: true },
      ],
    };
    layer({ party, onFind: find });
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('PARTY')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /1v1/ }).getAttribute('aria-disabled')).toBe('true');
    const go = screen.getByRole('button', { name: 'The party leader starts the search' });
    expect(go.getAttribute('aria-disabled')).toBe('true');
    // (a 2v2 with a friend in it has no place left for the computer, nor an invite)
    expect(screen.queryByRole('button', { name: 'Invite a friend' })).toBeNull();
  });

  it('warns a party too far apart to count', () => {
    const party: PartyShown = {
      code: 'PARTY',
      leader: true,
      connecting: false,
      members: [
        { n: 1, name: 'Me', cls: 'warrior', bar: [...bar], rating: 1555, you: true, online: true },
        { n: 2, name: 'Bo', cls: 'mage', bar: [...PRESETS.mage[0]!.bar], rating: 500, you: false, online: true },
      ],
    };
    layer({ party, format: 3 });
    expect(screen.getByText(/more than 500 apart/)).toBeTruthy();
  });
});
