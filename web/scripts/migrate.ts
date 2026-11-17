// Applies db/migrations/*.sql in order, once each. Usage: npm run db:migrate
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

export async function migrate(url = process.env.DATABASE_URL) {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())');
    const dir = join(__dirname, '..', 'db', 'migrations');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      const done = await c.query('select 1 from schema_migrations where name = $1', [f]);
      if (done.rowCount) continue;
      await c.query('begin');
      await c.query(readFileSync(join(dir, f), 'utf8'));
      await c.query('insert into schema_migrations (name) values ($1)', [f]);
      await c.query('commit');
      console.log('applied', f);
    }
  } finally {
    await c.end();
  }
}

if (require.main === module) migrate().catch((e) => { console.error(e); process.exit(1); });
