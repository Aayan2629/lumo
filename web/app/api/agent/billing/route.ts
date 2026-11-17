import { z } from 'zod';
import { env } from '@/lib/env';
import { apiUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { agentContext } from '@/lib/agent';
import { billingProvider } from '@/lib/providers/billing';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ kind: z.enum(['plan', 'boost']), listingId: z.string().uuid().optional() });

export const POST = route(async (req: Request) => {
  const u = await apiUser(['agent']);
  const b = await parse(req, Body);
  const ctx = await agentContext(u.id);
  if (b.kind === 'plan' && ctx.agent_role !== 'owner') return json({ error: 'Only the agency owner can change the plan' }, 403);
  if (b.kind === 'boost') {
    if (!b.listingId) return json({ error: 'Pick a listing to boost' }, 400);
    const mine = await withUser(u.id, async (db) => (await db.query('select 1 from listings where id = $1 and agency_id = app_agency_id()', [b.listingId])).rowCount);
    if (!mine) return json({ error: 'Listing not found' }, 404);
  }
  const s = await billingProvider().checkout({
    agencyId: ctx.id, kind: b.kind, listingId: b.listingId,
    successUrl: `${env.appUrl}/agent/billing?paid=1`, cancelUrl: `${env.appUrl}/agent/billing`,
  });
  return json({ redirect: s.url });
});
