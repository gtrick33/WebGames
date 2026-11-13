/** An item an admin gave is told from one the member bought (server/shop.ts giftsTo), so the card says which. */
import { describe, expect, it } from 'vitest';
import type { Env } from '../server/http';
import { giftItem, giftsTo, ownedBy } from '../server/shop';
import { memoryD1 } from './d1';

describe('gifts', () => {
  it('are the items a member has only as gifts, never one they paid for too', async () => {
    const e = { DB: memoryD1() } as unknown as Env;
    await giftItem(e, 'u1', 'icon-owl', 1000);
    await giftItem(e, 'u1', 'ad-free', 1000);
    await e.DB.prepare("INSERT INTO purchases (id, user_id, product, status, agreed_at, terms, created_at, paid_at, provider_ref) VALUES ('p1', 'u1', 'ad-free', 'paid', 1, '2026-11-04', 1, 2, 'pi_1')").run();
    await e.DB.prepare("INSERT INTO purchases (id, user_id, product, status, agreed_at, terms, created_at, paid_at, provider_ref) VALUES ('p2', 'u1', 'banner-aurora', 'paid', 1, '2026-11-04', 1, 2, 'pi_2')").run();
    await giftItem(e, 'u2', 'border-frost', 1000);
    expect((await ownedBy(e, 'u1')).sort()).toEqual(['ad-free', 'banner-aurora', 'icon-owl']);
    expect(await giftsTo(e, 'u1')).toEqual(['icon-owl']);
    expect(await giftsTo(e, 'u2')).toEqual(['border-frost']);
    expect(await giftsTo(e, 'nobody')).toEqual([]);
  });
});
