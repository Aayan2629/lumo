import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { requireAgent } from '@/lib/auth';
import { PRICES } from '@/lib/providers/billing';
import { ApiForm } from '@/components/ApiForm';

export const dynamic = 'force-dynamic';

export default async function MockCheckout({ searchParams }: { searchParams: Promise<{ ref?: string; kind?: string; listing?: string }> }) {
  if (!env.allowMocks) notFound();
  await requireAgent();
  const sp = await searchParams;
  const kind = sp.kind === 'boost' ? 'boost' : 'plan';
  return (
    <main className="wrap stack">
      <p className="notice warn">Pilot simulation of Stripe Checkout. No card is charged.</p>
      <div className="card stack">
        <h1>{kind === 'plan' ? 'Lumo Agency plan' : 'Boost listing for 14 days'}</h1>
        <p className="muted">${(PRICES[kind] / 100).toFixed(2)}{kind === 'plan' ? ' per month' : ''} AUD</p>
        <ApiForm action="/api/mock/checkout" extra={{ ref: sp.ref, kind, listing: sp.listing }} submit="Pay (simulated)" />
        <a className="btn ghost block" href="/agent/billing">Cancel</a>
      </div>
    </main>
  );
}
