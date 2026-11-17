import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { maybeMatch } from '@/lib/match';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ listingId: z.string().uuid(), userId: z.string().uuid(), direction: z.enum(['right', 'left']) });

// The agent's swipe. RLS's with-check means an agent can only record a decision on someone
// who liked one of their own agency's listings.
export const POST = route(async (req: Request) => {
  const u = await apiUser(['agent']);
  const b = await parse(req, Body);
  try {
    await withUser(u.id, (db) => db.query(
      `insert into agent_swipes (agent_id, user_id, listing_id, direction) values ($1, $2, $3, $4)
       on conflict (listing_id, user_id) do update set direction = excluded.direction, agent_id = excluded.agent_id, created_at = now()`,
      [u.id, b.userId, b.listingId, b.direction]));
  } catch (e) {
    if ((e as { code?: string }).code === '42501') return json({ error: 'Not your lead' }, 403);
    throw e;
  }
  const matchId = b.direction === 'right' ? await maybeMatch(b.userId, b.listingId) : null;
  return json({ ok: true, matched: !!matchId, message: matchId ? 'It’s a match. The next-step email is on its way to the assigned agent.' : undefined });
});
