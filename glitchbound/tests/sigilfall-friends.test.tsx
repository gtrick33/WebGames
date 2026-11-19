/**
 * Friends inside Sigilfall (ui/Friends.tsx, the engine's friends methods, platform/friends.ts): the player's
 * GlitchBound friends in the party panel with who is online, a button to ask each into the party, adding a friend by
 * their code (onto that same list), and an invitation that arrives as a card over the game with Join and Not now.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/games/sigilfall/ui/uiIcons', () => ({ uiIcon: () => '' }));
import type { FriendInvite, FriendRow, FriendsView, Me } from '../src/platform/apiTypes';
import { byPresence, claimInvites, invitesClaimed } from '../src/platform/friends';
import { SigilEngine } from '../src/games/sigilfall/engine';
import { friendStatus, FriendsSection, InviteCards } from '../src/games/sigilfall/ui/Friends';
import { PartyPanel } from '../src/games/sigilfall/ui/Party';
import { readyHero } from './sigilfall-bot';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const member = (): Me => ({ id: 'me', nickname: 'Cal', email: 'cal@example.com', avatar: '', isAdmin: false, role: null, xp: 0, level: 1, levelFloor: 0, levelNext: 100, notify: false, favorites: [], bests: {}, rounds: 0, streak: 0, dailyDays: [], badges: [], quests: [], questDay: '', joinedAt: 0 }) as Me;
const friend = (id: string, nickname: string, over: Partial<FriendRow> = {}): FriendRow => ({ id, nickname, level: 12, points: 0, rank: 'Newcomer', lastGame: null, lastAt: null, online: false, onlineIn: null, border: '', banner: '', icon: '', ...over }) as FriendRow;
const NOW = Date.UTC(2026, 10, 12, 12);
const FRIENDS = [
  friend('z', 'Zed', { lastGame: 'sigilfall', lastAt: NOW - 3 * 3_600_000 }),
  friend('m', 'Mara', { online: true, onlineIn: 'sigilfall' }),
  friend('a', 'Ann', { online: true }),
  friend('b', 'Bo'),
];
const view = (friends = FRIENDS): FriendsView => ({ code: 'ABCD2345', friends, blocked: [] });

async function signedIn(me: Me | null): Promise<void> {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: me }))));
  const { account } = await import('../src/platform/account');
  await act(async () => {
    if (me) await account.signedIn(me);
    else await account.signOut().catch(() => undefined);
  });
}

/** The engine as the friends list needs it. */
function fakeEngine(over: Record<string, unknown> = {}) {
  const e = {
    hero: readyHero('mage', 8),
    party: null as unknown,
    friends: { view: view(), state: 'ready', asked: {} as Record<string, number> },
    invites: [] as FriendInvite[],
    ui: { screen: 'game' },
    refreshFriends: vi.fn(async () => undefined),
    inviteFriend: vi.fn(async () => undefined),
    addFriend: vi.fn(async () => ''),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    ...over,
  };
  return e as typeof e & SigilEngine;
}

describe('Sigilfall’s friends list', () => {
  it('sorts whoever is in Sigilfall first, then whoever is online, then the rest by name', () => {
    expect(byPresence(FRIENDS, 'sigilfall').map((f) => f.nickname)).toEqual(['Mara', 'Ann', 'Bo', 'Zed']);
    expect(friendStatus(FRIENDS[1]!, NOW)).toBe('In Sigilfall');
    expect(friendStatus(FRIENDS[2]!, NOW)).toBe('Online');
    expect(friendStatus(FRIENDS[0]!, NOW)).toBe('Offline · played Sigilfall 3 h ago');
    expect(friendStatus(FRIENDS[3]!, NOW)).toBe('Offline');
  });

  it('shows the player’s GlitchBound friends with who is online, and asks one into the party at a tap', async () => {
    await signedIn(member());
    const engine = fakeEngine();
    render(<FriendsSection engine={engine} />);
    // asked for as the panel opens
    expect(engine.refreshFriends).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Friends/ }).textContent).toContain('2 of 4 online');
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((r) => within(r).getByText(/Mara|Ann|Bo|Zed/).textContent)).toEqual(['Mara', 'Ann', 'Bo', 'Zed']);
    expect(rows[0]!.className).toBe('is-here');
    expect(rows[0]!.textContent).toContain('Level 12 · In Sigilfall');
    expect(rows[1]!.className).toBe('is-online');
    expect(rows[2]!.className).toBe('is-offline');
    fireEvent.click(screen.getByRole('button', { name: 'Invite Mara to your party' }));
    expect(engine.inviteFriend).toHaveBeenCalledWith('m');
    // with no party yet, it says what inviting does
    expect(screen.getByText('Inviting a friend opens a questing party for the two of you.')).toBeTruthy();
    // the player's own code, to give to a friend
    expect(screen.getByText('ABCD2345')).toBeTruthy();
  });

  it('says a friend was invited, and stops asking when the party is full', async () => {
    await signedIn(member());
    const asked = fakeEngine({ friends: { view: view(), state: 'ready', asked: { m: Date.now() } } });
    render(<FriendsSection engine={asked} />);
    const mara = screen.getByRole('button', { name: 'Mara was invited' }) as HTMLButtonElement;
    expect(mara.disabled).toBe(true);
    expect(mara.textContent).toBe('Invited');
    expect((screen.getByRole('button', { name: 'Invite Ann to your party' }) as HTMLButtonElement).disabled).toBe(false);
    cleanup();
    const full = fakeEngine({ party: { link: { code: 'ABCDE' }, view: { seats: [1, 2, 3, 4] } } });
    render(<FriendsSection engine={full} />);
    for (const b of screen.getAllByRole('button', { name: /^Invite / })) expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds a friend by their code, onto the same list, and says what went wrong in plain words', async () => {
    await signedIn(member());
    const engine = fakeEngine();
    engine.addFriend = vi.fn(async (code: string) => {
      if (code === 'NOPE2222') return 'That code doesn’t work. Check it with your friend.';
      engine.friends = { ...engine.friends, view: view([...FRIENDS, friend('n', 'Nyx')]) };
      return '';
    }) as never;
    render(<FriendsSection engine={engine} />);
    const input = screen.getByLabelText('Add a friend by their code') as HTMLInputElement;
    const add = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    // typed any way it was written down: it is tidied as a code is
    fireEvent.change(input, { target: { value: 'nope-2222' } });
    expect(input.value).toBe('NOPE2222');
    await act(async () => {
      fireEvent.click(add);
    });
    expect(screen.getByRole('status').textContent).toBe('That code doesn’t work. Check it with your friend.');
    fireEvent.change(input, { target: { value: 'wxyz2345' } });
    await act(async () => {
      fireEvent.click(add);
    });
    expect(engine.addFriend).toHaveBeenLastCalledWith('WXYZ2345');
    expect(screen.getByRole('status').textContent).toBe('Nyx is on your friends list.');
    expect(input.value).toBe('');
  });

  it('asks a guest to sign in, and sits in the party panel beside the party', async () => {
    await signedIn(null);
    const engine = fakeEngine({ partyReady: () => '', createParty: vi.fn(), closePanel: () => undefined, joinParty: () => undefined, partyLeft: null });
    render(<PartyPanel engine={engine} />);
    const panel = screen.getByRole('dialog', { name: 'Play together' });
    expect(within(panel).getByRole('heading', { name: 'Friends' })).toBeTruthy();
    expect(within(panel).getByText(/Sign in to see your GlitchBound friends here/)).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(engine.refreshFriends).not.toHaveBeenCalled();
    // the party's own side is as it was
    expect(within(panel).getByRole('button', { name: 'Start a questing party' })).toBeTruthy();
  });
});

describe('an invitation, as it arrives', () => {
  const inv = (id: number, from: string): FriendInvite => ({ id, game: 'sigilfall', from, href: '/sigilfall?room=FGHIJ', code: 'FGHIJ' });

  it('is a card with the friend’s name, Join and Not now, wherever the player is', () => {
    const engine = fakeEngine({ invites: [inv(7, 'Mara'), inv(8, 'Ann')] });
    render(<InviteCards engine={engine} />);
    const card = screen.getByRole('alertdialog', { name: 'Mara invites you to their party' });
    expect(card.textContent).toContain('1 more');
    fireEvent.click(within(card).getByRole('button', { name: 'Join' }));
    expect(engine.acceptInvite).toHaveBeenCalledWith(7);
    fireEvent.click(within(card).getByRole('button', { name: 'Not now' }));
    expect(engine.declineInvite).toHaveBeenCalledWith(7);
    cleanup();
    // on the hero list it says what joining will take
    render(<InviteCards engine={fakeEngine({ invites: [inv(7, 'Mara')], hero: null, ui: { screen: 'title' } })} />);
    expect(screen.getByText('Choose a hero, or make one, and you’ll join them.')).toBeTruthy();
    cleanup();
    // in a party with others, it says what joining costs
    render(<InviteCards engine={fakeEngine({ invites: [inv(7, 'Mara')], party: { link: { code: 'ABCDE' }, view: { seats: [1, 2] } } })} />);
    expect(screen.getByText('Joining leaves the party you’re in.')).toBeTruthy();
    cleanup();
    render(<InviteCards engine={fakeEngine()} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('in the Ring, an invitation into the party the player is already in (or from someone in it) is not shown', () => {
    const ring = (id: number, from: string, code: string): FriendInvite => ({ id, game: 'sigilfall-ring', from, href: `/sigilfall?ring=${code}`, code });
    const engine = fakeEngine({ invites: [ring(7, 'Mara', 'PARTY'), ring(8, 'Ann', 'OTHER')] });
    render(<InviteCards engine={engine} only="sigilfall-ring" hide={(i) => i.code === 'PARTY' || i.from === 'Ann'} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    cleanup();
    render(<InviteCards engine={engine} only="sigilfall-ring" hide={(i) => i.code === 'PARTY'} />);
    expect(screen.getByRole('alertdialog', { name: 'Ann invites you to team up in the Ring' })).toBeTruthy();
  });
});

describe('the engine’s side of friends', () => {
  /** The engine's own methods, run on a stand-in for the rest of it. */
  function host(over: Record<string, unknown> = {}) {
    const calls: string[] = [];
    const h = {
      hidden: false,
      hero: readyHero('mage', 8),
      ui: { screen: 'game', panel: null as string | null },
      party: null as null | { link: { code: string } },
      invite: '',
      invites: [] as FriendInvite[],
      inviteDone: new Set<number>(),
      friends: { view: null as FriendsView | null, state: 'idle', asked: {} as Record<string, number> },
      sound: { play: (s: string) => calls.push(`sound:${s}`) },
      bump: () => calls.push('bump'),
      toast: (t: string) => calls.push(`toast:${t}`),
      joinParty: (c: string) => calls.push(`join:${c}`),
      openPanel: (p: string) => calls.push(`panel:${p}`),
      createParty: async (m: string) => {
        calls.push(`create:${m}`);
        h.party = { link: { code: 'PARTY' } };
      },
      calls,
      ...over,
    };
    const P = SigilEngine.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const m of ['checkSocial', 'refreshFriends', 'addFriend', 'inviteFriend', 'acceptInvite', 'declineInvite', 'answerInvite']) (h as Record<string, unknown>)[m] = (...a: unknown[]) => P[m]!.apply(h, a);
    return h as typeof h & Record<'checkSocial' | 'refreshFriends' | 'addFriend' | 'inviteFriend' | 'acceptInvite' | 'declineInvite', (...a: unknown[]) => Promise<unknown>>;
  }
  /** The site, answering the friends requests; keeps what was asked. */
  function api(answer: (url: string, body: Record<string, unknown> | null) => unknown) {
    const asked: { url: string; body: Record<string, unknown> | null }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
        if (String(url).includes('/api/friends')) asked.push({ url: String(url), body });
        const out = answer(String(url), body);
        return out instanceof Response ? out : new Response(JSON.stringify(out));
      }),
    );
    return asked;
  }
  const inv: FriendInvite = { id: 7, game: 'sigilfall', from: 'Mara', href: '/sigilfall?room=FGHIJ', code: 'FGHIJ' };

  it('asks for invitations from inside Sigilfall, rings once for a new one, and asks nothing for a guest or a hidden tab', async () => {
    await signedIn(member());
    const asked = api(() => ({ invites: [inv, { ...inv, id: 9, game: 'other-game' }] }));
    const h = host();
    await h.checkSocial();
    // from inside the game: that is what tells friends the player is in Sigilfall
    expect(asked[0]!.url).toContain('/api/friends/invites?in=sigilfall');
    expect(h.invites).toEqual([inv]);
    expect(h.calls).toEqual(['sound:quest', 'bump']);
    // the same invitation again: no second ring
    h.calls.length = 0;
    await h.checkSocial();
    expect(h.calls).toEqual([]);
    // a hidden tab asks nothing (so its player goes offline to friends)
    const before = asked.length;
    h.hidden = true;
    await h.checkSocial();
    expect(asked.length).toBe(before);
    // a guest has no friends to hear from, and what was showing goes
    await signedIn(null);
    api(() => ({ invites: [inv] }));
    h.hidden = false;
    await h.checkSocial();
    expect(h.invites).toEqual([]);
  });

  it('joins a friend’s party at once from the world, and from the hero list once a hero is chosen', async () => {
    await signedIn(member());
    const asked = api(() => ({ ok: true }));
    const h = host({ invites: [inv] });
    await h.acceptInvite(7);
    expect(h.calls).toEqual(expect.arrayContaining(['join:FGHIJ', 'panel:party']));
    expect(h.invites).toEqual([]);
    // the invitation is used up on the site too
    expect(asked.find((a) => a.url.endsWith('/api/friends/invites'))!.body).toEqual({ id: 7 });
    // on the hero list there is no hero to join with yet: it waits, as an invitation by link does
    const t = host({ invites: [inv], hero: null, ui: { screen: 'title', panel: null } });
    await t.acceptInvite(7);
    expect(t.invite).toBe('FGHIJ');
    expect(t.calls).not.toContain('join:FGHIJ');
    // turned down: it goes, nothing is joined, and it doesn't come back with the next ask
    const d = host({ invites: [inv] });
    await d.declineInvite(7);
    expect(d.invites).toEqual([]);
    expect(d.calls).not.toContain('join:FGHIJ');
    api(() => ({ invites: [inv] }));
    await d.checkSocial();
    expect(d.invites).toEqual([]);
  });

  it('invites a friend into the party, opening a questing party first when there is none', async () => {
    await signedIn(member());
    const asked = api(() => ({ ok: true }));
    const h = host();
    await h.inviteFriend('m');
    expect(h.calls).toContain('create:party');
    expect(asked.at(-1)).toEqual({ url: expect.stringContaining('/api/friends'), body: { action: 'invite', id: 'm', game: 'sigilfall', code: 'PARTY' } });
    expect(h.friends.asked.m).toBeGreaterThan(0);
    // already in a party: that party's code, no new one
    const p = host({ party: { link: { code: 'MINEE' } } });
    await p.inviteFriend('a');
    expect(p.calls).not.toContain('create:party');
    expect(asked.at(-1)!.body).toMatchObject({ code: 'MINEE', id: 'a' });
    // it didn't go out: the row is free to try again, and the player is told
    api(() => new Response(JSON.stringify({ error: 'not_friends' }), { status: 403 }));
    const f = host({ party: { link: { code: 'MINEE' } } });
    await f.inviteFriend('z');
    expect(f.friends.asked.z).toBeUndefined();
    expect(f.calls.some((c) => c.startsWith('toast:'))).toBe(true);
  });

  it('adds a friend to the GlitchBound list by code, and puts the site’s reasons into words', async () => {
    await signedIn(member());
    const asked = api((_url, body) => (body?.code === 'GOOD2345' ? view([friend('n', 'Nyx')]) : new Response(JSON.stringify({ error: body?.code === 'MINE2345' ? 'own_code' : 'unknown_code' }), { status: 404 })));
    const h = host();
    expect(await h.addFriend('GOOD2345')).toBe('');
    expect(asked.at(-1)!.body).toEqual({ action: 'add', code: 'GOOD2345' });
    expect(h.friends.view!.friends.map((f) => f.nickname)).toEqual(['Nyx']);
    expect(await h.addFriend('MINE2345')).toBe('That’s your own code.');
    expect(await h.addFriend('NOPE2345')).toBe('That code doesn’t work. Check it with your friend.');
  });
});

describe('one place asks, not two', () => {
  it('the site’s invitation bar leaves Sigilfall’s invitations to the game while it is open', async () => {
    await signedIn(member());
    const invites: FriendInvite[] = [{ id: 7, game: 'sigilfall', from: 'Mara', href: '/sigilfall?room=FGHIJ', code: 'FGHIJ' }];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ invites }))));
    const { FriendInvites } = await import('../src/components/FriendInvites');
    await act(async () => {
      render(<FriendInvites />);
    });
    expect(screen.getByRole('status').textContent).toContain('Mara');
    // the game opens: its own card asks
    let release: () => void = () => undefined;
    act(() => {
      release = claimInvites('sigilfall');
    });
    expect(invitesClaimed('sigilfall')).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
    // the game closes: the bar asks again
    act(() => release());
    expect(invitesClaimed('sigilfall')).toBe(false);
    expect(screen.getByRole('status').textContent).toContain('Mara');
  });
});
