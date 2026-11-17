import 'server-only';
import type { Db } from './db';
import { audit } from './audit';
import { PRICES } from './providers/billing';

// Applies a completed checkout. Called from the Stripe webhook (signature checked) or the
// pilot's mock checkout. Idempotent on the provider reference.
export async function applyCheckout(db: Db, o: { ref: string; kind: 'plan' | 'boost'; agencyId: string; listingId?: string | null; customerRef?: string | null }) {
  const seen = await db.query('select 1 from billing_events where provider_ref = $1', [o.ref]);
  if (seen.rowCount) return;
  await db.query(
    `insert into billing_events (agency_id, kind, amount_cents, listing_id, provider_ref, status) values ($1, $2, $3, $4, $5, 'paid')`,
    [o.agencyId, o.kind, PRICES[o.kind], o.listingId ?? null, o.ref]);
  if (o.kind === 'plan') {
    await db.query(`update agencies set plan = 'agency', billing_status = 'active', billing_customer_ref = coalesce($2, billing_customer_ref) where id = $1`, [o.agencyId, o.customerRef ?? null]);
  } else if (o.listingId) {
    await db.query(`update listings set boosted_until = greatest(coalesce(boosted_until, now()), now()) + interval '14 days' where id = $1 and agency_id = $2`, [o.listingId, o.agencyId]);
  }
  await audit(db, 'billing', `billing.${o.kind}`, o.ref);
}
