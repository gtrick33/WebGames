import { AGREE_NOW, PRODUCTS, productIn, priceText, sanitizeProducts, SALE_TERMS_VERSION, type Product } from '../src/catalog/shop';
import { sendBatch } from './email';
import { randomToken, type Env } from './http';

/**
 * One-time purchases through Stripe Managed Payments, where Stripe (through Link) is the merchant of record: it sells to
 * the player, handles VAT, sends the receipt and handles payment support. A purchase counts when Stripe's signed webhook
 * says it was paid, never because a browser said so. Nothing here runs until the shop is opened and the keys are set
 * (docs/LEGAL-READINESS.md).
 *
 * Admin › Ads & shop sets each item's price. Stripe only charges prices it knows, so a new or changed price is created
 * there at the next checkout, and what a player sees is always what they pay.
 */
const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_VERSION = '2026-04-22.dahlia';
const WEBHOOK_TOLERANCE_S = 300;
/** Stripe's tax code for a digital service: on its list for Managed Payments. An accountant should confirm it. */
const TAX_CODE = 'txcd_10000000';

/** The items the admins have set (the starting list until they change it). */
export async function loadItems(env: Env): Promise<Product[]> {
  try {
    const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key = 'shop_items'").first<{ value: string }>();
    return row?.value ? sanitizeProducts(JSON.parse(row.value)) : PRODUCTS;
  } catch {
    return PRODUCTS;
  }
}

/** What this member's paid purchases unlock. Refunded ones don't count. */
export async function ownedBy(env: Env, userId: string): Promise<string[]> {
  try {
    const rows = await env.DB.prepare("SELECT DISTINCT product FROM purchases WHERE user_id = ? AND status = 'paid'").bind(userId).all<{ product: string }>();
    return rows.results.map((r) => r.product);
  } catch {
    // (before the migration has run)
    return [];
  }
}

export const canSell = (env: Env, p: Product | undefined): p is Product => !!p && !p.later && !p.hidden && !!env.STRIPE_SECRET_KEY;

async function stripe<T>(env: Env, path: string, body: URLSearchParams): Promise<T | null> {
  const res = await fetch(`${STRIPE_API}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': STRIPE_VERSION },
    body,
  });
  return res.ok ? ((await res.json()) as T) : null;
}

interface StripeRef {
  product: string;
  price: string;
  cents: number;
  name: string;
}

/** The Stripe price for this item at its current price, made if it's new or changed. Stored apart from the public catalog. */
async function stripePriceFor(env: Env, p: Product): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key = 'shop_stripe'").first<{ value: string }>();
  const refs = (row?.value ? JSON.parse(row.value) : {}) as Record<string, StripeRef>;
  const had = refs[p.id];
  if (had && had.cents === p.cents && had.name === p.name) return had.price;
  let product = had?.product;
  if (!product) {
    const made = await stripe<{ id: string }>(env, 'products', new URLSearchParams({ name: p.name, tax_code: TAX_CODE }));
    if (!made) return null;
    product = made.id;
  } else if (had?.name !== p.name) {
    await stripe(env, `products/${product}`, new URLSearchParams({ name: p.name }));
  }
  const price =
    had?.cents === p.cents && had?.price
      ? { id: had.price }
      : await stripe<{ id: string }>(env, 'prices', new URLSearchParams({ product, unit_amount: String(p.cents), currency: 'eur', tax_behavior: 'inclusive' }));
  if (!price) return null;
  refs[p.id] = { product, price: price.id, cents: p.cents, name: p.name };
  await env.DB.prepare("INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ('shop_stripe', ?, ?, 'shop') ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(JSON.stringify(refs), Date.now())
    .run();
  return price.id;
}

/** Opens a Stripe Checkout for a one-time payment and records the buyer's agreement. Returns where to send them. */
export async function startCheckout(env: Env, user: { id: string; email: string }, p: Product, origin: string, now = Date.now()): Promise<string | null> {
  const price = await stripePriceFor(env, p);
  if (!price) return null;
  const id = randomToken(16);
  await env.DB.prepare('INSERT INTO purchases (id, user_id, product, status, agreed_at, terms, created_at, provider_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, p.id, 'pending', now, SALE_TERMS_VERSION, now, `pending:${id}`)
    .run();
  const session = await stripe<{ url?: string }>(
    env,
    'checkout/sessions',
    new URLSearchParams({
      mode: 'payment',
      'managed_payments[enabled]': 'true',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      client_reference_id: id,
      customer_email: user.email,
      success_url: `${origin}/shop?bought=${encodeURIComponent(p.id)}`,
      cancel_url: `${origin}/shop`,
    }),
  );
  return session?.url ?? null;
}

const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Checks Stripe's signature on a webhook: the header's `t` and `v1`, HMAC-SHA256 of `t.body`, and not an old replay. */
export async function verifyStripeSignature(body: string, header: string | null, secret: string | undefined, nowS = Date.now() / 1000): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.split('=') as [string, string]);
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(nowS - Number(t)) > WEBHOOK_TOLERANCE_S) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const want = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`)));
  // (compared whole, not stopping at the first difference)
  return sigs.some((s) => s.length === want.length && [...s].reduce((bad, c, i) => bad | (c.charCodeAt(0) ^ want.charCodeAt(i)), 0) === 0);
}

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

/** Applies a verified webhook: a paid checkout gives the item, a refund or lost dispute takes it back. Safe to receive twice. */
export async function applyStripeEvent(env: Env, ev: StripeEvent, now = Date.now()): Promise<void> {
  const o = ev.data.object;
  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
    if (o.payment_status !== 'paid' || typeof o.client_reference_id !== 'string') return;
    const ref = typeof o.payment_intent === 'string' ? o.payment_intent : String(o.id);
    const done = await env.DB.prepare("UPDATE purchases SET status = 'paid', provider_ref = ?, amount = ?, currency = ?, paid_at = ? WHERE id = ? AND status = 'pending'")
      .bind(ref, typeof o.amount_total === 'number' ? o.amount_total : null, typeof o.currency === 'string' ? o.currency : null, now, o.client_reference_id)
      .run();
    const r = done as { meta?: { changes?: number }; changes?: number };
    if (r.meta?.changes ?? r.changes) await confirmByEmail(env, o.client_reference_id, now);
    return;
  }
  if (ev.type === 'charge.refunded' || ev.type === 'charge.dispute.funds_withdrawn') {
    const ref = typeof o.payment_intent === 'string' ? o.payment_intent : null;
    if (ref) await env.DB.prepare("UPDATE purchases SET status = 'refunded', refunded_at = ? WHERE provider_ref = ?").bind(now, ref).run();
  }
}

/** The confirmation the law asks for: what was bought, and the buyer's agreement to get it right away, on something they keep. */
async function confirmByEmail(env: Env, id: string, now: number): Promise<void> {
  const row = await env.DB.prepare('SELECT p.product, p.amount, u.email FROM purchases p JOIN users u ON u.id = p.user_id WHERE p.id = ?').bind(id).first<{ product: string; amount: number | null; email: string }>();
  const p = row ? productIn(await loadItems(env), row.product) : undefined;
  if (!row || !p) return;
  const lines = [
    `Thank you. ${p.name} (${priceText(row.amount ?? p.cents)}, VAT included) is on your GlitchBound account now.`,
    `Your receipt comes separately from our payment provider, Stripe, through Link.`,
    `When you bought it you confirmed: "${AGREE_NOW}"`,
    `Date: ${new Date(now).toISOString().slice(0, 10)}. Terms of sale: https://glitchboundstudio.com/terms/sale`,
    `If something isn't working, reply to this email or open a ticket at https://glitchboundstudio.com/contact.`,
  ];
  await sendBatch(env, [{ to: row.email, subject: `Your GlitchBound purchase: ${p.name}`, text: lines.join('\n\n'), html: lines.map((l) => `<p>${l}</p>`).join('') }]).catch(() => 0);
}

/* ------------------------------------------------------------------ for Admin › Ads & shop */

export interface ShopReport {
  /** Paid items and money taken, by item and currency. */
  items: { product: string; paid: number; refunded: number; gifted: number; cents: number; currency: string | null }[];
  recent: { id: string; product: string; status: string; amount: number | null; currency: string | null; at: number; nickname: string | null; gift: boolean }[];
}

export async function shopReport(env: Env): Promise<ShopReport> {
  const [items, recent] = await Promise.all([
    env.DB.prepare(
      `SELECT product,
         SUM(CASE WHEN status = 'paid' AND provider_ref NOT LIKE 'gift:%' THEN 1 ELSE 0 END) AS paid,
         SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded,
         SUM(CASE WHEN status = 'paid' AND provider_ref LIKE 'gift:%' THEN 1 ELSE 0 END) AS gifted,
         SUM(CASE WHEN status = 'paid' AND provider_ref NOT LIKE 'gift:%' THEN COALESCE(amount, 0) ELSE 0 END) AS cents,
         MAX(currency) AS currency
       FROM purchases WHERE status != 'pending' GROUP BY product ORDER BY cents DESC`,
    ).all<ShopReport['items'][number]>(),
    env.DB.prepare(
      `SELECT p.id, p.product, p.status, p.amount, p.currency, COALESCE(p.paid_at, p.created_at) AS at, u.nickname, p.provider_ref AS ref
       FROM purchases p LEFT JOIN users u ON u.id = p.user_id WHERE p.status != 'pending' ORDER BY at DESC LIMIT 40`,
    ).all<ShopReport['recent'][number] & { ref: string | null }>(),
  ]);
  return { items: items.results, recent: recent.results.map(({ ref, ...r }) => ({ ...r, gift: !!ref?.startsWith('gift:') })) };
}

/** Gives an item to a member, for support or a prize. Shown as a gift, never counted as money. */
export async function giftItem(env: Env, userId: string, product: string, now = Date.now()): Promise<void> {
  const id = randomToken(16);
  await env.DB.prepare("INSERT INTO purchases (id, user_id, product, status, agreed_at, terms, created_at, paid_at, provider_ref, amount, currency) VALUES (?, ?, ?, 'paid', ?, 'gift', ?, ?, ?, 0, 'eur')")
    .bind(id, userId, product, now, now, now, `gift:${id}`)
    .run();
}

/** Takes an item back from a member (a refund done by hand, or a gift by mistake). The money side is done in Stripe. */
export async function takeBack(env: Env, id: string, now = Date.now()): Promise<boolean> {
  const r = (await env.DB.prepare("UPDATE purchases SET status = 'refunded', refunded_at = ? WHERE id = ? AND status = 'paid'").bind(now, id).run()) as { meta?: { changes?: number }; changes?: number };
  return !!(r.meta?.changes ?? r.changes);
}
