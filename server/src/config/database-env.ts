import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

// npm scripts run from server/. Existing process variables take precedence.
const envPath = resolve(process.cwd(), '../.env');
if (existsSync(envPath)) loadEnvFile(envPath);

export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
  if (!POSTGRES_DB || !POSTGRES_USER || !POSTGRES_PASSWORD) {
    throw new Error(
      'Set DATABASE_URL or POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD in the local environment.',
    );
  }
  return `postgresql://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}@127.0.0.1:55432/${encodeURIComponent(POSTGRES_DB)}`;
}

export function testDatabaseUrl(): string {
  const main = new URL(databaseUrl());
  const test = process.env.TEST_DATABASE_URL
    ? new URL(process.env.TEST_DATABASE_URL)
    : new URL(main.toString());
  if (!process.env.TEST_DATABASE_URL) test.pathname = `${main.pathname}_test`;
  if (!test.pathname.endsWith('_test') || test.pathname === main.pathname) {
    throw new Error(
      'Test database must be separate and its name must end with _test.',
    );
  }
  return test.toString();
}
