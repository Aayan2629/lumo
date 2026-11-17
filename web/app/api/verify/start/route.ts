import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { startCheck } from '@/lib/verification';
import { enforce } from '@/lib/ratelimit';
import { json, parse, route } from '@/lib/http';

export const POST = route(async (req: Request) => {
  const u = await apiUser(['renter', 'investor']);
  const { kind } = await parse(req, z.object({ kind: z.enum(['id', 'bank', 'finance']) }));
  await enforce('verify', `user:${u.id}`);
  const s = await startCheck(u.id, kind);
  return json({ redirect: s.redirectUrl });
});
