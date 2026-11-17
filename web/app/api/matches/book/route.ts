import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { withService, withUser } from '@/lib/db';
import { sendEmail } from '@/lib/match';
import { inspectionEmail } from '@/lib/emails/templates';
import { calendarUrl, whenText } from '@/lib/calendar';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ matchId: z.string().uuid(), slotId: z.string().uuid() });

export const POST = route(async (req: Request) => {
  const u = await apiUser(['renter', 'investor']);
  const b = await parse(req, Body);
  const booked = await withUser(u.id, async (db) => {
    // RLS: only the renter's own match is visible, and the slot must belong to its listing.
    const { rows } = await db.query(
      `select m.id, m.agent_email, l.address, s.starts_at, s.minutes, s.capacity,
              (select count(*)::int from inspections i where i.slot_id = s.id) as taken
       from matches m join listings l on l.id = m.listing_id join inspection_slots s on s.listing_id = l.id
       where m.id = $1 and s.id = $2 and m.status in ('new', 'inspection') and s.starts_at > now()`, [b.matchId, b.slotId]);
    const r = rows[0];
    if (!r) return null;
    if (r.taken >= r.capacity) return 'full' as const;
    await db.query(`insert into inspections (match_id, slot_id) values ($1, $2) on conflict (match_id) do update set slot_id = excluded.slot_id, created_at = now()`, [b.matchId, b.slotId]);
    return r;
  });
  if (!booked) return json({ error: 'That time is no longer available' }, 400);
  if (booked === 'full') return json({ error: 'That time is full, pick another' }, 400);
  await withService(async (db) => {
    await db.query(`update matches set status = 'inspection', updated_at = now() where id = $1`, [b.matchId]);
    const when = whenText(booked.starts_at);
    const cal = calendarUrl(`Inspection: ${booked.address}`, booked.starts_at, booked.minutes, booked.address);
    await sendEmail(db, { ...inspectionEmail({ address: booked.address, when, calendarUrl: cal, forAgent: false }), to: u.email, template: 'inspection_renter', matchId: b.matchId });
    await sendEmail(db, { ...inspectionEmail({ address: booked.address, when, calendarUrl: cal, forAgent: true, name: (u.name ?? 'A verified renter').split(' ')[0] }), to: booked.agent_email, template: 'inspection_agent', matchId: b.matchId });
  });
  return json({ message: 'Booked. We’ve emailed you and the agent a calendar invite.' });
});
