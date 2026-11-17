import { describe, expect, it } from 'vitest';
import { withService } from '@/lib/db';
import { consumeActionToken, createActionToken } from '@/lib/tokens';
import { decryptField, encryptField, hmac } from '@/lib/crypto';
import { totpAt, verifyTotp, newTotpSecret } from '@/lib/totp';
import { verifyStripeSignature } from '@/lib/providers/billing';
import { rateLimit } from '@/lib/ratelimit';
import { runRetention } from '@/lib/jobs';
import { makeRenter } from './helpers';

describe('email button links', () => {
  it('work once', async () => {
    const t = await withService((db) => createActionToken(db, 'send_application', { matchId: 'm1' }));
    expect(await withService((db) => consumeActionToken(db, t, 'send_application'))).toEqual({ matchId: 'm1' });
    expect(await withService((db) => consumeActionToken(db, t, 'send_application'))).toBeNull();
  });
  it('expire, and can’t be used for a different action', async () => {
    const t = await withService((db) => createActionToken(db, 'reroute', { matchId: 'm2' }, -1000));
    expect(await withService((db) => consumeActionToken(db, t, 'reroute'))).toBeNull();
    const t2 = await withService((db) => createActionToken(db, 'reroute', { matchId: 'm3' }));
    expect(await withService((db) => consumeActionToken(db, t2, 'send_application'))).toBeNull();
  });
  it('are stored hashed', async () => {
    const t = await withService((db) => createActionToken(db, 'reroute', { matchId: 'm4' }));
    const raw = await withService(async (db) => (await db.query('select token_hash from action_tokens')).rows.map((r) => r.token_hash));
    expect(raw).not.toContain(t);
  });
});

describe('crypto', () => {
  it('field encryption round-trips and is randomised', () => {
    const a = encryptField('referee@example.com'), b = encryptField('referee@example.com');
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe('referee@example.com');
    expect(() => decryptField(a.slice(0, -4) + 'AAAA')).toThrow();
  });
  it('TOTP matches RFC 6238 and allows one step of drift', () => {
    // RFC 6238 test secret "12345678901234567890" in base32, T = 59 s -> 287082 (6 digits of 94287082)
    expect(totpAt('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000)).toBe('287082');
    const s = newTotpSecret(), now = Date.now();
    expect(verifyTotp(s, totpAt(s, now - 30_000), now)).toBe(true);
    expect(verifyTotp(s, totpAt(s, now - 120_000), now)).toBe(false);
    expect(verifyTotp(s, 'abcdef', now)).toBe(false);
  });
  it('checks Stripe webhook signatures', () => {
    const body = '{"type":"checkout.session.completed"}', t = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(body, `t=${t},v1=${hmac('whsec', `${t}.${body}`)}`, 'whsec')).toBe(true);
    expect(verifyStripeSignature(body, `t=${t},v1=${hmac('other', `${t}.${body}`)}`, 'whsec')).toBe(false);
    expect(verifyStripeSignature(body, `t=${t - 900},v1=${hmac('whsec', `${t - 900}.${body}`)}`, 'whsec')).toBe(false);
  });
});

describe('rate limiting', () => {
  it('blocks the sixth sign-up from one IP in a window', async () => {
    const ip = `ip-${Date.now()}`;
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await rateLimit('signup', ip)).ok);
    expect(results).toEqual([true, true, true, true, true, false]);
  });
});

describe('retention', () => {
  it('deletes accounts inactive for 12 months', async () => {
    const stale = await makeRenter();
    const fresh = await makeRenter();
    await withService((db) => db.query(`update users set last_seen_at = now() - interval '13 months' where id = $1`, [stale]));
    await runRetention();
    const left = await withService(async (db) => (await db.query('select id from users where id = any($1)', [[stale, fresh]])).rows.map((r) => r.id));
    expect(left).toEqual([fresh]);
  });
});
