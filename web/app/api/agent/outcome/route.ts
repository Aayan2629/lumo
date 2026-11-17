import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { withService, withUser } from '@/lib/db';
import { audit } from '@/lib/audit';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ matchId: z.string().uuid(), status: z.enum(['approved', 'declined', 'waitlisted', 'applied']) });

export const POST = route(async (req: Request) => {
  const u = await apiUser(['agent']);
  const b = await parse(req, Body);
  const n = await withUser(u.id, async (db) => (await db.query(`update matches set status = $1, updated_at = now() where id = $2`, [b.status, b.matchId])).rowCount);
  if (!n) return json({ error: 'Match not found' }, 404);
  await withService((db) => audit(db, u.id, `match.${b.status}`, b.matchId));
  return json({ message: 'Saved' });
});
