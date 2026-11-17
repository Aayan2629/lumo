import 'server-only';
import type { Db } from './db';
import { randomToken, sha256 } from './crypto';

// Single-use links for email buttons. The link carries a 256-bit random token; the database
// keeps only its hash, the action, the payload and an expiry. A token works once.
export type ActionName = 'offer_inspection' | 'send_application' | 'reroute' | 'reference_confirm' | 'match_outcome';
const DAY = 86_400_000;

export async function createActionToken(db: Db, action: ActionName, payload: Record<string, unknown>, ttlMs = 7 * DAY) {
  const token = randomToken();
  await db.query('insert into action_tokens (token_hash, action, payload, expires_at) values ($1, $2, $3, $4)',
    [sha256(token), action, payload, new Date(Date.now() + ttlMs)]);
  return token;
}

// Looks a token up without using it, so a confirmation page can show what the button does.
export async function peekActionToken(db: Db, token: string, action: ActionName) {
  const { rows } = await db.query(
    'select payload from action_tokens where token_hash = $1 and action = $2 and used_at is null and expires_at > now()',
    [sha256(token), action]);
  return (rows[0]?.payload ?? null) as Record<string, string> | null;
}

export async function consumeActionToken(db: Db, token: string, action: ActionName) {
  const { rows } = await db.query(
    `update action_tokens set used_at = now()
     where token_hash = $1 and action = $2 and used_at is null and expires_at > now()
     returning payload`, [sha256(token), action]);
  return (rows[0]?.payload ?? null) as Record<string, string> | null;
}
