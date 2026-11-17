import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { json, parse, route } from '@/lib/http';

export const POST = route(async (req: Request) => {
  const u = await apiUser();
  const b = await parse(req, z.object({ listingId: z.string().uuid(), reason: z.string().trim().min(3).max(500) }));
  await withUser(u.id, (db) => db.query('insert into reports (reporter_id, listing_id, reason) values ($1, $2, $3)', [u.id, b.listingId, b.reason]));
  return json({ message: 'Thanks. Our team reviews every report, usually within a day.' });
});
