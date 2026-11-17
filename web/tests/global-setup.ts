import { Client } from 'pg';
import { migrate } from '../scripts/migrate';

// Fresh schema for every run.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://lumo:lumo-dev@localhost:5432/lumo_test';
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema public cascade; create schema public;');
  await c.end();
  await migrate(url);
}
