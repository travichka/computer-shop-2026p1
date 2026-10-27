import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { testDatabaseName, testDatabaseUrl } from "./test-db";

/**
 * Recreates the test database and applies the migration history to it with `prisma migrate deploy`
 * (the same command as for a shared/production database). The schema, CHECK constraints and
 * COLLATE "C" therefore come only from prisma/migrations — Table 8.1 "Migracje na pustej bazie".
 */
export default async function setup() {
  const url = testDatabaseUrl();
  const name = testDatabaseName();

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }

  const prisma = fileURLToPath(new URL("../../node_modules/.bin/prisma", import.meta.url));
  execFileSync(prisma, ["migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
