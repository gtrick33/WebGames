import { bad, json, type Ctx } from '../../../server/http';
import { applyStripeEvent, verifyStripeSignature } from '../../../server/shop';

/** POST /api/shop/webhook: Stripe says a payment went through or was refunded. Only its signed messages count. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const body = await request.text();
  if (!(await verifyStripeSignature(body, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) return bad('bad_signature', 400);
  await applyStripeEvent(env, JSON.parse(body) as Parameters<typeof applyStripeEvent>[1]);
  return json({ received: true });
}
