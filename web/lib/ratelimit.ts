import 'server-only';
import { withService } from './db';

// Fixed-window limiter in Postgres, so it holds across server instances. Keys look like
// 'signup:ip:1.2.3.4' or 'swipe:user:<id>'.
export const LIMITS = {
  signup: { limit: 5, windowSec: 600 },       // 5 login/sign-up emails per 10 min per IP
  signupEmail: { limit: 3, windowSec: 600 },  // and 3 per email address
  swipe: { limit: 120, windowSec: 60 },       // 2 a second sustained is already a bot
  verify: { limit: 10, windowSec: 3600 },
  totp: { limit: 6, windowSec: 300 },
} as const;

export async function rateLimit(name: keyof typeof LIMITS, subject: string) {
  const { limit, windowSec } = LIMITS[name];
  const windowStart = new Date(Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000);
  const count = await withService(async (db) => {
    const { rows } = await db.query(
      `insert into rate_limits (key, window_start, count) values ($1, $2, 1)
       on conflict (key, window_start) do update set count = rate_limits.count + 1
       returning count`, [`${name}:${subject}`, windowStart]);
    return rows[0].count as number;
  });
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec: windowSec };
}

export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) { super('Too many requests'); }
}
export async function enforce(name: keyof typeof LIMITS, subject: string) {
  const r = await rateLimit(name, subject);
  if (!r.ok) throw new RateLimitError(r.retryAfterSec);
}
