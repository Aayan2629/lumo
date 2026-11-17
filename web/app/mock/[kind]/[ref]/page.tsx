import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { requireUser } from '@/lib/auth';
import { ApiForm } from '@/components/ApiForm';

export const dynamic = 'force-dynamic';

// Stand-in for the provider's hosted page (DVS gateway, open-banking consent, lender).
// Nothing is uploaded: you pick the outcome the real provider would report.
const COPY = {
  id: { title: 'Identity check (simulated DVS gateway)', body: 'In production this is the ID provider’s page: you photograph two IDs and take a selfie there. Lumo never receives the images.',
    options: [['pass', 'Both IDs match and liveness passes'], ['fail', 'Only one ID matches']] },
  bank: { title: 'Connect your bank (simulated open banking)', body: 'In production this is the accredited CDR provider’s consent screen. You approve read-only access once; Lumo receives only an income band and whether you hold 4 weeks’ rent.',
    options: [['strong', 'Income about $2,400/wk, savings $6,000'], ['ok', 'Income about $1,800/wk, savings $2,200'], ['low', 'Income about $1,100/wk, savings $900']] },
  finance: { title: 'Lender pre-approval (simulated)', body: 'In production you connect your lender or upload the letter to the provider. Lumo keeps only the amount band and expiry.',
    options: [['900', 'Pre-approved up to $900,000'], ['1500', 'Pre-approved up to $1,500,000']] },
} as const;

export default async function MockProvider({ params }: { params: Promise<{ kind: string; ref: string }> }) {
  if (!env.allowMocks) notFound();
  await requireUser(['renter', 'investor']);
  const { kind, ref } = await params;
  const c = COPY[kind as keyof typeof COPY];
  if (!c) notFound();
  return (
    <main className="wrap stack">
      <p className="notice warn">Pilot simulation. No real check is run.</p>
      <div className="card stack">
        <h1>{c.title}</h1>
        <p className="muted">{c.body}</p>
        {c.options.map(([o, label]) => (
          <ApiForm key={o} action="/api/mock/complete" extra={{ kind, ref, outcome: o }} submit={label} />
        ))}
      </div>
    </main>
  );
}
