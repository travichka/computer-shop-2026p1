import { execFileSync } from "node:child_process";
import pg from "pg";
import { e2eDatabaseUrl } from "./e2e-env";

/** Empty *_e2e_test database → committed migrations → catalog seed (no demo accounts). */
export default async function globalSetup() {
  const url = e2eDatabaseUrl();
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
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
  const env = { ...process.env, DATABASE_URL: url, SEED_DEMO: "false" };
  execFileSync("npx", ["--no-install", "prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync("npx", ["--no-install", "prisma", "db", "seed"], { env, stdio: "pipe" });
}
