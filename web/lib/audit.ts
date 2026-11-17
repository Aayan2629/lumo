import 'server-only';
import type { Db } from './db';

// Append-only: the table has a trigger that rejects update and delete.
export async function audit(db: Db, actor: string, action: string, target?: string) {
  await db.query('insert into audit_log (actor, action, target) values ($1, $2, $3)', [actor, action, target ?? null]);
}
