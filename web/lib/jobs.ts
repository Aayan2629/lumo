import 'server-only';
import { env } from './env';
import { withService } from './db';
import { audit } from './audit';
import { sendEmail } from './match';
import { matchExpiredEmail } from './emails/templates';

// Matches with no action for 7 days close, and the renter is told kindly.
export async function expireMatches() {
  return withService(async (db) => {
    const { rows } = await db.query(
      `update matches m set status = 'expired', updated_at = now()
       from listings l, users u
       where l.id = m.listing_id and u.id = m.user_id and m.status = 'new' and m.created_at < now() - interval '7 days'
       returning m.id, l.address, u.email`);
    for (const r of rows) {
      await sendEmail(db, { ...matchExpiredEmail({ address: r.address, url: `${env.appUrl}/app` }), to: r.email, template: 'match_expired', matchId: r.id });
    }
    if (rows.length) await audit(db, 'system', 'match.expire', `${rows.length}`);
    return rows.length;
  });
}

// Written retention schedule (see /privacy):
//  - accounts inactive for 12 months are deleted
//  - match records are deleted after 2 years
//  - unanswered reference requests close after 30 days and the referee email is wiped
//  - expired login links, sessions and email-button tokens are removed daily
export async function runRetention() {
  return withService(async (db) => {
    const r = {
      users: (await db.query(`delete from users where role <> 'admin' and last_seen_at < now() - interval '12 months'`)).rowCount,
      matches: (await db.query(`delete from matches where created_at < now() - interval '2 years'`)).rowCount,
      references: (await db.query(`update reference_requests set status = 'expired', referee_email_enc = null where status = 'sent' and created_at < now() - interval '30 days'`)).rowCount,
      loginTokens: (await db.query(`delete from login_tokens where expires_at < now()`)).rowCount,
      sessions: (await db.query(`delete from sessions where expires_at < now()`)).rowCount,
      actionTokens: (await db.query(`delete from action_tokens where expires_at < now() - interval '1 day'`)).rowCount,
      rateLimits: (await db.query(`delete from rate_limits where window_start < now() - interval '1 day'`)).rowCount,
      outbox: (await db.query(`delete from dev_outbox where created_at < now() - interval '7 days'`)).rowCount,
    };
    await audit(db, 'system', 'retention.run', JSON.stringify(r));
    return r;
  });
}
