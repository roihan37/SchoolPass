import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { testDatabaseUrl } from '../src/config/database-env.js';

const testUrl = new URL(testDatabaseUrl());
const name = decodeURIComponent(testUrl.pathname.slice(1));
const adminUrl = new URL(testUrl);
adminUrl.pathname = '/postgres';
const client = new pg.Client({
  connectionString: adminUrl.toString(),
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  const result = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [name],
  );
  if (result.rowCount === 0) {
    await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
  }
} finally {
  await client.end();
}
const result = spawnSync(
  process.execPath,
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  {
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: 'inherit',
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
