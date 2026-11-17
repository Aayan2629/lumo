import { env } from '@/lib/env';
import { withService } from '@/lib/db';
import { applyCheckout } from '@/lib/billing';
import { verifyStripeSignature } from '@/lib/providers/billing';

export async function POST(req: Request) {
  const secret = env.opt('STRIPE_WEBHOOK_SECRET');
  if (!secret) return new Response('not configured', { status: 404 });
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature'), secret)) return new Response('bad signature', { status: 401 });
  const evt = JSON.parse(raw);
  if (evt.type === 'checkout.session.completed') {
    const s = evt.data.object;
    const kind = s.metadata?.kind === 'boost' ? 'boost' : 'plan';
    await withService((db) => applyCheckout(db, { ref: s.id, kind, agencyId: s.metadata.agency_id, listingId: s.metadata.listing_id, customerRef: s.customer }));
  }
  if (evt.type === 'invoice.payment_failed') {
    await withService((db) => db.query(`update agencies set billing_status = 'past_due' where billing_customer_ref = $1`, [evt.data.object.customer]));
  }
  return new Response('ok');
}
