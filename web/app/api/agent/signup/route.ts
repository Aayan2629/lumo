import { z } from 'zod';
import { env } from '@/lib/env';
import { withService } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clientIp, createLoginToken } from '@/lib/auth';
import { enforce } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/providers/turnstile';
import { licenceProvider } from '@/lib/providers/licence';
import { emailProvider } from '@/lib/providers/email';
import { loginEmail } from '@/lib/emails/templates';
import { json, parse, route } from '@/lib/http';

const Body = z.object({
  agencyName: z.string().trim().min(2).max(120),
  licenceNo: z.string().trim().regex(/^\d{6,10}$/, 'Licence numbers are 6 to 10 digits'),
  leasingEmail: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  turnstile: z.string().max(4096).nullish(),
});

// Only NSW-licensed agencies can list. The licence is checked against NSW Fair Trading's
// register at sign-up (and monthly by the daily job once the live register is wired).
export const POST = route(async (req: Request) => {
  const b = await parse(req, Body);
  const ip = await clientIp();
  await enforce('signup', `ip:${ip}`);
  if (!(await verifyTurnstile(b.turnstile, ip))) return json({ error: 'Bot check failed, please try again' }, 400);
  const lic = await licenceProvider().check(b.licenceNo);
  if (!lic.valid) {
    const why = lic.status === 'not_found' ? 'We couldn’t find that licence on the NSW Fair Trading register.' : `That licence is ${lic.status} on the NSW Fair Trading register.`;
    return json({ error: `${why} Only agencies with a current NSW licence can join Lumo.` }, 400);
  }
  const result = await withService(async (db) => {
    const taken = await db.query('select 1 from agencies where licence_no = $1', [b.licenceNo]);
    if (taken.rowCount) return { error: 'An agency with that licence is already on Lumo. Ask its owner to add you to the team.' };
    const existing = await db.query('select id, role from users where email = $1', [b.email]);
    if (existing.rows[0]) return { error: 'That email already has a Lumo account. Use a work email for your agency account.' };
    const ag = await db.query(
      `insert into agencies (name, licence_no, licence_status, licence_checked_at, leasing_email) values ($1, $2, 'current', now(), $3) returning id`,
      [b.agencyName, b.licenceNo, b.leasingEmail]);
    const u = await db.query(`insert into users (email, name, role) values ($1, $2, 'agent') returning id`, [b.email, b.name]);
    await db.query(`insert into agents (user_id, agency_id, licence_no, role) values ($1, $2, $3, 'owner')`, [u.rows[0].id, ag.rows[0].id, b.licenceNo]);
    await audit(db, u.rows[0].id, 'agency.signup', ag.rows[0].id);
    return { token: await createLoginToken(db, u.rows[0].id) };
  });
  if ('error' in result) return json({ error: result.error }, 400);
  await emailProvider().send({ to: b.email, ...loginEmail(`${env.appUrl}/auth/verify?token=${result.token}`) });
  return json({ message: 'Licence confirmed. Check your email for a sign-in link, then set up two-factor sign-in.' });
});
