// Which parts of the seed run against the target database (Lab 10).
// The catalog (4 categories, 100 products) is always upserted. The fictional demo accounts,
// carts and orders are for local development; on a remote (shared/production) database they
// run only when explicitly requested with SEED_DEMO=true.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres"]);

export function isLocalDatabase(databaseUrl: string): boolean {
  return LOCAL_HOSTS.has(new URL(databaseUrl).hostname);
}

export function shouldSeedDemo(databaseUrl: string, env: Partial<Record<string, string>> = process.env): boolean {
  const flag = env.SEED_DEMO?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  if (flag) throw new Error('SEED_DEMO must be "true" or "false".');
  return isLocalDatabase(databaseUrl);
}
