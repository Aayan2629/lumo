import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { env } from './env';

const g = globalThis as unknown as { __lumoPool?: Pool };
export function pool() {
  if (!g.__lumoPool) {
    g.__lumoPool = new Pool({ connectionString: env.databaseUrl, max: 10 });
  }
  return g.__lumoPool;
}

export type Db = PoolClient;

// Every request made on behalf of a signed-in user runs through withUser. It drops to the
// lumo_app role, which has no BYPASSRLS, and sets app.user_id for this transaction only, so
// Postgres row-level security decides what the query can see. A bug in a route can't leak
// another user's rows, because the database itself refuses.
export async function withUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query('begin');
    await c.query('set local role lumo_app');
    await c.query("select set_config('app.user_id', $1, true)", [userId]);
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// Owner connection, bypasses RLS. Only for server-side work that isn't on behalf of a
// signed-in user: login, provider webhooks, match emails, scheduled jobs. Never pass a user
// id from the request body into one of these without checking it first.
export async function withService<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
