import 'server-only';
import { env } from './env';
import { withService } from './db';
import { sendEmail } from './match';
import { newSlotsEmail } from './emails/templates';

// Sydney local time from a datetime-local input ("2026-11-20T10:00").
export function sydneyToUtc(local: string) {
  const guess = new Date(local + 'Z');
  const offset = new Date(guess.toLocaleString('en-US', { timeZone: 'Australia/Sydney' })).getTime() - new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  return new Date(guess.getTime() - offset);
}

export async function notifyNewSlots(listingId: string) {
  await withService(async (db) => {
    const { rows } = await db.query(
      `select m.id, u.email, l.address from matches m join users u on u.id = m.user_id join listings l on l.id = m.listing_id
       where m.listing_id = $1 and m.status = 'new'`, [listingId]);
    for (const r of rows) await sendEmail(db, { ...newSlotsEmail({ address: r.address, url: `${env.appUrl}/app/matches` }), to: r.email, template: 'new_slots', matchId: r.id });
  });
}
