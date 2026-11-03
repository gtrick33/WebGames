/**
 * Sigilfall co-op follow-ups: the party's leader changes heroes in the lobby without losing the party (and the
 * others see it), and story scenes in a party play for the leader only while the others play on.
 */
import { describe, expect, it, vi } from 'vitest';
import { SigilEngine } from '../src/games/sigilfall/engine';
import { CoopSession } from '../src/games/sigilfall/net/coop';
import * as room from '../src/games/sigilfall/net/room';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { scenesPlayHere } from '../src/games/sigilfall/sim/scene';
import { World } from '../src/games/sigilfall/sim/world';
import { readyHero } from './sigilfall-bot';

const KEY_A = 'host-key-aaaaaaaaaaaaaaaa';
const KEY_B = 'guest-key-bbbbbbbbbbbbbbbb';
const T = 1_800_000_000_000;
const card = (name: string, cls: string, level = 20): room.Card => ({ name, cls, level, para: 0, keystone: 0, story: 10, look: { any: true }, weapon: { kind: 'staff' } });
const engine = SigilEngine.prototype as unknown as Record<string, (this: unknown, ...a: unknown[]) => unknown>;

describe('sigilfall: the party leader changes heroes in the lobby', () => {
  it('keeps the seat and the lead; the party shows them choosing, then the new hero', () => {
    const s = room.newRoom('ABCDE', T, 1);
    room.join(s, KEY_A, 'Ash', T);
    room.join(s, KEY_B, 'Bea', T);
    expect(room.act(s, KEY_A, { t: 'card', card: card('Ash', 'warrior') }, T)).toBeNull();
    expect(room.act(s, KEY_B, { t: 'card', card: card('Bea', 'mage') }, T)).toBeNull();
    const host = s.host;
    expect(room.act(s, KEY_A, { t: 'nocard' }, T)).toBeNull();
    expect(s.host).toBe(host);
    expect(s.seats).toHaveLength(2);
    expect(room.viewFor(s, KEY_B)!.seats.find((x) => x.n === host)!.card).toBeNull();
    // nobody can start while the leader is choosing
    expect(room.act(s, KEY_A, { t: 'mode', mode: 'party' }, T)).toBeNull();
    expect(room.act(s, KEY_A, { t: 'start', week: 1 }, T)).toBe('no_hero');
    expect(room.act(s, KEY_A, { t: 'card', card: card('Cyra', 'ranger', 35) }, T)).toBeNull();
    expect(room.viewFor(s, KEY_B)!.seats.find((x) => x.n === host)!.card).toMatchObject({ name: 'Cyra', cls: 'ranger' });
    expect(room.act(s, KEY_A, { t: 'start', week: 1 }, T)).toBeNull();
    // mid-run the hero stays on everyone's screens
    expect(room.act(s, KEY_A, { t: 'nocard' }, T)).toBe('not_lobby');
  });

  it('back to the hero list in the lobby tells the room, without leaving; during a run it leaves as before', () => {
    const send = vi.fn();
    const leaveParty = vi.fn();
    const lobby = { party: { view: { phase: 'lobby' }, link: { open: true, send } }, coop: null, cardSent: 'old', leaveParty, bump: vi.fn() };
    engine.standDownFromParty!.call(lobby);
    expect(send).toHaveBeenCalledWith({ t: 'nocard' });
    expect(leaveParty).not.toHaveBeenCalled();
    expect(lobby.cardSent).toBe('');
    engine.standDownFromParty!.call({ ...lobby, party: { ...lobby.party, view: { phase: 'run' } } });
    expect(leaveParty).toHaveBeenCalledTimes(1);
  });

  it('the others are told: choosing another hero, then who they play now', () => {
    const partyNote = vi.fn();
    const seat = (n: number, you: boolean, c: room.Card | null) => ({ n, name: n === 1 ? 'Ash' : 'Bea', online: true, you, host: n === 1, card: c });
    const view = (c: room.Card | null) => ({ phase: 'lobby', you: 2, host: 1, lead: 0, run: 0, seats: [seat(1, false, c), seat(2, true, card('Bea', 'mage'))] });
    const note = (a: unknown, b: unknown): void => void engine.noteChanges!.call({ partyNote }, a, b);
    note(view(card('Ash', 'warrior')), view(null));
    expect(partyNote).toHaveBeenLastCalledWith('Ash is choosing another hero', 'info');
    note(view(null), view(card('Cyra', 'ranger', 35)));
    expect(partyNote).toHaveBeenLastCalledWith('Ash now plays Cyra, level 35 Ranger', 'info');
    partyNote.mockClear();
    // a level up is not a new hero
    note(view(card('Cyra', 'ranger', 35)), view(card('Cyra', 'ranger', 36)));
    expect(partyNote).not.toHaveBeenCalled();
  });
});

describe('sigilfall: story scenes in a party', () => {
  it('play alone as before, for a questing party’s leader only, and never on a party’s Riftstone clock', () => {
    expect(scenesPlayHere({ coop: null, keyRun: null })).toBe(true);
    expect(scenesPlayHere({ coop: null, keyRun: {} as never })).toBe(true);
    expect(scenesPlayHere({ coop: { role: 'host', ghosts: [], out: [] }, keyRun: null })).toBe(true);
    expect(scenesPlayHere({ coop: { role: 'guest', ghosts: [], out: [] }, keyRun: null })).toBe(false);
    expect(scenesPlayHere({ coop: { role: 'host', ghosts: [], out: [] }, keyRun: {} as never })).toBe(false);
  });

  it('the others hear that the leader is watching one, are told once, and their game never pauses', () => {
    const make = (coop: 'host' | 'guest') => new World({ region: 'emberwick', tier: 0, mods: [], hero: readyHero(coop === 'host' ? 'warrior' : 'mage', 20), settings: { ...DEFAULT_SETTINGS }, seed: 7, handIns: false, coop });
    const hw = make('host');
    const gw = make('guest');
    const queue: unknown[] = [];
    const hs = new CoopSession('host', 1, 1, (d) => queue.push(JSON.parse(JSON.stringify(d))));
    const gs = new CoopSession('guest', 2, 1, () => undefined);
    const members = [
      { n: 1, card: card('Ash', 'warrior') },
      { n: 2, card: card('Bea', 'mage') },
    ];
    hs.setMembers(members);
    gs.setMembers(members);
    hs.attach(hw);
    gs.attach(gw);
    const deliver = (): void => {
      hs.frame(200);
      while (queue.length) gs.receive(1, queue.shift());
    };
    deliver();
    expect(gs.leaderScene).toBe(false);
    hw.scene = { def: { id: 'test', region: 'emberwick', steps: [] }, step: 0, t: 0, begun: false, focus: null, emotes: [] } as never;
    deliver();
    expect(gs.leaderScene).toBe(true);
    // the guest's game: told once, and it plays on (its world starts no scene of its own)
    const partyNote = vi.fn();
    const guestEngine = { coop: gs, leaderWatching: false, partyNote };
    engine.noteLeaderScene!.call(guestEngine);
    engine.noteLeaderScene!.call(guestEngine);
    expect(partyNote).toHaveBeenCalledTimes(1);
    expect(partyNote).toHaveBeenCalledWith('The leader is watching a scene', 'info');
    gw.step(1 / 60);
    expect(gw.scene).toBeNull();
    hw.scene = null;
    deliver();
    expect(gs.leaderScene).toBe(false);
    engine.noteLeaderScene!.call(guestEngine);
    expect(guestEngine.leaderWatching).toBe(false);
  });
});
