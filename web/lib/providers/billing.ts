import 'server-only';
import { env } from '../env';
import { hmac, safeEqual } from '../crypto';

// Stripe for agency plans ($249/month), boosts ($49 per listing for 14 days) and investor
// leads ($25 per finance-ready match). Card details only ever go to Stripe's hosted checkout.
export const PRICES = { plan: 24_900, boost: 4_900, investor_lead: 2_500 } as const;

export interface BillingProvider {
  name: string;
  checkout(opts: { agencyId: string; kind: 'plan' | 'boost'; listingId?: string; successUrl: string; cancelUrl: string }): Promise<{ url: string; ref: string }>;
  chargeLead(opts: { agencyId: string; customerRef: string | null; matchId: string }): Promise<{ ref: string; status: 'paid' | 'pending' }>;
}

function mock(): BillingProvider {
  if (!env.allowMocks) throw new Error('Mock billing is disabled');
  return {
    name: 'mock',
    async checkout({ agencyId, kind, listingId }) {
      const ref = `mock_cs_${Date.now().toString(36)}`;
      const q = new URLSearchParams({ ref, kind, agency: agencyId, ...(listingId ? { listing: listingId } : {}) });
      return { url: `/mock/checkout?${q}`, ref };
    },
    async chargeLead({ matchId }) { return { ref: `mock_pi_${matchId.slice(0, 8)}`, status: 'pending' }; },
  };
}

function stripe(): BillingProvider {
  const key = env.req('STRIPE_SECRET_KEY');
  const call = async (path: string, form: Record<string, string>) => {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form), signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Stripe ${res.status}`);
    return res.json() as Promise<Record<string, any>>;
  };
  return {
    name: 'stripe',
    async checkout({ agencyId, kind, listingId, successUrl, cancelUrl }) {
      const price = kind === 'plan' ? env.req('STRIPE_PRICE_PLAN') : env.req('STRIPE_PRICE_BOOST');
      const s = await call('checkout/sessions', {
        mode: kind === 'plan' ? 'subscription' : 'payment',
        'line_items[0][price]': price, 'line_items[0][quantity]': '1',
        success_url: successUrl, cancel_url: cancelUrl, client_reference_id: agencyId,
        'metadata[kind]': kind, 'metadata[agency_id]': agencyId, ...(listingId ? { 'metadata[listing_id]': listingId } : {}),
      });
      return { url: s.url, ref: s.id };
    },
    async chargeLead({ customerRef, matchId }) {
      if (!customerRef) return { ref: '', status: 'pending' };
      const ii = await call('invoiceitems', { customer: customerRef, amount: String(PRICES.investor_lead), currency: 'aud', description: `Lumo investor lead ${matchId}` });
      return { ref: ii.id, status: 'pending' };
    },
  };
}

export function billingProvider(): BillingProvider {
  return env.provider('BILLING') === 'stripe' ? stripe() : mock();
}

// Stripe-Signature: t=<ts>,v1=<hex hmac of "<ts>.<raw body>">. Rejected if older than 5 minutes.
export function verifyStripeSignature(body: string, header: string | null, secret: string, now = Date.now()) {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.split('='));
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 300) return false;
  const want = hmac(secret, `${t}.${body}`);
  return sigs.some((s) => safeEqual(s, want));
}
