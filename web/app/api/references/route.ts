import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { requestReference } from '@/lib/verification';
import { enforce } from '@/lib/ratelimit';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ email: z.string().trim().email().max(200), pastAddress: z.string().trim().min(5).max(200) });

export const POST = route(async (req: Request) => {
  const u = await apiUser(['renter', 'investor']);
  const b = await parse(req, Body);
  if (b.email.toLowerCase() === u.email.toLowerCase()) return json({ error: 'A referee has to be someone else' }, 400);
  await enforce('verify', `user:${u.id}`);
  await requestReference(u.id, b.email, b.pastAddress);
  return json({ message: 'Sent. We’ll add the badge when your referee confirms.' });
});
