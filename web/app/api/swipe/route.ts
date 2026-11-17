import { z } from 'zod';
import { currentSessionToken, apiUser } from '@/lib/auth';
import { withService, withUser } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import { badgesFor } from '@/lib/badges';
import { maybeMatch } from '@/lib/match';
import { enforce } from '@/lib/ratelimit';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ listingId: z.string().uuid(), direction: z.enum(['right', 'left', 'save']) });

export const POST = route(async (req: Request) => {
  const u = await apiUser(['renter', 'investor']);
  const b = await parse(req, Body);
  await enforce('swipe', `user:${u.id}`);
  const tok = await currentSessionToken();
  const checked = await withService(async (db) => (await db.query(
    `select 1 from sessions where token_hash = $1 and bot_checked_at > now() - interval '1 hour'`, [sha256(tok ?? '')])).rowCount);
  if (!checked) return json({ error: 'Please refresh to continue swiping', code: 'bot_check' }, 403);

  const res = await withUser(u.id, async (db) => {
    if (b.direction === 'right') {
      // Only verified people can like: that's what agents pay for.
      const badges = await badgesFor(db, u.id);
      if (!badges.id) return { error: 'verify_first' as const };
      const l = (await db.query(`select type from listings where id = $1 and status = 'active'`, [b.listingId])).rows[0];
      if (!l) return { error: 'gone' as const };
      if (l.type === 'sale' && !badges.finance) return { error: 'finance_first' as const };
    }
    await db.query(
      `insert into swipes (user_id, listing_id, direction) values ($1, $2, $3)
       on conflict (user_id, listing_id) do update set direction = excluded.direction, created_at = now()`, [u.id, b.listingId, b.direction]);
    return { ok: true as const };
  });
  if ('error' in res) {
    const msg = res.error === 'verify_first' ? 'Verify your ID to like homes. It takes about 3 minutes.'
      : res.error === 'finance_first' ? 'Add your finance check to like homes for sale.' : 'This listing is no longer available.';
    return json({ error: msg, code: res.error }, 409);
  }
  // If the agent already liked this person, this swipe completes the match.
  const matchId = b.direction === 'right' ? await maybeMatch(u.id, b.listingId) : null;
  return json({ ok: true, matched: !!matchId });
});
