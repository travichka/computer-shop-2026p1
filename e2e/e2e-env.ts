import { config } from "dotenv";

// Environment of the browser test (Lab 10, extension "Test przeglądarkowy koszyka").
// Its own database (*_e2e_test, recreated for every run), its own port and fake auth values:
// it never uses the Production database or the real OAuth App.
config({ quiet: true });

export const E2E_PORT = 3200;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const E2E_AUTH = {
  BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdefghijklmnopqrstuv",
  BETTER_AUTH_URL: E2E_BASE_URL,
  GITHUB_CLIENT_ID: "e2e-fake-client-id",
  GITHUB_CLIENT_SECRET: "e2e-fake-client-secret",
} as const;

/** E2E_DATABASE_URL, or TEST_DATABASE_URL with the database name shop_e2e_test. */
export function e2eDatabaseUrl(): string {
  const explicit = process.env.E2E_DATABASE_URL;
  const base = explicit ?? process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("Set E2E_DATABASE_URL or TEST_DATABASE_URL (see .env.example).");
  const url = new URL(base);
  if (!explicit) url.pathname = "/shop_e2e_test";
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9_]+_test$/.test(name)) throw new Error(`Refusing to use "${name}": the name must end with _test.`);
  if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === url.pathname) {
    throw new Error(`Refusing to use "${name}": it is the application database.`);
  }
  return url.toString();
}
