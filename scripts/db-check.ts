// Read-only check of the database in DATABASE_URL (Lab 10, chapter 4). Run it before migrate/seed
// to confirm the target, and after them to verify the schema:
//   npm run db:check                      → target, server, limits, tables, COLLATE "C", CHECKs
//   npm run db:check -- --target-only     → only the masked target, no connection
// The password is never printed. Nothing is written.
import { config } from "dotenv";
import pg from "pg";
import { describeTarget, formatTarget } from "./lib/db-target";

config({ quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}

const target = describeTarget(url);
console.log(`Target: ${formatTarget(target)}`);
if (!target.local && target.sslmode !== "verify-full" && target.sslmode !== "require") {
  console.warn("WARNING: remote database without sslmode=verify-full in the connection string.");
}
if (process.argv.includes("--target-only")) process.exit(0);

const TABLES = ["Category", "Product", "User", "Account", "Session", "Verification", "Cart", "CartItem", "Order", "OrderItem"];

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000 });
let failed = false;
try {
  await client.connect();
  const one = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) =>
    (await client.query<T>(sql, params)).rows[0];

  const server = await one<{ version: string; max: string; reserved: string; db: string; who: string; tls: boolean | null }>(
    `SELECT current_setting('server_version') AS version,
            current_setting('max_connections') AS max,
            current_setting('superuser_reserved_connections') AS reserved,
            current_database() AS db, current_user AS who,
            (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls`,
  );
  const conns = await one<{ total: string; mine: string }>(
    `SELECT count(*) AS total, count(*) FILTER (WHERE datname = current_database()) AS mine FROM pg_stat_activity`,
  );
  console.log(`Server: PostgreSQL ${server.version}, database ${server.db}, role ${server.who}, TLS ${server.tls ? "on" : "off"}`);
  console.log(
    `Connections: ${conns.total} open (${conns.mine} to this database) of max_connections=${server.max} ` +
      `(${server.reserved} reserved for superusers)`,
  );

  const migrations = await client
    .query<{ name: string; finished: boolean }>(
      `SELECT migration_name AS name, finished_at IS NOT NULL AND rolled_back_at IS NULL AS finished
       FROM "_prisma_migrations" ORDER BY started_at`,
    )
    .then((result) => result.rows)
    .catch(() => null);
  if (migrations === null) {
    console.log("Migrations: _prisma_migrations not found (empty database — run prisma migrate deploy).");
  } else {
    const broken = migrations.filter((migration) => !migration.finished);
    console.log(`Migrations: ${migrations.length} applied${broken.length ? `, NOT FINISHED: ${broken.map((m) => m.name).join(", ")}` : ""}`);
    failed ||= broken.length > 0;
  }

  for (const table of TABLES) {
    const exists = await one<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public."${table}"`]);
    if (!exists.ok) {
      console.log(`  ${table.padEnd(13)} MISSING`);
      failed = true;
      continue;
    }
    const count = await one<{ n: string }>(`SELECT count(*) AS n FROM "${table}"`);
    console.log(`  ${table.padEnd(13)} ${count.n} rows`);
  }

  const collation = await one<{ collation: string | null }>(
    `SELECT collation_name AS collation FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'nameSortKey'`,
  );
  const checks = await one<{ n: string }>(
    `SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = 'public' AND c.contype = 'c'`,
  );
  const cartUnique = await one<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'CartItem'
     AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%"cartId"%' AND indexdef ILIKE '%"productId"%') AS ok`,
  );
  console.log(`Product.nameSortKey collation: ${collation?.collation ?? "(missing)"}`);
  console.log(`CHECK constraints: ${checks.n}; unique (cartId, productId): ${cartUnique.ok ? "yes" : "NO"}`);
  failed ||= collation?.collation !== "C" || !cartUnique.ok;
} catch (error) {
  // pg error messages do not contain the password; the code helps (28P01 auth, 53300 too many connections).
  const code = (error as { code?: string }).code;
  console.error(`Database check failed${code ? ` (${code})` : ""}: ${(error as Error).message}`);
  failed = true;
} finally {
  await client.end().catch(() => {});
}
process.exitCode = failed ? 1 : 0;
