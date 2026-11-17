import { apiUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { route } from '@/lib/http';

// Access right (APP 12): everything Lumo holds about you, as JSON.
export const GET = route(async () => {
  const u = await apiUser(['renter', 'investor']);
  const data = await withUser(u.id, async (db) => {
    const q = async (sql: string) => (await db.query(sql, [u.id])).rows;
    return {
      exportedAt: new Date().toISOString(),
      account: (await q('select id, role, name, email, created_at from users where id = $1'))[0],
      profile: (await q('select * from profiles where user_id = $1'))[0] ?? null,
      verifications: await q('select type, status, result_band, provider, provider_ref, checked_at, expires_at from verifications where user_id = $1'),
      references: await q('select past_address, status, created_at, answered_at from reference_requests where user_id = $1'),
      swipes: await q('select listing_id, direction, created_at from swipes where user_id = $1'),
      matches: await q('select id, listing_id, status, created_at from matches where user_id = $1'),
    };
  });
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="lumo-my-data.json"' },
  });
});
