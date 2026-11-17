import { z } from 'zod';
import { clientIp, currentSessionToken, apiUser } from '@/lib/auth';
import { withService } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import { deckFor } from '@/lib/deck';
import { verifyTurnstile } from '@/lib/providers/turnstile';
import { json, parse, route } from '@/lib/http';

// POST so the bot-check token stays out of URLs and logs. A passed check unlocks swiping for
// an hour on this session.
export const POST = route(async (req: Request) => {
  const u = await apiUser(['renter', 'investor']);
  const { turnstile } = await parse(req, z.object({ turnstile: z.string().max(4096).nullish() }));
  if (turnstile) {
    if (!(await verifyTurnstile(turnstile, await clientIp()))) return json({ error: 'Bot check failed' }, 400);
    const tok = await currentSessionToken();
    if (tok) await withService((db) => db.query('update sessions set bot_checked_at = now() where token_hash = $1', [sha256(tok)]));
  }
  const cards = await deckFor(u.id, u.role === 'investor' ? 'investor' : 'renter');
  return json({ cards });
});
