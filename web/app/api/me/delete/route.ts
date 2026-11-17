import { z } from 'zod';
import { apiUser, signOut } from '@/lib/auth';
import { withService } from '@/lib/db';
import { audit } from '@/lib/audit';
import { json, parse, route } from '@/lib/http';

// Deletes the account and everything hanging off it (cascades). The audit log keeps only
// the fact that an account was deleted, keyed by id.
export const POST = route(async (req: Request) => {
  const u = await apiUser(['renter', 'investor']);
  await parse(req, z.object({ confirm: z.literal('DELETE') }));
  await withService(async (db) => {
    await db.query('delete from users where id = $1', [u.id]);
    await audit(db, u.id, 'user.delete');
  });
  await signOut();
  return json({ redirect: '/?deleted=1' });
});
