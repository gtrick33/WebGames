/**
 * Admin › Ads & shop: giving things to players and the sales. A player is picked from a list (the members seen last, or
 * those whose nickname or email has the letters typed), never typed out; the sales are searched and paged on the
 * server, ten at first; and a Sigilfall title is given by its words, with every light shown on them to choose from.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as membersGet } from '../functions/api/admin/members';
import { onRequestGet as shopGet, onRequestPost as shopPost } from '../functions/api/admin/shop';
import type { Env } from '../server/http';
import { findMembers } from '../server/members';
import { ownedBy, SALES_MAX, shopReport } from '../server/shop';
import { signIn } from '../server/signin';
import { PRODUCTS } from '../src/catalog/shop';
import { TITLE_FX } from '../src/catalog/titleFx';
import type { AdminCatalog, AdminMember, ShopReport, ShopSale } from '../src/platform/apiTypes';
import { memoryD1 } from './d1';

const ORIGIN = 'http://localhost';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ the server */

async function setup() {
  const db = memoryD1();
  const env: Env = { DB: db, NR_DB: {} as Env['NR_DB'], ADMIN_EMAILS: 'boss@example.com' };
  const member = async (name: string, lastSeen: number) => {
    const { user, cookie } = await signIn(env, new Request(ORIGIN), { sub: `dev:${name}`, email: `${name.toLowerCase()}@example.com`, name, givenName: '', picture: '', provider: 'email' });
    db.sqlite.prepare('UPDATE users SET nickname = ?, last_seen = ? WHERE id = ?').run(name, lastSeen, user.id);
    return { id: user.id, jar: cookie.split(';')[0]! };
  };
  const boss = await member('Boss', 50);
  const ada = await member('Ada', 400);
  const adam = await member('Adam', 300);
  const under = await member('a_b', 200);
  const axb = await member('axb', 100);
  const get = (path: string, jar = boss.jar): Promise<Response> => (path.startsWith('/api/admin/members') ? membersGet : shopGet)({ request: new Request(`${ORIGIN}${path}`, { headers: { cookie: jar } }), env });
  const post = (body: unknown, jar = boss.jar): Promise<Response> =>
    shopPost({ request: new Request(`${ORIGIN}/api/admin/shop`, { method: 'POST', headers: { origin: ORIGIN, cookie: jar, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env });
  return { db, env, boss, ada, adam, under, axb, get, post };
}

describe('finding a member to give to', () => {
  it('offers the members seen last before anything is typed', async () => {
    const { env } = await setup();
    expect((await findMembers(env, '')).map((m) => m.nickname)).toEqual(['Ada', 'Adam', 'a_b', 'axb', 'Boss']);
    expect(await findMembers(env, '', 2)).toHaveLength(2);
    // never more than 20
    expect((await findMembers(env, '', 500)).length).toBeLessThanOrEqual(20);
  });

  it('finds by nickname, email or id, the exact one first, and takes % and _ as letters', async () => {
    const { env, ada, under } = await setup();
    expect((await findMembers(env, 'ada')).map((m) => m.nickname)).toEqual(['Ada', 'Adam']);
    expect((await findMembers(env, 'ADAM')).map((m) => m.nickname)).toEqual(['Adam']);
    // Adam was seen after a_b, but a name that starts with what's typed comes before one that only has it
    expect((await findMembers(env, 'a')).map((m) => m.nickname).slice(0, 4)).toEqual(['Ada', 'Adam', 'a_b', 'axb']);
    expect((await findMembers(env, 'adam@example')).map((m) => m.nickname)).toEqual(['Adam']);
    expect((await findMembers(env, ada.id)).map((m) => m.id)).toEqual([ada.id]);
    expect((await findMembers(env, '_')).map((m) => m.id)).toEqual([under.id]);
    expect((await findMembers(env, 'a_')).map((m) => m.id)).toEqual([under.id]);
    expect(await findMembers(env, '%')).toEqual([]);
    expect(await findMembers(env, '\\')).toEqual([]);
    expect(await findMembers(env, 'nobody')).toEqual([]);
  });

  it('is for admins only, and answers with nickname, email and when they were last seen', async () => {
    const { ada, get } = await setup();
    const { members } = (await (await get('/api/admin/members?q=ada')).json()) as { members: AdminMember[] };
    expect(members[0]).toEqual({ id: ada.id, nickname: 'Ada', email: 'ada@example.com', lastSeen: 400 });
    expect((await get('/api/admin/members?q=ada', ada.jar)).status).toBe(403);
    expect((await get('/api/admin/members?q=ada', '')).status).toBe(401);
  });
});

describe('giving an item', () => {
  it('goes to the member picked, by id, and still to one named by nickname', async () => {
    const { env, ada, adam, post, db } = await setup();
    const res = await post({ action: 'gift', userId: ada.id, product: 'border-glitch' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, nickname: 'Ada' });
    expect(await ownedBy(env, ada.id)).toEqual(['border-glitch']);
    expect((await post({ action: 'gift', nickname: 'adam', product: 'ad-free' })).status).toBe(200);
    expect(await ownedBy(env, adam.id)).toEqual(['ad-free']);
    expect((await post({ action: 'gift', userId: 'gone', product: 'ad-free' })).status).toBe(404);
    expect((await post({ action: 'gift', userId: ada.id, product: 'nothing-like-it' })).status).toBe(404);
    expect((await post({ action: 'gift', userId: ada.id, product: 'ad-free' }, ada.jar)).status).toBe(403);
    expect((db.sqlite.prepare("SELECT detail FROM admin_log WHERE action = 'shop' ORDER BY rowid").all() as { detail: string }[]).map((r) => r.detail)).toEqual([
      'Gave Glitch border to Ada',
      'Gave Ad-free to Adam',
    ]);
  });
});

describe('the sales', () => {
  /** 30 paid purchases, a minute apart, spread over three members and two items; one still at checkout; one refunded. */
  async function withSales() {
    const s = await setup();
    const buyers = [s.ada.id, s.adam.id, s.under.id];
    for (let i = 0; i < 30; i++) {
      s.db.sqlite
        .prepare("INSERT INTO purchases (id, user_id, product, status, agreed_at, terms, created_at, paid_at, provider_ref, amount, currency) VALUES (?, ?, ?, 'paid', 1, 't', ?, ?, ?, 199, 'eur')")
        .run(`sale${String(i).padStart(2, '0')}xyz`, buyers[i % 3]!, i % 2 ? 'border-glitch' : 'ad-free', 60_000 * i, 60_000 * i, `pi_${i}`);
    }
    s.db.sqlite.prepare("INSERT INTO purchases (id, user_id, product, status, agreed_at, terms, created_at, provider_ref) VALUES ('waiting', ?, 'ad-free', 'pending', 1, 't', 99999999, 'pending:w')").run(s.ada.id);
    s.db.sqlite.prepare("UPDATE purchases SET status = 'refunded' WHERE id = 'sale00xyz'").run();
    return s;
  }
  const ids = (r: { recent: ShopSale[] }): string[] => r.recent.map((x) => x.id);

  it('come ten at a time, newest first, with how many there are, never checkouts left open', async () => {
    const { env } = await withSales();
    const first = await shopReport(env);
    expect(first.total).toBe(30);
    expect(ids(first)).toEqual(Array.from({ length: 10 }, (_, i) => `sale${29 - i}xyz`));
    expect(first.recent[0]).toMatchObject({ nickname: 'a_b', email: 'a_b@example.com', product: 'border-glitch', gift: false });
    const next = await shopReport(env, { offset: 10, limit: 10 });
    expect(ids(next)[0]).toBe('sale19xyz');
    expect(ids(next).some((id) => ids(first).includes(id))).toBe(false);
    expect((await shopReport(env, { offset: 25, limit: 10 })).recent).toHaveLength(5);
    // a sane page, whatever is asked
    expect((await shopReport(env, { limit: 100_000 })).limit).toBe(SALES_MAX);
    expect((await shopReport(env, { limit: -4, offset: -9 })).recent).toHaveLength(1);
    expect((await shopReport(env, { limit: Number.NaN, offset: Number.NaN })).recent).toHaveLength(10);
    // the sales by item are of every sale, whatever the page
    expect(first.items.find((i) => i.product === 'ad-free')).toMatchObject({ paid: 14, refunded: 1 });
  });

  it('are found on the server by nickname, email, item name or id, and purchase id, any case', async () => {
    const { env } = await withSales();
    const find = (q: string, limit = 100) => shopReport(env, { q, limit });
    expect((await find('ADAM')).total).toBe(10);
    expect((await find('a_b@example')).total).toBe(10);
    expect((await find('glitch border')).total).toBe(15);
    expect((await find('Glitch')).total).toBe(15);
    expect((await find('ad-free')).total).toBe(15);
    expect(ids(await find('sale07'))).toEqual(['sale07xyz']);
    expect(ids(await find('pi_12'))).toEqual(['sale12xyz']);
    // what LIKE would take as "anything" is a letter here
    expect((await find('%')).total).toBe(0);
    expect((await find('a_b')).total).toBe(10);
    // and the search pages like the whole list
    const page = await shopReport(env, { q: 'ada', offset: 0, limit: 3 });
    expect(page).toMatchObject({ total: 20, offset: 0, limit: 3 });
    expect(page.recent.every((r) => r.nickname === 'Ada' || r.nickname === 'Adam')).toBe(true);
  });

  it('answer the admin page’s question, admins only', async () => {
    const { ada, get } = await withSales();
    expect((await get('/api/admin/shop', ada.jar)).status).toBe(403);
    const r = (await (await get('/api/admin/shop?q=adam&offset=5&limit=3')).json()) as ShopReport;
    expect(r).toMatchObject({ total: 10, offset: 5, limit: 3 });
    expect(r.recent).toHaveLength(3);
    expect(((await (await get('/api/admin/shop')).json()) as ShopReport).recent).toHaveLength(10);
  });
});

/* ------------------------------------------------------------------ the page */

const MEMBERS: AdminMember[] = [
  { id: 'u-ada', nickname: 'Ada', email: 'ada@example.com', lastSeen: Date.now() - 5 * 60_000 },
  { id: 'u-bo', nickname: 'Bo', email: 'bo@example.com', lastSeen: Date.now() - 3 * 86400_000 },
];
const SALES: ShopSale[] = Array.from({ length: 25 }, (_, i) => ({
  id: `p${String(i).padStart(3, '0')}abcdef`,
  product: i % 2 ? 'border-glitch' : 'ad-free',
  status: 'paid',
  amount: 199,
  currency: 'eur',
  at: 1_800_000_000_000 - i * 60_000,
  nickname: i % 2 ? 'Bo' : 'Ada',
  email: i % 2 ? 'bo@example.com' : 'ada@example.com',
  gift: false,
}));

/** The admin API, answering as the server would, with each request kept. */
function fakeApi() {
  const calls: { url: string; body?: Record<string, unknown> }[] = [];
  const reply = (data: unknown): Response => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      calls.push({ url, body });
      const u = new URL(url, ORIGIN);
      const q = (u.searchParams.get('q') ?? '').toLowerCase();
      if (u.pathname === '/api/admin/members') return reply({ members: MEMBERS.filter((m) => !q || m.nickname.toLowerCase().includes(q) || m.email.includes(q)) });
      if (u.pathname === '/api/admin/shop' && !body) {
        const found = SALES.filter((s) => !q || s.nickname!.toLowerCase().includes(q));
        const offset = Number(u.searchParams.get('offset'));
        const limit = Number(u.searchParams.get('limit'));
        return reply({ items: [{ product: 'ad-free', paid: 13, refunded: 0, gifted: 0, cents: 2587, currency: 'eur' }], recent: found.slice(offset, offset + limit), total: found.length, offset, limit });
      }
      if (u.pathname === '/api/admin/sigilfall/titles' && !body) return reply({ titles: [] });
      if (u.pathname === '/api/admin/staff') return reply({ staff: [], sent: true });
      if (u.pathname === '/api/admin/qa-audit') return reply({ rows: [], more: false });
      return reply({ ok: true });
    }),
  );
  return calls;
}

async function openPage() {
  const calls = fakeApi();
  const { MoneySection } = await import('../src/pages/admin/MoneySection');
  render(<MoneySection data={{ shopItems: PRODUCTS } as unknown as AdminCatalog} send={vi.fn(async () => true)} busy={false} />);
  return { calls, gifts: screen.getByRole('region', { name: 'Give to a player' }), sales: screen.getByRole('region', { name: 'Sales' }) };
}

/** Picks a member in the picker inside `where`, by typing some of their name. */
async function pick(where: HTMLElement, typed: string, nickname: string): Promise<void> {
  const box = within(where).getByRole('combobox', { name: 'Player' });
  fireEvent.focus(box);
  fireEvent.change(box, { target: { value: typed } });
  const option = await within(where).findByRole('option', { name: new RegExp(`^${nickname}\\b`) });
  fireEvent.click(option);
}

describe('the player picker', () => {
  it('shows the members seen last before anything is typed, then those that match, and gives to the one picked', async () => {
    const { calls, gifts } = await openPage();
    const box = within(gifts).getByRole('combobox', { name: 'Player' });
    fireEvent.focus(box);
    const listbox = await within(gifts).findByRole('listbox');
    expect(within(listbox).getAllByRole('option').map((o) => o.textContent)).toEqual(['AAdaada@example.comseen 5 min ago', 'BBobo@example.comseen 3 days ago']);
    expect(within(gifts).getByText('Seen lately')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'bo' } });
    await waitFor(() => expect(within(gifts).getAllByRole('option')).toHaveLength(1));
    expect(calls.some((c) => c.url === '/api/admin/members?q=bo')).toBe(true);
    // the keyboard picks too
    fireEvent.keyDown(box, { key: 'Enter' });
    const card = within(gifts).getByRole('group', { name: 'Player' });
    expect(card.textContent).toContain('bo@example.com');
    fireEvent.change(within(gifts).getByRole('combobox', { name: 'Item to give' }), { target: { value: 'border-glitch' } });
    fireEvent.click(within(gifts).getByRole('button', { name: 'Give it to Bo' }));
    await within(gifts).findByText('Gave Glitch border to Bo.');
    expect(calls.find((c) => c.body?.action === 'gift')?.body).toEqual({ action: 'gift', userId: 'u-bo', product: 'border-glitch' });
    // Change puts the box back
    fireEvent.click(within(card).getByRole('button', { name: 'Change' }));
    expect(within(gifts).getByRole('combobox', { name: 'Player' })).toBeTruthy();
  });
});

describe('inviting a QA tester', () => {
  it('picks a member, or takes an address no member has yet', async () => {
    const calls = fakeApi();
    const { QaTeam } = await import('../src/pages/QaTeam');
    render(<QaTeam />);
    const team = screen.getByRole('region', { name: 'Testers' });
    expect(within(team).getByRole('button', { name: 'Invite to QA' })).toHaveProperty('disabled', true);
    const box = within(team).getByRole('combobox', { name: 'Who to invite' });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'new.tester@example.org' } });
    fireEvent.click(await within(team).findByRole('option', { name: 'new.tester@example.org, no member has this address yet' }));
    fireEvent.click(within(team).getByRole('button', { name: 'Invite to QA' }));
    await waitFor(() => expect(calls.find((c) => c.body?.action === 'invite')?.body).toEqual({ action: 'invite', email: 'new.tester@example.org' }));
    // a member is invited by their own address
    const again = await within(team).findByRole('combobox', { name: 'Who to invite' });
    fireEvent.focus(again);
    fireEvent.click(await within(team).findByRole('option', { name: /^Bo, bo@example\.com/ }));
    fireEvent.click(within(team).getByRole('button', { name: 'Invite to QA' }));
    await waitFor(() => expect(calls.filter((c) => c.body?.action === 'invite').at(-1)?.body).toEqual({ action: 'invite', email: 'bo@example.com' }));
  });
});

describe('giving a Sigilfall title', () => {
  it('shows every light on the words typed, reads the line as the player will, and gives what was chosen', async () => {
    const { calls, gifts } = await openPage();
    await pick(gifts, 'ada', 'Ada');
    const box = within(gifts).getByRole('group', { name: 'A Sigilfall title' });
    const lights = within(box).getAllByRole('radio', { name: /./ }).filter((r) => (r as HTMLInputElement).type === 'radio');
    expect(lights).toHaveLength(TITLE_FX.length);
    fireEvent.change(within(box).getByRole('textbox', { name: /Title/ }), { target: { value: '  the   Kingslayer ' } });
    // each light, live, on the words
    for (const f of TITLE_FX) expect(box.querySelector(`.tg-sample .tfx-${f.id}`)?.textContent).toBe('the Kingslayer');
    // after the name, from its words, until a side is picked
    const preview = within(box).getByLabelText('Preview');
    expect(preview.textContent).toBe('Ada the Kingslayer');
    fireEvent.click(within(box).getByLabelText(/^Ember/));
    expect(preview.querySelector('.tfx-ember')?.textContent).toBe('the Kingslayer');
    fireEvent.click(within(box).getByRole('radio', { name: 'Before the name' }));
    expect(preview.textContent).toBe('the Kingslayer Ada');
    fireEvent.click(within(box).getByRole('button', { name: 'Give “the Kingslayer”' }));
    await within(box).findByText(/^Given: “the Kingslayer”/);
    expect(calls.find((c) => c.body?.action === 'grant')?.body).toEqual({ action: 'grant', userId: 'u-ada', name: 'the Kingslayer', fx: 'ember', before: true });
    // a title that reads before the name, as typed
    fireEvent.change(within(box).getByRole('textbox', { name: /Title/ }), { target: { value: 'Blooded' } });
    expect(preview.textContent).toBe('Blooded Ada');
    fireEvent.change(within(box).getByRole('textbox', { name: /Title/ }), { target: { value: 'Champion of the Ring' } });
    expect(preview.textContent).toBe('Ada, Champion of the Ring');
  });
});

describe('the titles a player has', () => {
  it('reads them on a hero’s name, takes one back after asking, and keeps the ones taken back apart', async () => {
    const calls: { url: string; body?: Record<string, unknown> }[] = [];
    const titles = [
      { id: 't2', name: 'the Kingslayer', fx: 'ashfire', before: false, at: 2, by: 'boss@example.com', revokedAt: null },
      { id: 't1', name: 'Blooded', fx: 'blood', before: true, at: 1, by: 'boss@example.com', revokedAt: 5 },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined });
        return new Response(JSON.stringify(init?.body ? { ok: true } : { titles }), { status: 200 });
      }),
    );
    const { TitleGiver } = await import('../src/pages/admin/SigilTitles');
    render(<TitleGiver userId="u1" nickname="Guitartrick" names={['Ash', 'Brin']} />);
    const held = await screen.findByRole('list', { name: 'Titles they hold' });
    expect(held.querySelector('.tfx-ashfire')?.textContent).toBe('the Kingslayer');
    expect(within(held).getByText('Ash')).toBeTruthy();
    expect(screen.getByText('Given to Guitartrick · 1')).toBeTruthy();
    expect(screen.getByText('Taken back · 1')).toBeTruthy();
    expect(calls[0]!.url).toBe('/api/admin/sigilfall/titles?user=u1');
    // the line can be read on another of their heroes
    fireEvent.change(screen.getByRole('textbox', { name: /Title/ }), { target: { value: 'Stormcaller' } });
    expect(screen.getByLabelText('Preview').textContent).toBe('Stormcaller Ash');
    fireEvent.change(screen.getByRole('combobox', { name: 'Shown on' }), { target: { value: 'Brin' } });
    expect(screen.getByLabelText('Preview').textContent).toBe('Stormcaller Brin');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(held).getByRole('button', { name: 'Take back' }));
    await screen.findByText('Taken back: “the Kingslayer”.');
    expect(calls.find((c) => c.body)?.body).toEqual({ action: 'revoke', id: 't2' });
  });
});

describe('the sales list', () => {
  it('shows the latest ten, then the rest when asked, and searches on the server', async () => {
    const { calls, sales } = await openPage();
    const list = await within(sales).findByRole('list', { name: 'Purchases, newest first' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    expect(within(sales).getByText('10 of 25')).toBeTruthy();
    expect(calls.some((c) => c.url === '/api/admin/shop?q=&offset=0&limit=10')).toBe(true);
    fireEvent.click(within(sales).getByRole('button', { name: 'Show all 25' }));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(25));
    expect(calls.some((c) => c.url === '/api/admin/shop?q=&offset=10&limit=15')).toBe(true);
    fireEvent.click(within(sales).getByRole('button', { name: 'Show only the latest 10' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    fireEvent.change(within(sales).getByRole('searchbox', { name: 'Find a purchase' }), { target: { value: 'Bo' } });
    await waitFor(() => expect(within(sales).getByText('10 of 12 found')).toBeTruthy());
    expect(calls.some((c) => c.url === '/api/admin/shop?q=Bo&offset=0&limit=10')).toBe(true);
    for (const row of within(within(sales).getByRole('list', { name: 'Purchases, newest first' })).getAllByRole('listitem')) expect(row.textContent).toContain('bo@example.com');
    fireEvent.change(within(sales).getByRole('searchbox', { name: 'Find a purchase' }), { target: { value: 'nobody' } });
    await within(sales).findByText('No purchase matches “nobody”.');
  });

  it('takes a purchase back after asking', async () => {
    const { calls, sales } = await openPage();
    await within(sales).findByRole('list', { name: 'Purchases, newest first' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => {
      fireEvent.click(within(sales).getAllByRole('button', { name: 'Take back' })[0]!);
    });
    expect(calls.find((c) => c.body?.action === 'takeBack')?.body).toEqual({ action: 'takeBack', id: 'p000abcdef' });
  });
});
