import { z } from 'zod';
import { apiUser } from '@/lib/auth';
import { withService } from '@/lib/db';
import { audit } from '@/lib/audit';
import { agentContext } from '@/lib/agent';
import { json, parse, route } from '@/lib/http';

const Body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), name: z.string().trim().min(1).max(80), email: z.string().trim().toLowerCase().email(), licenceNo: z.string().trim().max(20).optional() }),
  z.object({ op: z.literal('remove'), userId: z.string().uuid() }),
]);

// Agency owners manage the team. Removing an agent kills their sessions on the spot.
export const POST = route(async (req: Request) => {
  const u = await apiUser(['agent']);
  const ctx = await agentContext(u.id);
  if (ctx.agent_role !== 'owner') return json({ error: 'Only the agency owner can manage the team' }, 403);
  const b = await parse(req, Body);
  return withService(async (db) => {
    if (b.op === 'add') {
      const ex = await db.query('select id from users where email = $1', [b.email]);
      if (ex.rows[0]) return json({ error: 'That email already has a Lumo account' }, 400);
      const nu = await db.query(`insert into users (email, name, role) values ($1, $2, 'agent') returning id`, [b.email, b.name]);
      await db.query(`insert into agents (user_id, agency_id, licence_no, role) values ($1, $2, $3, 'agent')`, [nu.rows[0].id, ctx.id, b.licenceNo ?? null]);
      await audit(db, u.id, 'team.add', nu.rows[0].id);
      return json({ message: `${b.name} can now sign in at /agent/login with ${b.email}.` });
    }
    if (b.userId === u.id) return json({ error: 'You can’t remove yourself' }, 400);
    const r = await db.query(`update agents set removed_at = now() where user_id = $1 and agency_id = $2 and removed_at is null`, [b.userId, ctx.id]);
    if (!r.rowCount) return json({ error: 'Not on your team' }, 404);
    await db.query('delete from sessions where user_id = $1', [b.userId]);
    await audit(db, u.id, 'team.remove', b.userId);
    return json({ message: 'Removed. Their access was cut off immediately.' });
  });
});
