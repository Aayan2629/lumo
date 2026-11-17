import { describe, expect, it } from 'vitest';
import { withService } from '@/lib/db';

// Definition of done: "No ID images, account numbers or transactions exist anywhere in
// Lumo's database". This fails the build if anyone adds a column that could hold them.
const FORBIDDEN = /(passport|licence_image|id_image|id_number|document_number|doc_number|account_number|account_no|bsb|iban|transaction|statement|selfie|photo_id|date_of_birth|dob|tax_file|tfn|medicare|card_number)/i;

describe('schema', () => {
  it('has no columns for ID documents, bank accounts or transactions', async () => {
    const cols = await withService(async (db) => (await db.query(
      `select table_name, column_name from information_schema.columns where table_schema = 'public'`)).rows);
    const bad = cols.filter((c) => FORBIDDEN.test(c.column_name));
    expect(bad).toEqual([]);
  });

  it('has no fields the NSW reform puts off limits on profiles', async () => {
    const cols = await withService(async (db) => (await db.query(
      `select column_name from information_schema.columns where table_name = 'profiles'`)).rows.map((r) => r.column_name));
    for (const c of cols) expect(c).not.toMatch(/photo|social|instagram|facebook|child|tattoo|gender|religion|ethnic|nationality|age\b|marital/i);
  });

  it('turns on row-level security for every table the app role can touch', async () => {
    const rows = await withService(async (db) => (await db.query(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('lumo_app', c.oid, 'select, insert, update, delete')`)).rows);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });

  it('keeps auth and token tables away from the app role entirely', async () => {
    for (const t of ['sessions', 'login_tokens', 'action_tokens', 'rate_limits', 'dev_outbox']) {
      const ok = await withService(async (db) => (await db.query(`select has_table_privilege('lumo_app', $1, 'select') as ok`, [t])).rows[0].ok);
      expect(ok, t).toBe(false);
    }
  });

  it('makes the audit log append-only', async () => {
    await withService((db) => db.query(`insert into audit_log (actor, action) values ('test', 'test')`));
    await expect(withService((db) => db.query(`update audit_log set action = 'x'`))).rejects.toThrow(/append-only/);
    await expect(withService((db) => db.query(`delete from audit_log`))).rejects.toThrow(/append-only/);
  });
});
