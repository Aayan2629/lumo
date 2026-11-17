import { z } from 'zod';
import { env } from '@/lib/env';
import { withService } from '@/lib/db';
import { clientIp, createLoginToken, findOrCreateUser } from '@/lib/auth';
import { enforce } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/providers/turnstile';
import { emailProvider } from '@/lib/providers/email';
import { loginEmail } from '@/lib/emails/templates';
import { json, parse, route } from '@/lib/http';

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(['renter', 'investor', 'agent']).default('renter'),
  turnstile: z.string().max(4096).nullish(),
});

// Sign up and sign in are the same step: we email a magic link. The answer is the same
// whether or not the account exists, so the form can't be used to discover users.
export const POST = route(async (req: Request) => {
  const b = await parse(req, Body);
  const ip = await clientIp();
  await enforce('signup', `ip:${ip}`);
  await enforce('signupEmail', `email:${b.email}`);
  if (!(await verifyTurnstile(b.turnstile, ip))) return json({ error: 'Bot check failed, please try again' }, 400);
  const token = await withService(async (db) => {
    if (b.role === 'agent') {
      // Agent sign-in never creates an account: agencies sign up through /agent/signup.
      const { rows } = await db.query(
        `select u.id from users u join agents a on a.user_id = u.id where u.email = $1 and a.removed_at is null and u.deleted_at is null`, [b.email]);
      return rows[0] ? createLoginToken(db, rows[0].id) : null;
    }
    const u = await findOrCreateUser(db, b.email, b.role);
    return createLoginToken(db, u.id);
  });
  if (token) {
    const link = `${env.appUrl}/auth/verify?token=${token}`;
    await emailProvider().send({ to: b.email, ...loginEmail(link) });
  }
  return json({ message: 'Check your email for a sign-in link. It expires in 15 minutes.', ...(env.allowMocks ? { devHint: '/dev/outbox' } : {}) });
});
