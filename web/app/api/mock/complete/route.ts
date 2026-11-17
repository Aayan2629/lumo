import { z } from 'zod';
import { env } from '@/lib/env';
import { apiUser } from '@/lib/auth';
import { withService } from '@/lib/db';
import { signWebhook, type ProviderResult } from '@/lib/providers/verify';
import { handleProviderWebhook } from '@/lib/verification';
import { json, parse, route } from '@/lib/http';

// Stands in for the provider's hosted page finishing. It builds the webhook the real provider
// would send, signs it, and feeds it through the same signature check. Disabled without mocks.
const Body = z.object({
  kind: z.enum(['id', 'bank', 'finance']),
  ref: z.string().max(100),
  outcome: z.string().max(40),
});

const SCENARIOS: Record<string, (ref: string) => ProviderResult> = {
  'id:pass': (r) => ({ kind: 'id', providerRef: r, passed: true, documents: 2, liveness: true }),
  'id:fail': (r) => ({ kind: 'id', providerRef: r, passed: false, documents: 1, liveness: true }),
  'bank:strong': (r) => ({ kind: 'bank', providerRef: r, passed: true, weeklyIncome: 2400, balance: 6000 }),
  'bank:ok': (r) => ({ kind: 'bank', providerRef: r, passed: true, weeklyIncome: 1800, balance: 2200 }),
  'bank:low': (r) => ({ kind: 'bank', providerRef: r, passed: true, weeklyIncome: 1100, balance: 900 }),
  'finance:900': (r) => ({ kind: 'finance', providerRef: r, passed: true, preApprovedUpTo: 900_000, expiresOn: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10) }),
  'finance:1500': (r) => ({ kind: 'finance', providerRef: r, passed: true, preApprovedUpTo: 1_500_000, expiresOn: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10) }),
};

export const POST = route(async (req: Request) => {
  if (!env.allowMocks) return json({ error: 'Not found' }, 404);
  const u = await apiUser(['renter', 'investor']);
  const b = await parse(req, Body);
  const mine = await withService(async (db) => (await db.query(
    `select 1 from verifications where provider_ref = $1 and user_id = $2 and status = 'pending'`, [b.ref, u.id])).rowCount);
  if (!mine) return json({ error: 'This check has already finished' }, 400);
  const make = SCENARIOS[`${b.kind}:${b.outcome}`];
  if (!make) return json({ error: 'Unknown scenario' }, 400);
  const body = JSON.stringify(make(b.ref));
  const ok = await handleProviderWebhook(b.kind, body, signWebhook(b.kind, body));
  return ok ? json({ redirect: '/app/verify' }) : json({ error: 'Signature check failed' }, 500);
});
