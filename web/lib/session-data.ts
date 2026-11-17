import 'server-only';
import { withUser } from './db';
import { badgesFor } from './badges';

export async function myProfile(userId: string) {
  return withUser(userId, async (db) => {
    const u = (await db.query('select id, name, email, role from users where id = $1', [userId])).rows[0];
    const p = (await db.query('select * from profiles where user_id = $1', [userId])).rows[0] ?? null;
    const badges = await badgesFor(db, userId);
    return { user: u, profile: p, badges };
  });
}
