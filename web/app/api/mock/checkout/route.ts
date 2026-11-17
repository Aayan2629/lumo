import { z } from 'zod';
import { env } from '@/lib/env';
import { apiUser } from '@/lib/auth';
import { withService } from '@/lib/db';
import { agentContext } from '@/lib/agent';
import { applyCheckout } from '@/lib/billing';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ ref: z.string().max(80), kind: z.enum(['plan', 'boost']), listing: z.string().uuid().optional() });

export const POST = route(async (req: Request) => {
  if (!env.allowMocks) return json({ error: 'Not found' }, 404);
  const u = await apiUser(['agent']);
  const b = await parse(req, Body);
  const ctx = await agentContext(u.id);
  await withService((db) => applyCheckout(db, { ref: b.ref, kind: b.kind, agencyId: ctx.id, listingId: b.listing }));
  return json({ redirect: '/agent/billing?paid=1' });
});
