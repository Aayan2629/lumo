import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { 'server-only': path.resolve(dir, 'tests/empty.ts'), '@': dir } },
  test: {
    globalSetup: './tests/global-setup.ts',
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://lumo:lumo-dev@localhost:5432/lumo_test',
      APP_URL: 'http://lumo.test',
      FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      LUMO_ALLOW_MOCKS: '1',
      EMAIL_PROVIDER: 'outbox',
      MICROBURBS_PROVIDER: 'sample',
    },
  },
});
