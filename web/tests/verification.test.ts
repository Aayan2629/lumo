import { describe, expect, it } from 'vitest';
import { withService } from '@/lib/db';
import { signWebhook, verifyWebhook, rentCover, incomeBand } from '@/lib/providers/verify';
import { handleProviderWebhook, startCheck } from '@/lib/verification';
import { badgesFor, expiresAt, EXPIRY_DAYS } from '@/lib/badges';
import { makeRenter } from './helpers';

describe('provider webhooks', () => {
  it('accepts a correctly signed body and rejects tampering or replays', () => {
    const body = JSON.stringify({ kind: 'id', providerRef: 'x', passed: true, documents: 2, liveness: true });
    const sig = signWebhook('id', body);
    expect(verifyWebhook('id', body, sig)).toBe(true);
    expect(verifyWebhook('id', body.replace('true', 'false'), sig)).toBe(false);
    expect(verifyWebhook('bank', body, sig)).toBe(false); // other provider's secret
    const old = signWebhook('id', body, Math.floor(Date.now() / 1000) - 600);
    expect(verifyWebhook('id', body, old)).toBe(false);
    expect(verifyWebhook('id', body, null)).toBe(false);
  });

  it('stores only bands from a bank check, never the figures', async () => {
    const u = await makeRenter();
    const s = await startCheck(u, 'bank');
    const body = JSON.stringify({ kind: 'bank', providerRef: s.providerRef, passed: true, weeklyIncome: 2437, balance: 3123 });
    expect(await handleProviderWebhook('bank', body, 'nonsense')).toBe(false);
    expect(await handleProviderWebhook('bank', body, signWebhook('bank', body))).toBe(true);
    const rows = await withService(async (db) => (await db.query(`select type, status, result_band from verifications where user_id = $1 order by type`, [u])).rows);
    expect(rows).toEqual([
      { type: 'bond', status: 'passed', result_band: 'yes' },        // 3123 >= 4 x 700
      { type: 'income', status: 'passed', result_band: '2250-2500' },
    ]);
    const dump = JSON.stringify(await withService(async (db) => (await db.query(`select * from verifications where user_id = $1`, [u])).rows));
    expect(dump).not.toMatch(/2437|3123/);
  });

  it('needs two documents and liveness for the ID badge', async () => {
    const u = await makeRenter();
    const s = await startCheck(u, 'id');
    const body = JSON.stringify({ kind: 'id', providerRef: s.providerRef, passed: true, documents: 1, liveness: true });
    await handleProviderWebhook('id', body, signWebhook('id', body));
    const b = await withService((db) => badgesFor(db, u));
    expect(b.id).toBeUndefined();
  });
});

describe('badges', () => {
  it('expire on schedule: income and bond 30 days, ID 12 months', () => {
    expect(EXPIRY_DAYS).toMatchObject({ income: 30, bond: 30, id: 365 });
    const from = new Date('2026-11-17T00:00:00Z');
    expect(expiresAt('income', from).toISOString().slice(0, 10)).toBe('2026-12-17');
    expect(expiresAt('id', from).toISOString().slice(0, 10)).toBe('2027-11-17');
  });

  it('ignore expired checks', async () => {
    const u = await makeRenter();
    await withService((db) => db.query(
      `insert into verifications (user_id, type, status, result_band, provider, checked_at, expires_at) values ($1, 'income', 'passed', '2000-2250', 'mock', now() - interval '40 days', now() - interval '10 days')`, [u]));
    expect((await withService((db) => badgesFor(db, u))).income).toBeUndefined();
  });

  it('work out rent cover from the band, rounded down to 0.5x', () => {
    expect(incomeBand(2437)).toBe('2250-2500');
    expect(rentCover('2250-2500', 700)).toBe(3);
    expect(rentCover('1750-2000', 700)).toBe(2.5);
    expect(rentCover(null, 700)).toBeNull();
  });
});
