import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { notifyNewSlots, sydneyToUtc } from '@/lib/slots';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ listingId: z.string().uuid(), startsAt: z.string().min(10), minutes: z.coerce.number().int().min(5).max(120).default(15) });

export const POST = route(async (req: Request) => {
  const u = await apiUser(['agent']);
  const b = await parse(req, Body);
  const at = sydneyToUtc(b.startsAt);
  if (!(at.getTime() > Date.now())) return json({ error: 'Pick a time in the future' }, 400);
  const ok = await withUser(u.id, async (db) => {
    const r = await db.query(`insert into inspection_slots (listing_id, starts_at, minutes) values ($1, $2, $3) returning id`, [b.listingId, at, b.minutes]).catch(() => null);
    return !!r?.rowCount;
  });
  if (!ok) return json({ error: 'Listing not found' }, 404);
  await notifyNewSlots(b.listingId);
  return json({ message: 'Time added. Matched renters have been told.' });
});
