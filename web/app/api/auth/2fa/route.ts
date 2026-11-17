import { z } from 'zod';
import { getUser, markMfaOk } from '@/lib/auth';
import { withService } from '@/lib/db';
import { audit } from '@/lib/audit';
import { decryptField } from '@/lib/crypto';
import { verifyTotp } from '@/lib/totp';
import { enforce } from '@/lib/ratelimit';
import { json, parse, route } from '@/lib/http';

const Body = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

export const POST = route(async (req: Request) => {
  const u = await getUser();
  if (!u || u.role !== 'agent') return json({ error: 'Sign in first' }, 401);
  const { code } = await parse(req, Body);
  await enforce('totp', `user:${u.id}`);
  const ok = await withService(async (db) => {
    const { rows } = await db.query('select totp_secret_enc, totp_enabled_at from agents where user_id = $1', [u.id]);
    const a = rows[0];
    if (!a?.totp_secret_enc) return false;
    if (!verifyTotp(decryptField(a.totp_secret_enc), code)) { await audit(db, u.id, 'mfa.fail'); return false; }
    if (!a.totp_enabled_at) await db.query('update agents set totp_enabled_at = now() where user_id = $1', [u.id]);
    await audit(db, u.id, a.totp_enabled_at ? 'mfa.pass' : 'mfa.enrol');
    return true;
  });
  if (!ok) return json({ error: 'That code didn’t match. Check your authenticator app and try again.' }, 400);
  await markMfaOk();
  return json({ redirect: '/agent' });
});
