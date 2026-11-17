import 'server-only';
import { withService, withUser } from './db';
import { audit } from './audit';
import { expiresAt } from './badges';
import { decryptField, encryptField } from './crypto';
import { env } from './env';
import { createActionToken } from './tokens';
import { sendEmail } from './match';
import { refereeEmail } from './emails/templates';
import { financeBand, incomeBand, verifyProvider, verifyWebhook, type CheckKind, type ProviderResult } from './providers/verify';

// Starts a hosted check and records it as pending.
export async function startCheck(userId: string, kind: CheckKind) {
  const p = verifyProvider(kind);
  const s = await p.start(kind, userId);
  await withService(async (db) => {
    const types = kind === 'bank' ? ['income', 'bond'] : [kind];
    for (const t of types) {
      await db.query(`insert into verifications (user_id, type, status, provider, provider_ref) values ($1, $2, 'pending', $3, $4)`,
        [userId, t, s.provider, s.providerRef]);
    }
    await audit(db, userId, `verify.start.${kind}`, s.providerRef);
  });
  return s;
}

// Webhook entry point: raw body + signature header. Returns false if the signature is bad.
export async function handleProviderWebhook(kind: CheckKind, rawBody: string, signature: string | null) {
  if (!verifyWebhook(kind, rawBody, signature)) return false;
  const r = JSON.parse(rawBody) as ProviderResult;
  if (r.kind !== kind || typeof r.providerRef !== 'string') return false;
  await applyResult(r);
  return true;
}

// Only bands and dates are written. The raw figures in the webhook are dropped here.
async function applyResult(r: ProviderResult) {
  await withService(async (db) => {
    const pending = await db.query(`select user_id from verifications where provider_ref = $1 and status = 'pending' limit 1`, [r.providerRef]);
    const userId = pending.rows[0]?.user_id;
    if (!userId) return;
    const now = new Date();
    const set = (type: string, passed: boolean, band: string | null, exp: Date) => db.query(
      `update verifications set status = $1, result_band = $2, checked_at = $3, expires_at = $4
       where provider_ref = $5 and type = $6 and status = 'pending'`,
      [passed ? 'passed' : 'failed', band, now, exp, r.providerRef, type]);
    if (r.kind === 'id') {
      const ok = r.passed && r.liveness && r.documents >= 2;
      await set('id', ok, ok ? `${r.documents} documents` : null, expiresAt('id', now));
    } else if (r.kind === 'bank') {
      const prof = await db.query('select max_rent_weekly from profiles where user_id = $1', [userId]);
      const rent = prof.rows[0]?.max_rent_weekly ?? 0;
      await set('income', r.passed, r.passed ? incomeBand(r.weeklyIncome) : null, expiresAt('income', now));
      // Bond ready: holds at least 4 weeks' rent (the NSW bond maximum) at their max rent.
      const bondOk = r.passed && rent > 0 && r.balance >= rent * 4;
      await set('bond', r.passed, r.passed ? (bondOk ? 'yes' : 'no') : null, expiresAt('bond', now));
    } else if (r.kind === 'finance') {
      const exp = new Date(r.expiresOn);
      await set('finance', r.passed, r.passed ? financeBand(r.preApprovedUpTo) : null, Number.isFinite(exp.getTime()) ? exp : expiresAt('finance', now));
    }
    await audit(db, 'provider', `verify.result.${r.kind}`, r.providerRef);
  });
}

export async function requestReference(userId: string, refereeEmail_: string, pastAddress: string) {
  const id = await withUser(userId, async (db) => {
    const { rows } = await db.query(
      `insert into reference_requests (user_id, referee_email_enc, past_address) values ($1, $2, $3) returning id`,
      [userId, encryptField(refereeEmail_.trim().toLowerCase()), pastAddress]);
    return rows[0].id as string;
  });
  await withService(async (db) => {
    const u = await db.query('select name from users where id = $1', [userId]);
    const token = await createActionToken(db, 'reference_confirm', { referenceId: id });
    const mail = refereeEmail({ renterFirstName: String(u.rows[0]?.name ?? 'A renter').split(' ')[0], pastAddress, url: `${env.appUrl}/e/reference?t=${token}` });
    await sendEmail(db, { ...mail, to: refereeEmail_, template: 'referee' });
    await audit(db, userId, 'reference.request', id);
  });
  return id;
}

export async function answerReference(referenceId: string, confirmed: boolean) {
  await withService(async (db) => {
    const { rows } = await db.query(
      `update reference_requests set status = $1, answered_at = now(), referee_email_enc = null
       where id = $2 and status = 'sent' returning user_id`, [confirmed ? 'confirmed' : 'declined', referenceId]);
    if (!rows[0]) return;
    if (confirmed) {
      await db.query(
        `insert into verifications (user_id, type, status, result_band, provider, provider_ref, checked_at, expires_at)
         values ($1, 'reference', 'passed', 'confirmed', 'lumo', $2, now(), $3)`, [rows[0].user_id, referenceId, expiresAt('reference')]);
    }
    await audit(db, 'referee', confirmed ? 'reference.confirm' : 'reference.decline', referenceId);
  });
}

export { decryptField };
